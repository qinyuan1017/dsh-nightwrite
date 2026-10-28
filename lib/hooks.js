/**
 * 长夜 · 宿主钩子（第 1 条：把「绕过界面直接改正文」这一层堵上）
 *
 * 长夜原先所有保护都挂在 /nightwrite/api 一条路上：chapter.save 有闸门、有道闸、有 expectRev。
 * 但模型完全可以不理 RPC，直接用宿主原生的 write / edit 去动 chapters/0001.txt ——
 * 一层都不触发。技能铺得越多，这条缝越大。
 *
 * 这里挂两个钩子：
 *   tools/pre-execute   认出「这是要改长夜正文/账本」的调用，按项目配置决定放行还是拦下。
 *   tools/post-execute  改完之后追一条提醒（清单要重算、要验收、要记账本），
 *                       并把 AI 味分与保真结果一起塞回去，免得模型改完就完事。
 *
 * 设计约束：
 *   · 只认宿主原生 write / edit / str_replace_editor（command !== 'view'）。
 *   · 只拦「落在某个长夜项目目录里」的路径，别处的写和长夜无关，一律放行。
 *   · 默认不拦（level: 'warn'）。作者自己的项目要真拦，得在项目设置里开 enforce。
 *     一上来就硬拦，模型会以为环境坏了，反而绕着走。
 *   · 零依赖：不 import @deepseek-ai/*，只用 node 内置 + 自己造的 UserMessage 形状。
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import * as store from './store.js'

/** 会被当成「改文件」的工具名。str_replace_editor 要排除只读的 view。 */
const MUTATION_TOOLS = new Set(['write', 'edit', 'str_replace_editor'])

/** 正文与设定的落点：这些子目录里的文件算长夜资产。 */
const GUARDED_DIRS = new Set(['chapters', 'ledger', 'outlines', 'facts', 'world', 'agents', 'skills'])

/** 单次读取上限，防止把整本正文读进内存只为算个分数。 */
const READ_LIMIT = 2 * 1024 * 1024

const REMINDER_SOURCE = {
  kind: 'nightwrite-write-guard',
  form: 'notice',
}

/**
 * 判断这次工具调用是不是在改文件；是的话返回目标路径参数。
 * @returns {string} 空字符串表示不是文件改动。
 */
export function mutationPath(toolName, args) {
  if (!MUTATION_TOOLS.has(String(toolName ?? ''))) return ''
  const bag = args && typeof args === 'object' ? args : {}
  if (String(toolName) === 'str_replace_editor' && String(bag.command ?? '') === 'view') return ''
  const raw = bag.path ?? bag.file_path ?? bag.filePath ?? bag.target ?? ''
  return String(raw ?? '').trim()
}

/**
 * 把路径归到某个长夜项目上。
 *
 * 两种落点都要认：
 *   1. 官方数据目录 <root>/projects/<id>/chapters/...（默认根在 ~/.dsh/data/dsh-nightwrite）
 *   2. 用户在项目设置里改到别处的 dataDir
 *
 * 这里不抛错：钩子里抛错会把整个工具调用变成异常，模型只会看到「工具炸了」。
 * 认不出来就当与长夜无关，放行。
 */
export async function locateProject(root, absPath) {
  const target = path.resolve(String(absPath ?? ''))
  if (!target) return null
  let rows = []
  try {
    rows = await store.listProjects(root)
  } catch {
    return null
  }
  for (const row of Array.isArray(rows) ? rows : []) {
    const base = path.resolve(String(row?.dataDir ?? ''))
    if (!base) continue
    const rel = path.relative(base, target)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue
    const seg = rel.split(path.sep)[0] ?? ''
    return {
      projectId: row.id,
      project: row,
      base,
      rel: rel.split(path.sep).join('/'),
      dir: seg,
      guarded: GUARDED_DIRS.has(seg),
    }
  }
  return null
}

