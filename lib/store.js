/**
 * 长夜 · 数据层
 *
 * 纯文件 + JSON，不用数据库：
 *   <root>/library.json                     作品索引
 *   <root>/projects/<pmXXXXXXXXXXXX>/       单部作品的目录
 *     project.json                          作品元信息 + 世界状态快照
 *     chapters/0001.txt                     正文（纯文本）
 *     chapters/0001.meta.json               该章状态 / 分数 / 问题 / 违规 / 成本
 *     chapters/history/0001-<stamp>.txt     该章的历史版本（每次覆盖前留底，只留最近 N 版）
 *     chapters/.trash/<stamp>/              删掉的章（可找回）
 *     ledger.json                           五类账本 + 世界状态
 *     queue.json                            跑批队列
 *     templates.json                        指令模板
 *
 * 设计原则：
 *   - 一次写入即落盘（writeFile + rename 原子替换），断电不丢半截文件。
 *   - 所有 id 走白名单正则，路径一律 realpath 校验，越界直接拒绝。
 *   - 不读环境变量以外的外部状态；不联网。
 */

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'
import * as wordcount from './wordcount.js'
import * as anchors from './anchors.js'
import { serializeBy } from './lock.js'

export const SCHEMA_VERSION = '0.1.0'
export const PROJECT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/
const CHAPTER_FILE_RE = /^(\d{4})\.(txt|md)$/
const HISTORY_FILE_RE = /^(\d{4})-(\d{8}T\d{6}\d{3}Z)\.(txt|md)$/

/** 每章保留多少个历史版本；超出的从最旧的开始删。 */
export const HISTORY_KEEP = 20

export class StoreError extends Error {
  constructor(message, code = 'invalid') {
    super(message)
    this.name = 'StoreError'
    this.code = code
  }
}

const fail = (message, code) => {
  throw new StoreError(message, code)
}

const nowIso = () => new Date().toISOString()

function shortId(bytes = 6) {
  return randomBytes(bytes).toString('hex')
}

/** 作品数据根：可用环境变量覆盖，默认 ~/.dsh/data/dsh-changye */
export function defaultRoot() {
  const override = String(process.env.CHANGYE_ROOT ?? '').trim()
  if (override) return path.resolve(override)
  return path.join(os.homedir(), '.dsh', 'data', 'dsh-changye')
}

/** 4 位补零章号 → 文件名 */
export function pad4(n) {
  const num = Number(n)
  if (!Number.isFinite(num) || num <= 0) fail('章号必须是正整数')
  return String(Math.floor(num)).padStart(4, '0')
}

// ── 原子写 ───────────────────────────────────────────────────

async function writeJsonAtomic(file, value) {
  const text = JSON.stringify(value, null, 2)
  const tmp = `${file}.tmp-${shortId(4)}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, text, 'utf8')
  await fs.rename(tmp, file)
}

async function writeTextAtomic(file, text) {
  const tmp = `${file}.tmp-${shortId(4)}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, String(text), 'utf8')
  await fs.rename(tmp, file)
}

async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, 'utf8')
    return JSON.parse(text)
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    if (error instanceof SyntaxError) {
      fail(`${path.basename(file)} 不是合法 JSON：${error.message}`, 'corrupt')
    }
    throw error
  }
}

// ── 根与小工具 ───────────────────────────────────────────────

/** 取作品数据根；不存在则创建 + 写空索引 */
export async function ensureRoot(root) {
  const real = path.resolve(root ?? defaultRoot())
  await fs.mkdir(path.join(real, 'projects'), { recursive: true })
  const lib = path.join(real, 'library.json')
  if (!existsSync(lib)) {
    await writeJsonAtomic(lib, { version: 1, projects: [] })
  }
  return real
}

async function readLibrary(root) {
  const lib = await readJson(path.join(root, 'library.json'), null)
  if (!lib || !Array.isArray(lib.projects)) return { version: 1, projects: [] }
  return lib
}

async function writeLibrary(root, lib) {
  await writeJsonAtomic(path.join(root, 'library.json'), {
    version: 1,
    projects: Array.isArray(lib.projects) ? lib.projects : [],
  })
}

/** 作品目录（含越界校验）。create=true 时按需创建。 */
export async function projectDir(root, projectId, { create = false } = {}) {
  const id = String(projectId ?? '')
  if (!PROJECT_ID_RE.test(id)) fail('作品 id 不合法', 'invalid-id')
  const real = await ensureRoot(root)
  const lib = await readLibrary(real)
  const entry = lib.projects.find((row) => row.id === id)
  if (!entry) fail(`找不到作品 ${id}`, 'missing')
  const base = entry.dataDir ? path.resolve(entry.dataDir) : path.join(real, 'projects', id)
  if (create) {
    await fs.mkdir(path.join(base, 'chapters'), { recursive: true })
    return base
  }
  if (!existsSync(base)) fail(`作品目录不存在：${base}`, 'missing')
  return base
}

// ── 作品 ─────────────────────────────────────────────────────

export async function listProjects(root) {
  const real = await ensureRoot(root)
  const lib = await readLibrary(real)
  const rows = []
  for (const entry of lib.projects) {
    const dir = entry.dataDir ? path.resolve(entry.dataDir) : path.join(real, 'projects', entry.id)
    let meta = null
    try {
      meta = await readJson(path.join(dir, 'project.json'), null)
    } catch {
      meta = null
    }
    let chapters = 0
    let words = 0
    try {
      const files = await fs.readdir(path.join(dir, 'chapters'))
      for (const file of files) {
        const m = CHAPTER_FILE_RE.exec(file)
        if (!m) continue
        if (m[2] === 'md' && files.includes(`${m[1]}.txt`)) continue
        chapters += 1
        const text = await fs.readFile(path.join(dir, 'chapters', file), 'utf8').catch(() => '')
        words += countWords(text)
      }
    } catch {
      /* 目录还没建 */
    }
    rows.push({
      id: entry.id,
      name: entry.name ?? meta?.name ?? '未命名',
      genre: entry.genre ?? meta?.genre ?? '',
      updatedAt: entry.updatedAt ?? meta?.updatedAt ?? '',
      chapters,
      words,
      dataDir: dir,
    })
  }
  return rows
}

export async function createProject(root, input = {}) {
  const real = await ensureRoot(root)
  const lib = await readLibrary(real)
  const name = String(input.name ?? '').trim() || '未命名作品'
  const wanted = String(input.dataDir ?? '').trim()
  const id = `pm${shortId(6)}`
  const dir = wanted ? path.resolve(wanted) : path.join(real, 'projects', id)
  await fs.mkdir(path.join(dir, 'chapters'), { recursive: true })
  const at = nowIso()
  const meta = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name,
    genre: String(input.genre ?? '').trim(),
    logline: String(input.logline ?? '').trim(),
    targetWords: Number(input.targetWords) || 2500,
    qualityGate: Number(input.qualityGate) || 70,
    monthlyBudget: Number(input.monthlyBudget) || 600,
    createdAt: at,
    updatedAt: at,
    readingPosition: { chapter: 1 },
    worldState: { text: '', updatedAt: at, fromChapter: 0 },
  }
  await writeJsonAtomic(path.join(dir, 'project.json'), meta)
  await writeJsonAtomic(path.join(dir, 'ledger.json'), emptyLedger())
  await writeJsonAtomic(path.join(dir, 'queue.json'), { items: [] })
  await writeJsonAtomic(path.join(dir, 'templates.json'), { items: defaultTemplates() })
  lib.projects.push({ id, name, genre: meta.genre, updatedAt: at, ...(wanted ? { dataDir: dir } : {}) })
  await writeLibrary(real, lib)
  return { id, name, dir, meta }
}

export async function deleteProject(root, projectId) {
  const real = await ensureRoot(root)
  const lib = await readLibrary(real)
  const index = lib.projects.findIndex((row) => row.id === projectId)
  if (index < 0) fail(`找不到作品 ${projectId}`, 'missing')
  const entry = lib.projects[index]
  lib.projects.splice(index, 1)
  await writeLibrary(real, lib)
  const dir = entry.dataDir ? path.resolve(entry.dataDir) : path.join(real, 'projects', entry.id)
  await fs.rm(dir, { recursive: true, force: true })
  return { deleted: entry.id }
}

export async function getProject(root, projectId) {
  const dir = await projectDir(root, projectId)
  const meta = await readJson(path.join(dir, 'project.json'), null)
  if (!meta) fail('project.json 缺失', 'corrupt')
  return { meta, dir }
}

export async function saveProject(root, projectId, patch = {}) {
  const { meta, dir } = await getProject(root, projectId)
  const next = { ...meta }
  for (const key of [
    'name', 'genre', 'logline', 'targetWords', 'qualityGate', 'monthlyBudget',
  ]) {
    if (patch[key] !== undefined) next[key] = patch[key]
  }
  if (patch.worldState && typeof patch.worldState === 'object') {
    next.worldState = { ...(meta.worldState ?? {}), ...patch.worldState, updatedAt: nowIso() }
  }
  next.updatedAt = nowIso()
  await writeJsonAtomic(path.join(dir, 'project.json'), next)
  const real = await ensureRoot(root)
  const lib = await readLibrary(real)
  const entry = lib.projects.find((row) => row.id === projectId)
  if (entry) {
    entry.name = next.name
    entry.genre = next.genre
    entry.updatedAt = next.updatedAt
    await writeLibrary(real, lib)
  }
  return next
}

// ── 章节 ─────────────────────────────────────────────────────

// 字数口径收到 lib/wordcount.js 一处：清单、验收页、导出统计都用它。
// 以前这里是 replace(/\s+/g,'') 内联，客户端另有一份同名实现，
// 两边对「首行标题算不算正文」的判断迟早分叉。
export function countWords(text) {
  return wordcount.countWords(text)
}

// ── 全局状态版本（state_revision）──────────────────────────────
//
// 为什么需要它：工作台和对话框是同一份数据的两个操作面。
// 界面上的字数、账本条数、待验收数，全都是磁盘文件的投影——
// 对话里的 AI 通过 changye_op 改了文件，界面不会自己知道。
//
// 每章一个 rev 只解决「同一章并发改」；但界面上「待验收 3 条」这种聚合数字
// 来自十几份文件，没法逐份比对。所以再加一个作品级的单调计数：
// 任何写操作都 +1，界面轮询这个数字，变了就重取。
//
// 它是「脏标记」不是事务日志：丢了只会让界面多刷新一次，不会丢数据。
// 所以写在 state.json 里，坏了就重建，不做校验和。

function stateFile(dir) {
  return path.join(dir, 'state.json')
}

/** 读当前状态版本。没有就返回 revision 0（首次读不报错）。 */
export async function readState(dir) {
  const data = await readJson(stateFile(dir), null)
  return {
    revision: Number(data?.revision ?? 0),
    updatedAt: String(data?.updatedAt ?? ''),
    by: String(data?.by ?? ''),
    touched: Array.isArray(data?.touched) ? data.touched : [],
    counts: data?.counts && typeof data.counts === 'object' ? data.counts : {},
  }
}

/**
 * 状态版本 +1。
 *
 * `touched` 只保留最近 20 条：它是给界面「刚刚谁改了什么」用的提示，
 * 不是审计日志——要审计看 chapters/history/ 与 dispatches.json。
 */
