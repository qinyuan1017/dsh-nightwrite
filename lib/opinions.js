/**
 * 长夜 · 意见池（对齐 LNW 的 opinion / 高光账本）
 *
 * 现在长夜的意见散在四个地方：验收台的问题单、提案、AI 味命中、冷读回执。
 * 作者要"这一章到底有哪些人给我提了意见"，得在四个 tab 之间来回翻，翻完还
 * 拼不出全貌。
 *
 * 意见池不生产意见，它只做三件事：
 *   1. **汇总**——把四处的东西拉到一张表上，标明来源。
 *   2. **定性**——每条只能是 待处理 / 采纳 / 不采纳 三种状态之一，没有第四种。
 *      拖着的意见等于没提，所以"待处理"要能被筛出来。
 *   3. **回查**——每条意见必须带 chapter + para + quote，作者点一下能跳回正文
 *      那句。指不到具体位置的意见不收。
 *
 * 它**不**替作者判断对错。opinion.decide 只是记下作者的决定与理由，不做仲裁。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import * as store from './store.js'

const FILE = 'opinions.json'
const VERSION = 1

/** 意见可能来自谁。来源决定界面上显示什么颜色的角标，也决定"能不能采纳"。 */
export const OPINION_SOURCES = [
  'coldread',     // 冷读：陌生读者读完的总体判断
  'reader',       // 模拟读者：逐段追读体验
  'consistency',  // 审校：设定冲突
  'lint',         // 机器检测：AI 味/退化
  'author',       // 作者自己记的
  'other',
]

export const OPINION_KINDS = ['weakness', 'highlight', 'question', 'note']
export const OPINION_STATUS = ['open', 'adopted', 'dismissed']

function fail(message, code = 'invalid') {
  const error = new Error(message)
  error.code = code
  throw error
}

const nowIso = () => new Date().toISOString()
const shortId = (bytes = 4) => randomBytes(bytes).toString('hex')

function fileOf(dir) {
  return path.join(dir, FILE)
}

async function readBook(dir) {
  try {
    const text = await fs.readFile(fileOf(dir), 'utf8')
    const parsed = JSON.parse(text)
    return Array.isArray(parsed?.items) ? parsed.items : []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    return []
  }
}

async function writeBook(dir, items) {
  await fs.writeFile(fileOf(dir), JSON.stringify({ schemaVersion: VERSION, updatedAt: nowIso(), items }, null, 2), 'utf8')
  return items
}

function normalizeItem(input, existing) {
  const chapter = Number(input?.chapter) || 0
  if (!chapter && !existing) fail('意见必须指明第几回（chapter）')
  const source = OPINION_SOURCES.includes(input?.source) ? input.source : 'other'
  const kind = OPINION_KINDS.includes(input?.kind) ? input.kind : 'weakness'
  const status = OPINION_STATUS.includes(input?.status) ? input.status : 'open'
  const text = String(input?.text ?? input?.comment ?? '').trim()
  if (!text && !existing) fail('意见不能是空的')
  return {
    chapter,
    para: Number(input?.para) || 0,
    quote: String(input?.quote ?? '').slice(0, 200),
    source,
    role: String(input?.role ?? '').slice(0, 60),
    kind,
    status,
    severity: ['critical', 'major', 'minor', 'note'].includes(input?.severity) ? input.severity : 'minor',
    text,
    // 采纳时记下「改成了什么」，不采纳时记下「为什么不改」——这才是以后回看有用的部分
    resolution: String(input?.resolution ?? '').slice(0, 400),
    decidedAt: status === 'open' ? '' : nowIso(),
  }
}

/**
 * 新增或更新一条意见。id 省略则新建。
 */
export async function saveOpinion(root, projectId, input = {}) {
  const dir = await store.projectDir(root, projectId)
  const items = [...(await readBook(dir))]
  const id = String(input?.id ?? '').trim()
  const at = id ? items.findIndex((row) => row.id === id) : -1
  const existing = at >= 0 ? items[at] : null
  if (id && !existing) fail(`没有这条意见：${id}`, 'missing')
  const next = normalizeItem(input, existing)
  const now = nowIso()

  if (existing) {
    items[at] = { ...existing, ...next, id, updatedAt: now }
    if (next.status !== 'open' && !items[at].decidedAt) items[at].decidedAt = now
    await writeBook(dir, items)
    return { item: items[at], created: false }
  }

  const row = {
    id: `op_${shortId(4)}`,
    ...next,
    createdBy: String(input?.createdBy ?? 'author').slice(0, 60),
    createdAt: now,
    updatedAt: now,
  }
  items.push(row)
  await writeBook(dir, items)
  return { item: row, created: true }
}

/**
 * 批量导入（冷读回执 / 读者报告一次交回一堆意见时用）。
 *
 * 逐条独立判定：哪条缺章号就跳过并在 skipped 里说明，不因为一条坏掉整批失败
 * ——回执是模型给的，格式一定会有歪的地方。
 */
