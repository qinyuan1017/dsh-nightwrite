// ─────────────────────────────────────────────────────────────────────────────
// 本文件由 scripts/gen-types.mjs 从 index.js 自动生成，请勿手动编辑。
// 改 op 表 → 重新跑 `node scripts/gen-types.mjs`（CI 会校验这个文件没有漂移）。
//
// 统计：119 个 op = 60 读 + 59 写；
// 其中 102 个必须带 projectId，17 个不需要。
// 唯一的入参契约来源是 index.js 的 requireOp / needProjectId 运行时校验，
// 这里只是把那份校验翻译成静态形状，不做额外假设。
// ─────────────────────────────────────────────────────────────────────────────

/** 插件名（宿主装载时用它当 id）。 */
export const name: 'nightwrite'
/** 服务端依赖的宿主服务。 */
export const inject: readonly ['tools']
/** 插件版本。 */
export const VERSION: string
/** HTTP 前缀路由：POST `${ROUTE}`。 */
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
  | 'ping'
  | 'project.list'
  | 'project.get'
  | 'overview'
  | 'chapter.list'
  | 'chapter.get'
  | 'chapter.history'
  | 'chapter.version'
  | 'chapter.trash'
  | 'chapter.aistyle'
  | 'aistyle.get'
  | 'ledger.get'
  | 'templates.list'
  | 'queue.list'
  | 'outline.get'
  | 'outline.intent'
  | 'proposal.list'
  | 'proposal.preview'
  | 'problem.list'
  | 'search'
  | 'role.list'
  | 'dispatch.list'
  | 'dispatch.get'
  | 'report.list'
  | 'lint.rules'
  | 'lint.check'
  | 'lint.degenerate'
  | 'text.normalize'
  | 'outline.copy'
  | 'wordcount.check'
  | 'lint.calibration'
  | 'feedback.get'
  | 'corpus.list'
  | 'corpus.thresholds'
  | 'analyze.list'
  | 'analyze.get'
  | 'import.preview'
  | 'import.dir'
  | 'scan.list'
  | 'scan.get'
  | 'outline.slice'
  | 'taskpack.list'
  | 'taskpack.get'
  | 'ledger.audit'
  | 'state.get'
  | 'run.list'
  | 'run.get'
  | 'run.current'
  | 'map.get'
  | 'update.check'
  | 'coldread.list'
  | 'opinion.list'
  | 'briefing.get'
  | 'aiscore.check'
  | 'fidelity.check'
  | 'anchor.index'
  | 'usage.scan'
  | 'usage.budget'
  | 'usage.models'
  | 'subagent.status'
  | 'project.create'
  | 'project.save'
  | 'project.delete'
  | 'chapter.save'
  | 'chapter.delete'
  | 'chapter.restore'
  | 'chapter.recover'
  | 'chapter.purge'
  | 'chapter.move'
  | 'chapter.insert'
  | 'aistyle.save'
  | 'lint.calibrate'
  | 'lint.calibrate.save'
  | 'feedback.learn'
  | 'corpus.add'
  | 'corpus.remove'
  | 'corpus.apply'
  | 'ledger.upsert'
  | 'ledger.remove'
  | 'ledger.save'
  | 'template.save'
  | 'template.remove'
  | 'queue.add'
  | 'queue.update'
  | 'queue.remove'
  | 'review.action'
  | 'outline.save'
  | 'outline.generate'
  | 'map.sync'
  | 'map.save'
  | 'map.explain'
  | 'coldread.prepare'
  | 'opinion.save'
  | 'opinion.bulk'
  | 'opinion.decide'
  | 'opinion.remove'
  | 'opinion.collect'
  | 'coldread.submit'
  | 'proposal.save'
  | 'proposal.decide'
  | 'proposal.remove'
  | 'problem.save'
  | 'problem.resolve'
  | 'problem.remove'
  | 'dispatch.issue'
  | 'dispatch.send'
  | 'dispatch.revoke'
  | 'dispatch.sweep'
  | 'report.submit'
  | 'analyze.start'
  | 'analyze.remove'
  | 'import.run'
  | 'scan.save'
  | 'scan.fetch'
  | 'taskpack.build'
  | 'run.open'
  | 'run.claim'
  | 'run.review'
  | 'run.close'

