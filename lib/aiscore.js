/**
 * 长夜 · AI 味评分（0–100）
 *
 * 为什么光有「命中几条」不够：
 *   现在 checkText 报的是「命中 7 条」，可是 7 条里是「一段里两个破折号」还是
 *   「整章都是复读」，严重程度差着量级。作者看到数字 7 无从判断该整章重跑还是改个标点。
 *   打分解决的是「能不能发」这个决策，不是「哪里错了」——后者仍然看逐条命中。
 *
 * 打分方式（刻意简单，可解释）：
 *   每类信号先算「每千字密度」，再除以该类自己的容忍线，得到 0~1 的吃满程度，
 *   乘该类权重后相加，最后 ×100。所以 0 = 这项一点没有，100 = 每类都远超容忍线。
 *   分档：≤30 干净（可直接发）/ ≤55 需要过一遍 / ≤75 该整章修 / >75 建议重写。
 *
 * 为什么阈值是「每千字」不是「每章」：
 *   一章 3000 字有 3 处破折号和一章 8000 字有 8 处，后者文字更长但同样密。
 *   按章计数会让长篇天然吃亏，作者就会把短章写长来躲分数——那不是改进。
 *
 * 为什么不直接抄 LNW 的权重：
 *   LNW 的 8 类信号是给它的 28 条规则配的，长夜的规则表不同（多了退化四组、
 *   少了它的 markdown 信号）。这里按长夜自己的规则重新分组，权重从「读者最先注意
 *   到什么」排：复读/占位 > 元叙述 > 句式雷同 > 密度类。
 */

import { RULES, RULE_GROUPS, measureText, withThreshold } from './lint.js'
import * as config from './config.js'

/**
 * 信号定义：把 28 条规则归成 6 类，每类一个容忍线（每千字允许几次）与权重。
 * 权重合计 100，方便直接理解成「占了多少分」。
 */
export const SCORE_SIGNALS = [
  {
    id: 'degenerate',
    label: '退化',
    weight: 26,
    tolerance: 0.5,
    note: '复读、占位语、标点塌陷。这一类出现就说明模型跑偏了，不是文笔问题。',
    rules: ['degenerate-placeholder', 'degenerate-punct-tail', 'degenerate-repeat-punct', 'degenerate-repeat-sent'],
  },
  {
    id: 'meta',
    label: '元叙述泄漏',
    weight: 20,
    tolerance: 0.2,
    note: '「本章」「伏笔」「读者」这类工作台的话漏进了故事。出现一次就很扎眼。',
    rules: ['meta-chapter', 'meta-craft', 'meta-notice'],
  },
  {
    id: 'formula',
    label: '句式公式',
    weight: 20,
    tolerance: 1.2,
    note: '对偶否定、倒装否定、否定排比、音量反差。读三章就能认出是同一个模子。',
    rules: ['not-is', 'reverse-not-is', 'negation-parade', 'formulaic-parallel'],
  },
  {
    id: 'density',
    label: '密度失衡',
    weight: 16,
    tolerance: 1.6,
    note: '比喻、套词、解释链、微动作复读。单个不刺眼，堆起来就假。',
    rules: ['metaphor-density', 'cliche-density', 'reasoning-chain', 'micro-action-tic', 'stock-reaction', 'action-list', 'abstract-summary'],  },
  {
    id: 'ending',
    label: '收尾偷懒',
    weight: 10,
    tolerance: 0.6,
    note: '章末总结体、预告式收尾。读者最容易被这里劝退。',
    rules: ['trailer-summary', 'overcompressed'],
  },
  {
    id: 'hygiene',
    label: '排版卫生',
    weight: 8,
    tolerance: 3,
    note: '破折号、电报体、长段、碎句号、标点混乱。机械可修，不动故事。',
    rules: ['em-dash', 'telegram', 'long-paragraph', 'period-stutter', 'punctuation-mess', 'whitespace-mess', 'quote-emphasis', 'low-connective'],
  },
]

export const SCORE_BANDS = [
  { max: 30, level: 'clean', label: '干净', text: '可以直接发。剩下的都是口味问题，不是毛病。' },
  { max: 55, level: 'tidy', label: '过一遍', text: '有可改的地方，但不用重写。按报告里排前面的两类改。' },
  { max: 75, level: 'rework', label: '该整章修', text: '不是改句子能解决的了，先按细纲把这一章重排一遍。' },
  { max: 100, level: 'rewrite', label: '建议重写', text: '这一章的毛病是成片的，逐句改会越改越乱。重写更快。' },
]

/**
 * 允许直接落盘的分数上限（默认值）。与 LNW 的 AISTYLE_MAX 对齐。
 *
 * 运行时真正的阈值读 config.getRuntimeConfig().scorePassMax ——
 * 「多少分算超标」和书有关：悬疑对碎句的容忍度比言情低，冷硬派比甜宠低。
 * 这个常量保留成默认值，也给测试与文档一个稳定引用点。
 */
