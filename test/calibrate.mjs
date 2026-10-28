/**
 * 长夜 · 规则校准器
 *
 * 24 条规则的阈值（perPara / perKilo / minHits / longChars）现在是我拍出来的数字。
 * 拍出来的数字有两个问题：可能太松（脏稿子照样过），可能太严（干净稿子被误报）。
 * 靠"我觉得还行"没法回答这个，只能拿真的稿子去跑，看每条规则在干净文本上的命中密度。
 *
 * 这个脚本干三件事：
 *   1. 把书稿（默认扫所有作品的 chapters/*.txt，也可以指定目录）逐章跑一遍规则。
 *   2. 按规则统计：命中章数 / 总章数（覆盖率）、每千字命中数（密度）、命中分布分位。
 *   3. 给出建议阈值：
 *      - blocking 规则只要在 ≥30% 的章里出现，就说明它误报率高 → 建议降级为 advisory。
 *      - advisory 规则如果 90 分位密度低于当前阈值的一半，说明它永远不会触发 → 建议调紧。
 *      - 从不命中的规则标 DEAD（要么文本太干净，要么正则有 bug）。
 *
 * 用法：
 *   node test/calibrate.mjs                    扫默认数据目录
 *   node test/calibrate.mjs <dir>              扫指定目录（递归找 *.txt / *.md）
 *   node test/calibrate.mjs <dir> --json       机器可读输出
 *   node test/calibrate.mjs <dir> --min 20     少于 20 章就提示样本不足
 *
 * 它是只读的：不改任何规则，只输出证据和建议。改不改由人决定。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import * as lint from '../lib/lint.js'

const CORPUS_EXT = new Set(['.txt', '.md'])

/** 递归找文本稿。跳过历史版本、回收站、备份——那些不是"正常写作的样本"。 */
async function collectFiles(dir, out = []) {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // 历史版本/回收站里的稿子是同一批内容的重复样本，会把密度算歪
      if (entry.name === 'history' || entry.name === '.trash' || entry.name === 'node_modules') continue
      await collectFiles(full, out)
    } else if (entry.isFile() && CORPUS_EXT.has(path.extname(entry.name).toLowerCase())) {
      // 备份文件不算
      if (/\.bak[-.]/.test(entry.name)) continue
      out.push(full)
    }
  }
  return out
}

function defaultCorpus() {
  const root = process.env.NIGHTWRITE_ROOT
    || path.join(os.homedir(), '.dsh', 'data', 'dsh-nightwrite')
  return root
}