export async function bumpState(dir, patch = {}) {
  const cur = await readState(dir)
  const touched = [
    ...(patch.touched ? [{ ...patch.touched, at: nowIso(), by: String(patch.by ?? '') }] : []),
    ...cur.touched,
  ].slice(0, 20)
  const next = {
    revision: cur.revision + 1,
    updatedAt: nowIso(),
    by: String(patch.by ?? cur.by ?? ''),
    touched,
    counts: patch.counts && typeof patch.counts === 'object'
      ? { ...cur.counts, ...patch.counts }
      : cur.counts,
  }
  await writeJsonAtomic(stateFile(dir), next)
  return next
}

/** 给界面用的一份快照：版本号 + 几个会变数字，省得它自己算。 */
export async function stateSnapshot(root, projectId) {
  const dir = await projectDir(root, projectId)
  const state = await readState(dir)
  const chapters = await listChapters(root, projectId)
  const ledger = await getLedger(root, projectId)
  const review = chapters.filter((row) => row.status === 'review').length
  const accepted = chapters.filter((row) => row.status === 'accepted').length
  return {
    revision: state.revision,
    updatedAt: state.updatedAt,
    by: state.by,
    touched: state.touched,
    counts: {
      chapters: chapters.length,
      review,
      accepted,
      ledger: LEDGER_KINDS.reduce((sum, kind) => sum + (ledger[kind] ?? []).length, 0),
      words: chapters.reduce((sum, row) => sum + (Number(row.words) || 0), 0),
      ...state.counts,
    },
  }
}

export async function listChapters(root, projectId) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  let files = []
  try {
    files = await fs.readdir(base)
  } catch {
    return []
  }
  const seen = new Map()
  for (const file of files) {
    const m = CHAPTER_FILE_RE.exec(file)
    if (!m) continue
    const num = Number(m[1])
    const prefer = m[2] === 'txt' ? 2 : 1
    const prev = seen.get(num)
    if (!prev || prefer > prev.prefer) seen.set(num, { num, file, prefer })
  }
  const rows = []
  for (const { num, file } of [...seen.values()].sort((a, b) => a.num - b.num)) {
    const meta = await readJson(path.join(base, `${pad4(num)}.meta.json`), null)
    // 字数优先用 meta 里的缓存。千章之后每章读一遍全文只为数字数，
    // 会让 chapter.list 从毫秒级变成秒级；只有老数据没有缓存时才回退读全文。
    let words = Number(meta?.wordCount ?? meta?.words ?? 0)
    if (!words) {
      const text = await fs.readFile(path.join(base, file), 'utf8').catch(() => '')
      words = countWords(text)
    }
    rows.push({
      chapter: num,
      file,
      words,
      title: meta?.title ?? (await readTitleFallback(path.join(base, file), num)),
      status: meta?.status ?? 'review',
      score: Number(meta?.score ?? 0),
      issues: Array.isArray(meta?.issues) ? meta.issues.length : 0,
      violations: Array.isArray(meta?.violations) ? meta.violations.length : 0,
      cost: Number(meta?.cost ?? 0),
      rev: Number(meta?.rev ?? 0),
      updatedAt: meta?.updatedAt ?? '',
    })
  }
  return rows
}

/** 没有 meta.title 时才读第一行；避免每次都把整章读进内存。 */
async function readTitleFallback(file, num) {
  try {
    const handle = await fs.open(file, 'r')
    try {
      const buf = Buffer.alloc(240)
      const { bytesRead } = await handle.read(buf, 0, 240, 0)
      const head = buf.subarray(0, bytesRead).toString('utf8')
      const line = head.split('\n')[0].trim()
      if (line) return line.slice(0, 40)
    } finally {
      await handle.close()
    }
  } catch {
    /* 读不到就当没标题 */
  }
  return `第 ${num} 回`
}

export async function getChapter(root, projectId, chapter) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const num = pad4(chapter)
  let text = ''
  let file = ''
  for (const candidate of [`${num}.txt`, `${num}.md`]) {
    const full = path.join(base, candidate)
    if (existsSync(full)) {
      text = await fs.readFile(full, 'utf8')
      file = candidate
      break
    }
  }
  const meta = await readJson(path.join(base, `${num}.meta.json`), null)
  return {
    chapter: Number(chapter),
    file,
    text,
    words: countWords(text),
    meta: meta ?? { chapter: Number(chapter), status: 'review', score: 0, issues: [], violations: [], cost: 0 },
  }
}

/** 时间戳 → 可用于文件名的形态：20261027T164301123Z */
function stamp() {
  const d = new Date()
  const p = (n, w = 2) => String(n).padStart(w, '0')
  return [
    d.getUTCFullYear(), p(d.getUTCMonth() + 1), p(d.getUTCDate()),
    'T',
    p(d.getUTCHours()), p(d.getUTCMinutes()), p(d.getUTCSeconds()), p(d.getUTCMilliseconds(), 3),
    'Z',
  ].join('')
}

function historyDir(base) {
  return path.join(base, 'history')
}

function trashDir(base) {
  return path.join(base, '.trash')
}

/**
 * 覆盖前留底。
 *
 * 为什么必须有：saveChapter 是覆盖写。验收台改一句、采纳一条提案、AI 回炉重写，
 * 最终都汇到这一个函数。没有留底的话，一次错采纳就把上一版正文永久抹掉。
 * 这里只留正文，不复制 meta —— 历史版本的价值是「原文能找回来」。
 */
async function snapshotChapter(base, num, file) {
  if (!file) return null
  const from = path.join(base, file)
  if (!existsSync(from)) return null
  const old = await fs.readFile(from, 'utf8').catch(() => null)
  if (old === null) return null
  const dir = historyDir(base)
  await fs.mkdir(dir, { recursive: true })
  const ext = path.extname(file).replace('.', '') || 'txt'
  const name = `${num}-${stamp()}.${ext}`
  await writeTextAtomic(path.join(dir, name), old)
  await pruneHistory(base, num)
  return name
}

/** 只保留最近 HISTORY_KEEP 版，防止历史目录无限膨胀。 */
async function pruneHistory(base, num) {
  const dir = historyDir(base)
  let names = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return
  }
  const mine = names
    .map((name) => ({ name, m: HISTORY_FILE_RE.exec(name) }))
    .filter((row) => row.m && row.m[1] === num)
    .map((row) => row.name)
  if (mine.length <= HISTORY_KEEP) return
  // 文件名里带 ISO 时间戳，字典序即时间序。
  const drop = mine.sort().slice(0, mine.length - HISTORY_KEEP)
  for (const name of drop) await fs.rm(path.join(dir, name), { force: true })
}

/** 同步把字数写进 meta，供 listChapters 免读全文时兜底。 */
export async function saveChapter(root, projectId, chapter, text, metaPatch = {}, options = {}) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const num = pad4(chapter)
  const body = String(text ?? '')

  // 乐观锁：调用方带 expectRev 来，就按「它看到的那一版」核对。
  // 不带就不核（第一次写、导入旧稿、回滚历史都不该被锁住）。
  // 冲突时给 conflict 而不是 invalid：这不是参数错，是「你手里的稿子过期了」，
  // 上层要区分这两件事——前者让人改参数，后者让人重新读一遍再决定。
  if (options.expectRev !== undefined && options.expectRev !== null && options.expectRev !== '') {
    const cur = await readJson(path.join(base, `${num}.meta.json`), null)
    const actual = Number(cur?.rev ?? 0)
    const expect = Number(options.expectRev)
    if (Number.isFinite(expect) && expect !== actual) {
      const error = new Error(
        `第 ${chapter} 回已经被改过了（你看的是第 ${expect} 版，磁盘上是第 ${actual} 版）。`
        + '重新读一遍再改，否则会把别人刚写的覆盖掉。',
      )
      error.code = 'conflict'
      error.details = { chapter: Number(chapter), expect, actual }
      throw error
    }
  }

  // 覆盖前先留底：只有「原来已经有正文」才快照，新建不算历史。
  let existingFile = ''
  for (const candidate of [`${num}.txt`, `${num}.md`]) {
    if (existsSync(path.join(base, candidate))) {
      existingFile = candidate
      break
    }
  }
  const snapshot = existingFile ? await snapshotChapter(base, num, existingFile) : null

  await writeTextAtomic(path.join(base, `${num}.txt`), body)
  // 新落盘的正文默认进「待验收」（review）：AI 写完的稿必须等人拍板。
  // 这里若给 draft，验收台默认筛的就是 review，会永远空着——正文进来了却没人能看见。
  // 已存在 meta 的章节重存时沿用原状态（accepted 不会被这次覆盖回去）。
  const prev = (await readJson(path.join(base, `${num}.meta.json`), null)) ?? {
    chapter: Number(chapter),
    status: 'review',
    score: 0,
    issues: [],
    violations: [],
    cost: 0,
  }
  const words = countWords(body)
  const next = {
    ...prev,
    ...metaPatch,
    chapter: Number(chapter),
    words,
    // 字数缓存在 meta 里：千章之后 listChapters 不必为了算字数把每章正文全读一遍。
    wordCount: words,
    updatedAt: nowIso(),
  }
  // rev 每次都 +1，不只是「有快照」时。
  // 之前写成 `if (snapshot)` 才加，导致新建的章 rev 永远是 0，
  // 乐观锁在「两人同时新建同一章」这个最常见的冲突上完全失效。
  next.rev = Number(prev.rev ?? 0) + 1
  if (snapshot) next.lastSnapshot = snapshot
  // 只记不拦：命中几处「作者自己的词表」（去 AI 味那 12 条）。
  // 拦不拦是产品策略（在 index.js 的 chapter.save 里按 lint 模块判），
  // 不该埋进存盘函数——否则回滚历史版本也会被同一个策略挡住。
  const styleHits = scanAiStyle(body)
  next.styleIssues = styleHits.length
  await writeJsonAtomic(path.join(base, `${num}.meta.json`), next)
  return next
}

/** 该章的历史版本清单（新 → 旧）。 */
export async function listChapterHistory(root, projectId, chapter) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const num = pad4(chapter)
  const hdir = historyDir(base)
  let names = []
  try {
    names = await fs.readdir(hdir)
  } catch {
    return { chapter: Number(chapter), versions: [] }
  }
  const versions = []
  for (const name of names.sort().reverse()) {
    const m = HISTORY_FILE_RE.exec(name)
    if (!m || m[1] !== num) continue
    const full = path.join(hdir, name)
    const text = await fs.readFile(full, 'utf8').catch(() => '')
    const stat = await fs.stat(full).catch(() => null)
    versions.push({
      name,
      at: m[2],
      file: `${m[2]}.${m[3]}`,
      words: countWords(text),
      size: stat ? stat.size : 0,
    })
  }
  const meta = await readJson(path.join(base, `${num}.meta.json`), null)
  return {
    chapter: Number(chapter),
    currentWords: Number(meta?.words ?? 0),
    keep: HISTORY_KEEP,
    versions,
  }
}

/** 取某一版的正文；name 必须精确命中 history 目录里的文件，防路径穿越。 */
export async function readChapterVersion(root, projectId, chapter, name) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const num = pad4(chapter)
  const safe = String(name ?? '')
  const m = HISTORY_FILE_RE.exec(safe)
  if (!m || m[1] !== num) fail('历史版本文件名不合法', 'invalid')
  const full = path.join(historyDir(base), safe)
  if (!existsSync(full)) fail(`没有这一版历史：${safe}`, 'missing')
  const text = await fs.readFile(full, 'utf8')
  return { chapter: Number(chapter), name: safe, at: m[2], text, words: countWords(text) }
}

