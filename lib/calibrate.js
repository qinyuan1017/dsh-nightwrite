/**
 * 长夜 · 每本书自己的那套阈值
 *
 * 全局阈值是拿 214 章真稿校准出来的，它回答的是「多数人多数时候」。
 * 但密度这件事跟作品强相关：历史文承接词天然多，快节奏爽文天然少；
 * 有的作者就是不写比喻，硬套全局阈值，他每章都会被报三条。
 *
 * 所以这里做的事很简单：拿这本书自己的稿子量一遍，量出它自己的分布，
 * 再拿分布去修正阈值——不是拍脑袋调松紧，是有数可查。
 *
 * 一条硬规矩：只调数值，不动正则、不动分类。
 * 改数值是换一把更适合这作品的秤；改正则就是改了尺子上的刻度定义。
 */
import * as lint from './lint.js'

/** 一条规则在整本书里的密度分布（逐章算，不是整本一次算）。 */
function distribution(samples, ruleId) {
  const values = samples
    .map((row) => {
      const hit = row.rules[ruleId]
      if (!hit) return 0
      const kilo = Math.max(row.chars / 1000, 0.1)
      return hit.count / kilo
    })
    .sort((a, b) => a - b)
  const n = values.length
  if (!n) return { n: 0, p50: 0, p75: 0, p90: 0, max: 0, mean: 0 }
  const at = (q) => values[Math.min(n - 1, Math.floor(q * (n - 1)))]
  const sum = values.reduce((acc, v) => acc + v, 0)
  return { n, p50: at(0.5), p75: at(0.75), p90: at(0.9), max: values[n - 1], mean: sum / n }
}

/** 一条规则在多少比例的章节里会响。响得太频繁 = 这条对它没区分度。 */
function fireRate(samples, ruleId) {
  if (!samples.length) return 0
  const hit = samples.filter((row) => (row.rules[ruleId]?.count ?? 0) > 0).length
  return hit / samples.length
}

const round1 = (n) => Math.round(n * 10) / 10

/**
 * 从这本书的章节里量出建议阈值。
 *
 * @param {Array<{chapter:number,text:string}>} chapters
 * @param {object} [current] 已有的覆盖，量不出来时保留它
 * @returns {{samples:number,chars:number,thresholds:object,notes:object[],measured:object}}
 */
export function calibrateFromTexts(chapters = [], current = {}) {
  const samples = []
  for (const row of chapters) {
    const text = String(row?.text ?? '')
    if (!text.trim()) continue
    const measured = lint.measureText(text)
    if (measured.chars < 200) continue // 太短的章统计没意义，会把密度算飞
    samples.push({ chapter: Number(row?.chapter ?? 0), chars: measured.chars, rules: measured.rules })
  }

  const thresholds = { ...current }
  const notes = []
  const measured = {}

  if (samples.length < 5) {
    return {
      samples: samples.length,
      chars: samples.reduce((acc, row) => acc + row.chars, 0),
      thresholds,
      notes: [{
        rule: '',
        level: 'warn',
        text: `只量到 ${samples.length} 章（至少 5 章、每章 200 字以上才够）。样本太少时算出来的阈值比不调更糟——这次不改。`,
      }],
      measured,
    }
  }

  for (const rule of lint.RULES) {
    const dist = distribution(samples, rule.id)
    const rate = fireRate(samples, rule.id)
    measured[rule.id] = { ...dist, rate: round1(rate * 10) / 10 }

    if (!dist.max) {
      // 整本书一次都没出现过：量不出分布，只能记一笔「这条对你没用」
      notes.push({
        rule: rule.id,
        level: 'idle',
        text: `${rule.label}：这本书 ${samples.length} 章里一次都没命中。阈值保留全局值——没数据就不该乱调。`,
      })
      continue
    }

    const patch = {}
    if (rule.severity === 'blocking') {
      // 硬拦的判据是「能不能容忍它被拦下来」。
      // 硬拦规则在超过 40% 的章节里出现，说明作者就是这个写法——
      // 每章都拦等于每章都在吵架，人会把整条规则关掉，那反而更糟。
      if (rate >= 0.4) {
        notes.push({
          rule: rule.id,
          level: 'loud',
          text: `${rule.label}：${Math.round(rate * 100)}% 的章都会触发硬拦。这是这本书的基本写法，不是偶发失误——建议改判为提示（改分类要你点头，我不自动改）。`,
        })
      } else if (rate <= 0.02 && dist.p90 > 0) {
        notes.push({
          rule: rule.id,
          level: 'ok',
          text: `${rule.label}：只在 ${Math.round(rate * 100)}% 的章出现，硬拦设置合适。`,
        })
      }
      // 硬拦规则本身没有数值阈值可调（它就是要拦），所以不写 patch
      if (Object.keys(patch).length) thresholds[rule.id] = { ...(thresholds[rule.id] ?? {}), ...patch }
      continue
    }

    // 提示类规则才有密度阈值：把「这本书的正常水平」当基线，留 20% 余量。
    // 用 p75 而不是 p90：p90 会把作者写在兴头上的那几章也算进基线，阈值被抬高后真正跑偏反而漏报。
    if (rule.minHits || rule.perKilo) {
      const base = dist.p75 > 0 ? dist.p75 : dist.p50
      const suggested = Math.max(round1(base * 1.2), round1(dist.p90 * 0.8))
      const globalValue = Number(rule.perKilo ?? 0)
      if (globalValue && Math.abs(suggested - globalValue) / globalValue >= 0.25) {
        patch.perKilo = suggested
        notes.push({
          rule: rule.id,
          level: suggested > globalValue ? 'loose' : 'tight',
          text: `${rule.label}：这本书的 90 分位是 ${round1(dist.p90)}/千字，全局阈值 ${globalValue}。建议改成 ${suggested}——${suggested > globalValue ? `这本书写得比全局阈值更密，按全局值会天天误报（约 ${Math.round(rate * 100)}% 的章会被点到）` : '这本书写得比全局阈值更疏，按全局值会几乎不报'}。`,
        })
      }
    }
    if (Object.keys(patch).length) thresholds[rule.id] = { ...(thresholds[rule.id] ?? {}), ...patch }
  }

  return {
    samples: samples.length,
    chars: samples.reduce((acc, row) => acc + row.chars, 0),
    thresholds,
    notes,
    measured,
  }
}

/** 把建议写成一句人话总结，给界面标题用。 */
export function summarizeCalibration(result) {
  if (!result?.samples) return '还没量过这本书。至少要有 5 章、每章 200 字以上。'
  const tight = result.notes.filter((row) => row.level === 'tight').length
  const loose = result.notes.filter((row) => row.level === 'loose').length
  const loud = result.notes.filter((row) => row.level === 'loud').length
  const parts = [`量了 ${result.samples} 章共 ${result.chars} 字`]
  if (tight) parts.push(`${tight} 条会误报，已按本书调松`)
  if (loose) parts.push(`${loose} 条几乎不报，已按本书调紧`)
  if (loud) parts.push(`${loud} 条硬拦在这本书里太常触发，建议改判提示`)
  if (!tight && !loose && !loud) parts.push('这本书的密度跟全局阈值基本一致，不用改')
  return parts.join('；') + '。'
}
