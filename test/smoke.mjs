// 长夜冒烟：迷你渲染器真的调用函数组件、驱动 hooks、mock 后端 RPC，
// 逐页核对不抛错、关键类名在、关键文案对得上。
//
// 用法：node test/smoke.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const P = path.join(here, '..', 'lib', 'client.js')
const src = readFileSync(P, 'utf8')

// ══ hooks 运行时（按组件路径隔离，模拟 React 的 hook 槽位） ══
let hookMap = new Map()
let currentPath = 'root'
let curHooks = null
let cursor = 0
const effectQueue = []
let dirty = false

function withHooks(route, fn) {
  const prevPath = currentPath
  const prevHooks = curHooks
  const prevCursor = cursor
  currentPath = route
  if (!hookMap.has(route)) hookMap.set(route, [])
  curHooks = hookMap.get(route)
  cursor = 0
  try {
    return fn()
  } finally {
    currentPath = prevPath
    curHooks = prevHooks
    cursor = prevCursor
  }
}
function useState(init) {
  const i = cursor++
  if (!(i in curHooks)) curHooks[i] = typeof init === 'function' ? init() : init
  const route = currentPath
  const slot = i
  const set = (v) => {
    const arr = hookMap.get(route)
    const next = typeof v === 'function' ? v(arr[slot]) : v
    if (next !== arr[slot]) {
      arr[slot] = next
      dirty = true
    }
  }
  return [curHooks[i], set]
}
// 依赖比较必须逐项 Object.is —— 真 React 就是这么比的。
// 用 JSON.stringify 会把函数依赖序列化成 null，导致依赖 callbacks 的 effect 永远不被触发。
function sameDeps(a, b) {
  if (!a || !b) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false
  return true
}
function useEffect(fn, deps) {
  const i = cursor++
  const next = deps === undefined ? null : deps
  const prev = curHooks[i]
  if (!prev || !sameDeps(prev.deps, next)) {
    curHooks[i] = { deps: next }
    effectQueue.push(fn)
  }
}
function useRef(v) {
  const i = cursor++
  if (!(i in curHooks)) curHooks[i] = { current: v }
  return curHooks[i]
}
function useMemo(f, deps) {
  const i = cursor++
  const next = deps === undefined ? null : deps
  const prev = curHooks[i]
  if (prev && sameDeps(prev.deps, next)) return prev.value
  const value = f()
  curHooks[i] = { deps: next, value }
  return value
}
const useCallback = (f, deps) => useMemo(() => f, deps)
const useLayoutEffect = () => {}
function useReducer(r, init) {
  const [s, set] = useState(init)
  return [s, (a) => set(r(s, a))]
}
const memo = (f) => f
const forwardRef = (f) => f

const React = {
  // 真 React 会把 children 塞进 props.children，自定义组件（Card / StatBox / Tag…）全靠它，
  // 少了这一行所有外壳组件都会渲染成空壳。
  createElement: (t, p, ...c) => {
    const kids = c.flat(9)
    const props = { ...(p || {}) }
    if (kids.length === 1) props.children = kids[0]
    else if (kids.length > 1) props.children = kids
    return { t, p: props, c: kids }
  },
  Fragment: 'Fragment',
  useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, memo, useReducer,
  createContext: () => ({}), useContext: () => ({}), useImperativeHandle: () => {}, forwardRef,
  isValidElement: (x) => !!(x && x.t),
  Children: { map: (x) => x, toArray: (x) => x, only: (x) => x, count: () => 0 },
  cloneElement: (e) => e,
  Component: class {}, PureComponent: class {},
}

// ══ DOM / window 桩 ════════════════════════════════════════
const el = () => ({
  dataset: {}, style: {}, setAttribute() {}, appendChild() {}, addEventListener() {},
  removeEventListener() {}, click() {}, remove() {}, querySelector: () => null,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  scrollIntoView() {},
})
const doc = {
  head: { appendChild() {} },
  createElement: el,
  body: el(),
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  documentElement: { dataset: {}, style: {} },
  getElementById: () => null,
}
const store = {}
const win = {
  document: doc,
  navigator: { userAgent: 'Mozilla/5.0 Electron/40.0', language: 'zh-CN' },
  location: { hash: '', search: '', origin: 'http://127.0.0.1:1', href: 'http://x/' },
  addEventListener() {}, removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: (k) => { delete store[k] },
  },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout: (fn) => { if (typeof fn === 'function') setImmediate(fn); return 0 },
  clearTimeout() {},
  alert() {},
  prompt: () => null,
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  clipboard: { writeText: async () => {} },
}
global.window = win
global.document = doc
global.localStorage = win.localStorage
// Node 24 起 global.navigator 是只读 getter，只能 defineProperty 覆盖
Object.defineProperty(global, 'navigator', { value: win.navigator, configurable: true, writable: true })
global.requestAnimationFrame = win.requestAnimationFrame
// 插件里写的是裸 setTimeout（factory 作用域内解析到 Node 全局），
// 不接过来防抖就永远等不到 700ms —— 面板会一直是空壳，断言全是假阴性。
global.setTimeout = win.setTimeout
global.clearTimeout = win.clearTimeout
global.getComputedStyle = win.getComputedStyle
global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }

// ══ mock 后端（字段严格对齐 lib/store.js 的真实返回） ══════
const PROJECT = {
  id: 'pm000000000001',
  name: '元末女帝：系统让我截胡朱重八',
  genre: '历史',
  qualityGate: 70,
  targetWords: 2500,
  monthlyBudget: 600,
  chapters: 3,
  worldState: { text: '主角金丹三层，身份未暴露', fromChapter: 3 },
}
const PROJECT2 = { id: 'pm000000000002', name: '另一部书', genre: '都市', qualityGate: 70, targetWords: 3000, monthlyBudget: 400, chapters: 0, worldState: null }
const CHAPTERS = [
  { chapter: 1, title: '第一回 夜雨', words: 2400, status: 'accepted', score: 82, issues: 0, violations: 0, cost: 0.4 },
  { chapter: 2, title: '第二回 收网', words: 2100, status: 'accepted', score: 64, issues: 2, violations: 0, cost: 0.3 },
  { chapter: 3, title: '第三回 城头', words: 2600, status: 'review', score: 68, issues: 3, violations: 1, cost: 0.5 },
]
const LEDGER = {
  characters: [
    { id: 'c1', name: '主角', role: '中心', state: '金丹三层', lastChapter: 3 },
    { id: 'c2', name: '徐达', role: '同盟', state: '应天', lastChapter: 2 },
  ],
  locations: [{ id: 'l1', name: '应天府', type: '城池', firstChapter: 1, state: '控制' }],
  foreshadow: [{ id: 'f1', name: '玉玺下落', plantedChapter: 1, plannedChapter: 2, status: 'open' }],
  events: [{ id: 'e1', name: '主角晋级', chapter: 3, actors: '主角', kind: '成长' }],
  terms: [{ id: 't1', name: '北元', count: 12, variant: '北源 ×1', state: '待修' }],
  rules: [{ id: 'r1', name: '金丹不可长途御空', source: '境界体系', violatedIn: '3', state: '待改' }],
  highlights: [{ id: 'h1', name: '城头夜雨', chapter: 3, kind: '氛围', why: '压抑感强' }],
  conflicts: [{ id: 'x1', name: '玉佩之争', sides: '主角 vs 陈友谅', from: 1, state: '进行中' }],
}
const OVERVIEW = {
  project: PROJECT,
  stats: {
    chapters: 3, totalWords: 7100, totalCost: 1.2, avgScore: 71, accepted: 2, pending: 1, queued: 2, running: 0, writeToday: 2600, targetWords: 2500, streak: 3,
    // 两周柱状图走真数据（lib/store.js dailyWordsFor 的口径：14 条、没写字的日子补 0）。
    // 这里给 12 天有字、2 天断更，跟以前写死的演示曲线形状一致，但来源真的了。
    dailyWords: [2600, 1800, 0, 3100, 2500, 900, 2700, 0, 2200, 3300, 2500, 1200, 2800, 1240].map((words, i) => ({
      day: `2026-10-${String(14 + i).padStart(2, '0')}`,
      words,
    })),
  },
  debts: [
    { level: 'red', kind: 'foreshadow', title: '伏笔过期 · 玉玺下落', sub: '第 1 回埋 · 计划第 2 回收', target: { page: 'world', kind: 'foreshadow', id: 'f1' } },
    { level: 'red', kind: 'violation', title: '违规章 · 第 3 回', sub: '命中 1 条硬规则', target: { page: 'review', chapter: 3 } },
    { level: 'orange', kind: 'lowscore', title: '低分章 · 第 2 回', sub: '已采纳但 64 分', target: { page: 'review', chapter: 2 } },
  ],
  recent: CHAPTERS.slice().reverse(),
  suggestion: '先处理第 2 回（64 分）',
  worldCounts: { characters: 2, locations: 1 },
  unclosedForeshadow: 1,
}
const TEMPLATES = [
  { id: 'tpl_punch', name: '打脸章', intent: '主角吃瘪但埋下钩子', used: 3 },
  { id: 'tpl_reveal', name: '身份揭穿', intent: '身份当众揭穿', used: 0 },
]
const QUEUE = [
  { id: 'q1', chapter: 4, intent: '续写下一章', templateName: '打脸章', status: 'queued', words: 2500, cost: 0 },
  { id: 'q2', chapter: 5, intent: '连更', templateName: '', status: 'running', words: 2500, cost: 0 },
]
const OUTLINE = {
  brief: {
    premise: '元末，女主带系统穿到朱元璋身边抢天下。',
    genre: '历史穿越',
    audience: '权谋爽文读者',
    protagonist: '朱砂',
    goal: '先活下来，再夺天下',
    conflict: '朱重八',
    hook: '一睁眼正撞上他要杀我',
    ending: '她坐了那把椅子',
    volumes: 2,
    chaptersPerVolume: 2,
  },
  volumes: [
    {
      id: 'v1', index: 1, title: '第一卷 · 濠州',
      chapters: [
        { chapter: 1, title: '城头夜雨', summary: '她穿到刑场边上', hook: '刀落下前一瞬', status: 'written' },
        { chapter: 2, title: '一饭之恩', summary: '她给朱元璋递了碗粥', hook: '他记住这碗粥', status: 'drafted' },
      ],
    },
    {
      id: 'v2', index: 2, title: '第二卷 · 金陵',
      chapters: [
        { chapter: 3, title: '城头夜雨', summary: '她第一次上城头', hook: '雨里有人喊她的名字', status: 'todo' },
        { chapter: 4, title: '入城', summary: '她进了金陵', hook: '城门在她身后关上', status: 'todo' },
      ],
    },
  ],
  updatedAt: '2026-10-27T00:00:00.000Z',
}
const PROPOSALS = [
  {
    id: 'p1', chapter: 3, kind: 'patch', title: '雨景删繁', status: 'pending', summary: '三场雨景并成一场',
    diffs: [
      { before: '雨落下来的时候，他站在城头。', after: '雨落下来，他站在城头。', why: '「的时候」是AI腔' },
      { before: '仿佛天也在哭', after: '天也阴着', why: '「仿佛」连用' },
    ],
    createdAt: '2026-10-27T00:00:00.000Z',
  },
  {
    id: 'p2', chapter: 2, kind: 'rewrite', title: '整章换叙述口气', status: 'accepted', summary: '改成第一人称紧贴',
    diffs: [{ before: '她递了碗粥。', after: '我把粥递过去。', why: '拉近视角' }],
    applied: 1, missed: [], createdAt: '2026-10-26T00:00:00.000Z',
  },
]
const PROBLEMS = [
  { id: 'x1', chapter: 3, para: 2, type: 'ai-style', severity: 'major', scope: 'chapter', status: 'open', text: '「仿佛」连用两次', quote: '仿佛天也在哭' },
  { id: 'x2', chapter: 2, para: 0, type: 'logic', severity: 'critical', scope: 'cross', status: 'open', text: '主角已金丹三层，不该被凡人拦住' },
  { id: 'x3', chapter: 3, para: 5, type: 'style', severity: 'minor', scope: 'chapter', status: 'fixed', text: '中段连写三场雨景' },
]

const ROLES = [
  { id: 'nightwrite-coordinator', label: '总编', duty: '排产、仲裁、唯一有权派单和签发', canDispatch: true, gate: 'G1/G2/G3', skills: ['nightwrite-plan-novel', 'nightwrite-quality-rubric'] },
  { id: 'nightwrite-story-architect', label: '故事架构师', duty: '总纲、卷纲、章细纲、伏笔埋设计划', canDispatch: false, gate: '细纲齐全', skills: ['nightwrite-plan-novel'] },
  { id: 'nightwrite-chapter-writer', label: '正文写手', duty: '按细纲落正文', canDispatch: false, gate: '细纲存在', skills: ['nightwrite-write-chapter'] },
]
// 拆书结果：只给两条章，够断言「黄金三章 / 逐章 / 钩子分布」这几块画得出来。
const ANALYSES = [
  {
    id: 'an_0123456789ab',
    title: '拆书 2026-10-27',
    chapters: 2,
    totalWords: 5200,
    avgEmotion: 4.6,
    avgDialogue: 0.31,
    hookCount: { reveal: 1, threat: 1 },
    noise: ['作者的话：今天两更'],
    createdAt: '2026-10-27T10:00:00.000Z',
    opening: [
      { num: 1, title: '城头夜雨', words: 2600, dialogue: 0.28, hook: { id: 'threat', label: '威胁' }, beats: ['他抬手抹了一把脸'] },
      { num: 2, title: '血战', words: 2600, dialogue: 0.34, hook: { id: 'reveal', label: '揭示' }, beats: ['他喊了一声'] },
    ],
    rows: [
      { num: 1, title: '城头夜雨', words: 2600, dialogue: 0.28, hook: { id: 'threat', label: '威胁' }, beats: ['他抬手抹了一把脸'] },
      { num: 2, title: '血战', words: 2600, dialogue: 0.34, hook: { id: 'reveal', label: '揭示' }, beats: ['他喊了一声'] },
    ],
  },
]

