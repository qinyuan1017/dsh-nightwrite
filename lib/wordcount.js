/**
 * 长夜 · 字数口径（对齐 oh-story 的 scripts/wordcount_core.py）
 *
 * 为什么单独一个模块：字数在三处被算——章节清单、验收页实时字数、导出交付统计。
 * 三处各写一遍 replace(/\s+/g,'') 看着一样，但一旦有人加了「去掉标题行」「去掉
 * frontmatter」的规则，就会变成三个不同的数。读者看到的字数和作者报的字数不一致，
 * 是最没必要吵的一种架。
 *
 * 口径（visible_chars_v1）：
 *   1. 换行统一成 \n，去掉 BOM
 *   2. 若开头是 --- 包起来的 frontmatter（且里面有 key: value 行），整块去掉
 *   3. 去掉开头的空行
 *   4. 去掉第一行 ATX 标题（# 开头的章名行）——章名不是正文
 *   5. 剩余部分数「非空白字符」个数
 *
 * 第 4 条和第 2 条看起来像洁癖，但它们解决的是真问题：正文首行是「第 12 回 xxx」，
 * 那七个字算进正文字数，读者在阅读器里看到的总字数就会比作者报的多。
 */

export const WORDCOUNT_METRIC = 'visible_chars_v1'

const FRONTMATTER_KEY_RE = /^[A-Za-z_\u3400-\u9FFF][^:\n]{0,80}:[ \t]*(?:.*)$/
const LEADING_BLANK_RE = /^[\u0009\u0020\u3000]*$/
const ATX_HEADING_RE = /^[\u0009\u0020]{0,3}#{1,6}[\u0009\u0020]+\S/

const WHITE_SPACE = new Set([
  0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
])
for (let cp = 0x2000; cp <= 0x200a; cp += 1) WHITE_SPACE.add(cp)

function isWhiteSpace(code) {
  return WHITE_SPACE.has(code)
}

/** 去掉可识别的 frontmatter 块。认不出来就原样返回——宁可多算，不要错删正文。 */
export function stripFrontmatter(value) {
  const lines = String(value ?? '').split('\n')
  if (!lines.length || lines[0] !== '---') return String(value ?? '')
  let closing = -1
  const limit = Math.min(lines.length, 201)
  for (let i = 1; i < limit; i += 1) {
    if (lines[i] === '---' || lines[i] === '...') {
      closing = i
      break
    }
  }
  if (closing < 2) return String(value ?? '')
  if (!lines.slice(1, closing).some((line) => FRONTMATTER_KEY_RE.test(line)))
    return String(value ?? '')
  return lines.slice(closing + 1).join('\n')
}

/** 正文本体：去掉 frontmatter、开头空行、首个标题行。 */
export function visibleBody(value) {
  let text = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  if (text.startsWith('\ufeff')) text = text.slice(1)
  const lines = stripFrontmatter(text).split('\n')
  while (lines.length && LEADING_BLANK_RE.test(lines[0])) lines.shift()
  if (lines.length && ATX_HEADING_RE.test(lines[0])) lines.shift()
  return lines.join('\n')
}

/** 可见字符数。这是全项目唯一的口径。 */
export function countWords(text) {
  const body = visibleBody(text)
  let n = 0
  for (let i = 0; i < body.length; i += 1) {
    if (!isWhiteSpace(body.charCodeAt(i))) n += 1
  }
  return n
}

/** 逐项拆解，用来回答「为什么这个数是这个数」。 */
export function measure(text) {
  const raw = String(text ?? '')
  const body = visibleBody(raw)
  const total = countWords(raw)
  return {
    metric: WORDCOUNT_METRIC,
    words: total,
    rawLength: raw.length,
    bodyLength: body.length,
    trimmed: raw.length - body.length,
    paragraphs: body.split('\n').filter((line) => line.trim()).length,
  }
}

/** 字数分层：给交付统计用的区间。 */
export function band(words, target = 0) {
  const n = Number(words) || 0
  const t = Number(target) || 0
  if (!t) return { words: n, target: 0, ratio: 0, label: '未设目标' }
  const ratio = n / t
  let label = '达标'
  if (ratio < 0.7) label = '偏短'
  else if (ratio < 0.9) label = '略短'
  else if (ratio > 1.4) label = '偏长'
  else if (ratio > 1.15) label = '略长'
  return { words: n, target: t, ratio: Number(ratio.toFixed(3)), label }
}

/** 中文习惯的展示：一万以上折成 X.X 万。客户端 fmtWords 与这里必须同一套。 */
export function formatWords(n) {
  const num = Number(n) || 0
  if (num >= 10000) return `${(num / 10000).toFixed(1)} 万`
  return String(num)
}
