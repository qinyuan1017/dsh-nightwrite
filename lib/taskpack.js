/**
 * 长夜 · 任务包（对应 oh-story 的 scripts/build_architect_brief.py）
 *
 * 问题：现在派单的 materials 是一段字符串（lib/dispatch.js 的 issueDispatch），
 * 意味着「有没有材料」取决于开票的人当时脑子里想到什么，而且材料全塞进 prompt：
 * 书一长，prompt 就爆，模型反而看不到重点。
 *
 * 做法：派单前把材料写成一包文件落在磁盘上，prompt 只给 manifest 的路径——
 * 模型按需去读，读了几份它自己说，没读的在回执里会对不上。
 *
 * 三个刻意的设计：
 *   1. prompt 不装材料，只装「材料在哪 + 为什么给你这份」。
 *   2. 每份材料带 sha1 —— 回执说「我读了细纲」，能核对它读的是不是这一版。
 *   3. omitted 显式列出「这次故意没给你的部分」，而不是静默截断。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { randomBytes } from 'node:crypto'
import * as store from './store.js'
import { pickOutline, outlineStats } from './outlineview.js'
import { normalizeRole, ROLES } from './roles.js'
import { fileURLToPath } from 'node:url'

/**
 * 本包的根目录（skills/ 在这儿）。
 *
 * 不写成常量绝对路径：测试会把模块复制到临时目录跑，写死就会指回开发机。
 * 必须用 fileURLToPath —— new URL().pathname 会把中文目录名百分号编码
 * （C:\Users\%E4%BA%AD...\），交给模型当路径用必然读不到。
 */
const DEFAULT_REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/** 派单 prompt 的字节上限：超过就不是「任务书」，是「附件」。 */
export const PROMPT_MAX_BYTES = 4096

/** 单份材料超过这个大小就换成取段版（细纲 / 正文都可能超）。 */
const MATERIAL_MAX_BYTES = 12 * 1024

const nowIso = () => new Date().toISOString()

function stamp() {
  return nowIso().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
}

function fail(message, code = 'invalid') {
  const error = new Error(message)
  error.code = code
  throw error
}

function sha1(text) {
  return createHash('sha1').update(text, 'utf8').digest('hex')
}

function bytes(text) {
  return Buffer.byteLength(String(text ?? ''), 'utf8')
}

/** 作品目录下的工作区：<项目>/.nightwrite/work/ */
export function workRoot(projectDir) {
  return path.join(projectDir, '.nightwrite', 'work')
}

/**
 * 按岗位挑材料。
 *
 * 这里不是「把所有东西都给它」，而是按岗位职责给最小够用集：
 * 架构师要骨架，写手要细纲 + 账本 + 人物状态，审校要正文 + 账本，
 * 读者代理只要正文。给多了模型会挑不动，给少了它会自己编。
 */
// skills 每个岗位都带：手册是「怎么写」的方法，没有它子 agent 只能凭印象发挥。
const MATERIAL_PLAN = {
  'nightwrite-coordinator': ['project', 'outline-stats', 'dispatch-recent', 'chapter-list-recent', 'skills'],
  'nightwrite-story-architect': ['project', 'outline-slice', 'chapter-list-recent', 'ledger-condensed', 'skills'],
  'nightwrite-chapter-writer': ['project', 'outline-chapter', 'ledger-condensed', 'chapter-prev', 'skills'],
  'nightwrite-consistency-checker': ['project', 'chapter-body', 'ledger-condensed', 'outline-chapter', 'skills'],
  'nightwrite-reader-proxy': ['project', 'chapter-body', 'skills'],
  'nightwrite-worldbuilder': ['project', 'ledger-condensed', 'outline-stats', 'skills'],
  'nightwrite-character-designer': ['project', 'ledger-condensed', 'skills'],
  'nightwrite-style-specialist': ['project', 'chapter-body', 'style-profile', 'skills'],
  'nightwrite-researcher': ['project', 'outline-chapter', 'skills'],
  'nightwrite-editor': ['project', 'chapter-body', 'outline-chapter', 'skills'],
  'nightwrite-rewrite-specialist': ['project', 'chapter-body', 'outline-chapter', 'ledger-condensed', 'skills'],
}