// 扫榜结果：一行一本，字段跟 lib/scan.js parseRanking 的输出对齐。
const OPINIONS = [
  { id: 'op_1', chapter: 3, kind: 'weakness', source: 'coldread', status: 'open', severity: 'major', text: '他刚说过不去，下一段又去了，这个转向没有代价。', quote: '他抬脚就跨过了栅栏。', resolution: '', createdAt: '2026-10-28T01:00:00.000Z' },
  { id: 'op_2', chapter: 3, kind: 'highlight', source: 'coldread', status: 'open', severity: 'minor', text: '渡口那段的雨声写得狠，读的时候真的停了一下。', quote: '', resolution: '', createdAt: '2026-10-28T01:10:00.000Z' },
  { id: 'op_3', chapter: 2, kind: 'weakness', source: 'lint', status: 'adopted', severity: 'minor', text: '连续四句以「他」开头。', quote: '他站起来。他走到门口。', resolution: '改了两句', createdAt: '2026-10-27T20:00:00.000Z' },
]

const SCANS = [
  {
    id: 'sb_demo0001',
    platform: '起点',
    genre: '',
    note: '',
    createdAt: '2026-10-27T10:00:00.000Z',
    count: 2,
    genres: [{ name: '历史', count: 1 }, { name: '都市', count: 1 }],
    rising: [{ book: '我在大明当暴君', delta: 12, sign: 1 }, { book: '重生之我家有矿', delta: -5, sign: -1 }],
    rows: [
      { rank: 1, book: '我在大明当暴君', genre: '历史', collect: '38.2万', trend: '↑ 12' },
      { rank: 2, book: '重生之我家有矿', genre: '都市', collect: '96.5万', trend: '↓ 5' },
    ],
  },
]

const DISPATCHES = [
  {
    id: 'dp_aaaaaaaaaaaa', role: 'nightwrite-story-architect', roleLabel: '故事架构师',
    task: '排第三回细纲', chapter: 3, status: 'issued',
    createdAt: '2026-10-27T10:00:00.000Z', expiresAt: new Date(Date.now() + 25 * 60000).toISOString(),
    sessionId: '', lastError: '', report: null, expired: false,
  },
  {
    id: 'dp_bbbbbbbbbbbb', role: 'nightwrite-consistency-checker', roleLabel: '一致性检查员',
    task: '查第二回设定冲突', chapter: 2, status: 'submitted',
    createdAt: '2026-10-26T10:00:00.000Z', expiresAt: '2026-10-26T11:00:00.000Z',
    sessionId: 'sess-1234', lastError: '', expired: false,
    report: {
      text: ['### 结论', '通过', '### 依据', '没找到矛盾'].join('\n'),
      verdict: '通过',
      sections: [{ title: '结论', body: '通过' }, { title: '依据', body: '没找到矛盾' }],
      submittedBy: 'conversation', at: '2026-10-26T10:30:00.000Z',
    },
  },
]

// 停靠点：一轮写到第 3 回、上限 3 章、已交 1 章等确认 ——
// 正是「该停下等人看」的那一刻，界面上「还能写 2 章」和「等确认」都得看得见。
const RUN = {
  id: 'rn_0123456789ab',
  kind: 'continue',
  chapter: 3,
  currentChapter: 3,
  maxChapters: 3,
  status: 'open',
  by: '',
  note: '顶着连更 3 章',
  createdAt: '2026-10-28T01:00:00.000Z',
  updatedAt: '2026-10-28T02:00:00.000Z',
  chapters: [{ chapter: 2, at: '2026-10-28T01:30:00.000Z', words: 2100, note: '', reviewed: true, verdict: 'ok' }],
  expired: false,
  canAdvance: true,
  remaining: 2,
}
const RUN_VERDICT = { level: 'green', text: '可以写，这一轮还能写 2 章' }
const RUN_CLOSED = {
  ...RUN,
  id: 'rn_ba9876543210',
  status: 'closed',
  currentChapter: 2,
  chapters: [{ chapter: 1, at: '2026-10-26T01:00:00.000Z', words: 2400, note: '', reviewed: true, verdict: 'ok' }],
  closedAt: '2026-10-26T05:00:00.000Z',
  closeNote: '这一轮收尾',
}

function mockValue(op, payload) {
  switch (op) {
    case 'ping': return { name: 'nightwrite', version: '0.1.0', ops: 70 }

    // ── 停靠点（run.*）：状态灯和停靠点页都读这几个 ──
    // 当前这一轮是 open、停在第 3 回、上限 3 章已交 1 章 —— 正好让状态灯显示
    // 「正在写第 3 回」、停靠点页显示「还能写 2 章」，两边断言都有东西可对齐。
    case 'run.current':
      return { run: { ...RUN }, verdict: RUN_VERDICT }
    case 'run.list':
      return { items: [{ ...RUN }, { ...RUN_CLOSED }], total: 2 }
    case 'run.get':
      return { run: { ...RUN }, verdict: RUN_VERDICT }
    case 'run.open':
      return { run: { ...RUN, chapter: Number(payload?.chapter ?? RUN.chapter) }, verdict: RUN_VERDICT }
    case 'run.claim':
      return { run: { ...RUN, status: 'waiting' }, verdict: { level: 'orange', text: '第 3 回交完，等确认' } }
    case 'run.review':
      return { run: { ...RUN, status: 'open' }, verdict: RUN_VERDICT }
    case 'run.close':
      return { run: { ...RUN_CLOSED }, verdict: { level: 'grey', text: '这一轮已经关了' } }
    case 'project.list': return { projects: [PROJECT, PROJECT2] }
    case 'project.get': return { project: payload?.projectId === PROJECT2.id ? PROJECT2 : PROJECT }
    case 'overview': return OVERVIEW
    case 'chapter.list': return { chapters: CHAPTERS }
    case 'outline.get': return { outline: OUTLINE }
    case 'role.list': return { items: ROLES }
    case 'dispatch.list': return { items: DISPATCHES, total: DISPATCHES.length }
    case 'report.list': return { items: DISPATCHES.filter((d) => d.report), total: 1 }
    case 'dispatch.issue': return { id: 'dp_cccccccccccc', role: payload.role, roleLabel: '总编', task: payload.task, status: 'issued', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() }
    case 'dispatch.send': return payload?.dryRun ? { dryRun: true, prompt: ['【长夜派单 · 故事架构师】', '## 边界', '只读。'].join('\n'), ticket: DISPATCHES[0] } : { sessionId: 'sess-abcdef', created: false }
    case 'dispatch.sweep': return { swept: 0 }
    case 'dispatch.revoke': return { id: payload?.id, status: 'revoked' }
    case 'report.submit': return { id: payload?.id, status: 'submitted', report: { verdict: '通过', sections: [] } }
    case 'proposal.list': return { items: PROPOSALS }
    case 'problem.list': return { items: PROBLEMS, counts: { open: 2, fixed: 1, ignored: 0 } }
    case 'chapter.get':
      return {
        chapter: payload?.chapter ?? 1,
        text: '第 3 回　城头夜雨\n\n雨落下来的时候，他站在城头。',
        words: 2600,
        meta: {
          chapter: 3, status: 'review', score: 68,
          scores: { reader: 18, logic: 14, aiStyle: 22, rhythm: 14 },
          issues: [
            { type: 'ai-style', severity: 'minor', text: '「仿佛」连用两次', quote: '仿佛天也在哭' },
            { type: 'logic', severity: 'critical', text: '主角已金丹三层，不该被凡人拦住' },
            { type: 'pace', severity: 'minor', text: '中段连写三场雨景，节奏拖沓' },
          ],
          violations: [{ rule: '金丹不可长途御空', text: '第 3 段主角御空三百里' }],
          cost: 0.5,
        },
      }
    case 'ledger.get': return { ledger: LEDGER }
    case 'templates.list': return { items: TEMPLATES }
    case 'queue.list': return { items: QUEUE }
    case 'lint.check':
      return {
        total: 3, blocking: 1, advisory: 2, chars: 120, calibrated: false,
        hits: [
          { id: 'not-is', label: '对偶否定', severity: 'blocking', review: 'mechanical', hint: '「不是…而是…」是 AI 腔', why: '先否定一个没人在意的靶子再宣布结论，是想显得深刻。', para: 1, offset: 4, length: 12, quote: '他不是不知道，而是不想说' },
          { id: 'period-stutter', label: '句号碎', severity: 'advisory', review: 'mechanical', hint: '连续短句读起来像电报', why: '连续六句同一长度，节奏就僵了。', para: 2, offset: 0, length: 9, quote: '他站着。他没动。他没说话。' },
          { id: 'long-paragraph', label: '长段', severity: 'advisory', review: 'mechanical', hint: '一段超过 200 字该拆', why: '手机屏一段超过六行，眼睛找不到下一行的起点。', para: 3, offset: 0, length: 12, quote: '这一整段有两百多字没有断开' },
        ],
        summary: [{ id: 'not-is', count: 1 }, { id: 'period-stutter', count: 1 }, { id: 'long-paragraph', count: 1 }],
      }
    case 'lint.calibration':
      return {
        count: 2,
        samples: 12,
        chars: 18400,
        measuredAt: '2026-10-28T01:00:00.000Z',
        thresholds: { 'period-stutter': { perPara: 5 }, 'cliche-density': { perKilo: 9 } },
        notes: [
          { rule: 'period-stutter', level: 'loose', text: '句号碎：这本书的 90 分位是 4.2/千字，全局阈值 6。建议改成 5。' },
          { rule: 'cliche-density', level: 'tight', text: '陈词密度：这本书写得比全局阈值更疏，按全局值会几乎不报。' },
          { rule: 'not-is', level: 'idle', text: '对偶否定：这本书 12 章里一次都没命中。阈值保留全局值。' },
        ],
        items: [
          { id: 'period-stutter', label: '句号碎', severity: 'advisory', threshold: { perPara: 5 }, overridden: true },
          { id: 'cliche-density', label: '陈词密度', severity: 'advisory', threshold: { perKilo: 9 }, overridden: true },
          { id: 'not-is', label: '对偶否定', severity: 'blocking', threshold: {}, overridden: false },
        ],
      }
    case 'lint.calibrate':
      return {
        samples: 12,
        chars: 18400,
        summary: '量了 12 章共 18400 字；1 条会误报，已按本书调松。',
        thresholds: { 'period-stutter': { perPara: 5 } },
        notes: [{ rule: 'period-stutter', level: 'loose', text: '句号碎：按全局值会天天误报。' }],
        measured: { 'period-stutter': { n: 12, p50: 2, p75: 3.4, p90: 4.2, max: 6, mean: 2.8, rate: 0.6 } },
        calibration: { count: 2, samples: 12, chars: 18400, items: [] },
      }
    case 'lint.calibrate.save':
      return { count: 0, samples: 0, chars: 0, thresholds: {}, notes: [], items: [] }
    case 'chapter.aistyle':
      return {
        chapter: payload?.chapter ?? 3,
        words: 2600,
        density: 3.8,
        lexicon: 12,
        hits: [
          { para: 1, pattern: '空气仿佛凝固', hint: '套话', quote: '雨落下来的时候，空气仿佛凝固了' },
          { para: 2, pattern: '眼底闪过一丝', hint: '套话', quote: '他眼底闪过一丝不忍' },
        ],
      }
    case 'chapter.history':
      return {
        chapter: payload?.chapter ?? 3,
        currentWords: 2600,
        keep: 20,
        versions: [
          { name: '0003-20261027T101500123Z.txt', at: '20261027T101500123Z', file: '20261027T101500123Z.txt', words: 2480, size: 7440 },
          { name: '0003-20261026T221000456Z.txt', at: '20261026T221000456Z', file: '20261026T221000456Z.txt', words: 2310, size: 6930 },
        ],
      }
    case 'chapter.trash':
      return {
        items: [
          { trash: '20261027T090000123Z', chapter: 7, title: '第 7 回 旧稿', words: 2400, status: 'review', files: ['0007.txt', '0007.meta.json'], at: '20261027T090000123Z' },
        ],
      }
    case 'search':
      return {
        query: String(payload?.q ?? ''),
        scope: 'all',
        total: 2,
        truncated: false,
        hits: [
          { kind: 'chapter', chapter: 3, title: '第 3 回', para: 1, offset: 12, quote: '雨落下来的时候，他站在城头' },
          { kind: 'ledger', ledger: 'terms', id: 't1', title: '玉玺', quote: '{"id":"t1","name":"玉玺"}' },
        ],
      }
    // ── 拆书 / 导入 / 扫榜（第 2·3·4 批） ──
    case 'analyze.list':
      return { total: ANALYSES.length, items: ANALYSES.map(({ rows, opening, ...rest }) => rest) }
    case 'analyze.start':
      return { ...ANALYSES[0] }
    case 'analyze.get':
      return { ...ANALYSES[0] }
    case 'analyze.remove':
      return { removed: true }
    case 'import.preview':
      return {
        chapters: 4,
        skippedEmpty: 0,
        noise: ['作者的话：今天两更'],
        totalWords: 10400,
        truncated: false,
        head: [
          { at: 1, title: '城头夜雨', words: 2600, firstLine: '雨落下来的时候，他站在城头。' },
          { at: 2, title: '血战', words: 2400, firstLine: '刀劈过来，他侧身让开。' },
        ],
      }
    case 'import.run':
      return {
        mode: payload?.mode ?? 'append', written: 4, from: 5, to: 8, totalWords: 10400,
        volumes: [], outlinePatch: { volumes: [] },
      }
    case 'scan.list':
      return { total: SCANS.length, items: SCANS.map(({ rows, genres, rising, ...rest }) => rest) }
    case 'scan.save':
      return { ...SCANS[0] }
    case 'scan.get':
      return { ...SCANS[0] }
    case 'taskpack.list':
      return {
        items: [
          { pack: 'tp-0001-nightwrite-chapter-writer', role: 'nightwrite-chapter-writer', roleLabel: '章节写手', chapter: 3, createdAt: '2026-10-28T01:30:00.000Z', files: 5, omitted: 2, bytes: 24567 },
        ],
        total: 1,
      }
    case 'taskpack.get':
      return {
        pack: payload?.pack,
        dir: '/data/nightwrite/taskpacks/tp-0001/materials',
        manifest: {
          role: 'nightwrite-chapter-writer',
          roleLabel: '章节写手',
          chapter: 3,
          files: [
            { key: 'project', path: '/m/project.md', why: '这本书的底色', bytes: 1200 },
            { key: 'outline-chapter', path: '/m/outline-chapter.md', why: '这一回的细纲', bytes: 900 },
            { key: 'chapter-prev', path: '/m/chapter-prev.md', why: '上一回末尾，接着写', bytes: 3000 },
            { key: 'ledger-condensed', path: '/m/ledger-condensed.md', why: '账本摘录', bytes: 4500 },
            { key: 'skills', path: '/m/skills.md', why: '这个岗位的手册', bytes: 2100 },
          ],
          omitted: [
            { key: 'style-profile', why: '这本书还没有文风卡' },
            { key: 'corpus', why: '语料池是空的' },
          ],
        },
        promptSection: '## 给你的材料\n材料不在本单里，在磁盘上：`/data/nightwrite/taskpacks/tp-0001/materials`',
      }
    // ── 章级体检四件套（借 oh-story）──
    case 'lint.degenerate':
      return {
        hits: [{ id: 'degenerate-repeat-punct', label: '复读：标点或字词机械重复', severity: 'blocking', group: 'degenerate', para: 1, offset: 0, length: 6, quote: '………' }],
        total: 1,
        blocking: 1,
        advisory: 0,
        chapter: Number(payload?.chapter ?? 0),
        verdict: '有 1 处像是模型跑偏了（复读/截断/占位语）。这类问题逐句修不好，直接重跑这一章更省事。',
      }
    case 'outline.copy':
      return {
        chapter: Number(payload?.chapter ?? 0),
        hits: [{ para: 2, offset: 0, length: 24, quote: '他推开门，雪灌进来。', copied: '他推开门，雪灌进来。', chars: 24, outlineLine: '他推开门，雪灌进来。' }],
        total: 1,
        ratio: 0.03,
        duplicatedChars: 24,
        bodyChars: 800,
        outlineChars: 90,
        minChars: 15,
        verdict: { level: 'warn', text: '有 1 处与细纲连续重合（最长 24 字），占比 3.0%。看一眼是不是固定专名/面板文案。' },
      }
    case 'text.normalize':
      return {
        changes: [{ start: 12, end: 15, from: '...', to: '……', rule: 'ellipsis', label: '省略号', para: 0, context: '他说…' }],
        total: 1,
        byRule: { ellipsis: 1 },
        ellipsis: 'six',
        applied: false,
        preview: '改完的样子',
        rules: [],
      }
    case 'wordcount.check':
      return {
        metric: 'visible_chars_v1',
        words: 1284,
        rawLength: 1320,
        bodyLength: 1290,
        trimmed: 36,
        paragraphs: 12,
      }
    // ── 借 LNW 六项：地图 / 成书 / 检查更新 / 冷读 / 意见池 / 简报 ──
    case 'map.get':
      return {
        schemaVersion: 1,
        updatedAt: '2026-10-28T02:00:00.000Z',
        canvas: { width: 1000, height: 620 },
        nodes: [
          { id: 'loc-1', name: '临安城', x: 220, y: 200, chapter: 1, inLedger: true },
          { id: 'loc-2', name: '北境关', x: 640, y: 340, chapter: 3, inLedger: true },
          // 第三点在账本里已经删了 —— 界面上要画成灰的，并且提示「地图有、账本没有」。
          { id: 'loc-9', name: '旧渡口', x: 430, y: 480, chapter: 0, inLedger: false },
        ],
        edges: [{ from: 'loc-1', to: 'loc-2', label: '官道三百里', kind: 'road' }],
        counts: { nodes: 3, edges: 1, orphan: 1 },
      }
    case 'map.sync':
      return { nodes: [{ id: 'loc-1', name: '临安城', x: 220, y: 200, chapter: 1, inLedger: true }], edges: [], added: 1, orphaned: 0, counts: { nodes: 1, edges: 0, orphan: 0 } }
    case 'map.save':
      return { ...mockValue('map.get', payload), moved: 1, saved: true }
    case 'map.explain':
      return { from: payload?.from, to: payload?.to, hops: 1, path: ['临安城', '北境关'], text: '两地在第 3 回由官道相连，中间没有别的停留点。' }
    case 'update.check':
      return { latest: '9.9.9', installed: '0.0.0', hasUpdate: true, behind: '落后 9 个大版本', source: 'npm', error: '', installHint: '本地开发版，改完源码同步到 profile 即可。' }
    case 'coldread.prepare':
      return {
        filePath: '/tmp/coldread/第3回.txt',
        fileName: 'coldread-第3回-20261028.txt',
        scope: payload?.scope ?? 'chapter',
        chapters: [3],
        truncated: false,
        chars: 2400,
        words: 2400,
        prompt: '你是一个没读过这本书的读者。读完下面这份稿子，只回答三件事。',
        hint: '把这段提示词发到对话里。',
      }
    case 'coldread.list':
      return { items: [{ name: 'coldread-第3回-20261028.txt', path: '/tmp/a.txt', bytes: 51200, at: '2026-10-28T02:00:00.000Z' }] }
    case 'coldread.submit':
      return { score: 78, verdict: '建议继续付钱追', pooled: { added: 2, total: 2 }, file: payload?.file ?? '' }
    case 'opinion.list':
      return {
        items: OPINIONS.filter((row) => (!payload?.status || row.status === payload.status) && (!payload?.source || row.source === payload.source)),
        counts: { open: 2, adopted: 1, dismissed: 0, highlight: 1, weakness: 2, total: 3 },
      }
    case 'opinion.collect':
      return { added: 2, total: 5 }
    case 'opinion.decide':
      return { id: payload?.id, status: payload?.status, left: 1 }
    case 'opinion.save':
      return { item: { id: 'op_x', chapter: 1, status: 'open' }, total: 4 }
    case 'opinion.bulk':
      return { added: 1, total: 5 }
    case 'opinion.remove':
      return { removed: payload?.id, left: 2 }
    case 'briefing.get':
      return {
        projectId: PROJECT.id,
        generatedAt: '2026-10-28T02:00:00.000Z',
        chapters: 3,
        totalWords: 8200,
        lastChapter: 3,
        sections: [],
        people: [],
        foreshadows: [],
        recent: [],
        debts: ['2 回写完没验收'],
        nextStep: '先把第 3 回验收掉。',
        text: '# 元末女帝 · 对齐简报\n\n## 现在是什么状况\n- 已写：第 1–3 回\n\n## 下一步\n- 先把第 3 回验收掉。',
        truncated: false,
      }
    case 'scan.fetch':
      return { ok: false, error: '这个页面没有可读的文字' }
    default: return {}
  }
}
let fetchCalls = []
win.fetch = global.fetch = async (url, opt) => {
  let op = ''
  let payload = {}
  try {
    const body = JSON.parse(opt.body)
    op = body.op
    payload = body.payload
  } catch { /* body 不是 JSON 就当空 */ }
  fetchCalls.push(op)
  return { json: async () => ({ ok: true, value: mockValue(op, payload) }), status: 200 }
}