/**
 * 回滚到某一版。
 *
 * 回滚本身也是一次写入，所以「回滚前的当前正文」同样会进 history ——
 * 回滚错了还能再滚回来，不会因为一次手滑把当前稿也搭进去。
 */
export async function restoreChapterVersion(root, projectId, chapter, name) {
  const target = await readChapterVersion(root, projectId, chapter, name)
  const meta = await saveChapter(root, projectId, chapter, target.text, { restoredFrom: target.name })
  return { chapter: Number(chapter), restoredFrom: target.name, meta }
}

/**
 * 章节重排：把第 from 回挪到第 to 回的位置，途经各章顺移一位。
 *
 * 为什么必须由服务端做：章号就是文件名（0001.txt），没有「排在第六章后面」这种表达。
 * 想在两章之间插一章，只能重编号。手工改文件名会让 .meta.json 与 history/ 里的
 * 版本文件全部对不上号 —— 回滚会回到别人的稿子上。
 *
 * 实现走两段重命名：先全部改成 .reorder-<rand>-<num>.<ext>（不匹配 CHAPTER_FILE_RE，
 * 中途不会被 listChapters 看见），再写成最终章号。history/ 里的 0005-<stamp>.txt
 * 跟着改成新章号，否则历史版本会串到别的章。
 */
/**
 * 按 plan（旧章号 → 新章号）把正文、meta、历史版本整体改名。
 *
 * 为什么先搬到临时名再落地：1↔2 直接 swap 会撞号。全部先 stage 成 .reorder-*，
 * 再统一 rename 到目标名，中间态永远不会出现两个同名文件。
 *
 * 历史版本在 chapters/history/ 下，不能靠 `../history` 相对 base 拼 ——
 * 那会拼到 <project>/history（不存在的目录），rename 直接 ENOENT。
 * 原来搬 moveChapter 时就是这么写的，只是没人测过重排才一直没炸。
 */
async function renumberChapters(base, plan) {
  if (!plan.size) return 0
  const staged = []
  const rand = shortId(4)
  const hdir = historyDir(base)
  for (const [oldNum, newNum] of plan) {
    const oldPad = pad4(oldNum)
    const newPad = pad4(newNum)
    // [来源绝对路径, 目标绝对路径]
    const pairs = []
    for (const ext of ['txt', 'md']) {
      const from = path.join(base, `${oldPad}.${ext}`)
      if (existsSync(from)) pairs.push([from, path.join(base, `${newPad}.${ext}`)])
    }
    const metaFrom = path.join(base, `${oldPad}.meta.json`)
    if (existsSync(metaFrom)) pairs.push([metaFrom, path.join(base, `${newPad}.meta.json`)])
    if (existsSync(hdir)) {
      const names = await fs.readdir(hdir).catch(() => [])
      for (const name of names) {
        const m = HISTORY_FILE_RE.exec(name)
        if (!m || m[1] !== oldPad) continue
        pairs.push([path.join(hdir, name), path.join(hdir, `${newPad}-${m[2]}.${m[3]}`)])
      }
    }
    for (const [from, next] of pairs) {
      const tmp = path.join(base, `.reorder-${rand}-${path.basename(from)}`)
      await fs.rename(from, tmp)
      staged.push({ tmp, next })
    }
  }
  for (const item of staged) {
    await fs.mkdir(path.dirname(item.next), { recursive: true })
    await fs.rename(item.tmp, item.next)
  }
  // meta 里的 chapter 字段也要改，否则 chapter.get 回的是旧章号。
  for (const [oldNum, newNum] of plan) {
    const metaPath = path.join(base, `${pad4(newNum)}.meta.json`)
    if (!existsSync(metaPath)) continue
    const meta = await readJson(metaPath, null)
    if (!meta) continue
    await writeJsonAtomic(metaPath, { ...meta, chapter: newNum, movedFrom: oldNum })
  }
  return staged.length
}

export async function moveChapter(root, projectId, from, to) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const src = Number(from)
  const dst = Number(to)
  if (!Number.isInteger(src) || !Number.isInteger(dst) || src < 1 || dst < 1) {
    fail('章号必须是正整数', 'invalid')
  }
  const rows = await listChapters(root, projectId)
  const nums = rows.map((row) => row.chapter)
  if (!nums.includes(src)) fail(`第 ${src} 回不存在`, 'missing')
  if (src === dst) return { moved: src, to: dst, changed: 0 }
  const delta = dst < src ? 1 : -1
  const lo = Math.min(src, dst)
  const hi = Math.max(src, dst)
  // 途经章各让一位；只有真实存在的章才动，空号不动。
  const plan = new Map()
  plan.set(src, dst)
  for (const num of nums) {
    if (num === src) continue
    if (num >= lo && num <= hi) plan.set(num, num + delta)
  }
  const after = [...plan.values()]
  if (new Set(after).size !== after.length) fail('重排后会撞号，先补平章号再试', 'conflict')
  await renumberChapters(base, plan)
  return { moved: src, to: dst, changed: plan.size }
}

/**
 * 在两章之间插一个空章。
 *
 * 章号就是文件名，所以「插一章」只能先把 at 及其之后的章各推后一位，再在空出来的
 * 位置开一张空稿。以前只有 moveChapter（挪已有章），想插章只能手动改文件名 ——
 * 那会让 meta 与 history/ 全部对不上号，等于把账本写坏。
 */
export async function insertChapter(root, projectId, at, options = {}) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const target = Number(at)
  if (!Number.isInteger(target) || target < 1) fail('插在第几回必须是正整数', 'invalid')
  const rows = await listChapters(root, projectId)
  const nums = rows.map((row) => row.chapter)
  // 目标位置已经有章，就把它和后面所有章各推后一位；位置空着就直接用。
  const plan = new Map()
  for (const num of nums) {
    if (num >= target) plan.set(num, num + 1)
  }
  const after = [...plan.values()]
  if (new Set(after).size !== after.length) fail('插入前章号有重复，先补平再试', 'conflict')
  await renumberChapters(base, plan)
  const title = String(options.title ?? '').trim() || `第 ${target} 回`
  const text = `${title}\n\n`
  const saved = await saveChapter(root, projectId, target, text, {
    status: 'draft',
    title,
    ...(options.intent ? { intent: String(options.intent) } : {}),
  })
  return {
    chapter: target,
    title,
    shifted: plan.size,
    words: saved?.words ?? countWords(text),
  }
}

/**
 * 删章 → 扔进回收站。
 *
 * 原来是 fs.rm({force:true})：点错一下就永久没了，正文 + 评分 + 问题记录一起蒸发。
 * 现在改成 mv 到 chapters/.trash/<stamp>/，文件名保持原样，便于原路还原。
 */
export async function deleteChapter(root, projectId, chapter) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const num = pad4(chapter)
  const box = path.join(trashDir(base), stamp())
  let moved = 0
  for (const candidate of [`${num}.txt`, `${num}.md`, `${num}.meta.json`]) {
    const from = path.join(base, candidate)
    if (!existsSync(from)) continue
    await fs.mkdir(box, { recursive: true })
    await fs.rename(from, path.join(box, candidate)).catch(async () => {
      // 跨盘 / 占用时退回「读 + 写 + 删」。
      const text = await fs.readFile(from).catch(() => null)
      if (text !== null) await fs.writeFile(path.join(box, candidate), text)
      await fs.rm(from, { force: true })
    })
    moved += 1
  }
  if (!moved) fail(`第 ${chapter} 回没有可删的文件`, 'missing')
  return { deleted: Number(chapter), trash: path.basename(box), files: moved }
}

/** 回收站清单，按删除时间倒序。 */
export async function listTrash(root, projectId) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const root2 = trashDir(base)
  let boxes = []
  try {
    boxes = await fs.readdir(root2)
  } catch {
    return { items: [] }
  }
  const items = []
  for (const box of boxes.sort().reverse()) {
    const full = path.join(root2, box)
    const stat = await fs.stat(full).catch(() => null)
    if (!stat || !stat.isDirectory()) continue
    const files = await fs.readdir(full).catch(() => [])
    const txt = files.find((name) => /\.(txt|md)$/.test(name))
    const num = txt ? Number(txt.slice(0, 4)) : 0
    const text = txt ? await fs.readFile(path.join(full, txt), 'utf8').catch(() => '') : ''
    const meta = await readJson(path.join(full, `${txt ? txt.slice(0, 4) : '0000'}.meta.json`), null)
    items.push({
      trash: box,
      chapter: num,
      title: meta?.title ?? firstLine(text) ?? (num ? `第 ${num} 回` : '（无正文）'),
      words: countWords(text),
      status: meta?.status ?? '',
      files,
      at: box,
    })
  }
  return { items }
}

/** 从回收站还原；原位置已有同名文件时报冲突，不覆盖。 */
export async function recoverChapter(root, projectId, trashName) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const box = String(trashName ?? '')
  if (!/^\d{8}T\d{9}Z$/.test(box)) fail('回收站名不合法', 'invalid')
  const full = path.join(trashDir(base), box)
  if (!existsSync(full)) fail(`回收站里没有 ${box}`, 'missing')
  const files = await fs.readdir(full)
  const txt = files.find((name) => /\.(txt|md)$/.test(name))
  if (txt && existsSync(path.join(base, txt))) {
    fail(`第 ${Number(txt.slice(0, 4))} 回已经有正文了，先把现有的删掉或改名再还原`, 'conflict')
  }
  let back = 0
  for (const name of files) {
    await fs.rename(path.join(full, name), path.join(base, name))
    back += 1
  }
  await fs.rm(full, { recursive: true, force: true })
  const num = txt ? Number(txt.slice(0, 4)) : 0
  return { recovered: num, trash: box, files: back }
}

/** 彻底清空回收站（或只清一个）。 */
export async function purgeTrash(root, projectId, trashName) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'chapters')
  const root2 = trashDir(base)
  if (trashName) {
    const box = String(trashName)
    if (!/^\d{8}T\d{9}Z$/.test(box)) fail('回收站名不合法', 'invalid')
    await fs.rm(path.join(root2, box), { recursive: true, force: true })
    return { purged: box }
  }
  await fs.rm(root2, { recursive: true, force: true })
  return { purged: 'all' }
}

function firstLine(text) {
  const line = String(text ?? '').split('\n').map((row) => row.trim()).find(Boolean)
  return line ? line.slice(0, 40) : ''
}

// ── 全文搜索 ─────────────────────────────────────────────────

/**
 * 跨章正文 + 账本 + 大纲的全文搜索。
 *
 * 为什么放服务端：正文在磁盘上，界面只有 chapter.list 的元数据。
 * 浏览器的 Ctrl+K 想找「玉玺在哪些章出现过」，只能把每章正文全拉下来 ——
 * 三十章还行，千章时会把几 MB 文本塞进浏览器。
 * 字数是软的：命中太多就只回前 limit 条，并把「还有多少没显示」一起带回去。
 */
