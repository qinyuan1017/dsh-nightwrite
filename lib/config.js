/**
 * 长夜 · 插件配置（第 9 条：以前只有一个 NIGHTWRITE_ROOT 环境变量）
 *
 * 为什么要有这一层：这个插件贴着一堆「硬编码的好数字」在用——AI 味 30 分才放行、
 * 每章留 20 版历史、派单 60 分钟过期、请求体 8MB 上限。这些数字当初是拍下来的，
 * 换一本书、换一台机器就未必合适，但以前除了改源码没别的办法。
 *
 * ── 为什么不用 @deepseek-ai/schemastery ─────────────────────
 * 长夜是零依赖插件（dependencies / peerDependencies 全空），引一个 schema 库会把
 * 「装插件不动 node_modules」这条保证打破。宿主读 Config 只要求两样：
 *   toJSON()            投影成 JSON Schema，设置页据此画表单
 *   '~standard'.validate(value)  启动时校验一行配置
 * 这两样用普通对象就能给，所以这里手写。形状对齐 dsh-unlag 的做法，
 * 那边已经在同一个宿主上跑通了，比自创一套稳。
 *
 * ── 校验绝不抛 ────────────────────────────────────────────
 * 配置写坏了不该让整个插件启动失败：宿主把「启动失败的条目」当成致命错误，
 * 一个数字填错会把整个界面拖黑。所以 validate 只做「夹紧 + 回落默认」，
 * 非法值一律退回默认并在返回值里带上 _warnings，界面上能看见哪一项被忽略了。
 */

/** 与运行时代码共享的默认值：改这里等于改全库行为，所以只此一处定义。 */
export const CONFIG_DEFAULTS = {
  root: '',
  scorePassMax: 30,
  historyKeep: 20,
  dispatchTtlMin: 60,
  maxBodyBytes: 8 * 1024 * 1024,
  aiStyleBlock: true,
  writePolicy: 'warn',
}

/** 每一项的说明，设置页直接拿去当 label / description 用。 */
const FIELDS = {
  root: {
    type: 'string',
    meta: {
      default: CONFIG_DEFAULTS.root,
      description: '数据根目录。留空用 ~/.dsh/data/dsh-nightwrite；填了就把所有作品放在这里。',
    },
  },
  scorePassMax: {
    type: 'number',
    const: false,
    meta: {
      default: CONFIG_DEFAULTS.scorePassMax,
      description: 'AI 味评分上限（0–100）。超过这个分数 chapter.save 会拒写，0 等于最严。',
    },
  },
  historyKeep: {
    type: 'number',
    const: false,
    meta: {
      default: CONFIG_DEFAULTS.historyKeep,
      description: '每章保留多少个历史版本。正文改动越频繁，这里要留得越多。',
    },
  },
  dispatchTtlMin: {
    type: 'number',
    const: false,
    meta: {
      default: CONFIG_DEFAULTS.dispatchTtlMin,
      description: '派单票据的有效期（分钟）。过期后 agent 交不回执，要重新开票。',
    },
  },
  maxBodyBytes: {
    type: 'number',
    const: false,
    meta: {
      default: CONFIG_DEFAULTS.maxBodyBytes,
      description: '单次请求体上限（字节）。粘整本书进来时要调大，默认 8MB。',
    },
  },
  aiStyleBlock: {
    type: 'boolean',
    meta: {
      default: CONFIG_DEFAULTS.aiStyleBlock,
      description: 'chapter.save 是否硬拦 AI 味超标的正文。关掉只是不拦，分数照算。',
    },
  },
  writePolicy: {
    type: 'string',
    meta: {
      default: CONFIG_DEFAULTS.writePolicy,
      description:
        '模型用原生写工具改正文时的默认策略：off 不管 / warn 放行但提醒 / enforce 直接拒绝。',
    },
  },
}

/** 数字夹紧。理由同上：宁可静默回落到默认，也不要让启动挂掉。 */
function clampNumber(value, fallback, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return { value: fallback, ok: value === undefined || value === null }
  const rounded = Math.round(n)
  // 越界直接退回默认，不夹到边界：warning 里写的是「已用默认 30」，
  // 若实际给 100，界面上看到的数字和提示对不上，作者会以为配置坏了。
  if (rounded < min || rounded > max) return { value: fallback, ok: false }
  return { value: rounded, ok: rounded === n }
}

/**
 * 把一行原始配置规整成运行时可用的对象。
 *
 * 每一项单独判，坏一项不影响别项——配置是给作者手填的，不该要求他一次全对。
 * @returns {{value: object, warnings: string[]}}
 */