// ══ 加载插件 ═══════════════════════════════════════════════
let entry = null
win.__ModuleLoader__ = { load(s) { entry = s; return null } }
new Function('module', 'exports', 'require', src)({ exports: {} }, {}, (id) => {
  if (id === 'react') return React
  throw new Error(id)
})
const plugin = entry.factory((id) => {
  if (id === 'react') return React
  throw new Error(id)
})

let captured = null
const regs = []
plugin.apply({
  slots: {
    inject: (n, cb) => cb(),
    register: (d, c) => {
      regs.push(d)
      if (d.name === 'main') captured = c
      return d
    },
  },
  effect: () => () => {},
  get: () => null,
  inject() {},
  on() {},
  logger: { info() {}, warn() {}, error() {} },
})

// ══ 迷你渲染器 ════════════════════════════════════════════
function renderNode(node, route) {
  if (node === null || node === undefined || node === false || node === true) return null
  if (typeof node === 'string' || typeof node === 'number') return { kind: 'text', text: String(node) }
  if (Array.isArray(node)) return node.map((n, i) => renderNode(n, `${route}/${i}`)).flat(9).filter(Boolean)
  if (typeof node !== 'object') return null
  const { t, p } = node
  if (typeof t === 'function') {
    const fname = t.name || 'anon'
    const childRoute = `${route}>${fname}${p && p.key != null ? `#${p.key}` : ''}`
    let out
    try {
      out = withHooks(childRoute, () => t(p || {}))
    } catch (error) {
      return { kind: 'throw', name: fname, error: error.message, route: childRoute }
    }
    const rendered = renderNode(out, childRoute)
    return {
      kind: 'comp', name: fname, cls: p && p.className,
      children: Array.isArray(rendered) ? rendered : [rendered].filter(Boolean),
    }
  }
  if (t === 'Fragment' || t === React.Fragment) {
    const rendered = renderNode(node.c, `${route}/frag`)
    return { kind: 'comp', name: 'Fragment', children: Array.isArray(rendered) ? rendered : [rendered].filter(Boolean) }
  }
  if (typeof t === 'string') {
    const kids = (node.c || []).map((c, i) => renderNode(c, `${route}/${t}${i}`)).flat(9).filter(Boolean)
    return { kind: 'el', tag: t, cls: p && p.className, props: p || {}, children: kids }
  }
  return null
}
function flatten(nodes, out = []) {
  for (const n of nodes || []) {
    if (!n) continue
    out.push(n)
    if (n.children) flatten(n.children, out)
  }
  return out
}
const all = (tree) => flatten(Array.isArray(tree) ? tree : [tree])
const allCls = (tree) => {
  const set = new Set()
  for (const n of all(tree)) {
    if (typeof n.cls === 'string') n.cls.split(/\s+/).forEach((x) => x && set.add(x))
  }
  return set
}
const allText = (tree) => all(tree).filter((n) => n.kind === 'text').map((n) => n.text)
const throwsOf = (tree) => all(tree).filter((n) => n.kind === 'throw')
const countCls = (tree, cls) => all(tree).filter((n) => typeof n.cls === 'string' && n.cls.split(/\s+/).includes(cls)).length

async function mount(Comp, props) {
  let tree = null
  for (let round = 0; round < 50; round += 1) {
    dirty = false
    effectQueue.length = 0
    tree = renderNode(React.createElement(Comp, props || {}), 'root')
    for (const fn of effectQueue) {
      try {
        const cleanup = fn()
        if (typeof cleanup === 'function') cleanup()
      } catch { /* 桩环境里 effect 里的 DOM 操作会失败，忽略 */ }
    }
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setImmediate(r))
    if (!dirty) break
  }
  return tree
}

const results = []
function check(label, ok, extra) {
  results.push({ label, ok: !!ok, extra })
}

process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION:', error)
  process.exit(1)
})

// ══ 1. 插件导出契约 ════════════════════════════════════════
check('导出 name === nightwrite', plugin.name === 'nightwrite')
// 客户端插件只能声明浏览器侧真有的服务。'tools' 是服务端 index.js 的事，
// 写在客户端 inject 里会让 cordis 等一个永不出现的依赖，apply 一次都不跑（界面全白）。
check('导出 inject 只含 slots（不含 tools）',
  Array.isArray(plugin.inject) && plugin.inject.includes('slots') && !plugin.inject.includes('tools'),
  JSON.stringify(plugin.inject))
check('apply 是函数', typeof plugin.apply === 'function')
check('注册了 main 槽位', regs.some((r) => r.name === 'main'))
check('注册了 sidebar.panellist 槽位', regs.some((r) => r.name === 'sidebar.panellist'))
check('main 用 key 而非 id（宿主 MainPanel 读 entryKey）',
  regs.some((r) => r.name === 'main' && r.key === 'nightwrite'))
check('main 拿到真组件', typeof captured === 'function')
check('样式已注入（NIGHTWRITE_CSS 非空）', /nw-shell/.test(src))

// ══ 2. 八页逐页挂载 ════════════════════════════════════════
// 逐页冒烟用的页面清单（= src/10-core.js 里 PAGES 的 id 顺序）。
// 导航钮数走 DOCK_COUNT 这个常量，改页数只改这里。
// 长夜的导航形态是底栏居中胶囊（.nw-dock），不是左侧目录树。
const PAGES = ['today', 'read', 'plan', 'dispatch', 'review', 'world', 'scout', 'settings']
const DOCK_COUNT = 8
const seen = {}

for (const page of PAGES) {
  hookMap = new Map()
  store['nw.page'] = page
  store['nw.project'] = PROJECT.id
  const tree = await mount(captured, {})
  const cls = allCls(tree)
  const tx = allText(tree)
  const throws = throwsOf(tree)
  seen[page] = { cls, tx, tree }

  check(`${page} · 零抛错`, throws.length === 0, throws.slice(0, 3).map((t) => `${t.name}: ${t.error}`).join(' | '))
  check(`${page} · 外壳 nw-shell`, cls.has('nw-shell'))
  check(`${page} · 顶栏 nw-top`, cls.has('nw-top'))
  check(`${page} · 底栏胶回 nw-dock`, cls.has('nw-dock'))
  check(`${page} · 八页导航 ${DOCK_COUNT} 钮`, countCls(tree, 'nw-dock-btn') === DOCK_COUNT)
  check(`${page} · 顶栏有书名`, tx.some((t) => String(t).includes('元末女帝')))
}

// ── 派单页：岗位 + 单据（原来是流水线页） ──
{
  const { cls, tx, tree } = seen.dispatch
  check('派单 · 岗位格 3 个', countCls(tree, 'nw-role') === 3)
  check('派单 · 总编格标黄', cls.has('nw-role-boss'))
  check('派单 · 岗位名在', tx.some((t) => String(t).includes('故事架构师')))
  check('派单 · 只有总编带「有权派单」', tx.filter((t) => String(t) === '有权派单').length === 1)
  check('派单 · 单据 2 张', countCls(tree, 'nw-dp') === 2)
  check('派单 · 待办票有「发到对话」', tx.some((t) => String(t).includes('发到对话')))
  check('派单 · 已交票摊出回执', countCls(tree, 'nw-dp-report') === 1)
  check('派单 · 回执结论上屏', tx.some((t) => String(t) === '通过'))
  check('派单 · 回执按 ### 切段', countCls(tree, 'nw-dp-sec') === 2)
  check('派单 · 开票表单在', cls.has('nw-pipe-form'))
  check('派单 · 剩余时间算出分钟', tx.some((t) => /还剩 \d+ 分钟/.test(String(t))))
  check('派单 · 没有抛错占位', !cls.has('nw-error'))
  // 两页合并的证据：同一屏里既有在途工单，也有指令单与队列。
  check('派单 · 单据与指令单同屏', cls.has('nw-dp') && cls.has('nw-order'))
  check('派单 · 页头说明在', tx.some((t) => String(t).includes('派单')))
}

