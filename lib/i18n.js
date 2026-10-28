/**
 * 长夜 · i18n 取值层（服务端无关的纯数据 + 纯函数）
 *
 * 设计要点（为什么不按常规 i18n 库那样做）：
 *
 *   1. **中文原文就是键**（gettext 风格）。18 个客户端片段里 700 多处文案，
 *      手写 `cockpit.title` 这类语义键等于把 18 个文件读一遍再编一套名字，
 *      编出来的还必然不一致。原文当键则天然稳定：同一句文案永远同一个键，
 *      重新抽取不会漂移，en.json 的译文不会被下一版抽取打乱。
 *
 *   2. **这一步不改 src/`*`.js**。接入 `t()` 会牵动 18 个片段、389KB 产物
 *      和 323 条冒烟断言，风险远大于收益。所以本文件先只提供能力 + 键表，
 *      真正的调用点在 locale/README.md 里写了迁移路径（按片段分批接）。
 *
 *   3. **零依赖、无副作用**。不读文件、不看环境变量，词表由调用方传入或
 *      从内联的 locale/*.json 里静态带进来（DSH 插件是单文件打包，
 *      import JSON 需要宿主支持，故这里用可注入的注册接口）。
 *
 * 用法（服务端 / 测试 / 未来客户端片段通用）：
 *
 *   import { t, setLocale, registerCatalog, DEFAULT_LOCALE } from './i18n.js'
 *   registerCatalog('zh', { '保存': '保存', '还没有作品。': '还没有作品。' })
 *   registerCatalog('en', { '保存': 'Save', '还没有作品。': 'No works yet.' })
 *   t('保存')                  // → '保存'   （默认 zh）
 *   setLocale('en')
 *   t('保存')                  // → 'Save'
 *   t('没登记的键', '兜底')     // → '兜底'   （fallback 优先于键本身）
 *   t('保存', undefined, { locale: 'en' })  // → 'Save'（单次指定语言）
 */

/** 已支持的语言标识。 */
export const LOCALES = Object.freeze(['zh', 'en'])

/** 兜底语言：任何查不到的语言都退回这里。 */
export const DEFAULT_LOCALE = 'zh'

/** 每种语言的人类可读名称（语言选择器用）。 */
export const LOCALE_LABELS = Object.freeze({
  zh: '中文',
  en: 'English',
})

/**
 * 运行时词表：locale → { 中文键: 译文 }。
 * 用 Map 而不是对象，避免 `__proto__` / `constructor` 这类键被原型链干扰。
 * @type {Map<string, Map<string, string>>}
 */
const catalogs = new Map()

/** 当前语言。默认中文 —— 不改变现有渲染结果。 */
let currentLocale = DEFAULT_LOCALE

/** 占位符匹配：`{name}` / `{0}`。 */
const PLACEHOLDER = /\{(\w+)\}/g

/**
 * 判断一个语言标识是否受支持。
 * @param {unknown} locale
 * @returns {boolean}
 */
export function isLocale(locale) {
  return typeof locale === 'string' && LOCALES.includes(locale)
}

/**
 * 把语言标识规范化：`en-US` → `en`，`zh-CN` → `zh`。
 * 不认识的返回 DEFAULT_LOCALE。
 * @param {unknown} locale
 * @returns {string}
 */
export function normalizeLocale(locale) {
  if (typeof locale !== 'string' || !locale) return DEFAULT_LOCALE
  const base = locale.toLowerCase().split(/[-_]/)[0]
  return isLocale(base) ? base : DEFAULT_LOCALE
}

/**
 * 取出当前语言。
 * @returns {string}
 */
export function getLocale() {
  return currentLocale
}

/**
 * 切换当前语言。传不认识的值不会报错，只是回落到 DEFAULT_LOCALE。
 * @param {unknown} locale
 * @returns {string} 切换后实际生效的语言
 */
export function setLocale(locale) {
  currentLocale = normalizeLocale(locale)
  return currentLocale
}