export function normalizeConfig(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  const warnings = []

  const root = typeof source.root === 'string' ? source.root.trim() : ''

  const scorePassMax = clampNumber(source.scorePassMax, CONFIG_DEFAULTS.scorePassMax, 0, 100)
  if (!scorePassMax.ok) warnings.push('scorePassMax 不在 0–100，已用默认 30')

  const historyKeep = clampNumber(source.historyKeep, CONFIG_DEFAULTS.historyKeep, 1, 200)
  if (!historyKeep.ok) warnings.push('historyKeep 不在 1–200，已用默认 20')

  const dispatchTtlMin = clampNumber(source.dispatchTtlMin, CONFIG_DEFAULTS.dispatchTtlMin, 5, 1440)
  if (!dispatchTtlMin.ok) warnings.push('dispatchTtlMin 不在 5–1440，已用默认 60')

  const maxBodyBytes = clampNumber(
    source.maxBodyBytes,
    CONFIG_DEFAULTS.maxBodyBytes,
    64 * 1024,
    256 * 1024 * 1024,
  )
  if (!maxBodyBytes.ok) warnings.push('maxBodyBytes 超出 64KB–256MB，已用默认 8MB')

  // 只有明确的 false 才算关；手填 "no" / 0 / 空串都当没填，因为「关掉硬拦」
  // 是个会让 AI 味稿子直接落盘的决定，不该由一次手误达成。
  const aiStyleBlock = source.aiStyleBlock === false ? false : CONFIG_DEFAULTS.aiStyleBlock

  const level = String(source.writePolicy ?? '')
  const writePolicy = ['off', 'warn', 'enforce'].includes(level)
    ? level
    : CONFIG_DEFAULTS.writePolicy
  if (level && writePolicy !== level)
    warnings.push(`writePolicy 只能是 off/warn/enforce，已用默认 ${CONFIG_DEFAULTS.writePolicy}`)

  return {
    value: {
      root,
      scorePassMax: scorePassMax.value,
      historyKeep: historyKeep.value,
      dispatchTtlMin: dispatchTtlMin.value,
      maxBodyBytes: maxBodyBytes.value,
      aiStyleBlock,
      writePolicy,
    },
    warnings,
  }
}

/**
 * 宿主读的形状。
 *
 * `refs` 是投影用的 JSON Schema 节点表（宿主按 id 引用，好处是重复结构只写一遍）；
 * `dict` 是「字段名 → refs 里的 id」，设置页按它画行。
 * 两个都写在同一个对象上，是为了避免出现「schema 与表单各维护一份」的漂移。
 */
const SCHEMA_UIDS = {
  2: {
    type: 'number',
    meta: { default: 30, min: 0, max: 100, description: FIELDS.scorePassMax.meta.description },
  },
  3: {
    type: 'number',
    meta: { default: 20, min: 1, max: 200, description: FIELDS.historyKeep.meta.description },
  },
  4: {
    type: 'number',
    meta: { default: 60, min: 5, max: 1440, description: FIELDS.dispatchTtlMin.meta.description },
  },
  5: {
    type: 'number',
    meta: { default: 8 * 1024 * 1024, description: FIELDS.maxBodyBytes.meta.description },
  },
  6: {
    type: 'boolean',
    meta: { default: true, description: FIELDS.aiStyleBlock.meta.description },
  },
  7: {
    type: 'string',
    meta: {
      default: 'warn',
      description: FIELDS.writePolicy.meta.description,
      enum: ['off', 'warn', 'enforce'],
    },
  },
  8: { type: 'string', meta: { default: '', description: FIELDS.root.meta.description } },
  9: {
    type: 'object',
    meta: { default: {} },
    dict: {
      root: 8,
      scorePassMax: 2,
      historyKeep: 3,
      dispatchTtlMin: 4,
      maxBodyBytes: 5,
      aiStyleBlock: 6,
      writePolicy: 7,
    },
  },
}

/**
 * 宿主真正读的那棵树。
 *
 * `uid` 是根节点的 id（这里用 9，指向上面那张 dict 表）；`refs` 是全部节点。
 * 宿主的 `toJSON()` 约定返回 `{uid, refs}`，缺了 uid 它解不出根，
 * 设置页就是空白——这跟「没写 Config」看起来一样，但更难查。
 */
const SCHEMA = { uid: 9, refs: SCHEMA_UIDS }

export const Config = {
  ...SCHEMA,
  type: 'object',
  dict: FIELDS,
  meta: { default: {} },
  toJSON() {
    return SCHEMA
  },
  '~standard': {
    version: 1,
    vendor: 'dsh-nightwrite',
    validate(value) {
      const { value: normalized } = normalizeConfig(value)
      return { value: normalized }
    },
  },
}

/**
 * 当前进程生效的配置。
 *
 * 为什么用模块级槽而不是每次往下传：
 *   读配置的地方散在 aiscore / store / dispatch / index，都是被深层调用的函数。
 *   为三个数字给十几层签名各加一个参数，比这个槽难维护得多。
 *
 * 谁写它：`apply()` 里一次。谁读它：其余所有地方。测试不 apply 也能跑，
 * 因为默认值就是 CONFIG_DEFAULTS —— 也就是「配置项没接上时插件原本的行为」。
 */
let RUNTIME = { ...CONFIG_DEFAULTS }
let RUNTIME_WARNINGS = []

export function setRuntimeConfig(value, warnings = []) {
  RUNTIME = { ...CONFIG_DEFAULTS, ...(value && typeof value === 'object' ? value : {}) }
  RUNTIME_WARNINGS = Array.isArray(warnings) ? warnings.slice() : []
  return RUNTIME
}

export function getRuntimeConfig() {
  return RUNTIME
}

export function runtimeWarnings() {
  return RUNTIME_WARNINGS
}

/** 改一项（界面上切「写策略」走这个，不必重启）。 */
export function patchRuntimeConfig(patch) {
  RUNTIME = { ...RUNTIME, ...(patch && typeof patch === 'object' ? patch : {}) }
  return RUNTIME
}