/** 章节文件 → 章号；认不出来返回 0。 */
export function chapterOf(rel) {
  const m = /(?:^|\/)chapters\/(\d{1,6})\.txt$/u.exec(String(rel ?? ''))
  return m ? Number(m[1]) : 0
}

/** 项目的写入策略。项目 meta 里没写就当 warn。 */
export function projectWritePolicy(project) {
  const raw = project && typeof project === 'object' ? project : {}
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {}
  const policy =
    (settings.writePolicy && typeof settings.writePolicy === 'object' ? settings.writePolicy : null) ??
    (raw.writePolicy && typeof raw.writePolicy === 'object' ? raw.writePolicy : {})
  const level = ['off', 'warn', 'enforce'].includes(String(policy.level)) ? String(policy.level) : 'warn'
  return {
    level,
    allowChapter: policy.allowChapter !== false,
    allowLedger: policy.allowLedger !== false,
    allowFacts: policy.allowFacts !== false,
    allowOutline: policy.allowOutline !== false,
    allowSkills: policy.allowSkills !== false,
  }
}

/** 按策略判断该不该拦；返回 null 表示放行，否则返回拒绝理由。 */
export function guardDecision(info, policy) {
  if (!info || !info.guarded) return null
  if (policy.level !== 'enforce') return null
  const map = {
    chapters: { flag: 'allowChapter', what: '正文' },
    ledger: { flag: 'allowLedger', what: '账本' },
    facts: { flag: 'allowFacts', what: '设定卡' },
    outlines: { flag: 'allowOutline', what: '大纲' },
    skills: { flag: 'allowSkills', what: '技能' },
    agents: { flag: 'allowSkills', what: '岗位手册' },
    world: { flag: 'allowOutline', what: '世界库' },
  }
  const row = map[info.dir]
  if (!row) return null
  if (policy[row.flag] !== false) return null
  return `这个项目的「${row.what}」不允许用原生写工具直接改（写策略 = enforce）。`
}

/**
 * 造一条注入消息。宿主用的是 createUserMessage，零依赖没法 import，
 * 就按同形状自己拼：id + role + content + source。form: 'notice' 让它显示成提示而不是用户发言。
 */
export function noticeMessage(text, summary) {
  return {
    id: randomUUID(),
    role: 'user',
    content: [{ type: 'text', text: String(text ?? '') }],
    source: { ...REMINDER_SOURCE, summary: String(summary ?? '长夜写入提醒') },
  }
}

/** 把自家提醒塞到下游 contexts 前面。下游可能压根没有这个字段。 */
export function prependContext(ours, theirs) {
  const list = Array.isArray(theirs) ? theirs : []
  return [ours, ...list]
}

/** 读文件算分用；读不到返回空串，绝不让钩子抛。 */
function readText(absPath) {
  try {
    const stat = fs.statSync(absPath)
    if (!stat.isFile() || stat.size > READ_LIMIT) return ''
    return fs.readFileSync(absPath, 'utf8')
  } catch {
    return ''
  }
}

/** 改完正文之后那句提醒：说清楚下一步该干嘛，别说教。 */
function afterWriteText(info, report) {
  const head = `长夜 · 第 ${info.chapter || '?'} 回正文已被原生写工具改动（${info.rel}）。`
  const lines = [head, '']
  if (report && report.score && typeof report.score.score === 'number') {
    lines.push(`AI 味评分 ${report.score.score}/100（${report.score.band ?? '—'}，阈值 ${report.score.passMax ?? 30} 才放行）。`)
    if (Array.isArray(report.score.signals) && report.score.signals.length) {
      const top = report.score.signals
        .slice(0, 3)
        .map((row) => `${row.label} ${row.points}分`)
        .join(' / ')
      lines.push(`主要扣分项：${top}。`)
    }
  }
  if (report && report.fidelity && report.fidelity.level && report.fidelity.level !== 'ok') {
    lines.push(`保真校验：${report.fidelity.text}`)
  }
  lines.push('')
  lines.push('接下来这三件事别漏：')
  lines.push('1. 用 nightwrite_op 走 chapter.save 存一次（原生写入不更新字数、版本、状态，界面上是旧的）。')
  lines.push('2. 存之前先跑 lint.degenerate 与 outline.copy：改出来的段落可能整段是复读或照抄细纲。')
  lines.push('3. 改完的章要重新验收，旧提案里的锚点可能已经对不上了（状态会变 outdated）。')
  return lines.join('\n')
}

