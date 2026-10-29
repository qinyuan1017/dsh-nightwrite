/**
 * 长夜 · 标点归一化（对齐 oh-story 的 scripts/normalize-punctuation.js）
 *
 * 为什么需要它：中文正文里手打/粘贴进来的省略号、破折号五花八门——
 *   …… / ... / 。。。 / —— / — / -- / ── / ---（markdown 分隔线）
 * 阅读器里这几种渲染宽度完全不同，读者一眼就看出「不专业」。这跟文笔无关，
 * 是排版问题，所以很适合交给脚本而不是交给模型。
 *
 * 三条刻意的设计：
 *   1. **只动标点，不动字**。不做同义词替换、不改句序、不动引号内容。
 *   2. **白名单优先**。书里故意用的写法（.deslop-whitelist 或作者词表）先屏蔽再处理。
 *   3. **默认不改就直接说明**。省略号用「……」还是「...」是风格选择，不替作者决定，
 *      除非显式传 style。
 *
 * 返回的每一处修改都带位置和前后文，界面还能「只改这一处」。
 */

/** 省略号风格：six = ……（中文标准），three = ...（西文三点）。 */
export const ELLIPSIS_STYLES = ['six', 'three']

function protectedSpans(text, whitelist) {
  const spans = []
  for (const word of whitelist) {
    if (!word) continue
    let from = 0
    for (;;) {
      const at = text.indexOf(word, from)
      if (at < 0) break
      spans.push([at, at + word.length])
      from = at + word.length
      if (spans.length > 4000) return spans
    }
  }
  return spans
}

function overlaps(spans, start, end) {
  for (const [a, b] of spans) {
    if (start < b && end > a) return true
  }
  return false
}

/** 规则表。order 决定先套谁——先处理长的，避免 -- 被破折号规则吃掉。 */
const RULES = [
  {
    id: 'md-divider',
    label: 'markdown 分隔线',
    note: '正文里的 --- / *** / ___ 分隔线，纯文本作品里是脏数据',
    test: /^[ \t]{0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm,
    replace: () => '',
  },
  {
    id: 'dash-triple',
    label: '三个以上连字符',
    note: '--- 当破折号用，读者看到的是三条横线',
    test: /-{2,}(?!-)|—{3,}|─{2,}/g,
    replace: () => '——',
  },
  {
    id: 'dash-ascii',
    label: '西文双连字符',
    note: '-- 是打字机习惯，中文排版里应该是 ——',
    test: /(?<!-)--(?!-)/g,
    replace: () => '——',
  },
  {
    id: 'ellipsis-dots',
    label: '英文三点省略',
    note: '... 在西文里是省略号，中文排版是 ……',
    test: /\.{3,}/g,
    replace: (style) => (style === 'three' ? '...' : '……'),
  },
  {
    id: 'ellipsis-cn',
    label: '中文句号当省略号',
    note: '。。。是输入法习惯，不是标点',
    test: /。{2,}/g,
    replace: (style) => (style === 'three' ? '...' : '……'),
  },
  {
    id: 'ellipsis-six',
    label: '六个点不统一',
    note: '……写成 ...... 或 ⋯⋯ 都要归一',
    test: /…{1,}|⋯{2,}/g,
    replace: (style) => (style === 'three' ? '...' : '……'),
  },
  {
    id: 'ellipsis-mixed',
    label: '省略号混排',
    note: '……。 / 。…… 这种叠用',
    test: /(…{2,}[。，、]|[。，、]…{2,})/g,
    replace: (match) => (match.endsWith('…') ? '……' : `${match[0]}……`),
  },
  {
    id: 'quote-straight',
    label: '直引号',
    note: '英文直引号 " 与中文弯引号 “” 混用',
    test: /"([^"\n]{1,400})"/g,
    replace: (style, match, inner) => `“${inner}”`,
  },
  {
    id: 'exclaim-repeat',
    label: '重复感叹/问号',
    note: '！！！ 与 ？？？ 在网络用语里能用，在正文里是噪音',
    test: /([！!？?]){3,}/g,
    replace: (style, match) => String(match[0]).replace(/!/g, '！').replace(/\?/g, '？'),
  },
  {
    id: 'comma-halfwidth',
    label: '半角逗号夹在中文里',
    note: '中文句子中间出现英文逗号',
    test: /([\u4e00-\u9fa5]),([\u4e00-\u9fa5])/g,
    replace: (style, match, a, b) => `${a}，${b}`,
  },
  {
    id: 'period-halfwidth',
    label: '半角句号夹在中文里',
    note: '中文句子结尾出现英文句号（缩写除外）',
    test: /([\u4e00-\u9fa5])\.(?=\s|$)/g,
    replace: (style, match, a) => `${a}。`,
  },
]