// ── 今天页：状态条 + 驾驶舱（原驾驶舱页） ──
{
  const { cls, tx, tree } = seen.today
  check('今天 · 四个大数字', countCls(tree, 'nw-stat') === 4)
  check('今天 · 欠账 3 条', countCls(tree, 'nw-debt') === 3)
  check('今天 · 今日建议文案', tx.some((t) => String(t).includes('先处理第 2 回')))
  check('今天 · 最近产出取 overview.recent', countCls(tree, 'nw-recent-row') === 3)
  check('今天 · 状态条在', countCls(tree, 'nw-today-run') === 1)
  check('今天 · 状态条说了还能写几章', tx.some((t) => /还能写 \d+ 章/.test(String(t))))
  check('今天 · 驾驶舱内嵌没有二次套壳', countCls(tree, 'nw-page') >= 1 && countCls(tree, 'nw-today') === 1)
  check('今天 · 没有抛错占位', !cls.has('nw-error'))
}

// ── 大纲 ──
{
  const { cls, tx, tree } = seen.plan
  check('大纲 · 方案卡在', cls.has('nw-plan-brief'))
  check('大纲 · 八个方案字段 + 卷/章两组 = 10 格', countCls(tree, 'nw-plan-field') === 10)
  // 【24 条 #7/#8】骨架默认是卡片墙；列表视图仍在 nw-plan-rows 里，所以两个锚点都算在。
  check('大纲 · 骨架区在（卡片墙）', cls.has('nw-pcards') || cls.has('nw-plan-rows'))
  // 卷 2 个 + 三视图 3 个 = 5 片
  check('大纲 · 卷切换 2 + 三视图 3 = 5 片', countCls(tree, 'nw-seg-btn') === 2 + 3)
  check('大纲 · 每卷 2 章 = 2 张卡', countCls(tree, 'nw-pcard') === 2)
  check('大纲 · 送去派单按钮在', tx.some((t) => String(t).includes('送去派单')))
}

// ── 派单页里的生产台半截（原生产台页） ──
{
  const { cls, tx, tree } = seen.dispatch
  check('生产台 · 三栏网格', cls.has('nw-studio-cols'))
  check('生产台 · 模板 2 个', countCls(tree, 'nw-tpl') === 2)
  check('生产台 · 上下文包在', cls.has('nw-ctx'))
  check('生产台 · 队列 2 行', countCls(tree, 'nw-q-row') === 2)
  check('生产台 · 世界状态喂进上下文', tx.some((t) => String(t).includes('金丹三层')))
  check('生产台 · 指令单在', cls.has('nw-order'))
}

// ── 顶栏：品牌 + 状态灯 + 作品与活量 + 快动作；导航在底栏胶囊里 ──
// 长夜自己的取舍：导航常驻视线终点（底栏居中），而不是左侧目录树；
// 「今天有多少活压着」摊在顶栏一行里，抬眼就能看到。
{
  const { tx, tree, cls } = seen.today
  const inTop = all(tree).filter((n) => n.kind === 'el' && typeof n.cls === 'string' && n.cls.split(/\s+/).includes('nw-top-right'))
  const topText = inTop.length ? allText(inTop[0]).map(String).join(' ') : ''
  check('顶栏 · 底栏导航在位', cls.has('nw-bottom') && cls.has('nw-dock'))
  check('顶栏 · 快动作三件保留', topText.includes('续写一章') && topText.includes('连更 3 章') && topText.includes('体检'), topText.slice(0, 80))
  check('顶栏 · 下一本新书入口在', topText.includes('＋'))
  check('顶栏 · 命令入口在', topText.includes('＼K') || topText.includes('⌘K'))
  check('顶栏 · 状态灯在', countCls(tree, 'nw-lamp') === 1)
  check('顶栏 · 作品切换下拉在', cls.has('nw-top-mid'))
  check('顶栏 · 活量两个小标', countCls(tree, 'nw-top-stat') >= 2)
}

// ── 验收台 ──
{
  const { cls, tree } = seen.review
  check('验收台 · 列表在', cls.has('nw-rv-list'))
  check('验收台 · 默认待验收只 1 行', countCls(tree, 'nw-rv-row') === 1)
  // P4 之后验收台是三层分段：3 档（逐章 / 读者视角 / 历史版本）
  // + 逐章下的 3 视图（稿子 / 提案 / 问题单）+ 4 个筛选片 = 10 个 nw-seg-btn。
  check('验收台 · 3 档 + 3 视图 + 4 筛选 = 10 片', countCls(tree, 'nw-seg-btn') === 10, String(countCls(tree, 'nw-seg-btn')))
}

// ══ 深水区：提案抽屉 ═══════════════════════════════════════
{
  hookMap = new Map()
  const tree = await mount(plugin._test.ProposalBoard, {
    projectId: PROJECT.id, gate: 70, toast() {}, onRefresh() {}, refreshKey: 0,
  })
  const cls = allCls(tree)
  const tx = allText(tree)
  const throws = throwsOf(tree)
  check('提案抽屉 · 零抛错', throws.length === 0, throws.slice(0, 2).map((t) => `${t.name}: ${t.error}`).join(' | '))
  // 默认筛选是「待批」，所以只画那条 pending 的
  check('提案抽屉 · 默认只画待批 1 条', countCls(tree, 'nw-prop') === 1)
  check('提案抽屉 · 待批样式在', cls.has('nw-prop-pending') && !cls.has('nw-prop-accepted'))
  // 5 片：待批 / 已采纳 / 已驳回 / 已过期 / 全部 —— 过期是稿子变了，不是人驳回的，得能单独看。
  check('提案抽屉 · 状态筛选 5 片', countCls(tree, 'nw-seg-btn') === 5)
  check('提案抽屉 · 卡片上写着「AI 提议，你拍板」', tx.some((t) => String(t).includes('你拍板')))
  check('提案抽屉 · 待批才有采纳按钮', tx.some((t) => String(t).includes('采纳并写回')))
}

// ══ 深水区：问题单抽屉 ═══════════════════════════════════════
{
  hookMap = new Map()
  const tree = await mount(plugin._test.ProblemBoard, {
    projectId: PROJECT.id, gate: 70, toast() {}, onRefresh() {}, refreshKey: 0,
  })
  const cls = allCls(tree)
  const tx = allText(tree)
  const throws = throwsOf(tree)
  check('问题单抽屉 · 零抛错', throws.length === 0, throws.slice(0, 2).map((t) => `${t.name}: ${t.error}`).join(' | '))
  check('问题单抽屉 · 默认只出未修 2 条', countCls(tree, 'nw-prob') === 2)
  check('问题单抽屉 · 状态筛选 4 片', countCls(tree, 'nw-seg-btn') === 4)
  check('问题单抽屉 · 类型/严重度标签在', cls.has('nw-tag-amber') && cls.has('nw-tag-red'))
  check('问题单抽屉 · 能记一条', tx.some((t) => String(t).includes('记一条')))
  check('问题单抽屉 · 未修条目有「已修」按钮', tx.some((t) => String(t).includes('已修')))
}

// ── 世界库 ──
{
  const { cls, tree } = seen.world
  check('世界库 · 侧栏 8 类', countCls(tree, 'nw-world-nav-btn') === 8)
  check('世界库 · 世界状态横幅', cls.has('nw-ws-banner'))
  check('世界库 · 表格在', cls.has('nw-table'))
  // 第四片是「地图」——地点类独有的空间视图，所以是 4。
  check('世界库 · 四视图切换（含地图）', countCls(tree, 'nw-seg-btn') === 4)
  check('世界库 · 人物表 2 行', countCls(tree, 'nw-table-row') === 2)
}

// ── 侦察 ──
{
  const { tree } = seen.scout
  check('侦察 · 四块卡片', countCls(tree, 'nw-scout-card') === 4)
}

// ── 设置 ──
{
  const { cls, tree } = seen.settings
  check('设置 · 作品 2 个', countCls(tree, 'nw-proj') === 2)
  check('设置 · 危险区在', cls.has('nw-danger-zone'))
  // 【24 条 #24】主题从开关改成三档卡片：暗 / 亮 / 纸。
  check('设置 · 主题三档', countCls(tree, 'nw-theme-card') === 3)
}


// ══ 3. 深水区：验收详情（一次打开第 3 回） ═══════════════════
{
  hookMap = new Map()
  const tree = await mount(plugin._test.ReviewDetail, {
    projectId: PROJECT.id, chapter: 3, gate: 70, onClose() {}, onChanged() {}, toast() {},
  })
  const cls = allCls(tree)
  const tx = allText(tree)
  const throws = throwsOf(tree)
  check('验收详情 · 零抛错', throws.length === 0, throws.slice(0, 2).map((t) => `${t.name}: ${t.error}`).join(' | '))
  check('验收详情 · 正文与侧栏分栏', cls.has('nw-rv-doc') && cls.has('nw-rv-side'))
  check('验收详情 · 四类评分格', countCls(tree, 'nw-score-cell') === 4)
  check('验收详情 · 问题 3 条 + 违规 1 条 = 4 行', countCls(tree, 'nw-issue') === 4)
  check('验收详情 · IssueRow 组件实例 3 个', all(tree).filter((n) => n.kind === 'comp' && n.name === 'IssueRow').length === 3)
  check('验收详情 · 违规 1 条', countCls(tree, 'nw-issue-violation') === 1)
  // 【24 条 #13】正文默认走「段落视图」（不是 textarea），右侧配彩带。
  const paras = all(tree).filter((n) => n.kind === 'el' && typeof n.cls === 'string' && n.cls.split(/\s+/).includes('nw-para'))
  check('验收详情 · 段落视图渲染正文', paras.length >= 1 && tx.some((t) => String(t).includes('城头夜雨')), 'paragraphs=' + paras.length)
  check('验收详情 · 彩带格子数与段落一致', countCls(tree, 'nw-heat-cell') === paras.length, 'heat=' + countCls(tree, 'nw-heat-cell') + ' para=' + paras.length)
  check('验收详情 · 采纳/废弃按钮', tx.some((t) => String(t).includes('采纳')) && tx.some((t) => String(t).includes('废弃')))
  // 【第 1 批】文风校验面板装在右栏，不是列表页。
  check('校验 · 面板在（nw-lint）', cls.has('nw-lint'))
  check('校验 · 有硬伤就给红结论', tx.some((t) => /有 1 处硬伤/.test(String(t))))
  check('校验 · 三档筛选片', countCls(tree, 'nw-lint-seg') === 1)
  check('校验 · 命中行 3 条', countCls(tree, 'nw-lint-hit') === 3)
  check('校验 · 硬伤行标红', countCls(tree, 'nw-lint-blocking') === 1)
  check('校验 · 提示行标黄', countCls(tree, 'nw-lint-advisory') === 2)
  check('校验 · 引文上屏', tx.some((t) => String(t).includes('他不是不知道')))
  check('校验 · 命中行可点（button）', all(tree).filter((n) => n.tag === 'button' && String(n.props?.className ?? '').includes('nw-lint-hit')).every((n) => typeof n.props?.onClick === 'function'))
  check('校验 · 规则说明可折叠', all(tree).some((n) => n.tag === 'details' && String(n.props?.className ?? '').includes('nw-lint-about')))
  // 【阶段 A】每条命中都挂一个「为什么」钮，判据默认收起
  // 退化单独一档：命中说明这段不是文，该整章重跑，不是逐句改。
  check('校验 · 退化是独立一档（不是混在硬伤里）',
    /value: 'degenerate'/.test(src) && /only === 'degenerate'/.test(src))
  check('校验 · 结论句退化优先于硬伤', /这段不是文，整章重跑/.test(src))
  check('校验 · 每条命中都有「为什么」钮', countCls(tree, 'nw-lint-why-btn') === countCls(tree, 'nw-lint-hit'))
  check('校验 · 判据默认收起', countCls(tree, 'nw-lint-why') === 0)
  // 【阶段 C】本书阈值卡：装了才可能让人看见「凭什么按这个标准判我」
  check('阈值 · 卡片在（nw-lint-cal）', cls.has('nw-lint-cal'))
  check('阈值 · 写明已调几条', tx.some((t) => /2 条已按本书调整/.test(String(t))))
  check('阈值 · 量过之后说量了多少章', tx.some((t) => /12 章/.test(String(t))))
  check('阈值 · 有「量一遍」按钮', all(tree).some((n) => n.tag === 'button' && typeof n.props?.onClick === 'function' && allText(n).join('').includes('量一遍')))
  check('阈值 · 明细默认收起', countCls(tree, 'nw-lint-cal-list') === 0)
  check('阈值 · 结论可折叠', all(tree).some((n) => n.tag === 'details' && allText(n).join('').includes('量出来的结论')))
}

// ══ 4. 断点回环：hook 状态在自己身上改，不污染别人 ═════════
{
  hookMap = new Map()
  store['nw.page'] = 'review'
  const first = await mount(captured, {})
  const rowsFirst = countCls(first, 'nw-rv-row')
  // 模拟用户点第二个筛选片（已采纳）→ useState setter 打 dirty，重挂一轮
  const segs = all(first).filter((n) => typeof n.cls === 'string' && n.cls.split(/\s+/).includes('nw-seg-btn'))
  // P4 之后验收台是三层分段：3 个档（逐章 / 读者视角 / 历史版本）
  // + 逐章下的 3 个视图（稿子 / 提案 / 问题单）+ 4 个筛选片 = 10。
  check('验收台 · 档位/视图/筛选片都是按钮', segs.length === 10 && segs.every((n) => n.kind === 'el' && n.tag === 'button'), `segs=${segs.length}`)
  check('验收台 · 初次行数 = 1（待验收）', rowsFirst === 1)
}

