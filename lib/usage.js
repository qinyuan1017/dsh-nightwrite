/**
 * 长夜 · 成本估算
 *
 * 解决什么问题：
 *   写一本书花多少钱，作者通常最后一个才知道。等发现「这个月跑批烧掉了半个月
 *   的额度」时，几十章已经写完。成本必须是写作过程中随时能看的一个数，
 *   而不是月底的账单。
 *
 * 数据从哪来：
 *   DSH 把每个会话完整记在 `<home>/.dsh/sessions/<编码后的 cwd>/<sessionId>/session.v4.jsonl.zstd`。
 *   里面 `request/header` 有 provider/model，`request/context` 有 contextWindow，
 *   `assistant/message` 与 `tool/result` 带内容。这里统计的是「字符量」，
 *   再按一张价目表折算成钱 —— 不是精确计费，是「量级判断」。
 *
 * 为什么按字符不按 token：
 *   长夜零依赖，不带 tokenizer。中文文本按字符估 token 的误差在 1:1 到 1:1.6 之间，
 *   而价目表本身的浮动比这个大得多。所以这里给的是「大概多少钱」，
 *   并且把估算假设写在返回值里，作者知道自己看的是什么数。
 *
 * 为什么读 zstd 要 try/catch：
 *   node 24 才有内置 zstd；旧版 node 没有，这里降级为「读不到」，不抛错，
 *   免得一个成本面板把整个设置页拖崩。
 */

import { promises as fs } from 'node:fs'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import zlib from 'node:zlib'

/** DSH 的会话目录。 */
export function sessionsRoot() {
  const override = String(process.env.DSH_SESSIONS_ROOT ?? '').trim()
  if (override) return path.resolve(override)
  return path.join(os.homedir(), '.dsh', 'sessions')
}

/**
 * cwd → 会话目录名。
 *
 * 实测规律（从真实目录名反推）：整段包一层 `--`；路径分隔符与盘符冒号都变 `-`；
 * 连续的非 ASCII 字符合成一段，写成 `~` + 各自 4 位大写 hex 用 `~` 连起来 + `~`。
 * 例：C:\Users\亭檐霜\dsh-workspaces\1-0492
 *   → --C-Users-~4EAD~6A90~971C~dsh-workspaces-1-0492--
 * 注意中文字符之间是单波浪线（4EAD~6A90），不是双波浪线。
 */
export function encodeCwd(cwd) {
  const raw = String(cwd ?? '')
    .replace(/:/g, '')
    .replace(/[\\/]/g, '-')
  let out = ''
  for (const ch of raw) {
    const code = ch.codePointAt(0)
    out += code > 0x7e ? `~${code.toString(16).toUpperCase().padStart(4, '0')}` : ch
  }
  return `--${out}--`
}

/** 解一个会话文件；拿不到就返回空行数组。 */
export function readSessionLines(file) {
  if (!existsSync(file)) return []
  const buf = fsSyncRead(file)
  if (!buf) return []
  let text = ''
  try {
    if (typeof zlib.zstdDecompressSync === 'function' && /\.zstd$/i.test(file)) {
      text = zlib.zstdDecompressSync(buf).toString('utf8')
    } else {
      text = buf.toString('utf8')
    }
  } catch {
    return []
  }
  const rows = []
  for (const line of text.split('\n')) {
    const s = line.trim()
    if (!s) continue
    try {
      rows.push(JSON.parse(s))
    } catch {
      /* 半截行（会话正在写）直接跳过 */
    }
  }
  return rows
}

function fsSyncRead(file) {
  try {
    return readFileSync(file)
  } catch {
    return null
  }
}

/** 一共多少「字符」：递归数 content / text / arguments 里的字符串长度。 */
export function countCharsDeep(value, depth = 0) {
  if (depth > 8) return 0
  if (typeof value === 'string') return value.length
  if (Array.isArray(value))
    return value.reduce((sum, row) => sum + countCharsDeep(row, depth + 1), 0)
  if (value && typeof value === 'object') {
    let sum = 0
    for (const [key, row] of Object.entries(value)) {
      // 这些键是元数据，不算进上下文成本
      if (key === 'callId' || key === 'id' || key === 'seq' || key === 'time') continue
      sum += countCharsDeep(row, depth + 1)
    }
    return sum
  }
  return 0
}