/** 只读 op：不落盘，不 bump 状态版本。 */
export type NightwriteReadOp =
  | 'ping'
  | 'project.list'
  | 'project.get'
  | 'overview'
  | 'chapter.list'
  | 'chapter.get'
  | 'chapter.history'
  | 'chapter.version'
  | 'chapter.trash'
  | 'chapter.aistyle'
  | 'aistyle.get'
  | 'ledger.get'
  | 'templates.list'
  | 'queue.list'
  | 'outline.get'
  | 'outline.intent'
  | 'proposal.list'
  | 'proposal.preview'
  | 'problem.list'
  | 'search'
  | 'role.list'
  | 'dispatch.list'
  | 'dispatch.get'
  | 'report.list'
  | 'lint.rules'
  | 'lint.check'
  | 'lint.degenerate'
  | 'text.normalize'
  | 'outline.copy'
  | 'wordcount.check'
  | 'lint.calibration'
  | 'feedback.get'
  | 'corpus.list'
  | 'corpus.thresholds'
  | 'analyze.list'
  | 'analyze.get'
  | 'import.preview'
  | 'import.dir'
  | 'scan.list'
  | 'scan.get'
  | 'outline.slice'
  | 'taskpack.list'
  | 'taskpack.get'
  | 'ledger.audit'
  | 'state.get'
  | 'run.list'
  | 'run.get'
  | 'run.current'
  | 'map.get'
  | 'update.check'
  | 'coldread.list'
  | 'opinion.list'
  | 'briefing.get'
  | 'aiscore.check'
  | 'fidelity.check'
  | 'anchor.index'
  | 'usage.scan'
  | 'usage.budget'
  | 'usage.models'
  | 'subagent.status'

/** 写 op：落盘，成功后自动 bump 状态版本。 */
export type NightwriteWriteOp =
  | 'project.create'
  | 'project.save'
  | 'project.delete'
  | 'chapter.save'
  | 'chapter.delete'
  | 'chapter.restore'
  | 'chapter.recover'
  | 'chapter.purge'
  | 'chapter.move'
  | 'chapter.insert'
  | 'aistyle.save'
  | 'lint.calibrate'
  | 'lint.calibrate.save'
  | 'feedback.learn'
  | 'corpus.add'
  | 'corpus.remove'
  | 'corpus.apply'
  | 'ledger.upsert'
  | 'ledger.remove'
  | 'ledger.save'
  | 'template.save'
  | 'template.remove'
  | 'queue.add'
  | 'queue.update'
  | 'queue.remove'
  | 'review.action'
  | 'outline.save'
  | 'outline.generate'
  | 'map.sync'
  | 'map.save'
  | 'map.explain'
  | 'coldread.prepare'
  | 'opinion.save'
  | 'opinion.bulk'
  | 'opinion.decide'
  | 'opinion.remove'
  | 'opinion.collect'
  | 'coldread.submit'
  | 'proposal.save'
  | 'proposal.decide'
  | 'proposal.remove'
  | 'problem.save'
  | 'problem.resolve'
  | 'problem.remove'
  | 'dispatch.issue'
  | 'dispatch.send'
  | 'dispatch.revoke'
  | 'dispatch.sweep'
  | 'report.submit'
  | 'analyze.start'
  | 'analyze.remove'
  | 'import.run'
  | 'scan.save'
  | 'scan.fetch'
  | 'taskpack.build'
  | 'run.open'
  | 'run.claim'
  | 'run.review'
  | 'run.close'

