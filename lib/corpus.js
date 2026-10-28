/**
 * 长夜 · 自己的语料池（阶段 B）
 *
 * 为什么要这个东西：我们的检测器现在是「按我的感觉定的阈值」。
 * 一个规则说「每千字超过 6 次就算吵」，这个 6 是我拍的，不是量出来的。
 * oh-story 那份 449K 语料硬的地方不在字多，在于它的阈值是从 5584 章真人文本里量出来的。
 * 我们要追平，唯一的办法是量自己的样本。
 *
 * 三条数据来源，全部干净：
 *   self    —— 作者自己写过的正文（最值钱：目标语体就是他自己的语体）
 *   public  —— 公版书（民国以前，无版权）
 *   owned   —— 已获授权/已购买的作品，仅本地统计，不导出正文
 *
 * 设计上的三条自律：
 *   1. 只存「切章后的正文」与「统计数字」，不存拆书结论——结论会过时，正文不会。
 *   2. 一本书只存一份，用内容哈希去重：同一本书从两个路径加进来不会算两本。
 *   3. metrics 按「规则 × 书」摊平，便于跨书求分位数；不做跨书合并的正文语料库。
 */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import * as lint from './lint.js'
import { withLock } from './lock.js'

export const CORPUS_SCHEMA = 1
export const CORPUS_DIR = 'corpus'
export const SOURCE_KINDS = ['self', 'public', 'owned']

/** 追平 oh-story 统计量级所需要的章节数（它 5584 章）。 */
export const TARGET_CHAPTERS = 5584
/** 一本 200 章量级的书大约这么多章。 */
export const BOOK_CHAPTERS = 214

const fail = (message, code = 'invalid') => {
  const error = new Error(message)
  error.code = code
  throw error
}

const round = (n, digits = 2) => {
  const base = 10 ** digits
  return Math.round(n * base) / base
}

export async function corpusDir(root) {
  const dir = path.join(root, CORPUS_DIR)
  await fs.mkdir(path.join(dir, 'samples'), { recursive: true })
  return dir
}

async function readJson(file, fallback) {
  try {
    const text = await fs.readFile(file, 'utf8')
    const value = JSON.parse(text)
    return value ?? fallback
  } catch {
    return fallback
  }
}

