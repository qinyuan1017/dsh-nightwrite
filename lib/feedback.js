/**
 * 长夜 · 从「采纳 / 驳回」里学阈值（阶段 D）
 *
 * 出发点很朴素：作者每天在界面上做几十次判断——这条提案采纳、那条驳回，
 * 这个毛病已修、那个无视。这些动作本身就是标注，只是以前全被丢掉了。
 *
 * 学什么：
 *   1. 提案里的改动片段（before/after）被采纳还是被驳回 → 说明作者认不认这种改法
 *   2. 问题单的类型被修掉还是被无视 → 说明作者在不在乎这类毛病
 *
 * 不学什么（这条很重要）：
 *   不自动把规则从 blocking 降成 advisory，也不自动升。
 *   分类是产品判断，不该由一个统计脚本替作者决定——
 *   一个规则被驳回三次，可能是规则错，也可能是这三条提案恰好写得烂。
 *   所以这里只产出「倾向」和「建议」，改不改由人或全局配置决定。
 *
 * 数据来源都是已有字段，没有为此新增任何埋点。
 */
import * as lint from './lint.js'

const MIN_SAMPLES = 3

/** 把所有已决提案的改动片段摊平成一条条样本。 */
function proposalSamples(items = []) {
  const rows = []
  for (const item of items) {
    const status = String(item?.status ?? '')
    if (status !== 'accepted' && status !== 'rejected') continue
    const diffs = Array.isArray(item?.diffs) ? item.diffs : []
    for (const diff of diffs) {
      const before = String(diff?.before ?? '')
      const after = String(diff?.after ?? '')
      if (!before && !after) continue
      rows.push({
        kind: 'proposal',
        id: item.id,
        chapter: Number(item.chapter ?? 0),
        status,
        accepted: status === 'accepted',
        // 记下这条改动本身有没有被 lint 判过：被硬拦过的片段更值得注意
        beforeHits: lint.checkBlocking(before).map((hit) => hit.id),
        afterHits: lint.checkBlocking(after).map((hit) => hit.id),
        before,
        after,
      })
    }
  }
  return rows
}

/** 问题单：修掉 / 无视，按类型聚。 */
function problemSamples(items = []) {
  return items
    .filter((row) => String(row?.status ?? '') !== 'open')
    .map((row) => ({
      kind: 'problem',
      id: row.id,
      type: String(row?.type ?? 'other'),
      severity: String(row?.severity ?? 'minor'),
      fixed: String(row?.status ?? '') === 'fixed',
      source: String(row?.sourceRule ?? row?.rule ?? ''),
    }))
}

const ratio = (a, b) => (b ? Math.round((a / b) * 100) / 100 : 0)

/**
 * 从现有数据里学。
 *
 * @returns {{samples:number, rules:object[], types:object[], notes:object[], summary:string}}
 */
export function learnFromData({ proposals = [], problems = [] } = {}) {
  const propRows = proposalSamples(proposals)
  const probRows = problemSamples(problems)

  // ── 提案：按「这条改动消掉了哪条硬伤」聚合 ──────────────────
  // 采纳了一条把「不是…而是…」改掉的提案，等于说「这个毛病我认」。
  const byRule = new Map()
  for (const row of propRows) {
    const fixedRules = row.beforeHits.filter((id) => !row.afterHits.includes(id))
    for (const id of fixedRules) {
      const stat = byRule.get(id) ?? { rule: id, adopted: 0, rejected: 0 }
      if (row.accepted) stat.adopted += 1
      else stat.rejected += 1
      byRule.set(id, stat)
    }
    // 反向：采纳了一条「新增硬伤」的提案，等于说「这个毛病我不在乎」
    const addedRules = row.afterHits.filter((id) => !row.beforeHits.includes(id))
    for (const id of addedRules) {
      const stat = byRule.get(id) ?? { rule: id, adopted: 0, rejected: 0 }
      // 这里语义要反过来：新增了它还被采纳 → 说明作者容忍它
      stat.tolerated = (stat.tolerated ?? 0) + 1
      byRule.set(id, stat)
    }
  }

  const rules = []
  for (const stat of byRule.values()) {
    const total = stat.adopted + stat.rejected
    if (total < MIN_SAMPLES) continue
    const r = ratio(stat.adopted, total)
    const meta = lint.listRules().find((rule) => rule.id === stat.rule)
    rules.push({
      rule: stat.rule,
      label: meta?.label ?? stat.rule,
      adopted: stat.adopted,
      rejected: stat.rejected,
      ratio: r,
      tolerated: stat.tolerated ?? 0,
      // 只给倾向，不给命令
      lean: r >= 0.8 ? 'keep' : r <= 0.2 ? 'loosen' : 'unclear',
    })
  }
  rules.sort((a, b) => b.adopted + b.rejected - (a.adopted + a.rejected))

  // ── 问题单：按类型看作者修不修 ──────────────────────────────
  const byType = new Map()
  for (const row of probRows) {
    const stat = byType.get(row.type) ?? { type: row.type, fixed: 0, ignored: 0 }
    if (row.fixed) stat.fixed += 1
    else stat.ignored += 1
    byType.set(row.type, stat)
  }
  const types = [...byType.values()]
    .map((stat) => ({
      ...stat,
      total: stat.fixed + stat.ignored,
      ratio: ratio(stat.fixed, stat.fixed + stat.ignored),
    }))
    .filter((row) => row.total >= MIN_SAMPLES)
    .sort((a, b) => b.total - a.total)

  // ── 人话结论 ────────────────────────────────────────────────
  const notes = []
  for (const row of rules) {
    if (row.lean === 'loosen') {
      notes.push({
        rule: row.rule,
        level: 'loosen',
        text: `${row.label}：你采纳了 ${row.adopted} 条、驳回 ${row.rejected} 条改它的提案。这条可能判得太勤——建议改成提示档，或者按本书调松阈值。`,
      })
    } else if (row.tolerated >= MIN_SAMPLES) {
      notes.push({
        rule: row.rule,
        level: 'keep',
        text: `${row.label}：有 ${row.tolerated} 条带这个毛病的提案被你采纳了。说明这种写法你其实能接受——硬拦它等于每章跟你吵。`,
      })
    }
  }
  for (const row of types) {
    if (row.ratio <= 0.25) {
      notes.push({
        rule: `problem:${row.type}`,
        level: 'ignore',
        text: `「${row.type}」类问题：${row.total} 条里只修了 ${row.fixed} 条。这类问题对你不重要，界面可以少提示它。`,
      })
    }
  }

  const summary = (() => {
    if (!propRows.length && !probRows.length) {
      return '还没有可学的判断。等你在验收台采纳/驳回几条提案、修掉/无视几条问题之后再来看。'
    }
    const parts = [`看了 ${propRows.length} 条改动片段、${probRows.length} 条已决问题`]
    if (rules.length) parts.push(`${rules.length} 条规则有足够样本`)
    if (notes.length) parts.push(`有 ${notes.length} 条结论`)
    else parts.push('暂时看不出稳定倾向——样本还不够，或你的判断很一致')
    return parts.join('；') + '。'
  })()

  return {
    samples: propRows.length + probRows.length,
    proposals: propRows.length,
    problems: probRows.length,
    rules,
    types,
    notes,
    summary,
  }
}