/** 必须带 projectId 的 op（由 needProjectId(payload) 强制，缺了直接 RpcError）。 */
export type NightwriteOpRequiresProjectId =
  | 'project.get'
  | 'overview'
  | 'chapter.list'
  | 'chapter.get'
  | 'chapter.history'
  | 'chapter.version'
  | 'chapter.trash'
  | 'chapter.aistyle'
  | 'aistyle.get'
  | 'ledger.get'
  | 'templates.list'
  | 'queue.list'
  | 'outline.get'
  | 'outline.intent'
  | 'proposal.list'
  | 'proposal.preview'
  | 'problem.list'
  | 'search'
  | 'dispatch.list'
  | 'dispatch.get'
  | 'report.list'
  | 'lint.check'
  | 'lint.degenerate'
  | 'text.normalize'
  | 'outline.copy'
  | 'wordcount.check'
  | 'lint.calibration'
  | 'feedback.get'
  | 'analyze.list'
  | 'analyze.get'
  | 'scan.list'
  | 'scan.get'
  | 'outline.slice'
  | 'taskpack.list'
  | 'taskpack.get'
  | 'ledger.audit'
  | 'state.get'
  | 'run.list'
  | 'run.get'
  | 'run.current'
  | 'map.get'
  | 'coldread.list'
  | 'opinion.list'
  | 'briefing.get'
  | 'aiscore.check'
  | 'fidelity.check'
  | 'anchor.index'
  | 'project.save'
  | 'project.delete'
  | 'chapter.save'
  | 'chapter.delete'
  | 'chapter.restore'
  | 'chapter.recover'
  | 'chapter.purge'
  | 'chapter.move'
  | 'chapter.insert'
  | 'aistyle.save'
  | 'lint.calibrate'
  | 'lint.calibrate.save'
  | 'feedback.learn'
  | 'corpus.apply'
  | 'ledger.upsert'
  | 'ledger.remove'
  | 'ledger.save'
  | 'template.save'
  | 'template.remove'
  | 'queue.add'
  | 'queue.update'
  | 'queue.remove'
  | 'review.action'
  | 'outline.save'
  | 'outline.generate'
  | 'map.sync'
  | 'map.save'
  | 'map.explain'
  | 'coldread.prepare'
  | 'opinion.save'
  | 'opinion.bulk'
  | 'opinion.decide'
  | 'opinion.remove'
  | 'opinion.collect'
  | 'coldread.submit'
  | 'proposal.save'
  | 'proposal.decide'
  | 'proposal.remove'
  | 'problem.save'
  | 'problem.resolve'
  | 'problem.remove'
  | 'dispatch.issue'
  | 'dispatch.send'
  | 'dispatch.revoke'
  | 'dispatch.sweep'
  | 'report.submit'
  | 'analyze.start'
  | 'analyze.remove'
  | 'import.run'
  | 'scan.save'
  | 'taskpack.build'
  | 'run.open'
  | 'run.claim'
  | 'run.review'
  | 'run.close'