/**
 * 注册钩子。ctx.on 不存在时静默跳过——老宿主没有这套事件，不该因此让插件挂掉。
 * @returns {{pre:boolean, post:boolean}} 实际挂上了哪几个，启动日志里打出来。
 */
export function registerWriteGuard(ctx, options = {}) {
  const root = String(options.root ?? '').trim() || store.defaultRoot()
  const out = { pre: false, post: false }
  if (!ctx || typeof ctx.on !== 'function') return out

  // ── 改之前：认出目标，按策略决定放行还是拦 ──────────────
  try {
    ctx.on('tools/pre-execute', async (exec, next) => {
      const call = mutationPath(exec?.name, exec?.arguments)
      if (!call) return next()
      const cwd = String(exec?.agent?.session?.header?.cwd ?? process.cwd())
      const abs = path.isAbsolute(call) ? call : path.resolve(cwd, call)
      const info = await locateProject(root, abs)
      if (!info) return next()
      const policy = projectWritePolicy(info.project)
      if (policy.level === 'off') return next()
      const reason = guardDecision(info, policy)
      if (reason) {
        return {
          kind: 'deny',
          reason:
            `${reason}\n` +
            `目标：${info.rel}\n` +
            '改用 nightwrite_op 的 chapter.save / ledger.upsert / outline.save —— 那条路会过闸门、算字数、记版本。\n' +
            '要放开限制，在长夜设置里把该项目的写策略从 enforce 改成 warn。',
        }
      }
      return next()
    })
    out.pre = true
  } catch (error) {
    console.warn('[nightwrite] pre-execute 钩子注册失败', error)
  }

  // ── 改之后：追一条提醒 + 附上分数 ──────────────────────
  try {
    ctx.on('tools/post-execute', async (exec, result, next) => {
      const downstream = await next()
      const call = mutationPath(exec?.name, exec?.arguments)
      if (!call) return downstream
      if (result?.isError) return downstream
      if (downstream && downstream.kind === 'block') return downstream
      const cwd = String(exec?.agent?.session?.header?.cwd ?? process.cwd())
      const abs = path.isAbsolute(call) ? call : path.resolve(cwd, call)
      const info = await locateProject(root, abs)
      if (!info || !info.guarded) return downstream
      const policy = projectWritePolicy(info.project)
      if (policy.level === 'off') return downstream

      // 只对正文算分：账本、大纲是结构化数据，拿去算 AI 味没意义。
      let report = null
      if (info.dir === 'chapters') {
        info.chapter = chapterOf(info.rel)
        const text = readText(abs)
        if (text) {
          try {
            const { scoreText } = await import('./aiscore.js')
            const score = scoreText(text)
            const { checkFidelity } = await import('./fidelity.js')
            let fidelity = null
            if (info.chapter) {
              try {
                const old = await store.getChapter(root, info.projectId, info.chapter)
                if (old && old.text) fidelity = checkFidelity(old.text, text)
              } catch {
                fidelity = null
              }
            }
            report = { score, fidelity }
          } catch (error) {
            report = null
          }
        }
      }

      const notice = noticeMessage(afterWriteText(info, report), `改动了 ${info.rel}`)
      return { ...downstream, additionalContexts: prependContext(notice, downstream?.additionalContexts) }
    })
    out.post = true
  } catch (error) {
    console.warn('[nightwrite] post-execute 钩子注册失败', error)
  }

  return out
}
