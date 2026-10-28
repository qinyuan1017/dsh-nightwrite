/**
 * 长夜 · 内容保真校验
 *
 * 解决什么问题：
 *   改写稿最容易出的不是文笔问题，是「事实被悄悄改了」——
 *   三年前变成五年前、张三写成张四、三百人变成三千人。
 *   这类错在通读时会被大脑自动补全，作者自己看不出来；
 *   而审校 agent 如果只读改后稿，也无从比对。
 *
 * 做法：拿改前/改后两份文本，抽出「不该变的东西」逐项比对：
 *   1. 数字（含中文数字）：保留率低于阈值就报警 —— 阈值默认 0.8，来自 LNW 的
 *      NUMBER_KEEP_RATIO，意为「改写可以调整措辞，但原文里的数字至少八成还得在」。
 *   2. 专有名词（人名/地名，从账本取）：出现次数骤降视为丢失。
 *   3. 引语（成对引号内的句子）：原样保留率。
 *   4. 段落数：暴增暴减提示结构被动了（不算错，只提示）。
 *
 * 只报告，不改稿。判定为 block 时由调用方决定要不要拦。
 */

/** 数字令牌：阿拉伯数字 + 常见中文数字串。会把「三百二十一」当一个整体。 */
const ARABIC_RE = /\d+(?:[.,]\d+)?/g
const CN_DIGIT = '零一二三四五六七八九十百千万亿两半'
const CN_NUM_RE = new RegExp(`[${CN_DIGIT}]+`, 'g')
/** 引语：中文双引号与直角引号都收。 */
const QUOTE_RE = /[“"「『]([^”"」』\n]{2,80})[”"」』]/g

/** 数字归一：全角转半角、去千分位、中文数字转成阿拉伯，便于比对。 */
const CN_MAP = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}
const CN_UNIT = { 十: 10, 百: 100, 千: 1000, 万: 10000, 亿: 100000000 }

export function cnToNumber(text) {
  const s = String(text ?? '')
  if (!s) return null
  // 「半」单独表示 0.5，只处理孤立出现
  if (s === '半') return 0.5
  let total = 0
  let section = 0
  let digit = 0
  let seen = false
  for (const ch of s) {
    if (Object.prototype.hasOwnProperty.call(CN_MAP, ch)) {
      digit = CN_MAP[ch]
      seen = true
      continue
    }
    const unit = CN_UNIT[ch]
    if (unit === undefined) return null
    seen = true
    if (unit >= 10000) {
      section = (section + (digit || 1)) * unit
      total += section
      section = 0
    } else {
      section += (digit || 1) * unit
    }
    digit = 0
  }
  if (!seen) return null
  return total + section + digit
}

/**
 * 抽数字令牌。返回 [{ raw, value }]，value 用来跨写法比对（「3」与「三」算同一个值）。
 * 「一半」「两下」这类量词化用法会被 value=null 过滤掉，避免误报。
 */
export function extractNumbers(text) {
  const body = String(text ?? '')
  const out = []
  for (const m of body.matchAll(ARABIC_RE)) {
    const raw = m[0]
    const value = Number(raw.replace(/,/g, ''))
    if (!Number.isFinite(value)) continue
    out.push({ raw, value, kind: 'arabic' })
  }
  for (const m of body.matchAll(CN_NUM_RE)) {
    const raw = m[0]
    if (raw.length > 8) continue
    const value = cnToNumber(raw)
    if (value === null || !Number.isFinite(value)) continue
    out.push({ raw, value, kind: 'cn' })
  }
  return out
}

/** 抽引语内容（去掉首尾空白）。 */
export function extractQuotes(text) {
  const body = String(text ?? '')
  const out = []
  for (const m of body.matchAll(QUOTE_RE)) {
    const q = String(m[1] ?? '').trim()
    if (q) out.push(q)
  }
  return out
}

/** 抽专名出现次数。names 是账本里的人名地名列表。 */
export function countNames(text, names = []) {
  const body = String(text ?? '')
  const rows = []
  for (const name of names) {
    const key = String(name ?? '').trim()
    if (!key) continue
    let count = 0
    let from = 0
    for (;;) {
      const at = body.indexOf(key, from)
      if (at < 0) break
      count += 1
      from = at + key.length
    }
    if (count > 0) rows.push({ name: key, count })
  }
  return rows
}