export async function bulkAdd(root, projectId, payload = {}) {
  const dir = await store.projectDir(root, projectId)
  const items = [...(await readBook(dir))]
  const list = Array.isArray(payload.items) ? payload.items : []
  if (!list.length) fail('要导入的意见列表是空的（items）')
  const defaultSource = OPINION_SOURCES.includes(payload.source) ? payload.source : 'other'
  const defaultRole = String(payload.role ?? '').slice(0, 60)
  const now = nowIso()
  const added = []
  const skipped = []

  list.forEach((raw, index) => {
    const chapter = Number(raw?.chapter) || 0
    const text = String(raw?.text ?? raw?.comment ?? '').trim()
    if (!chapter) { skipped.push({ index, reason: '缺章号' }); return }
    if (!text) { skipped.push({ index, reason: '没写意见内容' }); return }
    const row = {
      id: `op_${shortId(4)}`,
      ...normalizeItem({ ...raw, source: raw?.source ?? defaultSource, role: raw?.role ?? defaultRole }, null),
      createdBy: String(payload.createdBy ?? defaultRole ?? 'agent').slice(0, 60),
      createdAt: now,
      updatedAt: now,
    }
    items.push(row)
    added.push(row)
  })

  await writeBook(dir, items)
  return { added: added.length, skipped, items: added }
}

/** 采纳 / 不采纳。 */
export async function decideOpinion(root, projectId, id, decision = {}) {
  const dir = await store.projectDir(root, projectId)
  const items = [...(await readBook(dir))]
  const at = items.findIndex((row) => row.id === String(id ?? ''))
  if (at < 0) fail(`没有这条意见：${id}`, 'missing')
  const status = OPINION_STATUS.includes(decision.status) ? decision.status : ''
  if (!status) fail('决定只能是 adopted 或 dismissed（或改回 open）')
  const now = nowIso()
  items[at] = {
    ...items[at],
    status,
    resolution: String(decision.resolution ?? items[at].resolution ?? '').slice(0, 400),
    decidedAt: status === 'open' ? '' : now,
    updatedAt: now,
  }
  await writeBook(dir, items)
  return { item: items[at] }
}

export async function listOpinions(root, projectId, filter = {}) {
  const dir = await store.projectDir(root, projectId)
  let items = await readBook(dir)
  if (filter.chapter) items = items.filter((row) => Number(row.chapter) === Number(filter.chapter))
  if (filter.status) items = items.filter((row) => row.status === filter.status)
  if (filter.source) items = items.filter((row) => row.source === filter.source)
  if (filter.kind) items = items.filter((row) => row.kind === filter.kind)
  items = items.slice().sort((a, b) => (
    Number(a.chapter) - Number(b.chapter)
    || Number(a.para) - Number(b.para)
    || String(b.updatedAt).localeCompare(String(a.updatedAt))
  ))
  const counts = { open: 0, adopted: 0, dismissed: 0, highlight: 0, weakness: 0, total: items.length }
  for (const row of items) {
    counts[row.status] = (counts[row.status] || 0) + 1
    counts[row.kind] = (counts[row.kind] || 0) + 1
  }
  return { items, counts }
}

export async function removeOpinion(root, projectId, id) {
  const dir = await store.projectDir(root, projectId)
  const items = await readBook(dir)
  const target = String(id ?? '').trim()
  const next = items.filter((row) => row.id !== target)
  if (next.length === items.length) fail(`没有这条意见：${target}`, 'missing')
  await writeBook(dir, next)
  return { removed: target, left: next.length }
}

/**
 * 从现有四处数据里"拉"一遍，把还没进意见池的东西补进来。
 *
 * 只拉**指向具体位置**的：问题单（有章有段）、AI 味命中（有段有引文）。
 * 提案不动——提案是"要改成什么样"，不是"哪里不好"，混进意见池会让人误以为
 * 采纳了就等于改好了。
 */
export async function collectOpinions(root, projectId, options = {}) {
  const dir = await store.projectDir(root, projectId)
  const items = [...(await readBook(dir))]
  const known = new Set(items.map((row) => String(row.sourceRef ?? '')).filter(Boolean))
  const now = nowIso()
  const added = []

  const problemBook = await store.listProblems(root, projectId)
  for (const problem of problemBook.items ?? []) {
    const ref = `problem:${problem.id}`
    if (known.has(ref)) continue
    items.push({
      id: `op_${shortId(4)}`,
      chapter: Number(problem.chapter) || 0,
      para: Number(problem.para) || 0,
      quote: String(problem.quote ?? '').slice(0, 200),
      source: problem.type === 'ai-style' ? 'lint' : 'consistency',
      role: String(problem.role ?? ''),
      kind: problem.severity === 'note' ? 'note' : 'weakness',
      status: problem.status === 'resolved' ? 'adopted' : 'open',
      severity: problem.severity ?? 'minor',
      text: String(problem.text ?? '').slice(0, 400),
      resolution: String(problem.resolution ?? '').slice(0, 400),
      sourceRef: ref,
      createdBy: 'collect',
      createdAt: now,
      updatedAt: now,
    })
    added.push(ref)
  }

  if (options.includeLint !== false) {
    const chapters = await store.listChapters(root, projectId)
    for (const row of chapters.slice(-20)) {
      let scan
      try {
        scan = await store.scanChapterAiStyle(root, projectId, Number(row.chapter))
      } catch { continue }
      for (const hit of scan.hits ?? []) {
        const ref = `lint:${row.chapter}:${hit.para}:${hit.pattern}`
        if (known.has(ref)) continue
        items.push({
          id: `op_${shortId(4)}`,
          chapter: Number(row.chapter),
          para: Number(hit.para) || 0,
          quote: String(hit.quote ?? '').slice(0, 200),
          source: 'lint',
          role: '',
          kind: 'weakness',
          status: 'open',
          severity: 'note',
          text: `${hit.pattern}：${hit.hint ?? ''}`,
          resolution: '',
          sourceRef: ref,
          createdBy: 'collect',
          createdAt: now,
          updatedAt: now,
        })
        added.push(ref)
      }
    }
  }

  await writeBook(dir, items)
  return { added: added.length, refs: added, total: items.length }
}