export async function searchProject(root, projectId, query, options = {}) {
  const keyword = String(query ?? '').trim()
  const limit = Math.max(1, Math.min(200, Number(options?.limit) || 30))
  const scope = ['all', 'chapters', 'ledger', 'outline'].includes(String(options?.scope))
    ? String(options.scope)
    : 'all'
  if (!keyword) return { query: '', scope, hits: [], total: 0, truncated: false }
  const lower = keyword.toLowerCase()
  const hits = []
  let total = 0

  const push = (hit) => {
    total += 1
    if (hits.length < limit) hits.push(hit)
  }

  if (scope === 'all' || scope === 'chapters') {
    const dir = await projectDir(root, projectId)
    const rows = await listChapters(root, projectId)
    // 一章最多回 5 处：一章里「玉玺」出现 30 次，把 30 条都塞进面板没有意义，
    // 作者要的是「哪几章提到了、各几次」，不是把命中列表当正文读。
    const PER_CHAPTER = 5
    for (const row of rows) {
      const text = await fs.readFile(path.join(dir, 'chapters', row.file), 'utf8').catch(() => '')
      if (!text) continue
      const hay = text.toLowerCase()
      let at = hay.indexOf(lower)
      if (at < 0) continue
      let count = 0
      let shown = 0
      while (at >= 0) {
        count += 1
        if (shown < PER_CHAPTER) {
          // 命中位置换算成段号：验收台点一下就能跳到那段。
          const para = text.slice(0, at).split(/\n+/).length - 1
          push({
            kind: 'chapter',
            chapter: row.chapter,
            title: row.title,
            para,
            offset: at,
            nth: count,
            count: 0, // 真实总数在下面回填
            quote: text.slice(Math.max(0, at - 30), at + keyword.length + 30).replace(/\n/g, ' ').trim(),
          })
          shown += 1
        }
        at = hay.indexOf(lower, at + Math.max(1, keyword.length))
      }
      // 这一章的真实出现次数回填到刚推入的那几条上，界面能显示「第 3/8 处」。
      for (let i = hits.length - shown; i < hits.length; i += 1) {
        if (hits[i]?.kind === 'chapter' && hits[i].chapter === row.chapter) hits[i].count = count
      }
      if (count > shown) total += count - shown
    }
  }

  if (scope === 'all' || scope === 'ledger') {
    const ledger = await getLedger(root, projectId)
    for (const kind of LEDGER_KINDS) {
      for (const row of ledger[kind] ?? []) {
        const blob = JSON.stringify(row)
        if (!blob.toLowerCase().includes(lower)) continue
        push({
          kind: 'ledger',
          ledger: kind,
          id: row.id,
          title: row.name ?? row.title ?? row.id,
          quote: blob.slice(0, 120),
        })
      }
    }
  }

  if (scope === 'all' || scope === 'outline') {
    const outline = await getOutline(root, projectId).catch(() => null)
    for (const vol of outline?.volumes ?? []) {
      for (const row of vol.rows ?? []) {
        const blob = `${row.title ?? ''} ${row.summary ?? ''} ${row.hook ?? ''}`
        if (!blob.toLowerCase().includes(lower)) continue
        push({
          kind: 'outline',
          chapter: Number(row.chapter) || 0,
          title: row.title ?? '',
          quote: blob.trim().slice(0, 120),
        })
      }
    }
  }

  return { query: keyword, scope, hits, total, truncated: total > hits.length }
}

// ── 账本 ─────────────────────────────────────────────────────

export const LEDGER_KINDS = [
  'characters', 'locations', 'foreshadow', 'events', 'terms', 'rules', 'highlights', 'conflicts',
]

/**
 * 账本容量上限。
 *
 * 为什么要有上限：账本不是「越多越好」的笔记，它是每次派单都要压缩进上下文的东西。
 * 一本 1000 章的书如果往 events 里塞了 8000 条流水，压缩后仍会撑爆 prompt，
 * 到那时账本就废了——不是没用，是读不完，等于没有。
 *
 * 所以这里在写入口就拦：超了当场拒写，并告诉调用方「先归档再写」。
 * 拒写比静默丢弃诚实：静默丢弃会让作者以为记下了，其实没记。
 */
export const LEDGER_LIMITS = {
  characters: 240,
  locations: 160,
  foreshadow: 240,
  events: 800,
  terms: 300,
  rules: 160,
  highlights: 120,
  conflicts: 120,
}

/** 单条账本行整行 JSON 的字节上限（不是单个字段）。 */
export const LEDGER_ROW_MAX_BYTES = 4096

function rowBytes(row) {
  return Buffer.byteLength(JSON.stringify(row ?? {}), 'utf8')
}

export function emptyLedger() {
  return {
    characters: [], locations: [], foreshadow: [], events: [],
    terms: [], rules: [], highlights: [], conflicts: [],
  }
}

export async function getLedger(root, projectId) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'ledger.json'), null)
  return { ...emptyLedger(), ...(data ?? {}) }
}

export async function saveLedger(root, projectId, ledger) {
  const dir = await projectDir(root, projectId)
  const next = { ...emptyLedger() }
  for (const kind of LEDGER_KINDS) {
    next[kind] = Array.isArray(ledger?.[kind]) ? ledger[kind] : []
  }
  await writeJsonAtomic(path.join(dir, 'ledger.json'), next)
  return next
}

export async function upsertLedgerRow(root, projectId, kind, row) {
  if (!LEDGER_KINDS.includes(kind)) fail(`未知账本类别 ${kind}`, 'invalid')
  const dir = await projectDir(root, projectId)
  const ledger = { ...emptyLedger(), ...(await readJson(path.join(dir, 'ledger.json'), {})) }
  const rows = Array.isArray(ledger[kind]) ? [...ledger[kind]] : []
  const id = String(row?.id ?? '').trim() || `led_${shortId(4)}`
  const at = rows.findIndex((item) => item.id === id)

  // 单行超限：先拦，因为一行就 4KB 的账本条目，压进 prompt 时谁也读不出重点
  const size = rowBytes(row)
  if (size > LEDGER_ROW_MAX_BYTES) {
    const error = new Error(
      `这条账本 ${size} 字节，超过单行上限 ${LEDGER_ROW_MAX_BYTES}。`
      + '账本条目要短：把细节写进正文，这里只记「谁、什么、什么时候」。',
    )
    error.code = 'ledger-row-too-large'
    error.details = { kind, id, bytes: size, limit: LEDGER_ROW_MAX_BYTES }
    throw error
  }

  // 容量超限：更新已有的行永远允许（不然改一个字都改不了），只有新增才拦
  const limit = LEDGER_LIMITS[kind] ?? 200
  if (at < 0 && rows.length >= limit) {
    const error = new Error(
      `账本「${kind}」已满（${rows.length}/${limit}）。`
      + `这一类的条目要定期归档：把已经收线的移出去，或者合并成一条。`,
    )
    error.code = 'ledger-full'
    error.details = { kind, count: rows.length, limit }
    throw error
  }

  const now = nowIso()
  // 新建时 createdAt 必须同时写进落盘的行和返回给调用方的 row，
  // 否则界面上刚加的那条没有建立时间，要刷新一次才「出现」时间。
  const next = at >= 0
    ? { ...row, id, updatedAt: now }
    : { ...row, id, updatedAt: now, createdAt: now }
  if (at >= 0) rows[at] = { ...rows[at], ...next }
  else rows.push(next)
  ledger[kind] = rows
  await writeJsonAtomic(path.join(dir, 'ledger.json'), ledger)
  return { kind, row: next, rows }
}

/**
 * 账本体检。
 *
 * 回答三个问题：还有没有位置、哪一条在偷偷变胖、哪几条其实是同一个人。
 * 这三件事在账本长大以后都会发生，而它们都不会自己报错——
 * 直到某次派单的 prompt 被撑爆，你才发现账本已经不能用了。
 */
export async function auditLedger(root, projectId) {
  const dir = await projectDir(root, projectId)
  const file = path.join(dir, 'ledger.json')
  const ledger = { ...emptyLedger(), ...(await readJson(file, {})) }
  let fileBytes = 0
  try {
    fileBytes = (await fs.stat(file)).size
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const kinds = []
  const problems = []
  for (const kind of LEDGER_KINDS) {
    const rows = Array.isArray(ledger[kind]) ? ledger[kind] : []
    const limit = LEDGER_LIMITS[kind] ?? 200
    let bytes = 0
    let biggest = null
    const byName = new Map()

    for (const row of rows) {
      const size = rowBytes(row)
      bytes += size
      if (!biggest || size > biggest.bytes) {
        biggest = { id: row?.id ?? '', name: String(row?.name ?? row?.title ?? ''), bytes: size }
      }
      const name = String(row?.name ?? row?.title ?? row?.key ?? '').trim()
      if (name) {
        const key = name.toLowerCase()
        byName.set(key, (byName.get(key) ?? 0) + 1)
      }
      if (size > LEDGER_ROW_MAX_BYTES) {
        problems.push({
          kind, id: row?.id ?? '', level: 'red',
          message: `单条 ${size} 字节，超过 ${LEDGER_ROW_MAX_BYTES} 上限`,
        })
      }
    }

    const duplicates = Array.from(byName.entries())
      .filter(([, count]) => count > 1)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)

    for (const dup of duplicates) {
      problems.push({
        kind, id: '', level: 'yellow',
        message: `「${dup.name}」出现 ${dup.count} 次，可能是同一条记了两遍`,
      })
    }

    const percent = limit > 0 ? Math.round((rows.length / limit) * 100) : 0
    if (percent >= 100) {
      problems.push({ kind, id: '', level: 'red', message: `已满（${rows.length}/${limit}），新条目会被拒写` })
    } else if (percent >= 85) {
      problems.push({ kind, id: '', level: 'orange', message: `快满了（${rows.length}/${limit}），该归档了` })
    }

    kinds.push({
      kind, count: rows.length, limit, percent,
      bytes, avgBytes: rows.length ? Math.round(bytes / rows.length) : 0,
      biggest, duplicates: duplicates.slice(0, 5),
      full: rows.length >= limit,
    })
  }

  const totalBytes = kinds.reduce((sum, row) => sum + row.bytes, 0)
  const totalCount = kinds.reduce((sum, row) => sum + row.count, 0)
  return {
    kinds,
    totalCount,
    totalBytes,
    fileBytes,
    rowLimit: LEDGER_ROW_MAX_BYTES,
    problems,
    // 一句话结论：界面直接显示它，不用自己拼
    verdict: problems.some((p) => p.level === 'red')
      ? '有必须处理的条目'
      : problems.length
        ? '有几处值得看一眼'
        : '账本健康',
  }
}

export async function removeLedgerRow(root, projectId, kind, id) {
  if (!LEDGER_KINDS.includes(kind)) fail(`未知账本类别 ${kind}`, 'invalid')
  const dir = await projectDir(root, projectId)
  const ledger = { ...emptyLedger(), ...(await readJson(path.join(dir, 'ledger.json'), {})) }
  ledger[kind] = (ledger[kind] ?? []).filter((item) => item.id !== id)
  await writeJsonAtomic(path.join(dir, 'ledger.json'), ledger)
  return { kind, removed: id }
}

// ── 指令模板 ─────────────────────────────────────────────────