export function listNormalizeRules() {
  return RULES.map((rule) => ({ id: rule.id, label: rule.label, note: rule.note }))
}

/**
 * 检查并（可选）改写。
 *
 * @param {string} text 正文
 * @param {object} options
 *   whitelist: string[]      这些字面量不处理（书名、功法名、故意保留的写法）
 *   ellipsis: 'six'|'three'  省略号目标风格，默认 six
 *   only / skip: string[]    只跑 / 跳过某些规则 id
 *   apply: boolean           true = 返回改写后的文本；false = 只报告（默认）
 */
export function normalizeText(text, options = {}) {
  const raw = String(text ?? '')
  const whitelist = (Array.isArray(options.whitelist) ? options.whitelist : [])
    .map((w) => String(w ?? ''))
    .filter(Boolean)
  const spans = protectedSpans(raw, whitelist)
  const only = Array.isArray(options.only) && options.only.length ? new Set(options.only) : null
  const skip = new Set(Array.isArray(options.skip) ? options.skip : [])
  const style = ELLIPSIS_STYLES.includes(options.ellipsis) ? options.ellipsis : 'six'

  let working = raw
  const changes = []

  for (const rule of RULES) {
    if (skip.has(rule.id)) continue
    if (only && !only.has(rule.id)) continue
    const re = new RegExp(
      rule.test.source,
      rule.test.flags.includes('g') ? rule.test.flags : `${rule.test.flags}g`,
    )
    const patches = []
    let m = re.exec(working)
    while (m !== null) {
      const start = m.index
      const end = start + m[0].length
      if (!overlaps(spans, start, end)) {
        const next = rule.replace(style, m[0], ...m.slice(1))
        if (next !== m[0]) {
          patches.push({
            start,
            end,
            from: m[0],
            to: next,
            rule: rule.id,
            label: rule.label,
            para: lineOf(working, start),
            context: contextOf(working, start, end),
          })
        }
      }
      if (re.lastIndex === 0) break
      m = re.exec(working)
    }
    if (!patches.length) continue
    // 从后往前替换，前面的位置不会被打乱
    for (let i = patches.length - 1; i >= 0; i -= 1) {
      const p = patches[i]
      working = working.slice(0, p.start) + p.to + working.slice(p.end)
    }
    for (const p of patches) changes.push(p)
  }

  changes.sort((a, b) => a.start - b.start)
  const out = {
    changes,
    total: changes.length,
    byRule: Object.fromEntries(
      [...new Set(changes.map((c) => c.rule))].map((id) => [
        id,
        changes.filter((c) => c.rule === id).length,
      ]),
    ),
    ellipsis: style,
    applied: Boolean(options.apply),
    // preview 总是给「改完会是什么样」，text 只在 apply 时给。
    // 刻意不把 text 无条件赋成改后文：调用方忘了传 apply 却直接存 text，
    // 就等于静默改稿——那是最不该由一次笔误决定的事。
    preview: working,
  }
  if (options.apply) out.text = working
  return out
}

function lineOf(text, index) {
  let para = 0
  for (let i = 0; i < index && i < text.length; i += 1) if (text[i] === '\n') para += 1
  return para
}

function contextOf(text, start, end) {
  const from = Math.max(0, start - 12)
  const to = Math.min(text.length, end + 12)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}