/**
 * 注册（或合并）一份词表。多次注册同一语言会增量覆盖同键。
 *
 * @param {string} locale 语言标识；不在 LOCALES 里的会被忽略并返回 false
 * @param {Record<string, string>} catalog 键值表（中文原文 → 译文）
 * @param {{ overwrite?: boolean }} [options] overwrite=false 时不覆盖已有键
 * @returns {boolean} 是否注册成功
 */
export function registerCatalog(locale, catalog, options = {}) {
  if (!isLocale(locale) || !catalog || typeof catalog !== 'object') return false
  const { overwrite = true } = options
  let table = catalogs.get(locale)
  if (!table) {
    table = new Map()
    catalogs.set(locale, table)
  }
  for (const [key, value] of Object.entries(catalog)) {
    // `_meta` 之类的元数据不是文案，跳过
    if (key.startsWith('_')) continue
    if (typeof value !== 'string') continue
    if (!overwrite && table.has(key)) continue
    table.set(key, value)
  }
  return true
}

/**
 * 一份已注册词表的键数量（诊断用）。
 * @param {string} [locale]
 * @returns {number}
 */
export function catalogSize(locale = currentLocale) {
  return catalogs.get(normalizeLocale(locale))?.size ?? 0
}

/**
 * 是否已注册过某个语言。
 * @param {string} locale
 * @returns {boolean}
 */
export function hasCatalog(locale) {
  return catalogs.has(normalizeLocale(locale))
}

/** 清空全部词表（测试用）。 */
export function resetCatalogs() {
  catalogs.clear()
  currentLocale = DEFAULT_LOCALE
}

/**
 * 用参数替换译文里的 `{name}` / `{0}` 占位符。
 * 缺参数时**原样保留**占位符 —— 宁可让用户看见 `{name}`，
 * 也不要静默渲染成 `undefined`。
 *
 * @param {string} text
 * @param {Record<string, unknown> | unknown[]} [vars]
 * @returns {string}
 */
export function interpolate(text, vars) {
  if (!vars) return text
  return text.replace(PLACEHOLDER, (whole, name) => {
    const has = Array.isArray(vars) ? Number(name) < vars.length : Object.hasOwn(vars, name)
    if (!has) return whole
    const value = Array.isArray(vars) ? vars[Number(name)] : vars[name]
    return value == null ? whole : String(value)
  })
}

/**
 * 取一条译文。
 *
 * 查找顺序：目标语言 → 当前语言 → DEFAULT_LOCALE → `fallback` → `key` 本身。
 * 最后退回 `key` 这一层是关键：**没登记的文案原样显示中文**，
 * 所以「漏翻」的失败模式是「还是中文」，而不是「界面出现一堆 key」。
 *
 * @param {string} key 中文原文（同时也是词表的键）
 * @param {string} [fallback] 所有语言都查不到时返回什么；省略则返回 key
 * @param {{ locale?: string, vars?: Record<string, unknown> | unknown[] }} [options]
 * @returns {string}
 */
export function t(key, fallback, options = {}) {
  const text = typeof key === 'string' ? key : String(key ?? '')
  const { locale, vars } = options
  const wanted = locale ? normalizeLocale(locale) : currentLocale

  const chain = [wanted, currentLocale, DEFAULT_LOCALE]
  for (const lang of chain) {
    const hit = catalogs.get(lang)?.get(text)
    if (typeof hit === 'string' && hit) return interpolate(hit, vars)
  }
  const last = typeof fallback === 'string' ? fallback : text
  return interpolate(last, vars)
}

/**
 * 建一个绑定到固定语言的取值函数（给「渲染前就知道语言」的场景用）。
 * @param {string} locale
 * @returns {(key: string, fallback?: string, vars?: Record<string, unknown> | unknown[]) => string}
 */
export function createTranslator(locale) {
  const fixed = normalizeLocale(locale)
  return (key, fallback, vars) => t(key, fallback, { locale: fixed, vars })
}

export default t