/** 不需要 projectId 的 op。 */
export type NightwriteOpWithoutProjectId =
  | 'ping'
  | 'project.list'
  | 'role.list'
  | 'lint.rules'
  | 'corpus.list'
  | 'corpus.thresholds'
  | 'import.preview'
  | 'import.dir'
  | 'update.check'
  | 'usage.scan'
  | 'usage.budget'
  | 'usage.models'
  | 'subagent.status'
  | 'project.create'
  | 'corpus.add'
  | 'corpus.remove'
  | 'scan.fetch'

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
 * @op ping — read／projectId 不需要；handleRpc 读到的字段：—
 * @op project.list — read／projectId 不需要；handleRpc 读到的字段：—
 * @op project.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op overview — read／projectId 必填；handleRpc 读到的字段：—
 * @op chapter.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op chapter.get — read／projectId 必填；handleRpc 读到的字段：chapter
 * @op chapter.history — read／projectId 必填；handleRpc 读到的字段：chapter
 * @op chapter.version — read／projectId 必填；handleRpc 读到的字段：chapter, name
 * @op chapter.trash — read／projectId 必填；handleRpc 读到的字段：—
 * @op chapter.aistyle — read／projectId 必填；handleRpc 读到的字段：chapter
 * @op aistyle.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op ledger.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op templates.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op queue.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op outline.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op outline.intent — read／projectId 必填；handleRpc 读到的字段：chapter
 * @op proposal.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op proposal.preview — read／projectId 必填；handleRpc 读到的字段：id
 * @op problem.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op search — read／projectId 必填；handleRpc 读到的字段：q, query
 * @op role.list — read／projectId 不需要；handleRpc 读到的字段：—
 * @op dispatch.list — read／projectId 必填；handleRpc 读到的字段：limit, role, status
 * @op dispatch.get — read／projectId 必填；handleRpc 读到的字段：id
 * @op report.list — read／projectId 必填；handleRpc 读到的字段：limit, role
 * @op lint.rules — read／projectId 不需要；handleRpc 读到的字段：—
 * @op lint.check — read／projectId 必填；handleRpc 读到的字段：chapter, only, projectId, skip, text, thresholds, useCalibration, whitelist
 * @op lint.degenerate — read／projectId 必填；handleRpc 读到的字段：chapter, projectId, text, whitelist
 * @op text.normalize — read／projectId 必填；handleRpc 读到的字段：apply, chapter, only, projectId, style, text, whitelist
 * @op outline.copy — read／projectId 必填；handleRpc 读到的字段：chapter, minChars, text, warnChars
 * @op wordcount.check — read／projectId 必填；handleRpc 读到的字段：chapter, projectId, text
 * @op lint.calibration — read／projectId 必填；handleRpc 读到的字段：—
 * @op feedback.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op corpus.list — read／projectId 不需要；handleRpc 读到的字段：—
 * @op corpus.thresholds — read／projectId 不需要；handleRpc 读到的字段：—
 * @op analyze.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op analyze.get — read／projectId 必填；handleRpc 读到的字段：id
 * @op import.preview — read／projectId 不需要；handleRpc 读到的字段：—
 * @op import.dir — read／projectId 不需要；handleRpc 读到的字段：dir
 * @op scan.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op scan.get — read／projectId 必填；handleRpc 读到的字段：id
 * @op outline.slice — read／projectId 必填；handleRpc 读到的字段：brief, from, maxBytes, to, toc, volume, withBody
 * @op taskpack.list — read／projectId 必填；handleRpc 读到的字段：limit, role
 * @op taskpack.get — read／projectId 必填；handleRpc 读到的字段：pack
 * @op ledger.audit — read／projectId 必填；handleRpc 读到的字段：—
 * @op state.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op run.list — read／projectId 必填；handleRpc 读到的字段：limit, status
 * @op run.get — read／projectId 必填；handleRpc 读到的字段：id, runId
 * @op run.current — read／projectId 必填；handleRpc 读到的字段：—
 * @op map.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op update.check — read／projectId 不需要；handleRpc 读到的字段：force, installed, timeoutMs
 * @op coldread.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op opinion.list — read／projectId 必填；handleRpc 读到的字段：—
 * @op briefing.get — read／projectId 必填；handleRpc 读到的字段：—
 * @op aiscore.check — read／projectId 必填；handleRpc 读到的字段：chapter, text, whitelist
 * @op fidelity.check — read／projectId 必填；handleRpc 读到的字段：after, before, chapter, ratio
 * @op anchor.index — read／projectId 必填；handleRpc 读到的字段：chapter
 * @op usage.scan — read／projectId 不需要；handleRpc 读到的字段：cwd, limit, projectId
 * @op usage.budget — read／projectId 不需要；handleRpc 读到的字段：chapterWords, chapters, contextFactor, model
 * @op usage.models — read／projectId 不需要；handleRpc 读到的字段：—
 * @op subagent.status — read／projectId 不需要；handleRpc 读到的字段：—
 * @op project.create — write／projectId 不需要；handleRpc 读到的字段：—
 * @op project.save — write／projectId 必填；handleRpc 读到的字段：patch
 * @op project.delete — write／projectId 必填；handleRpc 读到的字段：—
 * @op chapter.save — write／projectId 必填；handleRpc 读到的字段：by, chapter, expectRev, force, lint, meta, runClaim, runGuard, runId, text, whitelist
 * @op chapter.delete — write／projectId 必填；handleRpc 读到的字段：chapter
 * @op chapter.restore — write／projectId 必填；handleRpc 读到的字段：chapter, name
 * @op chapter.recover — write／projectId 必填；handleRpc 读到的字段：trash
 * @op chapter.purge — write／projectId 必填；handleRpc 读到的字段：trash
 * @op chapter.move — write／projectId 必填；handleRpc 读到的字段：from, to
 * @op chapter.insert — write／projectId 必填；handleRpc 读到的字段：at, intent, title
 * @op aistyle.save — write／projectId 必填；handleRpc 读到的字段：—
 * @op lint.calibrate — write／projectId 必填；handleRpc 读到的字段：limit
 * @op lint.calibrate.save — write／projectId 必填；handleRpc 读到的字段：thresholds
 * @op feedback.learn — write／projectId 必填；handleRpc 读到的字段：—
 * @op corpus.add — write／projectId 不需要；handleRpc 读到的字段：—
 * @op corpus.remove — write／projectId 不需要；handleRpc 读到的字段：—
 * @op corpus.apply — write／projectId 必填；handleRpc 读到的字段：only
 * @op ledger.upsert — write／projectId 必填；handleRpc 读到的字段：kind, row
 * @op ledger.remove — write／projectId 必填；handleRpc 读到的字段：id, kind
 * @op ledger.save — write／projectId 必填；handleRpc 读到的字段：ledger
 * @op template.save — write／projectId 必填；handleRpc 读到的字段：template
 * @op template.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op queue.add — write／projectId 必填；handleRpc 读到的字段：item
 * @op queue.update — write／projectId 必填；handleRpc 读到的字段：id, patch
 * @op queue.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op review.action — write／projectId 必填；handleRpc 读到的字段：action, chapter
 * @op outline.save — write／projectId 必填；handleRpc 读到的字段：outline, patch
 * @op outline.generate — write／projectId 必填；handleRpc 读到的字段：—
 * @op map.sync — write／projectId 必填；handleRpc 读到的字段：—
 * @op map.save — write／projectId 必填；handleRpc 读到的字段：—
 * @op map.explain — write／projectId 必填；handleRpc 读到的字段：from, to
 * @op coldread.prepare — write／projectId 必填；handleRpc 读到的字段：—
 * @op opinion.save — write／projectId 必填；handleRpc 读到的字段：opinion
 * @op opinion.bulk — write／projectId 必填；handleRpc 读到的字段：—
 * @op opinion.decide — write／projectId 必填；handleRpc 读到的字段：decision, id, resolution, status
 * @op opinion.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op opinion.collect — write／projectId 必填；handleRpc 读到的字段：—
 * @op coldread.submit — write／projectId 必填；handleRpc 读到的字段：chapter, file, fileName, items, score, verdict
 * @op proposal.save — write／projectId 必填；handleRpc 读到的字段：proposal
 * @op proposal.decide — write／projectId 必填；handleRpc 读到的字段：action, id
 * @op proposal.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op problem.save — write／projectId 必填；handleRpc 读到的字段：problem
 * @op problem.resolve — write／projectId 必填；handleRpc 读到的字段：id, status
 * @op problem.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op dispatch.issue — write／projectId 必填；handleRpc 读到的字段：chapter, extra, materials, pack, role, runId, stageId, task
 * @op dispatch.send — write／projectId 必填；handleRpc 读到的字段：—
 * @op dispatch.revoke — write／projectId 必填；handleRpc 读到的字段：id
 * @op dispatch.sweep — write／projectId 必填；handleRpc 读到的字段：—
 * @op report.submit — write／projectId 必填；handleRpc 读到的字段：id, submittedBy, text, verdict
 * @op analyze.start — write／projectId 必填；handleRpc 读到的字段：—
 * @op analyze.remove — write／projectId 必填；handleRpc 读到的字段：id
 * @op import.run — write／projectId 必填；handleRpc 读到的字段：writeOutline
 * @op scan.save — write／projectId 必填；handleRpc 读到的字段：—
 * @op scan.fetch — write／projectId 不需要；handleRpc 读到的字段：—
 * @op taskpack.build — write／projectId 必填；handleRpc 读到的字段：chapter, extra, maxBytes, role, task
 * @op run.open — write／projectId 必填；handleRpc 读到的字段：—
 * @op run.claim — write／projectId 必填；handleRpc 读到的字段：—
 * @op run.review — write／projectId 必填；handleRpc 读到的字段：—
 * @op run.close — write／projectId 必填；handleRpc 读到的字段：—
 */