/** 段数：连续空行切段，非空段计数。 */
export function countParagraphs(text) {
  return String(text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length
}

const DEFAULT_RATIO = 0.8
const NAME_DROP_MIN = 0.5
const QUOTE_KEEP_MIN = 0.6

/**
 * 主入口。
 * @param {string} before 改前正文
 * @param {string} after 改后正文
 * @param {{ratio?: number, names?: string[], maxParagraphDrift?: number}} options
 * @returns {{
 *   level: 'ok' | 'warn' | 'block',
 *   text: string,
 *   numbers: {total: number, kept: number, ratio: number, lost: object[], added: object[]},
 *   names: {total: number, kept: number, ratio: number, lost: object[]},
 *   quotes: {total: number, kept: number, ratio: number, lost: string[]},
 *   paragraphs: {before: number, after: number, drift: number},
 *   issues: object[]
 * }}
 */
export function checkFidelity(before, after, options = {}) {
  const src = String(before ?? '')
  const dst = String(after ?? '')
  const ratioMin = Number(options.ratio) > 0 ? Number(options.ratio) : DEFAULT_RATIO
  const names = Array.isArray(options.names) ? options.names : []
  const maxDrift = Number(options.maxParagraphDrift) > 0 ? Number(options.maxParagraphDrift) : 0.6

  // ── 数字 ──
  const srcNums = extractNumbers(src)
  const dstNums = extractNumbers(dst)
  const dstValues = new Set(dstNums.map((row) => row.value))
  const keptNums = srcNums.filter((row) => dstValues.has(row.value))
  const srcValues = new Set(srcNums.map((row) => row.value))
  const lostNums = srcNums.filter((row) => !dstValues.has(row.value))
  const addedNums = dstNums.filter((row) => !srcValues.has(row.value))
  const numRatio = srcNums.length ? keptNums.length / srcNums.length : 1

  // ── 专名 ──
  const srcNames = countNames(src, names)
  const dstNameMap = new Map(countNames(dst, names).map((row) => [row.name, row.count]))
  const lostNames = []
  for (const row of srcNames) {
    const now = dstNameMap.get(row.name) ?? 0
    if (now / row.count < NAME_DROP_MIN) {
      lostNames.push({ name: row.name, before: row.count, after: now })
    }
  }
  const nameRatio = srcNames.length ? (srcNames.length - lostNames.length) / srcNames.length : 1

  // ── 引语 ──
  const srcQuotes = extractQuotes(src)
  const dstQuoteSet = new Set(extractQuotes(dst))
  const lostQuotes = srcQuotes.filter((q) => !dstQuoteSet.has(q))
  const quoteRatio = srcQuotes.length ? (srcQuotes.length - lostQuotes.length) / srcQuotes.length : 1

  // ── 段落 ──
  const pBefore = countParagraphs(src)
  const pAfter = countParagraphs(dst)
  const drift = pBefore ? Math.abs(pAfter - pBefore) / pBefore : (pAfter ? 1 : 0)

  const issues = []
  if (srcNums.length && numRatio < ratioMin) {
    issues.push({
      kind: 'numbers',
      level: 'block',
      text: `原文有 ${srcNums.length} 处数字，改后只剩 ${keptNums.length} 处——改文不能悄悄改事实。`,
    })
  } else if (lostNums.length && numRatio < 0.95) {
    issues.push({
      kind: 'numbers',
      level: 'warn',
      text: `有 ${lostNums.length} 处数字没保住（保留率 ${(numRatio * 100).toFixed(0)}%）：${lostNums.slice(0, 5).map((r) => r.raw).join('、')}`,
    })
  }
  if (lostNames.length) {
    issues.push({
      kind: 'names',
      level: lostNames.some((row) => row.after === 0) ? 'block' : 'warn',
      text: `有 ${lostNames.length} 个专名出现次数骤降：${lostNames.slice(0, 5).map((r) => `${r.name} ${r.before}→${r.after}`).join('、')}`,
    })
  }
  if (srcQuotes.length >= 3 && quoteRatio < QUOTE_KEEP_MIN) {
    issues.push({
      kind: 'quotes',
      level: 'warn',
      text: `对白被大改：原文 ${srcQuotes.length} 句引语，改后原样保留 ${srcQuotes.length - lostQuotes.length} 句。`,
    })
  }
  if (drift > maxDrift) {
    issues.push({
      kind: 'paragraphs',
      level: 'warn',
      text: `段落数从 ${pBefore} 变成 ${pAfter}（变动 ${(drift * 100).toFixed(0)}%）——如果只是改句子，这个幅度偏大。`,
    })
  }

  const level = issues.some((row) => row.level === 'block')
    ? 'block'
    : issues.length
      ? 'warn'
      : 'ok'
  const headline = level === 'ok'
    ? '事实没被动：数字、专名、引语都对得上。'
    : level === 'block'
      ? `有改动动了事实（${issues.filter((r) => r.level === 'block').length} 项），建议退回重改。`
      : `有 ${issues.length} 处需要注意，但不构成事实错误。`

  return {
    level,
    text: headline,
    numbers: {
      total: srcNums.length,
      kept: keptNums.length,
      ratio: Number(numRatio.toFixed(3)),
      lost: lostNums.slice(0, 40),
      added: addedNums.slice(0, 40),
    },
    names: {
      total: srcNames.length,
      kept: srcNames.length - lostNames.length,
      ratio: Number(nameRatio.toFixed(3)),
      lost: lostNames,
    },
    quotes: {
      total: srcQuotes.length,
      kept: srcQuotes.length - lostQuotes.length,
      ratio: Number(quoteRatio.toFixed(3)),
      lost: lostQuotes.slice(0, 20),
    },
    paragraphs: { before: pBefore, after: pAfter, drift: Number(drift.toFixed(3)) },
    issues,
  }
}

export const FIDELITY_NUMBER_RATIO = DEFAULT_RATIO
