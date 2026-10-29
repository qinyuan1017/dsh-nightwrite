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
  // 正文页的三件事：读到哪、字多大、行多松。都是「下次打开还得是我上次的样子」。
  readPos: 'nw.readpos',
  readFont: 'nw.readfont',
  readLine: 'nw.readline',
  // 【QA】底栏「⏭ 最新」与命令面板跳章都写这个键，验收台读它直接打开那一回。
  openChapter: 'nw.openChapter',
  openPara: 'nw.openPara',
}

// 八页。导航是底栏居中的胶囊（`.nw-dock`），不是左侧目录树。
//
// 为什么在底栏：底栏是视线的终点，八个词一扫就过，不占正文的宽度。
// 作品越写越长，屏幕就越该留给稿子。
//
// 页数 10 → 8：`pipeline`（派单台）和 `studio`（生产台）合成 `dispatch`（派单），
// 它们本来就是同一件事的两半（一个排单、一个派人）；`run`（停靠点）并进 `today`，
// 因为「今天能不能写」跟「今天该写什么」是同一个人在同一秒钟要回答的两个问题。
//
// 只在顺序上体现轻重：先看今天，再摊正文，规划与派单在后，验收与资料次之，设置垫底。
const PAGES = [
  { id: 'today', label: '今天', icon: '🌙' },
  { id: 'read', label: '正文', icon: '📖' },
  { id: 'plan', label: '大纲', icon: '📐' },
  { id: 'dispatch', label: '派单', icon: '🛠' },
  { id: 'review', label: '验收台', icon: '📋' },
  { id: 'world', label: '世界库', icon: '🗂' },
  { id: 'scout', label: '侦察', icon: '🔍' },
  { id: 'settings', label: '设置', icon: '⚙️' },
]
const PAGE_LABEL = Object.fromEntries(PAGES.map((p) => [p.id, p.label]))
const PAGE_IDS = PAGES.map((p) => p.id)
/** 旧版本存过的页 id（底栏十页时代）→ 新 id。老 localStorage 不该把界面卡在黑屏。 */
const PAGE_ALIAS = {
  cockpit: 'today',
  pipeline: 'dispatch',
  studio: 'dispatch',
  run: 'today',
}
/** 认不出来的页 id 一律落到今天；避免 localStorage 里留着旧值时整页渲染 null。 */
function normalizePage(id) {
  const key = String(id ?? '').trim()
  if (PAGE_IDS.includes(key)) return key
  const alias = PAGE_ALIAS[key]
  if (alias) return alias
  return 'today'
}

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
  let body = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
  if (body.startsWith('\ufeff')) body = body.slice(1)
  // frontmatter：开头 --- 包起来、且里面有 key: value 行，才认。认不出就原样算。
  const lines = body.split('\n')
  if (lines[0] === '---') {
    let closing = -1
    for (let i = 1; i < Math.min(lines.length, 201); i += 1) {
      if (lines[i] === '---' || lines[i] === '...') {
        closing = i
        break
      }
    }
    if (
      closing >= 2 &&
      lines
        .slice(1, closing)
        .some((line) => /^[A-Za-z_\u3400-\u9FFF][^:\n]{0,80}:[ \t]*(?:.*)$/.test(line))
    ) {
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
      ? h(
          'div',
          { className: 'nw-card-head' },
          h('h3', null, title),
          h('div', { className: 'nw-card-line' }),
          extra,
        )
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
    rows.map((row) =>
      h(
        'div',
        { className: 'nw-kv', key: row.key },
        h('span', { className: 'nw-kv-k' }, row.key),
        h('span', { className: `nw-kv-v${row.mono ? ' nw-mono' : ''}` }, row.text),
      ),
    ),
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
    {
      className: 'nw-input',
      value: value ?? '',
      onChange: (event) => onChange?.(event.target.value),
    },
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
    items.map((item) =>
      h(
        'div',
        { className: 'nw-toast', key: item.id },
        h('span', { className: 'nw-toast-mark' }, '›'),
        item.text,
      ),
    ),
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
      const focusables = Array.from(
        box.querySelectorAll(
          'a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.disabled)
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
        h(
          'button',
          { type: 'button', className: 'nw-icon-btn', onClick: onClose, 'aria-label': '关闭' },
          '✕',
        ),
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

/**
 * 按场景分条的写作原则。
 *
 * 一本书只有一句铁律是不够的：打脸章要「三句内见血」，感情章要「不写心理写动作」，
 * 战斗章要「短句、动词开头」—— 这三条互相打架，揉成一句就成了正确的废话。
 *
 * 存在 project.settings.principles = [{ id, name, text }]。
 * settings.writePrinciple 仍然有效，当作「所有场景都吃」的兜底那条。
 */
function projectPrinciples(project) {
  const raw = project?.settings?.principles
  const list = Array.isArray(raw) ? raw : []
  const rows = []
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const name = String(row.name ?? '').trim()
    const text = String(row.text ?? '').trim()
    if (!name || !text) continue
    rows.push({ id: String(row.id ?? name), name, text })
  }
  const fallback = String(project?.settings?.writePrinciple ?? '').trim()
  if (!rows.length && fallback) rows.push({ id: '_default', name: '通用', text: fallback })
  return rows
}

/**
 * 这一单该带哪一条原则。
 *
 * 匹配规则故意做得很土：模板名 / 意图里包含场景名就算命中，命中几条就都带上。
 * 不猜语义 —— 猜错一次作者会记很久，而「模板叫打脸章就带打脸那条」他一看就懂。
 */
function pickPrinciple(project, hint) {
  const rows = projectPrinciples(project)
  if (!rows.length) return []
  const text = String(hint ?? '')
  const hit = rows.filter((row) => row.id !== '_default' && text.includes(row.name))
  if (hit.length) return hit
  const general = rows.find((row) => row.id === '_default')
  return general ? [general] : []
}

function Bar({ value, max = 100, tone = 'amber' }) {
  const pct = Math.max(0, Math.min(100, ((Number(value) || 0) / (Number(max) || 1)) * 100))
  return h('span', { className: `nw-bar nw-bar-${tone}` }, h('i', { style: { width: `${pct}%` } }))
}