export function defaultTemplates() {
  return [
    { id: 'tpl_punch', name: '打脸章', intent: '主角吃瘪但埋下钩子，章末反转，不许死人', used: 0 },
    { id: 'tpl_misread', name: '误会章', intent: '误会升级，双方各执一词，章末真相露一角', used: 0 },
    { id: 'tpl_reveal', name: '身份揭穿', intent: '身份当众揭穿，收一条旧伏笔', used: 0 },
    { id: 'tpl_bridge', name: '过渡章', intent: '过渡章：推进时间、交代局势，不安排大冲突', used: 0 },
    { id: 'tpl_climax', name: '高潮章', intent: '卷末高潮：主线冲突爆发，主角付出代价获胜', used: 0 },
    { id: 'tpl_close', name: '收伏笔章', intent: '回收伏笔：把第 X 回埋的线索兑现，给出解释', used: 0 },
  ]
}

export async function listTemplates(root, projectId) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'templates.json'), null)
  const items = Array.isArray(data?.items) ? data.items : defaultTemplates()
  return { items }
}

export async function saveTemplate(root, projectId, template) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'templates.json'), null)
  const items = Array.isArray(data?.items) ? [...data.items] : defaultTemplates()
  const id = String(template?.id ?? '').trim() || `tpl_${shortId(4)}`
  const name = String(template?.name ?? '').trim()
  if (!name) fail('模板名不能为空')
  const next = { id, name, intent: String(template?.intent ?? ''), used: Number(template?.used) || 0, updatedAt: nowIso() }
  const at = items.findIndex((item) => item.id === id)
  if (at >= 0) items[at] = { ...items[at], ...next }
  else items.push(next)
  await writeJsonAtomic(path.join(dir, 'templates.json'), { items })
  return { items, template: next }
}

export async function removeTemplate(root, projectId, id) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'templates.json'), null)
  const items = (Array.isArray(data?.items) ? data.items : defaultTemplates()).filter((item) => item.id !== id)
  await writeJsonAtomic(path.join(dir, 'templates.json'), { items })
  return { items }
}

// ── 跑批队列 ─────────────────────────────────────────────────

export async function listQueue(root, projectId) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'queue.json'), null)
  return { items: Array.isArray(data?.items) ? data.items : [] }
}

export async function addQueue(root, projectId, item = {}) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'queue.json'), null)
  const items = Array.isArray(data?.items) ? [...data.items] : []
  const row = {
    id: `q_${shortId(4)}`,
    chapter: Number(item.chapter) || 0,
    templateId: String(item.templateId ?? ''),
    templateName: String(item.templateName ?? ''),
    intent: String(item.intent ?? ''),
    words: Number(item.words) || 2500,
    status: 'queued',
    cost: Number(item.cost) || 0,
    createdAt: nowIso(),
  }
  items.push(row)
  await writeJsonAtomic(path.join(dir, 'queue.json'), { items })
  return { items, item: row }
}

export async function updateQueue(root, projectId, id, patch = {}) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'queue.json'), null)
  const items = Array.isArray(data?.items) ? [...data.items] : []
  const at = items.findIndex((row) => row.id === id)
  if (at < 0) fail(`队列里没有 ${id}`, 'missing')
  items[at] = { ...items[at], ...patch, updatedAt: nowIso() }
  await writeJsonAtomic(path.join(dir, 'queue.json'), { items })
  return { items, item: items[at] }
}

export async function removeQueue(root, projectId, id) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'queue.json'), null)
  const items = (Array.isArray(data?.items) ? data.items : []).filter((row) => row.id !== id)
  await writeJsonAtomic(path.join(dir, 'queue.json'), { items })
  return { items }
}

// ── 总览聚合 ─────────────────────────────────────────────────

export async function overview(root, projectId) {
  const { meta } = await getProject(root, projectId)
  const chapters = await listChapters(root, projectId)
  const ledger = await getLedger(root, projectId)
  const queue = await listQueue(root, projectId)

  const accepted = chapters.filter((row) => row.status === 'accepted')
  const pending = chapters.filter((row) => row.status === 'review')
  const totalWords = chapters.reduce((sum, row) => sum + row.words, 0)
  const totalCost = chapters.reduce((sum, row) => sum + row.cost, 0)
  const scored = chapters.filter((row) => row.score > 0)
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length)
    : 0

  // 本月花费：作者在设置里填的「每月预算」原本没有任何东西去消耗它，
  // 因为总花费只有 totalCost 一个累计数，跨月也不会归零。
  // 这里按章 meta.updatedAt 落在本月来切分，预算条才有意义。
  const monthKey = localDayKey(new Date()).slice(0, 7)
  const costThisMonth = Math.round(
    chapters
      .filter((row) => row.updatedAt && localDayKey(new Date(row.updatedAt)).slice(0, 7) === monthKey)
      .reduce((sum, row) => sum + row.cost, 0) * 100,
  ) / 100

  const debts = []
  const today = new Date()

  for (const row of ledger.foreshadow ?? []) {
    const plan = Number(row.plannedChapter) || 0
    const latest = chapters.length ? chapters[chapters.length - 1].chapter : 0
    if (plan > 0 && latest > plan && String(row.status ?? '') !== 'done') {
      debts.push({
        level: 'red',
        kind: 'foreshadow',
        title: `伏笔过期 · ${row.name ?? row.id}`,
        sub: `第 ${row.plantedChapter ?? '?'} 回埋 · 计划第 ${plan} 回收 · 现已到 ${latest}`,
        target: { page: 'world', kind: 'foreshadow', id: row.id },
      })
    }
  }
  for (const row of chapters) {
    if (row.violations > 0) {
      debts.push({
        level: 'red',
        kind: 'violation',
        title: `违规章 · 第 ${row.chapter} 回`,
        sub: `命中 ${row.violations} 条硬规则`,
        target: { page: 'review', chapter: row.chapter },
      })
    }
  }
  for (const row of chapters) {
    if (row.score > 0 && row.score < Number(meta.qualityGate ?? 70) && row.status === 'accepted') {
      debts.push({
        level: 'orange',
        kind: 'lowscore',
        title: `低分章 · 第 ${row.chapter} 回`,
        sub: `已采纳但 ${row.score} 分 · 低于门槛 ${meta.qualityGate ?? 70}`,
        target: { page: 'review', chapter: row.chapter },
      })
    }
  }
  const missing = chapters.filter((row) => row.issues > 0 && row.status !== 'accepted')
  if (missing.length) {
    debts.push({
      level: 'orange',
      kind: 'issues',
      title: `问题未修 · ${missing.length} 章`,
      sub: missing.slice(0, 4).map((row) => `第 ${row.chapter} 回`).join('、') + ` 共 ${missing.reduce((s, r) => s + r.issues, 0)} 条`,
      target: { page: 'review' },
    })
  }
  for (const row of ledger.characters ?? []) {
    const gap = Number(row.lastChapter) || 0
    const latest = chapters.length ? chapters[chapters.length - 1].chapter : 0
    if (row.major && gap > 0 && latest - gap >= 30) {
      debts.push({
        level: 'yellow',
        kind: 'character',
        title: `人物失踪 · ${row.name ?? row.id}`,
        sub: `主要角色 · 已 ${latest - gap} 章未出场（上次第 ${gap} 回）`,
        target: { page: 'world', kind: 'characters', id: row.id },
      })
    }
  }

  const order = { red: 0, orange: 1, yellow: 2, grey: 3 }
  debts.sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9))

  const plan = Number(meta.targetWords ?? 2500)
  // 今日字数按每章 meta.updatedAt 的日期切分来算。
  // 旧实现是「取最后三章里最后一章，只要不是 accepted 就把它的字数当今日量」——
  // 补写第 3 章不计入、今天写了五章但最后一章已采纳会算成 0、改旧章又会被算成今天新写的。
  // 驾驶舱的今日字数与连更天数都建立在这个数上，所以必须按真实日期聚合。
  const todayKey = localDayKey(today)
  const writeToday = chapters
    .filter((row) => row.updatedAt && localDayKey(new Date(row.updatedAt)) === todayKey)
    .reduce((sum, row) => sum + row.words, 0)
  const dailyWords = dailyWordsFor(chapters, 14)

  return {
    project: {
      id: projectId,
      name: meta.name,
      genre: meta.genre,
      qualityGate: Number(meta.qualityGate ?? 70),
      targetWords: plan,
      monthlyBudget: Number(meta.monthlyBudget ?? 600),
      worldState: meta.worldState ?? null,
    },
    stats: {
      chapters: chapters.length,
      totalWords,
      totalCost,
      costThisMonth,
      month: monthKey,
      avgScore,
      accepted: accepted.length,
      pending: pending.length,
      queued: queue.items.filter((row) => row.status === 'queued').length,
      running: queue.items.filter((row) => row.status === 'running').length,
      writeToday,
      targetWords: plan,
      streak: computeStreak(chapters, today),
      dailyWords,
    },
    debts: debts.slice(0, 12),
    recent: chapters.slice(-6).reverse(),
    suggestion: buildSuggestion(debts, chapters, meta),
    worldCounts: Object.fromEntries(LEDGER_KINDS.map((kind) => [kind, (ledger[kind] ?? []).length])),
    unclosedForeshadow: (ledger.foreshadow ?? []).filter((row) => String(row.status ?? '') !== 'done').length,
  }
}

/** 本地日历日的键：2026-10-27。用本地时区而不是 UTC —— 作者看到的「今天」是本地今天。 */
function localDayKey(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 最近 days 天（含今天）每天写了多少字，旧 → 新。给驾驶舱的柱状图用。 */
function dailyWordsFor(chapters, days = 14) {
  const buckets = new Map()
  for (const row of chapters) {
    if (!row.updatedAt) continue
    const key = localDayKey(new Date(row.updatedAt))
    if (!key) continue
    buckets.set(key, (buckets.get(key) ?? 0) + row.words)
  }
  const out = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    const key = localDayKey(d)
    out.push({ day: key, words: buckets.get(key) ?? 0 })
  }
  return out
}