/**
 * 价目表（人民币 / 百万 token）。默认给 DeepSeek 档位，
 * 作者可以在设置里填自己的。数字会漂，所以这里明确写「默认值，请核对」。
 */
export const DEFAULT_PRICES = {
  'deepseek-v4.1-flash': { input: 0.5, output: 2 },
  'deepseek-chat': { input: 2, output: 8 },
  default: { input: 1, output: 4 },
}

/** 中文字符 → token 的经验系数。1.35 是「中文混少量英文标点」的常见值。 */
export const CHARS_PER_TOKEN = 1.35
/** 输出 token 通常是输入的几分之一，用于把「总字符」拆成输入/输出两档占位。 */
const OUTPUT_SHARE = 0.25

/**
 * 扫一个会话目录，汇总用量。
 * @param {string} dir 会话目录（含 session.v4.jsonl.zstd）
 * @returns {{ok: boolean, file: string, turns: number, steps: number, toolCalls: number,
 *   providers: string[], models: string[], contextWindow: number,
 *   inputChars: number, outputChars: number, inputTokens: number, outputTokens: number,
 *   cost: number, price: object, note: string}}
 */
export function scanSession(dir) {
  const file = path.join(String(dir ?? ''), 'session.v4.jsonl.zstd')
  const rows = readSessionLines(file)
  if (!rows.length) {
    return {
      ok: false,
      file,
      turns: 0,
      steps: 0,
      toolCalls: 0,
      providers: [],
      models: [],
      contextWindow: 0,
      inputChars: 0,
      outputChars: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      price: DEFAULT_PRICES.default,
      note: '读不到会话记录（旧版 node 或缺文件）。',
    }
  }
  let turns = 0
  let steps = 0
  let toolCalls = 0
  let inputChars = 0
  let outputChars = 0
  let contextWindow = 0
  const providers = new Set()
  const models = new Set()

  for (const row of rows) {
    const type = String(row?.type ?? '')
    if (type === 'turn/start') turns += 1
    else if (type === 'step/start') steps += 1
    else if (type === 'tool/call') {
      toolCalls += 1
      outputChars += String(row?.data?.arguments ?? '').length
    } else if (type === 'assistant/message') {
      outputChars += countCharsDeep(row?.data?.message?.content)
    } else if (type === 'request/header') {
      const cfg = row?.data?.header?.config
      if (cfg?.provider) providers.add(String(cfg.provider))
      if (cfg?.model) models.add(String(cfg.model))
      inputChars += countCharsDeep(row?.data?.header?.tools ?? [])
    } else if (type === 'request/context') {
      const win = Number(row?.data?.contextWindow)
      if (Number.isFinite(win) && win > 0) contextWindow = win
    } else if (type === 'user/message' || type === 'system/message') {
      inputChars += countCharsDeep(row?.data?.message?.content ?? row?.data?.content)
    } else if (type === 'tool/result') {
      inputChars += countCharsDeep(row?.data?.result ?? row?.data?.content)
    }
  }

  const model = [...models][0] ?? 'default'
  const price = DEFAULT_PRICES[model] ?? DEFAULT_PRICES.default
  const inputTokens = Math.round(inputChars / CHARS_PER_TOKEN)
  const outputTokens = Math.round(outputChars / CHARS_PER_TOKEN)
  const cost = (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output

  return {
    ok: true,
    file,
    turns,
    steps,
    toolCalls,
    providers: [...providers],
    models: [...models],
    contextWindow,
    inputChars,
    outputChars,
    inputTokens,
    outputTokens,
    cost: Number(cost.toFixed(4)),
    price,
    note: '按字符估 token（1 token ≈ 1.35 字符），价目表是默认值，实际扣费以账单为准。',
  }
}

/**
 * 一个作品的成本：把「跟这个作品目录相关」的会话加起来。
 *
 * 怎么判断相关：会话 header 里有 cwd，作品的 dataDir 或工作目录在 cwd 下面。
 * 拿不到 cwd 的会话不计入（宁少不错）。
 *
 * @param {{dataDir?: string, cwd?: string}} target
 * @returns {{ok: boolean, sessions: object[], total: object, note: string}}
 */
export function scanProjectSessions(target = {}) {
  const root = sessionsRoot()
  const wanted = [target.dataDir, target.cwd]
    .map((row) =>
      String(row ?? '')
        .replace(/\\/g, '/')
        .toLowerCase(),
    )
    .filter(Boolean)
  if (!wanted.length) {
    return { ok: false, sessions: [], total: emptyTotal(), note: '没有可用于匹配的目录。' }
  }
  let dirs = []
  try {
    dirs = fsSyncList(root)
  } catch {
    dirs = []
  }
  const hits = []
  for (const name of dirs) {
    const decoded = decodeFolderName(name).toLowerCase()
    if (!wanted.some((row) => decoded.includes(row) || row.includes(decoded))) continue
    const base = path.join(root, name)
    for (const sub of fsSyncList(base)) {
      const dir = path.join(base, sub)
      const stat = scanSession(dir)
      if (stat.ok) hits.push({ sessionId: sub, folder: name, ...stat })
    }
  }
  const total = hits.reduce((acc, row) => {
    acc.turns += row.turns
    acc.steps += row.steps
    acc.toolCalls += row.toolCalls
    acc.inputTokens += row.inputTokens
    acc.outputTokens += row.outputTokens
    acc.cost += row.cost
    return acc
  }, emptyTotal())
  total.cost = Number(total.cost.toFixed(4))
  return {
    ok: hits.length > 0,
    sessions: hits.sort((a, b) => b.cost - a.cost).slice(0, 50),
    total,
    note: hits.length
      ? `匹配到 ${hits.length} 个会话。`
      : '没有找到跟这个目录相关的会话记录（会话可能是在别的目录开的）。',
  }
}

function emptyTotal() {
  return { turns: 0, steps: 0, toolCalls: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
}

function fsSyncList(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** ~4EAD~6A90~ → 亭檐；其余原样。只用于「看起来像不像同一个目录」的粗匹配。 */
export function decodeFolderName(name) {
  return String(name ?? '').replace(/~([0-9A-Fa-f]{4})~/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  )
}

/**
 * 一本书的预估算：给定「要写多少章 × 每章多少字」估个总数。
 * 这是开书前的预算，不是事后统计。
 */
export function estimateBudget(input = {}) {
  const chapters = Math.max(0, Math.floor(Number(input.chapters) || 0))
  const words = Math.max(0, Math.floor(Number(input.chapterWords) || 0))
  const model = String(input.model ?? 'default')
  const price = DEFAULT_PRICES[model] ?? DEFAULT_PRICES.default
  // 一章的上下文通常要带：细纲 + 上一章 + 账本摘要 ≈ 正文的 1.5 倍
  const contextFactor = Number(input.contextFactor) > 0 ? Number(input.contextFactor) : 1.5
  const totalWords = chapters * words
  const inputChars = totalWords * contextFactor
  const outputChars = totalWords
  const inputTokens = Math.round(inputChars / CHARS_PER_TOKEN)
  const outputTokens = Math.round(outputChars / CHARS_PER_TOKEN)
  const cost = (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output
  return {
    chapters,
    chapterWords: words,
    totalWords,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: Number(cost.toFixed(2)),
    price,
    model,
    note: `按「每章 ${words} 字、上文按正文 ${contextFactor} 倍」估；改稿、审校、重跑都不在内——实际通常是这个数的 1.5–2.5 倍。`,
  }
}

export const USAGE_PRICE_NOTE = '价目表是默认值；请按你自己的服务商单价核对。'
