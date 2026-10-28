/**
 * 长夜 · 停靠点（run guard）
 *
 * 对应 oh-story 的 stop-and-fix：写完一章必须停下来，不许一口气连写。
 * 它那边的做法是写进 agent 提示词里「每章结束必须停」，靠模型自觉。
 * 靠自觉的规矩等于没有规矩——模型跑起来就不会停。
 *
 * 这里把「停」做成服务端能查的状态：
 *   1. 每次开工先登记一个 run（跑的是哪本书、哪个阶段、第几章）。
 *   2. 每写完一章，run 里记一条「已交稿」，并把它标记为「等确认」。
 *   3. 再想往下推进，必须先 review.run 确认上一章；没确认就推进 = 裸调用，被拒。
 *   4. 单轮连写上限（默认 3 章）：连续交稿到这个数，强制停。
 *
 * 为什么这个检查必须在服务端：界面上的按钮可以禁用，模型直接调 nightwrite_op 就绕过去了。
 * 只有「写入口自己拒绝」才拦得住。
 *
 * 它不是流程引擎：只记账 + 拒绝，不驱动任何东西。
 * 什么时候写、写什么，仍然由人/模型决定；它只保证「没停就不会被当成停了」。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { withLock } from './lock.js'
import { randomBytes } from 'node:crypto'

/** 单轮连写上限：连续交稿这么多章就必须停一次。 */
export const RUN_MAX_CHAPTERS = 3

/** run 多久没动静算废弃（不删数据，只是不再接受 advance）。 */
export const RUN_TTL_MS = 6 * 60 * 60 * 1000

export const RUN_STATUS = ['open', 'waiting', 'closed', 'abandoned']

const nowIso = () => new Date().toISOString()

function fail(message, code = 'invalid', details = null) {
  const error = new Error(message)
  error.code = code
  if (details) error.details = details
  throw error
}

function runFile(dir) {
  return path.join(dir, 'runs.json')
}

async function readBook(dir) {
  try {
    const text = await fs.readFile(runFile(dir), 'utf8')
    const parsed = JSON.parse(text)
    return { items: Array.isArray(parsed?.items) ? parsed.items : [] }
  } catch (error) {
    if (error?.code === 'ENOENT') return { items: [] }
    if (error instanceof SyntaxError) fail('runs.json 不是合法 JSON', 'corrupt')
    throw error
  }
}