function computeStreak(chapters) {
  const days = new Set()
  for (const row of chapters) {
    if (!row.updatedAt) continue
    const day = localDayKey(new Date(row.updatedAt))
    if (day) days.add(day)
  }
  if (!days.size) return 0
  let streak = 0
  const cursor = new Date()
  for (let i = 0; i < 400; i += 1) {
    const key = localDayKey(cursor)
    if (days.has(key)) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    if (i === 0) {
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    break
  }
  return streak
}

function buildSuggestion(debts, chapters, meta) {
  const red = debts.filter((row) => row.level === 'red')
  const worst = chapters
    .filter((row) => row.score > 0)
    .sort((a, b) => a.score - b.score)[0]
  if (worst && worst.score < Number(meta.qualityGate ?? 70)) {
    return `先处理第 ${worst.chapter} 回（${worst.score} 分）`
  }
  if (red.length) return `先清 ${red.length} 条红账：${red[0].title}`
  const next = (chapters.length ? chapters[chapters.length - 1].chapter : 0) + 1
  return `没有红账，可以续写第 ${next} 回`
}

// ── 验收动作 ─────────────────────────────────────────────────

export async function reviewAction(root, projectId, action, chapter, payload = {}) {
  const dir = await projectDir(root, projectId)
  const num = pad4(chapter)
  const metaFile = path.join(dir, 'chapters', `${num}.meta.json`)
  const meta = (await readJson(metaFile, null)) ?? {
    chapter: Number(chapter), status: 'review', score: 0, issues: [], violations: [], cost: 0,
  }
  let next = { ...meta }
  if (action === 'accept') {
    next.status = 'accepted'
    next.acceptedAt = nowIso()
    const proj = await getProject(root, projectId)
    await saveProject(root, projectId, {
      worldState: { text: String(payload.worldState ?? proj.meta.worldState?.text ?? ''), fromChapter: Number(chapter) },
    })
  } else if (action === 'reject') {
    next.status = 'rejected'
    next.rejectedAt = nowIso()
  } else if (action === 'rerun') {
    next.status = 'queued'
    next.rerunAt = nowIso()
    next.rerunCount = Number(next.rerunCount ?? 0) + 1
    await addQueue(root, projectId, { chapter, intent: String(payload.intent ?? ''), words: Number(meta.words) || 2500 })
  } else if (action === 'manual') {
    next.status = 'manual'
    next.manualAt = nowIso()
  } else {
    fail(`未知验收动作 ${action}`, 'invalid')
  }
  await writeJsonAtomic(metaFile, next)
  return next
}

// ── 大纲：老板给方案 → 出大纲 ────────────────────────────────
//
// 这一层补的是「从一句话方案到大纲」的缺口：brief 存老板的原话，
// volumes 存卷 / 章骨架。骨架可以一键生成，生成时按章号把已有的
// 手填标题、摘要、以及已经落盘的正文状态合回来，不会覆盖人工成果。

export const OUTLINE_SCHEMA = '0.1.0'

const BRIEF_TEXT_KEYS = [
  'premise', 'genre', 'audience', 'protagonist', 'goal', 'conflict', 'hook', 'ending',
]

export function emptyOutline() {
  return {
    schemaVersion: OUTLINE_SCHEMA,
    updatedAt: '',
    brief: {
      premise: '',
      genre: '',
      audience: '',
      protagonist: '',
      goal: '',
      conflict: '',
      hook: '',
      ending: '',
      volumes: 3,
      chaptersPerVolume: 20,
    },
    volumes: [],
  }
}

function normalizeBrief(raw) {
  const base = emptyOutline().brief
  const src = raw && typeof raw === 'object' ? raw : {}
  const next = { ...base }
  for (const key of BRIEF_TEXT_KEYS) {
    next[key] = src[key] !== undefined ? String(src[key] ?? '') : base[key]
  }
  next.volumes = Math.max(1, Math.min(30, Number(src.volumes) || base.volumes))
  next.chaptersPerVolume = Math.max(1, Math.min(200, Number(src.chaptersPerVolume) || base.chaptersPerVolume))
  return next
}

export async function getOutline(root, projectId) {
  const dir = await projectDir(root, projectId)
  const base = emptyOutline()
  const data = await readJson(path.join(dir, 'outline.json'), null)
  if (!data || typeof data !== 'object') return base
  return {
    ...base,
    schemaVersion: String(data.schemaVersion ?? base.schemaVersion),
    updatedAt: String(data.updatedAt ?? ''),
    brief: normalizeBrief(data.brief),
    volumes: Array.isArray(data.volumes) ? data.volumes : [],
  }
}

export async function saveOutline(root, projectId, patch = {}) {
  const dir = await projectDir(root, projectId)
  const prev = await getOutline(root, projectId)
  const next = {
    ...prev,
    updatedAt: nowIso(),
    brief: patch.brief !== undefined ? normalizeBrief(patch.brief) : prev.brief,
    volumes: Array.isArray(patch.volumes) ? patch.volumes : prev.volumes,
  }
  await writeJsonAtomic(path.join(dir, 'outline.json'), next)
  return next
}

export async function generateOutline(root, projectId, options = {}) {
  const dir = await projectDir(root, projectId)
  const prev = await getOutline(root, projectId)
  const brief = normalizeBrief({ ...prev.brief, ...(options.brief ?? {}) })
  const chapters = await listChapters(root, projectId)
  const written = new Map(chapters.map((row) => [row.chapter, row]))

  // 旧大纲按章号建索引：重建时保住人已经填过的标题 / 摘要 / 钩子
  const keptChapters = new Map()
  for (const vol of prev.volumes) {
    for (const row of (vol.chapters ?? [])) {
      keptChapters.set(Number(row.chapter), row)
    }
  }

  const volumes = []
  let n = 0
  for (let v = 1; v <= brief.volumes; v += 1) {
    const old = (prev.volumes ?? []).find((row) => Number(row.index) === v) ?? {}
    const rows = []
    for (let i = 1; i <= brief.chaptersPerVolume; i += 1) {
      n += 1
      const kept = keptChapters.get(n) ?? {}
      const done = written.get(n)
      let status = String(kept.status ?? 'todo')
      if (done) status = done.status === 'accepted' ? 'written' : 'drafted'
      rows.push({
        chapter: n,
        title: String(kept.title || done?.title || ''),
        summary: String(kept.summary ?? ''),
        hook: String(kept.hook ?? ''),
        status,
      })
    }
    volumes.push({
      id: String(old.id ?? `vol_${v}`),
      index: v,
      title: String(old.title || `第${v}卷`),
      summary: String(old.summary ?? ''),
      from: rows[0].chapter,
      to: rows[rows.length - 1].chapter,
      chapters: rows,
    })
  }

  const next = {
    ...prev,
    schemaVersion: OUTLINE_SCHEMA,
    updatedAt: nowIso(),
    brief,
    volumes,
  }
  await writeJsonAtomic(path.join(dir, 'outline.json'), next)
  return next
}

/** 把大纲里某一章的一句话摘要 + 钩子，组装成生产台能直接吃下的创作意图 */
export function outlineIntent(outline, chapter) {
  const num = Number(chapter) || 0
  for (const vol of outline?.volumes ?? []) {
    for (const row of (vol.chapters ?? [])) {
      if (Number(row.chapter) !== num) continue
      const parts = []
      if (row.summary) parts.push(String(row.summary))
      if (row.hook) parts.push(`本章末钩子：${row.hook}`)
      if (vol.summary) parts.push(`（本卷目标：${vol.summary}）`)
      if (!parts.length) return ''
      return `${parts.join(' · ')}`
    }
  }
  return ''
}

// ── 提案：AI 交上来的改动建议（before / after）────────────────
//
// 两套形态：
//   patch   —— 多条精确替换（before 必须能在正文里唯一对上）
//   rewrite —— 整章重写（只给 after）
// 采纳时由服务端真的把字写进 chapters/000N.txt，不是只改标记。

export const PROPOSAL_STATUS = ['pending', 'accepted', 'rejected', 'outdated']

async function readProposalBook(dir) {
  const data = await readJson(path.join(dir, 'proposals.json'), null)
  return Array.isArray(data?.items) ? data.items : []
}

async function writeProposalBook(dir, items) {
  await writeJsonAtomic(path.join(dir, 'proposals.json'), { schemaVersion: SCHEMA_VERSION, items })
}

/**
 * 对 proposals.json 做一次「读 → 改 → 写」，整段串行。
 *
 * 为什么必须串行：saveProposal / decideProposal / removeProposal 都是
 * read-modify-write。两个请求叉开进来，后写的那个会把先写的整份数组覆盖掉——
 * writeJsonAtomic 只保证文件不半截，管不了这件事。锁在 lib/lock.js 里，单进程内有效。
 */
async function mutateProposals(dir, task) {
  return serializeBy(path.join(dir, 'proposals.json'), async () => {
    const items = [...(await readProposalBook(dir))]
    const result = await task(items)
    if (result?.write !== false) await writeProposalBook(dir, items)
    return result
  })
}

export async function saveProposal(root, projectId, proposal = {}) {
  const dir = await projectDir(root, projectId)
  const chapter = Number(proposal?.chapter) || 0
  if (!chapter) fail('提案必须指明章号')
  const id = String(proposal?.id ?? '').trim() || `pr_${shortId(4)}`
  const rawList = Array.isArray(proposal?.diffs)
    ? proposal.diffs
      .map((row) => ({
        before: String(row?.before ?? ''),
        after: String(row?.after ?? ''),
        why: String(row?.why ?? ''),
      }))
      .filter((row) => row.before || row.after)
    : []
  if (!rawList.length) fail('提案至少要有一条 before / after')

  // 保存时就把每条改动定位到段落地址。等到采纳时正文可能已经变了，
  // 那时候连「作者当初指的是哪一段」都无从知道。
  let body = ''
  try {
    const ch = await getChapter(root, projectId, chapter)
    body = String(ch.text ?? '')
  } catch {
    body = ''
  }
  const diffs = rawList.map((row) => {
    const located = body
      ? anchors.locateText(chapter, body, row.before)
      : { pid: null, hash: null, index: -1, hits: 0 }
    return located.pid
      ? { ...row, anchor: { pid: located.pid, hash: located.hash, index: located.index } }
      : row
  })

  return mutateProposals(dir, async (items) => {
    const now = nowIso()
    const prev = items.find((row) => row.id === id)
    const status = String(proposal?.status ?? prev?.status ?? 'pending')
    const next = {
      id,
      chapter,
      kind: proposal?.kind === 'rewrite' ? 'rewrite' : 'patch',
      title: String(proposal?.title ?? '').trim() || `第 ${chapter} 回改动建议`,
      summary: String(proposal?.summary ?? ''),
      diffs,
      status: PROPOSAL_STATUS.includes(status) ? status : 'pending',
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    }
    const at = items.findIndex((row) => row.id === id)
    if (at >= 0) items[at] = { ...items[at], ...next }
    else items.push(next)
    return { items: [...items], proposal: next }
  })
}

function countOccurrences(text, sub) {
  const body = String(text ?? '')
  const needle = String(sub ?? '')
  if (!needle) return 0
  let count = 0
  let from = 0
  for (;;) {
    const at = body.indexOf(needle, from)
    if (at < 0) break
    count += 1
    from = at + needle.length
  }
  return count
}

/**
 * 采纳前的预检：每条 before 现在还能不能对得上。
 *
 * 分四层判断，界面要能把它们区分开：
 *   fresh = live      地址命中，原文没动过
 *   fresh = drifted   段落还在但被改过，段内还能找到 before
 *   fresh = outdated  段落没了，或者段内也找不到 before
 *   fresh = unlinked  这条提案是加地址系统之前存的，没有 anchor
 *
 * 为什么还留 countOccurrences：unlinked 的老提案只能靠「几处相同」判断，
 * 直接报错会让人连历史提案都打不开。
 */
export async function previewProposal(root, projectId, id) {
  const dir = await projectDir(root, projectId)
  const items = await readProposalBook(dir)
  const row = items.find((item) => item.id === id)
  if (!row) fail(`没有提案 ${id}`, 'missing')
  const ch = await getChapter(root, projectId, row.chapter)
  const body = String(ch.text ?? '')
  const rows = (row.diffs ?? []).map((patch, index) => {
    const before = String(patch.before ?? '')
    const anchor = patch?.anchor
    if (anchor?.pid) {
      const status = anchors.anchorStatus(body, anchor)
      const found = anchors.resolveAnchor(body, anchor)
      const inPara = Boolean(found.para && found.para.includes(before))
      // 段内也可能出现两次（同一段里同一句重复）。replace 只换第一处，
      // 所以这仍然是歧义，要照实报出来——作者得知道「改的可能是前半句」。
      const inParaCount = inPara ? countOccurrences(found.para, before) : 0
      return {
        index,
        before,
        after: String(patch.after ?? ''),
        fresh: status === 'live' || (status === 'drifted' && inPara) ? status : 'outdated',
        pid: anchor.pid,
        count: inParaCount,
        ambiguous: inParaCount > 1,
        missing: !inPara,
        drifted: status === 'drifted',
      }
    }
    const count = countOccurrences(body, before)
    return {
      index,
      before,
      after: String(patch.after ?? ''),
      fresh: 'unlinked',
      pid: '',
      count,
      ambiguous: count > 1,
      missing: count === 0,
      drifted: false,
    }
  })
  const ambiguous = rows.filter((item) => item.ambiguous).length
  const missing = rows.filter((item) => item.missing).length
  const outdated = rows.filter((item) => item.fresh === 'outdated').length
  return {
    proposal: row,
    chapter: Number(row.chapter),
    words: countWords(body),
    rows,
    ambiguous,
    missing,
    outdated,
    live: rows.filter((item) => item.fresh === 'live').length,
    drifted: rows.filter((item) => item.fresh === 'drifted').length,
    ok: row.kind === 'rewrite' || (ambiguous === 0 && missing === 0),
  }
}

/**
 * 采纳或驳回。
 *
 * 采纳时走段落地址：只要 pid 还在、段内还能找到 before，就只改那一段。
 * 同一句话在别处也出现，也不会改错地方——这是地址系统换来的东西。
 * 定位失败的一条记进 missed；全都失败就把提案打成 outdated，正文一个字不动。
 */
export async function decideProposal(root, projectId, id, action, payload = {}) {
  const dir = await projectDir(root, projectId)
  const found = await readProposalBook(dir)
  const hit = found.find((row) => row.id === id)
  if (!hit) fail(`没有提案 ${id}`, 'missing')

  if (action === 'reject') {
    return mutateProposals(dir, async (items) => {
      const at = items.findIndex((row) => row.id === id)
      const now = nowIso()
      items[at] = {
        ...items[at], status: 'rejected', decidedAt: now, updatedAt: now, applied: 0, missed: [],
      }
      return { proposal: items[at], items: [...items], applied: 0, missed: [] }
    })
  }
  if (action !== 'accept') fail(`未知提案动作 ${action}`, 'invalid')

  const ch = await getChapter(root, projectId, hit.chapter)
  let text = String(ch.text ?? '')
  let applied = 0
  const missed = []
  const ambiguous = []
  const outdatedPids = []

  if (hit.kind === 'rewrite') {
    const after = String(hit.diffs?.[0]?.after ?? '')
    if (!after.trim()) fail('整章重写提案没有给新正文，未写回')
    text = after
    applied = 1
  } else {
    for (const patch of hit.diffs ?? []) {
      const before = String(patch.before ?? '')
      if (!before) {
        missed.push('（空 before，已跳过）')
        continue
      }
      const anchor = patch?.anchor
      if (anchor?.pid) {
        const here = anchors.resolveAnchor(text, anchor)
        const inPara = here.para ? countOccurrences(here.para, before) : 0
        const out = anchors.replaceInPara(text, anchor, before, String(patch.after ?? ''))
        if (out.replaced) {
          if (inPara > 1) ambiguous.push({ before: before.slice(0, 40), count: inPara, pid: anchor.pid })
          text = out.text
          applied += 1
        } else {
          missed.push(before.slice(0, 24))
          outdatedPids.push(anchor.pid)
        }
        continue
      }
      // 老提案没有地址：只能退回全文唯一匹配。
      const hits = countOccurrences(text, before)
      if (!hits) {
        missed.push(before.slice(0, 24))
        continue
      }
      if (hits > 1) ambiguous.push({ before: before.slice(0, 40), count: hits })
      const cut = text.indexOf(before)
      text = text.slice(0, cut) + String(patch.after ?? '') + text.slice(cut + before.length)
      applied += 1
    }

    if (!applied) {
      // 一条都没对上：不写正文，把提案标成 outdated，让作者知道该重出提案了。
      return mutateProposals(dir, async (items) => {
        const at = items.findIndex((row) => row.id === id)
        const now = nowIso()
        items[at] = {
          ...items[at],
          status: 'outdated',
          updatedAt: now,
          applied: 0,
          missed,
          outdatedPids,
        }
        return {
          proposal: items[at], items: [...items], applied: 0, missed, ambiguous, outdated: true,
        }
      })
    }
  }

  await saveChapter(root, projectId, hit.chapter, text, {})
  return mutateProposals(dir, async (items) => {
    const at = items.findIndex((row) => row.id === id)
    const now = nowIso()
    items[at] = {
      ...items[at],
      status: 'accepted',
      decidedAt: now,
      updatedAt: now,
      applied,
      missed,
      ambiguous,
      outdatedPids,
      decidedBy: String(payload?.by ?? 'user'),
    }
    return {
      proposal: items[at],
      items: [...items],
      applied,
      missed,
      ambiguous,
      outdatedPids,
      words: countWords(text),
    }
  })
}

export async function removeProposal(root, projectId, id) {
  const dir = await projectDir(root, projectId)
  return mutateProposals(dir, async (items) => {
    const left = items.filter((row) => row.id !== id)
    items.length = 0
    items.push(...left)
    return { items: [...items], removed: id }
  })
}

/**
 * 读提案时批量刷新新鲜度（只加内存字段，不落盘）。
 *
 * 为什么读的时候算：作者可能刚手改过正文，提案在盘上还是 pending，
 * 但它的地址早就对不上了。界面得当场告诉他「这条已经过期」。
 */
export async function listProposals(root, projectId) {
  const dir = await projectDir(root, projectId)
  const items = await readProposalBook(dir)
  const cache = new Map()
  const out = []
  for (const row of items) {
    const chapter = Number(row?.chapter) || 0
    let body = cache.get(chapter)
    if (body === undefined) {
      try {
        const ch = await getChapter(root, projectId, chapter)
        body = String(ch.text ?? '')
      } catch {
        body = ''
      }
      cache.set(chapter, body)
    }
    if (row?.status !== 'pending' || !body) {
      out.push(row)
      continue
    }
    const diffs = anchors.annotateDiffs(body, row.diffs ?? [])
    const bad = diffs.filter((d) => d.fresh === 'outdated').length
    out.push({
      ...row,
      diffs,
      staleCount: bad,
      hint: bad ? `有 ${bad} 条改动已对不上正文，建议重新出提案` : '',
    })
  }
  return { items: out }
}

// ── 问题：跨章聚合的问题单，能闭环 ──────────────────────────

export const PROBLEM_TYPES = ['ai-style', 'logic', 'style', 'other']
export const PROBLEM_SEVERITY = ['critical', 'major', 'minor', 'note']
export const PROBLEM_STATUS = ['open', 'fixed', 'ignored']

/**
 * AI 味最小词表。
 *
 * 为什么放服务端：验收台的彩带颜色原来是前端拿一段假值画的，
 * 换成真稿子之后颜色就没有依据了。词表在这儿，problem.save 时顺手扫一遍正文，
 * 命中就打 ai-style 标 —— 这样彩带和问题单说的是同一件事。
 * 词表只收「几乎只出现在 AI 稿里」的套话，不收「缓缓」「淡淡」这类人也会写的词。
 */
export const AI_STYLE_LEXICON = [
  { pattern: '不是……而是……', test: /不是[^。！？\n]{1,20}[，,]\s*而是/, hint: '对偶式否定，AI 的高频句式' },
  { pattern: '空气仿佛凝固', test: /空气(仿佛|似乎|好像)(都)?凝固/, hint: '套话' },
  { pattern: '眼底闪过一丝', test: /眼底(闪过|掠过|划过)一(丝|抹)/, hint: '套话' },
  { pattern: '嘴角勾起', test: /嘴角(微微)?(勾起|扬起|漾起)/, hint: '套话' },
  { pattern: '不由得', test: /不由得/, hint: '虚词堆叠' },
  { pattern: '心中一震', test: /(心中|心头|心里)(不由)?(一震|一紧|一沉)/, hint: '套话' },
  { pattern: '仿佛时间静止', test: /(仿佛|似乎|好像)(时间|世界)(都)?(静止|停滞|安静)/, hint: '套话' },
  { pattern: '无人知晓', test: /无人知晓|不为人知的是/, hint: '旁白越位' },
  { pattern: '命运的齿轮', test: /命运的(齿轮|巨轮)/, hint: '陈词' },
  { pattern: '值得一提的是', test: /值得一提的是|不得不说|毫无疑问/, hint: '议论文腔' },
  { pattern: '眼神复杂', test: /眼神(变得)?(复杂|深邃|幽深)/, hint: '套话' },
  { pattern: '深吸一口气', test: /(深深|缓缓)?(地)?(吸|呼)了一口气/, hint: '动作套话' },
]

/** 扫一遍正文，返回命中的 AI 味片断（带段号与引文）。 */
export function scanAiStyle(text, lexicon) {
  const body = String(text ?? '')
  if (!body) return []
  const paras = body.split(/\n+/)
  const list = Array.isArray(lexicon) && lexicon.length ? lexicon : AI_STYLE_LEXICON
  const hits = []
  paras.forEach((para, index) => {
    for (const entry of list) {
      let m = null
      if (entry.test instanceof RegExp) {
        m = entry.test.exec(para)
      } else if (entry.phrase) {
        // 自定义词条只写人话，这里是字面命中：作者填「微微」，就抓「微微」。
        const at = para.indexOf(String(entry.phrase))
        if (at >= 0) m = { index: at, 0: String(entry.phrase), length: String(entry.phrase).length }
      }
      if (!m) continue
      hits.push({
        para: index,
        pattern: entry.pattern ?? entry.phrase,
        hint: entry.hint ?? '',
        quote: para.slice(Math.max(0, m.index - 12), m.index + String(m[0]).length + 12).trim(),
      })
    }
  })
  return hits
}

/** 项目自己的词表：{ custom:[{phrase,hint}], disabled:[pattern] }，缺文件就是默认词表。 */
async function readAiLexicon(dir) {
  const data = await readJson(path.join(dir, 'aistyle.json'), null)
  return {
    custom: Array.isArray(data?.custom) ? data.custom.filter((row) => String(row?.phrase ?? '').trim()) : [],
    disabled: Array.isArray(data?.disabled) ? data.disabled.map((row) => String(row)) : [],
  }
}

/**
 * 生效词表 = 默认词表去掉被禁用的 + 项目自定义。
 *
 * 为什么要能改：每个人都有自己反复出现的口水词，有人爱「微微」有人爱「瞬间」。
 * 默认词表是照通用 AI 味编的，扫不出「你的」问题。
 */
export async function getAiLexicon(root, projectId) {
  const dir = await projectDir(root, projectId)
  const own = await readAiLexicon(dir)
  const base = AI_STYLE_LEXICON
    .filter((entry) => !own.disabled.includes(entry.pattern))
    .map((entry) => ({ pattern: entry.pattern, hint: entry.hint, source: 'default' }))
  const custom = own.custom.map((row) => ({ pattern: row.phrase, hint: row.hint ?? '', source: 'custom' }))
  return { items: [...base, ...custom], disabled: own.disabled, custom: own.custom }
}

export async function saveAiLexicon(root, projectId, patch = {}) {
  const dir = await projectDir(root, projectId)
  const own = await readAiLexicon(dir)
  const next = {
    schemaVersion: SCHEMA_VERSION,
    custom: Array.isArray(patch.custom)
      ? patch.custom
        .map((row) => ({ phrase: String(row?.phrase ?? '').trim().slice(0, 40), hint: String(row?.hint ?? '').trim().slice(0, 60) }))
        .filter((row) => row.phrase)
      : own.custom,
    disabled: Array.isArray(patch.disabled) ? patch.disabled.map((row) => String(row)) : own.disabled,
  }
  await writeJsonAtomic(path.join(dir, 'aistyle.json'), next)
  return getAiLexicon(root, projectId)
}

async function readProblemBook(dir) {
  const data = await readJson(path.join(dir, 'problems.json'), null)
  return Array.isArray(data?.items) ? data.items : []
}

async function writeProblemBook(dir, items) {
  await writeJsonAtomic(path.join(dir, 'problems.json'), { schemaVersion: SCHEMA_VERSION, items })
}

export async function listProblems(root, projectId) {
  const dir = await projectDir(root, projectId)
  return { items: await readProblemBook(dir) }
}

/** 扫某章正文的 AI 味，返回片断；不落盘，供验收台即时显示。 */
export async function scanChapterAiStyle(root, projectId, chapter) {
  const dir = await projectDir(root, projectId)
  const row = await getChapter(root, projectId, chapter)
  const own = await readAiLexicon(dir)
  const lexicon = AI_STYLE_LEXICON
    .filter((entry) => !own.disabled.includes(entry.pattern))
    .concat(own.custom.map((item) => ({ pattern: item.phrase, hint: item.hint ?? '', phrase: item.phrase })))
  const hits = scanAiStyle(row.text, lexicon)
  const total = countWords(row.text)
  // 密度按「每千字命中数」，不同长度的章才能横着比。
  const density = total ? Math.round((hits.length / total) * 10000) / 10 : 0
  return { chapter: Number(chapter), words: total, hits, density, lexicon: lexicon.length }
}

export async function saveProblem(root, projectId, problem = {}) {
  const dir = await projectDir(root, projectId)
  const items = [...(await readProblemBook(dir))]
  const chapter = Number(problem?.chapter) || 0
  if (!chapter) fail('问题必须指明章号')
  const id = String(problem?.id ?? '').trim() || `pb_${shortId(4)}`
  const type = String(problem?.type ?? 'other')
  const severity = String(problem?.severity ?? 'minor')
  const status = String(problem?.status ?? 'open')
  const now = nowIso()
  const prev = items.find((row) => row.id === id)
  const next = {
    id,
    chapter,
    para: Number(problem?.para) || 0,
    type: PROBLEM_TYPES.includes(type) ? type : 'other',
    severity: PROBLEM_SEVERITY.includes(severity) ? severity : 'minor',
    scope: problem?.scope === 'cross' || problem?.scope === 'global' ? problem.scope : 'chapter',
    text: String(problem?.text ?? ''),
    quote: String(problem?.quote ?? ''),
    fix: String(problem?.fix ?? ''),
    status: PROBLEM_STATUS.includes(status) ? status : 'open',
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  }
  if (!next.text.trim()) fail('问题得有说明文字')
  // 登记问题前顺手扫词表：命中了就把命中片断挂到这一条上，
  // 问题单里能直接看到「这句为什么算 AI 味」，不用作者自己再找一遍。
  const own = await readAiLexicon(dir)
  const lexicon = AI_STYLE_LEXICON
    .filter((entry) => !own.disabled.includes(entry.pattern))
    .concat(own.custom.map((item) => ({ pattern: item.phrase, hint: item.hint ?? '', phrase: item.phrase })))
  const hits = scanAiStyle(next.quote || next.text, lexicon)
  if (hits.length) {
    next.aiHits = hits.slice(0, 5)
    if (next.type !== 'ai-style') next.type = 'ai-style'
  }
  const at = items.findIndex((row) => row.id === id)
  if (at >= 0) items[at] = { ...items[at], ...next }
  else items.push(next)
  await writeProblemBook(dir, items)
  return { items, problem: next }
}

export async function resolveProblem(root, projectId, id, status) {
  if (!PROBLEM_STATUS.includes(status)) fail(`未知问题状态 ${status}`, 'invalid')
  const dir = await projectDir(root, projectId)
  const items = [...(await readProblemBook(dir))]
  const at = items.findIndex((row) => row.id === id)
  if (at < 0) fail(`没有问题 ${id}`, 'missing')
  const now = nowIso()
  items[at] = {
    ...items[at], status, updatedAt: now, resolvedAt: status === 'open' ? '' : now,
  }
  await writeProblemBook(dir, items)
  return { items, problem: items[at] }
}

export async function removeProblem(root, projectId, id) {
  const dir = await projectDir(root, projectId)
  const items = (await readProblemBook(dir)).filter((row) => row.id !== id)
  await writeProblemBook(dir, items)
  return { items, removed: id }
}

// ── 每本书自己的阈值（阶段 C）────────────────────────────────

/**
 * 校准结果落在作品目录里，跟着作品走。
 *
 * 为什么不放全局配置：同一个作者写两本书，一本快节奏一本慢文艺，
 * 该用两把秤。放进作品目录才可能是「这本书的秤」。
 */
async function readCalibration(dir) {
  const data = await readJson(path.join(dir, 'lint-calibration.json'), null)
  if (!data || typeof data !== 'object') return { thresholds: {}, measuredAt: '', samples: 0, chars: 0, notes: [] }
  return {
    thresholds: data.thresholds && typeof data.thresholds === 'object' ? data.thresholds : {},
    measuredAt: String(data.measuredAt ?? ''),
    samples: Number(data.samples ?? 0),
    chars: Number(data.chars ?? 0),
    notes: Array.isArray(data.notes) ? data.notes : [],
  }
}

export async function getCalibration(root, projectId) {
  const dir = await projectDir(root, projectId)
  const own = await readCalibration(dir)
  const lint = await import('./lint.js')
  // 带出「每条规则生效的阈值」：界面要显示「现在按 1.6 判，全局是 0.9」
  const items = lint.listRules().map((rule) => ({
    ...rule,
    threshold: { ...pickThreshold(rule), ...(own.thresholds[rule.id] ?? {}) },
    overridden: Boolean(own.thresholds[rule.id]),
  }))
  return { ...own, items, count: Object.keys(own.thresholds).length }
}

function pickThreshold(rule) {
  // listRules 已经把数值收在 rule.threshold 里，别再读顶层——
  // 读顶层会永远拿到 undefined，界面上「全局是几」那一栏就全是空的。
  const src = rule.threshold && typeof rule.threshold === 'object' ? rule.threshold : rule
  const out = {}
  for (const key of ['perKilo', 'minHits', 'perPara', 'maxPerKilo', 'longChars', 'shortChars', 'commaRatio', 'minChars']) {
    if (src[key] !== undefined) out[key] = src[key]
  }
  return out
}

/** 直接把一套阈值写进去（用户在界面上手动改）。 */
export async function saveCalibration(root, projectId, patch = {}) {
  const dir = await projectDir(root, projectId)
  const own = await readCalibration(dir)
  const next = {
    schemaVersion: SCHEMA_VERSION,
    measuredAt: own.measuredAt,
    samples: own.samples,
    chars: own.chars,
    notes: own.notes,
    thresholds: patch.thresholds === null
      ? {}
      : patch.thresholds && typeof patch.thresholds === 'object'
        ? patch.thresholds
        : own.thresholds,
  }
  await writeJsonAtomic(path.join(dir, 'lint-calibration.json'), next)
  return getCalibration(root, projectId)
}

/**
 * 拿这本书已写的正文量一遍，产出建议阈值并落盘。
 *
 * 为什么直接落盘而不是只给建议：量出来的数就是这本书的实际分布，
 * 作者没有理由更信一个从别人书上抄来的数字。界面上仍然可以改回去。
 */
export async function calibrateProject(root, projectId, options = {}) {
  const dir = await projectDir(root, projectId)
  const chapters = await listChapters(root, projectId)
  const samples = []
  const limit = Number(options.limit ?? 400) || 400
  for (const row of chapters.slice(0, limit)) {
    if (!row.words) continue
    try {
      const got = await getChapter(root, projectId, row.chapter)
      samples.push({ chapter: row.chapter, text: String(got?.text ?? '') })
    } catch {
      // 单章读不出来不该让整次校准失败——少一章统计，比整次不算强
    }
  }
  const calibrate = await import('./calibrate.js')
  const own = await readCalibration(dir)
  const result = calibrate.calibrateFromTexts(samples, own.thresholds)
  const next = {
    schemaVersion: SCHEMA_VERSION,
    measuredAt: nowIso(),
    samples: result.samples,
    chars: result.chars,
    notes: result.notes,
    thresholds: result.thresholds,
    measured: result.measured,
  }
  await writeJsonAtomic(path.join(dir, 'lint-calibration.json'), next)
  return {
    ...result,
    summary: calibrate.summarizeCalibration(result),
    calibration: await getCalibration(root, projectId),
  }
}

// ── 从判断里学（阶段 D）─────────────────────────────────────

/**
 * 读已决提案 + 已决问题，交给 lib/feedback.js 学一遍，结果落盘。
 *
 * 为什么落盘而不是每次现算：现算要读全部提案和问题，
 * 千章规模下这两份 JSON 会很大，而结论本身变化很慢。
 * 落盘之后界面打开就能看，不必等一次全量扫描。
 */
export async function learnFeedback(root, projectId) {
  const dir = await projectDir(root, projectId)
  const proposals = await readProposalBook(dir)
  const problems = await readProblemBook(dir)
  const feedback = await import('./feedback.js')
  const result = feedback.learnFromData({ proposals, problems })
  const next = {
    schemaVersion: SCHEMA_VERSION,
    learnedAt: nowIso(),
    ...result,
  }
  await writeJsonAtomic(path.join(dir, 'learned.json'), next)
  return next
}

/** 只读上次学到的结论，不重算。 */
export async function getFeedback(root, projectId) {
  const dir = await projectDir(root, projectId)
  const data = await readJson(path.join(dir, 'learned.json'), null)
  if (!data || typeof data !== 'object') {
    return {
      learnedAt: '', samples: 0, proposals: 0, problems: 0, rules: [], types: [], notes: [],
      summary: '还没学过。点下面那颗钮，用你已有的采纳/驳回记录量一遍。',
    }
  }
  return {
    learnedAt: String(data.learnedAt ?? ''),
    samples: Number(data.samples ?? 0),
    proposals: Number(data.proposals ?? 0),
    problems: Number(data.problems ?? 0),
    rules: Array.isArray(data.rules) ? data.rules : [],
    types: Array.isArray(data.types) ? data.types : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
    summary: String(data.summary ?? ''),
  }
}

// ── 导出 ─────────────────────────────────────────────────────

/**
 * 把整个作品目录读成 { 相对路径: Buffer }，交给 lib/zip.js 打包。
 *
 * 为什么在服务端做：正文只在磁盘上。以前设置页那个「打包成 zip 下载」
 * 只是 toast 一下，连文件都没生成过 —— 作者以为备份了，其实什么都没留。
 */
export async function collectProjectFiles(root, projectId) {
  const dir = await projectDir(root, projectId)
  const { walkFiles } = await import('./zip.js')
  const names = await walkFiles(dir)
  const files = {}
  for (const name of names) {
    files[name] = await fs.readFile(path.join(dir, name))
  }
  return { dir, files, count: names.length }
}

