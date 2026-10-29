/**
 * 长夜 · 段落地址系统
 *
 * 解决什么问题：
 *   现在采纳提案靠 `text.indexOf(before)` —— 拿一段原文去正文里找。
 *   这有三个躲不开的后果：
 *     1. 作者在采纳之前改了个错别字（哪怕只改了同一段里的另一个字），
 *        这段 before 就找不到了，所有待采纳的提案一起作废。
 *     2. 同一句话在正文里出现两次时，永远改第一处。
 *     3. 提案失效之后没有痕迹——它只是「missed 一条」，作者不知道
 *        是自己改过了、还是提案本来就写错了。
 *
 * 做法：给每个段落一个稳定地址。
 *   pid   = c<章号 4 位>p<段号 2 位起>        例：c0012p03
 *   hash  = 该段正文 sha1 的前 12 位
 *   地址 = { pid, hash }
 *
 *   提案保存时记下目标地址与「当时的段文」；采纳时按 pid 定位段落：
 *     · pid 存在且 hash 相同 → 命中（原文没动过）
 *     · pid 存在但 hash 不同 → 段落被改过，用「段内 before 唯一匹配 + 段内上下文」
 *       再试一次：能对上就改（记为 drifted），对不上就标 outdated（失效）
 *     · pid 不存在（段被删了 / 章号变了）→ outdated
 *
 * 为什么 hash 只算段文，不算前后文：
 *   算前后文会让「上一段改了」把下一段也判失效，等于没解决问题。
 *   段内定位已经足够：作者真正在意的粒度是「这句台词在第三段」。
 *
 * 为什么用 sha1 前 12 位：
 *   段落是短文本，12 位 hex = 48 位，一章几十段，碰撞概率可以忽略；
 *   而完整 sha1 写进 JSON 只是让文件变长，读起来也不方便人工核对。
 */

import { createHash } from 'node:crypto'
import { splitParas } from './lint.js'

/** 段落地址索引文件的版本；结构变了要升，老文件会被重建。 */
export const ANCHOR_SCHEMA = 1

/** 段号显示宽度：一章最多 999 段足够。 */
const PID_PAD = 2

/** 段文 hash：sha1 前 12 位 hex。空白归一后再算，避免缩进差异导致误判失效。 */
export function hashParagraph(text) {
  const body = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return createHash('sha1').update(body, 'utf8').digest('hex').slice(0, 12)
}

/** 生成段落地址。 */
export function paraId(chapter, index) {
  const c = String(Math.floor(Number(chapter) || 0)).padStart(4, '0')
  const p = String(Math.max(0, Math.floor(Number(index) || 0))).padStart(PID_PAD, '0')
  return `c${c}p${p}`
}

/** 解析地址：c0012p03 → { chapter: 12, index: 3 }；不合法返回 null。 */
export function parseParaId(pid) {
  const m = /^c(\d{4})p(\d{2,4})$/.exec(String(pid ?? ''))
  if (!m) return null
  return { chapter: Number(m[1]), index: Number(m[2]) }
}

/**
 * 建立段落索引：把一章正文切段，给每段一个地址。
 * @param {number} chapter
 * @param {string} text
 * @returns {{chapter: number, schema: number, paras: Array<{pid: string, index: number, hash: string, chars: number, head: string}>}}
 */
export function buildIndex(chapter, text) {
  const paras = splitParas(String(text ?? ''))
  return {
    chapter: Number(chapter) || 0,
    schema: ANCHOR_SCHEMA,
    paras: paras.map((row) => ({
      pid: paraId(chapter, row.para),
      index: row.para,
      hash: hashParagraph(row.text),
      chars: row.text.replace(/\s+/g, '').length,
      // head 存前 24 字，给界面显示「这条提案指哪一段」，也方便人眼核对
      head: row.text.slice(0, 24),
    })),
  }
}

/** 全章快速哈希：章节整体变没变。用于判断索引是否过期。 */
export function chapterHash(text) {
  return createHash('sha1')
    .update(String(text ?? ''), 'utf8')
    .digest('hex')
    .slice(0, 12)
}

/**
 * 把一段 before 文本定位到段落地址。
 *
 * 为什么保存提案时就要定位：等到采纳时才定位，正文早可能变了，
 * 那时候连「作者当初指的是哪一段」都无从知道。保存时记下来，才有比对的基础。
 *
 * @param {number} chapter
 * @param {string} text 当前正文
 * @param {string} before 提案里的原文片段
 * @returns {{pid: string|null, hash: string|null, index: number, hits: number}}
 */