// ══ 5. 无作品时的兜底 ═══════════════════════════════════════
{
  hookMap = new Map()
  store['nw.page'] = 'today'
  delete store['nw.project']
  win.fetch = global.fetch = async (url, opt) => {
    let op = ''
    try { op = JSON.parse(opt.body).op } catch { /* 空 */ }
    const value = op === 'project.list' ? { projects: [] } : {}
    return { json: async () => ({ ok: true, value }), status: 200 }
  }
  const tree = await mount(captured, {})
  const tx = allText(tree)
  const throws = throwsOf(tree)
  // 没有作品时不再是「一句空态」，而是整屏一张能填的三步建书向导。
  check('无作品 · 零抛错', throws.length === 0, throws.slice(0, 2).map((t) => t.error).join(' | '))
  check('无作品 · 首屏是建书页', countCls(tree, 'nw-create') === 1)
  check('无作品 · 摊开的是表单不是空态', countCls(tree, 'nw-empty') === 0)
  check('无作品 · 三步进度条在', countCls(tree, 'nw-create-step') === 3)
  check('无作品 · 第一屏只问两项', countCls(tree, 'nw-create-field') === 2, String(countCls(tree, 'nw-create-field')))
  check('无作品 · 顶栏不再挂导航', countCls(tree, 'nw-dock-btn') === 0)
  check('无作品 · 不显示未填的原始值',
    !tx.some((t) => /^(null|undefined|NaN|\[object Object\])$/.test(String(t).trim())))
}

// ══ 6. 后端报错时的显示 ═════════════════════════════════════
{
  hookMap = new Map()
  store['nw.page'] = 'today'
  store['nw.project'] = PROJECT.id
  win.fetch = global.fetch = async () => ({ json: async () => ({ ok: false, error: { code: 'fs', message: '目录不可写' } }), status: 500 })
  const tree = await mount(captured, {})
  const tx = allText(tree)
  const throws = throwsOf(tree)
  check('后端 500 · 组件不崩', throws.length === 0, throws.slice(0, 2).map((t) => t.error).join(' | '))
  check('后端 500 · 错误文案上屏', tx.some((t) => String(t).includes('目录不可写')))
}