function quantile(sorted, q) {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

function round(n, digits = 2) {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

/** 每条规则的有效阈值：不同规则用不同字段，这里统一取出来便于比较。 */
function thresholdOf(rule) {
  const x = rule
  if (x.perKilo !== undefined) return { field: 'perKilo', value: x.perKilo }
  if (x.perPara !== undefined) return { field: 'perPara', value: x.perPara }
  if (x.maxPerKilo !== undefined) return { field: 'maxPerKilo', value: x.maxPerKilo }
  if (x.commaRatio !== undefined) return { field: 'commaRatio', value: x.commaRatio }
  if (x.longChars !== undefined) return { field: 'longChars', value: x.longChars }
  return { field: '—', value: null }
}

/**
 * 一条规则 0 命中，有两种完全不同的含义，不能混着报。
 *
 *   CLEAN  —— 好事。硬拦规则在干净稿上就该是 0，这正是我们要的。
 *   SILENT —— 坏事。提示规则 0 命中意味着它永远不会开口，等于没写。
 *
 * 靠什么区分：拿一段「本来就该命中」的探针文本跑一遍这条规则。
 * 探针命中 = 正则没坏 = 这本书确实干净；探针不命中 = 正则写坏了。
 */
const PROBES = {
  'not-is': '他不是生气，而是失望。',
  'reverse-not-is': '他放下了，不是不想争。他没说话，并非无话可说。',
  'em-dash': '他说——然后停住——又笑——还是没说。',
  'negation-parade': '没有风。没有光。没有声音。没有一个人。',
  telegram: '他站。她看。风停。雨落。门开。刀出。',
  'trailer-summary': '这一切，才刚刚开始。他不知道的是，命运已经转向。而这，只是开始。',
  'meta-chapter': '这一章里，他没有说话。如前所述，事情很复杂。',
  'meta-craft': '这个伏笔要留到后面回收，人设不能崩。',
  'meta-notice': '【提示】读者会喜欢这里。',
  'period-stutter': '他走了。他停了。他看了看。他坐下。他站起。他说。他笑。',
  'long-paragraph': '字'.repeat(260),
  'micro-action-tic': '他点了点头。他摇了摇头。他皱了皱眉。他叹了口气。他深吸一口气。他抿了抿嘴。他捏了捏眉心。他揉了揉太阳穴。',
  'stock-reaction': '心中一凛，瞳孔一缩，倒吸一口凉气，心中一凛，瞳孔一缩。',
  'action-list': '他先抬手，然后转身，接着迈步，最后停下，又回头。',
  'abstract-summary': '一种说不出的感觉。难以言喻的滋味。莫名的烦躁。说不清道不明的情绪。无法形容的失落。',
  'cliche-density': '空气仿佛凝固。时间静止。万籁俱寂。鸦雀无声。落针可闻。目光如炬。气势如虹。嘴角勾起。眼底闪过。' + '不由得。不由自主。'.repeat(3),
  'metaphor-density': '像风一样，像雨一样，像刀一样，像火一样。',
  'quote-emphasis': '所谓“成功”，所谓“努力”，所谓“命运”，所谓“选择”，所谓“爱”，所谓“恨”，所谓“生”，所谓“死”，所谓“光”，所谓“暗”，所谓“真”，所谓“假”。',
  'low-connective': '天亮了。他起身。推门。外面很冷。他缩手。回屋。'.repeat(30),
  'whitespace-mess': '他走了。   她来了。\n\n\n\n他又走了。',
  'reasoning-chain': '因为天下大雨，所以他没出门，于是他在家读书，因此他考中了。',
  'punctuation-mess': '他说！！真的吗？？不可能！！！',
  'formulaic-parallel': '他要权力，要地位，要名声，要财富，要一切；他要权力，要地位，要名声，要财富，要一切；他要权力，要地位，要名声，要财富，要一切。',
  overcompressed: '他，走了，然后，她，来了，接着，他，坐下，最后，他，沉默了，很久，很久，没有，说话，一直，等到，天黑。',
  'degenerate-placeholder': '此处省略三千字。以下省略。待补。TODO。',
  'degenerate-punct-tail': '他走了----------------',
  'degenerate-repeat-punct': '他走了！！！！！！！！！！',
  'degenerate-repeat-sent': '他把碗放下，抬头看了眼灰蒙蒙的天。\n他把碗放下，抬头看了眼灰蒙蒙的天。\n他把碗放下，抬头看了眼灰蒙蒙的天。',
}

function probeAlive(rule) {
  const probe = PROBES[rule.id]
  if (!probe) return null // 没有探针，无从判断
  try {
    return lint.checkText(probe).hits.some((hit) => hit.id === rule.id)
  } catch {
    return false
  }
}

async function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const minIdx = args.indexOf('--min')
  const minChapters = minIdx >= 0 ? Number(args[minIdx + 1]) || 0 : 0
  const positional = args.filter((a, i) => !a.startsWith('--') && !(minIdx >= 0 && i === minIdx + 1))
  const dir = positional[0] || defaultCorpus()

  const files = await collectFiles(dir)
  if (!files.length) {
    console.error(`没有找到稿子：${dir}`)
    console.error('用法：node test/calibrate.mjs <dir>   （递归找 *.txt / *.md）')
    process.exit(2)
  }

  // 逐章跑规则，累计每条的命中的段落次数（不是 hit 数——一条规则在同一段命中三次
  // 和命中一次，对"这段有没有这个问题"是同一件事）
  const perRule = new Map()
  for (const rule of lint.RULES) {
    perRule.set(rule.id, {
      rule,
      chaptersHit: 0,
      paras: 0,
      hits: 0,
      density: [], // 每章每千字命中数，用于分位
    })
  }

  let totalChars = 0
  let chapters = 0
  const parseErrors = []

  for (const file of files) {
    let text
    try {
      text = await fs.readFile(file, 'utf8')
    } catch (error) {
      parseErrors.push(`${file}: ${error.message}`)
      continue
    }
    if (!text.trim()) continue
    chapters += 1
    totalChars += text.length

    let result
    try {
      result = lint.checkText(text)
    } catch (error) {
      parseErrors.push(`${file}: ${error.message}`)
      continue
    }

    const byId = new Map()
    for (const hit of result.hits) {
      if (!byId.has(hit.id)) byId.set(hit.id, new Set())
      byId.get(hit.id).add(hit.para)
    }
    const kilo = Math.max(1, text.length / 1000)

    for (const rule of lint.RULES) {
      const acc = perRule.get(rule.id)
      const paras = byId.get(rule.id)
      const paraCount = paras ? paras.size : 0
      acc.hits += paraCount
      acc.paras += result.hits.filter((h) => h.id === rule.id).length
      if (paraCount > 0) acc.chaptersHit += 1
      acc.density.push(paraCount / kilo)
    }
  }

  const rows = []
  for (const acc of perRule.values()) {
    const { rule } = acc
    const coverage = chapters ? acc.chaptersHit / chapters : 0
    const densities = acc.density.slice().sort((a, b) => a - b)
    const p50 = quantile(densities, 0.5)
    const p90 = quantile(densities, 0.9)
    const p99 = quantile(densities, 0.99)
    const max = densities.length ? densities[densities.length - 1] : 0
    const th = thresholdOf(rule)

    let verdict = 'OK'
    let suggest = ''
    if (acc.chaptersHit === 0) {
      // 0 命中要先分清「稿子干净」和「正则坏了」，这两件事的处置完全相反。
      const alive = probeAlive(rule)
      if (alive === null) {
        verdict = 'NO-PROBE'
        suggest = '样本里 0 命中，且这条规则没有探针文本可自检 → 补一条探针，否则无法判断是干净还是写坏了。'
      } else if (alive) {
        // 探针能命中 = 正则没问题 = 样本确实干净
        verdict = rule.severity === 'blocking' ? 'CLEAN' : 'SILENT'
        suggest = rule.severity === 'blocking'
          ? '探针能命中、样本 0 命中——硬拦在干净稿上本就该是 0，这条正常。'
          : `探针能命中、但 ${chapters} 章真实稿子里 0 次。提示规则不说话就等于没写：要么这个毛病在中文网文里本来就罕见，要么阈值定得离谱。先确认它值不值得留。`
      } else {
        verdict = 'BROKEN'
        suggest = '探针文本本该命中却 0 命中 → 这条规则的正则写坏了，不是稿子的问题。'
      }
    } else if (rule.severity === 'blocking' && coverage >= 0.3) {
      // blocking 的核心要求是"没有例外"。三成的章都命中，说明它有例外。
      verdict = 'TOO-LOOSE'
      suggest = `覆盖 ${Math.round(coverage * 100)}% 的章，作为硬拦误报率太高 → 建议降级为 advisory，或收窄正则。`
    } else if (th.value !== null && th.field === 'perKilo' && p90 > 0 && th.value > p90 * 3) {
      verdict = 'TOO-STRICT'
      suggest = `阈值 ${th.value}/千字，但样本 90 分位只有 ${round(p90)}/千字 → 这个阈值永远不会触发，建议降到 ${round(Math.max(p90 * 1.5, 0.5))}。`
    } else if (th.value !== null && th.field === 'perKilo' && p90 > 0 && th.value < p90 * 0.6) {
      verdict = 'NOISY'
      suggest = `阈值 ${th.value}/千字低于样本 90 分位 ${round(p90)}/千字 → 正常稿子也会频繁命中，建议提到 ${round(p90 * 1.2)}。`
    }

    rows.push({
      id: rule.id,
      label: rule.label,
      severity: rule.severity,
      review: rule.review,
      threshold: th.value,
      field: th.field,
      chaptersHit: acc.chaptersHit,
      coverage: round(coverage, 3),
      hits: acc.hits,
      perKiloAvg: round(totalChars ? (acc.hits / (totalChars / 1000)) : 0, 3),
      p50: round(p50),
      p90: round(p90),
      p99: round(p99),
      max: round(max),
      verdict,
      suggest,
    })
  }

  // 排序：会咬人的排前面。CLEAN 是正常状态，沉到最后。
  const order = { BROKEN: 0, 'TOO-LOOSE': 1, NOISY: 2, 'TOO-STRICT': 3, SILENT: 4, 'NO-PROBE': 5, OK: 6, CLEAN: 7 }
  rows.sort((a, b) => (order[a.verdict] ?? 9) - (order[b.verdict] ?? 9) || b.coverage - a.coverage)

  const summary = {
    dir,
    chapters,
    totalChars,
    rules: lint.RULES.length,
    blocking: lint.RULES.filter((r) => r.severity === 'blocking').length,
    advisory: lint.RULES.filter((r) => r.severity !== 'blocking').length,
    // 需要动手的：正则坏了、硬拦太松、阈值吵。CLEAN/SILENT/OK 都不算问题。
    problems: rows.filter((r) => ['BROKEN', 'TOO-LOOSE', 'NOISY', 'TOO-STRICT'].includes(r.verdict)).length,
    silent: rows.filter((r) => r.verdict === 'SILENT').length,
    clean: rows.filter((r) => r.verdict === 'CLEAN').length,
    parseErrors,
    rows,
  }

  if (json) {
    console.log(JSON.stringify(summary, null, 2))
    return
  }

  console.log(`\n扫描目录：${dir}`)
  console.log(`章数：${chapters}　字数：${totalChars}`)
  console.log(`规则：${summary.rules} 条（硬拦 ${summary.blocking} / 提示 ${summary.advisory}）`)
  if (minChapters && chapters < minChapters) {
    console.log(`⚠ 样本只有 ${chapters} 章，少于 ${minChapters} 章，结论仅供参考`)
  }
  if (parseErrors.length) {
    console.log(`⚠ ${parseErrors.length} 个文件没读成：`)
    for (const line of parseErrors.slice(0, 5)) console.log(`   ${line}`)
  }

  const bad = rows.filter((r) => ['BROKEN', 'TOO-LOOSE', 'NOISY', 'TOO-STRICT'].includes(r.verdict))
  if (!bad.length) {
    console.log('\n没有需要动的规则：正则都能命中，硬拦没有过松，阈值也不吵。')
  } else {
    console.log(`\n有 ${bad.length} 条要改：`)
    for (const row of bad) {
      console.log(`\n[${row.verdict}] ${row.id} · ${row.label}`)
      console.log(`  档位 ${row.severity}/${row.review}　阈值 ${row.threshold ?? '—'}${row.field !== '—' ? ` (${row.field})` : ''}`)
      console.log(`  命中 ${row.chaptersHit}/${chapters} 章（覆盖 ${Math.round(row.coverage * 100)}%）　每千字 ${row.perKiloAvg}`)
      console.log(`  分位 p50 ${row.p50} / p90 ${row.p90} / p99 ${row.p99} / max ${row.max}`)
      console.log(`  建议：${row.suggest}`)
    }
  }

  const silent = rows.filter((r) => r.verdict === 'SILENT')
  if (silent.length) {
    console.log(`\n${silent.length} 条提示规则在这批稿子里一次没说话（正则没问题，是没这毛病）：`)
    for (const row of silent) {
      console.log(`  · ${row.id} ${row.label}`)
    }
  }

  const clean = rows.filter((r) => r.verdict === 'CLEAN')
  if (clean.length) {
    console.log(`\n${clean.length} 条硬拦在样本上 0 命中——这是好事，它们在干净稿上就该闭嘴：`)
    console.log(`  ${clean.map((r) => r.id).join(' / ')}`)
  }

  const ok = rows.filter((r) => r.verdict === 'OK' || r.verdict === 'NO-PROBE')
  if (ok.length) {
    console.log(`\n${ok.length} 条表现正常：${ok.map((r) => r.id).join(' / ')}`)
  }
  console.log('')
}

main().catch((error) => {
  console.error('校准器自己炸了：', error?.stack || error?.message || error)
  process.exit(1)
})