async function writeJson(file, value) {
  const tmp = `${file}.${process.pid}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, file)
}

const bookIndex = (dir) => path.join(dir, 'books.json')
const metricsFile = (dir) => path.join(dir, 'metrics.json')

/**
 * 切章。与 lib/import.js 的识别规则保持同一套，
 * 但这里不要求章标题规范——语料只要能切出段来就能统计。
 */
const CH_RE = /^\s*(?:第\s*[0-9〇零一二三四五六七八九十百千两]{1,8}\s*[章回节]|楔子|序章|引子|尾声|番外)/

export function splitChapters(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const out = []
  let cur = null
  for (const line of lines) {
    if (CH_RE.test(line)) {
      if (cur && cur.body.trim()) out.push(cur)
      cur = { title: line.trim().slice(0, 60), body: '' }
    } else if (cur) {
      cur.body += `${line}\n`
    }
  }
  if (cur && cur.body.trim()) out.push(cur)
  if (!out.length) {
    const whole = String(text ?? '').trim()
    if (whole) out.push({ title: '（未分章）', body: whole })
  }
  return out
}

/**
 * 量一本书。
 *
 * 只算数字，不判断好坏——语料池不该有自己的品味，
 * 它只提供「真人写作时这些规则每千字出现几次」这个事实。
 *
 * @returns {{chapters:number, chars:number, kilo:number, rules:object[]}}
 */
export function measureBook(text, { whitelist = [] } = {}) {
  const chapters = splitChapters(text)
  const joined = chapters.map((c) => c.body).join('\n')
  const chars = joined.replace(/\s+/g, '').length
  const kilo = chars / 1000
  const result = lint.checkText(joined, { whitelist })
  const perRule = new Map()
  for (const hit of result.hits) {
    const stat = perRule.get(hit.id) ?? { id: hit.id, hits: 0 }
    stat.hits += 1
    perRule.set(hit.id, stat)
  }
  // 每条规则都要有记录，没命中的记 0——否则算分位数时会被漏掉
  const rules = lint.listRules().map((rule) => {
    const hits = perRule.get(rule.id)?.hits ?? 0
    return {
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      hits,
      kilo: kilo > 0 ? round(hits / kilo, 3) : 0,
      perChapter: chapters.length ? round(hits / chapters.length, 3) : 0,
    }
  })
  return { chapters: chapters.length, chars, kilo: round(kilo, 1), rules }
}

/** 内容哈希：同一本书换路径加进来不会算两本。 */
const hashText = (text) => createHash('sha1').update(String(text ?? '')).digest('hex').slice(0, 12)

/**
 * 收一本书进语料池。
 *
 * @param {string} root
 * @param {{name:string, text:string, source?:string, note?:string}} input
 */
export async function addBook(root, input = {}) {
  // 读-改-写整体串行；键是「这本书的语料目录」，不是单个文件——
  // 新增语料要同时改索引和指标两份 JSON，只锁一份等于没锁。
  return withLock(path.join(await corpusDir(root)), () => addBookInner(root, input))
}

async function addBookInner(root, input = {}) {
  const name = String(input.name ?? '').trim()
  const text = String(input.text ?? '')
  if (!name) fail('书要有名字')
  if (!text.trim()) fail('正文是空的')
  const source = SOURCE_KINDS.includes(input.source) ? input.source : 'self'
  const dir = await corpusDir(root)
  const hash = hashText(text)

  const books = await readJson(bookIndex(dir), [])
  const exist = books.find((row) => row.id === hash)
  if (exist) {
    return { book: exist, duplicate: true, message: `这本已经在池子里了（${exist.name}），没有重复计算。` }
  }

  const measured = measureBook(text)
  await fs.writeFile(path.join(dir, 'samples', `${hash}.txt`), text, 'utf8')

  const book = {
    id: hash,
    hash,
    name,
    source,
    note: String(input.note ?? '').slice(0, 200),
    chapters: measured.chapters,
    chars: measured.chars,
    addedAt: new Date().toISOString(),
  }
  books.push(book)
  await writeJson(bookIndex(dir), books)

  // metrics 按「书 × 规则」摊平，跨书求分位数时直接读
  const metrics = await readJson(metricsFile(dir), [])
  for (const row of measured.rules) {
    metrics.push({
      book: hash,
      name,
      rule: row.id,
      hits: row.hits,
      kilo: row.kilo,
      perChapter: row.perChapter,
      chapters: measured.chapters,
    })
  }
  await writeJson(metricsFile(dir), metrics)

  return { book, duplicate: false, measured, message: `收了《${name}》：${measured.chapters} 章 / ${measured.chars} 字。` }
}

export async function listBooks(root) {
  const dir = await corpusDir(root)
  const books = await readJson(bookIndex(dir), [])
  const totalChapters = books.reduce((sum, row) => sum + Number(row.chapters ?? 0), 0)
  const totalChars = books.reduce((sum, row) => sum + Number(row.chars ?? 0), 0)
  const bySource = {}
  for (const kind of SOURCE_KINDS) {
    const rows = books.filter((row) => row.source === kind)
    bySource[kind] = { books: rows.length, chapters: rows.reduce((s, r) => s + Number(r.chapters ?? 0), 0) }
  }
  return {
    books: books.map((row) => ({
      ...row,
      // 这本书等于几个「200 章量级样本」
      weight: round(Number(row.chapters ?? 0) / BOOK_CHAPTERS, 2),
    })),
    totals: {
      books: books.length,
      chapters: totalChapters,
      chars: totalChars,
      bySource,
      // 距离追平 oh-story 统计量还差多少
      target: TARGET_CHAPTERS,
      gap: Math.max(0, TARGET_CHAPTERS - totalChapters),
      progress: round(Math.min(1, totalChapters / TARGET_CHAPTERS), 3),
      booksNeeded: Math.max(0, Math.ceil((TARGET_CHAPTERS - totalChapters) / BOOK_CHAPTERS)),
    },
  }
}

export async function removeBook(root, id) {
  // 读-改-写整体串行；键是「这本书的语料目录」，不是单个文件——
  // 新增语料要同时改索引和指标两份 JSON，只锁一份等于没锁。
  return withLock(path.join(await corpusDir(root)), () => removeBookInner(root, id))
}

async function removeBookInner(root, id) {
  const dir = await corpusDir(root)
  const books = await readJson(bookIndex(dir), [])
  const at = books.findIndex((row) => row.id === id)
  if (at < 0) fail('池子里没有这本', 'missing')
  const [gone] = books.splice(at, 1)
  await writeJson(bookIndex(dir), books)
  const metrics = await readJson(metricsFile(dir), [])
  await writeJson(metricsFile(dir), metrics.filter((row) => row.book !== id))
  await fs.rm(path.join(dir, 'samples', `${id}.txt`), { force: true })
  return { removed: id, name: gone.name }
}

/** 分位数：给一组数字取 p 分位（线性插值）。 */
function quantile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * 从语料池量出全局阈值建议。
 *
 * 方法：对每条规则取「每本书的 kilo」，求 p90 与 p50。
 * 建议阈值 = p90 × 1.2（留一档余量），并给样本数，
 * 样本不足时明确说「别拿这个当真」。
 */
export async function deriveThresholds(root, { minBooks = 3 } = {}) {
  // 读-改-写整体串行；键是「这本书的语料目录」，不是单个文件——
  // 新增语料要同时改索引和指标两份 JSON，只锁一份等于没锁。
  return withLock(path.join(await corpusDir(root)), () => deriveThresholdsInner(root, { minBooks }))
}

async function deriveThresholdsInner(root, { minBooks = 3 } = {}) {
  const dir = await corpusDir(root)
  const books = await readJson(bookIndex(dir), [])
  const metrics = await readJson(metricsFile(dir), [])
  const byRule = new Map()
  for (const row of metrics) {
    const list = byRule.get(row.rule) ?? []
    list.push(Number(row.kilo ?? 0))
    byRule.set(row.rule, list)
  }

  const out = []
  for (const rule of lint.listRules()) {
    const values = byRule.get(rule.id) ?? []
    if (values.length < minBooks) {
      out.push({
        id: rule.id,
        label: rule.label,
        books: values.length,
        enough: false,
        note: `只有 ${values.length} 本书的样本，不足 ${minBooks} 本，暂时别拿它定阈值。`,
      })
      continue
    }
    const p50 = quantile(values, 0.5)
    const p90 = quantile(values, 0.9)
    const suggested = round(Math.max(p90 * 1.2, 0.1), 2)
    const current = Number(rule.perKilo ?? rule.maxPerKilo ?? 0)
    out.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      books: values.length,
      p50: round(p50, 2),
      p90: round(p90, 2),
      suggested,
      current,
      // 阈值比语料 p90 还低，说明这条会天天报警
      noisy: current > 0 && current < p90,
      enough: true,
    })
  }
  return {
    books: books.length,
    rules: out,
    summary: books.length >= minBooks
      ? `用 ${books.length} 本书量出了 ${out.filter((r) => r.enough).length} 条规则的阈值。`
      : `池子里只有 ${books.length} 本书，还不够 ${minBooks} 本。先把书写进来，阈值才有意义。`,
  }
}

/** 把量出来的阈值写进某本书的校准文件（阶段 C 的入口）。 */
export async function applyToCalibration(root, projectId, { only = [], minBooks = 3 } = {}) {
  const derived = await deriveThresholds(root, { minBooks })
  const thresholds = {}
  for (const row of derived.rules) {
    if (!row.enough) continue
    if (only.length && !only.includes(row.id)) continue
    thresholds[row.id] = { perKilo: row.suggested, minHits: Math.max(2, Math.round(row.suggested * 3)) }
  }
  const count = Object.keys(thresholds).length
  return { thresholds, count, derived, message: count ? `按语料量出 ${count} 条阈值。` : '语料还不够，这次没量出任何阈值。' }
}