/** 每条材料都写清「为什么要给你」，不写就是没想过。 */
const WHY = {
  project: '书名、题材、质量门禁、月预算 —— 判断「这一章该按什么标准写」的前提',
  'outline-stats': '全书卷数与进度 —— 不给你会以为还在第一卷',
  'outline-slice': '当前卷的细纲（超预算会自动降级，degraded=true 表示只看得到部分字段）',
  'outline-chapter': '这一回自己的细纲：摘要 + 钩子 + 状态',
  'chapter-list-recent': '最近写过的章节与状态 —— 避免和刚写完的内容撞车',
  'chapter-body': '待处理的正文全文（这是你的主要工作对象）',
  'chapter-prev': '上一回正文 —— 接续时要对得上场景、时间、人物位置',
  'ledger-condensed': '账本压缩版（每类只给名字与前几条）—— 设定一致性靠它，但全文太大',
  'style-profile': '本书文风参数 —— 没有就按默认写法，不要自己发明风格',
  'dispatch-recent': '最近派出去还没交回执的单子 —— 避免重复派单',
  skills: '你这个岗位用得上的手册（只给路径和一句话，不嵌正文）—— 读了照做，别凭印象发挥',
}

async function readTextSafe(file) {
  try {
    return await fs.readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return ''
    throw error
  }
}

/** 账本压缩：每类只留条数与名字，正文里的细节靠 changer 自己去读原文件。 */
function condenseLedger(ledger, perKind = 12) {
  const lines = []
  for (const kind of store.LEDGER_KINDS) {
    const rows = Array.isArray(ledger?.[kind]) ? ledger[kind] : []
    if (!rows.length) continue
    lines.push(`### ${kind}（共 ${rows.length} 条）`)
    for (const row of rows.slice(0, perKind)) {
      const name = String(row?.name ?? row?.title ?? row?.key ?? row?.id ?? '').trim()
      const value = String(row?.value ?? row?.desc ?? row?.summary ?? '').trim()
      lines.push(`- ${name || row?.id}${value ? `：${value.slice(0, 120)}` : ''}`)
    }
    if (rows.length > perKind) lines.push(`- ……另有 ${rows.length - perKind} 条，需要时用 ledger.get 取全文`)
    lines.push('')
  }
  return lines.join('\n')
}

/**
 * 材料生成器：每个 key 返回 { name, why, text } 或 null。
 * 拿不到的材料返回 null 并进 omitted，不假装有。
 */