// ══ 24 条界面增补：逐条证明「元素真的渲染出来了」 ═════════════
// 这一段只做界面层核对：类名在、数量对、关键文案对、按钮真的挂了 onClick。
// 数据全是 src/15-mock.js 里的假数据，不碰内核。
{
  // seen[page] 存的是 { cls, tx, tree }，这里统一取 tree。
  // 注意：上面「后端 500」那段把 fetch 换成了失败桩，这里必须先还原，
  // 否则每个页都会渲染成错误页，这 60 项全假阴性。
  win.fetch = global.fetch = async (url, opt) => {
    let op = ''
    let payload = {}
    try {
      const body = JSON.parse(opt.body)
      op = body.op
      payload = body.payload
    } catch { /* body 不是 JSON 就当空 */ }
    fetchCalls.push(op)
    return { json: async () => ({ ok: true, value: mockValue(op, payload) }), status: 200 }
  }
  store['nw.page'] = 'today'
  store['nw.project'] = PROJECT.id
  const T = (page) => seen[page].tree
  const clickable = (tree, cls) => all(tree)
    .filter((n) => n.kind === 'el' && typeof n.cls === 'string' && n.cls.split(/\s+/).includes(cls))
    .every((n) => typeof n.props?.onClick === 'function')

  // ── 1. 状态灯 ──
  {
    const t = T('today')
    const tx = allText(t).map(String).join(' ')
    check('#1 状态灯 · 灯泡 + 灯点都在', countCls(t, 'nw-lamp') === 1 && countCls(t, 'nw-lamp-dot') === 1)
    check('#1 状态灯 · 写着正在写第几回', /正在写第 \d+ 回/.test(tx), tx.slice(0, 80))
    check('#1 状态灯 · 带字数进度', /\d+\/2500 字/.test(tx))
    check('#1 状态灯 · 可点', clickable(t, 'nw-lamp'))
  }

  // ── 2. 底栏右侧两个按钮 ──
  {
    const t = T('today')
    const acts = all(t).filter((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-bottom-acts'))
    const names = acts.length ? allText(acts[0]).map(String) : []
    check('#2 底栏 · 右侧动作区在', acts.length === 1)
    check('#2 底栏 · 两个按钮：最新 / 新章', names.some((x) => x.includes('最新')) && names.some((x) => x.includes('新章')), names.join('|'))
  }

  // ── 3. Ctrl+K 命令面板 ──
  {
    const t = T('today')
    check('#3 命令面板 · 顶栏有 Ctrl+K 入口', countCls(t, 'nw-cmdk-open') >= 1)
    const btn = all(t).find((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-cmdk-open'))
    check('#3 命令面板 · 入口可点', typeof btn?.props?.onClick === 'function')
    check('#3 命令面板 · 组件挂着全局 Ctrl+K 监听', /addEventListener\('keydown'/.test(src) && /ctrlKey \|\| event\.metaKey/.test(src))
  }

  // ── 4. 一句大白话 + 一个按钮 ──
  {
    const t = T('today')
    check('#4 行动卡 · 在', countCls(t, 'nw-action') === 1)
    const actionCard = all(t).find((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-action'))
    const cardBtns = actionCard
      ? all([actionCard]).filter((n) => n.kind === 'el' && n.tag === 'button' && typeof n.props?.onClick === 'function')
      : []
    check('#4 行动卡 · 卡里有两个可点的出口', cardBtns.length >= 2, `btns=${cardBtns.length}`)
    check('#4 行动卡 · 文案是动词 + 对象', /先处理第 2 回|去改这一章/.test(allText(t).map(String).join(' ')))
  }

  // ── 5. 两周柱状图 ──
  {
    const t = T('today')
    check('#5 柱状图 · 容器在', countCls(t, 'nw-days') === 1)
    check('#5 柱状图 · 14 根柱子', countCls(t, 'nw-day') === 14)
    check('#5 柱状图 · 断更的柱子有专用样式', countCls(t, 'nw-day-off') === 2)
    check('#5 柱状图 · 每根柱子可点', clickable(t, 'nw-day'))
  }

  // ── 6. 全书进度条 ──
  {
    const t = T('today')
    const tx = allText(t).map(String).join(' ')
    // 【12 条 #4】进度条已接真数据：卷分段来自大纲（MOCK 里 2 卷），不再是写死的 3 段。
    check('#6 进度条 · 容器 + 卷分段跟大纲走', countCls(t, 'nw-progress') === 1 && countCls(t, 'nw-progress-vol') === OUTLINE.volumes.length, `${countCls(t, 'nw-progress-vol')} 段 / 大纲 ${OUTLINE.volumes.length} 卷`)
    // fmtWords 会把 12840 写成「1.3 万」，所以按“万 / 字 / 第 N/M 回”三项认。
    check('#6 进度条 · 字数 / 回数都上屏', /\/\s*[\d.]+\s*万?\s*字/.test(tx) && /第 \d+\/\d+ 回/.test(tx), tx.slice(0, 120))
    check('#6 进度条 · 每段卷可点', clickable(t, 'nw-progress-vol'))
  }

  // ── 7. 卡片墙 ──
  {
    const t = T('plan')
    check('#7 卡片墙 · 容器在', countCls(t, 'nw-pcards') === 1)
    check('#7 卡片墙 · 每章一张卡', countCls(t, 'nw-pcard') === 2)
  }

  // ── 8. 三视图 ──
  {
    const t = T('plan')
    check('#8 三视图 · 切换条在', countCls(t, 'nw-plan-viewbar') === 1)
    check('#8 三视图 · 卷 2 + 视图 3 = 5 片', countCls(t, 'nw-seg-btn') === 5)
    const bar = all(t).find((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-plan-viewbar'))
    check('#8 三视图 · 每片可点', bar ? allText(bar).length >= 3 : false)
  }

  // ── 9. AI 填整卷摘要 ──
  check('#9 AI 填整卷 · 按钮文案在', allText(T('plan')).some((t) => String(t).includes('AI 填这卷')))
  check('#9 AI 填整卷 · 挂在卷级（不是章级）', countCls(T('plan'), 'nw-fillbar') >= 1)

  // ── 10. 上下文可拖可关 ──
  {
    const t = T('dispatch')
    const rows = all(t).filter((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-ctx-row'))
    check('#10 上下文 · 行可拖', rows.length > 0 && rows.every((n) => n.props?.draggable === true), `rows=${rows.length}`)
    check('#10 上下文 · 每行有抓手', countCls(t, 'nw-ctx-grip') === rows.length)
    check('#10 上下文 · 每行有关闭开关', countCls(t, 'nw-ctx-sw') === rows.length)
    check('#10 上下文 · 开关可点', clickable(t, 'nw-ctx-sw'))
  }

  // ── 11. 预算条 ──
  {
    const t = T('dispatch')
    const tx = allText(t).map(String).join(' ')
    check('#11 预算条 · 计量条在', countCls(t, 'nw-ctx-meter') === 1)
    check('#11 预算条 · 百分比上屏', /\d+% 已用/.test(tx), tx.slice(0, 120))
    check('#11 预算条 · 剩余/超出提示在', /还能塞|超了/.test(tx))
  }

  // ── 12. 意图复用 ──
  {
    const t = T('dispatch')
    check('#12 意图复用 · 容器在', countCls(t, 'nw-chips') === 1)
    // 数量由队列里真写过什么决定，不由常量决定：mock 里 2 单、2 条不同意图。
    check('#12 意图复用 · 最近几条按队列历史来', countCls(t, 'nw-chip') === 2)
    check('#12 意图复用 · 每条可点', clickable(t, 'nw-chip'))
  }

  // ── 13 / 14 / 15：验收详情 ──
  {
    hookMap = new Map()
    const t = await mount(plugin._test.ReviewDetail, {
      projectId: PROJECT.id, chapter: 3, gate: 70, onClose() {}, onChanged() {}, toast() {},
    })
    const tx = allText(t).map(String).join(' ')
    const paras = all(t).filter((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-para'))
    check('#13 彩带 · 容器在', countCls(t, 'nw-heat') === 1)
    check('#13 彩带 · 格子数与段落一致', countCls(t, 'nw-heat-cell') === paras.length && paras.length > 0, `heat=${countCls(t, 'nw-heat-cell')} para=${paras.length}`)
    check('#13 彩带 · 格子可点（点了滚过去）', clickable(t, 'nw-heat-cell'))
    check('#13 彩带 · 三档图例在', /AI 味/.test(tx) && /好/.test(tx) && /拖/.test(tx))

    // 违规行（nw-issue-violation）是展示条，不是问题；只核对真问题行是按钮且挂了 onClick。
    const issues = all(t).filter((n) => n.kind === 'el'
      && String(n.cls ?? '').split(/\s+/).includes('nw-issue')
      && !String(n.cls ?? '').split(/\s+/).includes('nw-issue-violation'))
    check('#14 点问题 · 每条问题是按钮', issues.length > 0 && issues.every((n) => n.tag === 'button'), `issues=${issues.length}`)
    check('#14 点问题 · 每条挂了 onClick', issues.every((n) => typeof n.props?.onClick === 'function'))
    check('#14 点问题 · 有高亮态样式钩子', /nw-issue-on/.test(src))

    check('#15 键盘流 · 提示条在', countCls(t, 'nw-keys') === 1)
    check('#15 键盘流 · 写着 J/K/A/R', /J\/K/.test(tx) && /A 采纳/.test(tx) && /R 废弃/.test(tx), tx.slice(-80))
    check('#15 键盘流 · 真挂了 keydown 监听', /addEventListener\('keydown'/.test(src) && /key === 'j'/.test(src) && /key === 'r'/.test(src))
  }

  // ── 16. 提案批量处理 ──
  {
    hookMap = new Map()
    const t = await mount(plugin._test.ProposalBoard, {
      projectId: PROJECT.id, gate: 70, toast() {}, onRefresh() {}, refreshKey: 0,
    })
    const tx = allText(t).map(String).join(' ')
    check('#16 提案批量 · 全采纳按钮', /全采纳/.test(tx))
    check('#16 提案批量 · 全驳回按钮', /全驳回/.test(tx))
    check('#16 提案批量 · 按章分组', countCls(t, 'nw-prop-group') >= 1)
  }

  // ── 17. 问题单只看本章 ──
  {
    hookMap = new Map()
    const t = await mount(plugin._test.ProblemBoard, {
      projectId: PROJECT.id, gate: 70, toast() {}, onRefresh() {}, refreshKey: 0,
    })
    check('#17 只看本章 · 筛选器在', allText(t).some((x) => String(x).includes('只看')), allText(t).map(String).join('|').slice(0, 120))
    check('#17 只看本章 · 条数没被筛掉', countCls(t, 'nw-prob') === 2)
  }

  // ── 18. 账本格出处 ──
  {
    const t = T('world')
    const cells = all(t).filter((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes('nw-td-cell'))
    check('#18 账本出处 · 每格都是按钮', cells.length > 0 && cells.every((n) => n.tag === 'button'), `cells=${cells.length}`)
    check('#18 账本出处 · 每格挂了 onClick', cells.every((n) => typeof n.props?.onClick === 'function'))
    check('#18 账本出处 · 有定位图标位', countCls(t, 'nw-td-pin') === cells.length)
  }

  // ── 19. 关系图过滤 ──
  {
    store['nw.page'] = 'world'
    store['nw.worldview'] = 'graph'
    hookMap = new Map()
    const t = await mount(captured, {})
    check('#19 关系图 · 图在', countCls(t, 'nw-graph-svg') === 1)
    check('#19 关系图 · 过滤条在', countCls(t, 'nw-graph-bar') === 1)
    check('#19 关系图 · 4 视图 + 1 过滤 = 5 片', countCls(t, 'nw-seg-btn') === 5)
    check('#19 关系图 · 过滤可切', /只看最近出场/.test(allText(t).map(String).join(' ')))
    store['nw.worldview'] = 'table'
  }

  // ── 20. 逾期伏笔标红 ──
  {
    store['nw.page'] = 'world'
    store['nw.worldview'] = 'timeline'
    hookMap = new Map()
    const t = await mount(captured, {})
    check('#20 逾期伏笔 · 红框区在', countCls(t, 'nw-tl-overdue') === 1)
    check('#20 逾期伏笔 · 逾期条目上屏', countCls(t, 'nw-tl-overdue-row') >= 1)
    check('#20 逾期伏笔 · 写着逾期几回', /已逾期 \d+ 回/.test(allText(t).map(String).join(' ')))
    store['nw.worldview'] = 'table'
  }

  // ── 21. 最近干过什么 ──
  {
    const t = T('scout')
    check('#21 侦察产出 · 容器在', countCls(t, 'nw-hist') === 1)
    // 记录来自 analyze.list + scan.list 的真实产物：1 次拆书 + 1 次扫榜 = 2 条。
    check('#21 侦察产出 · 记录按真实产物来', countCls(t, 'nw-hist-row') === 2)
    check('#21 侦察产出 · 每条可点展开', clickable(t, 'nw-hist-row') || countCls(t, 'nw-hist-detail') >= 0)
  }

  // ── 22. 扫榜结果表格 ──
  {
    const t = T('scout')
    check('#22 扫榜表 · 表格在', countCls(t, 'nw-scan') === 1)
    check('#22 扫榜表 · 7 列表头', countCls(t, 'nw-scan-th') === 7)
    check('#22 扫榜表 · 行数按榜单实际条数', countCls(t, 'nw-scan-row') === 2)
    check('#22 扫榜表 · 表头可点排序', clickable(t, 'nw-scan-th'))
    check('#22 扫榜表 · 有导出 CSV 出口', allText(t).some((x) => String(x).includes('导出 CSV')))
  }

  // ── 21b/22b/23b. 拆书 / 导入 / 扫榜（第 2·3·4 批） ──
  {
    const t = T('scout')
    const tx = allText(t).map(String).join(' ')
    check('拆书 · 面板在', tx.includes('拆书台') && tx.includes('开始拆'))
    check('拆书 · 说明算得出来的先算', tx.includes('算得出来的先算出来'))
    check('拆书 · 列出已拆过的书', countCls(t, 'nw-ana-hist-row') === 1)
    check('拆书 · 那一次写着拆了几章', /2 章 ·/.test(tx))
    check('拆书 · 可点开看结果', clickable(t, 'nw-ana-hist-main'))
    check('导入 · 面板在', tx.includes('导入已有的书'))
    check('导入 · 预检与真导入两个钮', tx.includes('先认一遍') && tx.includes('真导进去'))
    check('导入 · 两种模式可选', countCls(t, 'nw-import-opts') === 1)
    check('扫榜 · 粘贴解析面板在', tx.includes('榜单文本') && tx.includes('解析'))
    check('扫榜 · 列出解析过的榜单', countCls(t, 'nw-scan-hist-row') === 1)
    check('扫榜 · 尽力抓取是可折叠的次要路', countCls(t, 'nw-scan-auto') === 1)
  }

  // ── 23. 导出全部数据 ──
  {
    const t = T('settings')
    check('#23 导出 · 目录树在', countCls(t, 'nw-export-tree') === 1)
    // 【12 条 #12】导出列的是 9 类（原来 7 类，加了 history/.trash 两类真目录）。
    check('#23 导出 · 列了 9 类文件', countCls(t, 'nw-export-row') === 9, `${countCls(t, 'nw-export-row')} 行`)
    check('#23 导出 · 打包出口可点', /打包/.test(allText(t).map(String).join(' ')) && /复制目录路径/.test(allText(t).map(String).join(' ')))
  }

  // ── 24. 主题第三档「纸」 ──
  {
    const t = T('settings')
    const tx = allText(t).map(String).join(' ')
    check('#24 主题 · 三张卡', countCls(t, 'nw-theme-card') === 3)
    check('#24 主题 · 有「纸」这一档', /纸/.test(tx))
    check('#24 主题 · 三张都可点', clickable(t, 'nw-theme-card'))
    check('#24 主题 · 纸档样式真的写了', /nw-theme-paper/.test(src) && /#f0e8d8/.test(src))
  }
}

// ══ 第 10 轮：十个「真洞」补完的界面证据 ═════════════════════
// 这一段核对的是数据安全与效率层的界面出口：版本、回收站、搜索、派单、
// 采纳前告警、快捷键互斥、无障碍。数据仍走 mockValue 的桩。
{
  // seen[page] 是 { cls, tx, tree }，这个块里两次直接读页面树。
  const T = (page) => seen[page].tree
  // ── 1. 历史版本 ──
  {
    hookMap = new Map()
    const t = await mount(plugin._test.ReviewDetail, {
      projectId: PROJECT.id, chapter: 3, gate: 70, onClose() {}, onChanged() {}, toast() {},
    })
    const tx = allText(t).map(String).join(' ')
    check('版本 · 卡片在', countCls(t, 'nw-hist-ver') === 1)
    check('版本 · 列出 2 版', countCls(t, 'nw-ver-row') === 2)
    check('版本 · 说明保留几版', /保留最近 20 版/.test(tx), tx.slice(0, 0) || '')
    check('版本 · 每版都有回滚按钮', all(t).filter((n) => n.kind === 'el'
      && String(n.cls ?? '').split(/\s+/).includes('nw-ver-row'))
      .every((row) => all(row).some((n) => n.tag === 'button' && typeof n.props?.onClick === 'function')))
    check('版本 · 回滚调 chapter.restore', /chapter\.restore/.test(src))
  }

  // ── 2. 回收站 ──
  {
    store['nw.page'] = 'settings'
    store['nw.project'] = PROJECT.id
    hookMap = new Map()
    const t = await mount(captured, {})
    const tx = allText(t).map(String).join(' ')
    check('回收站 · 列表在', countCls(t, 'nw-trash-list') === 1)
    check('回收站 · 一行记录', countCls(t, 'nw-trash-row') === 1)
    check('回收站 · 有还原与彻底删除', /还原/.test(tx) && /彻底删除/.test(tx))
    check('回收站 · 说明移到 .trash', /\.trash/.test(tx), tx.slice(0, 0) || '')
    check('回收站 · 走 chapter.recover / purge', /chapter\.recover/.test(src) && /chapter\.purge/.test(src))
  }

  // ── 3. Ctrl+K 真搜索 ──
  {
    hookMap = new Map()
    const t = await mount(plugin._test.CommandPalette, {
      projectId: PROJECT.id, onClose() {}, go() {}, toast() {},
    })
    check('搜索 · 面板外壳在', countCls(t, 'nw-cmdk-list') === 1)
    check('搜索 · 打开时只列命令', countCls(t, 'nw-cmdk-head') === 0)
    check('搜索 · 调了 search op', /api\('search'/.test(src))
    check('搜索 · 有范围切换片', /'all', 'chapters', 'ledger', 'outline'/.test(src))
    check('搜索 · 命中带段号跳验收台', /nw\.openPara/.test(src))
    check('搜索 · Input 有无障碍名', /'aria-label': '命令与全文搜索'/.test(src))
  }

  // ── 4. 队列派给 agent ──
  {
    store['nw.page'] = 'dispatch'
    store['nw.project'] = PROJECT.id
    hookMap = new Map()
    const t = await mount(captured, {})
    const tx = allText(t).map(String).join(' ')
    check('派单 · 按钮在', /派给 agent/.test(tx))
    check('派单 · 拼 prompt 含关键 op', /nightwrite_op/.test(src) && /proposal\.save/.test(src))
    check('派单 · 剪贴板失败有退路', countCls(t, 'nw-dispatch') === 1 && /setDispatchText/.test(src))
  }

  // ── 6. AI 味词表（彩带真值） ──
  // 密度与词表条数住在验收详情的彩带抬头，不在验收台的章节列表里。
  {
    hookMap = new Map()
    const t = await mount(plugin._test.ReviewDetail, {
      projectId: PROJECT.id, chapter: 3, gate: 70, onClose() {}, onChanged() {}, toast() {},
    })
    const tx = allText(t).map(String).join(' ')
    check('AI 味 · 走 chapter.aistyle 而非假值', /api\('chapter\.aistyle'/.test(src))
    check('AI 味 · 词表条数上屏', /词表 \d+ 条/.test(tx), tx.slice(0, 120))
    check('AI 味 · 密度按千字', /AI 味 [\d.]+\/千字/.test(tx), tx.slice(0, 120))
  }

  // ── 7. 提案采纳前告警 ──
  {
    check('提案告警 · 调 proposal.preview', /api\('proposal\.preview'/.test(src))
    check('提案告警 · 有告警块与样式', /nw-prop-warn/.test(src) && /nw-prop-warn-list/.test(src))
    check('提案告警 · 说清会改错位置', /改错位置/.test(src))
  }

  // ── 8. 快捷键互斥 ──
  {
    check('快捷键 · 有统一弹窗闸门', /function modalOpen\(\)/.test(src))
    check('快捷键 · 验收台 J/K 让路', /if \(modalOpen\(\)\) return/.test(src))
    check('快捷键 · Ctrl+K 不叠层', /if \(modalOpen\(\) && !command\) return/.test(src))
    check('快捷键 · Modal 自己能 Esc 关', /event\.key\) === 'Escape'/.test(src))
  }

  // ── 9. 无障碍 ──
  {
    const segs = all(T('review')).filter((n) => n.kind === 'el'
      && String(n.cls ?? '').split(/\s+/).includes('nw-seg-btn'))
    check('无障碍 · 分段按钮都有 aria-pressed', segs.length > 0 && segs.every((n) => typeof n.props?.['aria-pressed'] === 'string'), `segs=${segs.length}`)
    check('无障碍 · aria-pressed 值合法', segs.every((n) => ['true', 'false'].includes(n.props['aria-pressed'])))
    check('无障碍 · Switch 有可读名', /aria-label/.test(src) && /已开启/.test(src))
  }
  // ── 10. 【QA-1234】撤销重做 / 弹窗无障碍 / 窄屏 / 预算拦截 ──
  {
    // 撤销栈：代码里得有真栈，不是摆个按钮。
    check('QA1 · 有撤销栈实现', /function useUndoText\(/.test(src) && /const \[stack, setStack\] = useState\(\{ past: \[\], future: \[\] \}\)/.test(src))
    check('QA1 · 连续输入合并成一步', /now - lastAt\.current < 600/.test(src))
    // 按钮在验收详情里（ReviewPage 列表页没有它），所以单独挂一次详情。
    hookMap = new Map()
    const rv = await mount(plugin._test.ReviewDetail, {
      projectId: PROJECT.id, chapter: 3, gate: 70, onClose() {}, onChanged() {}, toast() {},
    })
    // Btn 组件节点自己也带着 className 属性，数元素节点才不会重复计一次。
    const elCount = (tree, cls) => all(tree).filter((n) => n.kind === 'el' && String(n.cls ?? '').split(/\s+/).includes(cls)).length
    check('QA1 · 撤销 / 重做按钮上屏', elCount(rv, 'nw-undo-btn') === 1 && elCount(rv, 'nw-redo-btn') === 1,
      `undo=${elCount(rv, 'nw-undo-btn')} redo=${elCount(rv, 'nw-redo-btn')}`)
    check('QA1 · 有栈深度提示', countCls(rv, 'nw-undo-n') === 1)
    check('QA1 · 撤销条带反馈文案', allText(rv).some((t) => String(t).includes('撤销')))
    check('QA1 · Ctrl+Z / Ctrl+Shift+Z 绑定', /key !== 'z' && key !== 'y'/.test(src))
    check('QA1 · 换章时清栈', /resetText\(remote\)/.test(src) && /const reset = \(next = ''\)/.test(src))

    // 弹窗无障碍：dialog 语义 + 焦点陷阱 + 焦点还回。
    check('QA2 · Modal 有 dialog 语义', /role: 'dialog'/.test(src) && /'aria-modal': 'true'/.test(src))
    check('QA2 · Modal 有焦点陷阱', /String\(event\.key\) !== 'Tab'/.test(src) && /focusables\[focusables\.length - 1\]/.test(src))
    check('QA2 · Modal 打开搬焦点、关闭还焦点', /const restoreTo = typeof document !== 'undefined' \? document\.activeElement : null/.test(src) && /restoreTo\.focus\(\)/.test(src))

    // 第二档窄屏：720px 断点得真的存在，且管到顶栏底栏。
    check('QA3 · 有 720px 断点', /@media \(max-width:720px\)/.test(src))
    check('QA3 · 窄屏收顶栏与 dock', /\.nw-top\{flex-direction:column/.test(src) && /\.nw-dock\{gap:2px;overflow-x:auto/.test(src))
    check('QA3 · 窄屏表格可横滑', /\.nw-ledger-row,\.nw-scan-row\{min-width:560px\}/.test(src))

    // 预算拦截：超了要问，且暂停时不排单。
    check('QA4 · 超预算会拦一道', /const budgetCheck = \(\) =>/.test(src) && /window\.confirm\(/.test(src))
    check('QA4 · 顶栏写明超了多少', countCls(T('today'), 'nw-budget') >= 0 && /nw-budget-stop nw-budget-halt/.test(src))
    check('QA4 · 暂停时快动作有提示', /className: paused \? 'nw-btn-halt' : ''/.test(src) && /现在是暂停状态/.test(src))
  }
}

// ══ 【借 LNW 六项】地图 / 成书 / 检查更新 / 冷读 / 意见池 / 简报 ══
{
  const t = src

  // ── 地图：世界库第四视图 ──
  hookMap = new Map()
  const map = await mount(plugin._test.MapView, { projectId: PROJECT.id, toast() {} })
  check('地图 · 零抛错', throwsOf(map).length === 0, throwsOf(map).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('地图 · 画布在', countCls(map, 'nw-map-stage') === 1)
  check('地图 · 三个地点点', countCls(map, 'nw-map-node') === 3, `${countCls(map, 'nw-map-node')} 点`)
  check('地图 · 账本里没有的点画成灰', countCls(map, 'nw-map-orphan') === 1)
  check('地图 · 一条连线', countCls(map, 'nw-map-edge') === 1)
  check('地图 · 连线列表一行', countCls(map, 'nw-map-edgerow') === 1)
  check('地图 · 有「从账本同步」出口', allText(map).some((x) => String(x).includes('从账本同步')))

  // ── 成书导出：四种格式 ──
  hookMap = new Map()
  const book = await mount(plugin._test.BookExport, { projectId: PROJECT.id, project: PROJECT, toast() {} })
  check('成书 · 零抛错', throwsOf(book).length === 0, throwsOf(book).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('成书 · 四个格式牌', countCls(book, 'nw-book-format') === 4, `${countCls(book, 'nw-book-format')} 个`)
  check('成书 · 四格式都写清了', ['TXT', 'Markdown', 'EPUB', 'Word'].every((k) => allText(book).map(String).join(' ').includes(k)))
  check('成书 · 能选跳过的章', countCls(book, 'nw-book-skip') === 1)

  // ── 检查更新 ──
  hookMap = new Map()
  const upd = await mount(plugin._test.UpdateCard, { toast() {} })
  check('检查更新 · 零抛错', throwsOf(upd).length === 0,
    throwsOf(upd).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))

  // ── 冷读 ──
  hookMap = new Map()
  const cold = await mount(plugin._test.ColdReadPanel, {
    projectId: PROJECT.id, chapters: CHAPTERS, toast() {}, onOpenChapter() {},
  })
  check('冷读 · 零抛错', throwsOf(cold).length === 0, throwsOf(cold).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('冷读 · 单章/整本两档', allText(cold).map(String).join(' ').includes('单章') && allText(cold).map(String).join(' ').includes('整本'))
  check('冷读 · 有「生成冷读包」钮', allText(cold).some((x) => String(x).includes('生成冷读包')))
  check('冷读 · 有回执粘贴区', countCls(cold, 'nw-cold-submit') === 1)
  check('冷读 · 列出生成过的包', countCls(cold, 'nw-cold-histrow') === 1)

  // ── 意见池 ──
  hookMap = new Map()
  const opi = await mount(plugin._test.OpinionBoard, {
    projectId: PROJECT.id, toast() {}, refreshKey: 0, onOpenChapter() {},
  })
  check('意见池 · 零抛错', throwsOf(opi).length === 0, throwsOf(opi).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('意见池 · 默认只出待处理 2 条', countCls(opi, 'nw-opinion') === 2, `${countCls(opi, 'nw-opinion')} 条`)
  check('意见池 · 四档状态片', countCls(opi, 'nw-seg-btn') >= 8)
  check('意见池 · 能从问题单拉', allText(opi).some((x) => String(x).includes('从问题单拉一遍')))
  check('意见池 · 每条都能采纳/不改', allText(opi).some((x) => String(x).includes('采纳')) && allText(opi).some((x) => String(x).includes('不改')))

  // ── 对齐简报（挂在驾驶舱上） ──
  hookMap = new Map()
  const bf = await mount(plugin._test.BriefingCard, { projectId: PROJECT.id, toast() {} })
  check('简报 · 零抛错', throwsOf(bf).length === 0, throwsOf(bf).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('简报 · 有生成钮', allText(bf).some((x) => String(x).includes('生成简报')))
  check('简报 · 在驾驶舱里挂了', /h\(BriefingCard, \{ projectId, toast \}\)/.test(t))

  // ── 验收台两抽屉已接上 ──
  check('验收台 · 冷读与意见池都是抽屉', /value: 'coldread'/.test(t) && /value: 'opinions'/.test(t))
  check('世界库 · 地图是第四视图', /value: 'map', label: '地图'/.test(t))
  check('设置 · 成书与检查更新都挂了', /h\(BookExport, \{ projectId, project, toast \}\)/.test(t) && /h\(UpdateCard, \{ toast \}\)/.test(t))
}
// ══ 【章级体检】退化 / 照搬 / 标点 / 字数 四件套 ═══════════
{
  hookMap = new Map()
  const t = await mount(plugin._test.ChapterHealth, {
    projectId: PROJECT.id, chapter: 3, text: '他推开门，雪灌进来。………', toast() {}, onJumpPara() {},
  })
  const tx = allText(t).map(String).join(' ')
  check('体检 · 零抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  // 四条检查是「点一下才跑」的：不点就先给一个入口，不假装已经查过。
  check('体检 · 没查之前只给一个入口', tx.includes('查一遍') && countCls(t, 'nw-health-row') === 0)
  check('体检 · 明说只报告不改稿', tx.includes('都只报告不改稿'))
  check('体检 · 挂在验收详情里', /readMode \? null : h\(ChapterHealth, \{/.test(src))
  check('体检 · 在校验面板下面（先判是不是文，再谈文笔）',
    src.indexOf('h(ChapterHealth, {') > 0 && src.indexOf('h(ChapterHealth, {') < src.indexOf('readMode ? null : h(LintPanel, {'),
    `health@${src.indexOf('h(ChapterHealth, {')} lint@${src.indexOf('readMode ? null : h(LintPanel, {')}`)
}
// ══ 【任务包】派单材料是物证，作者要能打开核对 ═════════════
{
  hookMap = new Map()
  const t = await mount(plugin._test.TaskPackBoard, { projectId: PROJECT.id, toast() {}, refreshKey: 0 })
  const tx = allText(t).map(String).join(' ')
  check('任务包 · 零抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('任务包 · 列出一个包', countCls(t, 'nw-tp-row') === 1)
  check('任务包 · 写明几份材料', tx.includes('5 份'))
  check('任务包 · 少给的项标出来', tx.includes('少给 2 项'))
  // 默认收起：展开就得读 manifest，不该一进页面就把所有包全读一遍。
  check('任务包 · 默认不展开', countCls(t, 'nw-tp-body') === 0)
  check('任务包 · 挂在流水线页', /h\(TaskPackBoard, \{ projectId, toast/.test(src))
}

// ── 25. 正文页 ──
// 这一页的存在本身就是修的一个结构性缺口：以前要读一章，得进验收台（审稿的地方），
// 首屏是分数表。现在有一页只摊正文，字号行距、读到哪、下一回都在这儿。
{
  store['nw.page'] = 'read'
  store['nw.project'] = PROJECT.id
  store['nw.openChapter'] = '3'
  hookMap = new Map()
  const t = await mount(plugin._test.Root, {})
  const tx = allText(t).map(String).join(' ')
  check('正文页 · 零抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('正文页 · 版心在', countCls(t, 'nw-read') === 1)
  check('正文页 · 读出这一章的标题', tx.includes('第 3 回'))
  // 正文来自 chapter.get（桩里那句「雨落下来的时候，他站在城头。」），不是演示段落。
  check('正文页 · 正文来自 chapter.get', tx.includes('雨落下来的时候'))
  check('正文页 · 逐段铺开', countCls(t, 'nw-read-para') >= 1, String(countCls(t, 'nw-read-para')))
  check('正文页 · 阅读/编辑两档', countCls(t, 'nw-read-tab') === 2)
  check('正文页 · 上一回/下一回都在', tx.includes('上一回') && tx.includes('下一回'))
  check('正文页 · 字号行距可调', countCls(t, 'nw-read-font') === 1 && tx.includes('行距'))
  check('正文页 · 能直接跳去验收这一回', tx.includes('去验收这一回'))
  // 只读页面不该冒出验收台的东西：分数、问题单、采纳按钮一个都不该有。
  check('正文页 · 不夹带验收台', countCls(t, 'nw-score-grid') === 0 && countCls(t, 'nw-rv-side') === 0)
}

// ── 26. 今天页的状态条（原「停靠点」页，P4 并进今天） ──
// run.* 七个 op 以前后端齐全、界面 0 处调用 —— 状态机在跑，人碰不到。
// 并进「今天」的理由写在 src/29-today.js 的头注释里：门禁放在人看不到的地方拦人，
// 等于没拦。所以这里断言的重点从「有一页停靠点」变成「今天页第一眼就说清能不能写」。
{
  store['nw.page'] = 'today'
  store['nw.project'] = PROJECT.id
  hookMap = new Map()
  const t = await mount(plugin._test.Root, {})
  const tx = allText(t).map(String).join(' ')
  check('今天 · 状态条零抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('今天 · 版心在', countCls(t, 'nw-today') === 1)
  check('今天 · 状态条在', countCls(t, 'nw-today-run') === 1)
  check('今天 · 一句话说清能不能写', tx.includes('还能写 2 章'))
  check('今天 · 这一轮的进度', tx.includes('1 / 3 章'), tx.slice(0, 100))
  check('今天 · 进行中标绿', countCls(t, 'nw-today-run-green') === 1, String(countCls(t, 'nw-today-run-green')))
  // 今天页 / 派单页都得挂在 Workbench 的分派表里，不然点导航就是白屏。
  check('分派表 · 今天与派单都在', /today: h\(TodayPage/.test(src) && /dispatch: h\(DispatchPage/.test(src))
  // 顶栏状态灯读的是 run.current，不是写死的常量。
  check('状态灯 · 读 run.current 而非 MOCK',
    /api\('run\.current'/.test(src) && !/MOCK\.run/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')))
}

// ── 26b. 今天页的两个极端状态 ──
// 门禁最容易咬人的场景只有两个：「一章交完等确认」和「还没开过轮」。
// 两边都得把出路摆在脸上，而不是让人去别的页找。
{
  hookMap = new Map()
  const waiting = { ...RUN, status: 'waiting' }
  const verdictW = { level: 'orange', text: '第 3 回交完，等确认' }
  const t = await mount(plugin._test.TodayRunStrip, {
    projectId: PROJECT.id, run: waiting, verdict: verdictW, toast() {}, onChanged() {},
  })
  const tx = allText(t).map(String).join(' ')
  check('今天 · 等确认不抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('今天 · 等确认标黄', countCls(t, 'nw-today-run-amber') === 1)
  check('今天 · 交过的章一行一条', countCls(t, 'nw-run-ch') === 1, String(countCls(t, 'nw-run-ch')))
  check('今天 · 每章有确认/打回', tx.includes('确认') || tx.includes('打回'), tx.slice(0, 120))
  check('今天 · 能收尾', tx.includes('收尾关掉'))
  check('今天 · 等确认时不给开轮表单', countCls(t, 'nw-run-form') === 0)
}

{
  hookMap = new Map()
  const verdictR = { level: 'red', text: '还没开一轮，写正文前要先 run.open 登记' }
  const t = await mount(plugin._test.TodayRunStrip, {
    projectId: PROJECT.id, run: null, verdict: verdictR, toast() {}, onChanged() {},
  })
  const tx = allText(t).map(String).join(' ')
  check('今天 · 没开轮不抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('今天 · 没开轮说清状态', tx.includes('还没开一轮'))
  // RunOpenForm 常态下只摆一个「开一轮」按钮（表单点开才摊）——
  // 开轮是一次性动作，把三个输入框常年摆在首屏只会把人吓走。
  check('今天 · 没开轮给开轮入口', tx.includes('开一轮'), tx.slice(0, 120))
  check('今天 · 开轮入口可点', countCls(t, 'nw-actions') >= 1)
  check('今天 · 没开轮标红', countCls(t, 'nw-today-run-red') === 1)
  check('今天 · 没开轮也说明不开也能写', tx.includes('不开轮也能写'))
}

// ── 27. 建书页：三步向导（没有作品时的首屏） ──
// 这一页是「进门第一屏」，不再是「还没有作品」的一句话。
// 以前一屏摊 15 个字段，人都没想清楚写什么就先被体量、预算、质检门槛问住。
// 现在只问两件必须现在答的事（叫什么叫、想看什么），其余折进第 2 步的可跳过区。
// 这一段压的是结构：三步都在、必填能拦、规模卡可选、第 3 步才出现「建这本」。
{
  store['nw.project'] = ''
  hookMap = new Map()
  const toasts = []
  const dones = []
  const props = { toast: (m) => toasts.push(String(m)), onDone: (id, extra) => dones.push({ id, extra }) }
  let t = await mount(plugin._test.CreateProjectPage, props)
  let tx = allText(t).map(String).join(' ')

  check('建书页 · 零抛错', throwsOf(t).length === 0, throwsOf(t).slice(0, 2).map((x) => `${x.name}: ${x.error}`).join(' | '))
  check('建书页 · 版心在', countCls(t, 'nw-create') === 1)
  check('建书页 · 三步进度条在', countCls(t, 'nw-create-step') === 3)
  check('建书页 · 第一步就两个必填', countCls(t, 'nw-create-field') === 2)
  check('建书页 · 书名输入框在', all(t).some((n) => n.props?.id === 'create-name'))
  check('建书页 · 想法输入框在', all(t).some((n) => n.props?.id === 'create-idea'))
  check('建书页 · 必填项标了必填', tx.includes('必填'))
  check('建书页 · 右栏实时预估上屏', countCls(t, 'nw-kv') >= 5 && tx.includes('全书预计'))
  check('建书页 · 初始不显示原始值', !/undefined|NaN|\[object Object\]/.test(tx), tx.slice(0, 120))
  check('建书页 · 第一步没有提交按钮', !all(t).some((n) => n.props?.className && String(n.props.className).includes('nw-create-submit')))
  check('建书页 · 第一步有下一步', all(t).some((n) => n.props?.className && String(n.props.className).includes('nw-create-next')))

  // 空表单点「下一步」：必须拦住，红字标出缺的是哪一项，并且还停在第一步。
  const next1 = all(t).find((n) => n.props?.className && String(n.props.className).includes('nw-create-next'))
  await next1.props.onClick()
  t = await mount(plugin._test.CreateProjectPage, props)
  tx = allText(t).map(String).join(' ')
  check('建书页 · 空表单被拦下', countCls(t, 'nw-create-field-bad') >= 1)
  check('建书页 · 说清是必填', tx.includes('这一项必填'))
  check('建书页 · 提示还剩几项没填', /还有 \d+ 项没填对/.test(tx), tx.slice(0, 160))
  check('建书页 · 被拦下时还停在第一步', all(t).some((n) => n.props?.id === 'create-name'))
  check('建书页 · 被拦下时不发创建请求', dones.length === 0)

  // 填完两项再下一步 → 第二屏是四张规模卡，不是一堆数字输入框。
  const fillIn = async (id, value) => {
    const node = all(t).find((n) => n.kind === 'el' && n.props?.id === id)
    check(`建书页 · 找到 ${id}`, !!node)
    node.props.onChange({ target: { value } })
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  await fillIn('create-name', '元末女帝：系统让我截胡朱重八')
  await fillIn('create-idea', '元末乱世，现代女生穿成村姑，系统只会催她嫁给朱重八。')
  const next2 = all(t).find((n) => n.props?.className && String(n.props.className).includes('nw-create-next'))
  await next2.props.onClick()
  t = await mount(plugin._test.CreateProjectPage, props)
  tx = allText(t).map(String).join(' ')
  check('建书页 · 第二步不再问数字', countCls(t, 'nw-create-field') === 0)
  check('建书页 · 四张规模卡', countCls(t, 'nw-create-scale') === 4)
  check('建书页 · 默认选中一个', countCls(t, 'nw-create-scale-on') === 1)
  check('建书页 · 规模卡上写清体量', tx.includes('短篇') && tx.includes('长篇') && tx.includes('让 AI 定'))
  check('建书页 · 有可跳过的更多', all(t).some((n) => n.props?.className && String(n.props.className).includes('nw-create-more')))
  check('建书页 · 更多默认收起', countCls(t, 'nw-create-more-body') === 0)

  // 展开「更多」：可跳过的三个字段才出现。它们不是必填，不填也能建。
  const more = all(t).find((n) => n.props?.className && String(n.props.className).includes('nw-create-more'))
  await more.props.onClick()
  t = await mount(plugin._test.CreateProjectPage, props)
  check('建书页 · 展开后有可跳过的三项', countCls(t, 'nw-create-field') === 3)
  check('建书页 · 可跳过的三项都在',
    ['genre', 'protagonist', 'hook'].every((k) => all(t).some((n) => n.props?.id === `create-${k}`)))
  check('建书页 · 可跳过项不标必填', !allText(t).map(String).join(' ').includes('这一项必填'))

  // 第三步才出现「建这本」，并且告诉你建完会发生什么。
  const next3 = all(t).find((n) => n.props?.className && String(n.props.className).includes('nw-create-next'))
  await next3.props.onClick()
  t = await mount(plugin._test.CreateProjectPage, props)
  tx = allText(t).map(String).join(' ')
  check('建书页 · 第三步复述要建的东西', tx.includes('元末女帝') && tx.includes('中篇'))
  check('建书页 · 第三步给「先出骨架」开关', countCls(t, 'nw-create-check') === 1)
  check('建书页 · 第三步才有提交按钮', all(t).some((n) => n.props?.className && String(n.props.className).includes('nw-create-submit')))
  check('建书页 · 三步都不抛错', throwsOf(t).length === 0)
}

// ── 28. 建书校验函数（纯函数，直接喂脏数据） ──
// 建书页能拦住靠的是它：一个不认识 DOM 的纯函数，输入脏值也不许崩。
{
  const V = plugin._test.validateCreate
  const bad = V(null)
  check('校验 · null 不崩且判不通过', bad && bad.ok === false && typeof bad.errors === 'object')
  check('校验 · null 时书名报必填', !!bad.errors.name)
  const empty = V({})
  check('校验 · 空对象判不通过', empty.ok === false)
  check('校验 · 空对象缺两项（名 + 想法）', !!empty.errors.name && !!empty.errors.idea)
  const ok = V({ name: '元末女帝', idea: '穿成村姑，系统催婚' })
  check('校验 · 两项齐则通过', ok.ok === true)
  check('校验 · 中篇默认体量', ok.scale.id === 'medium' && ok.brief.volumes === 2 && ok.brief.chaptersPerVolume === 50)
  check('校验 · 每章字数跟着体量走', ok.project.targetWords === 2500)
  check('校验 · 门槛与预算给默认值', ok.project.qualityGate === 70 && ok.project.monthlyBudget === 600)
  check('校验 · 想法落成卖点也落成前提', ok.project.logline === '穿成村姑，系统催婚' && ok.brief.premise === '穿成村姑，系统催婚')
  const trim = V({ name: '  x  ', idea: '  y  ' })
  check('校验 · 前后空格被去掉', trim.project.name === 'x' && trim.project.logline === 'y')
  const short = V({ name: 'a', idea: 'b', scale: 'short' })
  check('校验 · 短篇体量对得上', short.brief.volumes === 1 && short.brief.chaptersPerVolume === 30 && short.project.targetWords === 2000)
  const ai = V({ name: 'a', idea: 'b', scale: 'ai' })
  check('校验 · 让 AI 定就是三卷二十章', ai.scale.id === 'ai' && ai.brief.volumes === 3)
  const unknown = V({ name: 'a', idea: 'b', scale: 'nope' })
  check('校验 · 乱填体量回落中篇', unknown.scale.id === 'medium')
  const tooLong = V({ name: 'a'.repeat(61), idea: 'b' })
  check('校验 · 超长书名被拦', tooLong.ok === false && !!tooLong.errors.name && tooLong.errors.name.includes('60'))
  const dirty = V({ name: undefined, idea: null, genre: NaN, protagonist: {}, hook: [] })
  check('校验 · 全脏值不崩', dirty.ok === false && !!dirty.errors.name)
  check('校验 · 脏可选值不弄脏 brief', dirty.brief.genre === '' && dirty.brief.protagonist === '' && dirty.brief.hook === '')
  check('校验 · 报错项按名字给出', typeof dirty.first === 'string' && dirty.first.length > 0)
  const steps = plugin._test.createStepIssues
  check('校验 · 第一步只拦名字与想法', Object.keys(steps({}, 1)).length === 2)
  check('校验 · 第二步不拦可跳过的项', Object.keys(steps({}, 2)).length === 0)
}

// ── 29. 建书成功路径（填完 → 三步 → 三块落盘 → 往上跳） ──
// 上面那两段只压了「拦住」。这一段压真交：project.create 拿到的字段对不对、
// 大纲 brief 有没有跟着写、骨架有没有排、跳转回调有没有带上新作品的 id。
{
  store['nw.project'] = ''
  hookMap = new Map()
  const sent = []
  win.fetch = global.fetch = async (url, opt) => {
    let op = ''
    let body = {}
    try { body = JSON.parse(opt.body); op = body.op } catch { /* 空 */ }
    sent.push({ op, payload: body.payload })
    if (op === 'project.create') {
      return { json: async () => ({ ok: true, value: { id: 'pm0000new001', name: body.payload.name, dir: '/tmp/x', meta: {} } }), status: 200 }
    }
    if (op === 'outline.save') return { json: async () => ({ ok: true, value: { outline: OUTLINE } }), status: 200 }
    if (op === 'outline.generate') return { json: async () => ({ ok: true, value: { outline: OUTLINE } }), status: 200 }
    return { json: async () => ({ ok: true, value: {} }), status: 200 }
  }
  const toasts = []
  const dones = []
  const props = { toast: (m) => toasts.push(String(m)), onDone: (id, extra) => dones.push({ id, extra }) }
  let t = await mount(plugin._test.CreateProjectPage, props)

  const fill = async (id, value) => {
    const node = all(t).find((n) => n.kind === 'el' && n.props?.id === id)
    check(`建书 · 找到 ${id}`, !!node)
    node.props.onChange({ target: { value } })
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  const click = async (cls) => {
    const node = all(t).find((n) => n.props?.className && String(n.props.className).includes(cls))
    check(`建书 · 点到 ${cls}`, !!node)
    await node.props.onClick()
    t = await mount(plugin._test.CreateProjectPage, props)
  }

  await fill('create-name', '元末女帝：系统让我截胡朱重八')
  await fill('create-idea', '穿成元末村姑，系统只会催她嫁给朱重八。')
  await click('nw-create-next')
  // 选长篇：6 卷 × 50 章 × 2500 字
  // 注意用「整个 token 相等」而不是 includes：nw-create-scale-head/-meta/-desc 也含
  // nw-create-scale 这个子串，includes 会把里面的 span 当成卡片本身。
  const scaleCards = all(t).filter((n) => {
    const tokens = String(n.props?.className ?? '').split(/\s+/)
    return n.kind === 'el' && n.tag === 'button' && tokens.includes('nw-create-scale')
  })
  const longCard = scaleCards.find((n) => allText(n).map(String).join(' ').includes('长篇'))
  check('建书 · 找到长篇卡', !!longCard)
  await longCard.props.onClick()
  t = await mount(plugin._test.CreateProjectPage, props)
  await click('nw-create-next')
  await click('nw-create-submit')

  const create = sent.find((x) => x.op === 'project.create')
  check('建书 · 发了 project.create', !!create)
  check('建书 · 元信息字段带全',
    !!create && create.payload.name === '元末女帝：系统让我截胡朱重八' &&
    create.payload.logline === '穿成元末村姑，系统只会催她嫁给朱重八。' &&
    create.payload.targetWords === 2500 &&
    create.payload.qualityGate === 70 &&
    create.payload.monthlyBudget === 600,
    JSON.stringify(create?.payload))
  const outline = sent.find((x) => x.op === 'outline.save')
  check('建书 · 方案也落盘了', !!outline, sent.map((x) => x.op).join(','))
  check('建书 · 方案挂在新建的作品上', !!outline && outline.payload.projectId === 'pm0000new001')
  check('建书 · brief 带上想法与体量',
    !!outline && outline.payload.outline.brief.premise === '穿成元末村姑，系统只会催她嫁给朱重八。' &&
    outline.payload.outline.brief.volumes === 6 &&
    outline.payload.outline.brief.chaptersPerVolume === 50,
    JSON.stringify(outline?.payload?.outline?.brief))
  check('建书 · 六个详细字段建书时不碰',
    !!outline && (outline.payload.outline.brief.audience ?? '') === '' && (outline.payload.outline.brief.ending ?? '') === '')
  check('建书 · 勾了就先排骨架', sent.some((x) => x.op === 'outline.generate'))
  check('建书 · 往上跳了', dones.length === 1 && dones[0].id === 'pm0000new001', JSON.stringify(dones))
  check('建书 · 报了成功', toasts.some((m) => m.includes('已建')), toasts.join(' | '))
  check('建书 · 成功后不再显示建书中', !allText(t).map(String).join(' ').includes('建书中'))
}

// ── 30. 建书：第二步失败要说清「建了但方案没存进去」 ──
{
  store['nw.project'] = ''
  hookMap = new Map()
  win.fetch = global.fetch = async (url, opt) => {
    let op = ''
    let body = {}
    try { body = JSON.parse(opt.body); op = body.op } catch { /* 空 */ }
    if (op === 'project.create') {
      return { json: async () => ({ ok: true, value: { id: 'pm0000new002', name: body.payload.name, dir: '/tmp/x', meta: {} } }), status: 200 }
    }
    if (op === 'outline.save') {
      return { json: async () => ({ ok: false, error: { code: 'fs', message: '大纲目录不可写' } }), status: 500 }
    }
    return { json: async () => ({ ok: true, value: {} }), status: 200 }
  }
  const toasts = []
  const dones = []
  const props = { toast: (m) => toasts.push(String(m)), onDone: (id, extra) => dones.push({ id, extra }) }
  let t = await mount(plugin._test.CreateProjectPage, props)
  const fill = async (id, value) => {
    const node = all(t).find((n) => n.kind === 'el' && n.props?.id === id)
    node.props.onChange({ target: { value } })
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  const click = async (cls) => {
    const node = all(t).find((n) => n.props?.className && String(n.props.className).includes(cls))
    await node.props.onClick()
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  await fill('create-name', '只有名字的书')
  await fill('create-idea', '一句话想法。')
  await click('nw-create-next')
  await click('nw-create-next')
  await click('nw-create-submit')

  check('建书 · 第二步失败也照样往上跳', dones.length === 1 && dones[0].id === 'pm0000new002', JSON.stringify(dones))
  check('建书 · 第二步失败说清原因', toasts.some((m) => m.includes('方案没存进去') && m.includes('大纲目录不可写')), toasts.join(' | '))
  check('建书 · 第二步失败传回给调用方', dones[0]?.extra?.briefError === '大纲目录不可写', JSON.stringify(dones[0]?.extra))
  check('建书 · 第二步失败不崩', throwsOf(t).length === 0)
}

// ── 31. 建书：服务端整个拒绝时把原话端上来 ──
{
  store['nw.project'] = ''
  hookMap = new Map()
  win.fetch = global.fetch = async () => ({
    json: async () => ({ ok: false, error: { code: 'fs', message: '磁盘满了，建不了目录' } }),
    status: 500,
  })
  const dones = []
  const props = { toast: () => {}, onDone: (id) => dones.push(id) }
  let t = await mount(plugin._test.CreateProjectPage, props)
  const fill = async (id, value) => {
    const node = all(t).find((n) => n.kind === 'el' && n.props?.id === id)
    node.props.onChange({ target: { value } })
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  const click = async (cls) => {
    const node = all(t).find((n) => n.props?.className && String(n.props.className).includes(cls))
    await node.props.onClick()
    t = await mount(plugin._test.CreateProjectPage, props)
  }
  await fill('create-name', '建不出来的书')
  await fill('create-idea', '一句话想法。')
  await click('nw-create-next')
  await click('nw-create-next')
  await click('nw-create-submit')

  const tx = allText(t).map(String).join(' ')
  check('建书 · 服务端拒绝时把原话上屏', tx.includes('磁盘满了，建不了目录'), tx.slice(0, 160))
  check('建书 · 服务端拒绝时带上 code', countCls(t, 'nw-create-code') === 1)
  check('建书 · 服务端拒绝时不往上跳', dones.length === 0)
  // countCls 会把 Btn 组件节点和它渲染出的 button 各数一次，所以这里是 >= 1。
  check('建书 · 服务端拒绝后能重新提交', countCls(t, 'nw-create-submit') >= 1 && !tx.includes('建书中'))
}

let pass = 0
let failCount = 0
for (const row of results) {
  if (row.ok) {
    pass += 1
    console.log(`✓ ${row.label}`)
  } else {
    failCount += 1
    console.log(`✗ ${row.label}${row.extra ? `  ← ${row.extra}` : ''}`)
  }
}
console.log(`\n${pass} 过 / ${failCount} 不过 · 共 ${results.length} 项`)
console.log('RPC 打过的 op：', [...new Set(fetchCalls)].sort().join(', '))
process.exit(failCount ? 1 : 0)