export function locateText(chapter, text, before) {
  const needle = String(before ?? '')
  const paras = splitParas(String(text ?? ''))
  if (!needle.trim()) return { pid: null, hash: null, index: -1, hits: 0 }
  const hits = []
  for (const row of paras) {
    if (row.text.includes(needle)) hits.push(row)
  }
  if (!hits.length) return { pid: null, hash: null, index: -1, hits: 0 }
  const first = hits[0]
  return {
    pid: paraId(chapter, first.para),
    hash: hashParagraph(first.text),
    index: first.para,
    hits: hits.length,
  }
}

/**
 * 按地址在正文里找回目标段落。
 * @returns {{ok: boolean, reason?: string, index: number, para?: string, drifted?: boolean}}
 */
export function resolveAnchor(text, anchor) {
  const pid = String(anchor?.pid ?? '')
  const want = String(anchor?.hash ?? '')
  const parsed = parseParaId(pid)
  if (!parsed) return { ok: false, reason: 'bad-pid', index: -1 }
  const paras = splitParas(String(text ?? ''))
  const row = paras[parsed.index]
  if (!row) return { ok: false, reason: 'para-gone', index: parsed.index }
  const hash = hashParagraph(row.text)
  if (hash === want) return { ok: true, index: parsed.index, para: row.text, drifted: false }
  return {
    ok: false,
    reason: 'drifted',
    index: parsed.index,
    para: row.text,
    drifted: true,
    hash,
    want,
  }
}

/**
 * 在指定段落里做替换。
 *
 * 只在目标段内找，不跨段——这是地址系统带来的核心好处：
 * 就算同一句话在别处也出现，也不会改错地方。
 *
 * @returns {{text: string, replaced: boolean, reason?: string}}
 */
export function replaceInPara(text, anchor, before, after) {
  const src = String(text ?? '')
  const beforeText = String(before ?? '')
  const afterText = String(after ?? '')
  const found = resolveAnchor(src, anchor)
  if (!found.ok && found.reason !== 'drifted') {
    return { text: src, replaced: false, reason: found.reason }
  }
  const paras = splitParas(src)
  const row = paras[found.index]
  if (!row) return { text: src, replaced: false, reason: 'para-gone' }
  if (!beforeText.trim()) return { text: src, replaced: false, reason: 'empty-before' }
  if (!row.text.includes(beforeText)) {
    return { text: src, replaced: false, reason: 'not-in-para' }
  }
  const nextPara = row.text.replace(beforeText, afterText)
  // 按 splitParas 的切分方式还原：段落是按 \n 切的，行号即 index。
  const lines = src.split('\n')
  let seen = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue
    seen += 1
    if (seen === found.index) {
      lines[i] = nextPara
      break
    }
  }
  return { text: lines.join('\n'), replaced: true }
}

/**
 * 判断一条提案是否已经失效。
 *
 * 调用时机：读提案列表时批量打标（不改盘上数据），以及采纳前做最终确认。
 * @returns {'live' | 'drifted' | 'outdated'}
 */
export function anchorStatus(text, anchor) {
  const found = resolveAnchor(text, anchor)
  if (found.ok) return 'live'
  if (found.reason === 'drifted') return 'drifted'
  return 'outdated'
}

/**
 * 给一批提案打上新鲜度标记（只在内存里加字段，不落盘）。
 * @param {string} text 当前正文
 * @param {object[]} diffs 提案的 diffs 数组
 */
export function annotateDiffs(text, diffs = []) {
  const body = String(text ?? '')
  return (Array.isArray(diffs) ? diffs : []).map((row) => {
    const before = String(row?.before ?? '')
    const anchor = row?.anchor
    if (!anchor?.pid) {
      // 老提案没有地址：只能问「这句还在不在正文里」。
      return { ...row, fresh: 'unlinked', applicable: Boolean(before) && body.includes(before) }
    }
    const found = resolveAnchor(body, anchor)
    const status = found.ok ? 'live' : found.reason === 'drifted' ? 'drifted' : 'outdated'
    // 段落还在但内容变了（drifted）不一定就不能改：得看那句 before 还是不是原文。
    // 这一步不能省 —— 只看 drifted 会把「段里改了别处」误报成失效。
    const applicable = Boolean(before) && Boolean(found.para) && String(found.para).includes(before)
    return { ...row, fresh: status, applicable, anchor }
  })
}
