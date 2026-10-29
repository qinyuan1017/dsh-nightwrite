/**
 * 长夜 · 界面 QA
 *
 * 复用 smoke.mjs 的迷你渲染器（真调函数组件、驱 hooks、mock 后端），
 * 但目标不同：smoke 验「该在的东西在」，这里找「不该在的东西」——
 * 打不开的按钮、没有名字的可点区域、undefined/NaN 漏上屏、空壳卡片、
 * 同一屏重复到没有意义的文案、点了没有任何反馈的假控件。
 *
 * 用法：node test/qa.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const smokePath = path.join(here, 'smoke.mjs')
const harnessPath = path.join(here, '_qa_harness.mjs')

// ── 1. 从 smoke.mjs 里切出「加载插件 + 渲染器」这一段，做成可复用模块 ──
const smokeSrc = fs.readFileSync(smokePath, 'utf8')
const CUT = '// ══ 1. 插件导出契约'
const at = smokeSrc.indexOf(CUT)
if (at < 0) {
  console.error('找不到 smoke.mjs 的分界标记，harness 结构变了')
  process.exit(2)
}
const prefix = smokeSrc.slice(0, at)
const footer = `
export {
  React, captured, regs, plugin, mount, renderNode, all, allCls, allText, countCls, throwsOf,
  mockValue, PROJECT, PROJECT2, CHAPTERS, LEDGER, OVERVIEW, OUTLINE, PROPOSALS, PROBLEMS,
  store, hookMap, fetchCalls, win,
}
export function resetHooks() { hookMap = new Map() }
export function setHookMap(v) { hookMap = v }
export function getDirty() { return dirty }
`
fs.writeFileSync(harnessPath, prefix + footer)

const H = await import(`file://${harnessPath.replace(/\\/g, '/')}`)
const { captured, mount, all, allCls, allText, countCls, throwsOf, store, PROJECT, resetHooks } = H

const src = fs.readFileSync(path.join(root, 'lib', 'client.js'), 'utf8')

// ══ 审计工具 ═══════════════════════════════════════════════
const findings = []
function report(level, page, what, detail) {
  findings.push({ level, page, what, detail })
}

/** 一个节点自己有没有「人话」：直接文本子节点或 aria-label / title。 */
function ownLabel(node) {
  const bits = []
  for (const kid of node.children ?? []) {
    if (kid.kind === 'text') bits.push(kid.text)
  }
  const p = node.props ?? {}
  if (p['aria-label']) bits.push(String(p['aria-label']))
  if (p.title) bits.push(String(p.title))
  return bits.join(' ').replace(/\s+/g, ' ').trim()
}