export const SCORE_PASS_MAX = 30

/**
 * 密度计算的分母下限（千字）。
 *
 * 为什么要这个下限：密度 = 次数 ÷ 千字。一段 120 字的样本里出现 1 处命中，
 * 密度就是 8.3 次/千字，直接吃满权重线，于是一段干净的对话被打成 20 分。
 * 那不是作者的问题，是样本太小。把分母钉在 1 千字以上，等于承认
 * 「一千字以内出现一次，不足以证明作者有这个毛病」。
 * 整章（3000 字）不受影响；贴片段打分也不会被误判。
 */
const MIN_KILO = 1.0

/** 样本字数低于这个值时，分数只当参考。 */
export const SCORE_CONFIDENT_CHARS = 800

function bandOf(score) {
  for (const band of SCORE_BANDS) if (score <= band.max) return band
  return SCORE_BANDS[SCORE_BANDS.length - 1]
}

/** 从密度算吃满程度：超过容忍线即封顶 1，不给无限加分（否则一条规则刷满全 100）。 */
function saturation(density, tolerance) {
  if (!(tolerance > 0)) return density > 0 ? 1 : 0
  return Math.min(1, density / tolerance)
}

/**
 * 主入口：给一段正文打 0–100 的 AI 味分。
 * @param {string} text
 * @param {{whitelist?: string[], thresholds?: object, skip?: string[]}} options
 * @returns {{
 *   score: number,
 *   pass: boolean,
 *   level: string,
 *   label: string,
 *   text: string,
 *   chars: number,
 *   signals: object[],
 *   worst: object|null,
 *   hits: object[]
 * }}
 */
export function scoreText(text, options = {}) {
  const raw = String(text ?? '')
  const maskedChars = raw.replace(/\s+/g, '').length
  const measured = measureText(raw, options)
  const kilo = Math.max(maskedChars / 1000, MIN_KILO)
  // 阈值按书可调：调用方传了就用它，否则读运行时配置（apply 时从插件 Config 写进来）。
  const passMax = Number.isFinite(options.passMax)
    ? Number(options.passMax)
    : Number(config.getRuntimeConfig().scorePassMax ?? SCORE_PASS_MAX)
  const skip = new Set(Array.isArray(options.skip) ? options.skip : [])
  const ruleMap = new Map(RULES.map((rule) => [rule.id, withThreshold(rule, options.thresholds?.[rule.id])]))

  const signals = SCORE_SIGNALS.map((signal) => {
    let count = 0
    const detail = []
    for (const id of signal.rules) {
      if (skip.has(id)) continue
      if (!ruleMap.has(id)) continue
      const n = Number(measured.rules?.[id]?.count ?? 0)
      if (!n) continue
      count += n
      detail.push({ id, label: ruleMap.get(id).label, count: n })
    }
    const density = count / kilo
    const fill = saturation(density, signal.tolerance)
    return {
      id: signal.id,
      label: signal.label,
      note: signal.note,
      weight: signal.weight,
      tolerance: signal.tolerance,
      count,
      density: Number(density.toFixed(2)),
      fill: Number(fill.toFixed(3)),
      points: Number((fill * signal.weight).toFixed(2)),
      detail,
    }
  })

  const total = signals.reduce((sum, row) => sum + row.points, 0)
  const score = Math.max(0, Math.min(100, Math.round(total)))
  const band = bandOf(score)
  const worst = signals.slice().sort((a, b) => b.points - a.points)[0] ?? null

  return {
    score,
    pass: score <= passMax,
    passMax,
    level: band.level,
    label: band.label,
    text: band.text,
    chars: maskedChars,
    confident: maskedChars >= SCORE_CONFIDENT_CHARS,
    signals,
    worst: worst && worst.points > 0 ? worst : null,
    hits: Object.values(measured.rules ?? {}).map((row) => ({ id: row.id, count: row.count })).filter((row) => row.count > 0),
  }
}

/** 给界面用的一句话结论。 */
export function describeScore(result) {
  if (!result) return ''
  const head = `${result.score} 分 · ${result.label}`
  if (!result.worst) return `${head}。没有明显 AI 痕迹。`
  return `${head}。主要来自「${result.worst.label}」${result.worst.count} 处（每千字 ${result.worst.density} 次）。`
}

/** 所有分组名（前端分组筛选用）。 */
export function listScoreSignals() {
  return SCORE_SIGNALS.map((row) => ({
    id: row.id,
    label: row.label,
    note: row.note,
    weight: row.weight,
    tolerance: row.tolerance,
    rules: row.rules.slice(),
  }))
}

/** 与 lint 的分组表对齐（某些 UI 要同时显示两套）。 */
export function scoreGroupLabels() {
  return Object.fromEntries(Object.entries(RULE_GROUPS).map(([id, row]) => [id, row.label]))
}