async function materialFor(key, ctx) {
  const { root, projectId, dir, chapter, outline, chapters } = ctx

  if (key === 'project') {
    // getProject 返回 { meta, dir }，不是扁平对象——这里踩过一次，别直接读 .name
    const { meta } = await store.getProject(root, projectId)
    return {
      name: 'project.md',
      why: WHY.project,
      text: [
        `# ${meta.name}`,
        '',
        `- 题材：${meta.genre || '（未填）'}`,
        `- 质量门禁：${meta.qualityGate ?? '（未填）'}`,
        `- 目标字数：${meta.targetWords ?? 0}`,
        `- 月预算：${meta.monthlyBudget ?? 0}`,
      ].join('\n'),
    }
  }

  if (key === 'outline-stats') {
    if (!outline.volumes.length) return null
    const stats = outlineStats(outline)
    return {
      name: 'outline-stats.md',
      why: WHY['outline-stats'],
      text: [
        '# 全书进度',
        '',
        `共 ${stats.total} 回：已写 ${stats.written} / 草稿 ${stats.drafted} / 待写 ${stats.todo}（${stats.percent}%）`,
        '',
        ...stats.volumes.map((v) => `- 第${v.index}卷 ${v.title}：${v.written + v.drafted}/${v.total}（${v.percent}%）`),
      ].join('\n'),
    }
  }

  if (key === 'outline-slice') {
    if (!outline.volumes.length) return null
    // 有章号就定位到那一卷，没章号给全书（会自动降级）
    let volume = null
    if (chapter) {
      const hit = outline.volumes.find((vol) => (vol.chapters ?? []).some((row) => Number(row.chapter) === chapter))
      volume = hit ? Number(hit.index) : null
    }
    const slice = pickOutline(outline, volume ? { volume } : {})
    return {
      name: 'outline-slice.json',
      why: WHY['outline-slice'],
      text: JSON.stringify(slice, null, 2),
    }
  }

  if (key === 'outline-chapter') {
    if (!chapter) return null
    for (const vol of outline.volumes) {
      for (const row of (vol.chapters ?? [])) {
        if (Number(row.chapter) !== chapter) continue
        return {
          name: 'outline-chapter.md',
          why: WHY['outline-chapter'],
          text: [
            `# 第 ${chapter} 回 细纲`,
            '',
            `- 标题：${row.title || '（未填）'}`,
            `- 状态：${row.status || 'todo'}`,
            `- 摘要：${row.summary || '（未填）'}`,
            `- 章末钩子：${row.hook || '（未填）'}`,
            vol.summary ? `- 本卷目标：${vol.summary}` : '',
          ].filter(Boolean).join('\n'),
        }
      }
    }
    return null
  }

  if (key === 'chapter-list-recent') {
    if (!chapters.length) return null
    const recent = chapters.slice(-12).reverse()
    return {
      name: 'chapter-list-recent.md',
      why: WHY['chapter-list-recent'],
      text: [
        '# 最近 12 回',
        '',
        ...recent.map((row) => `- 第${row.chapter}回 ${row.title || '（无题）'} · ${row.status} · ${row.words} 字`),
      ].join('\n'),
    }
  }

  if (key === 'chapter-body') {
    if (!chapter) return null
    const data = await store.getChapter(root, projectId, chapter)
    if (!data?.text) return null
    return { name: 'chapter-body.md', why: WHY['chapter-body'], text: data.text }
  }

  if (key === 'chapter-prev') {
    if (!chapter || chapter <= 1) return null
    const data = await store.getChapter(root, projectId, chapter - 1)
    if (!data?.text) return null
    return { name: 'chapter-prev.md', why: WHY['chapter-prev'], text: data.text }
  }

  if (key === 'ledger-condensed') {
    const ledger = await store.getLedger(root, projectId)
    const text = condenseLedger(ledger)
    if (!text.trim()) return null
    return { name: 'ledger-condensed.md', why: WHY['ledger-condensed'], text }
  }

  if (key === 'style-profile') {
    const text = await readTextSafe(path.join(dir, 'style.md'))
    if (!text.trim()) return null
    return { name: 'style-profile.md', why: WHY['style-profile'], text }
  }

  if (key === 'dispatch-recent') {
    const book = await readTextSafe(path.join(dir, 'dispatches.json'))
    if (!book.trim()) return null
    let items = []
    try {
      items = JSON.parse(book)?.items ?? []
    } catch {
      return null
    }
    const open = items.filter((row) => row.status === 'issued' || row.status === 'claimed').slice(-10)
    if (!open.length) return null
    return {
      name: 'dispatch-recent.md',
      why: WHY['dispatch-recent'],
      text: [
        '# 还没回执的单子',
        '',
        ...open.map((row) => `- ${row.id} ${row.roleLabel ?? row.role}：${String(row.task ?? '').slice(0, 80)}`),
      ].join('\n'),
    }
  }

  if (key === 'skills') {
    // 只给「名字 + 一句话 + 路径」，不嵌正文。
    // 25 份 SKILL.md 全塞进去能到十万字节，模型反而挑不动；给路径让它按需读，
    // 并且它必须自己说读了哪几份——这句要求写在 brief 的回执段里。
    const names = Array.isArray(ROLES[ctx.role]?.skills) ? ROLES[ctx.role].skills : []
    if (!names.length) return null
    const repoRoot = String(ctx.repoRoot ?? '').trim()
    if (!repoRoot) return null
    const lines = ['# 你这个岗位的手册', '']
    for (const name of names) {
      const file = path.join(repoRoot, 'skills', name, 'SKILL.md')
      const head = await readTextSafe(file)
      const desc = firstDescription(head)
      lines.push(`## ${name}`)
      lines.push('')
      if (desc) lines.push(desc)
      lines.push(`路径：\`${file}\``)
      if (!head.trim()) lines.push('（这个 skill 在本机没装到当前版本里，按岗位描述自己判断）')
      lines.push('')
    }
    lines.push('读法：先读与你手上这一单直接相关的一到两份，不要全部读完。回执里写清读了哪几份。')
    return { name: 'skills.md', why: WHY.skills, text: lines.join('\n') }
  }

  return null
}

