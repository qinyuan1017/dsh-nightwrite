window.__ModuleLoader__.load({
  id: 'dsh-nightwrite',
  factory(require) {
// ═════════ 10-core.js ═════════
/**
 * 长夜 · 常量 / 小工具 / 基础控件
 *
 * React 由宿主模块表提供，无构建、无外部依赖。
 * 所有数据走同源 RPC：POST /nightwrite/api，body { op, payload }。
 */

const React = require('react')
const h = React.createElement
const { useState, useEffect, useMemo, useRef, useCallback, memo } = React
const Fragment = React.Fragment

// ── 常量 ────────────────────────────────────────────────────
const PANEL_ID = 'nightwrite'
const ROUTE = '/nightwrite/api'
const LS = {
  project: 'nw.project',
  page: 'nw.page',
  theme: 'nw.theme',
  worldKind: 'nw.worldkind',
  worldView: 'nw.worldview',
  orderChapter: 'nw.order.chapter',
  orderIntent: 'nw.order.intent',
  paused: 'nw.paused',
  autosave: 'nw.autosave',
  readMode: 'nw.readmode',
  // 【QA】底栏「⏭ 最新」与命令面板跳章都写这个键，验收台读它直接打开那一回。
  openChapter: 'nw.openChapter',
  openPara: 'nw.openPara',
}

// 七页：方案 → 大纲 → 指令 → 验收，四个阶段各自一站。
// 「大纲」是 m06994 补的：之前从「一句话方案」到「可下单的章节意图」中间断了一截。
const PAGES = [
  { id: 'cockpit', label: '驾驶舱', icon: '🌙' },
  { id: 'plan', label: '大纲', icon: '📐' },
  { id: 'pipeline', label: '流水线', icon: '🛠' },
  { id: 'studio', label: '生产台', icon: '🎬' },
  { id: 'review', label: '验收台', icon: '📋' },
  { id: 'world', label: '世界库', icon: '🗂' },
  { id: 'scout', label: '侦察', icon: '🔍' },
  { id: 'settings', label: '设置', icon: '⚙️' },
]
const PAGE_LABEL = Object.fromEntries(PAGES.map((p) => [p.id, p.label]))

const LEDGER_TABS = [
  { value: 'characters', label: '人物', icon: '👤' },
  { value: 'locations', label: '地点', icon: '🏙' },
  { value: 'foreshadow', label: '伏笔', icon: '🧩' },
  { value: 'events', label: '事件', icon: '🕰' },
  { value: 'terms', label: '术语', icon: '📖' },
  { value: 'rules', label: '规则', icon: '📐' },
  { value: 'highlights', label: '高光', icon: '✨' },
  { value: 'conflicts', label: '冲突', icon: '⚔' },
]

const LEDGER_COLUMNS = {
  characters: [
    { key: 'name', label: '姓名', width: '1.1fr' },
    { key: 'role', label: '定位', width: '.9fr' },
    { key: 'state', label: '当前状态', width: '1.3fr' },
    { key: 'lastChapter', label: '最近出场', width: '.8fr' },
  ],
  locations: [
    { key: 'name', label: '地点', width: '1fr' },
    { key: 'type', label: '类型', width: '.8fr' },
    { key: 'firstChapter', label: '首次出现', width: '.9fr' },
    { key: 'state', label: '状态', width: '.9fr' },
  ],
  foreshadow: [
    { key: 'name', label: '伏笔', width: '1.2fr' },
    { key: 'plantedChapter', label: '埋设章', width: '.8fr' },
    { key: 'plannedChapter', label: '计划回收', width: '.8fr' },
    { key: 'status', label: '状态', width: '1fr' },
  ],
  events: [
    { key: 'name', label: '事件', width: '1.3fr' },
    { key: 'chapter', label: '章号', width: '.7fr' },
    { key: 'actors', label: '涉及人物', width: '1fr' },
    { key: 'kind', label: '类型', width: '.8fr' },
  ],
  terms: [
    { key: 'name', label: '标准写法', width: '1fr' },
    { key: 'count', label: '出现', width: '.6fr' },
    { key: 'variant', label: '变体', width: '1fr' },
    { key: 'state', label: '状态', width: '.9fr' },
  ],
  rules: [
    { key: 'name', label: '规则', width: '1.6fr' },
    { key: 'source', label: '来源', width: '.9fr' },
    { key: 'violatedIn', label: '违反章', width: '.8fr' },
    { key: 'state', label: '状态', width: '.8fr' },
  ],
  highlights: [
    { key: 'name', label: '高光', width: '1.1fr' },
    { key: 'chapter', label: '章号', width: '.7fr' },
    { key: 'kind', label: '类型', width: '.8fr' },
    { key: 'why', label: '为什么好', width: '1.6fr' },
  ],
  conflicts: [
    { key: 'name', label: '冲突', width: '1.2fr' },
    { key: 'sides', label: '双方', width: '1.2fr' },
    { key: 'from', label: '起于', width: '.7fr' },
    { key: 'state', label: '状态', width: '.9fr' },
  ],
}

// ── 小工具 ──────────────────────────────────────────────────

function readLS(key, fallback) {
  try {
    const value = window.localStorage.getItem(key)
    return value === null ? fallback : value
  } catch {
    return fallback
  }
}

function writeLS(key, value) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {
    /* 隐身模式 */
  }
}

function fmtWords(n) {
  const num = Number(n) || 0
  if (num >= 10000) return `${(num / 10000).toFixed(1)} 万`
  return String(num)
}

function fmtCost(n) {
  const num = Number(n) || 0
  return `¥${num.toFixed(2)}`
}

function scoreTone(score) {
  if (!score) return ''
  if (score >= 80) return 'good'
  if (score >= 70) return 'mid'
  return 'bad'
}

// ── 丢稿防护 ────────────────────────────────────────────────
//
// 验收台改了正文还没保存就点别的页，以前是直接丢 —— 稿子只存在组件 state 里。
// 这里放一个极小的登记处：谁有未保存内容谁把它挂上来，切页前统一问一句。
// 为什么不用 context：切页发生在 Root 里，而去重问一遍的时机也在 Root，
// 中间隔着四层组件；一个模块级登记处比把 setState 一路传下去短得多。
const dirtyGuard = {
  active: false,
  label: '',
  // 返回 true 表示「已经替我处理掉了」（比如自己存了），false 表示「还在脏」。
  flush: null,
}

function setDirtyGuard(active, label, flush) {
  dirtyGuard.active = !!active
  dirtyGuard.label = String(label ?? '')
  dirtyGuard.flush = active ? (flush ?? null) : null
}

/** 本地草稿：键里带作品与章号，换章不会串。 */
function draftKey(projectId, chapter) {
  return `nw.draft.${projectId}.${chapter}`
}

function readDraft(projectId, chapter) {
  const raw = readLS(draftKey(projectId, chapter), '')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.text === 'string') return parsed
  } catch {
    /* 旧格式或写坏了，当没有 */
  }
  return null
}

function writeDraft(projectId, chapter, text) {
  try {
    window.localStorage.setItem(
      draftKey(projectId, chapter),
      JSON.stringify({ text, at: new Date().toISOString() }),
    )
  } catch {
    /* 隐身模式 / 配额满：本地草稿是加分项，写不进去不影响主流程 */
  }
}

function dropDraft(projectId, chapter) {
  try {
    window.localStorage.removeItem(draftKey(projectId, chapter))
  } catch {
    /* 同上 */
  }
}

/**
 * 正文字数：visible_chars_v1，跟服务端 lib/wordcount.js 同一口径。
 *
 * 不能只写 replace(/\s+/g,'')：服务端会先去掉 frontmatter 和首行「第 N 回 …」，
 * 那个标题不算正文。两边算法不一样，读者看到的字数和作者报的字数就会差一截，
 * 而这是最没必要吵的一种架——所以在客户端也把这两步做掉。
 */
function countChars(text) {
  let body = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (body.startsWith('\ufeff')) body = body.slice(1)
  // frontmatter：开头 --- 包起来、且里面有 key: value 行，才认。认不出就原样算。
  const lines = body.split('\n')
  if (lines[0] === '---') {
    let closing = -1
    for (let i = 1; i < Math.min(lines.length, 201); i += 1) {
      if (lines[i] === '---' || lines[i] === '...') { closing = i; break }
    }
    if (closing >= 2 && lines.slice(1, closing).some((line) => /^[A-Za-z_\u3400-\u9FFF][^:\n]{0,80}:[ \t]*(?:.*)$/.test(line))) {
      body = lines.slice(closing + 1).join('\n')
    }
  }
  const rest = body.split('\n')
  while (rest.length && /^[\u0009\u0020\u3000]*$/.test(rest[0])) rest.shift()
  if (rest.length && /^[\u0009\u0020]{0,3}#{1,6}[\u0009\u0020]+\S/.test(rest[0])) rest.shift()
  return rest.join('\n').replace(/\s+/g, '').length
}

const STATUS_LABEL = {
  draft: '草稿',
  review: '待验收',
  accepted: '已采纳',
  rejected: '已废弃',
  queued: '已排队',
  manual: '人工修',
}
const STATUS_TONE = {
  draft: 'grey',
  review: 'amber',
  accepted: 'green',
  rejected: 'red',
  queued: 'teal',
  manual: 'blue',
}

let cachedBoot = null
function bootInfo() {
  if (cachedBoot) return cachedBoot
  const raw = window.__NIGHTWRITE_BOOT__
  cachedBoot = raw && typeof raw === 'object' ? raw : { apiUrl: ROUTE }
  return cachedBoot
}

async function api(op, payload = {}) {
  const boot = bootInfo()
  const url = String(boot.apiUrl || ROUTE)
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, payload }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    throw new Error(`接口返回非 JSON（HTTP ${res.status}）`)
  }
  if (!data || data.ok !== true) {
    const message = data?.error?.message || `请求失败（HTTP ${res.status}）`
    const error = new Error(message)
    error.code = data?.error?.code ?? 'unknown'
    // details 是「拒绝时附带的证据」：文风硬拦会带 blocking 命中清单，
    // 界面要拿它逐条列出来，不能只显示一句「保存失败」。
    error.details = data?.error?.details ?? null
    throw error
  }
  return data.value
}

function useAsync(fn, deps, { skip = false } = {}) {
  const [state, setState] = useState({ loading: !skip, data: null, error: null })
  const seq = useRef(0)
  const reload = useCallback(() => {
    const mine = ++seq.current
    setState((prev) => ({ ...prev, loading: true, error: null }))
    Promise.resolve()
      .then(fn)
      .then((data) => {
        if (mine !== seq.current) return
        setState({ loading: false, data, error: null })
      })
      .catch((error) => {
        if (mine !== seq.current) return
        setState({ loading: false, data: null, error })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps ?? [])
  useEffect(() => {
    if (skip) {
      setState({ loading: false, data: null, error: null })
      return
    }
    reload()
  }, [reload, skip])
  return { ...state, reload }
}

// ── 基础控件 ────────────────────────────────────────────────

function Btn({ kind = '', small = false, className = '', children, ...rest }) {
  const cls = `nw-btn${kind ? ` nw-btn-${kind}` : ''}${small ? ' nw-btn-sm' : ''}${className ? ` ${className}` : ''}`
  return h('button', { type: 'button', className: cls, ...rest }, children)
}

function Tag({ tone = 'grey', children }) {
  return h('span', { className: `nw-tag nw-tag-${tone}` }, children)
}

function Card({ title, extra, className = '', children, ...rest }) {
  return h(
    'section',
    { className: `nw-card${className ? ` ${className}` : ''}`, ...rest },
    title
      ? h('div', { className: 'nw-card-head' }, h('h3', null, title), h('div', { className: 'nw-card-line' }), extra)
      : null,
    children,
  )
}

function Hint({ children }) {
  return h('p', { className: 'nw-hint' }, children)
}

function Empty({ children }) {
  return h('div', { className: 'nw-empty' }, children)
}

function KV({ rows }) {
  return h(
    'div',
    { className: 'nw-kv-wrap' },
    rows.map((row) => h(
      'div',
      { className: 'nw-kv', key: row.key },
      h('span', { className: 'nw-kv-k' }, row.key),
      h('span', { className: `nw-kv-v${row.mono ? ' nw-mono' : ''}` }, row.text),
    )),
  )
}

function Field({ label, children }) {
  return h('div', { className: 'nw-field' }, h('label', null, label), children)
}

function Input({ value, onChange, ...rest }) {
  return h('input', {
    className: 'nw-input',
    value: value ?? '',
    onChange: (event) => onChange?.(event.target.value),
    ...rest,
  })
}

function TextArea({ value, onChange, rows = 3, ...rest }) {
  return h('textarea', {
    className: 'nw-input nw-textarea',
    rows,
    value: value ?? '',
    onChange: (event) => onChange?.(event.target.value),
    ...rest,
  })
}

function Select({ value, onChange, options }) {
  return h(
    'select',
    { className: 'nw-input', value: value ?? '', onChange: (event) => onChange?.(event.target.value) },
    options.map((item) => h('option', { key: item.value, value: item.value }, item.label)),
  )
}

// 【第 9 条】纯图形控件读屏念不出来。label 让调用方给一句人话，缺省也不至于空白。
function Switch({ on, onChange, label = '开关' }) {
  return h('button', {
    type: 'button',
    className: `nw-switch${on ? ' on' : ''}`,
    onClick: () => onChange?.(!on),
    'aria-pressed': on ? 'true' : 'false',
    'aria-label': `${label}（${on ? '已开启' : '已关闭'}）`,
  })
}

function Toast({ items }) {
  return h(
    'div',
    { className: 'nw-toast-wrap' },
    items.map((item) => h(
      'div',
      { className: 'nw-toast', key: item.id },
      h('span', { className: 'nw-toast-mark' }, '›'),
      item.text,
    )),
  )
}

function useToast() {
  const [items, setItems] = useState([])
  const seq = useRef(0)
  const push = useCallback((text) => {
    const id = ++seq.current
    setItems((prev) => [...prev, { id, text: String(text) }])
    window.setTimeout(() => setItems((prev) => prev.filter((item) => item.id !== id)), 2400)
  }, [])
  return [items, push]
}

/**
 * 正文的撤销 / 重做。
 *
 * 为什么不用浏览器自带的：受控 textarea（React 每敲一下都回写 value）会把原生
 * 撤销栈冲掉 —— Ctrl+Z 在受控组件里通常什么都不做，或者一次跳回很远。
 * 所以自己留快照。
 *
 * 为什么要合并：逐字建快照的话，打一百字就有 100 个快照，Ctrl+Z 要按 100 下才退一句。
 * 600ms 内的连续输入算同一步，停手超过 600ms 才开始新的一步。
 */
function useUndoText(initial = '') {
  const [value, setValueRaw] = useState(initial)
  const [stack, setStack] = useState({ past: [], future: [] })
  const valueRef = useRef(initial)
  const lastAt = useRef(0)

  const set = (next) => {
    const text = String(next ?? '')
    if (text === valueRef.current) return
    const prev = valueRef.current
    valueRef.current = text
    setValueRaw(text)
    const now = Date.now()
    const coalesce = now - lastAt.current < 600
    lastAt.current = now
    setStack((old) => {
      // 连续输入：把当前这一步的起点留着（past 末项就是它），只清掉重做分支。
      if (coalesce && old.past.length) return { past: old.past, future: [] }
      return { past: [...old.past, prev].slice(-120), future: [] }
    })
  }

  const undo = () => {
    let moved = false
    setStack((old) => {
      if (!old.past.length) return old
      const prev = old.past[old.past.length - 1]
      const current = valueRef.current
      valueRef.current = prev
      setValueRaw(prev)
      moved = true
      lastAt.current = Date.now()
      return { past: old.past.slice(0, -1), future: [current, ...old.future].slice(0, 120) }
    })
    return moved
  }

  const redo = () => {
    let moved = false
    setStack((old) => {
      if (!old.future.length) return old
      const next = old.future[0]
      const current = valueRef.current
      valueRef.current = next
      setValueRaw(next)
      moved = true
      lastAt.current = Date.now()
      return { past: [...old.past, current].slice(-120), future: old.future.slice(1) }
    })
    return moved
  }

  /** 换章 / 重新拉服务端正文时清栈：跨章的撤销没有意义，只会把 A 章的字塞进 B 章。 */
  const reset = (next = '') => {
    const text = String(next ?? '')
    valueRef.current = text
    setValueRaw(text)
    lastAt.current = 0
    setStack({ past: [], future: [] })
  }

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
    steps: stack.past.length,
  }
}

function Modal({ title, onClose, children, footer }) {
  const boxRef = useRef(null)
  // footer 上写着「Esc 关闭」，那就真的得能关。以前只有遮罩点击能关。
  useEffect(() => {
    const onKey = (event) => {
      if (String(event.key) === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }
      // 焦点陷阱：Modal 是浮层，Tab 不该跑到背后那一屏去。
      // 不拦的话键盘用户在弹窗里按十几下 Tab 就掉进背后的页面，回不来了。
      if (String(event.key) !== 'Tab') return
      const box = boxRef.current
      if (!box || typeof box.querySelectorAll !== 'function') return
      const focusables = Array.from(box.querySelectorAll('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])'))
        .filter((node) => !node.disabled)
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = typeof document !== 'undefined' ? document.activeElement : null
      if (event.shiftKey && (active === first || active === box)) {
        event.preventDefault()
        last.focus?.()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 打开时把焦点搬进浮层、关掉后还回原处。
  // 以前打开弹窗焦点还在背后那个按钮上，读屏念的是背后的内容。
  useEffect(() => {
    const restoreTo = typeof document !== 'undefined' ? document.activeElement : null
    const box = boxRef.current
    if (box && typeof box.querySelector === 'function') {
      const target = box.querySelector('input,textarea,button')
      if (target && typeof target.focus === 'function') target.focus()
    }
    return () => {
      if (restoreTo && typeof restoreTo.focus === 'function') restoreTo.focus()
    }
  }, [])

  return h(
    'div',
    { className: 'nw-modal-mask', onClick: onClose },
    h(
      'div',
      {
        className: 'nw-modal',
        ref: boxRef,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': String(title ?? '对话框'),
        tabIndex: -1,
        onClick: (event) => event.stopPropagation(),
      },
      h(
        'div',
        { className: 'nw-modal-head' },
        h('h3', null, title),
        h('button', { type: 'button', className: 'nw-icon-btn', onClick: onClose, 'aria-label': '关闭' }, '✕'),
      ),
      h('div', { className: 'nw-modal-body' }, children),
      footer ? h('div', { className: 'nw-modal-foot' }, footer) : null,
    ),
  )
}

// 【第 8 条】两个 keydown 监听（验收台 J/K/A/R、外壳 Ctrl+K）各管一段，
// 互相不知道对方。弹窗开着时按 J 会同时换章 + 打字。
// 用 DOM 里的弹窗浮层做统一闸门 —— Modal 是唯一入口，跑不掉。
function modalOpen() {
  if (typeof document === 'undefined') return false
  return !!document.querySelector('.nw-modal-mask')
}

function Loading({ text = '读取中…' }) {
  return h('div', { className: 'nw-loading' }, h('span', { className: 'nw-spin' }), text)
}

function ErrorBox({ error, onRetry }) {
  return h(
    'div',
    { className: 'nw-error' },
    h('span', null, error?.message || '出错了'),
    onRetry ? h(Btn, { small: true, kind: 'ghost', onClick: onRetry }, '重试') : null,
  )
}

function Bar({ value, max = 100, tone = 'amber' }) {
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / (Number(max) || 1)) * 100))
  return h('span', { className: `nw-bar nw-bar-${tone}` }, h('i', { style: { width: `${pct}%` } }))
}

// ═════════ 15-mock.js ═════════
/**
 * 长夜 · 界面演示数据与新小部件
 *
 * 这些是「界面先长出来、内核后接」的那一层：所有数字都是写死的假数据，
 * 每个可点的东西都有可见反馈（toast / 展开 / 滚动 / 排序），没有一个点了没反应。
 * 后端接通后，把 MOCK 里的常量换成 RPC 返回值即可，组件签名不用动。
 */

// ── 假数据 ──────────────────────────────────────────────────

const MOCK = {
  // 状态灯：AI 现在到底动不动
  run: { writing: true, chapter: 5, words: 1240, total: 2500, eta: '约 42 秒' },

  // 两周柱状图：每天写了多少字（0 = 断更）
  days: [
    { d: '10-14', w: 2600 }, { d: '10-15', w: 1800 }, { d: '10-16', w: 0 },
    { d: '10-17', w: 3100 }, { d: '10-18', w: 2500 }, { d: '10-19', w: 900 },
    { d: '10-20', w: 2700 }, { d: '10-21', w: 0 }, { d: '10-22', w: 2200 },
    { d: '10-23', w: 3300 }, { d: '10-24', w: 2500 }, { d: '10-25', w: 1200 },
    { d: '10-26', w: 2800 }, { d: '10-27', w: 1240 },
  ],

  // 全书进度：卷名 + 每卷章数
  volumes: [
    { name: '第一卷 · 城头夜雨', chapters: 12, done: 6 },
    { name: '第二卷 · 淮右风云', chapters: 12, done: 0 },
    { name: '第三卷 · 金陵座上', chapters: 6, done: 0 },
  ],
  progress: { words: 12840, target: 60000, chapter: 6, total: 30 },

  // 意图复用：最近三次用过的指令
  intents: [
    '主角吃瘪但埋下钩子，章末反转，不许死人',
    '连更：延续上一章钩子，节奏加快，多写对话',
    '过渡章：交代势力关系，用一场雨把场景从城头带到营帐',
  ],

  // 账本出处：格 → 哪回哪句话
  sources: {
    'characters.name': { chapter: 3, quote: '朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。' },
    'characters.role': { chapter: 2, quote: '「你算什么身份，也配在城头站着？」' },
    'characters.state': { chapter: 5, quote: '金丹三层的灵力在经脉里转了一圈，才勉强压下胸口的闷痛。' },
    'characters.lastChapter': { chapter: 5, quote: '她最后一次露面是第五回结尾。' },
    'foreshadow.name': { chapter: 3, quote: '雨里有人低低喊了一声她的名字，喊得极轻。' },
    'foreshadow.plannedChapter': { chapter: 3, quote: '这一声名字，本该在第十二回才被捡起来。' },
    'terms.name': { chapter: 1, quote: '「朱砂」两个字，在军籍上写得清清楚楚。' },
  },

  // 侦察「最近干过什么」
  history: [
    { id: 'h1', kind: '拆文', icon: '🧪', title: '《长夜行》拆解完成', sub: '黄金三章 + 120 章摘要 · 落盘 拆文库/长夜行/', at: '今天 11:20', age: '2 小时前' },
    { id: 'h2', kind: '扫榜', icon: '📊', title: '起点 + 番茄 长篇榜', sub: '抓到 48 本，题材分布：权谋 21 / 种田 11 / 系统 9', at: '昨天 20:05', age: '1 天前' },
    { id: 'h3', kind: '资料', icon: '📚', title: '元末城防与火器', sub: '交回 9 条结论，附 4 个出处', at: '10-25 15:40', age: '2 天前' },
    { id: 'h4', kind: '封面', icon: '🎨', title: '《元末女帝》封面 v2', sub: '冷灰史诗风 · 1536×2048', at: '10-24 09:12', age: '3 天前' },
  ],

  // 扫榜结果表
  scan: [
    { rank: 1, platform: '起点', book: '我在大明当暴君', genre: '历史', collect: '38.2 万', hook: '开局就把皇帝绑了', trend: '↑ 12' },
    { rank: 2, platform: '番茄', book: '重生之我家有矿', genre: '都市', collect: '96.5 万', hook: '一锄头挖出金矿', trend: '↑ 5' },
    { rank: 3, platform: '起点', book: '北望山河', genre: '权谋', collect: '21.7 万', hook: '城破那夜她改了军令', trend: '↓ 2' },
    { rank: 4, platform: '七猫', book: '嫁进侯门第三年', genre: '宅斗', collect: '64.1 万', hook: '休书递上来时她笑了', trend: '↑ 31' },
    { rank: 5, platform: '晋江', book: '纸上谈兵', genre: '古言', collect: '18.9 万', hook: '她替兄长去考了武举', trend: '— 0' },
    { rank: 6, platform: '番茄', book: '系统让我截胡', genre: '系统', collect: '88.3 万', hook: '任务目标：抢了主角的机缘', trend: '↑ 9' },
  ],

  // 提案批量
  proposals: [
    { chapter: 3, title: '删掉重复的「仿佛」', diffs: 2 },
    { chapter: 3, title: '把雨声改到段首', diffs: 1 },
    { chapter: 5, title: '重写章末钩子', diffs: 1 },
  ],

  // 提案板：真实列表为空时顶上来的演示行（页面不能只显示一句「没有待批提案」）
  proposalsDemo: [
    {
      id: 'demo-p1', chapter: 3, title: '删掉重复的「仿佛」', kind: 'rewrite', status: 'pending',
      summary: '同一段里出现三次「仿佛」，AI 味重，建议删两处、改一处比喻。',
      diffs: [
        { before: '雨声仿佛在耳边，仿佛很近，又仿佛很远。', after: '雨声在耳边，很近，又很远。', why: '连用三个「仿佛」是典型 AI 排比' },
        { before: '她仿佛听见有人在喊她。', after: '她听见有人喊她。', why: '不确定语气削弱紧张感' },
      ],
    },
    {
      id: 'demo-p2', chapter: 3, title: '把雨声改到段首', kind: 'patch', status: 'pending',
      summary: '环境音提前，先给读者耳朵，再给画面。',
      diffs: [{ before: '朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。', after: '雨珠顺着伞骨滑到袖口。朱砂把伞往上抬了抬。', why: '先声后人，开局更有代入' }],
    },
    {
      id: 'demo-p3', chapter: 5, title: '重写章末钩子', kind: 'patch', status: 'pending',
      summary: '现在的结尾把话说完了，读者没有翻页的理由。',
      diffs: [{ before: '她转身走进雨里，再没有回头。', after: '她转身走进雨里。身后那人忽然喊了一声她的名字——喊得极轻。', why: '留一个未答的问题' }],
    },
  ],

  // 问题单：同理的演示行
  problemsDemo: [
    { id: 'demo-q1', chapter: 3, type: 'ai-style', severity: 'major', status: 'open', text: '连续三段都用「仿佛」，AI 味重', quote: '雨声仿佛在耳边' },
    { id: 'demo-q2', chapter: 3, type: 'logic', severity: 'critical', status: 'open', text: '第 2 回说她没带伞，这一回伞从哪来的', quote: '朱砂把伞往上抬了抬' },
    { id: 'demo-q3', chapter: 5, type: 'style', severity: 'minor', status: 'open', text: '「灵力」和「真气」混用，设定里只该有一个', quote: '金丹三层的灵力' },
    { id: 'demo-q4', chapter: 7, type: 'other', severity: 'note', status: 'fixed', text: '章末少一个空行', quote: '' },
  ],

  // 验收详情正文：章节还没有字的时候顶上来，保证彩带 / 点亮 / 段落视图都有东西可看
  reviewText: [
    '雨声仿佛在耳边，仿佛很近，又仿佛很远。朱砂把伞往上抬了抬，雨珠顺着伞骨滑到袖口。',
    '城头上的火把被风吹得歪向一边，守卒缩着脖子，谁也不敢先开口。',
    '「你算什么身份，也配在城头站着？」',
    '说话的人披着半旧的猩红斗篷，靴底沾着泥，一看就是从马背上直接下来的。',
    '朱砂没有回头。金丹三层的灵力在经脉里缓缓转了一圈，才勉强压下胸口的闷痛。',
    '她听见有人在雨里低低喊了一声她的名字，喊得极轻，像是怕被谁听见。',
    '身后那人忽然提高了声音，说的是军籍上的事——「朱砂」两个字，在册子上写得清清楚楚。',
    '火把忽然灭了。黑暗里只有雨，和越来越近的脚步声。',
    '她终于转过身。',
    '「你要找的人，三年前就死在这座城头上了。」',
    '那人愣了一下，随即笑了。笑得很难看，像是终于等到了一句早就知道答案的话。',
    '雨更大了。远处传来三声号角，紧接着是城门轴木转动时那种闷到骨头里的响声。',
  ],

  // 扫榜结果的更多字段（表格用）
}

// ── 1. 状态灯 ──────────────────────────────────────────────

function StatusLamp({ toast }) {
  const run = MOCK.run
  return h(
    'button',
    {
      type: 'button',
      className: `nw-lamp${run.writing ? ' on' : ''}`,
      onClick: () => toast?.(`模拟：AI 正在写第 ${run.chapter} 回，已出 ${run.words} 字，${run.eta}后交稿`),
      title: '点一下看这一单的详情（演示数据）',
    },
    h('span', { className: 'nw-lamp-dot' }),
    h(
      'span',
      { className: 'nw-lamp-body' },
      h('span', { className: 'nw-lamp-text' }, run.writing ? `正在写第 ${run.chapter} 回` : '队列空闲'),
      h('span', { className: 'nw-lamp-sub' }, `${run.words}/${run.total} 字`),
    ),
  )
}

// ── 5. 两周柱状图 ───────────────────────────────────────────

function DayBars({ days, target, toast }) {
  const peak = Math.max(target || 1, ...days.map((row) => row.w))
  return h(
    'div',
    { className: 'nw-days' },
    h(
      'div',
      { className: 'nw-days-head' },
      h('span', null, '近两周'),
      h('span', { className: 'nw-hint' }, `达标 ${days.filter((row) => row.w >= target).length} 天 · 断更 ${days.filter((row) => row.w === 0).length} 天`),
    ),
    h(
      'div',
      { className: 'nw-days-bars' },
      days.map((row) => h(
        'button',
        {
          type: 'button',
          key: row.d,
          className: `nw-day${row.w === 0 ? ' nw-day-off' : row.w >= target ? ' nw-day-ok' : ''}`,
          onClick: () => toast?.(`${row.d}：${row.w === 0 ? '没写' : `${row.w} 字`}`),
          title: `${row.d} · ${row.w} 字`,
        },
        h('span', { className: 'nw-day-fill', style: { height: `${Math.max(4, (row.w / peak) * 100)}%` } }),
        h('span', { className: 'nw-day-label' }, row.d.slice(3)),
      )),
    ),
    h('div', { className: 'nw-days-rule' }, h('span', null, `目标 ${target} 字/天`)),
  )
}

// ── 6. 全书进度条 ──────────────────────────────────────────

function ProgressTrack({ progress, volumes, toast }) {
  const pct = Math.min(100, (progress.words / progress.target) * 100)
  // 卷是可选输入：没大纲、或大纲还没生成时是空数组。
  // 以前这里直接 volumes[0].name，空数组会当场抛错把整页打白。
  const vols = Array.isArray(volumes) && volumes.length
    ? volumes
    : [{ name: '全书', chapters: Math.max(1, Number(progress.total) || 1), done: Number(progress.chapter) || 0 }]
  return h(
    'div',
    { className: 'nw-progress' },
    h(
      'div',
      { className: 'nw-progress-head' },
      h('span', { className: 'nw-progress-num' }, `${fmtWords(progress.words)} / ${fmtWords(progress.target)} 字`),
      h('span', { className: 'nw-progress-meta' }, `第 ${progress.chapter}/${progress.total} 回 · ${String(vols[0].name).split(' · ')[0]}`),
    ),
    h(
      'div',
      { className: 'nw-progress-track' },
      vols.map((vol, index) => h(
        'button',
        {
          type: 'button',
          key: vol.name,
          className: 'nw-progress-vol',
          style: { flexGrow: vol.chapters },
          onClick: () => toast?.(`${vol.name}：${vol.done}/${vol.chapters} 章已采纳`),
          title: `${vol.name} · ${vol.done}/${vol.chapters}`,
        },
        h('span', { className: 'nw-progress-fill', style: { width: `${(vol.done / vol.chapters) * 100}%` } }),
        index ? h('span', { className: 'nw-progress-sep' }) : null,
        h('span', { className: 'nw-progress-name' }, vol.name.split(' · ')[1] || vol.name),
      )),
    ),
    h(
      'div',
      { className: 'nw-progress-foot' },
      h('span', { className: 'nw-hint' }, `已完成 ${pct.toFixed(1)}% · 剩余约 ${Math.max(0, progress.total - progress.chapter)} 回`),
    ),
  )
}

// ── 3. 命令面板 ────────────────────────────────────────────

const CMD_ITEMS = [
  { id: 'write', icon: '✍️', label: '写第 6 章', hint: '排工单 + 跳生产台', page: 'studio' },
  { id: 'batch', icon: '⚡', label: '连更 3 章', hint: '排三张工单', page: 'studio' },
  { id: 'jump', icon: '⏭', label: '跳到第 12 回', hint: '打开验收详情', page: 'review' },
  { id: 'find', icon: '🔍', label: '找「玉玺」', hint: '正文 + 八类账本一起搜', page: 'world' },
  { id: 'check', icon: '🩺', label: '体检全书', hint: '查设定冲突与伏笔逾期', page: 'review' },
  { id: 'plan', icon: '📐', label: '补第 7-12 回细纲', hint: '让 AI 填骨架', page: 'plan' },
  { id: 'export', icon: '📦', label: '导出全部数据', hint: '打包成 zip', page: 'settings' },
]

function CommandPalette({ projectId, onClose, go, toast }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const [scope, setScope] = useState('all')
  // 服务端搜：正文在磁盘上，浏览器没有全文。见 lib/store.js searchProject 的注释。
  // 输入第一次变化才发请求，打开面板时不打空查询。
  const [hits, setHits] = useState(null)
  const [searching, setSearching] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const seq = useRef(0)

  const commands = useMemo(() => {
    const key = q.trim().toLowerCase()
    if (!key) return CMD_ITEMS
    return CMD_ITEMS.filter((item) => `${item.label}${item.hint}`.toLowerCase().includes(key))
  }, [q])

  useEffect(() => {
    const key = q.trim()
    if (!key || !projectId) {
      setHits(null)
      setTruncated(false)
      return undefined
    }
    // 防抖：连打时只认最后一次。输入框每敲一个字都搜一遍会打满 RPC。
    const mine = ++seq.current
    setSearching(true)
    const timer = setTimeout(() => {
      api('search', { projectId, q: key, scope, limit: 20 })
        .then((data) => {
          if (mine !== seq.current) return
          setHits(Array.isArray(data?.hits) ? data.hits : [])
          setTruncated(!!data?.truncated)
        })
        .catch(() => {
          if (mine !== seq.current) return
          setHits([])
        })
        .then(() => {
          if (mine !== seq.current) return
          setSearching(false)
        })
    }, 220)
    return () => clearTimeout(timer)
  }, [q, scope, projectId])

  const rows = useMemo(() => {
    if (!hits) return commands.map((item) => ({ type: 'cmd', item }))
    const out = []
    const seenHeading = { cmd: false, hit: false }
    for (const item of commands) {
      if (!seenHeading.cmd) {
        out.push({ type: 'heading', text: '命令' })
        seenHeading.cmd = true
      }
      out.push({ type: 'cmd', item })
    }
    for (const hit of hits) {
      if (!seenHeading.hit) {
        out.push({ type: 'heading', text: `正文与账本（${hits.length} 条命中）` })
        seenHeading.hit = true
      }
      out.push({ type: 'hit', hit })
    }
    if (!out.length) return []
    return out
  }, [hits, commands])

  // 光标只能停在可执行行上，跳过小标题。
  const runnable = useMemo(() => rows.map((row, index) => (row.type === 'heading' ? -1 : index)).filter((i) => i >= 0), [rows])

  const runCmd = (item) => {
    if (!item) return
    onClose?.()
    go?.(item.page)
    toast?.(`已执行：${item.label}（演示，未接内核）`)
  }

  const runHit = (hit) => {
    if (!hit) return
    onClose?.()
    if (hit.kind === 'chapter') {
      // 命中段号通过 nw.openChapter / nw.openPara 带到验收台，那边会滚到并点亮那一段。
      writeLS('nw.openChapter', String(hit.chapter))
      if (Number.isFinite(hit.para)) writeLS('nw.openPara', String(hit.para))
      go?.('review')
      toast?.(`第 ${hit.chapter} 回 · 第 ${(Number(hit.para) || 0) + 1} 段`)
      return
    }
    if (hit.kind === 'outline') {
      go?.('plan')
      toast?.(`大纲：第 ${hit.chapter ?? '?'} 回`)
      return
    }
    go?.('world')
    toast?.(`账本 · ${hit.title || hit.id}（${hit.ledger || ''}）`)
  }

  const run = (row) => {
    if (!row) return
    if (row.type === 'cmd') runCmd(row.item)
    else if (row.type === 'hit') runHit(row.hit)
  }

  const activeRow = rows[cursor]
  return h(
    Modal,
    {
      title: '命令与搜索',
      onClose,
      footer: h('span', { className: 'nw-hint' }, '↑↓ 选 · Enter 执行 · Esc 关闭'),
    },
    h(Input, {
      value: q,
      placeholder: '输命令，或直接搜正文与账本（例如「玉玺」）…',
      autoFocus: true,
      'aria-label': '命令与全文搜索',
      onChange: (v) => {
        setQ(v)
        setCursor(0)
      },
      onKeyDown: (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          const at = runnable.indexOf(cursor)
          const next = event.key === 'ArrowDown'
            ? runnable[Math.min(runnable.length - 1, Math.max(0, at) + (at < 0 ? 0 : 1))]
            : runnable[Math.max(0, (at < 0 ? runnable.length : at) - 1)]
          if (next !== undefined && next >= 0) setCursor(next)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          run(activeRow)
        }
      },
    }),
    q.trim()
      ? h(
        'div',
        { className: 'nw-cmdk-scope' },
        ['all', 'chapters', 'ledger', 'outline'].map((key) => h(
          'button',
          {
            type: 'button',
            key,
            className: `nw-seg-btn${scope === key ? ' on' : ''}`,
              'aria-pressed': scope === key ? 'true' : 'false',
            onClick: () => setScope(key),
          },
          { all: '全部', chapters: '正文', ledger: '账本', outline: '大纲' }[key],
        )),
        searching ? h('span', { className: 'nw-hint' }, '搜索中…') : null,
        truncated ? h('span', { className: 'nw-hint' }, '命中太多，只显示前 20 条') : null,
      )
      : null,
    h(
      'div',
      { className: 'nw-cmdk-list' },
      rows.length
        ? rows.map((row, index) => (row.type === 'heading'
          ? h('div', { className: 'nw-cmdk-head', key: `h${index}` }, row.text)
          : h(
            'button',
            {
              type: 'button',
              key: row.type === 'cmd' ? `c-${row.item.id}` : `s-${row.hit.kind}-${index}`,
              className: `nw-cmdk-row${index === cursor ? ' on' : ''}${row.type === 'hit' ? ' nw-cmdk-hit' : ''}`,
              onMouseEnter: () => setCursor(index),
              onClick: () => run(row),
            },
            h('span', { className: 'nw-cmdk-icon' }, row.type === 'cmd' ? row.item.icon : (row.hit.kind === 'ledger' ? '📒' : row.hit.kind === 'outline' ? '📐' : '📄')),
            h('span', { className: 'nw-cmdk-label' }, row.type === 'cmd'
              ? row.item.label
              : (row.hit.kind === 'chapter'
                // 【12 条 #9】服务端现在回所有命中，还带 nth/count。
                // 只显示「第 N 段」看不出这句在这章里出现了几次，补上「第 2/8 处」。
                ? `第 ${row.hit.chapter} 回 · 第 ${(Number(row.hit.para) || 0) + 1} 段${Number(row.hit.count) > 1 ? ` · 第 ${row.hit.nth}/${row.hit.count} 处` : ''}`
                : row.hit.title)),
            h('span', { className: 'nw-cmdk-hint' }, row.type === 'cmd' ? row.item.hint : String(row.hit.quote ?? '').slice(0, 60)),
            h('span', { className: 'nw-cmdk-go' }, '↵'),
          )))
        : h(Empty, null, hits ? '没有匹配。' : '没有匹配的命令。'),
    ),
  )
}

// ── 12. 意图复用 ───────────────────────────────────────────

function IntentChips({ onPick, toast }) {
  return h(
    'div',
    { className: 'nw-chips' },
    h('span', { className: 'nw-chips-label' }, '最近用过'),
    MOCK.intents.map((text, index) => h(
      'button',
      {
        type: 'button',
        key: index,
        className: 'nw-chip',
        title: text,
        onClick: () => {
          onPick?.(text)
          toast?.('已填回最近第 ' + (index + 1) + ' 条意图')
        },
      },
      `${index + 1}. ${text.slice(0, 16)}${text.length > 16 ? '…' : ''}`,
    )),
  )
}

// ── 13. 逐段热力条 ─────────────────────────────────────────

/**
 * 段落色调。
 *
 * 真值优先：aiHits 是服务端 chapter.aistyle 扫词表的结果（带段号），
 * 有它的时候彩带说的是实际问题，不再是「第 3 段一定红」的装饰。
 * 没有命中、也没有问题时才回落到长度启发式 —— 短段算节奏拖，其余算好段。
 */
function heatTone(text, index, aiHits, issues) {
  const hits = Array.isArray(aiHits) ? aiHits.filter((row) => Number(row.para) === index) : []
  if (hits.length) return 'bad'
  const marks = Array.isArray(issues) ? issues.filter((row) => Number(row.para) === index) : []
  if (marks.some((row) => row.type === 'logic')) return 'bad'
  if (marks.length) return 'warn'
  const size = String(text || '').length
  if (size < 30) return 'warn'
  return 'good'
}

function HeatStrip({
  paragraphs, active, onPick, aiHits, issues,
}) {
  return h(
    'div',
    { className: 'nw-heat' },
    h('span', { className: 'nw-heat-title' }, '段'),
    h(
      'div',
      { className: 'nw-heat-track' },
      paragraphs.map((para, index) => h(
        'button',
        {
          type: 'button',
          key: index,
          className: `nw-heat-cell nw-heat-${heatTone(para, index, aiHits, issues)}${active === index ? ' on' : ''}`,
          style: { flexGrow: Math.max(1, Math.min(6, Math.ceil(String(para).length / 60))) },
          onClick: () => onPick?.(index),
          title: `第 ${index + 1} 段 · ${String(para).length} 字 · ${heatTone(para, index, aiHits, issues) === 'bad' ? 'AI 味重' : heatTone(para, index, aiHits, issues) === 'warn' ? '节奏拖' : '好段'}`,
        },
      )),
    ),
    h(
      'div',
      { className: 'nw-heat-legend' },
      h('span', { className: 'nw-heat-key nw-heat-good' }, '好'),
      h('span', { className: 'nw-heat-key nw-heat-warn' }, '拖'),
      h('span', { className: 'nw-heat-key nw-heat-bad' }, 'AI 味'),
    ),
  )
}

// ── 18. 账本格出处 ─────────────────────────────────────────

function SourcePop({ source, onClose }) {
  if (!source) return null
  return h(
    Modal,
    {
      title: '这条从哪来',
      onClose,
      footer: h(Btn, { kind: 'ghost', small: true, onClick: onClose }, '知道了'),
    },
    h('div', { className: 'nw-source' },
      h(Tag, { tone: 'amber' }, `第 ${source.chapter} 回`),
      h('p', { className: 'nw-source-quote' }, `「${source.quote}」`),
      h('p', { className: 'nw-hint' }, '演示数据：真出处由 nightwrite_op 在写账本时一并记下 chapter + quote，点它就能跳回那一段。')),
  )
}

// ═════════ 20-cockpit.js ═════════
/**
 * 长夜 · 驾驶舱
 *
 * 一屏回答「今天干什么」：三个大数字 + 欠账清单 + 最近产出 + 今日建议。
 */

/**
 * 大纲 → 进度条的卷分段。
 *
 * ProgressTrack 要的是 [{name, chapters, done}]，而大纲给的是
 * [{index,title,from,to,chapters:[{chapter,status}]}]。这里做一次转换，
 * 顺便把「已采纳」的章算成 done —— 进度条的分母是规划章数，分子是写完的。
 */
function outlineVolumes(outline, writtenChapters) {
  const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
  if (!volumes.length) {
    // 没大纲也能画：整本书当一段，进度按已写章数走。
    const total = Math.max(1, Number(writtenChapters) || 1)
    return [{ name: '全书', chapters: total, done: Number(writtenChapters) || 0 }]
  }
  return volumes.map((vol) => {
    const rows = Array.isArray(vol?.chapters) ? vol.chapters : []
    return {
      name: `第${vol.index ?? '?'}卷 · ${vol.title || '未命名'}`,
      chapters: Math.max(1, rows.length),
      done: rows.filter((row) => row.status === 'written').length,
    }
  })
}

/** 大纲里一共规划了多少回；没大纲就回 0，让调用方自己兜底。 */
function outlineTotal(outline) {
  const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
  return volumes.reduce((sum, vol) => sum + (Array.isArray(vol?.chapters) ? vol.chapters.length : 0), 0)
}

/**
 * 对齐简报：把「现在什么状况 / 最近在场的人 / 欠着什么 / 最近几回 / 下一步」
 * 压成一段可以直接交给 agent 的纯文本。
 *
 * 为什么不自动发给对话：发出去就是一次模型调用，会产生费用、会占上下文。
 * 而且大多数时候作者只是想确认「AI 到底知不知道我现在写到哪了」。
 * 所以这里先给看，要发再点。
 */
function BriefingCard({ projectId, toast }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [meta, setMeta] = useState(null)

  const load = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const value = await api('briefing.get', { projectId })
      setText(value.text ?? '')
      setMeta(value)
      setOpen(true)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast('简报已复制，粘到对话开头，agent 就知道你写到哪了')
    } catch {
      toast('复制失败，手动选中下面那段')
    }
  }

  return h(
    Card,
    {
      title: '对齐简报',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h('span', { className: 'nw-card-badge' }, '给 AI 看的'),
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: load }, busy ? '正在汇总…' : open ? '重新生成' : '生成简报'),
      ),
    },
    h('p', { className: 'nw-hint' }, '一段纯文本：书写到哪、谁在场、欠什么、下一步该写哪一回。粘到对话开头用，比让 AI 自己翻文件准。'),
    open
      ? h(
        'div',
        { className: 'nw-brief' },
        meta ? h('div', { className: 'nw-hint' }, `${meta.chapters} 回 · ${fmtWords(meta.totalWords ?? 0)} · 最近第 ${meta.lastChapter} 回`) : null,
        h('pre', { className: 'nw-brief-text' }, text),
        h('div', { className: 'nw-actions' }, h(Btn, { small: true, kind: 'primary', onClick: copy }, '复制全文')),
      )
      : null,
  )
}

function DebtRow({ debt, onJump }) {
  const tone = debt.level === 'red' ? 'red' : debt.level === 'orange' ? 'amber' : debt.level === 'yellow' ? 'blue' : 'grey'
  return h(
    'button',
    { type: 'button', className: 'nw-debt', onClick: () => onJump?.(debt) },
    h('span', { className: `nw-debt-dot nw-dot-${debt.level}` }),
    h(
      'span',
      { className: 'nw-debt-main' },
      h('span', { className: 'nw-debt-title' }, debt.title),
      h('span', { className: 'nw-debt-sub' }, debt.sub),
    ),
    h(Tag, { tone }, debt.level === 'red' ? '必处理' : debt.level === 'orange' ? '该处理' : '待留意'),
    h('span', { className: 'nw-debt-go' }, '›'),
  )
}

function StatBox({ label, value, unit, hint, tone = 'amber', onClick }) {
  return h(
    'button',
    { type: 'button', className: `nw-stat nw-stat-${tone}`, onClick },
    h('span', { className: 'nw-stat-label' }, label),
    h('span', { className: 'nw-stat-value' }, value, unit ? h('em', null, unit) : null),
    hint ? h('span', { className: 'nw-stat-hint' }, hint) : null,
  )
}

// 【24 条 #4】今天的行动卡。
// 规则很死：先看红账 → 再看待验收 → 最后才谈继续写。让「今天干什么」永远有唯一答案，
// 而不是四个数字摆在那里让人自己权衡。
function ActionCard({ stats, debts, go, toast }) {
  const red = debts.find((row) => row.level === 'red')
  const pending = stats.pending ?? 0
  const first = red || debts[0] || null

  let title
  let sub
  let label
  let action

  if (first) {
    title = `先处理第 ${first.target?.chapter ?? 1} 回${first.target?.chapter ? '（该章有硬伤）' : ''}`
    sub = first.title || first.sub || '这条欠账会一路带着往下写，越拖越难改。'
    label = '去改这一章 →'
    action = () => go(first.target?.page || 'review', first.target)
  } else if (pending) {
    title = `有 ${pending} 章在等你拍板`
    sub = '验收是所有活儿汇合的地方：不拍板，队列就堵在这里。'
    label = '去验收台 →'
    action = () => go('review')
  } else {
    title = '今天没有欠账，可以往下写'
    sub = '世界状态干净、队列空着，适合推主线或补伏笔。'
    label = '排一单 →'
    action = () => go('studio')
  }

  return h(
    'div',
    { className: `nw-action${first ? ' nw-action-warn' : ''}` },
    h(
      'div',
      { className: 'nw-action-main' },
      h('span', { className: 'nw-action-cap' }, '今天干什么'),
      h('h3', { className: 'nw-action-title' }, title),
      h('p', { className: 'nw-action-sub' }, sub),
    ),
    h(Btn, { kind: 'primary', onClick: action }, label),
    h(Btn, {
      kind: 'ghost',
      small: true,
      onClick: () => toast('演示：会按「红账 → 待验收 → 队列」重排一遍优先级'),
    }, '换一个建议'),
  )
}

function CockpitPage({ projectId, project, go, toast, refreshKey }) {
  const ov = useAsync(() => api('overview', { projectId }), [projectId, refreshKey], { skip: !projectId })
  // 大纲只为了给进度条分段（哪几章属于哪一卷）。读一份本地 json，不贵。
  const ol = useAsync(() => api('outline.get', { projectId }), [projectId, refreshKey], { skip: !projectId })

  if (!projectId) {
    return h(Empty, null, '还没有作品，去「设置 → 作品数据」新建一部。')
  }
  if (ov.loading && !ov.data) return h(Loading, null)
  if (ov.error) return h(ErrorBox, { error: ov.error, onRetry: ov.reload })

  const data = ov.data
  const stats = data.stats || {}
  const debts = data.debts || []
  const red = debts.filter((row) => row.level === 'red').length

  // 【12 条 #4】进度条接真数：以前这里写死 MOCK.progress（12840/60000、第 6/30 回），
  // 不管作者写到第几章都显示同一根条。现在字数取 stats.totalWords、目标取作品的
  // targetWords、章数取 stats.chapters，卷分段取大纲的 volumes。
  const targetWords = Number(stats.targetWords ?? project?.targetWords ?? 0) || Number(stats.totalWords ?? 0) || 1
  const progress = {
    words: Number(stats.totalWords ?? 0),
    target: targetWords,
    chapter: Number(stats.chapters ?? 0),
    total: Math.max(Number(stats.chapters ?? 0), outlineTotal(ol.data?.outline)),
  }
  const volumes = outlineVolumes(ol.data?.outline, stats.chapters)

  const jump = (debt) => {
    const target = debt?.target || {}
    if (target.page) go(target.page, target)
    else toast('这条欠账还没有直达入口')
  }

  return h(
    'div',
    { className: 'nw-page nw-cockpit' },
    h(
      'div',
      { className: 'nw-hero' },
      h(
        'div',
        { className: 'nw-hero-left' },
        h('h2', null, data.project?.name || '未命名'),
        h(
          'div',
          { className: 'nw-hero-tags' },
          data.project?.genre ? h(Tag, { tone: 'amber' }, data.project.genre) : null,
          h(Tag, { tone: red ? 'red' : 'green' }, red ? `${red} 条红账` : '没有红账'),
          h(Tag, { tone: 'grey' }, `质检门槛 ${data.project?.qualityGate ?? 70}`),
        ),
      ),
      h(
        'div',
        { className: 'nw-hero-right' },
        h(Btn, { kind: 'primary', onClick: () => go('studio') }, '▶ 一键开工'),
        h(Btn, { kind: 'ghost', onClick: () => go('review') }, '去验收台'),
      ),
    ),
    // 【24 条 #4】一句大白话 + 一个直接执行的按钮。
    // 把「今天该先干什么」从一行灰字升级成整宽行动卡：动词 + 对象 + 分数 + 一个出口。
    h(ActionCard, { stats, debts, go, toast }),
    // 【24 条 #6】全书进度条：字数 / 章数 / 卷分割。
    h(ProgressTrack, { progress, volumes, toast }),
    h(
      'div',
      { className: 'nw-stats' },
      h(StatBox, {
        label: '待验收',
        value: stats.pending ?? 0,
        unit: '章',
        hint: (stats.pending ?? 0) ? '等你拍板' : '清空了',
        tone: (stats.pending ?? 0) ? 'amber' : 'green',
        onClick: () => go('review'),
      }),
      h(StatBox, {
        label: '队列中',
        value: stats.queued ?? 0,
        unit: '章',
        hint: (stats.running ?? 0) ? `${stats.running} 章在跑` : '空闲',
        tone: (stats.queued ?? 0) ? 'teal' : 'green',
        onClick: () => go('studio'),
      }),
      h(StatBox, {
        label: '欠账',
        value: debts.length,
        unit: '条',
        hint: red ? `${red} 条红账` : '干净',
        tone: red ? 'red' : 'green',
      }),
      h(StatBox, {
        label: '今日字数',
        value: fmtWords(stats.writeToday ?? 0),
        hint: `目标 ${fmtWords(stats.targetWords ?? 2500)}`,
        tone: 'blue',
        onClick: () => go('studio'),
      }),
    ),
    h(
      'div',
      { className: 'nw-cols' },
      h(
        Card,
        {
          title: '欠账清单',
          extra: h('span', { className: 'nw-card-badge' }, `${debts.length} 条`),
          className: 'nw-card-debt',
        },
        debts.length
          ? h('div', { className: 'nw-debt-list' }, debts.map((debt, index) => h(DebtRow, { debt, key: `${debt.kind}-${index}`, onJump: jump })))
          : h(Empty, null, '没有欠账。世界状态干净，可以放心往下写。'),
      ),
      h(
        'div',
        { className: 'nw-col-side' },
        h(
          Card,
          { title: '今日建议' },
          // 【24 条 #5】两周柱状图住在「今日建议」卡顶部：趋势比单日数字更能说明问题。
          // 服务端 overview 现在按每章 updatedAt 的本地日期分桶回 stats.dailyWords
          // （见 lib/store.js dailyWordsFor）。有真数据就用真数据，没有才退回演示曲线 ——
          // 界面先长出来是对的，但一直用假曲线会让人以为自己在断更。
          h(DayBars, {
            days: Array.isArray(stats.dailyWords) && stats.dailyWords.length
              ? stats.dailyWords.map((row) => ({ d: String(row.day ?? '').slice(5), w: Number(row.words) || 0 }))
              : MOCK.days,
            target: stats.targetWords ?? 2500,
            toast,
          }),
          h('p', { className: 'nw-suggest' }, data.suggestion || '先建作品，再开工。'),
          h(
            'div',
            { className: 'nw-meta-grid' },
            h('span', null, `已采纳 ${stats.accepted ?? 0} 章`),
            h('span', null, `均分 ${stats.avgScore ?? 0}`),
            h('span', null, `总字数 ${fmtWords(stats.totalWords ?? 0)}`),
            h('span', null, `连更 ${stats.streak ?? 0} 天`),
            h('span', null, `累计花费 ${fmtCost(stats.totalCost ?? 0)}`),
            h('span', null, `未回收伏笔 ${data.unclosedForeshadow ?? 0}`),
          ),
        ),
        h(
          Card,
          { title: '最近产出' },
          (data.recent || []).length
            ? h(
              'div',
              { className: 'nw-recent' },
              (data.recent || []).map((row) => h(
                'button',
                {
                  type: 'button',
                  className: 'nw-recent-row',
                  key: row.chapter,
                  onClick: () => go('review', { chapter: row.chapter }),
                },
                h('span', { className: 'nw-recent-n' }, `第 ${row.chapter} 回`),
                h('span', { className: 'nw-recent-title' }, row.title || ''),
                h(Tag, { tone: STATUS_TONE[row.status] || 'grey' }, STATUS_LABEL[row.status] || row.status),
                h('span', { className: `nw-recent-score nw-score-${scoreTone(row.score)}` }, row.score || '—'),
              )),
            )
            : h(Empty, null, '还没写过章节。'),
        ),
        // 简报是「把当前状态说给 AI 听」的出口：写完这段粘到对话开头，
        // 比让模型自己翻一堆文件去拼上下文稳。
        h(BriefingCard, { projectId, toast }),
      ),
    ),
  )
}

// ═════════ 25-plan.js ═════════
/**
 * 长夜 · 大纲
 *
 * 补的是工作流中间断掉的一截：老板给一句话方案 → 出卷 / 章骨架 → 才谈得上下指令单。
 *
 * 这一页不假装自己能写故事：骨架是机械算出来的（卷数 × 每卷章数），
 * 每章的摘要 / 钩子由 AI 通过 nightwrite_op 的 outline.save 回填，
 * 人在这里改，改完一键把「第几回 + 意图」塞进生产台。
 */

const OUTLINE_STATUS = {
  todo: { label: '未排', tone: 'grey' },
  drafted: { label: '已有稿', tone: 'amber' },
  written: { label: '已采纳', tone: 'green' },
}

function outlinePrompt(brief) {
  const line = (key, label) => (String(brief?.[key] ?? '').trim() ? `- ${label}：${String(brief[key]).trim()}\n` : '')
  return [
    '帮我把这份方案铺成卷章骨架，然后回填每章的一句话摘要与章末钩子。\n',
    '方案：\n',
    line('premise', '一句话故事'),
    line('genre', '题材'),
    line('audience', '目标读者'),
    line('protagonist', '主角'),
    line('goal', '主角要什么'),
    line('conflict', '核心阻力'),
    line('hook', '开场钩子'),
    line('ending', '结局方向'),
    `- 规模：${brief?.volumes ?? 3} 卷，每卷 ${brief?.chaptersPerVolume ?? 20} 章\n`,
    '\n做法：先 nightwrite_op 调 outline.get 拿到当前骨架（卷号 / 章号已经在里面），',
    '再把每章的 title / summary / hook 填好，用 outline.save 整份写回。',
    '摘要只写「这一章发生什么、主角状态怎么变」，一句话；钩子写「结尾让人翻页的那一下」。',
  ].join('')
}

function PlanBrief({ brief, onEdit, onSave, onGenerate, onCopy, busy }) {
  const FIELDS = [
    { key: 'premise', label: '一句话故事', rows: 2, placeholder: '例：元末，女主带着系统穿到朱元璋身边，要从他手里抢下天下。' },
    { key: 'genre', label: '题材', rows: 1, placeholder: '历史穿越 / 女帝' },
    { key: 'audience', label: '目标读者', rows: 1, placeholder: '看权谋爽文的男性读者' },
    { key: 'protagonist', label: '主角', rows: 1, placeholder: '名字 + 一句话身份' },
    { key: 'goal', label: '主角要什么', rows: 1, placeholder: '主线目标，越具体越好' },
    { key: 'conflict', label: '核心阻力', rows: 1, placeholder: '谁挡着、缺什么、时间压力' },
    { key: 'hook', label: '开场钩子', rows: 1, placeholder: '第一章第一屏就要抓住人的那件事' },
    { key: 'ending', label: '结局方向', rows: 1, placeholder: '可以很粗，但要有个落点' },
  ]
  return h(
    Card,
    {
      title: '老板的方案',
      extra: h('span', { className: 'nw-card-badge' }, '先有方案，才有骨架'),
      className: 'nw-plan-brief',
    },
    h(
      'div',
      { className: 'nw-plan-grid' },
      FIELDS.map((field) => h(
        'div',
        { className: `nw-plan-field${field.rows > 1 ? ' nw-plan-wide' : ''}`, key: field.key },
        h(Field, { label: field.label }, field.rows > 1
          ? h(TextArea, {
            value: brief[field.key] ?? '',
            rows: field.rows,
            placeholder: field.placeholder,
            onChange: (v) => onEdit({ [field.key]: v }),
          })
          : h(Input, {
            value: brief[field.key] ?? '',
            placeholder: field.placeholder,
            onChange: (v) => onEdit({ [field.key]: v }),
          })),
      )),
      h(
        'div',
        { className: 'nw-plan-field' },
        h(Field, { label: '几卷' }, h(Input, {
          type: 'number',
          value: brief.volumes,
          onChange: (v) => onEdit({ volumes: Number(v) || 1 }),
        })),
      ),
      h(
        'div',
        { className: 'nw-plan-field' },
        h(Field, { label: '每卷几章' }, h(Input, {
          type: 'number',
          value: brief.chaptersPerVolume,
          onChange: (v) => onEdit({ chaptersPerVolume: Number(v) || 1 }),
        })),
      ),
    ),
    h(
      'div',
      { className: 'nw-plan-foot' },
      h('span', { className: 'nw-hint' }, `共 ${(brief.volumes || 0) * (brief.chaptersPerVolume || 0)} 章的位置`),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { kind: 'ghost', onClick: onCopy, disabled: busy }, '复制给 AI 的提示词'),
        h(Btn, { kind: 'ghost', onClick: onSave, disabled: busy }, '只存方案'),
        h(Btn, { kind: 'primary', onClick: onGenerate, disabled: busy }, busy ? '生成中…' : '生成骨架'),
      ),
    ),
  )
}

function PlanRow({ row, onEdit, onSend }) {
  const tone = OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo
  return h(
    'div',
    { className: 'nw-plan-row' },
    h('span', { className: 'nw-plan-n' }, `第 ${row.chapter} 回`),
    h(
      'span',
      { className: 'nw-plan-main' },
      h(Input, {
        value: row.title,
        placeholder: '这一回的标题',
        onChange: (v) => onEdit({ title: v }),
      }),
      h(Input, {
        value: row.summary,
        placeholder: '一句话：发生什么、主角状态怎么变',
        onChange: (v) => onEdit({ summary: v }),
      }),
      h(Input, {
        value: row.hook,
        placeholder: '章末钩子',
        onChange: (v) => onEdit({ hook: v }),
      }),
    ),
    h(Tag, { tone: tone.tone }, tone.label),
    h(Btn, { small: true, kind: 'ghost', onClick: onSend }, '送去生产台'),
  )
}

// 【24 条 #7】章卡：一章一张卡，扫一眼就知道哪些章还是空的。
// 现在的 PlanRow 是「一行三个输入框」，20 章就是 20 行密集表单，翻卷时眼睛没有落脚点。
function PlanCard({ row, onEdit, onSend, onOpen }) {
  const tone = OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo
  const empty = !String(row.title ?? '').trim() && !String(row.summary ?? '').trim()
  return h(
    'div',
    { className: `nw-pcard${empty ? ' nw-pcard-empty' : ''}${row.status === 'written' ? ' nw-pcard-done' : ''}` },
    h(
      'div',
      { className: 'nw-pcard-head' },
      h('span', { className: 'nw-pcard-n' }, `第 ${row.chapter} 回`),
      h(Tag, { tone: tone.tone }, tone.label),
    ),
    h('div', { className: 'nw-pcard-title' }, row.title || h('span', { className: 'nw-pcard-ph' }, '（还没标题）')),
    h('p', { className: 'nw-pcard-sum' }, row.summary || h('span', { className: 'nw-pcard-ph' }, '这一章发生什么？')),
    h(
      'div',
      { className: 'nw-pcard-hook' },
      h('span', { className: 'nw-pcard-hook-k' }, '钩'),
      h('span', null, row.hook || h('span', { className: 'nw-pcard-ph' }, '章末那一下还没写')),
    ),
    h(
      'div',
      { className: 'nw-pcard-foot' },
      h(Btn, { small: true, kind: 'ghost', onClick: onOpen }, '编辑'),
      h(Btn, { small: true, kind: 'ghost', onClick: onSend }, '送去生产台'),
    ),
  )
}

// 【24 条 #8】时间线视图：卷是横条，章是点。适合看节奏与篇幅分布。
function PlanTimeline({ volumes, onSend }) {
  const max = Math.max(1, ...volumes.map((vol) => vol.chapters.length))
  return h(
    'div',
    { className: 'nw-ptl' },
    volumes.map((vol) => h(
      'div',
      { className: 'nw-ptl-vol', key: vol.id },
      h('div', { className: 'nw-ptl-head' }, h('span', null, vol.title), h('span', { className: 'nw-hint' }, `${vol.chapters.length} 章`)),
      h(
        'div',
        { className: 'nw-ptl-rail', style: { width: `${(vol.chapters.length / max) * 100}%` } },
        vol.chapters.map((row) => h(
          'button',
          {
            type: 'button',
            key: row.chapter,
            className: `nw-ptl-dot nw-ptl-${row.status || 'todo'}`,
            title: `第 ${row.chapter} 回 · ${row.title || '未命名'} · ${(OUTLINE_STATUS[row.status] ?? OUTLINE_STATUS.todo).label}`,
            onClick: () => onSend(row),
          },
        )),
      ),
    )),
    h('p', { className: 'nw-hint' }, '点是章：灰=未排，琥珀=已有稿，绿=已采纳。点一下直接送去生产台。'),
  )
}

// 【24 条 #9】让 AI 把这一卷的摘要与钩子填了。
// 现在是「一章一章手打」，20 章就是 20 次输入；这里改成按卷一次派活。
function FillVolumeBar({ vol, busy, onFill, toast }) {
  if (!vol) return null
  const empty = vol.chapters.filter((row) => !String(row.summary ?? '').trim()).length
  return h(
    'div',
    { className: 'nw-fillbar' },
    h(
      'div',
      { className: 'nw-fillbar-main' },
      h('span', { className: 'nw-fillbar-title' }, `本卷还有 ${empty} 章没摘要`),
      h('span', { className: 'nw-hint' }, '按卷一次派活，比一章一章敲快二十倍；填完仍然可以逐张改。'),
    ),
    h(Btn, {
      kind: 'primary',
      small: true,
      disabled: busy || !empty,
      onClick: () => {
        onFill?.()
        toast?.(`已派活：让 AI 回填「${vol.title}」${empty} 章的摘要与钩子（演示）`)
      },
    }, busy ? '派活中…' : `✎ AI 填这卷 ${empty} 章`),
  )
}

function PlanPage({ projectId, project, go, toast, onRefresh }) {
  const res = useAsync(() => api('outline.get', { projectId }), [projectId], { skip: !projectId })
  const [brief, setBrief] = useState(null)
  const [volumes, setVolumes] = useState([])
  const [busy, setBusy] = useState(false)
  const [openVol, setOpenVol] = useState(1)
  // 【24 条 #8】骨架三视图：卡片 / 列表 / 时间线。列表就是原来的密集表单，留着给要批量改的人。
  const [view, setView] = useState('cards')
  const [cardOpen, setCardOpen] = useState(null)

  useEffect(() => {
    if (!res.data?.outline) return
    setBrief(res.data.outline.brief)
    setVolumes(res.data.outline.volumes ?? [])
  }, [res.data])

  if (!projectId) return h(Empty, null, '还没有作品，去「设置 → 作品数据」新建一部。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const current = brief ?? {
    premise: '', genre: '', audience: '', protagonist: '', goal: '', conflict: '', hook: '', ending: '', volumes: 3, chaptersPerVolume: 20,
  }

  const editBrief = (patch) => setBrief({ ...current, ...patch })

  const persist = async (payload) => {
    setBusy(true)
    try {
      const out = await api('outline.save', { projectId, outline: payload })
      setBrief(out.outline.brief)
      setVolumes(out.outline.volumes ?? [])
      toast('方案已保存')
      return out.outline
    } catch (error) {
      toast(error.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    try {
      const out = await api('outline.generate', { projectId, brief: current })
      setBrief(out.outline.brief)
      setVolumes(out.outline.volumes ?? [])
      setOpenVol(1)
      toast(`骨架已生成：${out.outline.volumes.length} 卷 ${(out.outline.volumes[0]?.chapters?.length ?? 0) * out.outline.volumes.length} 章`)
      onRefresh?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPrompt = async () => {
    const text = outlinePrompt(current)
    try {
      await navigator.clipboard.writeText(text)
      toast('提示词已复制，回会话里发给 AI')
    } catch {
      window.prompt('复制下面这段发给 AI：', text)
    }
  }

  // 章节字段改动：先改本地，失焦语义交给「保存骨架」。
  // 每次按键都写盘会让 120 章的骨架变成 120 个 RPC，双击卡顿。
  const editRow = (volIndex, chIndex, patch) => {
    setVolumes((prev) => prev.map((vol, vi) => (vi !== volIndex ? vol : {
      ...vol,
      chapters: vol.chapters.map((row, ci) => (ci !== chIndex ? row : { ...row, ...patch })),
    })))
  }

  const saveTree = async () => {
    const out = await persist({ brief: current, volumes })
    if (out) toast('骨架已保存')
  }

  const send = (row) => {
    writeLS(LS.orderChapter, String(row.chapter))
    writeLS(LS.orderIntent, [row.summary, row.hook ? `章末钩子：${row.hook}` : ''].filter(Boolean).join(' · '))
    toast(`第 ${row.chapter} 回已送去生产台`)
    go('studio')
  }

  const active = volumes[Math.max(0, Math.min(volumes.length - 1, openVol - 1))] ?? null

  return h(
    'div',
    { className: 'nw-page nw-plan' },
    h(PlanBrief, {
      brief: current,
      busy,
      onEdit: editBrief,
      onSave: () => persist({ brief: current }),
      onGenerate: generate,
      onCopy: copyPrompt,
    }),
    volumes.length
      ? h(
        Card,
        {
          title: '卷章骨架',
          extra: h(
            'div',
            { className: 'nw-plan-vols' },
            volumes.map((vol) => h(
              'button',
              {
                type: 'button',
                key: vol.id,
                className: `nw-seg-btn${active && active.index === vol.index ? ' on' : ''}`,
              'aria-pressed': active && active.index === vol.index ? 'true' : 'false',
                onClick: () => setOpenVol(vol.index),
              },
              vol.title,
              h('span', { className: 'nw-seg-n' }, String(vol.chapters.length)),
            )),
          ),
        },
        h('p', { className: 'nw-hint' }, '摘要与钩子由 AI 回填（nightwrite_op → outline.save），这里可以直接改；改完按「保存骨架」落盘。'),
        h(FillVolumeBar, { vol: active, busy, onFill: () => {}, toast }),
        h(
          'div',
          { className: 'nw-plan-viewbar' },
          h(
            'div',
            { className: 'nw-seg' },
            [
              { value: 'cards', label: '卡片' },
              { value: 'list', label: '列表' },
              { value: 'timeline', label: '时间线' },
            ].map((item) => h(
              'button',
              {
                type: 'button',
                key: item.value,
                className: `nw-seg-btn${view === item.value ? ' on' : ''}`,
              'aria-pressed': view === item.value ? 'true' : 'false',
                onClick: () => setView(item.value),
              },
              item.label,
            )),
          ),
          h('span', { className: 'nw-hint' }, active ? `${active.chapters.length} 章` : ''),
        ),
        active
          ? (view === 'cards'
            ? h(
              'div',
              { className: 'nw-pcards' },
              active.chapters.map((row, ci) => h(PlanCard, {
                key: row.chapter,
                row,
                onEdit: (patch) => editRow(volumes.findIndex((v) => v.index === active.index), ci, patch),
                onOpen: () => setCardOpen({ row, ci }),
                onSend: () => send(row),
              })),
            )
            : view === 'timeline'
              ? h(PlanTimeline, { volumes, onSend: send })
              : h(
                'div',
                { className: 'nw-plan-rows' },
                active.chapters.map((row, ci) => h(PlanRow, {
                  key: row.chapter,
                  row,
                  onEdit: (patch) => editRow(volumes.findIndex((v) => v.index === active.index), ci, patch),
                  onSend: () => send(row),
                })),
              ))
          : null,
        h(
          'div',
          { className: 'nw-plan-foot' },
          h('span', { className: 'nw-hint' }, `${volumes.length} 卷 · ${volumes.reduce((n, v) => n + v.chapters.length, 0)} 章`),
          h(
            'div',
            { className: 'nw-actions' },
            h(Btn, { kind: 'ghost', onClick: () => res.reload() }, '丢弃改动'),
            h(Btn, { kind: 'primary', onClick: saveTree, disabled: busy }, '保存骨架'),
          ),
        ),
      )
      : h(
        Card,
        { title: '卷章骨架' },
        h(Empty, null, '还没有骨架。上面填好一句话故事与规模，按「生成骨架」。'),
      ),
    // 【24 条 #7】点卡片才展开编辑：卡片负责「扫」，弹窗负责「改」，两者不抢空间。
    cardOpen !== null && active
      ? h(Modal, {
        title: `编辑第 ${active.chapters[cardOpen].chapter} 回`,
        onClose: () => setCardOpen(null),
        footer: h(
          Fragment,
          null,
          h(Btn, { kind: 'ghost', small: true, onClick: () => setCardOpen(null) }, '收起'),
          h(Btn, {
            kind: 'primary',
            small: true,
            onClick: () => {
              send(active.chapters[cardOpen])
              setCardOpen(null)
            },
          }, '送去生产台'),
        ),
      },
      h(Field, { label: '标题' }, h(Input, {
        value: active.chapters[cardOpen].title,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { title: v }),
      })),
      h(Field, { label: '一句话摘要' }, h(TextArea, {
        value: active.chapters[cardOpen].summary,
        rows: 3,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { summary: v }),
      })),
      h(Field, { label: '章末钩子' }, h(Input, {
        value: active.chapters[cardOpen].hook,
        onChange: (v) => editRow(volumes.findIndex((x) => x.index === active.index), cardOpen, { hook: v }),
      })),
      )
      : null,
  )
}

// ═════════ 27-pipeline.js ═════════
/**
 * 长夜 · 流水线（派单台）
 *
 * 这一页解决的问题：AI 干活的时候，工作台上什么都看不见。
 * 你点了「派给架构师」，界面上没有任何痕迹，也不知道单子发没发出去、对方做完没有。
 *
 * 所以这里是一块「工地看板」：
 *   左边 = 11 个岗位（谁能干什么，一眼看全）
 *   右边 = 派单票（issued → 已投递 → 已交回执 / 过期 / 作废）
 *
 * 设计上的两个硬决定：
 * 1. 票落盘在作品目录（dispatches.json），不是内存。关掉宿主再打开，单子还在。
 * 2. 「预览任务书」和「投递到对话」是两个动作。投递会往你正在用的对话里塞一条指令，
 *    这不是能撤销的操作，所以必须先能看全文再按确认。
 */

const DISPATCH_STATUS_META = {
  issued: { label: '已开票', tone: 'blue' },
  claimed: { label: '已领取', tone: 'amber' },
  submitted: { label: '已交回执', tone: 'green' },
  expired: { label: '已过期', tone: 'red' },
  revoked: { label: '已作废', tone: 'grey' },
}

/** 剩余时间：票的 TTL 是 60 分钟，过期就看不出「还剩多久」。 */
function dispatchLeft(row) {
  const at = Date.parse(String(row?.expiresAt ?? ''))
  if (!Number.isFinite(at)) return ''
  const ms = at - Date.now()
  if (ms <= 0) return '已过期'
  const min = Math.round(ms / 60000)
  if (min >= 60) return `还剩 ${Math.round(min / 60)} 小时`
  return `还剩 ${min} 分钟`
}

function RoleCard({ role, onPick }) {
  return h(
    'button',
    {
      type: 'button',
      className: `nw-role${role.canDispatch ? ' nw-role-boss' : ''}`,
      onClick: () => onPick?.(role),
      title: role.duty,
    },
    h('span', { className: 'nw-role-name' }, role.label),
    h('span', { className: 'nw-role-id' }, role.id.replace(/^nightwrite-/, '')),
    h('span', { className: 'nw-role-duty' }, role.duty),
    h(
      'span',
      { className: 'nw-role-foot' },
      role.canDispatch ? h(Tag, { tone: 'amber' }, '有权派单') : null,
      h(Tag, { tone: 'grey' }, `${role.skills?.length ?? 0} 个 skill`),
    ),
  )
}

/**
 * 任务包查看器：派单时给子 agent 的那一叠材料，作者也该看得见。
 *
 * 为什么不做成「派单页里的一个折叠」：包是按 sha1 核对过的物证。当回执里说
 * 「我读了 manifest 里的第 3 份」，作者得能打开同一个包确认第 3 份是什么——
 * 否则那句话无法验证，整套「按材料交活」就退化成一句口头承诺。
 */
function TaskPackBoard({ projectId, toast, refreshKey }) {
  const [state, setState] = useState({ loading: true, items: [] })
  const [open, setOpen] = useState('')
  const [detail, setDetail] = useState(null)
  const seq = useRef(0)

  const load = useCallback(() => {
    if (!projectId) return
    const mine = ++seq.current
    setState((prev) => ({ ...prev, loading: true }))
    api('taskpack.list', { projectId, limit: 30 })
      .then((res) => { if (mine === seq.current) setState({ loading: false, items: res?.items ?? [] }) })
      .catch((error) => {
        if (mine !== seq.current) return
        setState({ loading: false, items: [], error: error.message })
      })
  }, [projectId])

  useEffect(() => { load() }, [load, refreshKey])

  const openPack = (name) => {
    if (open === name) { setOpen(''); setDetail(null); return }
    setOpen(name)
    setDetail(null)
    api('taskpack.get', { projectId, pack: name })
      .then((res) => setDetail(res))
      .catch((error) => toast?.(error.message))
  }

  if (!projectId) return null
  const items = state.items ?? []

  return h(
    Card,
    {
      title: '任务包',
      extra: h('span', { className: 'nw-card-badge' }, items.length ? `${items.length} 个` : '还没有'),
      className: 'nw-taskpack',
    },
    h(Hint, null, '派单时自动造的那一叠材料。包里有什么、为什么给、哪些故意没给，都在这。'),
    state.loading && !items.length
      ? h(Loading, { text: '读任务包…' })
      : items.length
        ? h(
          'div',
          { className: 'nw-tp-list' },
          ...items.map((row) => h(
            'div',
            { key: row.pack, className: 'nw-tp-row' },
            h(
              'button',
              {
                type: 'button',
                className: 'nw-tp-head',
                'aria-expanded': open === row.pack ? 'true' : 'false',
                onClick: () => openPack(row.pack),
              },
              h('span', { className: 'nw-tp-role' }, row.roleLabel ?? row.role),
              row.chapter ? h(Tag, { tone: 'grey' }, `第 ${row.chapter} 回`) : null,
              h('span', { className: 'nw-tp-n' }, `${row.files} 份`),
              row.omitted ? h(Tag, { tone: 'amber' }, `少给 ${row.omitted} 项`) : null,
              h('span', { className: 'nw-tp-at' }, String(row.createdAt ?? '').replace('T', ' ').slice(0, 16)),
            ),
            open !== row.pack
              ? null
              : h(
                'div',
                { className: 'nw-tp-body' },
                !detail
                  ? h(Loading, { text: '读清单…' })
                  : h(
                    'div',
                    { className: 'nw-tp-files' },
                    // 先说清楚东西在哪：材料是文件，不是塞进 prompt 的字。
                    h('p', { className: 'nw-hint' }, `材料放在 ${detail.dir}`),
                    ...(detail.manifest?.files ?? []).map((file) => h(
                      'div',
                      { key: file.key ?? file.path, className: 'nw-tp-file' },
                      h('span', { className: 'nw-tp-file-name' }, String(file.path ?? '').split(/[\\/]/).pop() ?? ''),
                      h('span', { className: 'nw-tp-file-why' }, String(file.why ?? '')),
                      h('span', { className: 'nw-tp-file-b' }, `${file.bytes ?? 0} B`),
                    )),
                    (detail.manifest?.omitted ?? []).length
                      ? h(
                        'div',
                        { className: 'nw-tp-omit' },
                        h('span', { className: 'nw-tp-omit-t' }, '故意没给'),
                        ...(detail.manifest?.omitted ?? []).map((row) => h(
                          'span',
                          { key: row.key, className: 'nw-tp-omit-row' },
                          `${row.key}：${String(row.why ?? '')}`,
                        )),
                      )
                      : null,
                    detail.promptSection
                      ? h(
                        'details',
                        { className: 'nw-tp-prompt' },
                        h('summary', null, '派单里写的「材料在哪」那一段'),
                        h('pre', { className: 'nw-tp-prompt-body' }, detail.promptSection),
                      )
                      : null,
                  ),
              ),
          )),
        )
        : h(Empty, null, '还没开过派单。开一张单时会自动造包。'),
  )
}

function DispatchRow({
  row, onPreview, onSend, onSpawn, onRevoke, onReport, busy, spawn,
}) {
  const meta = DISPATCH_STATUS_META[row.status] ?? { label: row.status, tone: 'grey' }
  return h(
    'div',
    { className: `nw-dp nw-dp-${row.status}` },
    h(
      'div',
      { className: 'nw-dp-head' },
      h('span', { className: 'nw-dp-role' }, row.roleLabel ?? row.role),
      h(Tag, { tone: meta.tone }, meta.label),
      row.chapter ? h(Tag, { tone: 'grey' }, `第 ${row.chapter} 回`) : null,
      h('span', { className: 'nw-dp-id' }, row.id),
    ),
    h('div', { className: 'nw-dp-task' }, row.task),
    h(
      'div',
      { className: 'nw-dp-meta' },
      h('span', null, `开票 ${String(row.createdAt ?? '').replace('T', ' ').slice(0, 16)}`),
      row.status === 'issued' || row.status === 'claimed'
        ? h('span', { className: 'nw-dp-left' }, dispatchLeft(row))
        : null,
      row.sessionId ? h('span', null, `已投递到 ${String(row.sessionId).slice(0, 8)}…`) : null,
      // 派子代理成功时才有 childId：它是宿主那边真实跑起来的那个代理。
      row.childId ? h('span', { className: 'nw-dp-child' }, `子代理 ${String(row.childId).slice(0, 8)}…`) : null,
      row.lastError ? h('span', { className: 'nw-dp-err' }, `投递失败：${row.lastError}`) : null,
    ),
    // 回执直接摊在票下面，不另开一页 —— 回执天然属于这张单。
    row.report
      ? h(
        'div',
        { className: 'nw-dp-report' },
        h('div', { className: 'nw-dp-report-head' }, '回执'),
        row.report.verdict
          ? h('div', { className: 'nw-dp-verdict' }, row.report.verdict)
          : null,
        (row.report.sections ?? []).map((sec, index) => h(
          'div',
          { className: 'nw-dp-sec', key: index },
          h('span', { className: 'nw-dp-sec-t' }, sec.title),
          h('span', { className: 'nw-dp-sec-b' }, sec.body),
        )),
      )
      : null,
    h(
      'div',
      { className: 'nw-dp-acts' },
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onPreview?.(row),
        disabled: busy || row.status === 'revoked' || row.status === 'expired',
      }, '看任务书'),
      // 派子代理和老路「发到对话」并列：前者是独立上下文 + 人格 + 工具白名单，
      // 后者是把任务书塞进你当前的对话。想让它别污染你的上下文就派子代理。
      h(Btn, {
        small: true,
        kind: 'primary',
        onClick: () => onSpawn?.(row),
        disabled: busy || row.status !== 'issued' || !spawn?.ok,
        title: spawn?.ok ? '开一个独立上下文的子代理，按岗位手册干活' : (spawn?.reason ?? '宿主不支持派子代理'),
      }, '派子代理'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onSend?.(row),
        disabled: busy || row.status !== 'issued',
      }, '发到对话'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onReport?.(row),
        disabled: busy || row.status !== 'issued' && row.status !== 'claimed',
      }, '贴回执'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => onRevoke?.(row),
        disabled: busy || row.status === 'submitted' || row.status === 'revoked',
      }, '作废'),
    ),
  )
}

function PipelinePage({ projectId, project, toast, onRefresh }) {
  const state = useAsync(
    () => Promise.all([
      api('role.list', {}),
      api('dispatch.list', { projectId, limit: 50 }),
      api('report.list', { projectId, limit: 20 }),
      // 顺带问一句宿主能不能派子代理：按钮的亮灭据此决定。
      api('subagent.status', {}).catch((error) => ({ ok: false, reason: error.message })),
    ]).then(([roles, tickets, reports, spawn]) => ({
      roles, tickets, reports, spawn,
    })),
    [projectId],
    { skip: !projectId },
  )

  const [pickedRole, setPickedRole] = useState('')
  const [task, setTask] = useState('')
  const [chapter, setChapter] = useState('')
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const [reportFor, setReportFor] = useState(null)
  const [reportText, setReportText] = useState('')

  const reload = state.reload
  const roles = state.data?.roles?.items ?? []
  const spawn = state.data?.spawn ?? { ok: false, reason: '还没问过宿主' }
  const tickets = state.data?.tickets?.items ?? []
  const reports = state.data?.reports?.items ?? []

  const doIssue = async () => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (!pickedRole) {
      toast('先挑一个岗位')
      return
    }
    if (!task.trim()) {
      toast('写一句要它干什么')
      return
    }
    setBusy(true)
    try {
      const made = await api('dispatch.issue', {
        projectId,
        role: pickedRole,
        task: task.trim(),
        chapter: chapter ? Number(chapter) : 0,
      })
      setTask('')
      setChapter('')
      toast(`已开票 ${made.id}，去右边点「发到对话」`)
      reload()
      onRefresh?.()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doPreview = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id, dryRun: true })
      setPreview({ id: row.id, prompt: out.prompt })
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 派子代理：走同一条 dispatch.send，多一个 spawn:true。
  // 宿主不支持时服务端会退回「发到对话」并把原因带回来，所以这里不必自己判两次。
  const doSpawn = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id, spawn: true })
      if (out?.spawned) {
        toast(out.personaApplied ? `已派 ${out.role}，人格与工具白名单都生效了` : `已派 ${out.role}，但人格没插进去（回执里能看出它没按手册说话）`)
      } else {
        toast(`派不了子代理（${out?.spawnReason ?? '未知原因'}），已退回发到对话`)
      }
      reload()
    } catch (error) {
      toast(error.message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const doSend = async (row) => {
    setBusy(true)
    try {
      const out = await api('dispatch.send', { projectId, id: row.id })
      toast(out?.created ? '已新建一个对话并把单子发过去' : '已发到当前对话')
      reload()
    } catch (error) {
      // 报错本身有价值：说明票没发出去，票上会留 lastError。
      toast(error.message)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const doRevoke = async (row) => {
    setBusy(true)
    try {
      await api('dispatch.revoke', { projectId, id: row.id })
      toast('已作废')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doReport = async () => {
    if (!reportText.trim()) {
      toast('回执正文是空的')
      return
    }
    setBusy(true)
    try {
      await api('report.submit', { projectId, id: reportFor.id, text: reportText })
      setReportFor(null)
      setReportText('')
      toast('回执已收')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const doSweep = async () => {
    setBusy(true)
    try {
      const out = await api('dispatch.sweep', { projectId })
      toast(out.swept ? `清掉 ${out.swept} 张过期票` : '没有过期票')
      reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  if (!projectId) {
    return h(Card, { title: '流水线' }, h(Empty, { text: '先选一部作品，再看派单' }))
  }

  return h(
    'div',
    { className: 'nw-pipe' },

    // ── 左：岗位 ──────────────────────────────────────────
    h(
      Card,
      {
        title: '谁来干',
        extra: h(Tag, { tone: 'grey' }, `${roles.length} 个岗位`),
        className: 'nw-pipe-roles',
      },
      h(Hint, null, '点一个岗位，右边就填好它。只有总编有权再往下派单，其余十个只能干活或提需求。'),
      state.loading && !roles.length
        ? h(Loading, { text: '读岗位…' })
        : h('div', { className: 'nw-role-grid' }, roles.map((role) => h(RoleCard, {
          role,
          key: role.id,
          onPick: (picked) => {
            setPickedRole(picked.id)
            toast(`选的是「${picked.label}」`)
          },
        }))),
    ),

    // ── 右：开票 + 单据 ─────────────────────────────────
    h(
      'div',
      { className: 'nw-pipe-right' },
      h(
        Card,
        { title: '开一张单', extra: h(Tag, { tone: 'blue' }, '60 分钟内有效') },
        h(
          'div',
          { className: 'nw-pipe-form' },
          h(Field, { label: '派给谁' }, h(Select, {
            value: pickedRole,
            onChange: setPickedRole,
            options: [{ value: '', label: '选一个岗位' }].concat(
              roles.map((role) => ({ value: role.id, label: `${role.label}${role.canDispatch ? '（可再派单）' : ''}` })),
            ),
          })),
          h(Field, { label: '第几回（可不填）' },
            h(Input, {
              value: chapter,
              onChange: (event) => setChapter(String(event?.target?.value ?? '').replace(/[^\d]/g, '')),
              placeholder: '例如 12',
            })),
          h(Field, { label: '要它干什么' },
            h(TextArea, {
              value: task,
              rows: 3,
              onChange: (event) => setTask(String(event?.target?.value ?? '')),
              placeholder: '一句话说清交付物，例如「按九字段细纲补齐第三卷 12–20 回」',
            })),
          h(
            'div',
            { className: 'nw-pipe-form-acts' },
            h(Btn, { kind: 'primary', onClick: doIssue, disabled: busy }, '开票'),
            h(Btn, { kind: 'ghost', onClick: doSweep, disabled: busy }, '清理过期票'),
          ),
        ),
      ),
      h(
        Card,
        {
          title: '单据',
          extra: h(Tag, { tone: 'grey' }, `${tickets.length} 张`),
        },
        state.error ? h(ErrorBox, { error: state.error, onRetry: reload }) : null,
        state.loading && !tickets.length ? h(Loading, { text: '读单据…' }) : null,
        !state.loading && !tickets.length
          ? h(Empty, { text: '还没有派过单。挑个岗位、写一句要它干什么，开一张试试。' })
          : h('div', { className: 'nw-dp-list' }, tickets.map((row) => h(DispatchRow, {
            row,
            key: row.id,
            busy,
            spawn,
            onPreview: doPreview,
            onSpawn: doSpawn,
            onSend: doSend,
            onRevoke: doRevoke,
            onReport: (target) => {
              setReportFor(target)
              setReportText('### 结论\n\n### 依据\n\n### 要别人做的事\n\n### 风险\n')
            },
          }))),
      ),
      reports.length
        ? h(
          Card,
          { title: '收到过的回执', extra: h(Tag, { tone: 'green' }, `${reports.length} 份`) },
          h('div', { className: 'nw-rep-list' }, reports.map((row) => h(
            'div',
            { className: 'nw-rep', key: row.id },
            h(
              'div',
              { className: 'nw-rep-head' },
              h('span', { className: 'nw-rep-role' }, row.roleLabel ?? row.role),
              h('span', { className: 'nw-rep-at' }, String(row.report?.at ?? '').replace('T', ' ').slice(0, 16)),
            ),
            h('div', { className: 'nw-rep-verdict' }, row.report?.verdict || '（没写结论）'),
          ))),
        )
        : null,
    ),

    // ── 任务包：派单材料是物证，作者得能打开看 ──────────
    h(TaskPackBoard, { projectId, toast, refreshKey: tickets.length }),

    // ── 任务书预览 ─────────────────────────────────────
    preview
      ? h(
        Modal,
        {
          title: `任务书 · ${preview.id}`,
          onClose: () => setPreview(null),
          footer: h(
            'div',
            { className: 'nw-pipe-modal-foot' },
            h(Btn, {
              kind: 'ghost',
              onClick: () => {
                const text = preview.prompt
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard.writeText(text).then(
                    () => toast('已复制任务书'),
                    () => toast('复制失败，手动选中吧'),
                  )
                } else {
                  toast('这个环境拿不到剪贴板')
                }
              },
            }, '复制全文'),
            h(Btn, { kind: 'ghost', onClick: () => setPreview(null) }, '关上'),
          ),
        },
        h(Hint, null, '下面是实际会发出去的字。确认没问题再回单据上点「发到对话」。'),
        h('pre', { className: 'nw-pipe-prompt' }, preview.prompt),
      )
      : null,

    // ── 贴回执 ────────────────────────────────────────
    reportFor
      ? h(
        Modal,
        {
          title: `贴回执 · ${reportFor.id}`,
          onClose: () => setReportFor(null),
          footer: h(
            'div',
            { className: 'nw-pipe-modal-foot' },
            h(Btn, { kind: 'ghost', onClick: () => setReportFor(null) }, '算了'),
            h(Btn, { kind: 'primary', onClick: doReport, disabled: busy }, '收下'),
          ),
        },
        h(Hint, null, '四个 ### 小标题会被切成四段；少写几段也能收，不会因为格式不合规丢内容。'),
        h(TextArea, {
          value: reportText,
          rows: 12,
          onChange: (event) => setReportText(String(event?.target?.value ?? '')),
        }),
      )
      : null,
  )
}

// ═════════ 30-studio.js ═════════
/**
 * 长夜 · 生产台
 *
 * 三栏：左边指令模板库，中间指令单（五块），右边队列。
 * AI 是主写手，人在这里下指令。
 */

function TemplatePanel({ projectId, templates, onPick, reload, toast }) {
  const [draft, setDraft] = useState(null)

  const save = async (item) => {
    if (!item.name.trim()) {
      toast('模板名不能为空')
      return
    }
    try {
      await api('template.save', { projectId, template: item })
      setDraft(null)
      reload()
      toast('模板已保存')
    } catch (error) {
      toast(error.message)
    }
  }

  const remove = async (id) => {
    try {
      await api('template.remove', { projectId, id })
      reload()
      toast('模板已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    'div',
    { className: 'nw-tpl-panel' },
    h(
      'div',
      { className: 'nw-tpl-head' },
      h('span', null, '指令模板'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => setDraft({ id: '', name: '', intent: '' }),
      }, '＋ 新建'),
    ),
    h(
      'div',
      { className: 'nw-tpl-list' },
      templates.map((item) => h(
        'button',
        {
          type: 'button',
          className: 'nw-tpl',
          key: item.id,
          onClick: () => onPick(item),
          title: item.intent,
        },
        h('span', { className: 'nw-tpl-name' }, item.name),
        h('span', { className: 'nw-tpl-intent' }, item.intent || '无意图说明'),
        item.used ? h('span', { className: 'nw-tpl-used' }, `用过 ${item.used} 次`) : null,
      )),
      templates.length ? null : h(Empty, null, '还没有模板。'),
    ),
    draft
      ? h(Modal, {
        title: draft.id ? '编辑模板' : '新建模板',
        onClose: () => setDraft(null),
        footer: h(
          Fragment,
          null,
          draft.id
            ? h(Btn, { kind: 'danger', small: true, onClick: () => { remove(draft.id); setDraft(null) } }, '删除')
            : null,
          h(Btn, { kind: 'ghost', small: true, onClick: () => setDraft(null) }, '取消'),
          h(Btn, { kind: 'primary', small: true, onClick: () => save(draft) }, '保存'),
        ),
      },
      h(Field, { label: '模板名' }, h(Input, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }) })),
      h(Field, { label: '创作意图' }, h(TextArea, {
        value: draft.intent,
        rows: 4,
        onChange: (v) => setDraft({ ...draft, intent: v }),
        placeholder: '例：主角吃瘪但埋下钩子，章末反转，不许死人',
      })))
      : null,
  )
}

function ContextAudit({
  rows, budget, onRemove, onMove, onToggle, off, onReset, toast,
}) {
  let total = 0
  for (const row of rows) total += Number(row.tokens) || 0
  const used = rows.filter((row) => !off?.[row.id]).reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)
  const over = used > budget
  const ratio = used / (budget || 1)
  const tone = ratio > 1 ? 'red' : ratio > 0.8 ? 'amber' : 'green'
  const dragFrom = useRef(null)

  return h(
    'div',
    { className: `nw-ctx${over ? ' nw-ctx-over' : ''}` },
    h(
      'div',
      { className: 'nw-ctx-head' },
      h('span', null, '上下文包'),
      h('span', { className: `nw-ctx-total${over ? ' nw-over' : ''}` }, `${used} / ${budget} token`),
    ),
    // 【24 条 #11】预算条画出来：绿 / 黄 / 红三档，配百分比，不再只是一个数字。
    h(Bar, { value: used, max: budget, tone }),
    h(
      'div',
      { className: 'nw-ctx-meter' },
      h('span', { className: 'nw-hint' }, `${Math.round(ratio * 100)}% 已用`),
      h('span', { className: `nw-hint${over ? ' nw-over' : ''}` }, over
        ? `超了 ${used - budget} token，先砍低相关度的账本条目`
        : `还能塞 ${budget - used} token`),
    ),
    h(
      'div',
      { className: 'nw-ctx-list' },
      rows.map((row, index) => h(
        'div',
        {
          className: `nw-ctx-row${off?.[row.id] ? ' nw-ctx-off' : ''}`,
          key: row.id,
          // 【24 条 #10】拖拽换序：拖起一行，落到另一行上就换位置。
          draggable: true,
          onDragStart: () => { dragFrom.current = index },
          onDragOver: (event) => event.preventDefault(),
          onDrop: () => {
            if (dragFrom.current === null || dragFrom.current === index) return
            onMove?.(dragFrom.current, index)
            dragFrom.current = null
          },
        },
        h('span', { className: 'nw-ctx-grip', title: '拖我换顺序' }, '⠿'),
        h('span', { className: 'nw-ctx-kind' }, row.kind),
        h('span', { className: 'nw-ctx-label' }, row.label),
        h('span', { className: 'nw-ctx-token' }, String(row.tokens)),
        h('button', {
          type: 'button',
          className: `nw-ctx-sw${off?.[row.id] ? '' : ' on'}`,
          title: off?.[row.id] ? '这次不喂它' : '这次喂它',
          // 六行都有这个开关，读屏只念「这次喂它」等于六个同名按钮分不清。
          // 名字里带上这一行的类型和标签，才说得清点的是哪一条。
          'aria-label': `第 ${index + 1} 条 ${row.kind}「${row.label}」${off?.[row.id] ? '：已关，点开重新喂' : '：在喂，点掉停用'}`,
          'aria-pressed': off?.[row.id] ? 'false' : 'true',
          onClick: () => onToggle?.(row.id),
        }),
        h('button', {
          type: 'button',
          className: 'nw-ctx-x',
          onClick: () => onRemove?.(row.id),
          'aria-label': `移除第 ${index + 1} 条 ${row.kind}「${row.label}」`,
        }, '✕'),
      )),
      rows.length ? null : h('div', { className: 'nw-hint' }, '上下文包是空的：至少喂一条世界状态和上一章结尾。'),
    ),
    h(
      'div',
      { className: 'nw-ctx-foot' },
      h('span', { className: 'nw-hint' }, '共 ' + rows.filter((row) => !off?.[row.id]).length + '/' + rows.length + ' 条在喂'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        onClick: () => {
          onReset?.()
          toast?.('已按默认优先级重算上下文包')
        },
      }, '重算'),
    ),
    over ? h('p', { className: 'nw-warn' }, '超预算：先砍低相关度的账本条目，别砍世界状态。') : null,
  )
}

function StudioPage({ projectId, project, chapters, go, toast, onRefresh }) {
  const tpl = useAsync(() => api('templates.list', { projectId }), [projectId], { skip: !projectId })
  const q = useAsync(() => api('queue.list', { projectId }), [projectId], { skip: !projectId })
  const led = useAsync(() => api('ledger.get', { projectId }), [projectId], { skip: !projectId })

  // 三个 useAsync 以前一条 error 分支都没有：后端挂了就静默显示空表单，
  // 作者以为「模板没了 / 队列空了」，实际是请求失败了。
  // 【别把这行挪回去】错误分支必须排在所有 hook 之后。
  // 排前面的话：首次渲染 12 个 hook，接口一报错只走 3 个就 return，
  // hook 数跳变 → React 直接抛错 → 整页白屏，作者以为「生产台打不开」。
  const broken = tpl.error || q.error || led.error
  // 提前算好要用的东西，早退之后再 return 渲染分支。

  const lastChapter = chapters.length ? chapters[chapters.length - 1].chapter : 0
  const [form, setForm] = useState({
    chapter: lastChapter + 1,
    templateId: '',
    templateName: '',
    intent: '',
    words: project?.targetWords ?? 2500,
    gate: project?.qualityGate ?? 70,
    mode: 'one',
  })
  const [ctx, setCtx] = useState([])
  const [ctxOff, setCtxOff] = useState({})
  const [busy, setBusy] = useState(false)
  // 【第 4 条】剪贴板被拒时的退路：把派单话术直接摊在队列下方。
  const [dispatchText, setDispatchText] = useState('')

  useEffect(() => {
    setForm((prev) => (prev.chapter ? prev : { ...prev, chapter: lastChapter + 1 }))
  }, [lastChapter])

  // 大纲页「送去生产台」写的就是这两个键：章号 + 意图（摘要 + 章末钩子）。
  // 读一次就清掉，否则切页回来会把用户已经改过的指令单再盖一遍。
  useEffect(() => {
    const wanted = readLS(LS.orderChapter, '')
    if (!wanted) return
    const intent = readLS(LS.orderIntent, '')
    setForm((prev) => ({ ...prev, chapter: Number(wanted) || prev.chapter, intent: intent || prev.intent }))
    writeLS(LS.orderChapter, '')
    writeLS(LS.orderIntent, '')
    toast(`已带入第 ${wanted} 回的意图`)
  }, [toast])

  const templates = tpl.data?.items ?? []
  const queue = q.data?.items ?? []
  const ledger = led.data?.ledger ?? {}

  const buildContext = useCallback(() => {
    const rows = []
    const ws = project?.worldState
    rows.push({
      id: 'ws',
      kind: '世界状态',
      label: ws?.text ? `截至第 ${ws.fromChapter ?? 0} 回：${String(ws.text).slice(0, 26)}…` : '（还没有世界状态，建议先跑一次全书体检）',
      tokens: ws?.text ? Math.min(2400, Math.ceil(String(ws.text).length * 0.7)) : 0,
    })
    if (lastChapter) {
      const prev = chapters[chapters.length - 1]
      rows.push({
        id: 'prev',
        kind: '上一章',
        label: `第 ${prev.chapter} 回 · ${prev.title || ''}（${prev.words} 字）`,
        tokens: Math.min(6000, Math.ceil(prev.words * 1.4)),
      })
    }
    for (const row of (ledger.characters ?? []).slice(0, 4)) {
      rows.push({
        id: `ch-${row.id}`,
        kind: '人物',
        label: `${row.name ?? row.id} · ${row.state ?? '状态未记'}`,
        tokens: 320,
      })
    }
    for (const row of (ledger.foreshadow ?? []).filter((item) => String(item.status ?? '') !== 'done').slice(0, 3)) {
      rows.push({
        id: `fs-${row.id}`,
        kind: '伏笔',
        label: `${row.name ?? row.id} · 计划第 ${row.plannedChapter ?? '?'} 回收`,
        tokens: 260,
      })
    }
    for (const row of (ledger.terms ?? []).slice(0, 4)) {
      rows.push({ id: `tm-${row.id}`, kind: '术语', label: `${row.name ?? row.id}`, tokens: 120 })
    }
    return rows
  }, [project, chapters, ledger, lastChapter])

  useEffect(() => {
    setCtx(buildContext())
  }, [buildContext])

  if (broken) {
    return h(
      'div',
      { className: 'nw-studio' },
      h(ErrorBox, {
        error: broken,
        onRetry: () => { tpl.reload(); q.reload(); led.reload() },
      }),
    )
  }

  const budget = 32000
  const total = ctx.reduce((sum, row) => sum + (Number(row.tokens) || 0), 0)

  const useTemplate = (item) => {
    setForm((prev) => ({ ...prev, templateId: item.id, templateName: item.name, intent: item.intent || prev.intent }))
    toast(`已套用模板「${item.name}」`)
  }

  const enqueue = async () => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (!String(form.intent).trim()) {
      toast('先写一句创作意图：这章靠什么把读者拽住')
      return
    }
    setBusy(true)
    try {
      await api('queue.add', {
        projectId,
        item: {
          chapter: Number(form.chapter),
          templateId: form.templateId,
          templateName: form.templateName,
          intent: form.intent,
          words: Number(form.words),
          cost: 0,
        },
      })
      q.reload()
      toast(`第 ${form.chapter} 回已入队`)
      setForm((prev) => ({ ...prev, chapter: Number(prev.chapter) + 1, intent: '' }))
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const move = async (id, patch) => {
    try {
      await api('queue.update', { projectId, id, patch })
      q.reload()
    } catch (error) {
      toast(error.message)
    }
  }

  const drop = async (id) => {
    try {
      await api('queue.remove', { projectId, id })
      q.reload()
      toast('已从队列移除')
    } catch (error) {
      toast(error.message)
    }
  }

  // 【第 4 条】队列在这台机器上不会自己动 —— 它的执行者是对话里的 agent。
  // 「开跑」只是把状态改成 running，看着像有人接了活，其实没有。
  // 这里把这一行拼成一句可直接粘给 agent 的话：意图 + 该读哪些 op + 该守什么闸门。
  // 不自动调 agent（界面不该替用户发指令），但也不让按钮点了没下文。
  const dispatch = async (row) => {
    const intent = String(row.intent || row.templateName || '').trim() || '（这行没写意图，先补一句要写什么）'
    const prompt = [
      `用 nightwrite_op 写第 ${row.chapter} 回。`,
      `意图：${intent}`,
      '开工前读：chapter.list 看已有稿、ledger.get 拿设定与伏笔、outline.get 看这一回的骨架、templates.list 选节奏模板。',
      '交稿时：chapter.save 写正文（status 交 review），proposal.save 提你建议的改动（不要自己改已验收的稿），problem.save 记你发现但没改的毛病。',
      `质检门槛 ${Number(project?.qualityGate ?? 70)} 分；低于门槛就别交，先自己修。`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(prompt)
      await move(row.id, { status: 'running' })
      toast('已把这一回的指令复制到剪贴板，粘给 agent 就行')
    } catch {
      // 剪贴板可能被拒（非安全上下文），至少把状态推进，并把话术摆在界面上。
      await move(row.id, { status: 'running' })
      setDispatchText(prompt)
      toast('剪贴板不可用，指令已展开在队列下方')
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品，去「设置 → 作品数据」新建一部。')

  return h(
    'div',
    { className: 'nw-page nw-studio' },
    h(
      'div',
      { className: 'nw-studio-cols' },
      tpl.loading && !tpl.data ? h(Loading, null) : h(TemplatePanel, {
        projectId,
        templates,
        onPick: useTemplate,
        reload: tpl.reload,
        toast,
      }),
      h(
        'div',
        { className: 'nw-order' },
        h(
          Card,
          { title: '指令单', extra: h('span', { className: 'nw-card-badge' }, 'AI 领单 · 你验收') },
          h(
            'div',
            { className: 'nw-order-grid' },
            h(Field, { label: '第几回' }, h(Input, {
              type: 'number',
              value: form.chapter,
              onChange: (v) => setForm({ ...form, chapter: Number(v) || 0 }),
            })),
            h(Field, { label: '目标字数' }, h(Input, {
              type: 'number',
              value: form.words,
              onChange: (v) => setForm({ ...form, words: Number(v) || 0 }),
            })),
            h(Field, { label: '质检门槛' }, h(Input, {
              type: 'number',
              value: form.gate,
              onChange: (v) => setForm({ ...form, gate: Number(v) || 0 }),
            })),
            h(Field, { label: '模式' }, h(Select, {
              value: form.mode,
              onChange: (v) => setForm({ ...form, mode: v }),
              options: [
                { value: 'one', label: '单章' },
                { value: 'batch', label: '连更 3 章' },
                { value: 'bid', label: '多版本竞标' },
              ],
            })),
          ),
          h(Field, { label: '创作意图（这章靠什么把读者拽住）' }, h(TextArea, {
            value: form.intent,
            rows: 3,
            onChange: (v) => setForm({ ...form, intent: v }),
            placeholder: '例：主角吃瘪但埋下钩子，章末反转，不许死人；结尾留一句让人翻页的话',
          })),
          // 【24 条 #12】意图复用：最近三次用过的指令，点一下填回来。
          h(IntentChips, {
            toast,
            onPick: (text) => setForm((prev) => ({ ...prev, intent: text })),
          }),
          form.templateName ? h('p', { className: 'nw-hint' }, `已套模板：${form.templateName}`) : null,
          h(ContextAudit, {
            rows: ctx,
            budget,
            off: ctxOff,
            toast,
            onRemove: (id) => setCtx((prev) => prev.filter((row) => row.id !== id)),
            onMove: (from, to) => setCtx((prev) => {
              const next = prev.slice()
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              return next
            }),
            onToggle: (id) => setCtxOff((prev) => ({ ...prev, [id]: !prev[id] })),
            onReset: () => {
              setCtx(buildContext())
              setCtxOff({})
            },
          }),
          h(
            'div',
            { className: 'nw-order-foot' },
            h('span', { className: 'nw-hint' }, total > budget ? '超预算，建议先减条目' : `约 ${total} token 上下文`),
            h(
              'div',
              { className: 'nw-actions' },
              h(Btn, { kind: 'ghost', onClick: () => setCtx(buildContext()) }, '重算上下文'),
              h(Btn, { kind: 'primary', onClick: enqueue, disabled: busy }, busy ? '入队中…' : '加入队列'),
            ),
          ),
        ),
      ),
      h(
        'div',
        { className: 'nw-queue' },
        h(
          'div',
          { className: 'nw-queue-head' },
          h('span', null, '队列'),
          h('span', { className: 'nw-card-badge' }, `${queue.filter((row) => row.status === 'queued').length} 待跑`),
        ),
        h(
          'div',
          { className: 'nw-queue-list' },
          queue.length
            ? queue.map((row) => h(
              'div',
              { className: `nw-q-row nw-q-${row.status}`, key: row.id },
              h('span', { className: 'nw-q-n' }, `第 ${row.chapter} 回`),
              h('span', { className: 'nw-q-intent' }, row.intent || row.templateName || '（无意图）'),
              h(Tag, { tone: row.status === 'running' ? 'teal' : row.status === 'done' ? 'green' : 'grey' }, row.status),
              h(
                'span',
                { className: 'nw-q-acts' },
                row.status === 'queued'
                  ? h(Btn, { small: true, kind: 'ghost', onClick: () => move(row.id, { status: 'running' }) }, '开跑')
                  : null,
                row.status === 'running'
                  ? h(Btn, { small: true, kind: 'ghost', onClick: () => move(row.id, { status: 'done' }) }, '完成')
                  : null,
                row.status === 'running' || row.status === 'queued'
                  ? h(Btn, { small: true, kind: 'primary', onClick: () => dispatch(row) }, '派给 agent')
                  : null,
                h(Btn, { small: true, kind: 'danger', onClick: () => drop(row.id) }, '移除'),
              ),
            ))
            : h(Empty, null, '队列是空的。写一张指令单，加进来。'),
        ),
        h('p', { className: 'nw-hint' }, '队列只记「要写什么」。真正动笔由 agent 读这一行，通过 nightwrite_op 取正文与账本。'),
        dispatchText
          ? h(
            'div',
            { className: 'nw-dispatch' },
            h('div', { className: 'nw-dispatch-head' },
              h('span', null, '这一回的派单话术'),
              h(Btn, { small: true, kind: 'ghost', onClick: () => setDispatchText('') }, '收起')),
            h('pre', { className: 'nw-dispatch-body' }, dispatchText),
          )
          : null,
      ),
    ),
  )
}

// ═════════ 35-lint.js ═════════
/**
 * 长夜 · 文风校验面板
 *
 * 为什么要有这一块：正文里「不是……而是……」「破折号一逗一串」「章末总结体」
 * 这些东西写的时候自己看不见，交稿之后才发现整章都是。人眼校一遍要半小时，
 * 机器校一遍是 20 毫秒 —— 那就让机器先看。
 *
 * 两档的处理方式不一样，这是故意的：
 *   硬拦（blocking）—— 写出来就是错，保存时服务端直接拒（chapter.save 抛 style-blocking）。
 *   提示（advisory）—— 只是可能不好，标黄，你自己看着办。
 * 一刀切全拦会变成「AI 替你写」，一刀切全放又等于没有校验。
 */

const LINT_SEVERITY_LABEL = { blocking: '硬伤', advisory: '提示' }
const LINT_SEVERITY_TONE = { blocking: 'red', advisory: 'amber' }

/**
 * 一条命中。
 *
 * 「为什么」单独给一个可展开的行，而不是塞进 title 属性——title 要悬停才出现，
 * 手机上根本没有悬停。作者看不到判据，就只会照着 hint 改字面，
 * 下一次写同样的句子还是不知道为什么错。
 */
function LintHit({ hit, onJump, open, onToggleWhy }) {
  // 「跳到正文」与「为什么」必须是两个并列的 button，不能把一个塞进另一个——
  // 按钮里套按钮，回车会触发两个动作，读屏也会把它念成一条。
  return h(
    'div',
    { className: 'nw-lint-item' },
    h(
      'div',
      { className: 'nw-lint-line' },
      h(
        'button',
        {
          type: 'button',
          className: `nw-lint-hit nw-lint-${hit.severity}`,
          onClick: () => onJump?.(hit),
          title: `第 ${hit.para + 1} 段 · ${hit.hint}`,
        },
        h('span', { className: 'nw-lint-n' }, String(hit.para + 1)),
        h(Tag, { tone: LINT_SEVERITY_TONE[hit.severity] ?? 'grey' }, hit.label),
        h('span', { className: 'nw-lint-quote' }, hit.quote),
        h('span', { className: 'nw-lint-hint' }, hit.hint),
      ),
      h(
        'button',
        {
          type: 'button',
          className: `nw-lint-why-btn${open ? ' on' : ''}`,
          'aria-expanded': open ? 'true' : 'false',
          title: '为什么这算毛病',
          onClick: () => onToggleWhy?.(hit),
        },
        open ? '为什么 ▲' : '为什么',
      ),
    ),
    open && hit.why
      ? h(
        'div',
        { className: 'nw-lint-why' },
        h('span', { className: 'nw-lint-why-tag' }, '为什么这算毛病'),
        h('span', { className: 'nw-lint-why-text' }, hit.why),
      )
      : null,
  )
}

/**
 * 章级体检：把四处「只报告不改」的检查攒在一张卡上。
 *
 * 为什么不并进文风校验：那四条判的不是「文笔好不好」，而是四种不同的事——
 *   退化    这段还是不是文（不是文就重跑，别改句子）
 *   照搬    正文是不是把细纲的句子搬了一遍
 *   标点    省略号/破折号/引号用的是哪一套（风格选择，不替人定）
 *   字数    读者看到的字数和作者报的是不是一个数
 * 混进 28 条文风规则里，作者会以为它们都是「改句子」的事。
 */
function ChapterHealth({ projectId, chapter, text, toast, onJumpPara }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState('')

  const run = useCallback(() => {
    if (!projectId || !chapter) return
    setBusy(true)
    // 四条并发，任一条挂了不该拖住其余三条——各写各的 catch。
    Promise.all([
      api('lint.degenerate', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('outline.copy', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('text.normalize', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('wordcount.check', { text }).catch((e) => ({ error: e.message })),
      // 六件事而不是四件：分数是「一句话判决」，保真是「有没有被改坏」。
      // 这两件要拿正文和现存旧稿比，前面四件只看正文，所以放后面两路。
      api('aiscore.check', { projectId, chapter, text }).catch((e) => ({ error: e.message })),
      api('fidelity.check', { projectId, chapter, after: text }).catch((e) => ({ error: e.message })),
    ]).then(([degenerate, copy, punct, words, score, fidelity]) => {
      setData({ degenerate, copy, punct, words, score, fidelity })
    }).then(() => setBusy(false))
  }, [projectId, chapter, text])

  // 换章就清空：留着上一章的数字比不显示更糟——人会以为那是现在这章的。
  useEffect(() => { setData(null); setOpen('') }, [chapter])

  if (!projectId || !chapter) return null

  const dg = data?.degenerate
  const cp = data?.copy
  const pt = data?.punct
  const wc = data?.words
  const sc = data?.score
  const fd = data?.fidelity

  const rows = !data
    ? []
    : [
      {
        id: 'degenerate',
        label: '是不是模型跑偏了',
        verdict: dg?.error ? `查不了：${dg.error}` : (Number(dg?.total ?? 0) ? `${dg.total} 处退化` : '没看出跑偏'),
        tone: dg?.error ? 'grey' : (Number(dg?.total ?? 0) ? 'red' : 'green'),
        detail: dg?.verdict ?? '',
        hits: (dg?.hits ?? []).map((h) => ({
          para: h.para,
          text: `第 ${Number(h.para) + 1} 段「${h.label}」${h.quote ? `：${h.quote}` : ''}`,
        })),
      },
      {
        id: 'copy',
        label: '正文有没有搬细纲',
        verdict: cp?.error
          ? `查不了：${cp.error}`
          : (Number(cp?.total ?? 0) ? `${cp.total} 处重合，最长 ${Math.max(...cp.hits.map((h) => Number(h.chars) || 0))} 字` : '没有照搬'),
        tone: cp?.error ? 'grey' : (Number(cp?.total ?? 0) ? 'amber' : 'green'),
        detail: cp?.verdict?.text ?? '',
        hits: (cp?.hits ?? []).slice(0, 8).map((h) => ({
          para: h.para,
          text: `第 ${Number(h.para) + 1} 段搬了 ${h.chars} 字：${String(h.copied ?? h.quote ?? '')}`,
        })),
      },
      {
        id: 'punct',
        label: '标点用的是哪一套',
        verdict: pt?.error ? `查不了：${pt.error}` : (Number(pt?.total ?? 0) ? `${pt.total} 处不统一` : '没发现问题'),
        tone: pt?.error ? 'grey' : (Number(pt?.total ?? 0) ? 'amber' : 'green'),
        detail: '只报告不改：省略号用「……」还是「...」是风格选择，替作者决定就是改风格。',
        hits: (pt?.changes ?? []).slice(0, 8).map((h) => ({
          para: h.para,
          text: `第 ${Number(h.para) + 1} 段「${h.label}」：${String(h.from ?? '')} → ${String(h.to ?? '')}`,
        })),
      },
      {
        id: 'words',
        label: '这个字数是怎么算的',
        verdict: wc?.error ? `查不了：${wc.error}` : `${wc?.words ?? 0} 字`,
        tone: 'grey',
        detail: wc?.error
          ? ''
          : `口径 ${wc?.metric ?? ''}：去掉 frontmatter 与首行标题后数非空白字符。原文 ${wc?.rawLength ?? 0} 字符，其中 ${wc?.trimmed ?? 0} 个不算正文，${wc?.paragraphs ?? 0} 段。`,
        hits: [],
      },
      {
        id: 'score',
        label: '这一章有多像 AI 写的',
        verdict: sc?.error
          ? `算不了：${sc.error}`
          : (sc?.confident === false
            ? `${sc?.score ?? 0} 分 · ${sc?.label ?? ''}（样本太短，不敢下结论）`
            : `${sc?.score ?? 0} 分 · ${sc?.label ?? ''}`),
        // scoreTone 给的是 good/mid/bad（那是给分数条用的，配 nw-score-* 那套 CSS），
        // Tag 只认 green/amber/red/grey —— 混着用会渲出一个没有样式的标签。
        tone: sc?.error
          ? 'grey'
          : ((sc?.score ?? 0) <= 30 ? 'green' : ((sc?.score ?? 0) <= 55 ? 'amber' : 'red')),
        detail: sc?.error
          ? ''
          : `${sc?.text ?? ''}${sc?.worst ? `最重的一条是「${sc.worst.label}」${sc.worst.count} 处（每千字 ${sc.worst.density} 次），占 ${sc.worst.points} 分。` : ''}分数线在 30 分，过了服务端会拒存——这不是建议，是闸门。`,
        hits: (sc?.custom ?? []).length
          ? sc.custom.map((row) => ({ text: `你自己加的词「${row.phrase}」出现 ${row.count} 次` }))
          : (sc?.signals ?? [])
            .filter((row) => Number(row.points) >= 1)
            .sort((a, b) => Number(b.points) - Number(a.points))
            .slice(0, 8)
            .map((row) => ({
              text: `${row.label}：${row.count} 处 / ${Number(row.points).toFixed(1)} 分（每千字容忍 ${row.tolerance}）`,
            })),
      },
      {
        id: 'fidelity',
        label: '有没有把原来的东西改丢',
        verdict: fd?.error
          ? `查不了：${fd.error}`
          : (fd?.level === 'ok' ? '没丢东西' : (fd?.level === 'warn' ? '有点可疑' : '丢了不少')),
        tone: fd?.error ? 'grey' : (fd?.level === 'ok' ? 'green' : (fd?.level === 'warn' ? 'amber' : 'red')),
        detail: fd?.error
          ? ''
          : `${fd?.text ?? ''} 数字 ${fd?.numbers?.kept ?? 0}/${fd?.numbers?.total ?? 0} 保留，专名 ${fd?.names?.kept ?? 0}/${fd?.names?.total ?? 0}，引语 ${fd?.quotes?.kept ?? 0}/${fd?.quotes?.total ?? 0}。`,
        hits: (fd?.issues ?? []).map((row) => ({ text: row.text ?? String(row) })),
      },
    ]

  return h(
    Card,
    {
      title: '章级体检',
      extra: h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: run }, busy ? '查着…' : data ? '重查' : '查一遍'),
    },
    h('p', { className: 'nw-hint' }, '六件事各查各的，都只报告不改稿。'),
    !data
      ? h(Empty, null, '点「查一遍」，四条一起跑。')
      : h(
        'div',
        { className: 'nw-health' },
        ...rows.map((row) => h(
          'div',
          { key: row.id, className: `nw-health-row nw-health-${row.id}` },
          h(
            'button',
            {
              type: 'button',
              className: 'nw-health-head',
              'aria-expanded': open === row.id ? 'true' : 'false',
              onClick: () => setOpen((prev) => (prev === row.id ? '' : row.id)),
            },
            h('span', { className: 'nw-health-label' }, row.label),
            h(Tag, { tone: row.tone }, row.verdict),
            h('span', { className: 'nw-health-caret' }, open === row.id ? '▾' : '▸'),
          ),
          open !== row.id
            ? null
            : h(
              'div',
              { className: 'nw-health-body' },
              row.detail ? h('p', { className: 'nw-hint' }, row.detail) : null,
              row.hits.length
                ? h(
                  'div',
                  { className: 'nw-health-hits' },
                  ...row.hits.map((hit, index) => (hit.para !== undefined && onJumpPara
                    ? h(
                      'button',
                      {
                        type: 'button',
                        key: index,
                        className: 'nw-health-hit',
                        onClick: () => {
                          onJumpPara(Number(hit.para) || 0)
                          toast?.(hit.text)
                        },
                      },
                      hit.text,
                    )
                    : h('span', { key: index, className: 'nw-health-hit nw-health-hit-flat' }, hit.text))),
                )
                : h('p', { className: 'nw-hint' }, '这一项没有具体条目。'),
            ),
        )),
      ),
  )
}

/**
 * 校验面板。text 变了自己防抖重算 —— 校验是本地服务端算的，
 * 但每敲一个字打一次 RPC 也没必要，停手 700ms 再算。
 */
function LintPanel({
  projectId, chapter, text, title = '文风校验', onJump, toast, compact = false,
}) {
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [only, setOnly] = useState('all')
  // 哪一条的「为什么」展开着。存 key 不存下标——重算后命中顺序可能变。
  const [whyKey, setWhyKey] = useState('')
  const seq = useRef(0)

  const run = useCallback((body) => {
    if (!String(body ?? '').trim()) {
      setResult(null)
      return
    }
    const mine = ++seq.current
    setBusy(true)
    // 一定要带 projectId：不带就只按全局阈值判，
    // 本书量过的阈值等于白量，界面还会显示「干净」而服务端拒存。
    api('lint.check', projectId ? { projectId, text: body } : { text: body })
      .then((data) => {
        if (mine !== seq.current) return
        setResult(data)
      })
      .catch(() => {
        if (mine !== seq.current) return
        setResult(null)
      })
      .then(() => {
        if (mine !== seq.current) return
        setBusy(false)
      })
  }, [projectId])

  useEffect(() => {
    const timer = setTimeout(() => run(text), 700)
    return () => clearTimeout(timer)
  }, [text, run])

  const hits = useMemo(() => {
    const all = Array.isArray(result?.hits) ? result.hits : []
    if (only === 'blocking') return all.filter((row) => row.severity === 'blocking')
    if (only === 'advisory') return all.filter((row) => row.severity === 'advisory')
    // 退化单独一档：这三条不是文笔问题，是「这段根本不是文本」。
    // 混在硬伤里会让人去逐句改，正确处理是整章重跑。
    if (only === 'degenerate') return all.filter((row) => row.group === 'degenerate')
    return all
  }, [result, only])

  const blocking = Number(result?.blocking ?? 0)
  const advisory = Number(result?.advisory ?? 0)
  const degenerated = (Array.isArray(result?.hits) ? result.hits : []).filter((row) => row.group === 'degenerate').length

  return h(
    Card,
    {
      title,
      className: 'nw-lint' + (compact ? ' nw-lint-compact' : ''),
      extra: busy
        ? h('span', { className: 'nw-card-badge' }, '算…')
        : h(
          'span',
          { className: 'nw-card-badge' },
          blocking ? `${blocking} 硬伤` : '无硬伤',
        ),
    },

    // 一句话结论：不要让人从数字自己推断「能不能发」。
    h(
      'div',
      { className: 'nw-lint-sum' },
      degenerated
        ? h('span', { className: 'nw-lint-verdict nw-lint-verdict-bad' }, `有 ${degenerated} 处退化——这段不是文，整章重跑，不要逐句改`)
        : blocking
        ? h('span', { className: 'nw-lint-verdict nw-lint-verdict-bad' }, `有 ${blocking} 处硬伤，保存会被拦`)
        : h('span', { className: 'nw-lint-verdict nw-lint-verdict-ok' }, advisory ? `硬伤 0，另有 ${advisory} 处提示` : '干净'),
      h(
        'div',
        { className: 'nw-seg nw-lint-seg' },
        [
          { value: 'all', label: `全部 ${Number(result?.total ?? 0)}` },
          // 退化的计数单独标出来，还要标红：它和硬伤不是一类问题。
          { value: 'degenerate', label: `退化 ${degenerated}` },
          { value: 'blocking', label: `硬伤 ${blocking}` },
          { value: 'advisory', label: `提示 ${advisory}` },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn${only === item.value ? ' on' : ''}`,
            'aria-pressed': only === item.value ? 'true' : 'false',
            onClick: () => setOnly(item.value),
          },
          item.label,
        )),
      ),
    ),

    !String(text ?? '').trim()
      ? h(Empty, null, '正文是空的，没得校。')
      : hits.length
        ? h('div', { className: 'nw-lint-list' }, hits.map((hit, index) => {
          const key = `${hit.id}-${hit.para}-${hit.offset}-${index}`
          return h(LintHit, {
            hit,
            key,
            open: whyKey === key,
            onToggleWhy: (row) => {
              const mine = `${row.id}-${row.para}-${row.offset}-${index}`
              setWhyKey((prev) => (prev === mine ? '' : mine))
            },
            onJump: (row) => {
              onJump?.(row)
              toast?.(`第 ${row.para + 1} 段「${row.label}」：${row.hint}`)
            },
          })
        }))
        : h('p', { className: 'nw-hint' }, busy ? '算着呢…' : '这一档没有命中。'),

    // 词表与规则说明放折叠里：天天用的人不需要看，第一次用的人需要知道规则从哪来。
    h(
      'details',
      { className: 'nw-lint-about' },
      h('summary', null, '这些规则是哪来的'),
      h('p', { className: 'nw-hint' },
        '硬伤档：正文里出现章号/本章/前文这类元叙述、写作术语、系统提示体、「不是…而是…」对偶否定、破折号连用、电报体短句、章末总结体。'),
      h('p', { className: 'nw-hint' },
        '提示档：句号碎、长段、微动作口头禅、套路反应、动作清单、抽象总结、陈词密度、比喻密度、推理链、引号强调、排比、过度压缩、连接词过少。'),
      h('p', { className: 'nw-hint' },
        '你自己在设置里加的词表（去 AI 味那 12 条）走的是另一套，只在存盘时记命中数，不在这里拦。'),
      h('p', { className: 'nw-hint' },
        '每条命中右边有个「为什么」——展开是这条规则的判据，讲的是读者会因此丢掉什么。hint 教你改这句，why 告诉你下次别这么写。'),
    ),
  )
}

/**
 * 这本书自己的那套阈值（阶段 C）。
 *
 * 为什么要在界面上暴露「量一遍」：全局阈值是拿别人 214 章校准出来的。
 * 作者看不到这个数字从哪来，只能感觉到「它老误报」或者「它什么都不报」,
 * 然后整条规则关掉。让他自己量一次，误报才有解释，调整才有依据。
 *
 * 为什么强调「只调数值不改正则」：改数值是换秤，改规则是改尺子刻度。
 * 后者会让历史命中全部失去可比性，所以界面上只让改数，不让改判定逻辑。
 */
function LintCalibration({ projectId, toast, onDone }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    if (!projectId) return
    api('lint.calibration', { projectId })
      .then((res) => setData(res))
      .catch(() => setData(null))
  }, [projectId])

  useEffect(() => { load() }, [load])

  const run = () => {
    if (!projectId || busy) return
    setBusy(true)
    api('lint.calibrate', { projectId })
      .then((res) => {
        setLast(res)
        setData(res.calibration ?? data)
        toast?.(res.summary ?? '量完了')
        onDone?.()
      })
      .catch((err) => toast?.(err?.message ?? '量不出来'))
      .then(() => setBusy(false))
  }

  const clear = () => {
    if (!projectId || busy) return
    setBusy(true)
    api('lint.calibrate.save', { projectId, thresholds: null })
      .then((res) => {
        setData(res)
        setLast(null)
        toast?.('已回到全局阈值')
        onDone?.()
      })
      .catch((err) => toast?.(err?.message ?? '清不掉'))
      .then(() => setBusy(false))
  }

  const count = Number(data?.count ?? 0)
  const notes = Array.isArray(last?.notes) ? last.notes : (Array.isArray(data?.notes) ? data.notes : [])
  const overridden = (data?.items ?? []).filter((row) => row.overridden)

  return h(
    Card,
    {
      title: '这本书自己的阈值',
      className: 'nw-lint-cal',
      extra: h(
        'span',
        { className: 'nw-card-badge' },
        count ? `${count} 条已按本书调整` : '按全局阈值判',
      ),
    },
    h('p', { className: 'nw-hint nw-lint-cal-lead' },
      count
        ? `这本书已经量过 ${data?.samples ?? 0} 章 /${data?.chars ?? 0} 字，有 ${count} 条规则改用了本书量出来的数值。`
        : '现在用的是全局阈值——那是从别的书校准出来的。量一遍本书已写的正文，能把这把秤调成适合这本的。'),

    h(
      'div',
      { className: 'nw-lint-cal-acts' },
      h(Btn, { kind: 'primary', small: true, onClick: run, disabled: busy },
        busy ? '量着呢…' : (count ? '重新量一遍' : '按这本书量一遍')),
      count ? h(Btn, { kind: 'ghost', small: true, onClick: clear, disabled: busy }, '回到全局阈值') : null,
      overridden.length
        ? h('button', {
          type: 'button',
          className: 'nw-lint-cal-more',
          'aria-expanded': open ? 'true' : 'false',
          onClick: () => setOpen((v) => !v),
        }, open ? '收起明细 ▲' : `看是哪 ${overridden.length} 条改过 〉`)
        : null,
    ),

    open && overridden.length
      ? h('div', { className: 'nw-lint-cal-list' }, overridden.map((row) => h(
        'div',
        { className: 'nw-lint-cal-row', key: row.id },
        h('span', { className: 'nw-lint-cal-name' }, row.label),
        h('span', { className: 'nw-lint-cal-num' },
          `全局 ${row.threshold?.perKilo ?? '—'}` + `　→　本书 ${row.threshold?.perKilo ?? '—'}`),
      )))
      : null,

    notes.length
      ? h(
        'details',
        { className: 'nw-lint-about' },
        h('summary', null, `量出来的结论（${notes.length} 条）`),
        ...notes.slice(0, 30).map((note, index) => h(
          'p',
          { className: `nw-hint nw-lint-cal-note nw-lint-cal-${note.level}`, key: `n${index}` },
          note.text,
        )),
      )
      : null,
  )
}

/**
 * 硬拦弹窗：chater.save 被服务端拒了之后弹出来。
 *
 * 为什么不是一个 toast：正文明明一个字没存进去，只飘一句提示，
 * 用户下一眼就看不见了 —— 然后以为存好了，关掉窗口，白写。
 * 所以这里要「挡住 + 逐条列 + 给两条明确出路（去改 / 我就是要存）」。
 */
function LintBlockModal({ error, onFix, onForce, onClose }) {
  const blocking = Array.isArray(error?.details?.blocking) ? error.details.blocking : []
  // 被拦下来这一刻最该看判据：他不是想知道「哪错了」，是「凭什么」。
  const [whyKey, setWhyKey] = useState('')
  return h(
    Modal,
    {
      title: '存不进去 · 正文有硬伤',
      onClose,
      footer: h(
        'div',
        { className: 'nw-lint-modal-foot' },
        h(Btn, { kind: 'ghost', onClick: onClose }, '先放着'),
        h(Btn, { kind: 'danger', onClick: onForce }, '我知道，强行存'),
        h(Btn, { kind: 'primary', onClick: onFix }, '去改'),
      ),
    },
    h('p', { className: 'nw-lint-modal-lead' }, error?.message ?? '服务端拒了这次保存。'),
    blocking.length
      ? h('div', { className: 'nw-lint-list' }, blocking.map((hit, index) => h(LintHit, {
        hit,
        key: `${hit.id}-${index}`,
        open: whyKey === `modal-${hit.id}-${index}`,
        onToggleWhy: () => setWhyKey((prev) => (prev === `modal-${hit.id}-${index}` ? '' : `modal-${hit.id}-${index}`)),
        onJump: () => onFix?.(hit),
      })))
      : null,
    h('p', { className: 'nw-hint' },
      '「强行存」会原样落盘，界面上仍然标红 —— 留给导旧稿、修标点这种确实要绕过的场合。'),
  )
}

// ═════════ 40-review.js ═════════
/**
 * 长夜 · 验收台
 *
 * 列表看分数与违规数，点开看正文与四类问题，打回有三种去向。
 */

function ScoreBar({ score, gate }) {
  const tone = score >= 80 ? 'green' : score >= gate ? 'amber' : 'red'
  return h(
    'span',
    { className: 'nw-score' },
    h(Bar, { value: score, max: 100, tone }),
    h('em', { className: `nw-score-n nw-score-${scoreTone(score)}` }, score || '—'),
  )
}

function ReviewList({ chapters, gate, onOpen, selected }) {
  return h(
    'div',
    { className: 'nw-rv-list' },
    h(
      'div',
      { className: 'nw-rv-head' },
      h('span', null, '章'),
      h('span', null, '标题'),
      h('span', null, '状态'),
      h('span', null, '字数'),
      h('span', null, '评分'),
      h('span', null, '问题'),
    ),
    chapters.length
      ? chapters.map((row) => h(
        'button',
        {
          type: 'button',
          key: row.chapter,
          className: `nw-rv-row${selected === row.chapter ? ' on' : ''}`,
          onClick: () => onOpen(row.chapter),
        },
        h('span', { className: 'nw-rv-n' }, row.chapter),
        h('span', { className: 'nw-rv-title' }, row.title || ''),
        h('span', null, h(Tag, { tone: STATUS_TONE[row.status] || 'grey' }, STATUS_LABEL[row.status] || row.status)),
        h('span', { className: 'nw-rv-words' }, row.words),
        h('span', null, h(ScoreBar, { score: row.score, gate })),
        h(
          'span',
          { className: 'nw-rv-issues' },
          row.issues ? h(Tag, { tone: 'amber' }, `${row.issues}`) : h('span', { className: 'nw-hint' }, '—'),
          row.violations ? h(Tag, { tone: 'red' }, `违规 ${row.violations}`) : null,
        ),
      ))
      : h(Empty, null, '还没有章节。去生产台排一单。'),
  )
}

function IssueRow({
  issue, index, active, onPick,
}) {
  const tone = issue.type === 'ai-style' ? 'amber' : issue.type === 'logic' ? 'red' : 'grey'
  const label = issue.type === 'ai-style' ? 'AI 味' : issue.type === 'logic' ? '逻辑' : issue.type === 'pace' ? '节奏' : '其他'
  return h(
    'button',
    {
      type: 'button',
      // 【24 条 #14】点问题 → 正文那句亮起来。问题在右、正文在左，不联动就全靠眼睛找。
      className: `nw-issue${active ? ' nw-issue-on' : ''}`,
      onClick: () => onPick?.(issue),
      title: issue.quote ? '点一下，跳到正文里这句话' : '这条没有引用原文',
    },
    h('span', { className: 'nw-issue-n' }, String(index + 1).padStart(2, '0')),
    h(Tag, { tone }, label),
    h(
      'span',
      { className: 'nw-issue-body' },
      h('span', { className: 'nw-issue-text' }, issue.text || ''),
      issue.quote ? h('span', { className: 'nw-issue-quote' }, `「${issue.quote}」`) : null,
    ),
    issue.severity ? h('span', { className: 'nw-issue-sev' }, issue.severity) : null,
  )
}

function ReviewDetail({
  projectId, chapter, chapters, project, gate, onClose, onChanged, toast, onNav,
}) {
  const ch = useAsync(() => api('chapter.get', { projectId, chapter }), [projectId, chapter], { skip: !projectId || !chapter })
  // 彩带的真值：服务端扫词表，不是前端按段序号染色。
  const style = useAsync(() => api('chapter.aistyle', { projectId, chapter }), [projectId, chapter], { skip: !projectId || !chapter })
  // 历史版本 / 回收站也得能看见，否则「留底」等于没留。
  const hist = useAsync(() => api('chapter.history', { projectId, chapter }), [projectId, chapter], { skip: !projectId || !chapter })
  // 【QA-1】撤销/重做：受控 textarea 会把浏览器原生撤销栈冲掉，所以自己留快照。
  // 600ms 内的连续输入合并成一步，免得退一句要按一百下。
  const editor = useUndoText('')
  const text = editor.value
  const setText = editor.set
  const resetText = editor.reset
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  // 【12 条 #2】自动保存：默认开，可以在设置里关。
  const [autosave, setAutosave] = useState(() => readLS(LS.autosave, '1') !== '0')
  const [savedAt, setSavedAt] = useState('')
  // 【12 条 #11】阅读模式：只看正文，把问题单/评分/历史全收起来。
  const [readMode, setReadMode] = useState(() => readLS(LS.readMode, '0') === '1')
  // 【24 条 #13/#14】彩带选中 + 正文高亮：两件事共用同一个「段」坐标。
  const [para, setPara] = useState(-1)
  const [quotePick, setQuotePick] = useState(null)
  const [mode, setMode] = useState('doc')
  // 【第 1 批】服务端硬拦时把证据接住，弹窗逐条列出来。
  const [blocked, setBlocked] = useState(null)
  const paraRefs = useRef({})

  // 【12 条 #1】有未保存内容就登记，切页时 Root 会拿这个拦住并问一句。
  useEffect(() => {
    setDirtyGuard(dirty, `第 ${chapter} 回`, () => false)
    return () => setDirtyGuard(false)
  }, [dirty, chapter])

  // 【12 条 #1】关标签页 / 刷新时的兜底提示。浏览器只允许「有未保存」这一句，
  // 不能自定义文案，所以只在真脏的时候挂。
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  // Ctrl+K 搜到的段号（nw.openPara）要能在正文里落地：进来就切段视图、滚到那段、点亮。
  // 放在 dirty 之后，且不覆盖用户正在编的稿子（text 由 dirty 守着）。
  useEffect(() => {
    if (!chapter) return
    const raw = readLS('nw.openPara', '')
    if (raw === '') return
    writeLS('nw.openPara', '')
    const at = Number(raw)
    if (!Number.isFinite(at) || at < 0) return
    const bodyNow = String(ch.data?.text ?? '').trim() ? String(ch.data.text) : MOCK.reviewText.join('\n')
    const list = bodyNow.split(/\n+/).map((row) => row.trim()).filter(Boolean)
    if (at >= list.length) return
    setMode('doc')
    setPara(at)
    setTimeout(() => {
      const node = paraRefs.current[at]
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 60)
  }, [chapter, ch.data])

  useEffect(() => {
    if (ch.data && !dirty) {
      // 服务端有正文就用服务端的；服务端是空的但本地有草稿，就把草稿捞回来。
      // 场景：上次改了没存就关掉窗口，下次打开不能白丢。
      const remote = ch.data.text ?? ''
      const local = readDraft(projectId, chapter)
      if (!String(remote).trim() && local?.text) {
        // 换章必须清空撤销栈：跨章撤销会把上一章的字塞进这一章。
        resetText(local.text)
        setDirty(true)
        toast('发现上次没保存的草稿，已放回编辑框')
        return
      }
      resetText(remote)
    }
  }, [ch.data, dirty])

  const meta = ch.data?.meta ?? {}
  const issues = Array.isArray(meta.issues) ? meta.issues : []
  const violations = Array.isArray(meta.violations) ? meta.violations : []
  const scores = meta.scores || {
    reader: null, logic: null, aiStyle: null, rhythm: null,
  }

  // 正文为空时用演示段落：彩带、点亮、段视图都得有东西可看（界面先长出来）。
  const body = String(text || '').trim() ? text : MOCK.reviewText.join('\n')
  const paras = String(body).split(/\n+/).map((row) => row.trim()).filter(Boolean)

  const save = async (opts = {}) => {
    const silent = opts.silent === true
    const force = opts.force === true
    if (!silent) setBusy(true)
    try {
      const payload = { projectId, chapter, text, meta: { status: meta.status ?? 'draft' } }
      if (force) payload.force = true
      await api('chapter.save', payload)
      setDirty(false)
      setBlocked(null)
      dropDraft(projectId, chapter)
      setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
      if (!silent) {
        ch.reload()
        onChanged?.()
        toast(force ? '已强行保存（硬伤还留着）' : '正文已保存')
      }
    } catch (error) {
      // 硬拦不是「保存失败」，是「这段字不能这么写」——要挡住、要逐条说清。
      // 弹窗而不是 toast：toast 飘三秒就没了，用户会以为存进去了，关窗口白写。
      if (error.code === 'style-blocking') {
        setBlocked(error)
        if (silent) toast('自动保存被拦下了：正文有硬伤')
        return
      }
      // 自动保存失败不能静默 —— 那正好是最需要让作者知道的一次。
      toast(`${silent ? '自动保存' : '保存'}失败：${error.message}`)
    } finally {
      if (!silent) setBusy(false)
    }
  }

  // 【12 条 #2】自动保存：停手 4 秒后落一次盘。为什么不是边输边存 ——
  // 每敲一个字都发一次 RPC，服务端要为每次覆盖写一份历史版本，
  // 打一百个字就把最近 20 版历史全冲成刚才的中间态。
  useEffect(() => {
    if (!autosave || !dirty || busy) return undefined
    const timer = setTimeout(() => {
      if (dirtyGuard.active && dirtyGuard.flush) save({ silent: true })
    }, 4000)
    return () => clearTimeout(timer)
  }, [text, autosave, dirty, busy])

  // 草稿也随打随存：自动保存是 4 秒一次，这 4 秒里关掉窗口还有本地兜底。
  useEffect(() => {
    if (!dirty) return
    writeDraft(projectId, chapter, text)
  }, [text, dirty, projectId, chapter])

  const act = async (action) => {
    setBusy(true)
    try {
      await api('review.action', { projectId, action, chapter, worldState: meta.worldStateHint ?? '' })
      ch.reload()
      onChanged?.()
      toast(action === 'accept' ? '已采纳' : action === 'rerun' ? '已重新入队' : action === 'manual' ? '已转人工修' : '已废弃')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 【24 条 #15】键盘流：J/K 上下章、A 采纳、R 废弃。逐章过一遍是重复劳动，手不该离开键盘。
  useEffect(() => {
    const onKey = (event) => {
      const tag = String(event.target?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      // 命令面板 / 任何弹窗开着时，这里的单键快捷键必须让路。
      if (modalOpen()) return
      const key = String(event.key).toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        onNav?.(1)
      } else if (key === 'k') {
        event.preventDefault()
        onNav?.(-1)
      } else if (key === 'a') {
        event.preventDefault()
        if (!busy) act('accept')
      } else if (key === 'r') {
        event.preventDefault()
        if (!busy) act('reject')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, chapter])

  // 【QA-1】撤销 / 重做：Ctrl+Z / Ctrl+Shift+Z（mac 上 Cmd 同效）。
  // 只在编辑模式里接管 —— 段落视图按 Ctrl+Z 应该交给浏览器，不抢。
  useEffect(() => {
    if (mode !== 'edit') return undefined
    const onKey = (event) => {
      const tag = String(event.target?.tagName ?? '').toLowerCase()
      if (tag === 'input' || tag === 'select') return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = String(event.key).toLowerCase()
      if (key !== 'z' && key !== 'y') return
      if (modalOpen()) return
      event.preventDefault()
      if (key === 'y' || event.shiftKey) {
        if (editor.redo()) setDirty(true)
        else toast('没有可重做的了')
      } else if (editor.undo()) {
        setDirty(true)
      } else {
        toast('没有可撤销的了')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, editor.canUndo, editor.canRedo])

  // 点问题：切到段落视图，定位到含引文的那一段，滚过去。
  const pickIssue = (issue) => {
    setQuotePick(issue)
    setMode('doc')
    const needle = String(issue?.quote ?? '').trim()
    if (!needle) {
      toast('这条问题没记原文片段，只高亮问题本身')
      return
    }
    const at = paras.findIndex((row) => row.includes(needle))
    setPara(at)
    if (at >= 0) {
      const node = paraRefs.current[at]
      if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
      toast(`已定位到第 ${at + 1} 段`)
    } else {
      toast('正文里没找到这句，可能已被改过')
    }
  }

  // 【12 条 #5】字数跟着输入实时走：以前显示的是服务端上次存下来的 words，
  // 改了一千字还是旧数字，作者没法判断「这一章够不够长」。
  const liveWords = String(text || '').trim() ? countChars(text) : (ch.data?.words ?? 0)
  const plan = Number(project?.targetWords ?? 0)

  if (!chapter) return null
  if (ch.loading && !ch.data) return h(Loading, null)
  if (ch.error) return h(ErrorBox, { error: ch.error, onRetry: ch.reload })

  return h(
    'div',
    { className: `nw-rv-detail${readMode ? ' nw-rv-read' : ''}` },
    h(
      'div',
      { className: 'nw-rv-detail-head' },
      h('div', null,
        h('h3', null, `第 ${chapter} 回`),
        h('span', { className: 'nw-hint' },
          `${liveWords}${plan ? ` / ${plan}` : ''} 字${dirty ? ' · 未保存' : ''} · ${STATUS_LABEL[meta.status] || meta.status || '草稿'} · 共 ${paras.length} 段`)),
      h(
        'div',
        { className: 'nw-actions' },
        // 【12 条 #2】自动保存状态要说出来：作者得知道「不用管，它自己会存」。
        h('span', { className: `nw-hint nw-save-state${dirty ? ' nw-dirty' : ''}` },
          dirty
            ? (autosave ? '改动未保存 · 4 秒后自动存' : '改动未保存')
            : (savedAt ? `已保存 ${savedAt}` : '已保存')),
        // 【24 条 #15】键盘提示直接印在按钮上，不然没人知道有快捷键。
        readMode ? null : h('span', { className: 'nw-hint nw-keys' }, 'J/K 换章 · A 采纳 · R 废弃'),
        h(Btn, { small: true, kind: 'ghost', onClick: () => onNav?.(-1), title: '上一章（K）' }, 'K ←'),
        h(Btn, { small: true, kind: 'ghost', onClick: () => onNav?.(1), title: '下一章（J）' }, 'J →'),
        // 【12 条 #11】阅读模式：只留正文，把两侧全收起来。
        h(Btn, {
          small: true,
          kind: readMode ? 'primary' : 'ghost',
          onClick: () => {
            const next = !readMode
            setReadMode(next)
            writeLS(LS.readMode, next ? '1' : '0')
          },
          title: '只看正文',
        }, readMode ? '退出阅读' : '📖 阅读模式'),
        // 【12 条 #3】章节重排：章号就是文件名，插入只能在两章之间挪。
        h(Btn, {
          small: true,
          kind: 'ghost',
          disabled: busy,
          title: '在这一章前面插一个空章，这一章及其后各退一位',
          onClick: async () => {
            if (busy) return
            const at = Math.max(1, chapter)
            if (!window.confirm(`在第 ${at} 回前面插一个空章？\n从第 ${at} 回起每章号都 +1，历史版本一起搬。`)) return
            setBusy(true)
            try {
              const info = await api('chapter.insert', { projectId, at })
              onChanged?.()
              toast(`已插入第 ${info.chapter} 回${info.shifted ? `，${info.shifted} 章各退一位` : ''}`)
            } catch (error) {
              toast(error.message)
            } finally {
              setBusy(false)
            }
          },
        }, '＋ 在此插章'),
        h(Btn, {
          small: true,
          kind: 'ghost',
          disabled: busy,
          title: '把这一章挪到前面去，途经各章顺移',
          onClick: async () => {
            if (busy) return
            const to = Math.max(1, chapter - 1)
            if (to === chapter) return
            setBusy(true)
            try {
              await api('chapter.move', { projectId, from: chapter, to })
              onChanged?.()
              toast(`已挪到第 ${to} 回 · 原来的第 ${to} 回顺移到第 ${to + 1} 回`)
              onNav?.(-1)
            } catch (error) {
              toast(error.message)
            } finally {
              setBusy(false)
            }
          },
        }, '↑ 上移一章'),
        h(Btn, {
          small: true,
          kind: 'ghost',
          disabled: busy,
          title: '把这一章挪到后面去，途经各章顺移',
          onClick: async () => {
            if (busy) return
            const to = chapter + 1
            setBusy(true)
            try {
              await api('chapter.move', { projectId, from: chapter, to })
              onChanged?.()
              toast(`已挪到第 ${to} 回 · 原来的第 ${to} 回顺移到第 ${to - 1} 回`)
              onNav?.(1)
            } catch (error) {
              toast(error.message)
            } finally {
              setBusy(false)
            }
          },
        }, '↓ 下移一章'),
        readMode ? null : h(Btn, { small: true, kind: 'ghost', onClick: onClose }, '← 返回列表'),
        readMode ? null : h(Btn, { small: true, kind: dirty ? 'primary' : 'ghost', onClick: () => save(), disabled: busy || !dirty }, dirty ? '保存修改' : '已保存'),
      ),
    ),
    h(
      'div',
      { className: 'nw-rv-body' },
      h(
        'div',
        { className: 'nw-rv-doc' },
        h(
          'div',
          { className: 'nw-rv-docbar' },
          h(
            'div',
            { className: 'nw-seg' },
            [
              { value: 'doc', label: '段落视图' },
              { value: 'edit', label: '编辑正文' },
            ].map((item) => h(
              'button',
              {
                type: 'button',
                key: item.value,
                className: `nw-seg-btn${mode === item.value ? ' on' : ''}`,
              'aria-pressed': mode === item.value ? 'true' : 'false',
                onClick: () => setMode(item.value),
              },
              item.label,
            )),
          ),
          // 【QA-1】撤销 / 重做放在工具栏上，不用记快捷键也能找得到。
          // 不在编辑模式时点它会先把编辑器打开 —— 否则按钮看起来像坏了。
          h(
            'div',
            { className: 'nw-rv-undo' },
            h(Btn, {
              small: true,
              kind: 'ghost',
              className: 'nw-undo-btn',
              disabled: !editor.canUndo && mode === 'edit',
              title: '撤销上一步（Ctrl+Z）',
              'aria-label': '撤销',
              onClick: () => {
                if (mode !== 'edit') {
                  setMode('edit')
                  toast('已切到编辑正文，再按一次撤销')
                  return
                }
                if (editor.undo()) {
                  setDirty(true)
                  toast(`已撤销一步 · 还能再退 ${Math.max(0, editor.steps - 1)} 步`)
                } else {
                  toast('没有可撤销的了')
                }
              },
            }, '↶ 撤销'),
            h(Btn, {
              small: true,
              kind: 'ghost',
              className: 'nw-redo-btn',
              disabled: !editor.canRedo && mode === 'edit',
              title: '重做（Ctrl+Shift+Z）',
              'aria-label': '重做',
              onClick: () => {
                if (mode !== 'edit') {
                  setMode('edit')
                  toast('已切到编辑正文，再按一次重做')
                  return
                }
                if (editor.redo()) {
                  setDirty(true)
                  toast('已重做一步')
                } else {
                  toast('没有可重做的了')
                }
              },
            }, '↷ 重做'),
            h('span', { className: 'nw-undo-n', title: '撤销栈深度' }, mode === 'edit' ? `${editor.steps} 步可退` : '未在编辑'),
          ),
          quotePick
            ? h('span', { className: 'nw-rv-pick' }, `盯住：${quotePick.text}`)
            : h('span', { className: 'nw-hint' }, '点右边的「#13」彩带格子或问题，正文会跟着亮'),
        ),
        // 【24 条 #13】正文右侧彩带：每段一格，红=AI 味重、橙=节奏拖、绿=好段。点格子滚过去。
        // 颜色来自 chapter.aistyle 扫词表的真命中（style.data.aiHits），不是按段序号染色。
        h('div', { className: 'nw-heat' },
          h('span', { className: 'nw-heat-title' }, '段'),
          h(
            'div',
            { className: 'nw-heat-track' },
            paras.map((item, index) => h(
              'button',
              {
                type: 'button',
                key: index,
                className: `nw-heat-cell nw-heat-${heatTone(item, index, style.data?.hits, issues)}${para === index ? ' on' : ''}`,
                style: { flexGrow: Math.max(1, Math.min(6, Math.ceil(String(item).length / 60))) },
                title: `第 ${index + 1} 段 · ${String(item).length} 字 · ${heatTone(item, index, style.data?.hits, issues) === 'bad' ? 'AI 味重' : heatTone(item, index, style.data?.hits, issues) === 'warn' ? '节奏拖' : '好段'}`,
                onClick: () => {
                  setPara(index)
                  const node = paraRefs.current[index]
                  if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
                  if (mode === 'edit') setMode('doc')
                  const hitsHere = (style.data?.hits ?? []).filter((row) => Number(row.para) === index)
                  toast(hitsHere.length
                    ? `第 ${index + 1} 段 · 命中「${hitsHere[0].pattern}」：${hitsHere[0].hint}`
                    : `第 ${index + 1} 段 · ${heatTone(item, index, style.data?.hits, issues) === 'warn' ? '节奏拖' : '好段'}`)
                },
              },
            )),
          ),
          h(
            'div',
            { className: 'nw-heat-legend' },
            h('span', { className: 'nw-heat-key nw-heat-good' }, '好'),
            h('span', { className: 'nw-heat-key nw-heat-warn' }, '拖'),
            h('span', { className: 'nw-heat-key nw-heat-bad' }, 'AI 味'),
            // 密度是「每千字命中数」：长短章才能横着比。
            style.data
              ? h('span', { className: 'nw-heat-density' }, `AI 味 ${style.data.density ?? 0}/千字 · 词表 ${style.data.lexicon ?? 0} 条`)
              : null,
          ),
        ),
        mode === 'edit'
          ? h(TextArea, {
            value: text,
            rows: 26,
            onChange: (v) => {
              setText(v)
              setDirty(true)
            },
          })
          : h(
            'div',
            { className: 'nw-para-list' },
            paras.map((item, index) => h(
              // 段落本身就是按钮：以前是 <p onClick>，Tab 走不到、回车按不动，
              // 键盘用户完全用不了「点段落定位」这条主路径。
              'button',
              {
                type: 'button',
                key: index,
                ref: (node) => { paraRefs.current[index] = node },
                className: `nw-para nw-para-${heatTone(item, index, style.data?.hits, issues)}${para === index ? ' nw-para-on' : ''}`,
                'aria-pressed': para === index ? 'true' : 'false',
                'aria-label': `第 ${index + 1} 段${para === index ? '（已选中）' : ''}`,
                onClick: () => setPara(index),
              },
              h('span', { className: 'nw-para-n' }, String(index + 1)),
              item,
            )),
          ),
        h(
          'div',
          { className: 'nw-rv-acts' },
          h(Btn, { kind: 'primary', onClick: () => act('accept'), disabled: busy }, '✓ 通过并采纳 (A)'),
          h(Btn, { kind: 'ghost', onClick: () => act('rerun'), disabled: busy }, '↻ 打回 · 重跑'),
          h(Btn, { kind: 'ghost', onClick: () => act('manual'), disabled: busy }, '✋ 打回 · 人工修'),
          h(Btn, { kind: 'danger', onClick: () => act('reject'), disabled: busy }, '✕ 废弃 (R)'),
        ),
      ),
      // 【12 条 #11】阅读模式把整个右侧栏收起来：只看正文。
      readMode ? null : h(
        'div',
        { className: 'nw-rv-side' },
        h(
          Card,
          { title: '评分明细' },
          h(
            'div',
            { className: 'nw-score-grid' },
            [
              ['阅读', scores.reader],
              ['逻辑', scores.logic],
              ['AI 味', scores.aiStyle],
              ['节奏', scores.rhythm],
            ].map(([label, value]) => h(
              'span',
              { className: 'nw-score-cell', key: label },
              h('em', null, value ?? '—'),
              h('span', null, label),
            )),
          ),
          h('div', { className: 'nw-score-total' }, h('span', null, '总分'), h(ScoreBar, { score: meta.score ?? 0, gate })),
        ),
        h(
          Card,
          { title: '问题清单', extra: h('span', { className: 'nw-card-badge' }, `${issues.length}`) },
          issues.length
            ? h('div', { className: 'nw-issues' }, issues.map((issue, index) => h(IssueRow, {
              issue, index, key: index, active: quotePick === issue, onPick: pickIssue,
            })))
            : h(Empty, null, '没有问题。'),
        ),
        h(
          Card,
          { title: '违规清单', extra: h('span', { className: 'nw-card-badge' }, `${violations.length}`) },
          violations.length
            ? h('div', { className: 'nw-issues' }, violations.map((row, index) => h(
              'div',
              { className: 'nw-issue nw-issue-violation', key: index },
              h('span', { className: 'nw-issue-n' }, String(index + 1).padStart(2, '0')),
              h(Tag, { tone: 'red' }, '硬规则'),
              h('span', { className: 'nw-issue-body' }, h('span', { className: 'nw-issue-text' }, row.text ?? row.rule ?? String(row))),
            )))
            : h(Empty, null, '没有违规。'),
        ),
        h(
          Card,
          { title: '历史版本', extra: h('span', { className: 'nw-card-badge' }, `${hist.data?.versions?.length ?? 0}`) },
          h('div', { className: 'nw-hist-ver' },
            h('p', { className: 'nw-hint' }, hist.data?.versions?.length
              ? `每次覆盖前自动留底，保留最近 ${hist.data?.keep ?? 20} 版。回滚本身也会留底，滚错了还能滚回来。`
              : '还没有历史版本 —— 第一次覆盖这章之后才有。'),
            (hist.data?.versions ?? []).slice(0, 8).map((row) => h(
              'div',
              { className: 'nw-ver-row', key: row.name },
              h('span', { className: 'nw-ver-at' }, String(row.at ?? '').replace('T', ' ').slice(0, 15)),
              h('span', { className: 'nw-ver-w' }, `${row.words} 字`),
              h(Btn, {
                small: true,
                kind: 'ghost',
                onClick: async () => {
                  if (busy) return
                  setBusy(true)
                  try {
                    await api('chapter.restore', { projectId, chapter, name: row.name })
                    ch.reload()
                    hist.reload()
                    setDirty(false)
                    onChanged?.()
                    toast(`已回到 ${String(row.at ?? '').slice(0, 15)} 那一版`)
                  } catch (error) {
                    toast(error.message)
                  } finally {
                    setBusy(false)
                  }
                },
              }, '回到这一版'),
            )),
            // 回滚前的当前稿也在历史里，所以才敢给这个按钮。
            hist.data?.versions?.length
              ? h('p', { className: 'nw-hint' }, '回滚后可再从列表里选回原来那版。')
              : null,
          ),
        ),
        h(
          Card,
          { title: '上下文审计' },
          meta.contextAudit
            ? h('pre', { className: 'nw-audit' }, String(meta.contextAudit))
            : h(Empty, null, '这一章没留下上下文审计记录。'),
        ),
        // 【第 1 批】文风校验面板住在右栏：改稿时眼睛盯着正文，
        // 命中清单要能同屏看到，切出去看报告等于不做。
        // 传 body 而不是 text：正文还没进编辑器时（刚打开、还没改）也得校，
        // 否则「打开这一章」看到的是空白面板，等于没做。
        // 章级体检住在校验面板上方：先回答「这段还是不是文」，再谈文笔。
        // 顺序反了的话，模型跑偏的稿子会先给你 28 条文笔建议，白费。
        readMode ? null : h(ChapterHealth, {
          projectId,
          chapter,
          text: body,
          toast,
          onJumpPara: (index) => {
            setMode('doc')
            setPara(Number(index) || 0)
            const node = paraRefs.current[Number(index) || 0]
            if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          },
        }),
        readMode ? null : h(LintPanel, {
          projectId,
          chapter,
          text: body,
          toast,
          onJump: (hit) => {
            // 点命中行 = 跳到那一段并点亮，和「点问题」同一套坐标。
            setMode('doc')
            setPara(Number(hit.para) || 0)
            const node = paraRefs.current[Number(hit.para) || 0]
            if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          },
        }),
        // 【阶段 C】本书阈值。放在校验面板正下方：先看到命中，再问「凭什么按这个标准判我」。
        // 阅读模式下也不藏——它是设置，不是干扰。
        h(LintCalibration, {
          projectId,
          toast,
          onDone: () => { if (typeof onChanged === 'function') onChanged() },
        }),
      ),
    ),

    // 硬拦弹窗：存不进去时挡在面前，不能让人以为存好了。
    blocked
      ? h(LintBlockModal, {
        error: blocked,
        onClose: () => setBlocked(null),
        onFix: (hit) => {
          setBlocked(null)
          setMode('doc')
          if (hit && Number.isFinite(hit.para)) {
            setPara(Number(hit.para))
            const node = paraRefs.current[Number(hit.para)]
            if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        },
        onForce: () => {
          setBlocked(null)
          save({ force: true })
        },
      })
      : null,
  )
}

function ReviewPage({ projectId, chapters, project, toast, onRefresh, refreshKey }) {
  const [tab, setTab] = useState('chapters')
  // 别的页（问题单 / 逾期伏笔）想直接开某一章，就写这个键再切页；这里读一次就清掉。
  const [open, setOpenState] = useState(() => {
    const raw = readLS('nw.openChapter', '')
    return raw ? Number(raw) || null : null
  })
  const [filter, setFilter] = useState('review')
  const gate = Number(project?.qualityGate ?? 70)

  useEffect(() => {
    const raw = readLS('nw.openChapter', '')
    if (!raw) return
    writeLS('nw.openChapter', '')
    setTab('chapters')
    setOpenState(Number(raw) || null)
  }, [refreshKey])

  const rows = useMemo(() => {
    if (filter === 'all') return chapters
    if (filter === 'low') return chapters.filter((row) => row.score > 0 && row.score < gate)
    return chapters.filter((row) => row.status === filter)
  }, [chapters, filter, gate])

  const lowCount = chapters.filter((row) => row.score > 0 && row.score < gate).length
  const pending = chapters.filter((row) => row.status === 'review').length

  if (!projectId) return h(Empty, null, '还没有作品。')

  const FILTERS = [
    { value: 'review', label: '待验收' },
    { value: 'accepted', label: '已采纳' },
    { value: 'low', label: '低分' },
    { value: 'all', label: '全部' },
  ]

  // 三个抽屉：逐章拍板 / 拍板 AI 的改动建议 / 管理攒下来的毛病。
  // 提案与问题是从 LNW 搬回来的一级功能，但放在验收台上比单开两个页更顺：
  // 它们都只在「稿子交上来之后」有用。
  const TABS = [
    { value: 'chapters', label: '逐章验收', icon: '📄' },
    { value: 'proposals', label: '提案', icon: '✎' },
    { value: 'problems', label: '问题单', icon: '⚑' },
    // 冷读和意见池都只在「稿子交上来之后」有用，和拍板是同一时刻的事，
    // 单开一页会变成「想起来才去翻一眼」。
    { value: 'coldread', label: '冷读', icon: '🧊' },
    { value: 'opinions', label: '意见池', icon: '💬' },
  ]

  const head = h(
    'div',
    { className: 'nw-rv-bar' },
    h(
      'div',
      { className: 'nw-actions' },
      h(
        'div',
        { className: 'nw-seg' },
        TABS.map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn${tab === item.value ? ' on' : ''}`,
              'aria-pressed': tab === item.value ? 'true' : 'false',
            onClick: () => {
              setTab(item.value)
              setOpenState(null)
            },
          },
          `${item.icon} ${item.label}`,
        )),
      ),
      tab === 'chapters'
        ? h(
          'div',
          { className: 'nw-seg' },
          FILTERS.map((item) => h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `nw-seg-btn${filter === item.value ? ' on' : ''}`,
              'aria-pressed': filter === item.value ? 'true' : 'false',
              onClick: () => setFilter(item.value),
            },
            item.label,
            h('span', { className: 'nw-seg-n' }, String(
              item.value === 'all' ? chapters.length
                : item.value === 'low' ? lowCount
                  : chapters.filter((row) => row.status === item.value).length,
            )),
          )),
        )
        : null,
    ),
    h('span', { className: 'nw-hint' }, tab === 'chapters'
      ? `质检门槛 ${gate} 分 · 共 ${chapters.length} 章 · ${pending} 章等你拍板`
      : `质检门槛 ${gate} 分`),
  )

  const body = tab === 'coldread'
    ? h(ColdReadPanel, {
      projectId,
      chapters,
      toast,
      onOpenChapter: (chapter) => { setTab('chapters'); setOpenState(chapter) },
    })
    : tab === 'opinions'
      ? h(OpinionBoard, {
        projectId,
        toast,
        refreshKey,
        onOpenChapter: (chapter) => { setTab('chapters'); setOpenState(chapter) },
      })
      : tab === 'proposals'
    ? h(ProposalBoard, { projectId, gate, toast, onRefresh, refreshKey })
    : tab === 'problems'
      ? h(ProblemBoard, {
        projectId, gate, toast, onRefresh, refreshKey,
        onOpenChapter: (chapter) => {
          setTab('chapters')
          setOpenState(chapter)
        },
      })
      : (open
        ? h(ReviewDetail, {
          projectId,
          project,
          chapter: open,
          gate,
          onClose: () => setOpenState(null),
          onChanged: onRefresh,
          toast,
          // 【24 条 #15】J/K 换章：按当前筛选后的顺序走，不是全书的顺序。
          onNav: (step) => {
            const list = rows.length ? rows : chapters
            const at = list.findIndex((row) => Number(row.chapter) === Number(open))
            const next = list[at + step]
            if (!next) {
              toast(step > 0 ? '已经是最后一章了' : '已经是第一章了')
              return
            }
            setOpenState(Number(next.chapter))
          },
        })
        : h(ReviewList, { chapters: rows, gate, onOpen: setOpenState, selected: open }))

  return h('div', { className: 'nw-page nw-review' }, head, body)
}

// ═════════ 45-triage.js ═════════
/**
 * 长夜 · 验收台的两个抽屉：提案 与 问题单
 *
 * 为什么放在验收台而不是新开页：这两样东西都是「稿子交上来之后才有」的，
 * 跟逐章验收是同一个动作的两个侧面。分开成页会让人来回跳。
 *
 * 提案 = AI 想改，等你拍板。before/after 必须先能对上正文，采纳才写盘，
 *         一条都对不上就整体拒掉、正文一字不动（服务端 proposal.decide 保证）。
 * 问题单 = 验收时记下的毛病，要能跨章看、能关、能重开。
 */

const PROPOSAL_TONE = {
  pending: { label: '待批', tone: 'amber' },
  accepted: { label: '已采纳', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
  // 过期不是失败：正文被改过，提案指的段落已经不在了。
  // 独立一档而不是塞进 rejected —— 驳回是人不同意，过期是稿子变了。
  outdated: { label: '已过期', tone: 'grey' },
}

const PROBLEM_TONES = {
  'ai-style': { label: 'AI 味', tone: 'amber' },
  logic: { label: '逻辑', tone: 'red' },
  style: { label: '文风', tone: 'blue' },
  other: { label: '其他', tone: 'grey' },
}

const SEVERITY_LABEL = {
  critical: '致命', major: '重要', minor: '次要', note: '提示',
}

const PROBLEM_STATUS_LABEL = { open: '未修', fixed: '已修', ignored: '已忽略' }
const PROBLEM_STATUS_TONE = { open: 'amber', fixed: 'green', ignored: 'grey' }

function DiffRow({ diff, index }) {
  // 段落地址：c0012p03 = 第 12 回第 3 段。服务端保存提案时就把它钉下来了，
  // 采纳时只改这一段——同一句话在别处出现也不会改错。
  const pid = diff?.anchor?.pid ? String(diff.anchor.pid) : ''
  const stale = diff?.applicable === false
  return h(
    'div',
    { className: `nw-diff${stale ? ' nw-diff-stale' : ''}` },
    h('span', { className: 'nw-diff-n' }, String(index + 1).padStart(2, '0')),
    pid ? h('span', { className: 'nw-diff-pid', title: stale ? '这一段已经对不上了' : '这条改动只动这一段' }, pid) : null,
    stale ? h('span', { className: 'nw-diff-tag-stale' }, '对不上') : null,
    h(
      'div',
      { className: 'nw-diff-cols' },
      h('div', { className: 'nw-diff-cell nw-diff-before' },
        h('span', { className: 'nw-diff-tag' }, '改前'),
        h('p', null, diff.before || '（新增，原处为空）')),
      h('div', { className: 'nw-diff-cell nw-diff-after' },
        h('span', { className: 'nw-diff-tag' }, '改后'),
        h('p', null, diff.after || '（删除这段）')),
    ),
    diff.why ? h('span', { className: 'nw-diff-why' }, diff.why) : null,
  )
}

function ProposalCard({
  row, onDecide, onRemove, gate, busy, projectId, demo,
}) {
  const [open, setOpen] = useState(false)
  const tone = PROPOSAL_TONE[row.status] ?? PROPOSAL_TONE.pending
  // 采纳前先问服务端：每条 before 在正文里出现几次。>1 就是「改了不该改的那一段」，
  // 而且正文已经落盘、没有撤销。这个检查必须在点「采纳」之前摆出来。
  const preview = useAsync(
    () => api('proposal.preview', { projectId, id: row.id }),
    [projectId, row.id, open],
    { skip: !open || demo || !projectId || !row.id || row.status !== 'pending' },
  )
  const risky = preview.data?.rows?.filter((item) => item.ambiguous || item.missing) ?? []
  return h(
    'div',
    { className: `nw-prop nw-prop-${row.status}` },
    h(
      'button',
      { type: 'button', className: 'nw-prop-head', onClick: () => setOpen(!open) },
      h('span', { className: 'nw-prop-n' }, `第 ${row.chapter} 回`),
      h('span', { className: 'nw-prop-title' }, row.title),
      h(Tag, { tone: row.kind === 'rewrite' ? 'red' : 'grey' }, row.kind === 'rewrite' ? '整章重写' : `${row.diffs.length} 处替换`),
      h(Tag, { tone: tone.tone }, tone.label),
      // 过期的条数直接摆在头上：点进去才发现对不上，等于白点。
      row.staleCount ? h(Tag, { tone: 'red' }, `过期 ${row.staleCount}`) : null,
      h('span', { className: 'nw-prop-go' }, open ? '▾' : '▸'),
    ),
    row.summary ? h('p', { className: 'nw-hint' }, row.summary) : null,
    row.hint ? h('p', { className: 'nw-prop-stale-hint' }, row.hint) : null,
    open
      ? h(
        'div',
        { className: 'nw-prop-body' },
        risky.length
          ? h(
            'div',
            { className: 'nw-prop-warn' },
            h('span', { className: 'nw-prop-warn-icon' }, '⚠'),
            h('span', null, `${risky.length} 处「改前」在正文里不唯一或找不到，采纳会改错位置：`),
            h(
              'ul',
              { className: 'nw-prop-warn-list' },
              risky.map((item) => h('li', { key: item.index },
                `第 ${item.index + 1} 处 · ${item.missing ? '正文里找不到这句' : `正文里有 ${item.count} 处相同`} ·「${String(item.before ?? '').slice(0, 30)}」`)),
            ),
          )
          : null,
        row.diffs.map((diff, index) => h(DiffRow, { diff, index, key: index })),
        row.status === 'accepted'
          ? h('p', { className: 'nw-hint' }, `已写回正文：命中 ${row.applied ?? 0} 处${(row.missed ?? []).length ? `，未命中 ${row.missed.length} 处` : ''}`)
          : null,
      )
      : null,
    h(
      'div',
      { className: 'nw-prop-foot' },
      h('span', { className: 'nw-hint' }, `质检门槛 ${gate} · AI 提议，你拍板`),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { small: true, kind: 'danger', onClick: () => onRemove(row), disabled: busy }, '删除'),
        row.status === 'pending'
          ? h(Btn, { small: true, kind: 'ghost', onClick: () => onDecide(row, 'reject'), disabled: busy }, '✕ 驳回')
          : null,
        row.status === 'pending'
          ? h(Btn, { small: true, kind: 'primary', onClick: () => onDecide(row, 'accept'), disabled: busy }, '✓ 采纳并写回')
          : null,
      ),
    ),
  )
}

function ProposalBoard({ projectId, gate, toast, onRefresh, refreshKey }) {
  const res = useAsync(() => api('proposal.list', { projectId }), [projectId, refreshKey], { skip: !projectId })
  const [filter, setFilter] = useState('pending')
  // 【24 条 #16】按章收拢 + 批量处理：AI 一次提二十条，逐条点等于加班。
  const [chapterFilter, setChapterFilter] = useState(0)
  const [folded, setFolded] = useState({})
  const [busy, setBusy] = useState(false)
  // 【12 条 #10】样例必须自己点开。以前真数据为空就拿三条假提案顶上，
  // 只挂一个小蓝标，等于让假数据替你的稿子做评审。
  const [showDemo, setShowDemo] = useState(false)

  // 下面这些全部要在任何 return 之前算完。
  // 为什么：组件里所有 hook 必须每帧按同样顺序调一遍。第一帧是 loading 走了
  // `return h(Loading)`，数据回来那一帧却多出一个 useMemo —— React 数出来的 hook
  // 数量对不上，直接抛错、整页白屏，表现就是「点提案这个 tab 打不开」。
  const realItems = res.data?.items ?? []
  const demo = realItems.length === 0 && showDemo
  const items = demo ? MOCK.proposalsDemo : realItems
  const allChapters = Array.from(new Set(items.map((row) => row.chapter))).sort((a, b) => a - b)
  const rows = (filter === 'all' ? items : items.filter((row) => row.status === filter))
    .filter((row) => (chapterFilter ? row.chapter === chapterFilter : true))
  const pendingRows = rows.filter((row) => row.status === 'pending')

  // 【24 条 #16】按章分组：提案一多就是一堵墙，先按章折叠。
  const groups = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      if (!map.has(row.chapter)) map.set(row.chapter, [])
      map.get(row.chapter).push(row)
    })
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [rows.map((row) => row.id).join('|')])

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const decide = async (row, action) => {
    if (demo) {
      toast(`演示：第 ${row.chapter} 回「${row.title}」${action === 'accept' ? '已采纳（未写盘）' : '已驳回（未写盘）'}`)
      return
    }
    setBusy(true)
    try {
      const out = await api('proposal.decide', { projectId, id: row.id, action })
      res.reload()
      onRefresh?.()
      if (action === 'accept') {
        toast(`已写回第 ${row.chapter} 回：${out.applied} 处`)
      } else {
        toast('已驳回')
      }
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  // 【24 条 #16】批量：一次把当前筛选里的待批条目全拍板。
  const decideAll = async (action) => {
    if (!pendingRows.length) {
      toast('当前筛选下没有待批提案')
      return
    }
    if (demo) {
      toast(`演示：${pendingRows.length} 条提案已${action === 'accept' ? '全采纳' : '全驳回'}（未写盘）`)
      return
    }
    setBusy(true)
    try {
      for (const row of pendingRows) {
        // eslint-disable-next-line no-await-in-loop
        await api('proposal.decide', { projectId, id: row.id, action })
      }
      res.reload()
      onRefresh?.()
      toast(`已${action === 'accept' ? '批量采纳' : '批量驳回'} ${pendingRows.length} 条`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (demo) {
      toast('演示：这条提案已从列表移除（未写盘）')
      return
    }
    setBusy(true)
    try {
      await api('proposal.remove', { projectId, id: row.id })
      res.reload()
      toast('提案已删除')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const FILTERS = [
    { value: 'pending', label: '待批' },
    { value: 'accepted', label: '已采纳' },
    { value: 'rejected', label: '已驳回' },
    { value: 'outdated', label: '已过期' },
    { value: 'all', label: '全部' },
  ]

  return h(
    'div',
    { className: 'nw-board' },
    h(
      'div',
      { className: 'nw-rv-bar' },
      h(
        'div',
        { className: 'nw-actions' },
        h(
          'div',
          { className: 'nw-seg' },
          FILTERS.map((item) => h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `nw-seg-btn${filter === item.value ? ' on' : ''}`,
              'aria-pressed': filter === item.value ? 'true' : 'false',
              onClick: () => setFilter(item.value),
            },
            item.label,
            h('span', { className: 'nw-seg-n' }, String(
              item.value === 'all' ? items.length : items.filter((row) => row.status === item.value).length,
            )),
          )),
        ),
        // 【24 条 #16】按章筛选
        allChapters.length > 1
          ? h(Select, {
            value: String(chapterFilter),
            onChange: (v) => setChapterFilter(Number(v) || 0),
            options: [{ value: '0', label: `全部章（${items.length}）` }].concat(
              allChapters.map((n) => ({
                value: String(n),
                label: `第 ${n} 回（${items.filter((row) => row.chapter === n).length}）`,
              })),
            ),
          })
          : null,
      ),
      h(
        'div',
        { className: 'nw-actions' },
        realItems.length === 0
          ? h(
            'button',
            {
              type: 'button',
              className: `nw-demo-sw${showDemo ? ' on' : ''}`,
              'aria-pressed': showDemo ? 'true' : 'false',
              onClick: () => {
                setShowDemo(!showDemo)
                toast(showDemo ? '已收起样例，回到你自己稿子的真实状态' : '现在看到的是样例：3 条假提案，采纳不会改你的稿子')
              },
            },
            showDemo ? '样例开着 · 点它收起' : '看样例（3 条假提案）',
          )
          : null,
        h(Btn, { small: true, kind: 'primary', onClick: () => decideAll('accept'), disabled: busy || !pendingRows.length }, `✓ 全采纳 ${pendingRows.length || ''}`.trim()),
        h(Btn, { small: true, kind: 'ghost', onClick: () => decideAll('reject'), disabled: busy || !pendingRows.length }, `✕ 全驳回 ${pendingRows.length || ''}`.trim()),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => {
            const next = {}
            groups.forEach(([n]) => { next[n] = true })
            setFolded(next)
            toast('已按章折叠，点章头展开')
          },
        }, '⊟ 全部折叠'),
      ),
    ),
    rows.length
      ? h('div', { className: 'nw-prop-list' }, groups.map(([n, groupRows]) => (folded[n]
        ? h(
          'button',
          {
            type: 'button',
            key: `fold-${n}`,
            className: 'nw-prop-fold',
            onClick: () => setFolded({ ...folded, [n]: false }),
          },
          h('span', { className: 'nw-prop-fold-n' }, `第 ${n} 回`),
          h('span', { className: 'nw-hint' }, `${groupRows.length} 条提案 · 待批 ${groupRows.filter((row) => row.status === 'pending').length} · 点章头展开`),
          h('span', { className: 'nw-prop-go' }, '▸'),
        )
        : h(
          'div',
          { className: 'nw-prop-group', key: `group-${n}` },
          h(
            'button',
            {
              type: 'button',
              className: 'nw-prop-group-head',
              onClick: () => setFolded({ ...folded, [n]: true }),
            },
            h('span', { className: 'nw-prop-fold-n' }, `第 ${n} 回`),
            h('span', { className: 'nw-hint' }, `${groupRows.length} 条`),
            h('span', { className: 'nw-prop-go' }, '▾'),
          ),
          groupRows.map((row) => h(ProposalCard, {
            key: row.id, row, gate, busy, projectId, demo, onDecide: decide, onRemove: remove,
          })),
        ))))
      : h(Empty, null, filter === 'pending' ? '没有待批提案。AI 交稿后会用 nightwrite_op 的 proposal.save 提上来。' : '这个状态下没有提案。'),
  )
}

function ProblemRow({ row, onStatus, onRemove, busy, onOpen }) {
  const tone = PROBLEM_TONES[row.type] ?? PROBLEM_TONES.other
  return h(
    'div',
    { className: `nw-prob nw-prob-${row.status}` },
    h(
      'button',
      { type: 'button', className: 'nw-prob-main', onClick: () => onOpen(row) },
      h('span', { className: 'nw-prob-n' }, `第 ${row.chapter} 回`),
      h(Tag, { tone: tone.tone }, tone.label),
      h(Tag, { tone: row.severity === 'critical' ? 'red' : 'grey' }, SEVERITY_LABEL[row.severity] ?? row.severity),
      h('span', { className: 'nw-prob-text' }, row.text),
      h(Tag, { tone: PROBLEM_STATUS_TONE[row.status] ?? 'grey' }, PROBLEM_STATUS_LABEL[row.status] ?? row.status),
    ),
    row.quote ? h('span', { className: 'nw-prob-quote' }, `「${row.quote}」`) : null,
    h(
      'span',
      { className: 'nw-prob-acts' },
      row.status !== 'fixed' ? h(Btn, { small: true, kind: 'primary', onClick: () => onStatus(row, 'fixed'), disabled: busy }, '✓ 已修') : null,
      row.status !== 'open' ? h(Btn, { small: true, kind: 'ghost', onClick: () => onStatus(row, 'open'), disabled: busy }, '↺ 重开') : null,
      row.status !== 'ignored' ? h(Btn, { small: true, kind: 'ghost', onClick: () => onStatus(row, 'ignored'), disabled: busy }, '忽略') : null,
      h(Btn, { small: true, kind: 'danger', onClick: () => onRemove(row), disabled: busy }, '删除'),
    ),
  )
}

function ProblemBoard({ projectId, gate, toast, onRefresh, refreshKey, onOpenChapter }) {
  const res = useAsync(() => api('problem.list', { projectId }), [projectId, refreshKey], { skip: !projectId })
  const [status, setStatus] = useState('open')
  const [type, setType] = useState('all')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState(null)
  // 【24 条 #17】只看本章：验收第 5 回时，别被别的章的问题淹了。
  const [onlyChapter, setOnlyChapter] = useState(0)
  // 【12 条 #10】问题单同理：真一条没有就说没有，别拿假条目骗你以为自己记过。
  const [showDemo, setShowDemo] = useState(false)

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (res.loading && !res.data) return h(Loading, null)
  if (res.error) return h(ErrorBox, { error: res.error, onRetry: res.reload })

  const realItems = res.data?.items ?? []
  const demo = realItems.length === 0 && showDemo
  const items = demo ? MOCK.problemsDemo : realItems
  const chaptersInItems = Array.from(new Set(items.map((row) => row.chapter))).sort((a, b) => a - b)
  const rows = items
    .filter((row) => (status === 'all' ? true : row.status === status))
    .filter((row) => (type === 'all' ? true : row.type === type))
    .filter((row) => (onlyChapter ? row.chapter === onlyChapter : true))

  const setOne = async (row, next) => {
    if (demo) {
      toast(`演示：第 ${row.chapter} 回那条已标记为「${next === 'fixed' ? '已修' : next === 'ignored' ? '已忽略' : '未修'}」（未写盘）`)
      return
    }
    setBusy(true)
    try {
      await api('problem.resolve', { projectId, id: row.id, status: next })
      res.reload()
      onRefresh?.()
      toast(next === 'fixed' ? '已标记修好' : next === 'ignored' ? '已忽略' : '已重开')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row) => {
    if (demo) {
      toast('演示：这条问题已从列表移除（未写盘）')
      return
    }
    setBusy(true)
    try {
      await api('problem.remove', { projectId, id: row.id })
      res.reload()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = async () => {
    if (!String(draft.text ?? '').trim()) {
      toast('先写一句问题说明')
      return
    }
    setBusy(true)
    try {
      await api('problem.save', { projectId, problem: draft })
      setDraft(null)
      res.reload()
      onRefresh?.()
      toast('问题已记下')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const STATUS_FILTERS = [
    { value: 'open', label: '未修' },
    { value: 'fixed', label: '已修' },
    { value: 'ignored', label: '已忽略' },
    { value: 'all', label: '全部' },
  ]
  const TYPE_FILTERS = [
    { value: 'all', label: '全部类型' },
    { value: 'ai-style', label: 'AI 味' },
    { value: 'logic', label: '逻辑' },
    { value: 'style', label: '文风' },
    { value: 'other', label: '其他' },
  ]

  return h(
    'div',
    { className: 'nw-board' },
    h(
      'div',
      { className: 'nw-rv-bar' },
      h(
        'div',
        { className: 'nw-actions' },
        h(
          'div',
          { className: 'nw-seg' },
          STATUS_FILTERS.map((item) => h(
            'button',
            {
              type: 'button',
              key: item.value,
              className: `nw-seg-btn${status === item.value ? ' on' : ''}`,
              'aria-pressed': status === item.value ? 'true' : 'false',
              onClick: () => setStatus(item.value),
            },
            item.label,
            h('span', { className: 'nw-seg-n' }, String(
              item.value === 'all' ? items.length : items.filter((row) => row.status === item.value).length,
            )),
          )),
        ),
        h(Select, { value: type, onChange: setType, options: TYPE_FILTERS }),
        // 【24 条 #17】只看本章
        chaptersInItems.length > 1
          ? h(Select, {
            value: String(onlyChapter),
            onChange: (v) => {
              const next = Number(v) || 0
              setOnlyChapter(next)
              toast(next ? `只看第 ${next} 回` : '看全部章')
            },
            options: [{ value: '0', label: `全部章（${items.length}）` }].concat(
              chaptersInItems.map((n) => ({
                value: String(n),
                label: `只看第 ${n} 回（${items.filter((row) => row.chapter === n).length}）`,
              })),
            ),
          })
          : null,
      ),
      h(
        'div',
        { className: 'nw-actions' },
        realItems.length === 0
          ? h(
            'button',
            {
              type: 'button',
              className: `nw-demo-sw${showDemo ? ' on' : ''}`,
              'aria-pressed': showDemo ? 'true' : 'false',
              onClick: () => {
                setShowDemo(!showDemo)
                toast(showDemo ? '已收起样例' : '现在看到的是样例：4 条假问题，改状态不会写盘')
              },
            },
            showDemo ? '样例开着 · 点它收起' : '看样例（4 条假问题）',
          )
          : null,
        h('span', { className: 'nw-hint' }, `门槛 ${gate} 分`),
        h(Btn, { small: true, kind: 'ghost', onClick: () => setDraft({
          chapter: 1, para: 0, type: 'other', severity: 'minor', scope: 'chapter', text: '', quote: '', fix: '',
        }) }, '＋ 记一条'),
      ),
    ),
    rows.length
      ? h('div', { className: 'nw-prob-list' }, rows.map((row) => h(ProblemRow, {
        key: row.id, row, busy, onStatus: setOne, onRemove: remove, onOpen: (r) => onOpenChapter?.(r.chapter),
      })))
      : h(Empty, null, status === 'open' ? '没有未修问题。验收时记下的毛病会攒在这里。' : '这个筛选下没有条目。'),
    draft
      ? h(Modal, {
        title: '记一条问题',
        onClose: () => setDraft(null),
        footer: h(
          Fragment,
          null,
          h(Btn, { kind: 'ghost', small: true, onClick: () => setDraft(null) }, '取消'),
          h(Btn, { kind: 'primary', small: true, onClick: saveDraft, disabled: busy }, '记下'),
        ),
      },
      h(
        'div',
        { className: 'nw-order-grid' },
        h(Field, { label: '第几回' }, h(Input, {
          type: 'number', value: draft.chapter, onChange: (v) => setDraft({ ...draft, chapter: Number(v) || 0 }),
        })),
        h(Field, { label: '类型' }, h(Select, {
          value: draft.type,
          onChange: (v) => setDraft({ ...draft, type: v }),
          options: TYPE_FILTERS.slice(1),
        })),
        h(Field, { label: '严重度' }, h(Select, {
          value: draft.severity,
          onChange: (v) => setDraft({ ...draft, severity: v }),
          options: [
            { value: 'critical', label: '致命' },
            { value: 'major', label: '重要' },
            { value: 'minor', label: '次要' },
            { value: 'note', label: '提示' },
          ],
        })),
        h(Field, { label: '范围' }, h(Select, {
          value: draft.scope,
          onChange: (v) => setDraft({ ...draft, scope: v }),
          options: [
            { value: 'chapter', label: '本章' },
            { value: 'cross', label: '跨章' },
            { value: 'global', label: '全局' },
          ],
        })),
      ),
      h(Field, { label: '问题说明' }, h(TextArea, {
        value: draft.text, rows: 3, onChange: (v) => setDraft({ ...draft, text: v }),
        placeholder: '例：连续三段都用「仿佛」，AI 味重',
      })),
      h(Field, { label: '原文片段（可选）' }, h(Input, {
        value: draft.quote, onChange: (v) => setDraft({ ...draft, quote: v }),
      })),
      h(Field, { label: '怎么改（可选）' }, h(Input, {
        value: draft.fix, onChange: (v) => setDraft({ ...draft, fix: v }),
      }))
      )
      : null,
  )
}

// ═════════ 47-opinions.js ═════════
/**
 * 长夜 · 冷读与意见池（LNW 的两位邻居）
 *
 * 为什么放在验收台而不是单开一页：冷读和意见池都只在「稿子交上来之后」有用，
 * 和人拍板是同一时刻的事。单开一页会变成「想起来才去看一眼」。
 *
 * 这里刻意不做「一键采纳并自动改稿」。意见池记的是别人的话，改不改是作者的事；
 * 自动改稿会让人分不清「AI 意见」和「已经改好了」——一旦混起来，作者就没法
 * 再信任自己看到的那份正文。
 */

/**
 * 冷读：把稿子交给一个没读过设定的人。
 */
function ColdReadPanel({ projectId, chapters, toast, onOpenChapter }) {
  const list = useAsync(() => api('coldread.list', { projectId }), [projectId], { skip: !projectId })
  const [scope, setScope] = useState('chapter')
  const [chapter, setChapter] = useState('')
  const [busy, setBusy] = useState(false)
  const [pkg, setPkg] = useState(null)
  const [paste, setPaste] = useState('')

  const chapterOptions = (Array.isArray(chapters) ? chapters : [])
    .filter((row) => String(row.status) !== 'rejected')
    .map((row) => ({ value: String(row.chapter), label: `第 ${row.chapter} 回${row.title ? `「${row.title}」` : ''}` }))

  useEffect(() => {
    if (!chapter && chapterOptions.length) setChapter(chapterOptions[chapterOptions.length - 1].value)
  }, [chapterOptions.length])

  const prepare = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const payload = { projectId, scope }
      if (scope === 'chapter') payload.chapter = Number(chapter)
      const value = await api('coldread.prepare', payload)
      setPkg(value)
      list.reload()
      toast(`已生成冷读包：${value.chapters.length} 回 / ${value.words} 字`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const copyPrompt = async () => {
    if (!pkg?.prompt) return
    try {
      await navigator.clipboard.writeText(pkg.prompt)
      toast('提示词已复制，粘到对话里让 agent 读那个 txt')
    } catch {
      toast('复制失败，手动选中下面那段文字')
    }
  }

  // 回执是模型给的一段文字。这里让人粘贴回来，服务端按「第N回：」切成条目。
  const submit = async () => {
    const text = String(paste ?? '').trim()
    if (!text) {
      toast('先把回执粘进来')
      return
    }
    const scoreMatch = text.match(/(\d{1,3})\s*分/) || text.match(/分数[:：]?\s*(\d{1,3})/)
    const verdictMatch = text.match(/(建议[^\n。]{0,20}|接纳|退修|拒稿|再看看|弃书|继续追)/)
    const items = []
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const hit = line.match(/第\s*(\d+)\s*[回章节][:：]?\s*(.+)$/)
      if (!hit) continue
      const body = hit[2].trim()
      if (body.length < 4) continue
      items.push({
        chapter: Number(hit[1]),
        kind: /高光/.test(line) ? 'highlight' : 'weakness',
        comment: body.slice(0, 300),
        severity: /硬伤/.test(line) ? 'major' : 'minor',
      })
    }
    try {
      const value = await api('coldread.submit', {
        projectId,
        score: scoreMatch ? Number(scoreMatch[1]) : undefined,
        verdict: verdictMatch ? verdictMatch[1] : '',
        items,
        file: pkg?.fileName ?? '',
      })
      setPaste('')
      toast(`回执已入库：${value.pooled.added} 条进意见池${value.score ? ` · ${value.score} 分` : ''}`)
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    Card,
    { title: '冷读', extra: h(Tag, { tone: 'blue' }, '陌生人视角') },
    h('p', { className: 'nw-hint' }, '把稿子汇成一份 txt，交给一个没读过任何设定的人一次读完。它不查设定矛盾，只回答一个问题：读到这里，想不想继续看。'),
    h(
      'div',
      { className: 'nw-cold-form' },
      h(
        'div',
        { className: 'nw-seg' },
        [
          { value: 'chapter', label: '单章' },
          { value: 'book', label: '整本' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-seg-btn${scope === item.value ? ' on' : ''}`,
            'aria-pressed': scope === item.value ? 'true' : 'false',
            onClick: () => setScope(item.value),
          },
          item.label,
        )),
      ),
      scope === 'chapter'
        ? h(Select, {
          value: chapter,
          onChange: setChapter,
          options: chapterOptions.length ? chapterOptions : [{ value: '', label: '（还没有可读的章）' }],
        })
        : null,
      h(Btn, { small: true, kind: 'primary', disabled: busy || !projectId, onClick: prepare }, busy ? '正在汇总…' : '生成冷读包'),
    ),
    pkg
      ? h(
        'div',
        { className: 'nw-cold-pkg' },
        h('div', { className: 'nw-cold-file' }, `📄 ${pkg.fileName}`),
        h('div', { className: 'nw-hint' }, `${pkg.chapters.length} 回 · ${pkg.words} 字${pkg.truncated ? '（原文更长，只放了前一部分）' : ''}`),
        h(
          'div',
          { className: 'nw-actions' },
          h(Btn, { small: true, kind: 'ghost', onClick: copyPrompt }, '复制提示词'),
        ),
        h('pre', { className: 'nw-cold-prompt' }, pkg.prompt),
      )
      : null,
    h(
      'div',
      { className: 'nw-cold-submit' },
      h(Field, { label: '把回执粘回来' }, h(TextArea, {
        value: paste,
        rows: 4,
        placeholder: '第 12 回：这里主角的选择不成立，他刚说过不去，下一段又去了。',
        onChange: setPaste,
      })),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { small: true, kind: 'primary', onClick: submit }, '存进意见池'),
        h('span', { className: 'nw-hint' }, '以「第N回：」开头的行会被切成一条条意见；带「高光」的记为高光。'),
      ),
    ),
    (list.data?.items ?? []).length
      ? h(
        'details',
        { className: 'nw-cold-history' },
        h('summary', null, `生成过的冷读包（${list.data.items.length}）`),
        ...list.data.items.slice(0, 12).map((row) => h(
          'div',
          { className: 'nw-cold-histrow', key: row.name },
          h('span', { className: 'nw-cold-histname' }, row.name),
          h('span', { className: 'nw-hint' }, `${(row.bytes / 1024).toFixed(0)} KB`),
        )),
      )
      : null,
  )
}

/**
 * 意见池：把四处的意见拉到一张表上。
 */
function OpinionBoard({ projectId, toast, refreshKey, onOpenChapter }) {
  const [status, setStatus] = useState('open')
  const [source, setSource] = useState('')
  const list = useAsync(
    () => api('opinion.list', { projectId, status: status || undefined, source: source || undefined }),
    [projectId, status, source, refreshKey],
    { skip: !projectId },
  )
  const [collecting, setCollecting] = useState(false)

  const counts = list.data?.counts ?? { open: 0, adopted: 0, dismissed: 0, total: 0 }

  const collect = async () => {
    setCollecting(true)
    try {
      const value = await api('opinion.collect', { projectId })
      list.reload()
      toast(value.added ? `从问题单和 AI 味命中拉进来 ${value.added} 条` : '没有新的可拉')
    } catch (error) {
      toast(error.message)
    } finally {
      setCollecting(false)
    }
  }

  const decide = async (row, next) => {
    try {
      await api('opinion.decide', { projectId, id: row.id, status: next })
      list.reload()
      toast(next === 'adopted' ? '记为采纳' : next === 'dismissed' ? '记为不改' : '重新挂起')
    } catch (error) {
      toast(error.message)
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (list.loading && !list.data) return h(Loading, null)
  if (list.error) return h(ErrorBox, { error: list.error, onRetry: list.reload })

  const rows = list.data?.items ?? []
  const SOURCE_LABEL = {
    coldread: '冷读',
    reader: '模拟读者',
    consistency: '审校',
    lint: '机器检测',
    author: '作者',
    other: '其它',
  }

  return h(
    Card,
    {
      title: '意见池',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h('span', { className: 'nw-card-badge' }, `${counts.total}`),
        h(Btn, { small: true, kind: 'ghost', disabled: collecting, onClick: collect }, collecting ? '拉着…' : '从问题单拉一遍'),
      ),
    },
    h('p', { className: 'nw-hint' }, '别人说过的、自己记下的、机器扫出来的，都在这里。它只汇总，不替你判断——采纳与否是你的事。'),
    h(
      'div',
      { className: 'nw-seg' },
      [
        { value: 'open', label: '待处理' },
        { value: 'adopted', label: '已采纳' },
        { value: 'dismissed', label: '不改' },
        { value: '', label: '全部' },
      ].map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value || 'all',
          className: `nw-seg-btn${status === item.value ? ' on' : ''}`,
          'aria-pressed': status === item.value ? 'true' : 'false',
          onClick: () => setStatus(item.value),
        },
        item.label,
        item.value ? h('span', { className: 'nw-seg-n' }, String(counts[item.value] ?? 0)) : null,
      )),
    ),
    h(
      'div',
      { className: 'nw-seg nw-opinion-src' },
      [
        { value: '', label: '所有来源' },
        { value: 'coldread', label: '冷读' },
        { value: 'lint', label: '机器检测' },
        { value: 'consistency', label: '审校' },
        { value: 'author', label: '自己记的' },
      ].map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value || 'all-src',
          className: `nw-seg-btn${source === item.value ? ' on' : ''}`,
          onClick: () => setSource(item.value),
        },
        item.label,
      )),
    ),
    rows.length
      ? h(
        'div',
        { className: 'nw-opinion-list' },
        ...rows.map((row) => h(
          'div',
          { key: row.id, className: `nw-opinion nw-opinion-${row.status}` },
          h('span', { className: 'nw-opinion-ch' }, `第 ${row.chapter} 回`),
          h(
            'span',
            { className: 'nw-opinion-body' },
            h('span', { className: 'nw-opinion-text' }, row.text),
            row.quote
              ? h('span', { className: 'nw-opinion-quote' }, `「${row.quote}」`)
              : null,
            row.resolution
              ? h('span', { className: 'nw-hint' }, `处理：${row.resolution}`)
              : null,
          ),
          h(Tag, { tone: row.kind === 'highlight' ? 'green' : 'grey' }, SOURCE_LABEL[row.source] ?? row.source),
          h(
            'span',
            { className: 'nw-opinion-acts' },
            row.chapter && onOpenChapter
              ? h(Btn, { small: true, kind: 'ghost', onClick: () => onOpenChapter(row.chapter) }, '去看')
              : null,
            row.status === 'open'
              ? h(
                Fragment,
                null,
                h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'adopted') }, '采纳'),
                h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'dismissed') }, '不改'),
              )
              : h(Btn, { small: true, kind: 'ghost', onClick: () => decide(row, 'open') }, '重新挂起'),
          ),
        )),
      )
      : h(Empty, null, status === 'open'
        ? '没有待处理的意见。冷读一份稿子，或者从问题单拉一遍，都会往这里添。'
        : '这个筛选下没有意见。'),
  )
}

// ═════════ 50-world.js ═════════
/**
 * 长夜 · 世界库
 *
 * 顶部世界状态快照；左边八类账本，右边表格 / 关系图 / 时间线三视图。
 */

function LedgerEditor({ projectId, kind, row, onClose, onSaved, toast }) {
  const [draft, setDraft] = useState(row ?? {})
  const cols = LEDGER_COLUMNS[kind] ?? []
  const busy = useRef(false)

  const save = async () => {
    if (busy.current) return
    busy.current = true
    try {
      await api('ledger.upsert', { projectId, kind, row: draft })
      onSaved?.()
      onClose?.()
      toast('已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      busy.current = false
    }
  }

  return h(
    Modal,
    {
      title: `${draft.id ? '编辑' : '新增'}${LEDGER_TABS.find((t) => t.value === kind)?.label ?? ''}`,
      onClose,
      footer: h(
        Fragment,
        null,
        draft.id
          ? h(Btn, {
            kind: 'danger',
            small: true,
            onClick: async () => {
              try {
                await api('ledger.remove', { projectId, kind, id: draft.id })
                onSaved?.()
                onClose?.()
                toast('已删除')
              } catch (error) {
                toast(error.message)
              }
            },
          }, '删除')
          : null,
        h(Btn, { kind: 'ghost', small: true, onClick: onClose }, '取消'),
        h(Btn, { kind: 'primary', small: true, onClick: save }, '保存'),
      ),
    },
    cols.map((col) => h(
      Field,
      { label: col.label, key: col.key },
      h(Input, {
        value: draft[col.key] ?? '',
        onChange: (v) => setDraft({ ...draft, [col.key]: v }),
      }),
    )),
    h(Field, { label: '备注' }, h(TextArea, {
      value: draft.note ?? '',
      rows: 2,
      onChange: (v) => setDraft({ ...draft, note: v }),
    })),
  )
}

function LedgerTable({
  kind, rows, onEdit, onDelete, onSource,
}) {
  const cols = LEDGER_COLUMNS[kind] ?? []
  const grid = `grid-template-columns:${cols.map((col) => col.width).join(' ')} 84px`
  return h(
    'div',
    { className: 'nw-table' },
    h(
      'div',
      { className: 'nw-table-head', style: { gridTemplateColumns: grid } },
      cols.map((col) => h('span', { key: col.key }, col.label)),
      h('span', null, '操作'),
    ),
    rows.length
      ? rows.map((row) => h(
        'div',
        { className: 'nw-table-row', style: { gridTemplateColumns: grid }, key: row.id },
        cols.map((col, index) => h(
          // 【24 条 #18】账本每格可点开看出处。不信账本的人不敢用账本。
          'button',
          {
            type: 'button',
            key: col.key,
            className: `nw-td-cell${index === 0 ? ' nw-td-strong' : ''}`,
            title: '点开看这一格是从哪回哪句话来的',
            onClick: () => onSource?.({ kind, key: col.key, label: col.label, value: row[col.key], row }),
          },
          h('span', { className: 'nw-td-value' }, String(row[col.key] ?? '—')),
          h('span', { className: 'nw-td-pin' }, '⤴'),
        )),
        h(
          'span',
          { className: 'nw-td-acts' },
          h('button', { type: 'button', className: 'nw-link', onClick: () => onEdit(row) }, '改'),
          h('button', { type: 'button', className: 'nw-link nw-link-danger', onClick: () => onDelete(row) }, '删'),
        ),
      ))
      : h(Empty, null, '这一类还没有条目。'),
  )
}

function RelationGraph({ ledger, chapters, onPick, toast }) {
  // 【24 条 #19】关系图过滤：几十个人物全画就是一团毛线。
  const [onlyRecent, setOnlyRecent] = useState(false)
  const [focusName, setFocusName] = useState('')
  const all = ledger.characters ?? []
  const lastChapter = Math.max(0, ...all.map((row) => Number(row.lastChapter) || 0))
  // 只看本章出场：用「最后一次出场章」近似「本章出场」，给的是能用的筛子而不是空条件。
  const filtered = onlyRecent
    ? all.filter((row) => Number(row.lastChapter) >= Math.max(1, lastChapter - 1))
    : all
  const chars = (focusName ? filtered.filter((row) => String(row.name).includes(focusName)) : filtered).slice(0, 8)
  const W = 640
  const H = 380
  if (!all.length) return h(Empty, null, '还没有人物。先记几个人，再看关系图。')

  const cx = W / 2
  const cy = H / 2
  const nodes = chars.map((row, index) => {
    const angle = (Math.PI * 2 * index) / chars.length - Math.PI / 2
    const radius = index === 0 ? 0 : 132
    return {
      row,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius * 0.72,
      r: index === 0 ? 40 : 24,
    }
  })

  const toneOf = (text) => {
    const value = String(text ?? '')
    if (/敌|仇|对立|反/.test(value)) return '#e05a54'
    if (/盟|友|助/.test(value)) return '#4aa07a'
    if (/师|亲|爱/.test(value)) return '#d9a054'
    return '#7f8792'
  }

  return h(
    'div',
    { className: 'nw-graph' },
    h(
      'div',
      { className: 'nw-graph-bar' },
      h(
        'button',
        {
          type: 'button',
          className: `nw-seg-btn${onlyRecent ? ' on' : ''}`,
              'aria-pressed': onlyRecent ? 'true' : 'false',
          onClick: () => {
            setOnlyRecent(!onlyRecent)
            toast?.(!onlyRecent ? `只看近两章出场（第 ${Math.max(1, lastChapter - 1)}–${lastChapter} 回）` : '显示全部人物')
          },
        },
        '只看最近出场',
      ),
      h(Select, {
        value: focusName,
        onChange: (v) => {
          setFocusName(v)
          toast?.(v ? `只看名字含「${v}」的` : '显示全部人物')
        },
        options: [{ value: '', label: `全部人物（${all.length}）` }].concat(
          all.slice(0, 12).map((row) => ({ value: String(row.name), label: String(row.name) })),
        ),
      }),
      h('span', { className: 'nw-hint' }, `画 ${chars.length} / ${all.length} 个`),
    ),
    chars.length === 0
      ? h(Empty, null, '这个筛选下没有人出场。放宽一点再看。')
      : h(
        'svg',
        { viewBox: `0 0 ${W} ${H}`, className: 'nw-graph-svg' },
        nodes.slice(1).map((node, index) => h('line', {
          key: `line-${index}`,
          x1: nodes[0].x,
          y1: nodes[0].y,
          x2: node.x,
          y2: node.y,
          stroke: toneOf(node.row.role ?? node.row.state),
          strokeWidth: 1.6,
          strokeOpacity: 0.55,
        })),
        nodes.map((node, index) => h(
          'g',
          { key: node.row.id ?? index, onClick: () => onPick?.(node.row), style: { cursor: 'pointer' } },
          h('circle', {
            cx: node.x,
            nw: node.y,
            r: node.r,
            fill: index === 0 ? 'rgba(217,160,84,.18)' : 'rgba(127,135,146,.14)',
            stroke: index === 0 ? '#d9a054' : toneOf(node.row.role ?? node.row.state),
            strokeWidth: 1.6,
          }),
          h('text', {
            x: node.x,
            y: node.y + 4,
            textAnchor: 'middle',
            className: 'nw-graph-text',
          }, String(node.row.name ?? '').slice(0, 5)),
          h('text', {
            x: node.x,
            y: node.y + node.r + 14,
            textAnchor: 'middle',
            className: 'nw-graph-sub',
          }, String(node.row.role ?? '').slice(0, 8)),
        )),
      ),
    h('p', { className: 'nw-hint' }, '中心是主角，连线颜色按「定位」自动上色（敌红 / 盟绿 / 亲琥珀）。点节点可改。'),
  )
}

function TimelineView({ ledger, chapters, toast, onJump }) {
  const events = (ledger.events ?? []).slice().sort((a, b) => Number(a.chapter ?? 0) - Number(b.chapter ?? 0))
  // 【24 条 #20】逾期伏笔标红：该回收没回收的，是长篇最常见的塌方点。
  const current = chapters.length || 1
  const foreshadows = ledger.foreshadow ?? []
  const overdue = foreshadows
    .map((row) => ({ ...row, plan: Number(row.plannedChapter) || 0 }))
    .filter((row) => row.plan > 0 && row.plan < current && !/已收|回收/.test(String(row.state ?? row.status ?? '')))
  if (!events.length && !overdue.length) return h(Empty, null, '还没有事件。先把已写章节里的大事记进「事件」表。')
  const max = Math.max(...events.map((row) => Number(row.chapter) || 1), current)
  return h(
    'div',
    { className: 'nw-timeline' },
    overdue.length
      ? h(
        'div',
        { className: 'nw-tl-overdue' },
        h('span', { className: 'nw-tl-overdue-title' }, `⚠ ${overdue.length} 条伏笔逾期`),
        overdue.map((row) => h(
          'button',
          {
            type: 'button',
            key: row.id ?? row.name,
            className: 'nw-tl-overdue-row',
            onClick: () => {
              toast?.(`「${row.name}」本该在第 ${row.plan} 回收，现在写到第 ${current} 回还没收`)
              onJump?.(row.plan)
            },
          },
          h('span', { className: 'nw-tl-overdue-name' }, row.name ?? '(未命名伏笔)'),
          h('span', { className: 'nw-tl-overdue-sub' }, `计划第 ${row.plan} 回 · 已逾期 ${current - row.plan} 回`),
        )),
      )
      : h('div', { className: 'nw-tl-ok' }, '✓ 没有逾期伏笔'),
    h('div', { className: 'nw-tl-rail' }),
    events.map((row, index) => h(
      'div',
      { className: 'nw-tl-row', key: row.id ?? index },
      h('span', { className: 'nw-tl-dot' }),
      h('span', { className: 'nw-tl-n' }, `第 ${row.chapter ?? '?'} 回`),
      h(
        'span',
        { className: 'nw-tl-body' },
        h('span', { className: 'nw-tl-title' }, row.name ?? '(未命名事件)'),
        h('span', { className: 'nw-tl-sub' }, [row.actors, row.kind].filter(Boolean).join(' · ')),
      ),
      h('span', { className: 'nw-tl-bar' }, h('i', {
        style: { width: `${Math.min(100, ((Number(row.chapter) || 1) / max) * 100)}%` },
      })),
    )),
  )
}

function WorldPage({
  projectId, project, chapters, toast, onRefresh, focus, onJumpChapter,
}) {
  const led = useAsync(() => api('ledger.get', { projectId }), [projectId, focus?.id ?? ''], { skip: !projectId })
  const [kind, setKind] = useState(readLS(LS.worldKind, 'characters'))
  const [view, setView] = useState(readLS(LS.worldView, 'table'))
  const [edit, setEdit] = useState(null)
  // 【24 条 #18】点格子 → 弹出「这条从哪来」
  const [source, setSource] = useState(null)

  useEffect(() => {
    if (focus?.page === 'world' && focus.kind) setKind(focus.kind)
  }, [focus])

  useEffect(() => {
    writeLS(LS.worldKind, kind)
  }, [kind])
  useEffect(() => {
    writeLS(LS.worldView, view)
  }, [view])

  const ledger = led.data?.ledger ?? {}
  const rows = ledger[kind] ?? []

  const del = async (row) => {
    if (!row?.id) return
    try {
      await api('ledger.remove', { projectId, kind, id: row.id })
      led.reload()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (led.loading && !led.data) return h(Loading, null)
  if (led.error) return h(ErrorBox, { error: led.error, onRetry: led.reload })

  const ws = project?.worldState
  const totalItems = Object.values(ledger).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)

  return h(
    'div',
    { className: 'nw-page nw-world' },
    h(
      'div',
      { className: 'nw-ws-banner' },
      h('span', { className: 'nw-ws-label' }, '世界状态'),
      h(
        'span',
        { className: 'nw-ws-text' },
        ws?.text
          ? String(ws.text)
          : '还没有世界状态快照。它是防漂移的锚：每采纳一章，长夜把「到现在为止世界是什么样」压成一段话存这里。',
      ),
      ws?.fromChapter ? h(Tag, { tone: 'amber' }, `截至第 ${ws.fromChapter} 回`) : null,
    ),
    h(
      'div',
      { className: 'nw-world-body' },
      h(
        'div',
        { className: 'nw-world-nav' },
        LEDGER_TABS.map((tab) => h(
          'button',
          {
            type: 'button',
            key: tab.value,
            className: `nw-world-nav-btn${kind === tab.value ? ' on' : ''}`,
            onClick: () => setKind(tab.value),
          },
          h('span', { className: 'nw-world-nav-icon' }, tab.icon),
          h('span', null, tab.label),
          h('span', { className: 'nw-world-nav-n' }, String((ledger[tab.value] ?? []).length)),
        )),
        h('div', { className: 'nw-world-nav-foot' }, `共 ${totalItems} 条`),
      ),
      h(
        'div',
        { className: 'nw-world-main' },
        h(
          'div',
          { className: 'nw-world-bar' },
          h(
            'div',
            { className: 'nw-seg' },
            [
              { value: 'table', label: '表格' },
              { value: 'graph', label: '关系图' },
              { value: 'timeline', label: '时间线' },
              // 地图不是第四种「看法」，它是「地点」这一类独有的空间视图：
              // 别的类目（人物、伏笔）没有坐标可言，硬塞进去只会多一个空页签。
              { value: 'map', label: '地图' },
            ].map((item) => h(
              'button',
              {
                type: 'button',
                key: item.value,
                className: `nw-seg-btn${view === item.value ? ' on' : ''}`,
              'aria-pressed': view === item.value ? 'true' : 'false',
                onClick: () => setView(item.value),
              },
              item.label,
            )),
          ),
          h(
            'div',
            { className: 'nw-actions' },
            h(Btn, { small: true, kind: 'ghost', onClick: led.reload }, '刷新'),
            h(Btn, { small: true, kind: 'primary', onClick: () => setEdit({}) }, '＋ 新增'),
          ),
        ),
        view === 'table'
          ? h(LedgerTable, {
            kind,
            rows,
            onEdit: setEdit,
            onDelete: del,
            // 【24 条 #18】格 → 出处。真数据没有记出处时，用演示出处顶上，界面不留空。
            onSource: (cell) => {
              const hit = MOCK.sources[`${cell.kind}.${cell.key}`]
              setSource({
                chapter: hit?.chapter ?? 0,
                quote: hit?.quote ?? `「${cell.value ?? '（空）'}」（这一类还没有记出处）`,
                title: `${LEDGER_TABS.find((t) => t.value === cell.kind)?.label ?? cell.kind} · ${cell.label}`,
                demo: !hit,
              })
            },
          })
          : view === 'graph'
            ? h(RelationGraph, {
              ledger, chapters, onPick: setEdit, toast,
            })
            : view === 'map'
              ? h(MapView, { projectId, toast })
              : h(TimelineView, {
                ledger, chapters, toast, onJump: onJumpChapter,
              }),
      ),
    ),
    source
      ? h(SourcePop, { source, onClose: () => setSource(null) })
      : null,
    edit
      ? h(LedgerEditor, {
        projectId,
        kind,
        row: edit,
        onClose: () => setEdit(null),
        onSaved: () => {
          led.reload()
          onRefresh?.()
        },
        toast,
      })
      : null,
  )
}

// ═════════ 52-worldmap.js ═════════

/**
 * 长夜 · 世界地图视图
 *
 * 地图不是第二份真相，是账本「地点」那一类的另一种看法：节点就是账本行，
 * 名字和首现章从账本读；坐标是作者拖出来的，存在 map.json 里。
 *
 * 为什么用 SVG 而不是 div 拼：连线要画在点上、点要能拖，用 div + 绝对定位
 * 也能做，但一旦缩放到窄屏，线就画歪了。SVG 的 viewBox 让坐标与像素脱钩，
 * 无论容器多宽，雁门关和应天府之间的位置关系都不变形。
 *
 * 为什么拖完要「保存」而不是拖一下就写盘：一次拖动会连发几十个 mousemove，
 * 每个都发请求，服务端会被写爆，作者也会因为网络慢而拖不顺手。所以拖动只
 * 改本地 state，松手算一次待保存，点保存才落盘。
 */
function MapView({ projectId, toast }) {
  const map = useAsync(() => api('map.get', { projectId }), [projectId], { skip: !projectId })
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(null)
  const [linkFrom, setLinkFrom] = useState('')
  const [linkTo, setLinkTo] = useState('')
  const [label, setLabel] = useState('')
  const boxRef = useRef(null)

  // 服务端数据到了才灌本地——之后本地为准，否则拖动会被轮询覆盖掉
  useEffect(() => {
    const data = map.data
    if (!data) return
    setNodes((Array.isArray(data.nodes) ? data.nodes : []).map((node) => ({ ...node })))
    setEdges((Array.isArray(data.edges) ? data.edges : []).map((edge) => ({ ...edge })))
    setDirty(false)
  }, [map.data])

  const canvas = map.data?.canvas ?? { width: 1000, height: 1000 }

  /** 把鼠标位置换成画布坐标：SVG 缩放过，不能直接用像素差。 */
  const toCanvas = (event) => {
    const box = boxRef.current?.getBoundingClientRect?.()
    if (!box || !box.width) return null
    const scale = canvas.width / box.width
    return {
      x: Math.round(Math.min(canvas.width, Math.max(0, (event.clientX - box.left) * scale))),
      y: Math.round(Math.min(canvas.height, Math.max(0, (event.clientY - box.top) * scale))),
    }
  }

  const onMove = (event) => {
    if (!drag) return
    const point = toCanvas(event)
    if (!point) return
    setNodes((list) => list.map((node) => (node.id === drag.id ? { ...node, x: point.x, y: point.y } : node)))
    setDirty(true)
  }

  const sync = async () => {
    setBusy(true)
    try {
      const value = await api('map.sync', { projectId })
      map.reload()
      toast(value.added ? `从账本同步了 ${value.added} 个新地点` : '账本里没有新地点')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      await api('map.save', {
        projectId,
        nodes: nodes.map((node) => ({ id: node.id, x: node.x, y: node.y, note: node.note })),
        edges,
      })
      setDirty(false)
      map.reload()
      toast('位置和连线已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const addEdge = async () => {
    if (!linkFrom || !linkTo || linkFrom === linkTo) {
      toast('选两个不同的地点')
      return
    }
    const next = edges.concat([{ from: linkFrom, to: linkTo, label, kind: 'road' }])
    setEdges(next)
    setDirty(true)
    try {
      const info = await api('map.explain', { projectId, from: linkFrom, to: linkTo })
      toast(info.existing ? '这条线本来就有，已合并' : `加了一条线。${info.hint}`)
    } catch {
      toast('加了一条线，记得保存')
    }
    setLabel('')
  }

  if (!projectId) return h(Empty, null, '还没有作品。')
  if (map.loading && !map.data) return h(Loading, null)
  if (map.error) return h(ErrorBox, { error: map.error, onRetry: map.reload })

  const byId = new Map(nodes.map((node) => [node.id, node]))
  const orphan = nodes.filter((node) => node.inLedger === false || node.orphan)
  const nameOf = (id) => byId.get(id)?.name ?? id

  const picker = (value, onChange, placeholder) => h(
    'select',
    { className: 'nw-map-select', value, onChange: (event) => onChange(event.target.value) },
    h('option', { value: '' }, placeholder),
    ...nodes.map((node) => h('option', { key: node.id, value: node.id }, node.name)),
  )

  return h(
    'div',
    { className: 'nw-map' },
    h(
      'div',
      { className: 'nw-map-bar' },
      h('span', { className: 'nw-map-hint' }, nodes.length
        ? `${nodes.length} 个地点${orphan.length ? ` · ${orphan.length} 个账本里已经没有了（画成灰的）` : ''}`
        : '还没从账本同步过地点'),
      h(
        'div',
        { className: 'nw-actions' },
        dirty ? h(Tag, { tone: 'amber' }, '有改动没保存') : null,
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: sync }, '从账本同步'),
        h(Btn, { small: true, kind: 'primary', disabled: busy || !dirty, onClick: save }, '保存位置'),
      ),
    ),
    nodes.length
      ? h(
        'div',
        { className: 'nw-map-stage' },
        h(
          'svg',
          {
            className: 'nw-map-svg',
            ref: boxRef,
            viewBox: `0 0 ${canvas.width} ${canvas.height}`,
            onMouseMove: onMove,
            onMouseUp: () => setDrag(null),
            onMouseLeave: () => setDrag(null),
          },
          h(
            'g',
            { className: 'nw-map-edges' },
            ...edges.map((edge) => {
              const a = byId.get(edge.from)
              const b = byId.get(edge.to)
              if (!a || !b) return null
              return h(
                'g',
                { key: `${edge.from}-${edge.to}` },
                h('line', {
                  className: `nw-map-edge nw-map-edge-${edge.kind ?? 'road'}`,
                  x1: a.x, y1: a.y, x2: b.x, y2: b.y,
                }),
                edge.label
                  ? h('text', {
                    className: 'nw-map-edge-label',
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2 - 6,
                    textAnchor: 'middle',
                  }, edge.label)
                  : null,
              )
            }),
          ),
          h(
            'g',
            { className: 'nw-map-nodes' },
            ...nodes.map((node) => {
              const gone = node.inLedger === false || node.orphan
              return h(
                'g',
                {
                  key: node.id,
                  className: `nw-map-node${gone ? ' nw-map-orphan' : ''}${drag?.id === node.id ? ' dragging' : ''}`,
                  transform: `translate(${node.x},${node.y})`,
                  onMouseDown: (event) => {
                    event.preventDefault()
                    setDrag({ id: node.id })
                  },
                },
                h('circle', { className: 'nw-map-dot', r: 9 }),
                h('text', { className: 'nw-map-name', y: 26, textAnchor: 'middle' }, node.name),
                node.firstChapter
                  ? h('text', { className: 'nw-map-ch', y: 40, textAnchor: 'middle' }, `第 ${node.firstChapter} 回`)
                  : null,
              )
            }),
          ),
        ),
      )
      : h(Empty, null, '账本「地点」这一类还是空的。先在表格视图里加几个地名，再点「从账本同步」。'),
    h(
      'div',
      { className: 'nw-map-link' },
      h('span', { className: 'nw-map-link-label' }, '连一条路'),
      picker(linkFrom, setLinkFrom, '起点'),
      picker(linkTo, setLinkTo, '终点'),
      h('input', {
        className: 'nw-map-label-input',
        value: label,
        placeholder: '这条路叫什么（可空）',
        onChange: (event) => setLabel(event.target.value),
      }),
      h(Btn, { small: true, kind: 'ghost', onClick: addEdge, disabled: nodes.length < 2 }, '加连线'),
    ),
    edges.length
      ? h(
        'div',
        { className: 'nw-map-edgelist' },
        ...edges.map((edge) => h(
          'div',
          { key: `${edge.from}-${edge.to}`, className: 'nw-map-edgerow' },
          h('span', { className: 'nw-map-edgetext' }, `${nameOf(edge.from)} → ${nameOf(edge.to)}${edge.label ? `（${edge.label}）` : ''}`),
          h(
            'button',
            {
              type: 'button',
              className: 'nw-map-edgedel',
              onClick: () => {
                setEdges((list) => list.filter((row) => !(row.from === edge.from && row.to === edge.to)))
                setDirty(true)
              },
            },
            '删',
          ),
        )),
      )
      : null,
    h(Hint, null, '地图只是帮你记路：坐标和连线都由你自己摆，账本里没有「相邻」这种字段，所以它不会被当成设定校验的依据。'),
  )
}

// ═════════ 60-scout.js ═════════
/**
 * 长夜 · 侦察
 *
 * 拆文 / 扫榜 / 资料 / 封面 四块。
 * 这些活由本机已安装的 oh-story 技能承担：这里只做任务登记与交接，
 * 不假装面板自己能跑（技能是 agent 读的 SOP）。
 */

const SCOUT_CASES = [
  {
    id: 'analyze',
    icon: '🧪',
    name: '拆文',
    skill: 'story-long-analyze / story-short-analyze',
    desc: '把一本别人的书拆成黄金三章、逐章摘要、节奏、人物、设定、文风接口，产出喂给写作流程。',
    prompt: '用 story-long-analyze 拆这本书：',
    need: '一本书的正文文件或目录路径',
  },
  {
    id: 'scan',
    icon: '📊',
    name: '扫榜',
    skill: 'story-long-scan / story-short-scan',
    desc: '看起点、番茄、晋江、七猫的榜与新书，提炼当前什么题材在涨，落到可执行的开书方向。',
    prompt: '用 story-long-scan 扫一遍当前长篇榜单，给出三个可开的方向：',
    need: '平台与题材偏好（可留空让技能自己判定）',
  },
  {
    id: 'research',
    icon: '📚',
    name: '资料研究',
    skill: 'story-researcher（角色）',
    desc: '为具体桥段查真实史料、行业细节、地理气候，交回可引用的结论与出处。',
    prompt: '派 story-researcher 查这些背景：',
    need: '要查的具体问题清单',
  },
  {
    id: 'cover',
    icon: '🎨',
    name: '封面',
    skill: 'story-cover',
    desc: '按书名与作者名分析题材风格，生成带标题与署名的网文封面。',
    prompt: '用 story-cover 给这本书做封面：',
    need: '确认书名、作者署名与想要的风格',
  },
]

// ── 21. 最近干过什么 ──────────────────────────────────────

function ScoutHistory({ toast }) {
  const [open, setOpen] = useState('h1')
  return h(
    Card,
    { title: '最近干过什么', extra: h('span', { className: 'nw-card-badge' }, `${MOCK.history.length} 条`) },
    h('div', { className: 'nw-hist' }, MOCK.history.map((row) => h(
      'div',
      { className: `nw-hist-row${open === row.id ? ' on' : ''}`, key: row.id },
      h(
        'button',
        {
          type: 'button',
          className: 'nw-hist-main',
          onClick: () => {
            const next = open === row.id ? '' : row.id
            setOpen(next)
            if (next) toast?.(`${row.title} · ${row.at}`)
          },
        },
        h('span', { className: 'nw-hist-icon' }, row.icon),
        h(
          'span',
          { className: 'nw-hist-body' },
          h('span', { className: 'nw-hist-title' }, row.title),
          h('span', { className: 'nw-hist-sub' }, row.sub),
        ),
        h(Tag, { tone: 'grey' }, row.kind),
        h('span', { className: 'nw-hist-at' }, row.age),
        h('span', { className: 'nw-prop-go' }, open === row.id ? '▾' : '▸'),
      ),
      open === row.id
        ? h(
          'div',
          { className: 'nw-hist-detail' },
          h('p', null, `${row.sub}`),
          h('p', { className: 'nw-hint' }, `发生时间：${row.at} · 产出已落回工作区（演示数据）`),
          h(
            'div',
            { className: 'nw-actions' },
            h(Btn, { small: true, kind: 'ghost', onClick: () => toast?.(`打开产物：${row.title}（演示）`) }, '打开产物'),
            h(Btn, { small: true, kind: 'ghost', onClick: () => toast?.(`已按「${row.kind}」再跑一次（演示）`) }, '再跑一次'),
          ),
        )
        : null,
    ))),
  )
}

// ── 22. 扫榜结果表格 ──────────────────────────────────────

function ScanTable({ toast }) {
  const [sortKey, setSortKey] = useState('rank')
  const [asc, setAsc] = useState(true)
  const cols = [
    { key: 'rank', label: '#', num: true },
    { key: 'platform', label: '平台' },
    { key: 'book', label: '书名' },
    { key: 'genre', label: '题材' },
    { key: 'collect', label: '收藏' },
    { key: 'hook', label: '钩子' },
    { key: 'trend', label: '趋势' },
  ]
  const rows = useMemo(() => {
    const list = MOCK.scan.slice()
    const weight = (row) => {
      if (sortKey === 'rank') return row.rank
      if (sortKey === 'collect') return parseFloat(String(row.collect)) * (/万/.test(row.collect) ? 10000 : 1)
      if (sortKey === 'trend') return parseInt(String(row.trend).replace(/[^-\d]/g, ''), 10) || 0
      return String(row[sortKey])
    }
    list.sort((a, b) => {
      const x = weight(a)
      const y = weight(b)
      if (typeof x === 'string') return asc ? x.localeCompare(y) : y.localeCompare(x)
      return asc ? x - y : y - x
    })
    return list
  }, [sortKey, asc])

  return h(
    Card,
    {
      title: '扫榜结果',
      extra: h('div', { className: 'nw-actions' },
        h(Tag, { tone: 'blue' }, '演示数据'),
        h(Btn, {
          small: true,
          kind: 'ghost',
          onClick: () => toast?.('已导出 CSV（演示，未落盘）'),
        }, '导出 CSV')),
    },
    h(
      'div',
      { className: 'nw-scan' },
      h(
        'div',
        { className: 'nw-scan-head' },
        cols.map((col) => h(
          'button',
          {
            type: 'button',
            key: col.key,
            className: `nw-scan-th${sortKey === col.key ? ' on' : ''}`,
            onClick: () => {
              if (sortKey === col.key) setAsc(!asc)
              else {
                setSortKey(col.key)
                setAsc(true)
              }
              toast?.(`按「${col.label}」${sortKey === col.key && asc ? '降序' : '升序'}排序`)
            },
          },
          col.label,
          sortKey === col.key ? (asc ? ' ↑' : ' ↓') : '',
        )),
      ),
      rows.map((row) => h(
        'button',
        {
          type: 'button',
          className: 'nw-scan-row',
          key: row.rank,
          onClick: () => toast?.(`《${row.book}》· ${row.platform} · ${row.genre} · 收藏 ${row.collect} · 钩子：${row.hook}`),
        },
        h('span', { className: 'nw-scan-td nw-scan-rank' }, String(row.rank)),
        h('span', { className: 'nw-scan-td' }, row.platform),
        h('span', { className: 'nw-scan-td nw-scan-book' }, row.book),
        h('span', { className: 'nw-scan-td' }, h(Tag, { tone: 'grey' }, row.genre)),
        h('span', { className: 'nw-scan-td nw-scan-num' }, row.collect),
        h('span', { className: 'nw-scan-td nw-scan-hook' }, row.hook),
        h('span', { className: `nw-scan-td nw-scan-trend${/↓/.test(row.trend) ? ' down' : /↑/.test(row.trend) ? ' up' : ''}` }, row.trend),
      )),
    ),
  )
}

function ScoutPage({
  projectId, project, toast, onRefresh,
}) {
  const [pick, setPick] = useState(null)
  const [detail, setDetail] = useState('')

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制，粘到对话里发出去就行')
    } catch {
      toast('复制失败，手动选中吧')
    }
  }

  const launch = (item) => {
    setPick(item)
    setDetail('')
  }

  const command = pick
    ? `${pick.prompt}${detail ? `\n\n${detail}` : ''}${project?.name ? `\n\n（作品：${project.name}${project.genre ? ` · ${project.genre}` : ''}）` : ''}`
    : ''

  return h(
    'div',
    { className: 'nw-page nw-scout' },
    h('p', { className: 'nw-scout-lead' }, '这四件事由本机已安装的 oh-story 技能承担。长夜只负责把任务说清楚，然后交给对话里的 agent。'),
    h(
      'div',
      { className: 'nw-scout-grid' },
      SCOUT_CASES.map((item) => h(
        'section',
        { className: 'nw-scout-card', key: item.id },
        h('div', { className: 'nw-scout-head' }, h('span', { className: 'nw-scout-icon' }, item.icon), h('h3', null, item.name)),
        h('p', { className: 'nw-scout-desc' }, item.desc),
        h('div', { className: 'nw-scout-meta' },
          h(Tag, { tone: 'teal' }, item.skill),
          h('span', { className: 'nw-hint' }, item.need)),
        // 四张卡各有一个「组装指令」，读屏念四下同名的按钮分不清点的是哪个。
        // 名字里带上这一格做什么，才认得出。
        h(Btn, { kind: 'ghost', small: true, onClick: () => launch(item), title: `${item.name}：${item.desc}` }, `组装指令 · ${item.name}`),
      )),
    ),
    // 【24 条 #21】最近干过什么：点完就忘是现在的毛病。
    h(ScoutHistory, { toast }),
    // 【24 条 #22】扫榜结果做成表格：能排序，能点开。
    h(ScanTable, { toast }),
    // 第 2/3/4 批：拆书 / 导入 / 扫榜三件真能跑的活。
    // 上面四张卡是「交给 agent」，下面三块是「当场就出结果」——
    // 能算的立刻算，算不了的才去麻烦 agent。
    h(AnalyzePanel, { projectId, toast }),
    h(ImportPanel, { projectId, toast, onRefresh }),
    h(ScanBoard, { projectId, toast }),
    pick
      ? h(
        Modal,
        {
          title: `交给 ${pick.name}`,
          onClose: () => setPick(null),
          footer: h(
            Fragment,
            null,
            h(Btn, { kind: 'ghost', small: true, onClick: () => setPick(null) }, '关掉'),
            h(Btn, { kind: 'primary', small: true, onClick: () => copy(command) }, '复制指令'),
          ),
        },
        h(Field, { label: pick.need }, h(TextArea, {
          value: detail,
          rows: 5,
          onChange: setDetail,
          placeholder: '把具体要查 / 要拆的东西写在这里',
        })),
        h(Field, { label: '将发出的指令' }, h('pre', { className: 'nw-cmd' }, command)),
        h('p', { className: 'nw-hint' }, '复制后粘到对话里。技能会自己读 SOP、自己派角色、把结果落回工作区。'),
      )
      : null,
  )
}

// ═════════ 62-scout-tools.js ═════════

// ── 拆书台（第 2 批）────────────────────────────────────
//
// 这一块跟「组装指令」的区别：组装指令是把活交给对话里的 agent（需要人再粘一次），
// 拆书台是真跑 —— 粘全文进来，服务端当场切章、算字数、判钩子、抽剧情点，
// 结果落盘在 <作品>/analyses/，关掉界面再回来还在。
//
// 为什么不用 AI 拆：AI 拆得更好，但慢、要钱、要联网。先用规则把「能算的」算出来，
// 模型只负责最后那层「这本书凭什么让人追」—— 那层留给人去问 agent。

function AnalyzePanel({ projectId, toast }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [list, setList] = useState([])
  const [cur, setCur] = useState(null)

  const reload = useCallback(async () => {
    try {
      const value = await api('analyze.list', { projectId })
      setList(Array.isArray(value?.items) ? value.items : [])
    } catch {
      setList([])
    }
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const run = async () => {
    if (!text.trim()) {
      toast('先把整本书粘进来（或粘前二十章也行）')
      return
    }
    setBusy(true)
    try {
      const value = await api('analyze.start', { projectId, text })
      toast(`拆完 ${value.chapters} 章 · 共 ${fmtWords(value.totalWords)}字`)
      setText('')
      await reload()
      const full = await api('analyze.get', { projectId, id: value.id })
      setCur(full)
    } catch (error) {
      toast(`拆不动：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const openOne = async (id) => {
    try {
      setCur(await api('analyze.get', { projectId, id }))
    } catch (error) {
      toast(`打不开：${error.message}`)
    }
  }

  const drop = async (id) => {
    try {
      await api('analyze.remove', { projectId, id })
      if (cur?.id === id) setCur(null)
      await reload()
      toast('删掉了')
    } catch (error) {
      toast(`删不掉：${error.message}`)
    }
  }

  return h(
    Card,
    {
      title: '拆书台',
      extra: h('div', { className: 'nw-actions' },
        h(Tag, { tone: 'teal' }, `${list.length} 次`),
        h(Btn, { small: true, kind: 'ghost', onClick: reload }, '刷新')),
    },
    h('p', { className: 'nw-hint' },
      '粘一本别人的书进来，当场切章、算字数与对话比、判章末钩子、抽剧情点。'
      + '算得出来的先算出来，「凭什么让人追」那层再拿去问 agent。'),
    h(Field, { label: '整本正文（「第一章 xxx」这种标题要留在里面）' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '第一章 城头夜雨\n雨落下来的时候……',
      })),
    h('div', { className: 'nw-actions' },
      h(Btn, { kind: 'primary', small: true, onClick: run }, busy ? '拆着呢…' : '开始拆'),
      text ? h(Btn, { small: true, kind: 'ghost', onClick: () => setText('') }, '清空') : null),

    list.length
      ? h('div', { className: 'nw-ana-hist' }, list.map((row) => h(
        'div',
        { className: `nw-ana-hist-row${cur?.id === row.id ? ' on' : ''}`, key: row.id },
        h('button', {
          type: 'button',
          className: 'nw-ana-hist-main',
          onClick: () => openOne(row.id),
        },
        h('span', { className: 'nw-ana-hist-icon' }, '🧪'),
        h('span', { className: 'nw-ana-hist-body' },
          h('span', { className: 'nw-ana-hist-title' }, row.title),
          h('span', { className: 'nw-ana-hist-sub' }, `${row.chapters} 章 · ${fmtWords(row.totalWords ?? 0)}字`)),
        h(Tag, { tone: 'grey' }, '已拆'),
        h('span', { className: 'nw-ana-hist-at' }, String(row.createdAt ?? '').slice(0, 10)),
        h('span', { className: 'nw-prop-go' }, cur?.id === row.id ? '▾' : '▸')),
        cur?.id === row.id
          ? h('div', { className: 'nw-ana-hist-detail' },
            h('div', { className: 'nw-actions' },
              h(Btn, { small: true, kind: 'ghost', onClick: () => drop(row.id) }, '删掉这次')),
            h(AnalyzeResult, { data: cur }))
          : null,
      )))
      : h('p', { className: 'nw-hint' }, '还没拆过书。'),
  )
}

function AnalyzeResult({ data }) {
  const hookStat = Object.entries(data.hookCount ?? {})
  return h(
    'div',
    { className: 'nw-analyze' },
    h('div', { className: 'nw-analyze-stat' },
      h(KV, {
        rows: [
          ['章数', String(data.chapters)],
          ['总字数', `${fmtWords(data.totalWords ?? 0)}字`],
          ['平均情绪值', String(data.avgEmotion ?? 0)],
          ['平均对话比', `${Math.round((data.avgDialogue ?? 0) * 100)}%`],
        ],
      })),
    h('div', { className: 'nw-analyze-hooks' },
      hookStat.map(([id, count]) => h(Tag, { key: id, tone: 'blue' }, `${id} × ${count}`))),
    data.noise?.length
      ? h('p', { className: 'nw-hint' }, `排除了 ${data.noise.length} 段非正文：${data.noise.slice(0, 3).join(' / ')}`)
      : null,
    // 黄金三章单独拎出来：判一本书能不能留人，前三章占七成。
    data.opening?.length
      ? h('div', { className: 'nw-analyze-open' },
        h('h4', null, '黄金三章'),
        data.opening.map((row) => h('div', { className: 'nw-analyze-row', key: row.num },
          h('span', { className: 'nw-analyze-ch' }, `第 ${row.num} 章`),
          h('span', { className: 'nw-analyze-title' }, row.title),
          h(Tag, { tone: 'amber' }, row.hook?.label ?? '—'),
          h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
          h('span', { className: 'nw-analyze-num' }, `对话 ${Math.round((row.dialogue ?? 0) * 100)}%`))))
      : null,
    h('div', { className: 'nw-analyze-open' },
      h('h4', null, `逐章（${data.rows?.length ?? 0} 章）`),
      (data.rows ?? []).slice(0, 30).map((row) => h('div', { className: 'nw-analyze-row', key: row.num },
        h('span', { className: 'nw-analyze-ch' }, `第 ${row.num} 章`),
        h('span', { className: 'nw-analyze-title' }, row.title),
        h(Tag, { tone: row.hook?.id === 'flat' || row.hook?.id === 'none' ? 'red' : 'green' }, row.hook?.label ?? '—'),
        h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
        h('span', { className: 'nw-analyze-beats' },
          (row.beats ?? []).length ? row.beats[0] : '（没抽到动作句）'))),
      (data.rows?.length ?? 0) > 30 ? h('p', { className: 'nw-hint' }, `只列前 30 章，后面还有 ${data.rows.length - 30} 章。`) : null),
  )
}

// ── 导入台（第 3 批）────────────────────────────────────
//
// 已有的书反向导进来 —— 「我在别处写了八十章，想搬过来接着写」是最常见的第一件事。
// 做两件事：认章节（排除作者的话、本章说），把卷铺进大纲。
// 导入的章一律 status='review'：别人的稿也得过一遍验收，不该直接算已采纳。

function ImportPanel({ projectId, toast, onRefresh }) {
  const [text, setText] = useState('')
  const [mode, setMode] = useState('append')
  const [per, setPer] = useState('100')
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  const look = async () => {
    if (!text.trim()) {
      toast('先粘正文进来')
      return
    }
    setBusy(true)
    try {
      setPreview(await api('import.preview', { text }))
    } catch (error) {
      toast(`认不出来：${error.message}`)
      setPreview(null)
    } finally {
      setBusy(false)
    }
  }

  const run = async () => {
    if (!text.trim()) {
      toast('先粘正文进来')
      return
    }
    setBusy(true)
    try {
      const value = await api('import.run', { projectId, text, mode, chaptersPerVolume: Number(per) || 100 })
      toast(`导进 ${value.written} 章（第 ${value.from}–${value.to} 章）`)
      setText('')
      setPreview(null)
      onRefresh?.()
    } catch (error) {
      toast(`导不进去：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    { title: '导入已有的书', extra: h(Tag, { tone: 'amber' }, '只认章节标题') },
    h('p', { className: 'nw-hint' },
      '在别处写好的稿搬进来。「第一章 / 第1章 / 楔子 / Chapter 3」都认；'
      + '「作者的话」「本章说」会被挑出来不算正文。导入的章是「待验收」——别人的稿也要过一遍。'),
    h(Field, { label: '整本正文' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '第一章 城头夜雨\n……',
      })),
    h('div', { className: 'nw-import-opts' },
      h(Field, { label: '接到哪' },
        h(Select, {
          value: mode,
          onChange: setMode,
          options: [
            { value: 'append', label: '接在已有最后一章后面' },
            { value: 'replace', label: '清空现有章节再导（旧章进回收站，能捞回来）' },
          ],
        })),
      h(Field, { label: '每卷多少章' },
        h(Input, { value: per, onChange: setPer, placeholder: '100' }))),
    h('div', { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'ghost', onClick: look }, busy ? '认着呢…' : '先认一遍（不写盘）'),
      h(Btn, { small: true, kind: 'primary', onClick: run }, busy ? '导着呢…' : '真导进去')),
    preview
      ? h('div', { className: 'nw-analyze' },
        h(KV, {
          rows: [
            ['认出章数', String(preview.chapters)],
            ['空章跳过', String(preview.skippedEmpty ?? 0)],
            ['总字数', `${fmtWords(preview.totalWords ?? 0)}字`],
            ['排除的非正文', preview.noise?.length ? preview.noise.slice(0, 3).join(' / ') : '没有'],
          ],
        }),
        h('div', { className: 'nw-analyze-open' },
          h('h4', null, '前几章长这样'),
          preview.head.map((row) => h('div', { className: 'nw-analyze-row', key: row.at },
            h('span', { className: 'nw-analyze-ch' }, `#${row.at}`),
            h('span', { className: 'nw-analyze-title' }, row.title),
            h('span', { className: 'nw-analyze-num' }, `${fmtWords(row.words)}字`),
            h('span', { className: 'nw-analyze-beats' }, row.firstLine)))),
        preview.truncated ? h('p', { className: 'nw-hint' }, '只预览前 20 章。') : null)
      : null,
  )
}

// ── 扫榜台（第 4 批）────────────────────────────────────
//
// 两条路分开摆，因为它们可靠性差一个量级：
//   粘榜单文本 —— 稳，永远能用，解析规则写在 lib/scan.js。
//   自动抓网页 —— 尽力而为，反爬随时变，抓不到就说抓不到。
// 把易碎的东西伪装成可靠的东西，比没有更坏。

function ScanBoard({ projectId, toast }) {
  const [text, setText] = useState('')
  const [platform, setPlatform] = useState('')
  const [url, setUrl] = useState('')
  const [list, setList] = useState([])
  const [cur, setCur] = useState(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      const value = await api('scan.list', { projectId })
      setList(Array.isArray(value?.items) ? value.items : [])
    } catch {
      setList([])
    }
  }, [projectId])

  useEffect(() => { reload() }, [reload])

  const save = async () => {
    if (!text.trim()) {
      toast('先把榜单粘进来')
      return
    }
    setBusy(true)
    try {
      const value = await api('scan.save', { projectId, text, platform })
      toast(`解析出 ${value.count} 本`)
      setText('')
      await reload()
      setCur(value)
    } catch (error) {
      toast(`解析失败：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const grab = async () => {
    if (!url.trim()) {
      toast('先填一个榜单页地址')
      return
    }
    setBusy(true)
    try {
      const value = await api('scan.fetch', { url })
      if (value?.ok && value.text) {
        setText(value.text)
        toast('抓到了，先看一眼再点解析')
      } else {
        toast(`没抓到：${value?.error ?? '这个页面没给出可读内容'}。改成手动粘吧`)
      }
    } catch (error) {
      toast(`抓不了：${error.message}`)
    } finally {
      setBusy(false)
    }
  }

  const openOne = async (id) => {
    try {
      setCur(await api('scan.get', { projectId, id }))
    } catch (error) {
      toast(`打不开：${error.message}`)
    }
  }

  const cols = ['#', '书名', '题材', '收藏', '趋势']
  return h(
    Card,
    { title: '扫榜台', extra: h(Tag, { tone: 'teal' }, `${list.length} 次`) },
    h('p', { className: 'nw-hint' },
      '粘榜单文本进来 —— 一行一本，名次在前、书名在后，中间或后面跟题材与数字。'
      + '「排名 书名 题材 收藏 趋势」这种表头会自动跳过。'),
    h(Field, { label: '平台' }, h(Input, { value: platform, onChange: setPlatform, placeholder: '起点 / 番茄 / 七猫' })),
    h(Field, { label: '榜单正文' },
      h(TextArea, {
        value: text,
        rows: 6,
        onChange: setText,
        placeholder: '1. 我在大明当暴君 历史 38.2万 ↑12\n2 重生之我家有矿（都市）96.5万 ↑5',
      })),
    h('div', { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'primary', onClick: save }, busy ? '解析中…' : '解析并存下')),
    h('details', { className: 'nw-scan-auto' },
      h('summary', null, '或者让我去抓（尽力而为，抓不到就手动粘）'),
      h('div', { className: 'nw-actions' },
        h(Input, { value: url, onChange: setUrl, placeholder: 'https://…榜单页地址' }),
        h(Btn, { small: true, kind: 'ghost', onClick: grab }, busy ? '抓着…' : '去抓')),
      h('p', { className: 'nw-hint' }, '榜单页结构一个月能改三版，写死选择器只会变成「昨天还能用」的谎言。抓不到是常态。')),

    cur
      ? h('div', { className: 'nw-analyze' },
        h(KV, {
          rows: [
            ['平台', cur.platform ?? '—'],
            ['本数', String(cur.count ?? cur.rows?.length ?? 0)],
            ['题材分布', (cur.genres ?? []).map((g) => `${g.name} ${g.count}`).join(' / ') || '—'],
            ['上升最多', (cur.rising ?? []).slice(0, 3).map((r) => `${r.book} ${r.delta > 0 ? '+' : ''}${r.delta}`).join(' / ') || '—'],
          ],
        }),
        h('div', { className: 'nw-scan' },
          h('div', { className: 'nw-scan-head' }, cols.map((label) => h('span', { className: 'nw-scan-th', key: label }, label))),
          (cur.rows ?? []).map((row) => h('div', { className: 'nw-scan-row', key: `${row.rank}-${row.book}` },
            h('span', { className: 'nw-scan-td nw-scan-rank' }, String(row.rank)),
            h('span', { className: 'nw-scan-td nw-scan-book' }, row.book),
            h('span', { className: 'nw-scan-td' }, h(Tag, { tone: 'grey' }, row.genre || '未标注')),
            h('span', { className: 'nw-scan-td nw-scan-num' }, row.collect || '—'),
            h('span', { className: `nw-scan-td nw-scan-trend${/↓/.test(row.trend) ? ' down' : /↑/.test(row.trend) ? ' up' : ''}` }, row.trend || '—')))))
      : null,

    list.length
      ? h('div', { className: 'nw-scan-hist' }, list.map((row) => h(
        'button',
        {
          type: 'button',
          className: 'nw-scan-hist-row',
          key: row.id,
          onClick: () => openOne(row.id),
        },
        h('span', { className: 'nw-scan-hist-icon' }, '📊'),
        h('span', { className: 'nw-scan-hist-body' },
          h('span', { className: 'nw-scan-hist-title' }, `${row.platform} 榜`),
          h('span', { className: 'nw-scan-hist-sub' }, `${row.count} 本`)),
        h('span', { className: 'nw-scan-hist-at' }, String(row.createdAt ?? '').slice(0, 10)),
        h('span', { className: 'nw-prop-go' }, '▸'))))
      : null,
  )
}

// ═════════ 70-settings.js ═════════
/**
 * 长夜 · 设置
 *
 * 四块：作品数据 / 模型预算 / 写作偏好 / 界面。
 */

/**
 * 成本卡：读 DSH 自己的会话日志，按真实 token 数算钱。
 *
 * 为什么不做「估算器」而做「读日志」：估算是拍脑袋，日志是既成事实。
 * 会话目录按 cwd 匹配，所以只在「这个项目是在某个工作目录里开的会话」时才有数；
 * 匹配不到就明说没找到，不假装 0 元。
 */
function CostCard({ projectId, toast }) {
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [plan, setPlan] = useState({ chapters: 100, chapterWords: 3000, model: 'deepseek-chat' })
  const [budget, setBudget] = useState(null)

  const scan = async () => {
    if (!projectId) {
      toast('先选一个作品')
      return
    }
    setBusy(true)
    try {
      const out = await api('usage.scan', { projectId })
      setData(out)
      toast(out.note)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const estimate = async () => {
    setBusy(true)
    try {
      const out = await api('usage.budget', {
        chapters: Number(plan.chapters) || 0,
        chapterWords: Number(plan.chapterWords) || 0,
        model: plan.model,
      })
      setBudget(out)
      toast(`按这个计划大约 ${fmtCost(out.cost)}`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const total = data?.total ?? { turns: 0, steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  const sessions = data?.sessions ?? []

  return h(
    Card,
    {
      title: '花多少钱了',
      extra: h(
        'div',
        { className: 'nw-actions' },
        h(Btn, { small: true, kind: 'ghost', disabled: busy || !projectId, onClick: scan }, busy ? '读着…' : '读会话日志'),
        h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: estimate }, '算预算'),
      ),
    },
    h(Hint, null, '不是估算：直接读 DSH 的会话日志，把输入输出 token 按公开单价折成人民币。会话记在别的目录就匹配不到，会明说没找到。'),

    data
      ? h('div', { className: 'nw-cost-total' }, [
        h('div', { key: 'c', className: 'nw-cost-num' }, fmtCost(total.cost)),
        h('div', { key: 'd', className: 'nw-cost-desc' }, `${total.turns} 轮 / ${total.steps} 步 / ${total.toolCalls} 次工具调用 · 输入 ${fmtWords(total.inputTokens)} token、输出 ${fmtWords(total.outputTokens)} token`),
      ])
      : h('p', { className: 'nw-hint' }, data === null ? '还没读。' : ''),

    sessions.length
      ? h(
        'div',
        { className: 'nw-cost-list' },
        ...sessions.slice(0, 8).map((row) => h(
          'div',
          { key: row.sessionId, className: 'nw-cost-row' },
          h('span', { className: 'nw-cost-name' }, String(row.sessionId).slice(0, 8)),
          h('span', { className: 'nw-cost-meta' }, `${row.turns} 轮 · ${fmtWords(row.inputTokens)} 入 / ${fmtWords(row.outputTokens)} 出`),
          h('span', { className: 'nw-cost-money' }, fmtCost(row.cost)),
        )),
      )
      : null,

    h(
      'div',
      { className: 'nw-form-grid' },
      h(Field, { label: '计划写几章' }, h(Input, {
        type: 'number', value: plan.chapters, onChange: (v) => setPlan({ ...plan, chapters: Number(v) || 0 }),
      })),
      h(Field, { label: '每章多少字' }, h(Input, {
        type: 'number', value: plan.chapterWords, onChange: (v) => setPlan({ ...plan, chapterWords: Number(v) || 0 }),
      })),
      h(Field, { label: '用哪个模型' }, h(Select, {
        value: plan.model,
        onChange: (v) => setPlan({ ...plan, model: v }),
        options: [
          { value: 'deepseek-v4.1-flash', label: 'flash（便宜）' },
          { value: 'deepseek-chat', label: 'chat（贵些）' },
        ],
      })),
    ),
    budget
      ? h('div', { className: 'nw-cost-budget' }, [
        h(KV, {
          key: 'kv',
          rows: [
            ['预计总字数', `${fmtWords(budget.totalWords ?? 0)} 字`],
            ['预计 token', `${fmtWords(budget.totalTokens ?? 0)}（入 ${fmtWords(budget.inputTokens ?? 0)} / 出 ${fmtWords(budget.outputTokens ?? 0)}）`],
            ['预计花费', fmtCost(budget.cost ?? 0)],
            ['摊到每章', budget.chapters ? fmtCost(Number(budget.cost ?? 0) / budget.chapters) : '—'],
          ],
        }),
        h('p', { key: 'n', className: 'nw-hint' }, budget.note ?? ''),
      ])
      : null,
  )
}

/**
 * 写策略卡：原生写工具（write / edit）落到哪些目录该被拦。
 *
 * 为什么需要开关而不是一律拦死：模型偶尔就是要直接改设定卡、补一份岗位手册。
 * 一律拦死会逼人去关整个守卫；给几个勾，代价小得多。
 * 三档里 off 是一刀切（连提醒都不给），enforce 才是真拦。
 */
function WritePolicyCard({ projectId, project, toast, onRefresh }) {
  const policy = (project?.settings?.writePolicy && typeof project.settings.writePolicy === 'object')
    ? project.settings.writePolicy
    : {}
  const level = ['off', 'warn', 'enforce'].includes(String(policy.level)) ? String(policy.level) : 'warn'
  const [busy, setBusy] = useState(false)

  const save = async (patch) => {
    if (!projectId) {
      toast('先选一个作品')
      return
    }
    setBusy(true)
    try {
      await api('project.save', {
        projectId,
        patch: { settings: { writePolicy: { ...policy, ...patch } } },
      })
      onRefresh?.()
      toast('写策略已保存')
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const LEVELS = [
    { value: 'off', label: '不管', hint: '原生 write/edit 改什么都不提醒' },
    { value: 'warn', label: '提醒', hint: '默认。改完给你一条提示，不拦' },
    { value: 'enforce', label: '拦住', hint: '必须走 nightwrite_op，绕不过去' },
  ]
  const DIRS = [
    { flag: 'allowChapter', label: '正文 chapters/' },
    { flag: 'allowLedger', label: '账本 ledger/' },
    { flag: 'allowFacts', label: '设定卡 facts/' },
    { flag: 'allowOutline', label: '大纲 outlines/' },
    { flag: 'allowSkills', label: '手册 agents/ 与 skills/' },
  ]

  return h(
    Card,
    {
      title: '原生写工具守卫',
      extra: h(Tag, { tone: level === 'enforce' ? 'red' : (level === 'warn' ? 'amber' : 'grey') }, level),
    },
    h(Hint, null, '宿主自带的 write / edit 直接改文件时，这条守卫会读到改动、算一遍 AI 味和保真度再提醒你。只有「拦住」这一档才真的拒绝写入——拒绝会告诉模型改用 nightwrite_op，它不会卡死。'),
    h(
      'div',
      { className: 'nw-policy-row' },
      ...LEVELS.map((row) => h(
        'button',
        {
          type: 'button',
          key: row.value,
          className: `nw-policy-card nw-policy-${row.value}${level === row.value ? ' on' : ''}`,
          disabled: busy,
          onClick: () => save({ level: row.value }),
        },
        h('span', { className: 'nw-policy-name' }, row.label),
        h('span', { className: 'nw-policy-hint' }, row.hint),
      )),
    ),
    level === 'enforce'
      ? h(
        'div',
        { className: 'nw-policy-dirs' },
        ...DIRS.map((row) => h(
          'label',
          { key: row.flag, className: 'nw-policy-dir' },
          h('input', {
            type: 'checkbox',
            checked: policy[row.flag] !== false,
            disabled: busy,
            onChange: (event) => save({ [row.flag]: event.target.checked }),
          }),
          h('span', null, row.label),
        )),
      )
      : h('p', { className: 'nw-hint' }, '只有「拦住」这一档才需要指定哪些目录不许直接改。'),
  )
}

/**
 * 【12 条 #8】AI 味词表编辑器。
 *
 * 为什么值得一个独立卡片：验收台那条彩带是从这里扫出来的。
 * 以前词表是 store 里的模块常量，你写「微微」「缓缓」写了一百万字，
 * 它永远扫不出来，因为它只认通用那二十来条。
 * 现在两件事都能做：加你自己的口头禅、停用你不认的条目。
 */
function AiLexiconCard({ projectId, toast }) {
  const res = useAsync(() => api('aistyle.get', { projectId }), [projectId], { skip: !projectId })
  const [phrase, setPhrase] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

  const items = res.data?.items ?? []
  const disabled = res.data?.disabled ?? []
  const custom = res.data?.custom ?? []

  const save = async (patch) => {
    setBusy(true)
    try {
      await api('aistyle.save', { projectId, ...patch })
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const word = phrase.trim()
    if (!word) {
      toast('先写一个要盯的词')
      return
    }
    if (items.some((row) => row.pattern === word)) {
      toast('这条已经在词表里了')
      return
    }
    save({ custom: [...custom, { phrase: word, hint: hint.trim() }] })
    setPhrase('')
    setHint('')
    toast(`已加入词表：${word}（下一章验收就会扫到）`)
  }

  const toggle = (pattern, off) => {
    const next = off ? [...disabled, pattern] : disabled.filter((row) => row !== pattern)
    save({ disabled: next })
  }

  const drop = (pattern) => {
    save({ custom: custom.filter((row) => row.phrase !== pattern) })
    toast(`已从词表删掉：${pattern}`)
  }

  return h(
    Card,
    {
      title: 'AI 味词表',
      extra: res.loading ? null : h(Tag, { tone: 'grey' }, `生效 ${items.length} 条`),
    },
    h('p', { className: 'nw-hint' }, '验收台右侧那条彩带就是拿这张表扫出来的。默认表是通用 AI 套话；你把反复用的词加进来，扫出来的才是「你的」毛病。'),
    res.error ? h(ErrorBox, { error: res.error, onRetry: res.reload }) : null,
    h(
      'div',
      { className: 'nw-lex-add' },
      h(Input, { value: phrase, placeholder: '要盯的词，比如「缓缓」', onChange: setPhrase }),
      h(Input, { value: hint, placeholder: '为什么烦它（可不填）', onChange: setHint }),
      h(Btn, { kind: 'primary', small: true, onClick: add, disabled: busy || !projectId }, '＋ 加入词表'),
    ),
    h(
      'div',
      { className: 'nw-lex-list' },
      items.length
        ? items.map((row) => {
          const off = disabled.includes(row.pattern)
          return h(
            'div',
            { className: `nw-lex-row${off ? ' nw-lex-off' : ''}`, key: `${row.source}:${row.pattern}` },
            h('span', { className: 'nw-lex-word' }, row.pattern),
            h('span', { className: 'nw-hint' }, row.hint || '（没写原因）'),
            row.source === 'custom' ? h(Tag, { tone: 'blue' }, '你自己加的') : null,
            h(
              'span',
              { className: 'nw-lex-acts' },
              h(Btn, { small: true, kind: 'ghost', onClick: () => toggle(row.pattern, !off), disabled: busy }, off ? '↺ 启用' : '停用'),
              row.source === 'custom'
                ? h(Btn, { small: true, kind: 'danger', onClick: () => drop(row.pattern), disabled: busy }, '删除')
                : null,
            ),
          )
        })
        : h(Empty, null, '词表是空的。默认表被全部停用了？上面加一条就回来。'),
    ),
    h(Hint, null, '停用不是删除：默认条目停用后还在这里，随时能开回来；自定义条目删掉才真没了。'),
  )
}

/**
 * 【阶段 B】语料池。
 *
 * 为什么这块要露在设置里：它量的是「真人写作时这些规则多久出现一次」，
 * 用来给检测器定阈值。没有它，所有阈值都是拍的。
 * 一本书只按内容哈希收一次；收够 3 本才给分位数，不够就明说别当真。
 */
function CorpusCard({ toast }) {
  const res = useAsync(() => api('corpus.list'), [])
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [source, setSource] = useState('self')
  const [busy, setBusy] = useState(false)
  const [derived, setDerived] = useState(null)

  const totals = res.data?.totals ?? { books: 0, chapters: 0, chars: 0, gap: 5584, booksNeeded: 26, progress: 0, bySource: {} }
  const books = res.data?.books ?? []

  const add = async () => {
    if (!text.trim()) {
      toast('先把正文粘进来')
      return
    }
    setBusy(true)
    try {
      const done = await api('corpus.add', { name: name.trim() || `未命名 ${books.length + 1}`, text, source })
      toast(done.message)
      setText('')
      setName('')
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const derive = async () => {
    setBusy(true)
    try {
      const out = await api('corpus.thresholds', { minBooks: 3 })
      setDerived(out)
      toast(out.summary)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  const drop = async (id, label) => {
    setBusy(true)
    try {
      await api('corpus.remove', { id })
      toast(`已从池子里移出《${label}》`)
      res.reload()
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '语料池（量阈值用）',
      extra: h(Tag, { tone: totals.books >= 3 ? 'green' : 'grey' }, `${totals.books} 本 / ${totals.chapters} 章`),
    },
    h(Hint, null, '检测器的阈值现在是我拍的。这块用你自己的稿子和公版书量出「真人写作时这条规则多久出现一次」，阈值才有依据。只存正文和统计，不存拆书结论。'),

    h(
      'div',
      { className: 'nw-corpus-bar' },
      h('div', { className: 'nw-corpus-fill', style: { width: `${Math.round((totals.progress ?? 0) * 100)}%` } }),
    ),
    h(
      'div',
      { className: 'nw-corpus-nums' },
      h('span', null, `目标 ${totals.target ?? 5584} 章（对齐公开拆书语料的统计量级）`),
      h('span', null, totals.gap > 0 ? `还差 ${totals.gap} 章，约 ${totals.booksNeeded} 本 200 章的书` : '统计量级已够'),
    ),

    books.length
      ? h(
        'div',
        { className: 'nw-corpus-list' },
        books.map((row) => h(
          'div',
          { className: 'nw-corpus-row', key: row.id },
          h('span', { className: 'nw-corpus-name' }, row.name),
          h(Tag, { tone: row.source === 'self' ? 'green' : row.source === 'public' ? 'blue' : 'grey' }, row.source === 'self' ? '自己写的' : row.source === 'public' ? '公版' : '已授权'),
          h('span', { className: 'nw-corpus-meta' }, `${row.chapters} 章 · ${fmtWords(row.chars)}`),
          h('button', { type: 'button', className: 'nw-icon-btn', title: '移出池子', onClick: () => drop(row.id, row.name) }, '✕'),
        )),
      )
      : h(Empty, null, '池子是空的。先把你正在写的这本书的原文粘进来——自己的语体最值钱。'),

    h(
      'div',
      { className: 'nw-corpus-add' },
      h(Input, { value: name, onChange: (e) => setName(e.target.value ?? ''), placeholder: '书名（可留空）' }),
      h(Select, {
        value: source,
        onChange: (e) => setSource(e.target.value ?? 'self'),
        options: [
          { value: 'self', label: '自己写的' },
          { value: 'public', label: '公版书' },
          { value: 'owned', label: '已授权' },
        ],
      }),
    ),
    h(TextArea, {
      value: text,
      onChange: (e) => setText(e.target.value ?? ''),
      rows: 5,
      placeholder: '把整本正文粘进来（会自动切章）。只用来统计，不会出现在任何导出里。',
    }),
    h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { kind: 'primary', small: true, disabled: busy, onClick: add }, busy ? '收着…' : '收进池子'),
      h(Btn, { small: true, disabled: busy || totals.books < 1, onClick: derive }, '量一遍阈值'),
    ),

    derived
      ? h(
        'div',
        { className: 'nw-corpus-out' },
        h('div', { className: 'nw-corpus-sum' }, derived.summary),
        derived.rules.filter((r) => r.enough).length
          ? h(
            'div',
            { className: 'nw-corpus-th' },
            derived.rules.filter((r) => r.enough).slice(0, 12).map((r) => h(
              'div',
              { className: `nw-corpus-th-row${r.noisy ? ' nw-corpus-th-noisy' : ''}`, key: r.id },
              h('span', { className: 'nw-corpus-th-name' }, r.label),
              h('span', { className: 'nw-corpus-th-num' }, `语料 p90 ${r.p90}/千字`),
              h('span', { className: 'nw-corpus-th-num' }, `现在 ${r.current || '—'}`),
              r.noisy ? h(Tag, { tone: 'amber' }, '会天天报警') : null,
            )),
          )
          : null,
      )
      : null,
  )
}

function SettingsPage({
  projectId, project, projects, chapters, onSwitch, toast, onRefresh, theme, setTheme,
}) {
  const [draft, setDraft] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: '', genre: '', logline: '', targetWords: 2500, qualityGate: 70, monthlyBudget: 600 })
  const [confirm, setConfirm] = useState('')
  const [exporting, setExporting] = useState(false)
  const chaptersCount = Array.isArray(chapters) ? chapters.length : 0
  // 回收站要能看见，否则「删了还能找回」只是一句话。
  const trash = useAsync(() => api('chapter.trash', { projectId }), [projectId], { skip: !projectId })

  useEffect(() => {
    setDraft(project ? { ...project } : null)
  }, [project])

  const saveProject = async () => {
    if (!projectId || !draft) return
    try {
      await api('project.save', {
        projectId,
        patch: {
          name: draft.name,
          genre: draft.genre,
          logline: draft.logline,
          targetWords: Number(draft.targetWords) || 2500,
          qualityGate: Number(draft.qualityGate) || 70,
          monthlyBudget: Number(draft.monthlyBudget) || 600,
        },
      })
      onRefresh?.()
      toast('已保存')
    } catch (error) {
      toast(error.message)
    }
  }

  const create = async () => {
    if (!String(form.name).trim()) {
      toast('先起个书名')
      return
    }
    try {
      const res = await api('project.create', form)
      setCreating(false)
      onRefresh?.()
      onSwitch?.(res.id)
      toast(`已建《${res.name}》`)
    } catch (error) {
      toast(error.message)
    }
  }

  const remove = async () => {
    if (!projectId) return
    if (confirm !== (project?.name ?? '')) {
      toast('书名不一致，没有删除')
      return
    }
    try {
      await api('project.delete', { projectId })
      setConfirm('')
      onRefresh?.()
      toast('已删除')
    } catch (error) {
      toast(error.message)
    }
  }

  return h(
    'div',
    { className: 'nw-page nw-settings' },
    h(
      Card,
      { title: '作品数据', extra: h(Btn, { small: true, kind: 'primary', onClick: () => setCreating(true) }, '＋ 新建作品') },
      h(
        'div',
        { className: 'nw-proj-list' },
        projects.length
          ? projects.map((row) => h(
            'button',
            {
              type: 'button',
              key: row.id,
              className: `nw-proj${row.id === projectId ? ' on' : ''}`,
              onClick: () => onSwitch?.(row.id),
            },
            h('span', { className: 'nw-proj-name' }, row.name),
            h('span', { className: 'nw-proj-meta' }, `${row.chapters} 章 · ${fmtWords(row.words)} 字`),
            row.id === projectId ? h(Tag, { tone: 'amber' }, '当前') : null,
          ))
          : h(Empty, null, '还没有作品。'),
      ),
      draft
        ? h(
          Fragment,
          null,
          h('div', { className: 'nw-form-grid' },
            h(Field, { label: '书名' }, h(Input, { value: draft.name, onChange: (v) => setDraft({ ...draft, name: v }) })),
            h(Field, { label: '题材' }, h(Input, { value: draft.genre, onChange: (v) => setDraft({ ...draft, genre: v }) })),
            h(Field, { label: '每章目标字数' }, h(Input, {
              type: 'number',
              value: draft.targetWords,
              onChange: (v) => setDraft({ ...draft, targetWords: v }),
            })),
            h(Field, { label: '质检门槛（分）' }, h(Input, {
              type: 'number',
              value: draft.qualityGate,
              onChange: (v) => setDraft({ ...draft, qualityGate: v }),
            })),
            h(Field, { label: '月预算（元）' }, h(Input, {
              type: 'number',
              value: draft.monthlyBudget,
              onChange: (v) => setDraft({ ...draft, monthlyBudget: v }),
            })),
            h(Field, { label: '一句话卖点' }, h(Input, { value: draft.logline, onChange: (v) => setDraft({ ...draft, logline: v }) })),
          ),
          h('div', { className: 'nw-actions' }, h(Btn, { kind: 'primary', onClick: saveProject }, '保存作品设置')),
        )
        : null,
      h(
        'details',
        { className: 'nw-danger-zone' },
        h('summary', null, '危险区：删除这部作品'),
        h('p', { className: 'nw-hint' }, '目录会被整份删掉，无法撤销。输入书名确认。'),
        h(Input, { value: confirm, onChange: setConfirm, placeholder: project?.name ?? '' }),
        h(Btn, { kind: 'danger', onClick: remove }, '确认删除'),
      ),
    ),
    h(
      Card,
      { title: '模型与预算' },
      h(KV, {
        rows: [
          { key: '质检门槛', text: String(project?.qualityGate ?? 70) + ' 分' },
          { key: '每章目标', text: String(project?.targetWords ?? 2500) + ' 字' },
          { key: '月预算', text: `¥${project?.monthlyBudget ?? 600}` },
          { key: '数据根', text: '~/.dsh/data/dsh-nightwrite', mono: true },
        ],
      }),
      h(Hint, null, '预算与门槛存在 project.json 里；每次跑批前由 agent 读它做闸门。'),
    ),
    // 【24 条 #23】【12 条 #12】导出全部数据：以前只弹一句 toast，什么都没生成。
    // 现在真的打一个 zip：GET /nightwrite/api/export?projectId=... 回字节流，
    // 前端接成 blob 用 <a download> 落到下载目录。
    h(
      Card,
      {
        title: '导出全部数据',
        extra: h(Tag, { tone: 'green' }, '真打包'),
      },
      h('p', { className: 'nw-hint' }, '把这部作品的所有文件打成一个 zip：正文、账本、大纲、队列、提案、问题单、设置、历史版本、回收站。导出的就是磁盘上那棵目录，不带任何私有格式。'),
      h(
        'div',
        { className: 'nw-export-tree' },
        [
          ['chapters/', `${chaptersCount} 个 .txt 正文`, 'text'],
          ['chapters/history/', '历史版本（每章最近 20 版）', 'text'],
          ['chapters/.trash/', '回收站里删掉的章', 'text'],
          ['ledger.json', '八类账本', 'json'],
          ['outline.json', '卷纲与细纲', 'json'],
          ['queue.json', '工单队列', 'json'],
          ['proposals.json', 'AI 提案与拍板记录', 'json'],
          ['problems.json', '问题单', 'json'],
          ['project.json', '书名 / 门槛 / 预算', 'json'],
        ].map(([name, desc, kind]) => h(
          'div',
          { className: 'nw-export-row', key: name },
          h('span', { className: `nw-export-icon nw-export-${kind}` }, kind === 'text' ? '📄' : '{ }'),
          h('span', { className: 'nw-export-name' }, name),
          h('span', { className: 'nw-hint' }, desc),
        )),
      ),
      h(
        'div',
        { className: 'nw-actions' },
        h(Btn, {
          kind: 'primary',
          disabled: !projectId || exporting,
          onClick: async () => {
            if (!projectId || exporting) return
            setExporting(true)
            try {
              const base = String(bootInfo().apiUrl || ROUTE).replace(/\/+$/, '')
              const res = await fetch(`${base}/export?projectId=${encodeURIComponent(projectId)}`, {
                credentials: 'same-origin',
              })
              if (!res.ok) {
                // 失败时后端回的是 JSON 错误体，不是 zip。
                let message = `导出失败（HTTP ${res.status}）`
                try {
                  const data = await res.json()
                  message = data?.error?.message || message
                } catch {
                  /* 非 JSON，用默认文案 */
                }
                throw new Error(message)
              }
              const blob = await res.blob()
              const files = res.headers.get('x-nightwrite-files') ?? '?'
              const name = `${project?.name ?? projectId}-${new Date().toISOString().slice(0, 10)}.zip`
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = name
              a.rel = 'noopener'
              document.body.appendChild(a)
              a.click()
              a.remove()
              // 立刻 revoke 会让部分浏览器来不及开始下载，等一拍再放。
              setTimeout(() => URL.revokeObjectURL(url), 4000)
              toast(`已打包 ${files} 个文件 · ${(blob.size / 1024).toFixed(0)} KB，浏览器正在下载`)
            } catch (error) {
              toast(error.message)
            } finally {
              setExporting(false)
            }
          },
        }, exporting ? '打包中…' : '📦 打包成 zip 下载'),
        h(Btn, {
          kind: 'ghost',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(`~/.dsh/data/dsh-nightwrite/${projectId ?? '<作品>'}`)
              toast('已复制目录路径，直接去文件管理器里拷')
            } catch {
              toast('复制失败，手动去 ~/.dsh/data/dsh-nightwrite 拿')
            }
          },
        }, '复制目录路径'),
      ),
      h(Hint, null, '导出是纯读取，不改任何文件；打包失败也不会动正文。zip 用 store 模式（不压缩），几 MB，解开就是原文件。'),
    ),
    // 回收站：删章不再是永久删除。这里能看见删了什么、能还原。
    h(
      Card,
      {
        title: '回收站',
        extra: h('span', { className: 'nw-card-badge' }, `${trash.data?.items?.length ?? 0}`),
      },
      !projectId
        ? h(Empty, null, '还没有作品。')
        : trash.loading && !trash.data
          ? h(Loading, null)
          : (trash.data?.items ?? []).length
            ? h(
              'div',
              { className: 'nw-trash-list' },
              trash.data.items.map((row) => h(
                'div',
                { className: 'nw-trash-row', key: row.trash },
                h('span', { className: 'nw-trash-n' }, `第 ${row.chapter} 回`),
                h('span', { className: 'nw-trash-title' }, row.title),
                h('span', { className: 'nw-trash-w' }, `${row.words} 字`),
                h('span', { className: 'nw-hint nw-trash-at' }, `${String(row.at ?? '').slice(0, 8)} ${String(row.at ?? '').slice(9, 15)}`),
                h(Btn, {
                  small: true,
                  kind: 'ghost',
                  onClick: async () => {
                    try {
                      await api('chapter.recover', { projectId, trash: row.trash })
                      trash.reload()
                      onRefresh?.()
                      toast(`第 ${row.chapter} 回已还原`)
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '↩ 还原'),
                h(Btn, {
                  small: true,
                  kind: 'danger',
                  onClick: async () => {
                    try {
                      await api('chapter.purge', { projectId, trash: row.trash })
                      trash.reload()
                      toast('已彻底删除这一项')
                    } catch (error) {
                      toast(error.message)
                    }
                  },
                }, '彻底删除'),
              )),
            )
            : h(Empty, null, '回收站是空的。删章都会先进这里，可以还原。'),
      h(Hint, null, '删章只是移到 chapters/.trash/，正文和元数据都还在。还原时若原位置已有同名文件会报冲突，不会覆盖。'),
    ),
    h(
      Card,
      { title: '写作偏好' },
      h(Field, { label: '默认稿纸（场景分隔符）' }, h(Input, { value: '※', onChange: () => {} })),
      h(Hint, null, '场景分隔统一用 ※；正文一律纯文本，禁 Markdown —— 与写入门禁一致。'),
      // 【12 条 #2】自动保存开关：有人不喜欢它偷偷发请求，给个真的开关。
      h(
        Field,
        { label: '自动保存' },
        h(
          'div',
          { className: 'nw-actions' },
          h(Switch, {
            on: readLS(LS.autosave, '1') !== '0',
            onChange: (next) => {
              writeLS(LS.autosave, next ? '1' : '0')
              toast(next ? '自动保存已打开：停手 4 秒就落盘' : '自动保存已关，记得手动点保存')
              onRefresh?.()
            },
          }),
          h('span', { className: 'nw-hint' }, readLS(LS.autosave, '1') !== '0' ? '停手 4 秒落盘一次' : '关着，切页前会拦你一次'),
        ),
      ),
    ),
    // 【LNW 差异】导出成书 + 检查更新：交给外面的人看之前，先把稿子做成一本真的书。
    h(BookExport, { projectId, project, toast }),
    h(UpdateCard, { toast }),
    // 【12 条 #8】AI 味词表：以前是模块常量，扫出来的全是「通用 AI 味」，
    // 扫不到你自己反复用的那几句。现在能加、能停用。
    h(AiLexiconCard, { projectId, toast }),
    // 【阶段 B】语料池：阈值从自己的样本里量，不从感觉里拍。
    h(CorpusCard, { toast }),
    // 【gap 第 7 条】花了多少钱：不是估算，读会话日志。
    h(CostCard, { projectId, toast }),
    // 【gap 第 1 条】原生写工具守卫的挡位与目录：守卫在服务端，
    // 但「拦不拦」是作者的决定，得给个开关。
    h(WritePolicyCard, {
      projectId, project, toast, onRefresh,
    }),
    h(
      Card,
      { title: '界面' },
      // 【24 条 #24】主题三档：暗 / 亮 / 纸。米黄底配宋体，盯久了总得有个柔和的。
      h(
        'div',
        { className: 'nw-theme-row' },
        [
          { value: 'dark', label: '暗色', hint: '默认。夜里写。' },
          { value: 'light', label: '亮色', hint: '白天用。' },
          { value: 'paper', label: '纸', hint: '米黄底 + 宋体，柔和。' },
        ].map((item) => h(
          'button',
          {
            type: 'button',
            key: item.value,
            className: `nw-theme-card nw-theme-${item.value}${theme === item.value ? ' on' : ''}`,
            onClick: () => {
              setTheme(item.value)
              toast(`已切到「${item.label}」主题`)
            },
          },
          h('span', { className: 'nw-theme-swatch' }, item.value === 'paper' ? '纸' : ''),
          h('span', { className: 'nw-theme-name' }, item.label),
          h('span', { className: 'nw-theme-hint' }, item.hint),
        )),
      ),
      h(Hint, null, '主题记在 localStorage，只影响长夜这一层，不动宿主界面。'),
    ),
    creating
      ? h(
        Modal,
        {
          title: '新建作品',
          onClose: () => setCreating(false),
          footer: h(
            Fragment,
            null,
            h(Btn, { kind: 'ghost', small: true, onClick: () => setCreating(false) }, '取消'),
            h(Btn, { kind: 'primary', small: true, onClick: create }, '创建'),
          ),
        },
        h(Field, { label: '书名' }, h(Input, { value: form.name, onChange: (v) => setForm({ ...form, name: v }) })),
        h(Field, { label: '题材' }, h(Input, { value: form.genre, onChange: (v) => setForm({ ...form, genre: v }) })),
        h(Field, { label: '一句话卖点' }, h(TextArea, { value: form.logline, rows: 2, onChange: (v) => setForm({ ...form, logline: v }) })),
        h('div', { className: 'nw-form-grid' },
          h(Field, { label: '每章目标字数' }, h(Input, {
            type: 'number', value: form.targetWords, onChange: (v) => setForm({ ...form, targetWords: Number(v) || 0 }),
          })),
          h(Field, { label: '质检门槛' }, h(Input, {
            type: 'number', value: form.qualityGate, onChange: (v) => setForm({ ...form, qualityGate: Number(v) || 0 }),
          }))),
      )
      : null,
  )
}

// ═════════ 74-book.js ═════════
/**
 * 长夜 · 导出成书 + 检查更新（对齐 LNW 的两位邻居）
 *
 * 两件小事放一个文件，因为它们都是「关于这一版」而不是「关于这本书」：
 * 一个是把稿子交出去，一个是看看自己这版是不是旧的。
 */

/**
 * 导出成书：TXT / Markdown / EPUB / DOCX。
 *
 * 为什么不复用「导出全部数据」那个 zip：那个给的是磁盘目录，是给自己备份用的；
 * 这个给的是成品，是给读者、给投稿邮箱、给 epub 阅读器用的。两者的读者不一样，
 * 混在一起作者每次都要自己挑文件。
 */
function BookExport({ projectId, project, toast }) {
  const [format, setFormat] = useState('epub')
  const [busy, setBusy] = useState(false)
  const [skipRejected, setSkipRejected] = useState(true)

  const formats = [
    { value: 'txt', label: 'TXT', hint: '纯文本，一章一节' },
    { value: 'md', label: 'Markdown', hint: '带目录，方便再排版' },
    { value: 'epub', label: 'EPUB', hint: '电子书，手机阅读器能开' },
    { value: 'docx', label: 'DOCX', hint: 'Word 能开，宋体首行缩进' },
  ]

  const run = async () => {
    if (!projectId || busy) return
    setBusy(true)
    try {
      const base = String(bootInfo().apiUrl || ROUTE).replace(/\/+$/, '')
      const qs = new URLSearchParams({ projectId, format, skipRejected: skipRejected ? '1' : '0' })
      const res = await fetch(`${base}/book?${qs.toString()}`, { credentials: 'same-origin' })
      if (!res.ok) {
        let message = `导出失败（HTTP ${res.status}）`
        try {
          const data = await res.json()
          message = data?.error?.message || message
        } catch { /* 非 JSON 就用默认文案 */ }
        throw new Error(message)
      }
      const blob = await res.blob()
      const chapters = res.headers.get('x-nightwrite-chapters') ?? '?'
      const words = res.headers.get('x-nightwrite-words') ?? '?'
      const skipped = res.headers.get('x-nightwrite-skipped') ?? '0'
      const name = `${project?.name ?? projectId}.${format === 'md' ? 'md' : format}`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast(`已生成 ${chapters} 回 · ${words} 字${Number(skipped) ? `（跳过 ${skipped} 回）` : ''} · ${(blob.size / 1024).toFixed(0)} KB`)
    } catch (error) {
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    { title: '导出成书', extra: h(Tag, { tone: 'green' }, '真文件') },
    h('p', { className: 'nw-hint' }, '把已写的章拼成一本完整的书。和上面的「导出全部数据」不同：那个给自己备份目录，这个给读者。'),
    h(
      'div',
      { className: 'nw-book-formats' },
      formats.map((item) => h(
        'button',
        {
          type: 'button',
          key: item.value,
          className: `nw-book-format${format === item.value ? ' on' : ''}`,
          'aria-pressed': format === item.value ? 'true' : 'false',
          onClick: () => setFormat(item.value),
        },
        h('span', { className: 'nw-book-format-name' }, item.label),
        h('span', { className: 'nw-book-format-hint' }, item.hint),
      )),
    ),
    h(
      'div',
      { className: 'nw-actions' },
      h(
        'label',
        { className: 'nw-book-skip' },
        h('input', {
          type: 'checkbox',
          checked: skipRejected,
          onChange: (event) => setSkipRejected(event.target.checked),
        }),
        h('span', null, '跳过被否掉的章'),
      ),
      h(Btn, { kind: 'primary', disabled: !projectId || busy, onClick: run }, busy ? '正在拼…' : '📖 生成并下载'),
    ),
    h(Hint, null, '章名取正文首行（形如「第X回 标题」），不会在正文里重复一遍。EPUB 自带目录页；DOCX 用宋体、首行缩进、1.5 倍行距。'),
  )
}

/**
 * 检查更新：只报告，不自动装。
 *
 * 装不装由人来按——写作中途被替换掉半本书是灾难，插件不该自己决定。
 */
function UpdateCard({ toast }) {
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const installed = String(bootInfo().version ?? '0.1.0')

  const run = async (force) => {
    setBusy(true)
    try {
      const value = await api('update.check', { installed, force: force === true, timeoutMs: 5000 })
      setState(value)
      if (value.error) toast(value.error)
      else toast(value.hasUpdate ? `有新版 ${value.latest}` : '已经是最新的')
    } catch (error) {
      // 网络查不到不该让整张卡消失，留一句人能看懂的原因
      setState({ installed, error: error.message })
      toast(error.message)
    } finally {
      setBusy(false)
    }
  }

  return h(
    Card,
    {
      title: '检查更新',
      extra: h('span', { className: 'nw-card-badge' }, installed),
    },
    h(KV, {
      rows: [
        { key: '当前版本', text: installed, mono: true },
        { key: 'npm 最新版', text: state ? (state.latest || '查不到') : '还没查', mono: true },
        { key: '差多少', text: state ? (state.error ? '—' : state.behind) : '—' },
      ],
    }),
    state?.error
      ? h('p', { className: 'nw-update-err' }, state.error)
      : null,
    h(
      'div',
      { className: 'nw-actions' },
      h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: () => run(false) }, busy ? '查着…' : '查一下'),
      h(Btn, { small: true, kind: 'ghost', disabled: busy, onClick: () => run(true) }, '强制刷新（跳过缓存）'),
      state?.hasUpdate
        ? h(Tag, { tone: 'amber' }, `可升到 ${state.latest}`)
        : null,
    ),
    h(Hint, null, '只查不改：长夜是本地开发版，升级方式是改完源码再同步到 profile，不需要 npm install。查询结果缓存 6 小时，查不到也缓存 10 分钟，免得每开一次设置页都卡一下。'),
  )
}

// ═════════ 85-css.js ═════════
/**
 * 长夜 · 样式
 *
 * 全部挂在 .nw- 前缀下，不污染宿主。
 * 颜色走 CSS 变量，两套主题只换变量。
 */

const NIGHTWRITE_CSS = `
.nw-shell{
  --nw-bg:#14161a; --nw-bg-1:#191c21; --nw-bg-2:#1f232a; --nw-bg-3:#262b33;
  --nw-line:#2c323b; --nw-line-2:#3a424e;
  --nw-fg:#e8e9ec; --nw-fg-2:#b6bcc6; --nw-fg-3:#7f8792;
  --nw-amber:#d9a054; --nw-amber-soft:rgba(217,160,84,.14);
  --nw-teal:#4aa8a0; --nw-teal-soft:rgba(74,168,160,.14);
  --nw-red:#e05a54; --nw-red-soft:rgba(224,90,84,.14);
  --nw-green:#4aa07a; --nw-green-soft:rgba(74,160,122,.14);
  --nw-blue:#5b8fd6; --nw-blue-soft:rgba(91,143,214,.14);
  --nw-radius:10px;
  display:flex; flex-direction:column; height:100%; min-height:0;
  background:var(--nw-bg); color:var(--nw-fg);
  font-size:13px; line-height:1.6;
  font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
}
.nw-shell.nw-theme-light{
  --nw-bg:#f6f4f0; --nw-bg-1:#fffdfa; --nw-bg-2:#f1eee8; --nw-bg-3:#e7e2d9;
  --nw-line:#ddd7cc; --nw-line-2:#c9c1b3;
  --nw-fg:#23201c; --nw-fg-2:#5a544b; --nw-fg-3:#8b8579;
  --nw-amber:#b57d2e; --nw-amber-soft:rgba(181,125,46,.12);
  --nw-teal:#2f827a; --nw-green:#2f7a58; --nw-red:#c0453f; --nw-blue:#3f6fae;
}
/* ── 第三档主题「纸」：米黄底 + 宋体，长文阅读久盯不刺眼 ── */
.nw-shell.nw-theme-paper{
  --nw-bg:#f0e8d8; --nw-bg-1:#faf5e9; --nw-bg-2:#efe6d3; --nw-bg-3:#e4d8c0;
  --nw-line:#d6c8ac; --nw-line-2:#c2b192;
  --nw-fg:#3a3025; --nw-fg-2:#6b5d4a; --nw-fg-3:#9a8b73;
  --nw-amber:#a9702a; --nw-amber-soft:rgba(169,112,42,.13);
  --nw-teal:#2c6f68; --nw-green:#3d7550; --nw-red:#b04a3f; --nw-blue:#3c6a9c;
  font-family:Georgia,"Songti SC","STSong","SimSun",serif;
}
.nw-shell.nw-theme-paper .nw-textarea,
.nw-shell.nw-theme-paper .nw-para{font-family:Georgia,"Songti SC","STSong","SimSun",serif;font-size:14.5px;line-height:2.05}
.nw-shell *{box-sizing:border-box}
.nw-shell button{font:inherit;color:inherit;cursor:pointer;background:none;border:0}
.nw-shell h2{font-size:19px;margin:0;font-weight:650}
.nw-shell h3{font-size:13px;margin:0;font-weight:600}
.nw-shell p{margin:0}
.nw-shell pre{margin:0;font-family:ui-monospace,Consolas,monospace}

/* ── 顶栏 ── */
.nw-top{display:flex;align-items:center;gap:14px;padding:9px 16px;border-bottom:1px solid var(--nw-line);background:var(--nw-bg-1);flex:none}
.nw-brand{display:flex;align-items:center;gap:8px;flex:none}
.nw-brand-mark{font-size:16px}
.nw-brand-name{font-weight:650;letter-spacing:.04em}
.nw-brand-page{color:var(--nw-fg-3);font-size:12px;padding-left:8px;border-left:1px solid var(--nw-line)}
.nw-top-mid{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
.nw-top-mid .nw-input{min-width:180px;max-width:260px}
.nw-top-stat{color:var(--nw-fg-3);font-size:12px;border:1px solid var(--nw-line);border-radius:999px;padding:1px 9px;white-space:nowrap}
.nw-top-cost{color:var(--nw-amber);border-color:var(--nw-amber-soft);background:var(--nw-amber-soft)}
.nw-top-right{display:flex;align-items:center;gap:8px;flex:none}
.nw-top-hint{color:var(--nw-fg-3);font-size:11.5px;white-space:nowrap;padding-right:2px}
.nw-top-hint-on{color:var(--nw-teal)}

/* ── 主体 ── */
.nw-body{flex:1;min-height:0;overflow:auto;padding:14px 16px 8px}
.nw-page{display:flex;flex-direction:column;gap:14px;min-height:0;max-width:1360px;margin:0 auto}
.nw-cockpit{max-width:1360px}
.nw-review{max-width:1360px}

/* ── 底栏：只放导航，且居中 ── */
.nw-bottom{display:flex;align-items:center;justify-content:center;padding:8px 16px;border-top:1px solid var(--nw-line);background:var(--nw-bg-1);flex:none}
.nw-dock{display:flex;gap:2px;flex:none;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:999px;padding:3px}
.nw-dock-btn{position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 12px;border-radius:999px;color:var(--nw-fg-3);font-size:11px}
.nw-dock-btn:hover{color:var(--nw-fg-2)}
.nw-dock-btn.on{background:var(--nw-amber-soft);color:var(--nw-amber)}
.nw-dock-icon{font-size:13px;line-height:1.2}
.nw-dock-label{line-height:1.3}
.nw-dock-badge{position:absolute;top:1px;right:3px;background:var(--nw-red);color:#fff;font-size:9px;line-height:1.35;border-radius:999px;padding:0 4px}

/* ── 通用控件 ── */
.nw-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;border:1px solid var(--nw-line-2);color:var(--nw-fg);background:var(--nw-bg-2);transition:.12s}
.nw-btn:hover{border-color:var(--nw-amber);color:var(--nw-amber)}
.nw-btn-sm{padding:3px 9px;font-size:12px;border-radius:7px}
.nw-btn-primary{background:var(--nw-amber);border-color:var(--nw-amber);color:#1a1408;font-weight:600}
.nw-btn-primary:hover{filter:brightness(1.08);color:#1a1408}
.nw-btn-ghost{background:transparent}
.nw-btn-danger{border-color:var(--nw-red-soft);color:var(--nw-red);background:transparent}
.nw-btn-danger:hover{background:var(--nw-red-soft);border-color:var(--nw-red);color:var(--nw-red)}
.nw-btn:disabled{opacity:.45;cursor:not-allowed}
.nw-tag{display:inline-flex;align-items:center;padding:1px 7px;border-radius:999px;font-size:11px;white-space:nowrap}
.nw-tag-amber{background:var(--nw-amber-soft);color:var(--nw-amber)}
.nw-tag-teal{background:var(--nw-teal-soft);color:var(--nw-teal)}
.nw-tag-red{background:var(--nw-red-soft);color:var(--nw-red)}
.nw-tag-green{background:var(--nw-green-soft);color:var(--nw-green)}
.nw-tag-blue{background:var(--nw-blue-soft);color:var(--nw-blue)}
.nw-tag-grey{background:var(--nw-bg-3);color:var(--nw-fg-3)}
.nw-input{width:100%;padding:6px 10px;border-radius:8px;border:1px solid var(--nw-line-2);background:var(--nw-bg);color:var(--nw-fg);font:inherit;outline:none}
.nw-input:focus{border-color:var(--nw-amber)}
.nw-textarea{resize:vertical;line-height:1.75}
.nw-field{display:flex;flex-direction:column;gap:4px}
.nw-field > label{font-size:11px;color:var(--nw-fg-3);letter-spacing:.03em}
.nw-hint{color:var(--nw-fg-3);font-size:12px}
.nw-warn{color:var(--nw-red);font-size:12px}
.nw-mono{font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
.nw-empty{color:var(--nw-fg-3);font-size:12px;padding:16px;text-align:center;border:1px dashed var(--nw-line);border-radius:var(--nw-radius)}
.nw-loading{display:flex;align-items:center;gap:8px;color:var(--nw-fg-3);font-size:12px;padding:20px}
.nw-spin{width:12px;height:12px;border:2px solid var(--nw-line-2);border-top-color:var(--nw-amber);border-radius:50%;animation:nw-spin .7s linear infinite}
@keyframes nw-spin{to{transform:rotate(360deg)}}
.nw-error{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--nw-red-soft);color:var(--nw-red);font-size:12px}
.nw-bar{display:block;height:5px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-bar > i{display:block;height:100%;border-radius:999px;background:var(--nw-amber)}
.nw-bar-red > i{background:var(--nw-red)}
.nw-bar-green > i{background:var(--nw-green)}
.nw-switch{width:34px;height:18px;border-radius:999px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);position:relative;transition:.15s}
.nw-switch.on{background:var(--nw-amber);border-color:var(--nw-amber)}
.nw-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--nw-fg);transition:.15s}
.nw-switch.on::after{left:18px;background:#1a1408}
.nw-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nw-seg{display:flex;gap:2px;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:8px;padding:3px}
.nw-seg-btn{display:flex;align-items:center;gap:5px;padding:3px 11px;border-radius:6px;font-size:12px;color:var(--nw-fg-3)}
.nw-seg-btn.on{background:var(--nw-bg-1);color:var(--nw-amber);box-shadow:0 1px 2px rgba(0,0,0,.3)}
.nw-seg-n{font-size:10px;opacity:.7}
.nw-link{color:var(--nw-blue);font-size:12px;padding:0 4px}
.nw-link-danger{color:var(--nw-red)}
.nw-icon-btn{width:24px;height:24px;border-radius:6px;color:var(--nw-fg-3)}
.nw-icon-btn:hover{background:var(--nw-bg-3);color:var(--nw-fg)}

/* ── 卡片 ── */
.nw-card{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.nw-card-head{display:flex;align-items:center;gap:10px}
.nw-card-line{flex:1;height:1px;background:var(--nw-line)}
.nw-card-badge{font-size:11px;color:var(--nw-fg-3);border:1px solid var(--nw-line);border-radius:999px;padding:0 7px}
.nw-card-debt{border-color:var(--nw-red-soft)}
.nw-kv-wrap{display:flex;flex-direction:column;gap:5px}
.nw-kv{display:flex;gap:10px;font-size:12px}
.nw-kv-k{color:var(--nw-fg-3);min-width:78px;flex:none}
.nw-kv-v{color:var(--nw-fg-2);word-break:break-all}
.nw-cols{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px;align-items:start}
.nw-col-side{display:flex;flex-direction:column;gap:14px;min-width:0}

/* ── 驾驶舱 ── */
.nw-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:linear-gradient(135deg,var(--nw-bg-2),var(--nw-bg-1))}
.nw-hero-left{display:flex;flex-direction:column;gap:7px;min-width:0}
.nw-hero-tags{display:flex;gap:6px;flex-wrap:wrap}
.nw-hero-right{display:flex;gap:8px;flex:none}
.nw-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.nw-stat{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 13px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);text-align:left}
.nw-stat:hover{border-color:var(--nw-line-2)}
.nw-stat-label{font-size:11px;color:var(--nw-fg-3)}
.nw-stat-value{font-size:23px;font-weight:650;line-height:1.15}
.nw-stat-value em{font-size:11px;font-style:normal;color:var(--nw-fg-3);margin-left:3px;font-weight:400}
.nw-stat-hint{font-size:11px;color:var(--nw-fg-3)}
.nw-stat-amber .nw-stat-value{color:var(--nw-amber)}
.nw-stat-teal .nw-stat-value{color:var(--nw-teal)}
.nw-stat-red .nw-stat-value{color:var(--nw-red)}
.nw-stat-green .nw-stat-value{color:var(--nw-green)}
.nw-stat-blue .nw-stat-value{color:var(--nw-blue)}
.nw-debt-list{display:flex;flex-direction:column;gap:6px}
.nw-debt{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--nw-line);background:var(--nw-bg-2);text-align:left}
.nw-debt:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-debt-dot{width:7px;height:7px;border-radius:50%;flex:none}
.nw-dot-red{background:var(--nw-red)}
.nw-dot-orange{background:var(--nw-amber)}
.nw-dot-yellow{background:var(--nw-blue)}
.nw-dot-grey{background:var(--nw-fg-3)}
.nw-debt-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.nw-debt-title{font-size:12.5px;font-weight:600}
.nw-debt-sub{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-debt-go{color:var(--nw-fg-3);flex:none}
.nw-suggest{font-size:13px;color:var(--nw-amber);padding:8px 10px;border-radius:8px;background:var(--nw-amber-soft)}
.nw-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-recent{display:flex;flex-direction:column;gap:4px}
.nw-recent-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:7px;text-align:left}
.nw-recent-row:hover{background:var(--nw-bg-3)}
.nw-recent-n{color:var(--nw-fg-3);font-size:11.5px;min-width:56px;flex:none}
.nw-recent-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.nw-recent-score{font-size:12px;font-weight:600;flex:none}
.nw-score-good{color:var(--nw-green)}
.nw-score-mid{color:var(--nw-amber)}
.nw-score-bad{color:var(--nw-red)}

/* ── 生产台 ── */
.nw-studio-cols{display:grid;grid-template-columns:230px minmax(0,1fr) 270px;gap:12px;align-items:start}
.nw-tpl-panel{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);display:flex;flex-direction:column;overflow:hidden}
.nw-tpl-head{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border-bottom:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-3)}
.nw-tpl-list{display:flex;flex-direction:column;padding:6px;gap:4px;max-height:520px;overflow:auto}
.nw-tpl{display:flex;flex-direction:column;gap:2px;padding:7px 9px;border-radius:7px;text-align:left;border:1px solid transparent}
.nw-tpl:hover{background:var(--nw-bg-3);border-color:var(--nw-line-2)}
.nw-tpl-name{font-size:12.5px;font-weight:600}
.nw-tpl-intent{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tpl-used{font-size:10px;color:var(--nw-fg-3)}
.nw-order{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-order-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.nw-order-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:4px;border-top:1px solid var(--nw-line)}
.nw-ctx{display:flex;flex-direction:column;gap:6px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg)}
.nw-ctx-over{border-color:var(--nw-red-soft)}
.nw-ctx-head{display:flex;justify-content:space-between;font-size:11.5px;color:var(--nw-fg-3)}
.nw-ctx-total{font-family:ui-monospace,Consolas,monospace}
.nw-ctx-total.nw-over{color:var(--nw-red)}
.nw-ctx-list{display:flex;flex-direction:column;gap:2px}
.nw-ctx-row{display:flex;align-items:center;gap:8px;font-size:11.5px;padding:2px 0}
.nw-ctx-kind{color:var(--nw-amber);min-width:52px;flex:none}
.nw-ctx-label{flex:1;min-width:0;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ctx-token{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-ctx-x{color:var(--nw-fg-3);flex:none;font-size:10px}
.nw-ctx-x:hover{color:var(--nw-red)}
.nw-queue{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);display:flex;flex-direction:column;gap:7px;padding:10px 11px}
.nw-queue-head{display:flex;align-items:center;justify-content:space-between;font-size:12px}
.nw-queue-list{display:flex;flex-direction:column;gap:4px;max-height:430px;overflow:auto}
.nw-q-row{display:flex;flex-direction:column;gap:3px;padding:6px 8px;border-radius:7px;border:1px solid var(--nw-line);background:var(--nw-bg-2)}
.nw-q-running{border-color:var(--nw-teal-soft)}
.nw-q-n{font-size:11.5px;color:var(--nw-fg-3)}
.nw-q-intent{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-q-acts{display:flex;gap:4px;margin-top:2px}

/* ── 大纲 ── */
.nw-plan{max-width:1360px}
.nw-plan-brief .nw-input{max-width:none}
.nw-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.nw-plan-field{min-width:0}
.nw-plan-wide{grid-column:1 / -1}
.nw-plan-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px solid var(--nw-line)}
.nw-plan-vols{display:flex;gap:2px;background:var(--nw-bg-2);border:1px solid var(--nw-line);border-radius:8px;padding:3px;flex-wrap:wrap}
.nw-plan-rows{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow:auto}
.nw-plan-row{display:grid;grid-template-columns:66px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:6px 8px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2)}
.nw-plan-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--nw-fg-3)}
.nw-plan-main{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.5fr) minmax(0,1fr);gap:6px;min-width:0}
.nw-plan-main .nw-input{font-size:11.5px;padding:4px 8px}

/* ── 验收台 ── */
.nw-rv-bar{display:flex;align-items:center;justify-content:space-between;gap:12px}
.nw-rv-list{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:var(--nw-radius);overflow:hidden;background:var(--nw-bg-1)}
.nw-rv-head,.nw-rv-row{display:grid;grid-template-columns:46px minmax(0,1fr) 84px 62px 128px 128px;gap:8px;align-items:center;padding:7px 12px}
.nw-rv-head{background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-3);border-bottom:1px solid var(--nw-line)}
.nw-rv-row{text-align:left;border-bottom:1px solid var(--nw-line);font-size:12px}
.nw-rv-row:last-child{border-bottom:0}
.nw-rv-row:hover{background:var(--nw-bg-2)}
.nw-rv-row.on{background:var(--nw-amber-soft)}
.nw-rv-n{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-rv-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-rv-words{color:var(--nw-fg-3);font-size:11.5px}
.nw-rv-issues{display:flex;gap:4px;align-items:center}
.nw-score{display:flex;align-items:center;gap:6px}
.nw-score .nw-bar{flex:1;min-width:38px}
.nw-score-n{font-size:12px;font-style:normal;font-weight:600}
.nw-rv-detail{display:flex;flex-direction:column;gap:10px}
/* 【12 条 #11】阅读模式：正文单栏占满，字号提一档、行距放松，眼睛不用来回扫。 */
.nw-rv-detail.nw-rv-read{max-width:820px;margin:0 auto}
.nw-rv-detail.nw-rv-read .nw-paras,.nw-rv-detail.nw-rv-read .nw-textarea{font-size:15.5px;line-height:2.1}
.nw-rv-detail-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.nw-rv-detail-head > div:first-child{display:flex;align-items:baseline;gap:10px}
.nw-rv-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;align-items:start}
.nw-rv-doc{display:flex;flex-direction:column;gap:9px}
.nw-rv-doc .nw-textarea{font-family:Georgia,"Songti SC","SimSun",serif;font-size:14px;line-height:2;background:var(--nw-bg-1)}
.nw-rv-acts{display:flex;gap:8px;flex-wrap:wrap}
.nw-rv-side{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-score-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.nw-score-cell{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border-radius:7px;background:var(--nw-bg-2)}
.nw-score-cell em{font-style:normal;font-size:15px;font-weight:650;color:var(--nw-amber)}
.nw-score-cell span{font-size:10px;color:var(--nw-fg-3)}
.nw-score-total{display:flex;align-items:center;gap:10px;font-size:12px}
.nw-score-total .nw-score{flex:1}
.nw-issues{display:flex;flex-direction:column;gap:5px;max-height:280px;overflow:auto}
.nw-issue{display:flex;align-items:flex-start;gap:7px;padding:6px 8px;border-radius:7px;background:var(--nw-bg-2);font-size:11.5px}
.nw-issue-violation{background:var(--nw-red-soft)}
.nw-issue-n{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-issue-body{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.nw-issue-text{color:var(--nw-fg-2)}
.nw-issue-quote{color:var(--nw-fg-3);font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-issue-sev{color:var(--nw-fg-3);font-size:10px;flex:none}
.nw-audit{font-size:11px;color:var(--nw-fg-2);white-space:pre-wrap;background:var(--nw-bg-2);padding:8px;border-radius:7px;max-height:200px;overflow:auto}

/* ── 验收台的两个抽屉：提案 / 问题单 ── */
.nw-board{display:flex;flex-direction:column;gap:10px}
.nw-prop-list,.nw-prob-list{display:flex;flex-direction:column;gap:8px}
.nw-prop{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:9px 11px;display:flex;flex-direction:column;gap:6px}
.nw-prop-accepted{border-color:var(--nw-green-soft)}
.nw-prop-rejected{opacity:.72}
.nw-prop-head{display:flex;align-items:center;gap:8px;width:100%;text-align:left}
.nw-prop-n{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:var(--nw-fg-3);flex:none}
.nw-prop-title{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prop-go{color:var(--nw-fg-3);font-size:11px;flex:none}
.nw-prop-body{display:flex;flex-direction:column;gap:7px;padding:6px 0 2px}
.nw-prop-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:5px;border-top:1px solid var(--nw-line)}
.nw-diff{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:start}
.nw-diff-n{font-family:ui-monospace,Consolas,monospace;font-size:10.5px;color:var(--nw-fg-3);padding-top:6px}
.nw-diff-cols{display:grid;grid-template-columns:1fr 1fr;gap:7px;min-width:0}
.nw-diff-cell{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:7px;font-size:11.5px;line-height:1.7;min-width:0}
.nw-diff-before{background:var(--nw-red-soft)}
.nw-diff-after{background:var(--nw-green-soft)}
.nw-diff-tag{font-size:10px;color:var(--nw-fg-3)}
.nw-diff-why{grid-column:2;color:var(--nw-fg-3);font-size:10.5px}

.nw-prob{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;align-items:center;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-1);padding:7px 10px}
.nw-prob-fixed{opacity:.66}
.nw-prob-ignored{opacity:.5}
.nw-prob-main{display:flex;align-items:center;gap:7px;text-align:left;min-width:0}
.nw-prob-n{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--nw-fg-3);flex:none}
.nw-prob-text{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prob-quote{grid-column:1;font-size:10.5px;color:var(--nw-fg-3);padding-left:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-prob-acts{display:flex;gap:5px;flex:none}

/* ── 世界库 ── */
.nw-ws-banner{display:flex;align-items:flex-start;gap:10px;padding:10px 13px;border:1px solid var(--nw-amber-soft);border-radius:var(--nw-radius);background:var(--nw-amber-soft)}
.nw-ws-label{color:var(--nw-amber);font-size:11.5px;flex:none;font-weight:600}
.nw-ws-text{flex:1;min-width:0;font-size:12px;color:var(--nw-fg-2);line-height:1.65}
.nw-world-body{display:grid;grid-template-columns:186px minmax(0,1fr);gap:12px;align-items:start}
.nw-world-nav{display:flex;flex-direction:column;gap:2px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:6px}
.nw-world-nav-btn{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:7px;font-size:12.5px;color:var(--nw-fg-2);text-align:left}
.nw-world-nav-btn:hover{background:var(--nw-bg-3)}
.nw-world-nav-btn.on{background:var(--nw-amber-soft);color:var(--nw-amber);font-weight:600}
.nw-world-nav-icon{font-size:12px;width:16px;flex:none}
.nw-world-nav-n{margin-left:auto;font-size:10.5px;color:var(--nw-fg-3)}
.nw-world-nav-foot{padding:7px 9px;border-top:1px solid var(--nw-line);margin-top:3px;font-size:10.5px;color:var(--nw-fg-3)}
.nw-world-main{display:flex;flex-direction:column;gap:10px;min-width:0}
.nw-world-bar{display:flex;align-items:center;justify-content:space-between;gap:10px}
.nw-table{border:1px solid var(--nw-line);border-radius:var(--nw-radius);overflow:hidden;background:var(--nw-bg-1)}
.nw-table-head,.nw-table-row{display:grid;gap:8px;align-items:center;padding:7px 11px}
.nw-table-head{background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-3);border-bottom:1px solid var(--nw-line)}
.nw-table-row{border-bottom:1px solid var(--nw-line);font-size:12px}
.nw-table-row:last-child{border-bottom:0}
.nw-table-row:hover{background:var(--nw-bg-2)}
.nw-td{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-td-strong{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-td-acts{display:flex;gap:4px}
.nw-graph{border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:8px}
.nw-graph-svg{width:100%;height:auto;display:block}
.nw-graph-text{fill:var(--nw-fg);font-size:12px;font-weight:600}
.nw-graph-sub{fill:var(--nw-fg-3);font-size:10px}
.nw-timeline{position:relative;display:flex;flex-direction:column;gap:2px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);padding:10px 12px}
.nw-tl-rail{position:absolute;left:25px;top:16px;bottom:16px;width:1px;background:var(--nw-line-2)}
.nw-tl-row{display:grid;grid-template-columns:12px 72px minmax(0,1fr) 110px;gap:9px;align-items:center;padding:5px 0;position:relative}
.nw-tl-dot{width:7px;height:7px;border-radius:50%;background:var(--nw-amber);justify-self:center;z-index:1}
.nw-tl-n{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-tl-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-tl-title{font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tl-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-tl-bar{height:4px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-tl-bar > i{display:block;height:100%;background:var(--nw-amber-soft)}

/* ── 侦察 ── */
.nw-scout-lead{color:var(--nw-fg-2);font-size:12.5px;padding:10px 12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-scout-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.nw-scout-card{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-scout-head{display:flex;align-items:center;gap:8px}
.nw-scout-icon{font-size:16px}
.nw-scout-desc{font-size:12px;color:var(--nw-fg-2);line-height:1.65;flex:1}
.nw-scout-meta{display:flex;flex-direction:column;gap:3px}
.nw-cmd{font-size:11.5px;color:var(--nw-fg-2);white-space:pre-wrap;background:var(--nw-bg-2);padding:9px;border-radius:7px;max-height:220px;overflow:auto;line-height:1.7}

/* ── 设置 ── */
.nw-settings{max-width:900px}
.nw-proj-list{display:flex;flex-direction:column;gap:4px}
.nw-proj{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:8px;border:1px solid var(--nw-line);background:var(--nw-bg-2);text-align:left}
.nw-proj.on{border-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-proj-name{font-size:12.5px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-proj-meta{font-size:11px;color:var(--nw-fg-3);flex:none}
.nw-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.nw-danger-zone{border:1px solid var(--nw-red-soft);border-radius:8px;padding:9px 11px}
.nw-danger-zone summary{color:var(--nw-red);font-size:12px;cursor:pointer}
.nw-danger-zone[open] summary{margin-bottom:7px}
.nw-switch-row{display:flex;align-items:center;justify-content:space-between;font-size:12.5px}

/* ── 弹层与通知 ── */
.nw-modal-mask{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);padding:24px}
.nw-modal{width:min(560px,96vw);max-height:86vh;display:flex;flex-direction:column;border-radius:12px;border:1px solid var(--nw-line-2);background:var(--nw-bg-1);box-shadow:0 24px 64px rgba(0,0,0,.45)}
.nw-modal-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--nw-line)}
.nw-modal-body{display:flex;flex-direction:column;gap:10px;padding:14px;overflow:auto}
.nw-modal-foot{display:flex;justify-content:flex-end;gap:8px;padding:11px 14px;border-top:1px solid var(--nw-line)}
.nw-toast-wrap{position:fixed;right:18px;bottom:66px;z-index:90;display:flex;flex-direction:column;gap:6px;pointer-events:none}
.nw-toast{display:flex;align-items:center;gap:7px;padding:7px 13px;border-radius:8px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);color:var(--nw-fg);font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35);animation:nw-toast-in .18s ease-out}
.nw-toast-mark{color:var(--nw-amber)}
@keyframes nw-toast-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.nw-panel-glyph{display:inline-flex;align-items:center;justify-content:center;line-height:1}

/* ══════════════════════════════════════════════════════════
   界面增补（24 条）—— 纯展示层，全部假数据驱动
   ══════════════════════════════════════════════════════════ */

/* ── #1 状态灯 ── */
.nw-lamp{display:flex;align-items:center;gap:7px;padding:5px 10px;border-radius:999px;border:1px solid var(--nw-line);background:var(--nw-bg-2);flex:none;text-align:left}
.nw-lamp:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-lamp-dot{width:8px;height:8px;border-radius:50%;background:var(--nw-fg-3);flex:none}
.nw-lamp.on .nw-lamp-dot{background:var(--nw-green);box-shadow:0 0 0 0 rgba(74,160,122,.7);animation:nw-pulse 1.6s infinite}
@keyframes nw-pulse{0%{box-shadow:0 0 0 0 rgba(74,160,122,.55)}70%{box-shadow:0 0 0 7px rgba(74,160,122,0)}100%{box-shadow:0 0 0 0 rgba(74,160,122,0)}}
.nw-lamp-body{display:flex;flex-direction:column;gap:0;line-height:1.25}
.nw-lamp-text{font-size:11.5px;color:var(--nw-fg)}
.nw-lamp-sub{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-cmdk-open{flex:none}

/* ── #2 底栏右侧按钮 + 居中 ── */
.nw-bottom-pad{flex:1 1 0;min-width:120px}
.nw-bottom-acts{flex:1 1 0;display:flex;justify-content:flex-end;gap:6px;min-width:120px}
.nw-bottom-btn{white-space:nowrap}

/* ── #3 命令面板 ── */
.nw-cmdk-list{display:flex;flex-direction:column;gap:2px;margin-top:8px;max-height:320px;overflow:auto}
.nw-cmdk-row{display:grid;grid-template-columns:22px minmax(0,1fr) minmax(0,1.2fr) 18px;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;border:1px solid transparent;text-align:left}
.nw-cmdk-row:hover,.nw-cmdk-row.on{background:var(--nw-bg-2);border-color:var(--nw-line-2)}
.nw-cmdk-icon{font-size:14px;text-align:center}
.nw-cmdk-label{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cmdk-hint{font-size:11px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cmdk-go{font-size:11px;color:var(--nw-fg-3);text-align:right}
.nw-cmdk-row.on .nw-cmdk-go{color:var(--nw-amber)}

/* ── #4 行动卡 / 今日一句 ── */
.nw-action{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:9px;padding:12px 14px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:linear-gradient(135deg,var(--nw-teal-soft),var(--nw-bg-1))}
.nw-action.nw-action-warn{background:linear-gradient(135deg,var(--nw-amber-soft),var(--nw-bg-1));border-color:var(--nw-amber)}
.nw-action-main{display:flex;flex-direction:column;gap:2px;font-size:13.5px;color:var(--nw-fg);line-height:1.7;min-width:0}
.nw-action-title{font-weight:600;margin:0;font-size:14px}
.nw-action-sub{font-size:12px;color:var(--nw-fg-2);line-height:1.6}
.nw-action-cap{font-size:11px;color:var(--nw-fg-3)}

/* ── #5 两周柱状图 ── */
.nw-days{display:flex;flex-direction:column;gap:6px;padding:2px 0 4px}
.nw-days-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:11.5px;color:var(--nw-fg-2)}
.nw-days-bars{display:flex;align-items:flex-end;gap:3px;height:56px;padding:0 1px;border-bottom:1px solid var(--nw-line)}
.nw-day{flex:1 1 0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px;height:100%;padding:0;min-width:0}
.nw-day-fill{display:block;width:100%;border-radius:2px 2px 0 0;background:var(--nw-amber-soft);border:1px solid var(--nw-line-2);border-bottom:0;transition:.12s}
.nw-day-ok .nw-day-fill{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-day-off .nw-day-fill{background:repeating-linear-gradient(45deg,var(--nw-bg-3),var(--nw-bg-3) 3px,transparent 3px,transparent 6px);border-color:var(--nw-line)}
.nw-day:hover .nw-day-fill{filter:brightness(1.25)}
.nw-day-label{font-size:9px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-days-rule{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #6 全书进度条 ── */
.nw-progress{display:flex;flex-direction:column;gap:7px;padding:10px 12px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1)}
.nw-progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.nw-progress-num{font-size:13px;font-weight:600;font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg)}
.nw-progress-meta{font-size:11px;color:var(--nw-fg-3)}
.nw-progress-track{display:flex;gap:1px;height:16px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-progress-vol{position:relative;display:flex;align-items:center;justify-content:center;min-width:0;padding:0;background:transparent;border:0}
.nw-progress-fill{position:absolute;inset:0 auto 0 0;background:var(--nw-amber-soft);border-right:1px solid var(--nw-amber);transition:.15s}
.nw-progress-vol:hover .nw-progress-fill{background:var(--nw-amber-soft);filter:brightness(1.3)}
.nw-progress-sep{position:absolute;left:0;top:0;bottom:0;width:1px;background:var(--nw-line-2);z-index:1}
.nw-progress-name{position:relative;z-index:2;font-size:9.5px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
.nw-progress-foot{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #7/#8 大纲卡片墙 / 三视图 ── */
.nw-plan-viewbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.nw-plan-brief{font-size:11.5px;color:var(--nw-fg-3)}
.nw-pcards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.nw-pcard{display:flex;flex-direction:column;gap:6px;padding:10px 11px;border:1px solid var(--nw-line);border-radius:var(--nw-radius);background:var(--nw-bg-1);text-align:left;min-height:132px}
.nw-pcard:hover{border-color:var(--nw-amber);background:var(--nw-bg-2)}
.nw-pcard.is-empty,.nw-pcard.nw-pcard-empty{border-style:dashed;background:transparent}
.nw-pcard.nw-pcard-done{border-color:var(--nw-green)}
.nw-pcard.nw-pcard-done .nw-pcard-n{color:var(--nw-green)}
.nw-pcard-head{display:flex;align-items:center;justify-content:space-between;gap:6px}
.nw-pcard-n{font-size:11px;color:var(--nw-amber);font-family:ui-monospace,Consolas,monospace}
.nw-pcard-title{font-size:13px;font-weight:600;color:var(--nw-fg);line-height:1.45}
.nw-pcard-sum{font-size:11.5px;color:var(--nw-fg-2);line-height:1.6;flex:1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.nw-pcard-hook{display:flex;gap:5px;align-items:baseline;font-size:11px;color:var(--nw-teal)}
.nw-pcard-hook-k{color:var(--nw-fg-3);flex:none}
.nw-pcard-foot{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:10.5px;color:var(--nw-fg-3)}
.nw-pcard-ph{font-size:11px;color:var(--nw-fg-3);font-style:italic}
/* 时间线视图 */
.nw-ptl{display:flex;flex-direction:column;gap:0;padding-left:8px}
.nw-ptl-vol{display:flex;flex-direction:column;gap:5px;padding:8px 0 8px 14px;border-left:2px solid var(--nw-line-2);position:relative}
.nw-ptl-vol:hover{border-left-color:var(--nw-amber)}
.nw-ptl-head{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--nw-fg);font-weight:600}
.nw-ptl-rail{display:flex;flex-wrap:wrap;gap:3px;align-items:center}
.nw-ptl-dot{width:14px;height:14px;border-radius:4px;border:1px solid var(--nw-line-2);background:var(--nw-bg-3);padding:0;font-size:0}
.nw-ptl-dot:hover{transform:scale(1.25);border-color:var(--nw-amber)}
.nw-ptl-dot.nw-ptl-drafted{background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-ptl-dot.nw-ptl-written{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-ptl-dot.done{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-ptl-dot.cur{background:var(--nw-amber-soft);border-color:var(--nw-amber);box-shadow:0 0 0 2px var(--nw-amber-soft)}

/* ── #9 AI 填整卷摘要 ── */
.nw-fillbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;border:1px dashed var(--nw-line-2);border-radius:9px;background:var(--nw-bg-2)}
.nw-fillbar-main{display:flex;flex-direction:column;gap:2px;min-width:0}
.nw-fillbar-title{font-size:12px;color:var(--nw-fg)}
.nw-fillbar-sub{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #10 上下文可拖可关 / #11 预算条 ── */
.nw-ctx-grip{cursor:grab;color:var(--nw-fg-3);font-size:11px;padding:0 2px;user-select:none}
.nw-ctx-grip:active{cursor:grabbing}
.nw-ctx-row.dragging{opacity:.45;border-style:dashed}
.nw-ctx-row.drop-target{border-color:var(--nw-amber);box-shadow:0 0 0 2px var(--nw-amber-soft)}
.nw-ctx-row.off,.nw-ctx-row.nw-ctx-off{opacity:.42;text-decoration:line-through}
.nw-ctx-sw{width:26px;height:14px;border-radius:999px;background:var(--nw-bg-3);border:1px solid var(--nw-line-2);position:relative;flex:none;transition:.12s}
.nw-ctx-sw::after{content:'';position:absolute;top:1px;left:1px;width:10px;height:10px;border-radius:50%;background:var(--nw-fg-3);transition:.12s}
.nw-ctx-sw.on{background:var(--nw-teal-soft);border-color:var(--nw-teal)}
.nw-ctx-sw.on::after{left:13px;background:var(--nw-teal)}
.nw-ctx-meter{display:flex;flex-direction:column;gap:3px;padding-top:6px;border-top:1px solid var(--nw-line)}
.nw-ctx-foot{display:flex;align-items:center;justify-content:space-between;font-size:10.5px;color:var(--nw-fg-3)}
/* 预算三档色（复用 .nw-bar 容器） */
.nw-budget{display:flex;flex-direction:column;gap:5px}
.nw-budget .nw-bar > i.ok{background:var(--nw-green)}
.nw-budget .nw-bar > i.warn{background:var(--nw-amber)}
.nw-budget .nw-bar > i.bad{background:var(--nw-red)}

/* ── #12 意图复用 ── */
.nw-chips{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:6px 0 0}
.nw-chips-label{font-size:10.5px;color:var(--nw-fg-3);flex:none}
.nw-chip{max-width:220px;padding:3px 9px;border-radius:999px;border:1px solid var(--nw-line-2);background:var(--nw-bg-2);font-size:11px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;transition:.12s}
.nw-chip:hover{border-color:var(--nw-amber);color:var(--nw-amber);background:var(--nw-amber-soft)}

/* ── #13 正文右侧彩带 ── */
.nw-rv-docbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px}
.nw-rv-pick{font-size:11px;color:var(--nw-amber);padding:2px 8px;border-radius:999px;background:var(--nw-amber-soft);border:1px solid var(--nw-amber);max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-heat{display:flex;align-items:flex-end;gap:6px;padding:6px 8px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2)}
.nw-heat-title{font-size:10px;color:var(--nw-fg-3);flex:none;writing-mode:horizontal-tb}
.nw-heat-track{display:flex;flex:1 1 auto;gap:2px;height:22px;min-width:0}
.nw-heat-cell{flex:1 1 0;min-width:3px;border-radius:2px;border:1px solid var(--nw-line-2);background:var(--nw-bg-3);transition:.1s}
.nw-heat-good{background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-heat-warn{background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-heat-bad{background:var(--nw-red-soft);border-color:var(--nw-red)}
.nw-heat-cell:hover{filter:brightness(1.4)}
.nw-heat-cell.on{outline:2px solid var(--nw-fg);outline-offset:1px}
.nw-heat-legend{display:flex;gap:6px;align-items:center;flex:none}
.nw-heat-key{font-size:9.5px;color:var(--nw-fg-3);padding:1px 5px;border-radius:999px;border:1px solid transparent}
.nw-heat-key.nw-heat-good{border-color:var(--nw-green);color:var(--nw-green)}
.nw-heat-key.nw-heat-warn{border-color:var(--nw-amber);color:var(--nw-amber)}
.nw-heat-key.nw-heat-bad{border-color:var(--nw-red);color:var(--nw-red)}

/* ── #14 段落视图 + 点亮 ── */
.nw-para-list{display:flex;flex-direction:column;gap:2px;padding:2px 2px 6px;max-height:52vh;overflow:auto}
.nw-para{position:relative;padding:6px 10px 6px 30px;border-radius:7px;border-left:2px solid transparent;font-size:14px;line-height:2;color:var(--nw-fg);cursor:pointer;background:none;border-top:0;border-right:0;border-bottom:0;width:100%;text-align:left;font-family:inherit}
.nw-para:hover{background:var(--nw-bg-2)}
.nw-para:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-para-n{position:absolute;left:8px;top:8px;font-size:9.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-para-on{border-left-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-para-bad{border-left-color:var(--nw-red-soft)}
.nw-para-warn{border-left-color:var(--nw-amber-soft)}
.nw-para-on.nw-para-bad{border-left-color:var(--nw-red);box-shadow:inset 0 0 0 1px var(--nw-red-soft)}
.nw-para-on.nw-para-warn{border-left-color:var(--nw-amber)}
.nw-issue.active,.nw-issue.nw-issue-on{background:var(--nw-amber-soft);box-shadow:inset 0 0 0 1px var(--nw-amber)}
.nw-keys{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--nw-line);border-radius:5px}

/* ── #16 提案按章折叠 / 批量 ── */
.nw-prop-group{display:flex;flex-direction:column;gap:6px;margin-bottom:8px}
.nw-prop-group-head{display:flex;align-items:center;gap:8px;padding:5px 9px;border-radius:7px;background:var(--nw-bg-2);border:1px solid var(--nw-line);text-align:left;width:100%}
.nw-prop-group-head:hover{border-color:var(--nw-line-2)}
.nw-prop-fold{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px dashed var(--nw-line-2);background:var(--nw-bg-2);text-align:left;width:100%;margin-bottom:6px}
.nw-prop-fold:hover{border-color:var(--nw-amber);background:var(--nw-bg-3)}
.nw-prop-fold-n{font-size:11.5px;color:var(--nw-amber);font-family:ui-monospace,Consolas,monospace;flex:none}

/* ── #18 账本格可点 ── */
.nw-td-cell{display:flex;align-items:center;gap:4px;min-width:0;text-align:left;padding:0;color:var(--nw-fg-2)}
.nw-td-cell:hover .nw-td-value{color:var(--nw-amber);text-decoration:underline dotted}
.nw-td-cell:hover .nw-td-pin{opacity:1}
.nw-td-value{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.nw-td-pin{flex:none;font-size:9px;color:var(--nw-amber);opacity:0;transition:.1s}
.nw-td-strong{font-weight:600;color:var(--nw-fg)}
.nw-source{display:flex;flex-direction:column;gap:9px}
.nw-source-quote{font-size:13px;line-height:1.9;color:var(--nw-fg);padding:9px 11px;border-left:2px solid var(--nw-amber);background:var(--nw-bg-2);border-radius:0 7px 7px 0}

/* ── #19 关系图过滤 ── */
.nw-graph-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-bottom:6px}
.nw-tl-ok{font-size:11.5px;color:var(--nw-green);padding:4px 9px;border-radius:7px;background:var(--nw-green-soft);border:1px solid var(--nw-green);display:inline-block}

/* ── #20 逾期伏笔 ── */
.nw-tl-overdue{display:flex;flex-direction:column;gap:4px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--nw-red);border-radius:9px;background:var(--nw-red-soft)}
.nw-tl-overdue-title{font-size:11.5px;color:var(--nw-red);font-weight:600}
.nw-tl-overdue-row{display:flex;flex-direction:column;gap:1px;padding:4px 7px;border-radius:6px;border:1px solid transparent;text-align:left;background:transparent}
.nw-tl-overdue-row:hover{border-color:var(--nw-red);background:var(--nw-bg-1)}
.nw-tl-overdue-name{font-size:12px;color:var(--nw-fg)}
.nw-tl-overdue-sub{font-size:10.5px;color:var(--nw-fg-3)}

/* ── #21 最近干过什么 ── */
.nw-hist{display:flex;flex-direction:column;gap:3px}
.nw-hist-row{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2);overflow:hidden}
.nw-hist-row.on{border-color:var(--nw-amber)}
.nw-hist-main{display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;padding:8px 10px;text-align:left}
.nw-hist-main:hover{background:var(--nw-bg-3)}
.nw-hist-icon{font-size:13px;text-align:center}
.nw-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-hist-title{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-hist-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-hist-at{font-size:10.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-2);background:var(--nw-bg-1)}

/* ── #22 扫榜表格 ── */
.nw-scan{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:9px;overflow:hidden;background:var(--nw-bg-1)}
.nw-scan-head,.nw-scan-row{display:grid;grid-template-columns:36px 62px minmax(0,1.4fr) 62px 76px minmax(0,1.6fr) 54px;align-items:center;gap:8px;padding:6px 10px}
.nw-scan-head{background:var(--nw-bg-2);border-bottom:1px solid var(--nw-line);position:sticky;top:0;z-index:1}
.nw-scan-th{text-align:left;font-size:10.5px;color:var(--nw-fg-3);padding:2px 0}
.nw-scan-th.on{color:var(--nw-amber)}
.nw-scan-th:hover{color:var(--nw-fg)}
.nw-scan-row{text-align:left;border-bottom:1px solid var(--nw-line);background:transparent}
.nw-scan-row:last-child{border-bottom:0}
.nw-scan-row:hover{background:var(--nw-bg-2)}
.nw-scan-td{font-size:11.5px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-scan-rank{font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg-3)}
.nw-scan-book{color:var(--nw-fg);font-weight:600}
.nw-scan-num{font-family:ui-monospace,Consolas,monospace;text-align:right}
.nw-scan-hook{color:var(--nw-fg-3);font-size:11px}
.nw-scan-trend{text-align:right;font-family:ui-monospace,Consolas,monospace}
.nw-scan-trend.up{color:var(--nw-green)}
.nw-scan-trend.down{color:var(--nw-red)}

/* ── #23 导出 ── */
.nw-export-tree{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);font-family:ui-monospace,Consolas,monospace}
.nw-export-row{display:grid;grid-template-columns:20px minmax(0,150px) minmax(0,1fr);align-items:center;gap:9px}
.nw-export-icon{font-size:11px;color:var(--nw-fg-3);text-align:center}
.nw-export-text{color:var(--nw-amber)}
.nw-export-name{font-size:11.5px;color:var(--nw-fg)}

/* ── #24 主题三档 ── */
.nw-theme-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.nw-theme-card{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);text-align:left}
.nw-theme-card.on{border-color:var(--nw-amber);box-shadow:0 0 0 1px var(--nw-amber)}
.nw-theme-swatch{height:22px;border-radius:6px;border:1px solid var(--nw-line-2);display:flex;align-items:center;justify-content:center;font-size:10px;color:#6b5d4a}
.nw-theme-dark .nw-theme-swatch{background:#191c21;border-color:#3a424e}
.nw-theme-light .nw-theme-swatch{background:#fffdfa}
.nw-theme-paper .nw-theme-swatch{background:#f0e8d8;font-family:Georgia,"Songti SC",serif}
.nw-theme-name{font-size:12px;color:var(--nw-fg)}
.nw-theme-hint{font-size:10px;color:var(--nw-fg-3)}

/* ── 【12 条】这轮补的四个小件 ── */

/* #6 月预算泡：本体是 button（点了给明细），里面叠一条 3px 进度。 */
.nw-budget{display:inline-flex;flex-direction:column;gap:4px;align-items:flex-start;cursor:pointer;font:inherit}
.nw-budget:hover{color:var(--nw-fg-1)}
.nw-budget-over{color:var(--nw-red);border-color:var(--nw-red)}
.nw-budget-bar{display:block;width:100%;min-width:64px;height:3px;border-radius:999px;background:var(--nw-bg-3);overflow:hidden}
.nw-budget-fill{display:block;height:100%;border-radius:999px;background:var(--nw-amber)}
.nw-budget-over .nw-budget-fill{background:var(--nw-red)}

/* #10 样例开关：空态也得有东西可点，但必须是你自己按的。 */
.nw-demo-sw{border:1px dashed var(--nw-line);border-radius:999px;background:transparent;color:var(--nw-fg-3);font:inherit;font-size:12px;padding:2px 10px;cursor:pointer}
.nw-demo-sw:hover{color:var(--nw-fg-1);border-color:var(--nw-fg-3)}
.nw-demo-sw.on{border-style:solid;border-color:var(--nw-amber);color:var(--nw-amber)}

/* #8 AI 味词表编辑器。 */
.nw-lex-add{display:grid;grid-template-columns:minmax(120px,1fr) minmax(160px,2fr) auto;gap:8px;align-items:center;margin:10px 0}
.nw-lex-list{display:flex;flex-direction:column;gap:4px;max-height:280px;overflow:auto}
.nw-lex-row{display:grid;grid-template-columns:minmax(80px,140px) 1fr auto auto;gap:8px;align-items:center;padding:5px 8px;border:1px solid var(--nw-line);border-radius:7px;background:var(--nw-bg-2)}
.nw-lex-row.nw-lex-off{opacity:.45}
.nw-lex-word{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:var(--nw-fg-1)}
.nw-lex-row.nw-lex-off .nw-lex-word{text-decoration:line-through}
.nw-lex-acts{display:flex;gap:4px}

/* 保存状态小签：以前跟键盘提示共用 nw-keys，两件事挤一个样式，
   smoke 里数「键盘提示条」会数到两个。拆开，外观保持一致。 */
.nw-save-state{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;padding:0 6px;border:1px solid var(--nw-line);border-radius:5px}
.nw-save-state.nw-dirty{color:var(--nw-amber);border-color:var(--nw-amber-soft);background:var(--nw-amber-soft)}

/* ── 页级容器补齐 ── */
.nw-scout,.nw-studio,.nw-world{display:flex;flex-direction:column;gap:12px;min-width:0}

/* ── 窄屏 ── */
@media (max-width:1000px){
  .nw-cols,.nw-rv-body{grid-template-columns:minmax(0,1fr)}
  .nw-studio-cols{grid-template-columns:minmax(0,1fr)}
  .nw-world-body{grid-template-columns:minmax(0,1fr)}
  .nw-world-nav{flex-direction:row;flex-wrap:wrap}
  .nw-world-nav-foot{display:none}
  .nw-order-grid{grid-template-columns:1fr 1fr}
  .nw-form-grid{grid-template-columns:1fr}
  .nw-plan-grid{grid-template-columns:1fr}
  .nw-plan-main{grid-template-columns:minmax(0,1fr)}
  .nw-plan-row{grid-template-columns:56px minmax(0,1fr)}
  .nw-diff-cols{grid-template-columns:1fr}
  .nw-top-right{flex-wrap:wrap;justify-content:flex-end}
}
/* ── 第 10 轮：搜索命中断、历史版本、回收站、派单话术、采纳前告警 ── */
.nw-cmdk-scope{display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid var(--nw-line)}
.nw-cmdk-head{padding:8px 12px 3px;font-size:11px;letter-spacing:.08em;color:var(--nw-fg-3);text-transform:uppercase}
.nw-cmdk-hit .nw-cmdk-label{color:var(--nw-fg)}
.nw-cmdk-hit .nw-cmdk-hint{font-family:var(--nw-mono,ui-monospace,monospace);font-size:11px}

.nw-hist-ver{display:flex;flex-direction:column;gap:6px}
.nw-ver-row{display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:6px;background:var(--nw-bg-2)}
.nw-ver-at{font-family:var(--nw-mono,ui-monospace,monospace);font-size:12px;color:var(--nw-fg-2);min-width:126px}
.nw-ver-w{font-size:11px;color:var(--nw-fg-3);min-width:56px}

.nw-trash-list{display:flex;flex-direction:column;gap:4px}
.nw-trash-row{display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:6px;background:var(--nw-bg-2)}
.nw-trash-n{font-size:12px;color:var(--nw-amber);min-width:56px}
.nw-trash-title{flex:1;font-size:12px;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-trash-w{font-size:11px;color:var(--nw-fg-3);min-width:52px}
.nw-trash-at{min-width:104px;font-family:var(--nw-mono,ui-monospace,monospace)}

.nw-dispatch{margin-top:10px;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2)}
.nw-dispatch-head{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid var(--nw-line);font-size:11px;color:var(--nw-fg-3)}
.nw-dispatch-body{margin:0;padding:10px;font-family:var(--nw-mono,ui-monospace,monospace);font-size:11.5px;line-height:1.7;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}

.nw-prop-warn{display:flex;flex-wrap:wrap;align-items:flex-start;gap:7px;margin-bottom:9px;padding:8px 10px;border-radius:7px;border:1px solid var(--nw-amber-d, #7a5a18);background:rgba(214,158,46,.1);font-size:12px;color:var(--nw-amber)}
.nw-prop-warn-icon{line-height:1.2}
.nw-prop-warn-list{margin:0;padding-left:18px;width:100%;list-style:disc}
.nw-prop-warn-list li{margin-top:2px;color:var(--nw-fg-2);font-size:11.5px}
.nw-heat-density{font-size:10px;color:var(--nw-fg-3)}


/* ── 【QA】撤销 / 重做 ──
   紧跟在「段落视图 / 编辑正文」两个分段按钮后面，不换行。 */
.nw-rv-undo{display:inline-flex;align-items:center;gap:5px;margin-left:2px}
.nw-undo-btn,.nw-redo-btn{font-variant-numeric:tabular-nums}
.nw-undo-btn[disabled],.nw-redo-btn[disabled]{opacity:.4}
.nw-undo-n{font-size:10.5px;color:var(--nw-fg-3);font-family:var(--nw-mono,ui-monospace,monospace);min-width:52px}

/* ── 【QA】弹窗无障碍 ──
   焦点搬进浮层后必须看得见落在哪个格子，否则键盘用户彻底迷路。
   只给 :focus-visible 描边，鼠标点击不会留一圈亮边。 */
.nw-modal:focus{outline:none}
.nw-modal:focus-visible{outline:2px solid var(--nw-amber);outline-offset:2px}
.nw-modal-mask .nw-modal button:focus-visible,
.nw-modal-mask .nw-modal input:focus-visible,
.nw-modal-mask .nw-modal textarea:focus-visible,
.nw-modal-mask .nw-modal select:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}

/* ── 【QA】预算拦截 ──
   掉在顶栏月预算泡旁边的一条小标，和它同一个色系。 */
.nw-budget-stop{display:inline-flex;align-items:center;gap:5px;padding:2px 7px;border-radius:5px;font-size:10.5px;border:1px solid var(--nw-line);color:var(--nw-fg-3)}
.nw-budget-stop.nw-budget-halt{border-color:var(--nw-red-d,#7a2a2a);background:rgba(220,80,80,.12);color:var(--nw-red,#e2685f)}
.nw-btn.nw-btn-halt{border-color:var(--nw-red-d,#7a2a2a);color:var(--nw-red,#e2685f)}

/* ── 更窄一档：平板竖屏 / 分屏 ──
   上一条 1000px 只把两栏叠成一栏，但顶栏、底栏、表格、工具栏那时还是横向铺开，
   768 宽就开始横向溢出。这一档专门收它们。 */
@media (max-width:720px){
  .nw-top{flex-direction:column;align-items:stretch;gap:6px}
  .nw-top-mid,.nw-top-right{flex-wrap:wrap;justify-content:flex-start;gap:6px}
  .nw-top-hint{order:-1;width:100%}
  .nw-bottom-pad{flex-direction:column;gap:5px}
  .nw-bottom-acts{width:100%;justify-content:center;flex-wrap:wrap}
  .nw-dock{gap:2px;overflow-x:auto;max-width:100%}
  .nw-dock-btn{padding:4px 5px;white-space:nowrap}
  .nw-stat-grid{grid-template-columns:1fr 1fr}
  .nw-actions{grid-template-columns:1fr}
  .nw-rv-docbar{flex-wrap:wrap;gap:5px}
  .nw-rv-acts{flex-wrap:wrap}
  .nw-heat{display:none}
  .nw-ledger-table,.nw-scan{overflow-x:auto}
  .nw-ledger-row,.nw-scan-row{min-width:560px}
  .nw-cmdk{left:8px;right:8px;width:auto;max-height:74vh}
  .nw-modal{left:8px;right:8px;width:auto;max-height:86vh}
  .nw-modal-foot{flex-wrap:wrap}
  .nw-theme-row{grid-template-columns:1fr}
}

/* ── 流水线（派单台） ── */
.nw-pipe{display:grid;grid-template-columns:minmax(240px,320px) 1fr;gap:12px;padding:12px;align-items:start;min-height:0}
.nw-pipe-right{display:flex;flex-direction:column;gap:12px;min-width:0}
.nw-pipe-roles{position:sticky;top:0}
.nw-pipe-form{display:flex;flex-direction:column;gap:8px}
.nw-pipe-form-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}
.nw-pipe-prompt{
  margin:8px 0 0;padding:12px;max-height:52vh;overflow:auto;
  background:var(--nw-bg);border:1px solid var(--nw-line);border-radius:8px;
  color:var(--nw-fg-2);font-size:12px;line-height:1.72;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  white-space:pre-wrap;word-break:break-word;
}
.nw-pipe-modal-foot{display:flex;gap:8px;justify-content:flex-end}

.nw-role-grid{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}
.nw-role{
  display:grid;grid-template-columns:1fr auto;gap:2px 8px;
  padding:7px 9px;border:1px solid var(--nw-line);border-radius:8px;
  background:var(--nw-bg-1);color:inherit;text-align:left;cursor:pointer;
  transition:border-color .12s,background .12s;
}
.nw-role:hover{border-color:var(--nw-line-2);background:var(--nw-bg-2)}
.nw-role:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-role-boss{border-color:var(--nw-amber);background:var(--nw-amber-soft)}
.nw-role-name{font-weight:600;font-size:12.5px;color:var(--nw-fg)}
.nw-role-id{
  font-size:10.5px;color:var(--nw-fg-3);justify-self:end;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-role-duty{grid-column:1 / -1;font-size:11.5px;color:var(--nw-fg-3);line-height:1.5}
.nw-role-foot{grid-column:1 / -1;display:flex;gap:5px;flex-wrap:wrap;margin-top:2px}

.nw-dp-list{display:flex;flex-direction:column;gap:8px;margin-top:8px}
.nw-dp{
  border:1px solid var(--nw-line);border-left:3px solid var(--nw-line-2);
  border-radius:8px;padding:8px 10px;background:var(--nw-bg-1);
}
.nw-dp-issued{border-left-color:var(--nw-blue)}
.nw-dp-claimed{border-left-color:var(--nw-amber)}
.nw-dp-submitted{border-left-color:var(--nw-green)}
.nw-dp-expired{border-left-color:var(--nw-red)}
.nw-dp-revoked{opacity:.62;border-left-color:var(--nw-fg-3)}
.nw-dp-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nw-dp-role{font-weight:600;font-size:12.5px}
.nw-dp-id{
  margin-left:auto;font-size:10.5px;color:var(--nw-fg-3);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-dp-task{margin-top:4px;font-size:12.5px;color:var(--nw-fg-2);line-height:1.6;white-space:pre-wrap}
.nw-dp-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:5px;font-size:11px;color:var(--nw-fg-3)}
.nw-dp-left{color:var(--nw-amber)}
.nw-dp-err{color:var(--nw-red)}
.nw-dp-report{
  margin-top:7px;padding:8px 10px;border-radius:7px;
  background:var(--nw-bg-2);border:1px dashed var(--nw-line-2);
}
.nw-dp-report-head{font-size:11px;color:var(--nw-fg-3);letter-spacing:.06em}
.nw-dp-verdict{margin-top:3px;font-size:12.5px;font-weight:600;color:var(--nw-amber)}
.nw-dp-sec{display:flex;gap:8px;margin-top:5px;font-size:12px;line-height:1.6}
.nw-dp-sec-t{flex:0 0 88px;color:var(--nw-fg-3);font-size:11.5px}
.nw-dp-sec-b{flex:1 1 auto;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}
.nw-dp-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;padding-top:7px;border-top:1px solid var(--nw-line)}

.nw-rep-list{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.nw-rep{padding:7px 10px;border-radius:7px;background:var(--nw-bg-1);border:1px solid var(--nw-line)}
.nw-rep-head{display:flex;align-items:center;gap:8px}
.nw-rep-role{font-weight:600;font-size:12px}
.nw-rep-at{margin-left:auto;font-size:10.5px;color:var(--nw-fg-3)}
.nw-rep-verdict{margin-top:3px;font-size:12px;color:var(--nw-fg-2);line-height:1.6}

@media (max-width:900px){
  .nw-pipe{grid-template-columns:1fr}
  .nw-pipe-roles{position:static}
  .nw-role-grid{grid-template-columns:1fr 1fr}
}

/* ── 文风校验（第 1 批） ── */
.nw-lint .nw-lint-sum{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:2px 0 8px}
.nw-lint-verdict{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid transparent}
.nw-lint-verdict-ok{color:var(--nw-green);background:var(--nw-green-soft);border-color:var(--nw-green)}
.nw-lint-verdict-bad{color:var(--nw-red);background:var(--nw-red-soft);border-color:var(--nw-red)}
.nw-lint-seg{margin-left:auto}
.nw-lint-list{display:flex;flex-direction:column;gap:5px;max-height:46vh;overflow:auto}
.nw-lint-hit{
  display:grid;grid-template-columns:22px auto 1fr;gap:3px 7px;align-items:baseline;
  padding:6px 8px;border:1px solid var(--nw-line);border-left-width:3px;border-radius:7px;
  background:var(--nw-bg-1);color:inherit;text-align:left;cursor:pointer;font:inherit;
}
.nw-lint-hit:hover{background:var(--nw-bg-2);border-color:var(--nw-line-2)}
.nw-lint-hit:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-blocking{border-left-color:var(--nw-red)}
.nw-lint-advisory{border-left-color:var(--nw-amber)}
.nw-lint-n{
  font-size:10.5px;color:var(--nw-fg-3);text-align:right;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-lint-quote{
  grid-column:3;font-size:12px;color:var(--nw-fg);line-height:1.55;
  word-break:break-word;
}
.nw-lint-hint{grid-column:3;font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-lint-about{margin-top:8px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-lint-about summary{cursor:pointer;color:var(--nw-fg-2);padding:2px 0}
.nw-lint-about p{margin:4px 0 0;line-height:1.6}
.nw-lint-modal-lead{margin:0 0 8px;font-size:12.5px;color:var(--nw-fg-2);line-height:1.65}
.nw-lint-modal-foot{display:flex;gap:8px;justify-content:flex-end}
.nw-lint-compact .nw-lint-list{max-height:none}
/* 阶段 A：每条命中的「为什么」。命中行下面挂一行可展开的判据。 */
.nw-lint-item{display:flex;flex-direction:column}
.nw-lint-line{display:grid;grid-template-columns:1fr auto;gap:4px 8px;align-items:start}
.nw-lint-why-btn{grid-column:2;justify-self:end;font-size:11px;color:var(--nw-fg-3);cursor:pointer;padding:2px 7px;border-radius:5px;border:1px solid transparent;background:none;font-family:inherit;white-space:nowrap}
.nw-lint-why-btn:hover{color:var(--nw-amber);border-color:var(--nw-line)}
.nw-lint-why-btn.on{color:var(--nw-amber);background:var(--nw-amber-soft);border-color:var(--nw-amber)}
.nw-lint-why-btn:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-why{display:flex;flex-direction:column;gap:2px;margin:0 0 2px;padding:6px 10px 7px;border-left:2px solid var(--nw-amber);background:var(--nw-bg-2);border-radius:0 6px 6px 0}
.nw-lint-why-tag{font-size:10.5px;color:var(--nw-amber);letter-spacing:.02em}
.nw-lint-why-text{font-size:12px;color:var(--nw-fg-2);line-height:1.65}
/* 阶段 C：本书自己的阈值卡 */
.nw-lint-cal{display:block}
.nw-lint-cal-lead{margin:0 0 10px}
.nw-lint-cal-acts{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.nw-lint-cal-more{background:none;border:none;padding:2px 4px;font-size:11.5px;color:var(--nw-fg-3);cursor:pointer;font:inherit}
.nw-lint-cal-more:hover{color:var(--nw-amber)}
.nw-lint-cal-more:focus-visible{outline:2px solid var(--nw-amber);outline-offset:1px}
.nw-lint-cal-list{margin:10px 0 0;display:flex;flex-direction:column;gap:3px;max-height:34vh;overflow:auto}
.nw-lint-cal-row{display:flex;align-items:baseline;gap:8px;padding:4px 8px;border-radius:6px;background:var(--nw-bg-2);border-left:2px solid var(--nw-amber)}
.nw-lint-cal-name{font-size:12px;color:var(--nw-fg);flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-lint-cal-num{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;flex:0 0 auto}
.nw-lint-cal-note{margin:3px 0 0;padding-left:7px;border-left:2px solid var(--nw-line-2)}
.nw-lint-cal-tight{border-left-color:var(--nw-amber)}
.nw-lint-cal-loose{border-left-color:var(--nw-blue)}
.nw-lint-cal-loud{border-left-color:var(--nw-red)}
.nw-lint-cal-idle{border-left-color:var(--nw-line);color:var(--nw-fg-3)}

/* ── 拆书 / 导入 / 扫榜（第 2·3·4 批） ── */
.nw-analyze{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.nw-analyze-stat{
  padding:8px 10px;border-radius:8px;
  background:var(--nw-bg-2);border:1px solid var(--nw-line);
}
.nw-analyze-hooks{display:flex;gap:6px;flex-wrap:wrap}
.nw-analyze-open{
  display:flex;flex-direction:column;gap:4px;
  padding:8px 10px;border-radius:8px;
  background:var(--nw-bg-1);border:1px solid var(--nw-line);
}
.nw-analyze-open h4{margin:0 0 4px;font-size:11.5px;font-weight:600;color:var(--nw-fg-3);letter-spacing:.06em}
.nw-analyze-row{
  display:grid;grid-template-columns:64px minmax(80px,1.1fr) auto auto minmax(0,2fr);
  gap:8px;align-items:baseline;
  padding:4px 0;border-bottom:1px dashed var(--nw-line);
  font-size:12px;line-height:1.55;
}
.nw-analyze-row:last-child{border-bottom:none}
.nw-analyze-ch{
  color:var(--nw-fg-3);font-size:11px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
}
.nw-analyze-title{font-weight:600;color:var(--nw-fg);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-analyze-num{color:var(--nw-fg-3);font-size:11px;white-space:nowrap}
.nw-analyze-beats{color:var(--nw-fg-2);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist,.nw-scan-hist{display:flex;flex-direction:column;gap:3px}
.nw-ana-hist-row,.nw-scan-hist-row{display:flex;flex-direction:column;border:1px solid var(--nw-line);border-radius:8px;background:var(--nw-bg-2);overflow:hidden}
.nw-ana-hist-row.on{border-color:var(--nw-amber)}
.nw-ana-hist-main{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:none;color:inherit;font:inherit;cursor:pointer;
}
.nw-ana-hist-main:hover{background:var(--nw-bg-3)}
.nw-scan-hist-row{
  display:grid;grid-template-columns:20px minmax(0,1fr) auto 14px;align-items:center;gap:9px;
  padding:8px 10px;text-align:left;background:none;border:1px solid var(--nw-line);color:inherit;font:inherit;cursor:pointer;
}
.nw-scan-hist-row:hover{background:var(--nw-bg-3)}
.nw-ana-hist-icon,.nw-scan-hist-icon{font-size:13px;text-align:center}
.nw-ana-hist-body,.nw-scan-hist-body{display:flex;flex-direction:column;gap:1px;min-width:0}
.nw-ana-hist-title,.nw-scan-hist-title{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist-sub,.nw-scan-hist-sub{font-size:10.5px;color:var(--nw-fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-ana-hist-at,.nw-scan-hist-at{font-size:10.5px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;flex:none}
.nw-ana-hist-detail{display:flex;flex-direction:column;gap:7px;padding:9px 11px;border-top:1px solid var(--nw-line);font-size:12px;color:var(--nw-fg-2);background:var(--nw-bg-1)}
.nw-import-opts{display:grid;grid-template-columns:1fr 180px;gap:10px}
.nw-scan-auto{margin-top:8px;padding-top:8px;border-top:1px dashed var(--nw-line)}
.nw-scan-auto summary{cursor:pointer;font-size:11.5px;color:var(--nw-fg-3);padding:2px 0}
.nw-scan-auto summary:hover{color:var(--nw-fg-2)}
.nw-scan-auto .nw-actions{margin-top:7px;flex-wrap:nowrap}
.nw-scan-auto .nw-actions .nw-input{flex:1 1 auto;min-width:0}

@media (max-width:900px){
  .nw-analyze-row{grid-template-columns:52px 1fr auto;row-gap:2px}
  .nw-analyze-beats{grid-column:1 / -1}
  .nw-import-opts{grid-template-columns:1fr}
  .nw-scan-auto .nw-actions{flex-wrap:wrap}

/* ── 【阶段 B】语料池 ─────────────────────────────────────── */
.nw-corpus-bar{height:8px;border-radius:99px;background:var(--nw-bg-3);overflow:hidden;margin:9px 0 6px}
.nw-corpus-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--nw-amber,#d9a441),var(--nw-amber-2,#e8c477));transition:width .35s ease}
.nw-corpus-nums{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--nw-fg-3);flex-wrap:wrap}
.nw-corpus-list{display:flex;flex-direction:column;gap:1px;margin:10px 0 4px}
.nw-corpus-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto 26px;align-items:center;gap:9px;padding:7px 9px;border-radius:7px;background:var(--nw-bg-1)}
.nw-corpus-row:hover{background:var(--nw-bg-2)}
.nw-corpus-name{font-size:12.5px;color:var(--nw-fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-corpus-meta{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}
.nw-corpus-add{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:9px;margin-top:10px}
.nw-corpus-out{margin-top:11px;padding-top:10px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:8px}
.nw-corpus-sum{font-size:12px;color:var(--nw-fg-2);line-height:1.6}
.nw-corpus-th{display:flex;flex-direction:column;gap:1px}
.nw-corpus-th-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px}
.nw-corpus-th-row:nth-child(odd){background:var(--nw-bg-1)}
.nw-corpus-th-noisy{background:rgba(217,164,65,.1)}
.nw-corpus-th-name{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-corpus-th-num{color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap}

@media (max-width:900px){
  .nw-corpus-add{grid-template-columns:1fr}
  .nw-corpus-th-row{grid-template-columns:minmax(0,1fr) auto;row-gap:2px}
}

/* ── 【借 LNW 六项】地图 · 成书 · 检查更新 · 冷读 · 意见池 · 简报 ───────── */

/* 地图：坐标是百分比，所以节点用绝对定位、边用 SVG 铺满底。 */
.nw-map{display:flex;flex-direction:column;gap:10px}
.nw-map-bar{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.nw-map-hint{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6}
.nw-map-stage{position:relative;height:420px;border-radius:10px;background:var(--nw-bg-1);border:1px solid var(--nw-line);overflow:hidden}
.nw-map-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.nw-map-edge{stroke:var(--nw-line);stroke-width:1.4;fill:none}
.nw-map-edge-road{stroke-dasharray:none}
.nw-map-edge.on{stroke:var(--nw-amber,#d9a441);stroke-width:2.2}
.nw-map-edge-label{font-size:10px;fill:var(--nw-fg-3)}
.nw-map-nodes{position:absolute;inset:0}
.nw-map-node{position:absolute;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:2px;cursor:grab;user-select:none}
.nw-map-node:active{cursor:grabbing}
.nw-map-dot{width:14px;height:14px;border-radius:50%;background:var(--nw-amber,#d9a441);box-shadow:0 0 0 3px rgba(217,164,65,.18)}
.nw-map-node.orphan .nw-map-dot{background:var(--nw-fg-3);box-shadow:0 0 0 3px rgba(0,0,0,.08)}
.nw-map-name{font-size:11px;color:var(--nw-fg-2);white-space:nowrap;padding:1px 5px;border-radius:5px;background:var(--nw-bg-2)}
.nw-map-ch{font-size:10px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace}
.nw-map-orphan{font-size:11.5px;color:var(--nw-amber,#d9a441)}
.nw-map-select{height:30px;border-radius:7px;border:1px solid var(--nw-line);background:var(--nw-bg-1);color:var(--nw-fg);font-size:12px;padding:0 8px}
.nw-map-select:focus{outline:none;border-color:var(--nw-amber,#d9a441)}
.nw-map-edges,.nw-map-edgelist{display:flex;flex-direction:column;gap:1px;margin-top:8px}
.nw-map-edgerow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.4fr) 26px;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;font-size:11.5px;background:var(--nw-bg-1)}
.nw-map-edgerow:nth-child(odd){background:var(--nw-bg-2)}
.nw-map-edgetext{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-map-edgedel{width:22px;height:22px;border:0;border-radius:5px;background:transparent;color:var(--nw-fg-3);cursor:pointer}
.nw-map-edgedel:hover{background:rgba(217,74,65,.14);color:#d94a41}
.nw-map-link{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) auto;gap:8px;align-items:center}
.nw-map-link-label{font-size:11.5px;color:var(--nw-fg-3)}
.nw-map-label-input{margin-top:6px}

/* 成书导出：四个格式牌，点一下才真下。 */
.nw-book-formats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin:10px 0}
.nw-book-format{display:flex;flex-direction:column;gap:3px;align-items:flex-start;padding:11px 12px;border-radius:9px;border:1px solid var(--nw-line);background:var(--nw-bg-1);cursor:pointer;text-align:left}
.nw-book-format:hover{border-color:var(--nw-amber,#d9a441);background:var(--nw-bg-2)}
.nw-book-format-name{font-size:13px;color:var(--nw-fg);font-weight:600}
.nw-book-format-hint{font-size:11px;color:var(--nw-fg-3);line-height:1.55}
.nw-book-skip{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--nw-fg-2)}
.nw-update-err{font-size:11.5px;color:#d94a41}

/* 冷读：汇包 → 复制提示词 → 粘回执。三步在一个卡里，不跳页。 */
.nw-cold-form{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:9px 0 4px}
.nw-cold-pkg{margin-top:11px;padding-top:10px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:7px}
.nw-cold-file{font-size:12.5px;color:var(--nw-fg);font-family:ui-monospace,Consolas,monospace}
.nw-cold-prompt{max-height:190px;overflow:auto;margin:0;padding:9px 10px;border-radius:8px;background:var(--nw-bg-1);border:1px solid var(--nw-line);font-size:11.5px;line-height:1.7;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word}
.nw-cold-submit{margin-top:12px;padding-top:11px;border-top:1px dashed var(--nw-line);display:flex;flex-direction:column;gap:7px}
.nw-cold-history{margin-top:11px;font-size:11.5px;color:var(--nw-fg-3)}
.nw-cold-history summary{cursor:pointer;color:var(--nw-fg-2)}
.nw-cold-histrow{display:flex;justify-content:space-between;gap:9px;padding:3px 0 3px 10px}
.nw-cold-histname{font-family:ui-monospace,Consolas,monospace;color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* 意见池：一行一条，右边两个决定。 */
.nw-opinion-src{margin-top:6px}
.nw-opinion-list{display:flex;flex-direction:column;gap:1px;margin-top:9px}
.nw-opinion{display:grid;grid-template-columns:64px minmax(0,1fr) auto auto;align-items:start;gap:9px;padding:8px 9px;border-radius:7px;background:var(--nw-bg-1)}
.nw-opinion:nth-child(odd){background:var(--nw-bg-2)}
.nw-opinion-open .nw-opinion-text{color:var(--nw-fg)}
.nw-opinion-adopted{opacity:.62}
.nw-opinion-dismissed{opacity:.45}
.nw-opinion-ch{font-size:11px;color:var(--nw-fg-3);font-family:ui-monospace,Consolas,monospace;white-space:nowrap;padding-top:1px}
.nw-opinion-body{display:flex;flex-direction:column;gap:2px;min-width:0}
.nw-opinion-text{font-size:12.5px;color:var(--nw-fg);line-height:1.65;word-break:break-word}
.nw-opinion-quote{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6;word-break:break-word}
.nw-opinion-acts{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}

/* 对齐简报 */
.nw-brief{margin-top:9px;display:flex;flex-direction:column;gap:7px}
.nw-brief-text{max-height:300px;overflow:auto;margin:0;padding:10px;border-radius:8px;background:var(--nw-bg-1);border:1px solid var(--nw-line);font-size:11.5px;line-height:1.75;color:var(--nw-fg-2);white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,Consolas,monospace}

@media (max-width:900px){
  .nw-map-stage{height:320px}
  .nw-map-link{grid-template-columns:1fr 1fr}
  .nw-opinion{grid-template-columns:minmax(0,1fr) auto;row-gap:5px}
  .nw-opinion-ch{grid-column:1/-1}
  .nw-opinion-acts{grid-column:1/-1;justify-content:flex-start}
}

/* ── 【借 oh-story】章级体检：四件事各查各的 ─────────────────── */
.nw-health{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.nw-health-degenerate .nw-health-label{color:var(--nw-fg)}
.nw-health-row{border-radius:8px;background:var(--nw-bg-1);overflow:hidden}
.nw-health-head{display:grid;grid-template-columns:minmax(0,1fr) auto 16px;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.nw-health-head:hover{background:var(--nw-bg-2)}
.nw-health-label{font-size:12.5px;color:var(--nw-fg)}
.nw-health-caret{font-size:10px;color:var(--nw-fg-3)}
.nw-health-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.nw-health-hits{display:flex;flex-direction:column;gap:1px}
.nw-health-hit{display:block;width:100%;padding:4px 8px;border:0;border-radius:5px;background:var(--nw-bg-2);color:var(--nw-fg-2);font-size:11.5px;line-height:1.6;text-align:left;cursor:pointer;word-break:break-word}
.nw-health-hit:hover{background:var(--nw-bg-3);color:var(--nw-fg)}
.nw-health-hit-flat{cursor:default}
.nw-health-hit-flat:hover{background:var(--nw-bg-2);color:var(--nw-fg-2)}

/* ── 任务包查看器 ──────────────────────────────────────────── */
.nw-taskpack{width:100%}
.nw-tp-list{display:flex;flex-direction:column;gap:4px;margin-top:9px}
.nw-tp-row{border-radius:8px;background:var(--nw-bg-1);overflow:hidden}
.nw-tp-head{display:grid;grid-template-columns:auto auto minmax(0,1fr) auto auto;align-items:center;gap:8px;width:100%;padding:8px 10px;border:0;background:transparent;cursor:pointer;text-align:left}
.nw-tp-head:hover{background:var(--nw-bg-2)}
.nw-tp-role{font-size:12.5px;color:var(--nw-fg)}
.nw-tp-n{font-size:11.5px;color:var(--nw-fg-2)}
.nw-tp-at{font-size:11px;color:var(--nw-fg-3);font-variant-numeric:tabular-nums}
.nw-tp-body{padding:2px 10px 10px;display:flex;flex-direction:column;gap:5px}
.nw-tp-files{display:flex;flex-direction:column;gap:2px}
.nw-tp-file{display:grid;grid-template-columns:minmax(90px,1fr) minmax(0,2fr) auto;gap:8px;align-items:baseline;padding:4px 8px;border-radius:5px;background:var(--nw-bg-2)}
.nw-tp-file-name{font-size:11.5px;color:var(--nw-fg);font-family:var(--nw-mono);word-break:break-all}
.nw-tp-file-why{font-size:11px;color:var(--nw-fg-2);line-height:1.6}
.nw-tp-file-b{font-size:10.5px;color:var(--nw-fg-3);font-variant-numeric:tabular-nums}
.nw-tp-omit{display:flex;flex-direction:column;gap:2px;padding:6px 8px;border-radius:5px;background:var(--nw-bg-2)}
.nw-tp-omit-t{font-size:11px;color:var(--nw-fg-3);letter-spacing:.04em}
.nw-tp-omit-row{font-size:11.5px;color:var(--nw-fg-2);line-height:1.6;word-break:break-word}
.nw-tp-prompt{margin-top:2px}
.nw-tp-prompt summary{cursor:pointer;font-size:11.5px;color:var(--nw-fg-2)}
.nw-tp-prompt-body{margin:5px 0 0;padding:8px;border-radius:6px;background:var(--nw-bg-2);font-family:var(--nw-mono);font-size:11px;line-height:1.65;white-space:pre-wrap;word-break:break-word;color:var(--nw-fg-2);max-height:240px;overflow:auto}

/* ── 成本卡：数字要能一眼读到，别让 ¥ 藏在段落里 ─────────── */
.nw-cost-total{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:9px;background:var(--nw-bg-2)}
.nw-cost-num{font-size:22px;font-weight:600;color:var(--nw-amber);line-height:1.2;font-variant-numeric:tabular-nums}
.nw-cost-desc{font-size:11.5px;color:var(--nw-fg-3);line-height:1.6}
.nw-cost-list{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.nw-cost-row{display:grid;grid-template-columns:64px minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:var(--nw-bg-1);font-size:11.5px}
.nw-cost-name{font-family:var(--nw-mono);color:var(--nw-fg-3)}
.nw-cost-meta{color:var(--nw-fg-2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nw-cost-money{color:var(--nw-amber);font-variant-numeric:tabular-nums}
.nw-cost-budget{display:flex;flex-direction:column;gap:4px;margin-top:8px}

/* ── 写策略卡：三档 + 目录勾选 ───────────────────────────── */
.nw-policy-row{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.nw-policy-card{display:flex;flex-direction:column;gap:3px;padding:9px 10px;border:1px solid var(--nw-line);border-radius:9px;background:var(--nw-bg-2);text-align:left;cursor:pointer}
.nw-policy-card:hover{border-color:var(--nw-line-2)}
.nw-policy-card.on{border-color:var(--nw-amber);box-shadow:0 0 0 1px var(--nw-amber)}
.nw-policy-card:disabled{opacity:.55;cursor:not-allowed}
.nw-policy-enforce.on{border-color:var(--nw-red);box-shadow:0 0 0 1px var(--nw-red)}
.nw-policy-name{font-size:12.5px;color:var(--nw-fg-1)}
.nw-policy-hint{font-size:11px;color:var(--nw-fg-3);line-height:1.5}
.nw-policy-dirs{display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px}
.nw-policy-dir{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--nw-fg-2);cursor:pointer}
.nw-policy-dir input{accent-color:var(--nw-amber)}

@media (max-width:760px){
  .nw-policy-row{grid-template-columns:1fr}
}

/* ── 提案的段落地址：小、等宽、不抢正文的视线 ─────────────── */
.nw-diff-pid{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-fg-3);letter-spacing:.03em;align-self:center}
.nw-diff-tag-stale{font-size:10.5px;color:var(--nw-red);border:1px solid var(--nw-red);border-radius:4px;padding:0 4px;align-self:center}
.nw-diff-stale .nw-diff-before{opacity:.62;text-decoration:line-through;text-decoration-color:var(--nw-red)}
.nw-prop-stale-hint{margin:0 0 4px;font-size:11.5px;color:var(--nw-amber);line-height:1.6}

/* ── 派单票上的子代理编号 ─────────────────────────────── */
.nw-dp-child{font-family:var(--nw-mono);font-size:10.5px;color:var(--nw-teal)}
`

// ═════════ 90-shell.js ═════════
/**
 * 长夜 · 外壳与挂载
 *
 * 顶栏（书名 / 当前页 / 预算 / 队列）+ 底栏（三键 + 六页 dock）+ 挂到会话区 main slot。
 */

function TopBar({
  projects, projectId, page, onSwitch, stats, project, onPause, paused, onQuick, busy, queueCount,
  onCommand, toast,
}) {
  // 【12 条 #6】月预算不是摆设：设置里填的 monthlyBudget 以前只显示成一个孤立的 ¥37，
  // 没人知道这个月还剩多少。这里把它算成「已用 / 预算」并给一条细进度。
  const budget = Number(project?.monthlyBudget ?? 0)
  const spent = Number(stats.costThisMonth ?? 0)
  const usedPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  const overBudget = budget > 0 && spent > budget
  return h(
    'div',
    { className: 'nw-top' },
    h(
      'div',
      { className: 'nw-brand' },
      h('span', { className: 'nw-brand-mark' }, '🌙'),
      h('span', { className: 'nw-brand-name' }, '长夜'),
      h('span', { className: 'nw-brand-page' }, PAGE_LABEL[page] ?? ''),
    ),
    // 【24 条 #1】状态灯：一眼看到 AI 到底在不在动。
    // 现在用 MOCK 固定值渲染完整形态（灯泡亮 + 第 5 回 + 1240/2500 字），点它有 toast。
    h(StatusLamp, { toast }),
    h(
      'div',
      { className: 'nw-top-mid' },
      h(Select, {
        value: projectId ?? '',
        onChange: onSwitch,
        options: projects.length
          ? projects.map((row) => ({ value: row.id, label: `${row.name}（${row.chapters} 章）` }))
          : [{ value: '', label: '还没有作品' }],
      }),
      h('span', { className: 'nw-top-stat' }, `待验收 ${stats.pending ?? 0}`),
      h('span', { className: 'nw-top-stat' }, `队列 ${stats.queued ?? 0}`),
      budget > 0
        ? h(
          'button',
          {
            type: 'button',
            className: `nw-top-stat nw-top-cost nw-budget${overBudget ? ' nw-budget-over' : ''}`,
            title: `本月已花 ${fmtCost(spent)} / 预算 ${fmtCost(budget)}${overBudget ? '（超了）' : ''}`,
            onClick: () => toast(overBudget
              ? `本月已超预算 ${fmtCost(spent - budget)}，去设置里调预算或收着点`
              : `本月已花 ${fmtCost(spent)}，还剩 ${fmtCost(budget - spent)}`),
          },
          `本月 ${fmtCost(spent)} / ${fmtCost(budget)}`,
          h('span', { className: 'nw-budget-bar' }, h('span', {
            className: 'nw-budget-fill',
            style: { width: `${usedPct}%` },
          })),
          // 【QA-4】超预算时把「要拦你」写在脸上，而不是等用户排完单才发现。
          overBudget
            ? h('span', { className: 'nw-budget-stop nw-budget-halt' }, `超 ${fmtCost(spent - budget)} · 排单前会问`)
            : null,
        )
        : h('span', { className: 'nw-top-stat nw-top-cost' }, fmtCost(stats.totalCost ?? 0)),
    ),
    // 三个快动作从底栏搬上来：底栏只留导航，快动作跟「队列/暂停」这些运行态放一起，
    // 一眼就能看到「现在会不会有东西在跑」。
    h(
      'div',
      { className: 'nw-top-right' },
      h('span', { className: `nw-top-hint${queueCount ? ' nw-top-hint-on' : ''}` },
        queueCount ? `${queueCount} 章在队列里` : '队列空闲'),
      // 【24 条 #3】命令面板入口：Ctrl+K 和这个按钮都开同一个浮层。
      h(Btn, { kind: 'ghost', small: true, className: 'nw-cmdk-open', onClick: onCommand }, '⌘K 命令'),
      // 【QA-4】暂停时三个快动作描红：按下去会给「先继续」的提示，不是死按钮。
      h(Btn, {
        kind: 'primary',
        small: true,
        className: paused ? 'nw-btn-halt' : '',
        title: paused ? '已暂停，先点「▶ 继续」' : '排一章进队列',
        onClick: () => onQuick?.('one'),
        disabled: busy,
      }, '✍️ 续写一章'),
      h(Btn, {
        kind: 'ghost',
        small: true,
        className: paused ? 'nw-btn-halt' : '',
        title: paused ? '已暂停，先点「▶ 继续」' : '一次排三章',
        onClick: () => onQuick?.('batch'),
        disabled: busy,
      }, '⚡ 连更 3 章'),
      h(Btn, { kind: 'ghost', small: true, onClick: () => onQuick?.('check'), disabled: busy }, '🩺 体检'),
      h(Btn, {
        small: true,
        kind: paused ? 'primary' : 'ghost',
        onClick: onPause,
      }, paused ? '▶ 继续' : '⏸ 暂停'),
    ),
  )
}

function DockNav({ page, go, queueCount }) {
  return h(
    'nav',
    { className: 'nw-dock' },
    PAGES.map((item) => h(
      'button',
      {
        type: 'button',
        key: item.id,
        className: `nw-dock-btn${page === item.id ? ' on' : ''}`,
        onClick: () => go(item.id),
      },
      h('span', { className: 'nw-dock-icon' }, item.icon),
      h('span', { className: 'nw-dock-label' }, item.label),
      item.id === 'studio' && queueCount ? h('span', { className: 'nw-dock-badge' }, String(queueCount)) : null,
    )),
  )
}

function BottomBar({
  page, go, queueCount, onJumpLatest, onNewChapter,
}) {
  return h(
    'div',
    { className: 'nw-bottom' },
    // 左占位：让中间那颗 dock 真正居中，不会被右侧两个按钮推歪。
    h('div', { className: 'nw-bottom-pad' }),
    h(DockNav, { page, go, queueCount }),
    // 【24 条 #2】底栏右侧两个常驻小按钮：跳到最新章 / 加一章空壳。
    // 写长篇天天要「翻到最后」，把它放在手边比放进菜单里合理。
    h(
      'div',
      { className: 'nw-bottom-acts' },
      h(Btn, {
        small: true,
        kind: 'ghost',
        className: 'nw-bottom-btn',
        onClick: onJumpLatest,
        title: '跳到最后一章（演示）',
      }, '⏭ 最新'),
      h(Btn, {
        small: true,
        kind: 'ghost',
        className: 'nw-bottom-btn',
        onClick: onNewChapter,
        title: '新增一章空壳（演示）',
      }, '＋ 新章'),
    ),
  )
}

function Workbench(props) {
  const {
    projects, projectId, project, chapters, page, setPage, go, toast, items, theme, setTheme,
    onSwitch, onRefresh, refreshKey, stats, paused, setPaused, command, setCommand,
  } = props

  const [quickBusy, setQuickBusy] = useState(false)

  useEffect(() => {
    const root = document.querySelector('.nw-shell')
    if (root) root.dataset.theme = theme
  }, [theme])

  // 三个快动作（续写 / 连更 / 体检）现在住在顶栏，所以状态提到 Workbench 里，
  // 不再跟着底栏组件一起重挂。
  // 【QA-4】预算拦截：以前 monthlyBudget 只是个装饰数字，超了照样能排单。
  // 现在顶栏那条进度条变红之后，快动作会先问一句 —— 不是禁用，是不让它悄悄超。
  const budgetCheck = () => {
    const cap = Number(project?.monthlyBudget ?? 0)
    if (!(cap > 0)) return true
    const used = Number(stats?.costThisMonth ?? 0)
    if (used <= cap) return true
    return window.confirm(
      `本月已花 ${fmtCost(used)}，预算 ${fmtCost(cap)}，超了 ${fmtCost(used - cap)}。\n再排新章会继续加钱。还是要排吗？`,
    )
  }

  const quick = async (mode) => {
    if (!projectId) {
      toast('先选一部作品')
      return
    }
    if (mode === 'check') {
      go('review')
      return
    }
    if (paused) {
      toast('现在是暂停状态，先点顶栏「▶ 继续」再排单')
      return
    }
    if (quickBusy) return
    if (!budgetCheck()) {
      toast('已取消 —— 本月超预算了')
      return
    }
    setQuickBusy(true)
    try {
      const list = await api('chapter.list', { projectId })
      const last = list.chapters.length ? list.chapters[list.chapters.length - 1].chapter : 0
      const count = mode === 'batch' ? 3 : 1
      for (let i = 0; i < count; i += 1) {
        await api('queue.add', {
          projectId,
          item: {
            chapter: last + 1 + i,
            intent: mode === 'batch' ? '连更：延续上一章钩子' : '续写下一章',
            words: 2500,
          },
        })
      }
      onRefresh?.()
      toast(mode === 'batch' ? '已排 3 章' : '已排 1 章')
      go('studio')
    } catch (error) {
      toast(error.message)
    } finally {
      setQuickBusy(false)
    }
  }

  const content = {
    cockpit: h(CockpitPage, { projectId, project, go, toast, refreshKey }),
    plan: h(PlanPage, { projectId, project, go, toast, onRefresh }),
    // 流水线：派单台。AI 干活的过程以前在工作台上完全不可见，
    // 这一页让「派出去没有 / 对方做完没有 / 说了什么」有痕迹。
    pipeline: h(PipelinePage, { projectId, project, toast, onRefresh }),
    studio: h(StudioPage, { projectId, project, chapters, go, toast, onRefresh }),
    review: h(ReviewPage, { projectId, chapters, project, toast, onRefresh, refreshKey }),
    // 【24 条 #20】逾期伏笔点一下要能跳到那一回 —— 世界库自己不会开验收详情，
    // 所以这里给它一个「开某章」的回调，走 ReviewPage 的 openChapter 约定。
    world: h(WorldPage, {
      projectId,
      project,
      chapters,
      toast,
      onRefresh,
      onJumpChapter: (chapter) => {
        if (!chapter) {
          toast('这条没记回收章节')
          return
        }
        writeLS('nw.openChapter', String(chapter))
        go('review')
        toast(`已跳到验收台 · 第 ${chapter} 回`)
      },
    }),
    scout: h(ScoutPage, {
      projectId, project, toast, onRefresh,
    }),
    settings: h(SettingsPage, {
      projectId, project, projects, chapters, onSwitch, toast, onRefresh, theme, setTheme,
    }),
  }[page] ?? null

  return h(
    'div',
    { className: `nw-shell nw-theme-${theme}`, 'data-page': page },
    h(TopBar, {
      projects,
      projectId,
      project,
      page,
      onSwitch,
      stats: stats ?? {},
      paused,
      onPause: () => setPaused(!paused),
      onQuick: quick,
      busy: quickBusy,
      queueCount: stats?.queued ?? 0,
      onCommand: () => setCommand?.(true),
      toast,
    }),
    h('div', { className: 'nw-body' }, content),
    h(BottomBar, {
      page,
      go,
      queueCount: stats?.queued ?? 0,
      onJumpLatest: () => {
        const last = chapters.length ? chapters[chapters.length - 1].chapter : 0
        if (!last) {
          toast('还没有章节，先排一单')
          return
        }
        // 以前只 go('review')，落在章列表上，文案却说「已跳到第 N 回」—— 说了没做到。
        // 把章号写进 nw.openChapter；已经停在验收台时组件不会重挂，
        // 得再 bump 一次 refreshKey，那边读键的 effect 才会跑。
        writeLS(LS.openChapter, String(last))
        go('review')
        onRefresh?.()
        toast(`已打开第 ${last} 回`)
      },
      onNewChapter: () => {
        writeLS(LS.orderChapter, String((chapters.length ? chapters[chapters.length - 1].chapter : 0) + 1))
        writeLS(LS.orderIntent, '')
        go('studio')
        toast('已开一张新章空单（演示）')
      },
    }),
    command ? h(CommandPalette, { projectId, onClose: () => setCommand?.(false), go, toast }) : null,
    h(Toast, { items }),
  )
}

function Root() {
  const [page, setPage] = useState(readLS(LS.page, 'cockpit'))
  const [projectId, setProjectId] = useState(readLS(LS.project, ''))
  const [theme, setThemeState] = useState(readLS(LS.theme, 'dark'))
  const [refreshKey, setRefreshKey] = useState(0)
  // 【12 条 #7】暂停要真的记住：以前是纯 useState(false)，切页/刷新就回到「没暂停」，
  // 顶栏那个按钮等于演给自己看。现在写 localStorage，重启也还在。
  const [paused, setPausedState] = useState(() => readLS(LS.paused, '0') === '1')
  const [command, setCommand] = useState(false)
  const [toasts, toast] = useToast()

  const setPaused = useCallback((next) => {
    setPausedState(next)
    writeLS(LS.paused, next ? '1' : '0')
  }, [])

  const projectsRes = useAsync(() => api('project.list'), [refreshKey])
  const projects = projectsRes.data?.projects ?? []

  useEffect(() => {
    if (!projectId && projects.length) {
      setProjectId(projects[0].id)
      writeLS(LS.project, projects[0].id)
    }
  }, [projects, projectId])

  const chapterRes = useAsync(
    () => api('chapter.list', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const chapters = chapterRes.data?.chapters ?? []

  const projectRes = useAsync(
    () => api('project.get', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const project = projectRes.data?.project ?? null

  const statsRes = useAsync(
    () => api('overview', { projectId }),
    [projectId, refreshKey],
    { skip: !projectId },
  )
  const stats = statsRes.data?.stats ?? {}

  // 【12 条 #1】切页前先问一句：有没保存的正文就先拦住。
  // 拦的只是「换页」，不拦「同一页里换章」—— 那是验收台自己的事。
  const go = useCallback((next, arg) => {
    const current = readLS(LS.page, 'cockpit')
    if (next !== current && dirtyGuard.active) {
      const label = dirtyGuard.label || '当前这一章'
      // confirm 是同步的，不需要额外的弹窗状态机；关掉返回 false 就不走。
      if (!window.confirm(`${label}还有改动没保存，确定要离开吗？\n\n离开后内容会留在本地草稿里，下次打开这一章会提示你。`)) {
        return
      }
      setDirtyGuard(false)
    }
    setPage(next)
    writeLS(LS.page, next)
    if (arg?.chapter) writeLS('nw.openChapter', String(arg.chapter))
  }, [])

  const setTheme = useCallback((next) => {
    setThemeState(next)
    writeLS(LS.theme, next)
  }, [])

  const onSwitch = useCallback((id) => {
    setProjectId(id)
    writeLS(LS.project, id)
    setRefreshKey((n) => n + 1)
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshKey((n) => n + 1)
  }, [])

  // Ctrl+K 打开命令面板（Esc 由 Modal 自己关）。以前这里只弹一句「还没做」，
  // 现在接的是 CommandPalette —— 有列表、能上下选、能执行（演示态）。
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault()
        // 别的弹窗（比如设置里的确认框）开着时不要再叠一层。
        if (modalOpen() && !command) return
        setCommand((open) => !open)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return h(Workbench, {
    projects, projectId, project, chapters, page, setPage, go, toast,
    items: toasts, theme, setTheme, onSwitch, onRefresh, refreshKey, stats, paused, setPaused,
    command, setCommand,
  })
}

// ── 挂载 ────────────────────────────────────────────────────

let hostCtx = null

function hostService(name) {
  try {
    return hostCtx?.get?.(name) ?? null
  } catch {
    return null
  }
}

// 侧栏面板图标轨那一行的小图标：宿主给每个 panellist id 渲染一行 panelRow，
// 图标由 renderSlot('sidebar.panellist', { size }, { only: id }) 取，点击由宿主自己调 layout.selectPanel(id)。
function PanelIcon({ size }) {
  const box = Number(size) || 18
  return h(
    'span',
    {
      className: 'nw-panel-glyph',
      role: 'img',
      'aria-label': '长夜',
      'aria-hidden': 'true',
      style: { width: `${box}px`, height: `${box}px`, fontSize: `${Math.round(box * 0.92)}px` },
    },
    '🌙',
  )
}

// 把中心列切到长夜。宿主 panelRow 的点击自己会走这条路，这里只留给命令面板 / 其它插件调用；
// layout 服务可能比 slot 注册晚一拍就绪，所以退到 hostCtx.layout 再试一次。
function openNightwrite() {
  try {
    const layout = hostService('layout') || hostCtx?.layout || null
    if (layout && typeof layout.selectPanel === 'function') {
      layout.selectPanel(PANEL_ID)
      return true
    }
  } catch (error) {
    console.warn('[nightwrite] 打开失败', error)
  }
  return false
}

function apply(ctx) {
  hostCtx = ctx

  const inject = (slot, register) => {
    try {
      if (ctx?.slots?.inject) ctx.slots.inject(slot, register)
      else register()
    } catch (error) {
      console.warn(`[nightwrite] 挂载 ${slot} 失败`, error)
    }
  }

  // 侧栏图标：进「插件」那一排，点它就打开长夜。
  inject('sidebar.panellist', () =>
    ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 20, label: '长夜' }, PanelIcon))

  // 正门：keyed main 槽位。宿主 AppFrame 的 MainPanel 是
  // renderSlot('main', {}, { entryKey: activePanelId ?? 'conversation' })，
  // 所以 key='nightwrite' 这份就是「选中长夜时中心列该画的内容」。
  inject('main', () =>
    ctx.slots.register({ name: 'main', key: PANEL_ID, label: '长夜' }, Root))

  // 样式注入走 ctx.effect，插件被卸载 / 热重建时宿主会回调清理函数把这颗 <style> 摘掉。
  // 直接 appendChild 而不注册清理，会让每次改动都往 <head> 里叠一份旧 CSS。
  const style = document.createElement('style')
  style.dataset.nightwrite = '1'
  style.textContent = NIGHTWRITE_CSS
  document.head.appendChild(style)
  if (typeof ctx?.effect === 'function') {
    ctx.effect(() => () => {
      try {
        style.remove()
      } catch {
        /* 已被移除 */
      }
    }, 'nightwrite: styles')
  }
}

return { name: 'nightwrite', inject: ['slots'], apply, _test: { Root, Workbench, ReviewDetail, PlanPage, ProposalBoard, ProblemBoard, CommandPalette, SourcePop, StatusLamp, PipelinePage, DispatchRow, RoleCard, LintPanel, LintBlockModal, LintCalibration, MapView, BookExport, UpdateCard, ColdReadPanel, OpinionBoard, BriefingCard, ChapterHealth, TaskPackBoard } }
  },
})
