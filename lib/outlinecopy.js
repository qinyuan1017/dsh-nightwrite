/**
 * 长夜 · 细纲照搬检测（对齐 oh-story 的 scripts/check-outline-copy.js）
 *
 * 治的病：细纲本来只该锁「这一章发生什么」，但很多人（和模型）会顺手把情节点
 * 写成成品散文句。等到写正文时，最好的那几句已经在细纲里写完了，正文只剩誊抄，
 * 质量被锁死在细纲水平。oh-story 实测：正文与细纲连续重合最高 13.5%、
 * 单段最长 40 字，且重合段落多为叙述而不是台词。
 *
 * 判定：正文与同章细纲里任意一段连续重合超过阈值就报出来。
 * 为什么是「连续重合」而不是「词面相同」：系统面板、任务要求、固定专名本来就该
 * 一致，逐词比对会把这些全报成问题，最后没人看报告。连续 N 字重合才说明是抄句子。
 *
 * 刻意不做的事：**不自动重写**。同 check-ai-patterns 一样只提供证据——位置 + 片段，
 * 改不改、怎么改要读上下文判断。机械改写的下场是把本来该一致的地方也改坏。
 */

/** 默认阈值：连续重合多少字算「抄」。15 字约等于一个完整短句。 */
export const COPY_MIN_CHARS = 15

/** 单次最多报多少条，防止把界面淹掉。 */
const MAX_HITS = 60

function normChar(ch) {
  // 只做「同字判定」需要的归一：全角半角标点互换、空白折叠。
  // 不动字形本身——把「他」和「她」归一就等于承认抄了。
  if (ch === '\u3000' || ch === '\t') return ' '
  if (ch === '\r') return ''
  if (ch === '“' || ch === '”' || ch === '「' || ch === '」') return '"'
  if (ch === '‘' || ch === '’' || ch === '「' || ch === '」') return "'"
  if (ch === '，') return ','
  if (ch === '。') return '.'
  if (ch === '！') return '!'
  if (ch === '？') return '?'
  if (ch === '：') return ':'
  if (ch === '；') return ';'
  if (ch === '、') return ','
  return ch
}

/** 去掉空白与换行，把文本压成一条可比较的串，同时记下每个字符在原文的位置。 */
function squeeze(text) {
  const raw = String(text ?? '')
  const chars = []
  const positions = []
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    const mapped = normChar(ch)
    if (mapped === '') continue
    if (mapped === ' ') continue
    chars.push(mapped)
    positions.push(i)
  }
  return { flat: chars.join(''), positions, raw }
}

/** 把一段长文本切成「候选对比单元」：按段落切，短段合并。 */
function segments(text) {
  const out = []
  let offset = 0
  for (const line of String(text ?? '').split('\n')) {
    const trimmed = line.trim()
    if (trimmed) out.push({ text: trimmed, offset, line })
    offset += line.length + 1
  }
  return out
}

/**
 * 找正文与细纲的连续重合。
 *
 * @param {string} body 正文
 * @param {string|string[]} outline 细纲（可以是一条字符串，也可以是多个字段拼起来）
 * @param {object} options { minChars, max }
 * @returns {{hits:Array, total:number, ratio:number, minChars:number, bodyChars:number, outlineChars:number}}
 */
export function findOutlineCopy(body, outline, options = {}) {
  const minChars = Math.max(6, Number(options.minChars) || COPY_MIN_CHARS)
  const max = Math.max(1, Number(options.max) || MAX_HITS)

  const outlineText = Array.isArray(outline) ? outline.filter(Boolean).join('\n') : String(outline ?? '')
  const bodyParas = segments(body)
  const outlineParas = segments(outlineText)

  const hits = []
  let duplicated = 0

  for (const para of bodyParas) {
    const b = squeeze(para.text)
    if (b.flat.length < minChars) continue
    let best = null

    for (const cand of outlineParas) {
      const o = squeeze(cand.text)
      if (o.flat.length < minChars) continue
      // 滚动窗口找最长公共子串（对小段落足够快；正文单段一般 < 500 字）
      const match = longestCommon(b.flat, o.flat, minChars)
      if (!match) continue
      if (!best || match.length > best.length) {
        best = { length: match.length, bStart: match.bStart, oStart: match.oStart, cand }
      }
    }

    if (best) {
      const startChar = best.bStart
      const endChar = best.bStart + best.length
      const from = b.positions[startChar]
      const to = b.positions[Math.min(endChar, b.positions.length) - 1] + 1
      duplicated += best.length
      hits.push({
        para: bodyParas.indexOf(para),
        offset: from,
        length: to - from,
        quote: para.text.slice(Math.max(0, from - 8), Math.min(para.text.length, to + 8)),
        copied: b.raw.slice(from, to),
        chars: best.length,
        outlineLine: best.cand.line,
      })
      if (hits.length >= max) break
    }
  }

  const bodyChars = squeeze(String(body ?? '')).flat.length || 1
  return {
    hits,
    total: hits.length,
    ratio: Number((duplicated / bodyChars).toFixed(4)),
    duplicatedChars: duplicated,
    bodyChars,
    outlineChars: squeeze(outlineText).flat.length,
    minChars,
  }
}

/** 最长公共子串；短于 min 就不算。返回在两条串里的起点。 */
function longestCommon(a, b, min) {
  const n = a.length
  const m = b.length
  if (!n || !m) return null
  // 只保留上一行，O(min(n,m)) 内存
  let prev = new Uint16Array(m + 1)
  let cur = new Uint16Array(m + 1)
  let best = 0
  let bestA = 0
  let bestB = 0
  for (let i = 1; i <= n; i += 1) {
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= m; j += 1) {
      if (ca === b.charCodeAt(j - 1)) {
        const v = prev[j - 1] + 1
        cur[j] = v
        if (v > best) {
          best = v
          bestA = i - v
          bestB = j - v
        }
      } else {
        cur[j] = 0
      }
    }
    const swap = prev
    prev = cur
    cur = swap
    cur.fill(0)
  }
  if (best < min) return null
  return { length: best, bStart: bestA, oStart: bestB }
}

/** 章级判定：给一句人话结论，界面直接用。 */
export function judge(result, options = {}) {
  const warn = Number(options.warnChars) || 30
  if (!result.total) return { level: 'ok', text: '正文与细纲没有连续重合，这一章是自己写的。' }
  if (result.hits.some((h) => h.chars >= warn)) {
    return {
      level: 'block',
      text: `有 ${result.total} 处与细纲连续重合，最长 ${Math.max(...result.hits.map((h) => h.chars))} 字。这不是「保持一致」，是把细纲的句子搬进了正文。`,
    }
  }
  return {
    level: 'warn',
    text: `有 ${result.total} 处与细纲连续重合（最长 ${Math.max(...result.hits.map((h) => h.chars))} 字），占比 ${(result.ratio * 100).toFixed(1)}%。看一眼是不是固定专名/面板文案。`,
  }
}