/** 从 SKILL.md 的 frontmatter 里取一句话描述。取不到就返回空串，不编。 */
function firstDescription(text) {
  const body = String(text ?? '')
  if (!body.trim()) return ''
  const m = /^---\s*\n([\s\S]*?)\n---/.exec(body)
  if (m) {
    const block = m[1]
    // 先认折叠块（`description: |` + 缩进多行），再认单行。
    // 顺序不能反：`^description:[ \t]*(?!\|)(.+)$` 里的 [ \t]* 会回溯到零宽，
    // 让 (?!\|) 看到空格而不是竖线，于是把 `|` 本身当成描述——踩过。
    const folded = /^description:[ \t]*[|>][ \t]*\r?\n((?:[ \t]+.*\r?\n?)+)/m.exec(block)
    if (folded) {
      const line = folded[1]
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .find((s) => !s.startsWith('触发词'))
      if (line) return line.slice(0, 160)
    }
    const inline = /^description:[ \t]*([^|\s].*)$/m.exec(block)
    if (inline) return inline[1].trim().replace(/^["']|["']$/g, '').slice(0, 160)
  }
  const line = body.split('\n').map((s) => s.trim()).find((s) => s && !s.startsWith('#') && s !== '---')
  return line ? line.slice(0, 160) : ''
}

/**
 * 造一个任务包。
 *
 * @param {string} root
 * @param {string} projectId
 * @param {{role:string, chapter?:number, task?:string, extra?:string[], maxBytes?:number}} input
 * @returns {Promise<{pack:string, dir:string, role:string, chapter:number, manifest:object}>}
 */
export async function buildTaskPack(root, projectId, input = {}) {
  const role = normalizeRole(input.role)
  const dir = await store.projectDir(root, projectId)
  const chapter = Number(input.chapter ?? 0) || 0
  const outline = await store.getOutline(root, projectId)
  const chapters = await store.listChapters(root, projectId)

  const plan = [...(MATERIAL_PLAN[role] ?? ['project'])]
  for (const extra of (Array.isArray(input.extra) ? input.extra : [])) {
    if (!plan.includes(extra)) plan.push(extra)
  }

  const ctx = { root, projectId, dir, chapter, outline, chapters, role, repoRoot: String(input.repoRoot ?? DEFAULT_REPO_ROOT) }
  const files = []
  const omitted = []

  for (const key of plan) {
    let item = null
    try {
      item = await materialFor(key, ctx)
    } catch (error) {
      omitted.push({ key, why: `读不到：${String(error?.message ?? error).slice(0, 160)}` })
      continue
    }
    if (!item) {
      omitted.push({ key, why: `这本书里没有这项（${WHY[key] ?? key}）` })
      continue
    }
    // 超大的换取段版，而不是整份塞进去
    if (bytes(item.text) > MATERIAL_MAX_BYTES && key === 'outline-slice') {
      const slice = pickOutline(outline, { maxBytes: MATERIAL_MAX_BYTES })
      item = { ...item, text: JSON.stringify(slice, null, 2), truncated: true }
    }
    files.push({
      key,
      name: item.name,
      why: item.why,
      bytes: bytes(item.text),
      sha1: sha1(item.text),
      truncated: item.truncated === true,
      text: item.text,
    })
  }

  const packName = `${stamp()}-${role}-${randomBytes(3).toString('hex')}`
  const packDir = path.join(workRoot(dir), packName)
  await fs.mkdir(path.join(packDir, 'materials'), { recursive: true })

  const entries = []
  for (const file of files) {
    const rel = path.join('materials', file.name)
    await fs.writeFile(path.join(packDir, rel), file.text, 'utf8')
    entries.push({
      key: file.key,
      path: rel,
      bytes: file.bytes,
      sha1: file.sha1,
      why: file.why,
      truncated: file.truncated,
    })
  }

  const manifest = {
    pack: packName,
    role,
    roleLabel: ROLES[role].label,
    gate: ROLES[role].gate,
    chapter,
    task: String(input.task ?? '').trim(),
    createdAt: nowIso(),
    files: entries,
    omitted,
    readPolicy: '按 manifest 里列的路径逐个读，不要一次全读；omitted 是这次故意没给你的，需要就用 nightwrite_op 再要。',
  }

  await fs.writeFile(
    path.join(packDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  )

  const brief = buildPackBrief(manifest, packDir)
  await fs.writeFile(path.join(packDir, 'brief.md'), brief, 'utf8')

  return { pack: packName, dir: packDir, role, chapter, manifest, brief }
}

/** brief.md：人看的版本，和 manifest 是同一份事实的两种排版。 */
function buildPackBrief(manifest, packDir) {
  const lines = []
  lines.push(`# 任务包 · ${manifest.roleLabel}`)
  lines.push('')
  lines.push(`- 包号：${manifest.pack}`)
  lines.push(`- 岗位：${manifest.role}`)
  lines.push(`- 放行条件：${manifest.gate}`)
  if (manifest.chapter) lines.push(`- 涉及章号：第 ${manifest.chapter} 回`)
  lines.push(`- 目录：${packDir}`)
  lines.push('')
  lines.push('## 材料（按 manifest.json 逐个读，不要一次全读）')
  lines.push('')
  for (const file of manifest.files) {
    lines.push(`- \`${file.path}\`（${file.bytes} 字节，sha1 ${file.sha1.slice(0, 8)}）`)
    lines.push(`  - 为什么给你：${file.why}`)
    if (file.truncated) lines.push('  - 注意：这份已经降级（字段不全），需要全文请重新要')
  }
  if (!manifest.files.length) lines.push('- （这次没有材料，全靠任务描述）')
  lines.push('')
  if (manifest.omitted.length) {
    lines.push('## 这次故意没给你的')
    lines.push('')
    for (const item of manifest.omitted) lines.push(`- \`${item.key}\`：${item.why}`)
    lines.push('')
  }
  lines.push('## 回执要求')
  lines.push('')
  lines.push('回执里必须写清：你实际读了哪几份（按 path 列），哪几份没读，为什么没读。')
  lines.push('服务端会用 sha1 核对——说了读了但内容对不上的回执按未交处理。')
  return lines.join('\n')
}

/** 取一个已经造好的包（工作台右侧「材料」面板要用）。 */
export async function getTaskPack(root, projectId, packName) {
  const dir = await store.projectDir(root, projectId)
  const safe = String(packName ?? '').trim()
  if (!/^[A-Za-z0-9._-]{1,120}$/.test(safe)) fail('任务包名不合法', 'invalid')
  const packDir = path.join(workRoot(dir), safe)
  const manifestText = await readTextSafe(path.join(packDir, 'manifest.json'))
  if (!manifestText.trim()) fail(`没有这个任务包：${safe}`, 'missing')
  let manifest
  try {
    manifest = JSON.parse(manifestText)
  } catch {
    fail('manifest.json 不是合法 JSON', 'corrupt')
  }
  return { pack: safe, dir: packDir, manifest }
}

/** 列出造过的包，新的在前。 */
export async function listTaskPacks(root, projectId, options = {}) {
  const dir = await store.projectDir(root, projectId)
  const base = workRoot(dir)
  let names = []
  try {
    names = await fs.readdir(base)
  } catch (error) {
    if (error?.code === 'ENOENT') return { items: [], total: 0 }
    throw error
  }
  names.sort().reverse()
  const items = []
  for (const name of names) {
    const text = await readTextSafe(path.join(base, name, 'manifest.json'))
    if (!text.trim()) continue
    try {
      const m = JSON.parse(text)
      items.push({
        pack: name,
        role: m.role,
        roleLabel: m.roleLabel,
        chapter: m.chapter ?? 0,
        createdAt: m.createdAt,
        files: Array.isArray(m.files) ? m.files.length : 0,
        omitted: Array.isArray(m.omitted) ? m.omitted.length : 0,
        bytes: (m.files ?? []).reduce((sum, f) => sum + (Number(f.bytes) || 0), 0),
      })
    } catch {
      continue
    }
  }
  const role = String(options.role ?? '').trim()
  const filtered = role ? items.filter((row) => row.role === role) : items
  const limit = Number(options.limit ?? 0) || 0
  return { items: limit > 0 ? filtered.slice(0, limit) : filtered, total: filtered.length }
}

/** 派单 prompt 里那一段「材料在哪」——保证 prompt 本身不超过 PROMPT_MAX_BYTES。 */
export function packPromptSection(pack) {
  const manifest = pack?.manifest ?? {}
  const dir = pack?.dir ?? ''
  const files = Array.isArray(manifest.files) ? manifest.files : []
  const lines = []
  lines.push('## 给你的材料')
  lines.push(`材料不在本单里，在磁盘上：\`${dir}\``)
  lines.push('先读 `manifest.json`，再按里面每条的 `path` 逐个读，不要一次全读。')
  if (files.length) {
    lines.push('')
    lines.push('这次给你这几份（括号里是为什么）：')
    for (const file of files) {
      lines.push(`- \`${file.path}\`（${String(file.why ?? '').slice(0, 60)}）`)
    }
  }
  if (Array.isArray(manifest.omitted) && manifest.omitted.length) {
    lines.push('')
    lines.push(`故意没给：${manifest.omitted.map((row) => row.key).join('、')}。需要就用 nightwrite_op 再要。`)
  }
  const text = lines.join('\n')
  // prompt 是硬预算：超了就把材料清单砍掉，只留目录与 policy
  if (bytes(text) > PROMPT_MAX_BYTES) {
    return [
      '## 给你的材料',
      `材料在磁盘上：\`${dir}\``,
      '先读 `manifest.json`，按里面每条的 path 逐个读。',
    ].join('\n')
  }
  return text
}
