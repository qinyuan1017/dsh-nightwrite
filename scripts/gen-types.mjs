#!/usr/bin/env node
/**
 * 长夜 · 类型声明生成器
 *
 * 为什么要有这个脚本：`types/index.d.ts` 里的 op 联合类型必须和 `index.js` 里的
 * READ_OPS / WRITE_OPS 完全一致。手抄一次能对上，加一个 op 之后就永远对不上了。
 * 所以这份声明不从脑子里写，从源码里读：
 *
 *   1. 解析 index.js 的 `READ_OPS` / `WRITE_OPS` 两个数组（真实列表）。
 *   2. 把 handleRpcCore 按 `case 'x':` 切开，看每个分支有没有调 `needProjectId(payload)`，
 *      归纳出「哪些 op 必须带 projectId」。
 *   3. 顺手收集每个分支里 `payload.xxx` 出现过的字段名，写进注释（只做说明，不做类型）。
 *   4. 输出 types/index.d.ts。
 *
 * 用法：
 *   node scripts/gen-types.mjs           # 重新生成 types/index.d.ts
 *   node scripts/gen-types.mjs --check   # 只校验当前文件是否与源码同步（CI 用），不同步 exit 1
 *   node scripts/gen-types.mjs --print   # 打到 stdout，不写盘
 *
 * 零依赖：只用 node:fs / node:path / node:url。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const indexPath = path.join(repoRoot, 'index.js')
const outPath = path.join(repoRoot, 'types', 'index.d.ts')

/** 从 `export const X = [ ... ]` 里抽出所有单引号字符串。 */
function readOpList(source, constName) {
  const re = new RegExp(`export const ${constName} = \\[([\\s\\S]*?)\\n\\]`)
  const hit = source.match(re)
  if (!hit) throw new Error(`index.js 里找不到 ${constName} 数组`)
  return [...hit[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** 把 handleRpcCore 按 case 切开：返回 [{ op, body }]，body 是到下一个 case 之前的源码。 */
function sliceCases(source) {
  const start = source.indexOf('async function handleRpcCore')
  if (start < 0) throw new Error('index.js 里找不到 handleRpcCore')
  const section = source.slice(start)
  const marks = [...section.matchAll(/^\s*case '([a-z0-9.]+)':/gm)]
  return marks.map((mark, i) => {
    const from = mark.index + mark[0].length
    const to = i + 1 < marks.length ? marks[i + 1].index : section.length
    return { op: mark[1], body: section.slice(from, to) }
  })
}

/** 单个 op 的入参事实：是否强制 projectId、读到过哪些字段。 */
function payloadFacts(cases) {
  const facts = new Map()
  for (const { op, body } of cases) {
    const needsProject = /needProjectId\(\s*payload\s*\)/.test(body)
    const keys = [
      ...new Set([...body.matchAll(/payload\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1])),
    ].sort()
    facts.set(op, { needsProject, keys })
  }
  return facts
}

const SOURCE = await fs.readFile(indexPath, 'utf8')
const READ = readOpList(SOURCE, 'READ_OPS')
const WRITE = readOpList(SOURCE, 'WRITE_OPS')
const ALL = [...READ, ...WRITE]
const cases = sliceCases(SOURCE)
const facts = payloadFacts(cases)

// ── 自检：op 表 / case 分支 / 类型三者不许有洞 ──────────────
const caseOps = cases.map((row) => row.op)
const missingCase = ALL.filter((op) => !caseOps.includes(op))
const missingOp = caseOps.filter((op) => !ALL.includes(op))
const dup = ALL.filter((op, i) => ALL.indexOf(op) !== i)
if (missingCase.length)
  throw new Error(`这些 op 在 handleRpcCore 里没有 case：${missingCase.join(', ')}`)
if (missingOp.length) throw new Error(`这些 case 不在 op 表里：${missingOp.join(', ')}`)
if (dup.length) throw new Error(`op 重复登记：${dup.join(', ')}`)

const REQUIRES = ALL.filter((op) => facts.get(op)?.needsProject)
const OPTIONAL = ALL.filter((op) => !facts.get(op)?.needsProject)

const union = (ops) => ops.map((op) => `  | '${op}'`).join('\n')

const opDoc = ALL.map((op) => {
  const one = facts.get(op)
  const kind = READ.includes(op) ? 'read' : 'write'
  const need = one?.needsProject ? 'projectId 必填' : 'projectId 不需要'
  const keys = one?.keys.length ? one.keys.join(', ') : '—'
  return ` * @op ${op} — ${kind}／${need}；handleRpc 读到的字段：${keys}`
}).join('\n')

const dts = `// ─────────────────────────────────────────────────────────────────────────────
// 本文件由 scripts/gen-types.mjs 从 index.js 自动生成，请勿手动编辑。
// 改 op 表 → 重新跑 \`node scripts/gen-types.mjs\`（CI 会校验这个文件没有漂移）。
//
// 统计：${ALL.length} 个 op = ${READ.length} 读 + ${WRITE.length} 写；
// 其中 ${REQUIRES.length} 个必须带 projectId，${OPTIONAL.length} 个不需要。
// 唯一的入参契约来源是 index.js 的 requireOp / needProjectId 运行时校验，
// 这里只是把那份校验翻译成静态形状，不做额外假设。
// ─────────────────────────────────────────────────────────────────────────────

/** 插件名（宿主装载时用它当 id）。 */
export const name: 'nightwrite'
/** 服务端依赖的宿主服务。 */
export const inject: readonly ['tools']
/** 插件版本。 */
export const VERSION: string
/** HTTP 前缀路由：POST ${'`'}\${ROUTE}${'`'}。 */
export const ROUTE: string
/** agent 侧工具名。 */
export const TOOL_NAME: string

/** 读操作（不改作品状态版本号）。 */
export const READ_OPS: readonly NightwriteReadOp[]
/** 写操作（成功后由 handleRpc 统一给作品状态版本 +1）。 */
export const WRITE_OPS: readonly NightwriteWriteOp[]
/** 全部 op，等于 READ_OPS.concat(WRITE_OPS)。 */
export const RPC_OPS: readonly NightwriteOp[]

/** 全部合法 op 的联合类型。 */
export type NightwriteOp =
${union(ALL)}

/** 只读 op：不落盘，不 bump 状态版本。 */
export type NightwriteReadOp =
${union(READ)}

/** 写 op：落盘，成功后自动 bump 状态版本。 */
export type NightwriteWriteOp =
${union(WRITE)}

/** 必须带 projectId 的 op（由 needProjectId(payload) 强制，缺了直接 RpcError）。 */
export type NightwriteOpRequiresProjectId =
${union(REQUIRES)}

/** 不需要 projectId 的 op。 */
export type NightwriteOpWithoutProjectId =
${union(OPTIONAL)}

/**
 * op 的入参信封。
 *
 * 绝大多数 op 除 projectId 外还读别的字段（chapter / text / id / items …），
 * 这些字段的校验散在各 lib/*.js 里，所以这里给一个开放索引签名：
 * 具体形状以 op 自己的运行时校验为准，类型层只锁定 projectId。
 */
export interface NightwriteOpPayload {
  /** 作品 id；NightwriteOpRequiresProjectId 里的 op 必须给。 */
  projectId?: string
  [key: string]: unknown
}

/** 按 op 推导 payload：需要 projectId 的 op 拿到必填的 projectId。 */
export type NightwriteOpPayloadFor<Op extends NightwriteOp> = Op extends NightwriteOpRequiresProjectId
  ? NightwriteOpPayload & { projectId: string }
  : NightwriteOpPayload

/** 一次 RPC 调用的信封。 */
export interface NightwriteRpcBody<Op extends NightwriteOp = NightwriteOp> {
  op: Op
  payload?: NightwriteOpPayloadFor<Op>
}

/** 分派失败时抛出的错误。 */
export class RpcError extends Error {
  constructor(message: string, code?: string, details?: unknown)
  readonly code: string
  readonly details: unknown
}

/** 宿主工具的通用形状（与常见 agent 工具协议一致）。 */
export interface NightwriteTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: { op: NightwriteOp; payload?: NightwriteOpPayload }): Promise<unknown>
}

/** 派单工具的入参（nightwrite_dispatch）。 */
export interface NightwriteDispatchArgs {
  projectId: string
  role: string
  task: string
  chapter?: number
  materials?: string
  dryRun?: boolean
  send?: boolean
  sessionId?: string
  workspaceId?: string
}

/** 派单工具：开票 + 投递到对话。 */
export interface NightwriteDispatchTool extends Omit<NightwriteTool, 'execute'> {
  execute(args: NightwriteDispatchArgs): Promise<unknown>
}

/** RPC 入口的选项。 */
export interface NightwriteRpcOptions {
  /** 数据根目录；不传则用 NIGHTWRITE_ROOT 或 ~/.dsh/data/dsh-nightwrite。 */
  root?: string
  /** 写操作留给状态版本的署名（通常是操作人/来源）。 */
  by?: string
}

/** 插件配置。 */
export interface NightwriteConfig {
  /** 数据根目录，等价于设置 NIGHTWRITE_ROOT。 */
  root?: string
}

/**
 * 按 op 分派一次请求。
 *
 * @param body   { op, payload } 信封；op 必须是 NightwriteOp 之一。
 * @param ctx    宿主上下文（只用到 ctx.get('sessionController')，投递派单时用）。
 * @param options root 覆盖数据目录，by 写进状态版本。
 * @returns op 自己的返回体；形状随 op 变化。
 */
export function handleRpc(
  body?: NightwriteRpcBody,
  ctx?: unknown,
  options?: NightwriteRpcOptions
): Promise<unknown>

/**
 * 造 agent 侧工具对象（nightwrite_op），挂到 ctx.tools.register 上。
 *
 * @param root 数据根目录（绝对路径）。
 */
export function createTool(root: string): NightwriteTool

/**
 * 造派单工具对象（nightwrite_dispatch）。
 *
 * @param root 数据根目录（绝对路径）。
 */
export function createDispatchTool(root: string): NightwriteDispatchTool

/**
 * 插件入口：挂 /nightwrite/api 路由，并注册两个工具。
 *
 * @param ctx    Cordis 上下文；缺 ctx.inject 时什么都不做（不会抛）。
 * @param config { root } 可选。
 */
export function apply(ctx: unknown, config?: NightwriteConfig): void

/* 生成的入参说明（来自 handleRpcCore 的静态扫描）：
 *
${opDoc}
 */
`

const mode = process.argv.includes('--check')
  ? 'check'
  : process.argv.includes('--print')
    ? 'print'
    : 'write'

if (mode === 'print') {
  process.stdout.write(dts)
} else if (mode === 'check') {
  let current = ''
  try {
    current = await fs.readFile(outPath, 'utf8')
  } catch {
    console.error(`✗ 缺少 types/index.d.ts；先跑 node scripts/gen-types.mjs`)
    process.exit(1)
  }
  if (current !== dts) {
    console.error(
      '✗ types/index.d.ts 与 index.js 的 op 表不同步；跑 node scripts/gen-types.mjs 重新生成',
    )
    process.exit(1)
  }
  console.log(`OK types/index.d.ts 同步（${ALL.length} op）`)
} else {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, dts, 'utf8')
  console.log(
    `OK types/index.d.ts  ${ALL.length} op（${READ.length} 读 / ${WRITE.length} 写，${REQUIRES.length} 个需要 projectId）`,
  )
}