async function writeBook(dir, book) {
  const file = runFile(dir)
  const tmp = `${file}.tmp-${randomBytes(4).toString('hex')}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify({ items: book.items }, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

function runId() {
  return `rn_${randomBytes(6).toString('hex')}`
}

function expired(row) {
  if (!row) return false
  if (row.status !== 'open' && row.status !== 'waiting') return false
  const at = String(row.updatedAt ?? row.createdAt ?? '')
  if (!at) return false
  return Date.now() - Date.parse(at) > RUN_TTL_MS
}

function decorate(row) {
  if (!row) return row
  const isExpired = expired(row)
  return {
    ...row,
    expired: isExpired,
    status: isExpired ? 'abandoned' : row.status,
    // 还能不能往下推进：这是界面唯一需要判断的事，所以由服务端算好
    canAdvance: !isExpired && row.status === 'open' && row.chapters.length < RUN_MAX_CHAPTERS,
    remaining: Math.max(0, RUN_MAX_CHAPTERS - (row.chapters?.length ?? 0)),
  }
}

/**
 * 开一次 run。
 *
 * @param {string} dir 作品目录
 * @param {{kind?:string, chapter?:number, by?:string, maxChapters?:number, note?:string}} input
 */
export async function openRun(dir, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(runFile(dir), () => openRunInner(dir, input))
}

async function openRunInner(dir, input = {}) {
  const book = await readBook(dir)
  // 同一时间只允许一个 open 的 run：允许两个就会有两个「当前进度」，
  // 而「当前停在哪一章」必须唯一，否则停靠点没意义。
  const live = book.items.find((row) => (row.status === 'open' || row.status === 'waiting') && !expired(row))
  if (live) {
    fail(
      `已经有一次没结束的写作（run ${live.id}，停在第 ${live.currentChapter ?? '-'} 回）。`
      + '先 review.run 确认它，或者 close.run 关掉，再开新的。',
      'run-open',
      { runId: live.id, status: live.status, currentChapter: live.currentChapter ?? 0 },
    )
  }
  const at = nowIso()
  const row = {
    id: runId(),
    kind: String(input.kind ?? 'continue'),
    chapter: Number(input.chapter ?? 0) || 0,
    currentChapter: Number(input.chapter ?? 0) || 0,
    maxChapters: Math.max(1, Math.min(20, Number(input.maxChapters ?? RUN_MAX_CHAPTERS) || RUN_MAX_CHAPTERS)),
    status: 'open',
    by: String(input.by ?? ''),
    note: String(input.note ?? ''),
    createdAt: at,
    updatedAt: at,
    chapters: [],
  }
  book.items.push(row)
  await writeBook(dir, book)
  return decorate(row)
}

/** 当前还开着的 run（没有就是 null）。 */
export async function currentRun(dir) {
  const book = await readBook(dir)
  const live = book.items
    .filter((row) => (row.status === 'open' || row.status === 'waiting') && !expired(row))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
  return live ? decorate(live) : null
}

export async function getRun(dir, id) {
  const book = await readBook(dir)
  const row = book.items.find((item) => item.id === String(id ?? ''))
  if (!row) fail(`没有这次写作：${id}`, 'missing')
  return decorate(row)
}

export async function listRuns(dir, options = {}) {
  const book = await readBook(dir)
  let rows = book.items.map(decorate)
  const status = String(options.status ?? '').trim()
  if (status) rows = rows.filter((row) => row.status === status)
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const limit = Number(options.limit ?? 0) || 0
  return { items: limit > 0 ? rows.slice(0, limit) : rows, total: rows.length }
}

/** 内部：取出还开着的那条，没有就拒绝。 */
async function requireLive(dir, id) {
  const book = await readBook(dir)
  const row = id
    ? book.items.find((item) => item.id === String(id))
    : book.items
      .filter((item) => item.status === 'open' || item.status === 'waiting')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
  if (!row) {
    fail(
      '没有进行中的写作。写正文前先 run.open 登记一次——'
      + '不登记的写入无法被停靠点管住，出了问题也查不到是哪一轮写的。',
      'run-missing',
    )
  }
  if (row.status === 'closed') fail(`这次写作已经关掉了（${row.id}）`, 'run-closed', { runId: row.id })
  if (row.status === 'abandoned' || expired(row)) {
    fail(`这次写作已经废弃（${row.id}），重新 run.open 开一次`, 'run-abandoned', { runId: row.id })
  }
  return { book, row }
}

/**
 * 交一章。
 *
 * 这是停靠点的核心：写入前必须过这里，过不了就不许写。
 * 三种拒绝：
 *   - 上一次交稿还没确认（waiting）→ 必须先 review.run
 *   - 单轮已经交够了（chapters >= maxChapters）→ 必须 close.run
 *   - 没有 run → 先 open.run
 */
export async function claimChapter(dir, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(runFile(dir), () => claimChapterInner(dir, input))
}

async function claimChapterInner(dir, input = {}) {
  const chapter = Number(input.chapter ?? 0) || 0
  if (!chapter || chapter < 1) fail('claim 必须写清第几回（chapter）')
  const { book, row } = await requireLive(dir, input.runId)

  if (row.status === 'waiting') {
    fail(
      `第 ${row.currentChapter} 回还没确认（run ${row.id}）。`
      + '按规矩，交完一章必须停下来等人看过；先 review.run 确认，再往下写。',
      'run-waiting',
      { runId: row.id, waitingFor: row.currentChapter },
    )
  }
  if (row.chapters.length >= row.maxChapters) {
    fail(
      `这一轮已经交了 ${row.chapters.length} 章，到了上限 ${row.maxChapters}。`
      + '连写超过这个数，后面的章节质量会明显掉——先 close.run 收尾，或者另开一轮。',
      'run-limit',
      { runId: row.id, chapters: row.chapters.length, max: row.maxChapters },
    )
  }
  const at = nowIso()
  row.chapters.push({
    chapter,
    at,
    words: Number(input.words ?? 0) || 0,
    note: String(input.note ?? ''),
    reviewed: false,
  })
  row.currentChapter = chapter
  row.status = 'waiting'
  row.updatedAt = at
  await writeBook(dir, book)
  return decorate(row)
}

/** 确认某一章（人看过、或者说「这一章就这样」）。确认后才能往下推进。 */
export async function reviewChapter(dir, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(runFile(dir), () => reviewChapterInner(dir, input))
}

async function reviewChapterInner(dir, input = {}) {
  const chapter = Number(input.chapter ?? 0) || 0
  const { book, row } = await requireLive(dir, input.runId)
  if (!chapter) fail('review 必须写清确认第几回（chapter）')
  const hit = row.chapters.find((item) => Number(item.chapter) === chapter)
  if (!hit) fail(`这次写作里没有第 ${chapter} 回的交稿记录`, 'missing', { runId: row.id })
  if (hit.reviewed && String(input.verdict ?? 'ok') !== 'reject') {
    return decorate(row)
  }
  const at = nowIso()
  hit.reviewed = true
  hit.verdict = String(input.verdict ?? 'ok')
  hit.reviewedAt = at
  hit.reviewNote = String(input.note ?? '')
  // reject：这一章不算通过，退回 open，但保留记录（不然「被否了几次」这个信息就丢了）
  row.status = hit.verdict === 'reject' ? 'open' : 'open'
  row.updatedAt = at
  await writeBook(dir, book)
  return decorate(row)
}

/** 关掉一轮。已经交的章保留，只是不再接受 advance。 */
export async function closeRun(dir, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(runFile(dir), () => closeRunInner(dir, input))
}

async function closeRunInner(dir, input = {}) {
  const { book, row } = await requireLive(dir, input.runId)
  const at = nowIso()
  row.status = 'closed'
  row.closedAt = at
  row.updatedAt = at
  row.closeNote = String(input.note ?? '')
  await writeBook(dir, book)
  return decorate(row)
}

/**
 * 守门：给 chapter.save 用的同步检查。
 *
 * 为什么不复用 claimChapter：claim 会改状态（记一条交稿），
 * 而 save 可能被同一次交稿调用多次（改错字、调格式）。
 * 所以守门只回答「现在允许写吗」，允许之后才由 claim 记账——
 * 顺序是 gate → 写盘 → claim，反了的话写盘失败就留下一条假记录。
 *
 * 一个明确的取舍：没有开 run 时**放行**，但回执里带 `guarded:false`。
 * 理由：这条规矩管的是「一轮连写」这个场景，人在工作台手打一段话不该被它拦。
 * 代价是模型只要不调 run.open 就能不受管——所以 run.open 写进了
 * nightwrite_op 的工具说明里当第一条，并且未受管的写入会在界面和回执上标出来。
 * 与其假装拦得住全部，不如让「这章没走停靠点」这件事变成可见状态。
 */
export async function guardWrite(dir, input = {}) {
  let row = null
  if (input.runId) {
    const live = await requireLive(dir, input.runId)
    row = live.row
  } else {
    const book = await readBook(dir)
    row = book.items
      .filter((item) => (item.status === 'open' || item.status === 'waiting') && !expired(item))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] ?? null
  }
  if (!row) {
    return { runId: null, guarded: false, status: 'none', remaining: null }
  }
  if (row.status === 'waiting') {
    const error = new Error(
      `第 ${row.currentChapter} 回交完还没确认。`
      + '按停靠点的规矩，交一章就要停一次；确认用 review.run，'
      + '确实要跳过去就传 runGuard:false（这会记在 run 的备注里）。',
    )
    error.code = 'run-waiting'
    error.details = { runId: row.id, waitingFor: row.currentChapter }
    throw error
  }
  if (row.chapters.length >= row.maxChapters) {
    const error = new Error(
      `这一轮已经交到 ${row.chapters.length}/${row.maxChapters} 章上限。`
      + '先 close.run 收尾，或者另开一轮——连着写太多，后面几章一定掉质量。',
    )
    error.code = 'run-limit'
    error.details = { runId: row.id, chapters: row.chapters.length, max: row.maxChapters }
    throw error
  }
  return { runId: row.id, guarded: true, status: row.status, remaining: row.maxChapters - row.chapters.length }
}

/** 给界面用的一句话：现在能不能写、卡在哪。 */
export function runVerdict(run) {
  if (!run) return { level: 'red', text: '还没开一轮，写正文前要先 run.open 登记' }
  if (run.status === 'closed') return { level: 'grey', text: '这一轮已经关了' }
  if (run.status === 'abandoned') return { level: 'grey', text: '这一轮废弃了（太久没动静）' }
  if (run.status === 'waiting') {
    return { level: 'orange', text: `第 ${run.currentChapter} 回交完，等确认` }
  }
  if (run.chapters.length >= run.maxChapters) {
    return { level: 'orange', text: `到上限了（${run.chapters.length}/${run.maxChapters}），该收尾` }
  }
  return { level: 'green', text: `可以写，这一轮还能写 ${run.remaining} 章` }
}