/** 节点整棵子树里的文字（用来判断空壳）。 */
function subtreeText(node) {
  const out = []
  const walk = (n) => {
    if (!n) return
    if (n.kind === 'text') out.push(n.text)
    for (const kid of n.children ?? []) walk(kid)
  }
  walk(node)
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

const EMOJI_ONLY =
  /^[\s\u00a0-\u303f\ufe0f\u2190-\u21ff\u2600-\u27bf\ud83c-\udbff\udc00-\udfff←-⇿✀-➿]+$/

function auditTree(page, tree) {
  const nodes = all(tree)

  // ── A. 可点但没名字 ──
  for (const n of nodes) {
    if (n.kind !== 'el') continue
    const p = n.props ?? {}
    const interactive = typeof p.onClick === 'function' || n.tag === 'button'
    if (!interactive) continue
    const label = ownLabel(n)
    if (!label) {
      const deep = subtreeText(n)
      if (!deep) {
        report('bad', page, '可点但完全没文字', `<${n.tag} class="${n.cls ?? ''}">`)
      } else if (EMOJI_ONLY.test(deep)) {
        report(
          'warn',
          page,
          '可点但只有图标，没有可读名',
          `<${n.tag} class="${n.cls ?? ''}"> → "${deep}"`,
        )
      }
    }
  }

  // ── B. 非 button 却挂了 onClick（键盘够不着）──
  const clickableNonButton = nodes.filter(
    (n) =>
      n.kind === 'el' &&
      typeof (n.props ?? {}).onClick === 'function' &&
      n.tag !== 'button' &&
      n.tag !== 'a' &&
      n.tag !== 'input' &&
      n.tag !== 'select' &&
      n.tag !== 'textarea',
  )
  for (const n of clickableNonButton) {
    report(
      'warn',
      page,
      'div 上挂 onClick（Tab 到不了、回车按不动）',
      `<${n.tag} class="${n.cls ?? ''}">`,
    )
  }

  // ── C. 值漏上屏 ──
  for (const n of nodes) {
    if (n.kind !== 'text') continue
    const t = String(n.text)
    if (/^(undefined|null|NaN|\[object Object\])$/.test(t.trim())) {
      report('bad', page, '渲染出了原始值', `"${t}"`)
    } else if (/undefined|NaN|\[object Object\]/.test(t)) {
      report('bad', page, '文案里混进了原始值', `"${t.slice(0, 80)}"`)
    } else if (/^\s*[¥$]\s*$/.test(t) || (/:\s*$/.test(t.trim()) && t.trim().length <= 2)) {
      report('warn', page, '只剩一个符号或冒号', `"${t}"`)
    }
  }

  // ── D. 空壳：有好看的类名，里面一个字都没有 ──
  const SHELLS = [
    'nw-card',
    'nw-hero',
    'nw-stat',
    'nw-action',
    'nw-pcard',
    'nw-prop',
    'nw-prob',
    'nw-issue',
    'nw-hist-row',
    'nw-scan-row',
    'nw-lex-row',
    'nw-td-cell',
  ]
  for (const n of nodes) {
    if (n.kind !== 'el' || typeof n.cls !== 'string') continue
    const hit = n.cls.split(/\s+/).find((c) => SHELLS.includes(c))
    if (!hit) continue
    if (!subtreeText(n) && !all(n).some((x) => x.kind === 'el' && x.tag === 'input')) {
      report('warn', page, `空壳 ${hit}`, '整块没有文字也没有输入框')
    }
  }

  // ── E. 同一屏里完全相同的按钮文案重复三次以上 ──
  const buttonLabels = new Map()
  for (const n of nodes) {
    if (n.kind !== 'el' || n.tag !== 'button') continue
    const label = ownLabel(n)
    if (!label || label.length > 12) continue
    buttonLabels.set(label, (buttonLabels.get(label) ?? 0) + 1)
  }
  for (const [label, count] of buttonLabels) {
    if (count >= 4 && !/^\d+$/.test(label)) {
      report('warn', page, '同屏 4 个以上同名按钮', `"${label}" ×${count}`)
    }
  }

  // ── F. 有 onClick 但点了不改任何状态（纯假按钮）──
  // 这一段放在下面 srcScan() 里全局跑一次：源码不分页，跟着 auditTree 跑只会把同一批命中重复报 9 遍。
}

// ── 2. 逐页渲染并审计 ──
const PAGES = ['today', 'read', 'plan', 'dispatch', 'review', 'world', 'scout', 'settings']
const trees = {}
for (const page of PAGES) {
  resetHooks()
  store['nw.page'] = page
  store['nw.project'] = PROJECT.id
  const tree = H.renderNode ? null : null
  // mount 需要组件；resetHooks 已清空 hook 槽，相当于首次进入
  // eslint-disable-next-line no-await-in-loop
  const mounted = await mount(captured, {})
  trees[page] = mounted
  const throws = throwsOf(mounted)
  for (const t of throws) {
    report('bad', page, '组件抛错', `${t.name}: ${t.error}`)
  }
  auditTree(page, mounted)
}

// ── 3. 深水区：验收详情（正文 + 问题 + 历史 + 词表）──
{
  resetHooks()
  store['nw.page'] = 'review'
  store['nw.openChapter'] = '3'
  const tree = await mount(captured, {})
  trees.reviewDetail = tree
  for (const t of throwsOf(tree)) report('bad', 'reviewDetail', '组件抛错', `${t.name}: ${t.error}`)
  auditTree('reviewDetail', tree)
}

// ── 4. 空态：没有作品 ──
// 以前这里要求「没有作品时给一句空态文案」。改成建书首屏之后，判据变了：
// 没有作品要看到一张能填的表，而不是一句「还没有作品，去别处建」。
{
  resetHooks()
  store['nw.page'] = 'cockpit'
  // Root 的 effect 在 projectId 为空时会自动挑第一个作品，所以光清 store 看不到空态。
  // 临时把 fetch 换成「一个作品都没有」的桩，才真的走到建书那一屏。
  const realFetch = global.fetch
  const emptyFetch = async (url, opt) => {
    let op = ''
    let payload = {}
    try {
      const body = JSON.parse(opt.body)
      op = body.op
      payload = body.payload
    } catch {
      /* 不是 JSON 就当空 */
    }
    if (op === 'project.list')
      return { json: async () => ({ ok: true, value: { projects: [] } }), status: 200 }
    return { json: async () => ({ ok: true, value: H.mockValue(op, payload) }), status: 200 }
  }
  global.fetch = emptyFetch
  if (typeof H.win !== 'undefined') H.win.fetch = emptyFetch
  const tree = await mount(captured, {})
  global.fetch = realFetch
  trees.empty = tree
  for (const t of throwsOf(tree)) report('bad', 'empty', '组件抛错', `${t.name}: ${t.error}`)
  auditTree('empty', tree)
  const emptyText = allText(tree).map(String)
  if (!countCls(tree, 'nw-create')) {
    report('bad', 'empty', '没有作品时没落到建书页', emptyText.slice(0, 6).join(' | '))
  }
  // 新向导第一屏只问两件事（叫什么、想看什么），其余折进第二步的可跳过区。
  const fields = countCls(tree, 'nw-create-field')
  if (fields !== 2) report('bad', 'empty', '建书页首屏应只问两项', `${fields} 个字段`)
  if (countCls(tree, 'nw-create-step') !== 3) report('bad', 'empty', '建书页没有三步进度条', '')
  if (!emptyText.some((t) => t.includes('先建一本'))) {
    report('warn', 'empty', '建书页没说明这一步在干什么', emptyText.slice(0, 6).join(' | '))
  }
}

// ── 4b. 源码层：点了不改任何状态的真假按钮（全局跑一次）──
{
  const deadInSrc = []
  const handlerRe = /onClick:\s*(?:\(\s*\w*\s*\)\s*=>\s*|function\s*\(\s*\w*\s*\)\s*\{)/g
  let m
  while ((m = handlerRe.exec(src))) {
    const rest = src.slice(m.index, m.index + 300)
    const body = rest.split(/\n\s{0,12}\}/)[0]
    // 只挡冒泡不算干活；剥掉之后再问「还剩不剩一次调用」。
    const clean = body.replace(/\b(?:event|e)\.(?:stopPropagation|preventDefault)\(\)/g, '')
    // 但「只挡冒泡」本身就是一种活：浮层的 onClick 拦住点击，不让它冒到遮罩上去关掉自己。
    if (/\.(?:stopPropagation|preventDefault)\(\)/.test(body) && !/\w+\s*\([^)]/.test(clean))
      continue
    if (!/\w\s*\(/.test(clean) && !/\w+\s*\?\.\s*\(/.test(clean)) {
      deadInSrc.push(body.replace(/\s+/g, ' ').slice(0, 100))
    }
  }
  if (deadInSrc.length) {
    // 浮层自己的「别把点击传给我爹」不算假按钮：它爹是遮罩，传上去就把弹窗关了。
    const realDead = deadInSrc
      .filter((body) => !/className: 'nw-modal'/.test(body))
      .filter((body) => !/stopPropagation/.test(body) || /nw-modal/.test(body) === false)
    if (realDead.length) {
      report(
        'warn',
        'src',
        'onClick 里没有任何动作（点了没反应）',
        realDead.slice(0, 4).join(' ｜ '),
      )
    }
  }
}

// ── 5. 跨页一致性：导航高亮、标题、主题 ──
{
  const navCounts = PAGES.map((page) => {
    const t = trees[page]
    return all(t).filter(
      (n) =>
        n.kind === 'el' &&
        typeof n.cls === 'string' &&
        n.cls.split(/\s+/).includes('nw-dock-btn') &&
        n.cls.split(/\s+/).includes('on'),
    ).length
  })
  if (navCounts.some((n) => n !== 1)) {
    report('bad', 'nav', '底栏胶囊高亮不是恰好 1 个', `各页高亮数：${navCounts.join(',')}`)
  }
  const pageLabels = PAGES.map((page) => allText(trees[page]).join(' '))
  PAGES.forEach((page, i) => {
    if (!/长夜/.test(pageLabels[i])) report('bad', page, '顶栏没显示出品牌名', '')
  })
}

// ══ 输出 ═══════════════════════════════════════════════════
const bad = findings.filter((f) => f.level === 'bad')
const warn = findings.filter((f) => f.level === 'warn')

const groupBy = (list) => {
  const map = new Map()
  for (const f of list) {
    if (!map.has(f.what)) map.set(f.what, [])
    map.get(f.what).push(f)
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
}

console.log(`\n界面 QA · 审了 ${PAGES.length + 2} 屏`)
console.log(`严重 ${bad.length} 条 · 提示 ${warn.length} 条\n`)

if (bad.length) {
  console.log('── 严重（用户会直接看见或点不动）──')
  for (const [what, list] of groupBy(bad)) {
    console.log(`\n${what}  ×${list.length}`)
    for (const f of list.slice(0, 12)) console.log(`  [${f.page}] ${f.detail}`)
    if (list.length > 12) console.log(`  … 另有 ${list.length - 12} 处`)
  }
}

if (warn.length) {
  console.log('\n── 提示（不影响跑，但值得修）──')
  for (const [what, list] of groupBy(warn)) {
    console.log(`\n${what}  ×${list.length}`)
    for (const f of list.slice(0, 8)) console.log(`  [${f.page}] ${f.detail}`)
    if (list.length > 8) console.log(`  … 另有 ${list.length - 8} 处`)
  }
}

fs.rmSync(harnessPath, { force: true })

if (bad.length) {
  console.log('\n结论：有严重问题，先修这些。')
  process.exit(1)
}
console.log('\n结论：没有严重问题。')
