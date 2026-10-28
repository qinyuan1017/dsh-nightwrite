/**
 * 长夜 · 服务端（Cordis 插件）
 *
 * 只做三件事：
 *   1. 把 /nightwrite/api 挂到宿主 webServer（prefix 路由）
 *   2. 每个请求交由 handleRpc 按 op 分派到 lib/store.js
 *   3. 注册一个工具 nightwrite_op，让 agent 也能读写同一份数据
 *
 * 不做鉴权逻辑：交给宿主的 connection.requestRejection，回退到回环兜底。
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as store from './lib/store.js'
import { buildZip } from './lib/zip.js'
import * as dispatch from './lib/dispatch.js'
import * as lint from './lib/lint.js'
import * as corpus from './lib/corpus.js'
import * as analyze from './lib/analyze.js'
import * as importer from './lib/import.js'
import * as scan from './lib/scan.js'
import * as outlineview from './lib/outlineview.js'
import * as taskpack from './lib/taskpack.js'
import * as run from './lib/run.js'
import * as wordcount from './lib/wordcount.js'
import * as textnorm from './lib/textnorm.js'
import * as outlinecopy from './lib/outlinecopy.js'
import * as ebook from './lib/ebook.js'
import * as worldmap from './lib/worldmap.js'
import * as update from './lib/update.js'
import * as coldread from './lib/coldread.js'
import * as opinions from './lib/opinions.js'
import * as briefing from './lib/briefing.js'
import * as hooks from './lib/hooks.js'
import * as aiscore from './lib/aiscore.js'
import * as fidelity from './lib/fidelity.js'
import * as anchors from './lib/anchors.js'
import * as usage from './lib/usage.js'
import * as spawn from './lib/spawn.js'
import * as configLib from './lib/config.js'

// agents/ 与本文件同目录；派单任务书里要给它绝对路径，模型才不会猜。
const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url))

export const name = 'nightwrite'
export const inject = ['tools', 'subagents']
export const VERSION = '0.1.0'
export const ROUTE = '/nightwrite/api'
export const TOOL_NAME = 'nightwrite_op'

/**
 * 单次请求体上限。
 *
 * 为什么是函数不是常量：`maxBodyBytes` 是配置项。常量在这里的意思是
 * 「改配置不生效」——设置页填了 32MB，服务端还按 8MB 拒，作者只会觉得配置坏了。
 */
function maxBody() {
  const n = Number(configLib.getRuntimeConfig().maxBodyBytes)
  return Number.isFinite(n) && n > 0 ? n : 8 * 1024 * 1024
}

/** 8MB 这类数字给人看的样子：整 MB 就写 8MB，零头才写 KB。 */
function mbText(bytes) {
  return bytes % (1024 * 1024) === 0 ? `${bytes / 1024 / 1024}MB` : `${Math.round(bytes / 1024)}KB`
}

export class RpcError extends Error {
  constructor(message, code = 'invalid', details = null) {
    super(message)
    this.name = 'RpcError'
    this.code = code
    this.details = details
  }
}

const invalid = (message) => {
  throw new RpcError(message, 'invalid')
}

// ── op 表 ────────────────────────────────────────────────────

export const READ_OPS = [
  'ping',
  'project.list',
  'project.get',
  'overview',
  'chapter.list',
  'chapter.get',
  'chapter.history',
  'chapter.version',
  'chapter.trash',
  'chapter.aistyle',
  'aistyle.get',
  'ledger.get',
  'templates.list',
  'queue.list',
  'outline.get',
  'outline.intent',
  'proposal.list',
  'proposal.preview',
  'problem.list',
  'search',
  'role.list',
  'dispatch.list',
  'dispatch.get',
  'report.list',
  'lint.rules',
  'lint.check',
  'lint.degenerate',
  'text.normalize',
  'outline.copy',
  'wordcount.check',
  'lint.calibration',
  'feedback.get',
  'corpus.list',
  'corpus.thresholds',
  'analyze.list',
  'analyze.get',
  'import.preview',
  'import.dir',
  'scan.list',
  'scan.get',
  'outline.slice',
  'taskpack.list',
  'taskpack.get',
  'ledger.audit',
  'state.get',
  'run.list',
  'run.get',
  'run.current',
  'map.get',
  'update.check',
  'coldread.list',
  'opinion.list',
  'briefing.get',
  'aiscore.check',
  'fidelity.check',
  'anchor.index',
  'usage.scan',
  'usage.budget',
  'usage.models',
  'subagent.status',
]

export const WRITE_OPS = [
  'project.create',
  'project.save',
  'project.delete',
  'chapter.save',
  'chapter.delete',
  'chapter.restore',
  'chapter.recover',
  'chapter.purge',
  'chapter.move',
  'chapter.insert',
  'aistyle.save',
  'lint.calibrate',
  'lint.calibrate.save',
  'feedback.learn',
  'corpus.add',
  'corpus.remove',
  'corpus.apply',
  'ledger.upsert',
  'ledger.remove',
  'ledger.save',
  'template.save',
  'template.remove',
  'queue.add',
  'queue.update',
  'queue.remove',
  'review.action',
  'outline.save',
  'outline.generate',
  'map.sync',
  'map.save',
  'map.explain',
  'coldread.prepare',
  'opinion.save',
  'opinion.bulk',
  'opinion.decide',
  'opinion.remove',
  'opinion.collect',
  'coldread.submit',
  'proposal.save',
  'proposal.decide',
  'proposal.remove',
  'problem.save',
  'problem.resolve',
  'problem.remove',
  'dispatch.issue',
  'dispatch.send',
  'dispatch.revoke',
  'dispatch.sweep',
  'report.submit',
  'analyze.start',
  'analyze.remove',
  'import.run',
  'scan.save',
  'scan.fetch',
  'taskpack.build',
  'run.open',
  'run.claim',
  'run.review',
  'run.close',
]

export const RPC_OPS = [...READ_OPS, ...WRITE_OPS]

function requireOp(op) {
  const key = String(op ?? '').trim()
  if (!RPC_OPS.includes(key)) invalid(`未知 op：${key || '(空)'}；可用：${RPC_OPS.join(', ')}`)
  return key
}

function needProjectId(payload = {}) {
  const id = String(payload.projectId ?? '').trim()
  if (!id) invalid('缺少 projectId')
  return id
}

// ── RPC ──────────────────────────────────────────────────────

/**
 * 把派单任务书投递到对话。
 *
 * 三条路径：
 *   1. 指定 sessionId → 直接投那个会话。
 *   2. 没指定 → 从宿主的会话列表里挑一个「普通会话」投（排 subagent / 带 parentSessionId 的）。
 *   3. 一个都没有 → 新建一个（需要作品的 workspaceId）。
 *
 * 为什么不自己拼 HTTP 请求：宿主的 sessionController 是唯一的投递口，
 * 绕过它就得自己处理排队、鉴权、子代理路由，全是坑。
 */
async function sendDispatch(dir, payload = {}, ctx = {}, options = {}) {
  const id = String(payload.id ?? '').trim()
  if (!id) invalid('缺少派单票据 id')
  const ticket = await dispatch.getDispatch(dir, id)
  if (ticket.status === 'revoked') invalid('这张票已作废，不能投递')
  if (ticket.status === 'expired') invalid('这张票已过期（超过 60 分钟），请重新派单')
  if (ticket.status === 'submitted') invalid('这张票已经交过回执了')

  const prompt = dispatch.buildDispatchPrompt(ticket, { repoRoot: REPO_ROOT })
  // dryRun：只把任务书文本交回界面，用来「预览 / 复制」，不真发。
  if (payload.dryRun) return { dryRun: true, prompt, ticket }

  const controller = ctx?.get?.('sessionController')
  if (!controller || (typeof controller.prompt !== 'function' && typeof controller.create !== 'function')) {
    await dispatch.markDeliveryFailed(dir, id, '宿主未提供会话服务（sessionController）')
    invalid('宿主未提供会话服务（sessionController），无法把派单发到对话')
  }

  const isTarget = (row) => Boolean(row) && row.origin !== 'subagent' && !row.parentSessionId && row.agentAvailable !== false
  const listOf = (listed) => (Array.isArray(listed) ? listed : (Array.isArray(listed?.items) ? listed.items : (Array.isArray(listed?.sessions) ? listed.sessions : [])))

  let sessionId = String(payload.sessionId ?? ticket.sessionId ?? '').trim()
  let created = false
  const createSession = async () => {
    if (typeof controller.create !== 'function') return ''
    const workspaceId = String(payload.workspaceId ?? '').trim()
    if (!workspaceId) invalid('没有 workspaceId，无法新建会话；请先指定一个已有对话')
    const made = await controller.create({ workspaceId })
    created = true
    return String(made?.sessionId ?? made?.id ?? '')
  }

  let candidates = []
  if (typeof controller.list === 'function') {
    const listed = await controller.list({}, AbortSignal.timeout(15000)).catch(() => null)
    const items = listOf(listed).filter(isTarget)
    const workspacePath = String(payload.workspacePath ?? '').trim()
    const sameCwd = workspacePath ? items.filter((row) => !row.cwd || String(row.cwd) === workspacePath) : items
    candidates = (sameCwd.length ? sameCwd : items)
      .slice()
      .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
      .map((row) => String(row.sessionId ?? ''))
      .filter(Boolean)
  }
  if (!sessionId && payload.newSession) sessionId = await createSession()
  if (!sessionId) sessionId = candidates[0] ?? ''
  if (!sessionId) sessionId = await createSession()
  if (!sessionId) {
    await dispatch.markDeliveryFailed(dir, id, '宿主里没有可用会话')
    invalid('宿主里没有可用会话（现有会话都是子代理会话），且无法新建；可以把任务书复制出去手工发')
  }

  // ── 真派子代理（第 2 条）────────────────────────────────
  // 优先走宿主原生 subagent：子代理有独立上下文、有人格、有工具白名单，
  // 不和作者的对话混在一起。宿主不支持或手里没有活着的父代理时，退回写会话。
  if (payload.spawn) {
    const ready = spawn.canSpawn(ctx, options.parent)
    if (!ready.ok) {
      if (payload.spawn === 'only') invalid(`不能派子代理：${ready.reason}`)
      // 退回会话投递，但把原因带回去，免得界面以为「派了」其实只是发了个消息。
      const fallbackReason = ready.reason
      const sent = await sendToSession(dir, id, payload, ctx, ticket, prompt, handoff)
      return { ...sent, spawned: false, spawnReason: fallbackReason }
    }
    try {
      const run = await spawn.spawnRole(ctx, {
        parent: options.parent,
        role: ticket.role,
        repoRoot: REPO_ROOT,
        label: `${ticket.role} · ${ticket.id}`,
        prompt,
        cwd: options.cwd ?? options.parent?.session?.header?.cwd,
      })
      await dispatch.markDelivered(dir, id, run.childId)
      const output = await run.result.catch((error) => ({
        stopReason: 'error',
        diagnostic: String(error?.message ?? error),
      }))
      await run.dispose()
      const text = Array.isArray(output?.output)
        ? output.output.map((block) => (block?.type === 'text' ? block.text : '')).join('\n').trim()
        : ''
      let settled = null
      if (text) {
        try {
          settled = await dispatch.submitReport(dir, id, { report: text })
        } catch {
          // 回执格式不合规不该让派单算失败：票已经 delivered，正文能看就行。
        }
      }
      return {
        sent: true,
        spawned: true,
        childId: run.childId,
        role: run.role,
        allow: run.allow,
        personaOk: run.personaOk,
        personaApplied: run.personaApplied,
        stopReason: output?.stopReason ?? '',
        diagnostic: output?.diagnostic ?? '',
        report: text,
        ticket: settled ?? await dispatch.getDispatch(dir, id),
        prompt,
      }
    } catch (error) {
      const message = `派子代理失败：${error?.message ?? error}`
      if (payload.spawn === 'only') {
        await dispatch.markDeliveryFailed(dir, id, message)
        throw new RpcError(message, error?.code ?? 'spawn-failed')
      }
      const sent = await sendToSession(dir, id, payload, ctx, ticket, prompt)
      return { ...sent, spawned: false, spawnReason: message }
    }
  }

  // handoff 把「会话投递需要的东西」打包交出去。
  // 不这么做的话 sendToSession 拿不到 controller —— 它是另一个函数的局部变量，
  // 靠作用域巧合能编译、但一跑就 ReferenceError。见文件末尾那段注释。
  const handoff = { controller, sessionId, candidates, createSession }
  return sendToSession(dir, id, payload, ctx, ticket, prompt, handoff)
}

/**
 * 老路：把任务书写进某个已有对话。
 *
 * 留着不是念旧——派子代理要宿主支持 spawn provider，
 * 而且必须从工具里发起（RPC 路由手里没有 Agent）。
 * 命令行、脚本、旧宿主都得有条能干活的退路。
 */
async function sendToSession(dir, id, payload, ctx, ticket, prompt, handoff) {
  const { controller, sessionId, candidates, createSession } = handoff
  const requestId = globalThis.crypto?.randomUUID?.() ?? `nw-${Date.now()}-${Math.random().toString(16).slice(2)}`
  const deliver = (target) => controller.prompt({
    requestId,
    sessionId: target,
    mode: 'queue',
    content: [{ type: 'text', text: prompt }],
    clientTimeZone: 'Asia/Shanghai',
  }, AbortSignal.timeout(20000))

  const failures = []
  const queue = [sessionId, ...candidates.filter((one) => one !== sessionId)]
  for (const target of queue) {
    try {
      await deliver(target)
      const marked = await dispatch.markDelivered(dir, id, target)
      return { sent: true, sessionId: target, created: false, prompt, ticket: marked }
    } catch (error) {
      failures.push(`${target}：${error?.message ?? error}`)
    }
  }

  const fresh = await createSession().catch(() => '')
  if (fresh) {
    try {
      await deliver(fresh)
      const marked = await dispatch.markDelivered(dir, id, fresh)
      return { sent: true, sessionId: fresh, created: true, prompt, ticket: marked }
    } catch (error) {
      failures.push(`${fresh}：${error?.message ?? error}`)
    }
  }

  const message = failures.join(' | ').slice(0, 500)
  await dispatch.markDeliveryFailed(dir, id, message)
  invalid(`派单投递失败：${message}`)
}

export async function handleRpc(body = {}, ctx = {}, options = {}) {
  const op = requireOp(body?.op)
  const payload = body?.payload && typeof body.payload === 'object' ? body.payload : {}
  const root = options.root ?? store.defaultRoot()
  const result = await handleRpcCore(op, payload, ctx, options, root)
  // 写操作成功后给作品状态版本 +1。
  // 为什么放在最外层而不是每个 case 里：47 个写 op 各自 bump 必然会漏一个，
  // 而漏掉的那个正好会让界面「改了但看不出变化」——最难查的一类 bug。
  // 代价是 status 之类的纯读不动版本，这是对的：界面不需要为读而重取。
  if (WRITE_OPS.includes(op)) {
    try {
      const projectId = String(payload.projectId ?? '').trim()
      if (projectId) {
        const dir = await store.projectDir(root, projectId)
        await store.bumpState(dir, {
          by: String(options.by ?? ''),
          touched: { op },
        })
      }
    } catch {
      // 版本号失败不该让业务操作回滚：数据已经落盘了，
      // 只是界面可能晚一轮才知道。这里吞掉是刻意的。
    }
  }
  return result
}

async function handleRpcCore(op, payload, ctx, options, root) {
  switch (op) {
    case 'ping':
      return { name, version: VERSION, root, ops: RPC_OPS.length }

    case 'project.list':
      return { projects: await store.listProjects(root) }

    case 'project.get': {
      const projectId = needProjectId(payload)
      const { meta, dir } = await store.getProject(root, projectId)
      return { project: meta, dir }
    }

    case 'project.create':
      return store.createProject(root, payload)

    case 'project.save': {
      const projectId = needProjectId(payload)
      return { project: await store.saveProject(root, projectId, payload.patch ?? payload) }
    }

    case 'project.delete': {
      const projectId = needProjectId(payload)
      return store.deleteProject(root, projectId)
    }

    case 'overview': {
      const projectId = needProjectId(payload)
      return store.overview(root, projectId)
    }

    case 'chapter.list': {
      const projectId = needProjectId(payload)
      return { chapters: await store.listChapters(root, projectId) }
    }

    case 'chapter.get': {
      const projectId = needProjectId(payload)
      return store.getChapter(root, projectId, payload.chapter)
    }

    case 'chapter.save': {
      const projectId = needProjectId(payload)
      if (typeof payload.text !== 'string') invalid('chapter.save 需要 text 字符串')
      // 硬拦：正文里出现元叙述、对偶否定这类「写出来就是错」的东西，不给存。
      // 只拦 blocking 一档；advisory 一律放行，让人自己决定改不改。
      // 想强行存（导旧稿、修标点）传 force: true。
      // `aiStyleBlock: false` 是「我就是要存，别拦」的总开关；它和 payload.force
      // 的区别是前者按作者习惯长期生效，后者是这一次。两者任一都放行。
      const styleBlocked = configLib.getRuntimeConfig().aiStyleBlock !== false
      if (styleBlocked && payload.force !== true && payload.lint !== false) {
        const blocking = lint.checkBlocking(payload.text, {
          whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : [],
        })
        if (blocking.length) {
          const first = blocking[0]
          throw new RpcError(
            `正文有 ${blocking.length} 处硬伤，先改掉再存（第 ${first.para + 1} 段「${first.label}」：${first.hint}）；确要强行保存传 force: true`,
            'style-blocking',
            { blocking, total: blocking.length },
          )
        }
      }
      // rev：调用方带了 expectRev 就走乐观锁，冲突时抛 conflict（不是 invalid——
      // 参数没错，是手里的稿子过期了，上层要区分这两件事）。
      // 停靠点：写盘**之前**问一次「现在允许写吗」。
      // 顺序必须是 gate → 写盘 → claim，反了的话写盘失败会留下一条假的交稿记录。
      let guard = { runId: null, guarded: false, status: 'none' }
      if (payload.runGuard !== false) {
        const dir = await store.projectDir(root, projectId)
        guard = await run.guardWrite(dir, { runId: payload.runId })
      }
      let meta
      try {
        meta = await store.saveChapter(root, projectId, payload.chapter, payload.text, payload.meta ?? {}, {
          expectRev: payload.expectRev,
          by: String(payload.by ?? ''),
        })
      } catch (error) {
        if (error?.code === 'conflict') {
          throw new RpcError(error.message, 'conflict', error.details ?? null)
        }
        throw error
      }
      // 记账：这一章算本轮交稿。只记真写成功的那次。
      if (guard.guarded && guard.runId && payload.runClaim !== false) {
        try {
          const dir = await store.projectDir(root, projectId)
          await run.claimChapter(dir, {
            runId: guard.runId,
            chapter: payload.chapter,
            words: meta?.words ?? 0,
            note: String(payload.by ?? ''),
          })
        } catch (error) {
          // 记账失败不推翻已经写成功的正文 —— 盘上是真实内容，不能因为账本问题回滚。
          // 但要说出来，否则「这章没进停靠点」会变成静默丢失的状态。
          guard.claimError = error?.message ?? String(error)
        }
      }
      return { chapter: payload.chapter, meta, run: guard }
    }

    case 'chapter.delete': {
      const projectId = needProjectId(payload)
      // 现在是扔进回收站，不是 fs.rm —— 返回里带 trash 名字，界面提示「可从回收站还原」。
      return store.deleteChapter(root, projectId, payload.chapter)
    }

    // ── 历史版本 / 回收站 / AI 味 ────────────────────────────
    case 'chapter.history': {
      const projectId = needProjectId(payload)
      return store.listChapterHistory(root, projectId, payload.chapter)
    }

    case 'chapter.version': {
      const projectId = needProjectId(payload)
      return store.readChapterVersion(root, projectId, payload.chapter, payload.name)
    }

    case 'chapter.restore': {
      const projectId = needProjectId(payload)
      return store.restoreChapterVersion(root, projectId, payload.chapter, payload.name)
    }

    case 'chapter.trash': {
      const projectId = needProjectId(payload)
      return store.listTrash(root, projectId)
    }

    case 'chapter.recover': {
      const projectId = needProjectId(payload)
      return store.recoverChapter(root, projectId, payload.trash)
    }

    case 'chapter.purge': {
      const projectId = needProjectId(payload)
      return store.purgeTrash(root, projectId, payload.trash)
    }

    case 'chapter.aistyle': {
      const projectId = needProjectId(payload)
      return store.scanChapterAiStyle(root, projectId, payload.chapter)
    }

    case 'chapter.move': {
      const projectId = needProjectId(payload)
      return store.moveChapter(root, projectId, payload.from, payload.to)
    }

    case 'chapter.insert': {
      const projectId = needProjectId(payload)
      return store.insertChapter(root, projectId, payload.at, {
        title: payload.title,
        intent: payload.intent,
      })
    }

    case 'aistyle.get': {
      const projectId = needProjectId(payload)
      return store.getAiLexicon(root, projectId)
    }

    case 'aistyle.save': {
      const projectId = needProjectId(payload)
      return store.saveAiLexicon(root, projectId, payload)
    }

    case 'search': {
      const projectId = needProjectId(payload)
      return store.searchProject(root, projectId, payload.q ?? payload.query, payload)
    }

    case 'ledger.get': {
      const projectId = needProjectId(payload)
      return { ledger: await store.getLedger(root, projectId) }
    }

    case 'ledger.audit': {
      const projectId = needProjectId(payload)
      return store.auditLedger(root, projectId)
    }

    // ── 状态版本（工作台轮询这个数字，变了就重取）──────────────
    case 'state.get': {
      const projectId = needProjectId(payload)
      return store.stateSnapshot(root, projectId)
    }

    case 'ledger.save': {
      const projectId = needProjectId(payload)
      return { ledger: await store.saveLedger(root, projectId, payload.ledger ?? {}) }
    }

    case 'ledger.upsert': {
      const projectId = needProjectId(payload)
      return store.upsertLedgerRow(root, projectId, payload.kind, payload.row ?? {})
    }

    case 'ledger.remove': {
      const projectId = needProjectId(payload)
      return store.removeLedgerRow(root, projectId, payload.kind, String(payload.id ?? ''))
    }

    case 'templates.list': {
      const projectId = needProjectId(payload)
      return store.listTemplates(root, projectId)
    }

    case 'template.save': {
      const projectId = needProjectId(payload)
      return store.saveTemplate(root, projectId, payload.template ?? payload)
    }

    case 'template.remove': {
      const projectId = needProjectId(payload)
      return store.removeTemplate(root, projectId, String(payload.id ?? ''))
    }

    case 'queue.list': {
      const projectId = needProjectId(payload)
      return store.listQueue(root, projectId)
    }

    case 'queue.add': {
      const projectId = needProjectId(payload)
      return store.addQueue(root, projectId, payload.item ?? payload)
    }

    case 'queue.update': {
      const projectId = needProjectId(payload)
      return store.updateQueue(root, projectId, String(payload.id ?? ''), payload.patch ?? {})
    }

    case 'queue.remove': {
      const projectId = needProjectId(payload)
      return store.removeQueue(root, projectId, String(payload.id ?? ''))
    }

    case 'review.action': {
      const projectId = needProjectId(payload)
      return { meta: await store.reviewAction(root, projectId, String(payload.action ?? ''), payload.chapter, payload) }
    }

    // ── 大纲 ────────────────────────────────────────────────
    case 'outline.get': {
      const projectId = needProjectId(payload)
      return { outline: await store.getOutline(root, projectId) }
    }

    case 'outline.save': {
      const projectId = needProjectId(payload)
      return { outline: await store.saveOutline(root, projectId, payload.outline ?? payload.patch ?? payload) }
    }

    case 'outline.generate': {
      const projectId = needProjectId(payload)
      return { outline: await store.generateOutline(root, projectId, payload) }
    }

    case 'outline.intent': {
      const projectId = needProjectId(payload)
      const outline = await store.getOutline(root, projectId)
      return { intent: store.outlineIntent(outline, payload.chapter), outline }
    }

    // ── 大纲取段（1000 章的书不该整本塞给模型）──────────────
    case 'outline.slice': {
      const projectId = needProjectId(payload)
      const outline = await store.getOutline(root, projectId)
      return outlineview.pickOutline(outline, {
        volume: payload.volume,
        from: payload.from,
        to: payload.to,
        toc: payload.toc === true,
        withBody: payload.withBody !== false,
        maxBytes: payload.maxBytes,
        brief: payload.brief === true,
      })
    }

    // ── 任务包（材料落盘，prompt 只给清单）────────────────────
    case 'taskpack.build': {
      const projectId = needProjectId(payload)
      return taskpack.buildTaskPack(root, projectId, {
        role: payload.role,
        chapter: payload.chapter,
        task: payload.task,
        extra: payload.extra,
        maxBytes: payload.maxBytes,
      })
    }

    case 'taskpack.list':
      return taskpack.listTaskPacks(root, needProjectId(payload), {
        role: payload.role,
        limit: payload.limit,
      })

    case 'taskpack.get': {
      const projectId = needProjectId(payload)
      const pack = await taskpack.getTaskPack(root, projectId, payload.pack)
      return { ...pack, promptSection: taskpack.packPromptSection(pack) }
    }

    // ── 停靠点（一轮连写必须停）───────────────────────────────
    case 'run.open': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.openRun(dir, payload)
      return { run: row, verdict: run.runVerdict(row) }
    }

    case 'run.claim': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.claimChapter(dir, payload)
      return { run: row, verdict: run.runVerdict(row) }
    }

    case 'run.review': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.reviewChapter(dir, payload)
      return { run: row, verdict: run.runVerdict(row) }
    }

    case 'run.close': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.closeRun(dir, payload)
      return { run: row, verdict: run.runVerdict(row) }
    }

    case 'run.current': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.currentRun(dir)
      return { run: row, verdict: run.runVerdict(row) }
    }

    case 'run.list': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return run.listRuns(dir, { status: payload.status, limit: payload.limit })
    }

    case 'run.get': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      const row = await run.getRun(dir, payload.runId ?? payload.id)
      return { run: row, verdict: run.runVerdict(row) }
    }

    // ── 世界地图 ────────────────────────────────────────────
    case 'map.get': {
      const projectId = needProjectId(payload)
      return worldmap.getMap(root, projectId)
    }

    case 'map.sync': {
      const projectId = needProjectId(payload)
      return worldmap.syncMap(root, projectId)
    }

    case 'map.save': {
      const projectId = needProjectId(payload)
      return worldmap.saveMap(root, projectId, payload)
    }

    case 'map.explain': {
      const projectId = needProjectId(payload)
      const from = String(payload.from ?? '').trim()
      const to = String(payload.to ?? '').trim()
      if (!from || !to) invalid('要解释哪两个地点之间的连线（from / to）')
      return worldmap.explainEdge(root, projectId, from, to)
    }

    // ── 检查更新 ────────────────────────────────────────────
    case 'update.check': {
      return update.checkLatest({
        installed: String(payload.installed ?? VERSION),
        force: payload.force === true,
        timeoutMs: payload.timeoutMs,
      })
    }

    // ── 冷读 ────────────────────────────────────────────────
    case 'coldread.prepare': {
      const projectId = needProjectId(payload)
      return coldread.prepareColdRead(root, projectId, payload)
    }

    case 'coldread.list': {
      const projectId = needProjectId(payload)
      return coldread.listColdReads(root, projectId)
    }

    // ── 意见池 ──────────────────────────────────────────────
    case 'opinion.list': {
      const projectId = needProjectId(payload)
      return opinions.listOpinions(root, projectId, payload)
    }

    case 'opinion.save': {
      const projectId = needProjectId(payload)
      const result = await opinions.saveOpinion(root, projectId, payload.opinion ?? payload)
      return { ...result, counts: (await opinions.listOpinions(root, projectId)).counts }
    }

    case 'opinion.bulk': {
      const projectId = needProjectId(payload)
      const result = await opinions.bulkAdd(root, projectId, payload)
      return { ...result, counts: (await opinions.listOpinions(root, projectId)).counts }
    }

    case 'opinion.decide': {
      const projectId = needProjectId(payload)
      return opinions.decideOpinion(root, projectId, String(payload.id ?? ''), {
        status: payload.status ?? payload.decision,
        resolution: payload.resolution,
      })
    }

    case 'opinion.remove': {
      const projectId = needProjectId(payload)
      return opinions.removeOpinion(root, projectId, String(payload.id ?? ''))
    }

    case 'opinion.collect': {
      const projectId = needProjectId(payload)
      return opinions.collectOpinions(root, projectId, payload)
    }

    // ── 对齐简报 ────────────────────────────────────────────
    case 'briefing.get': {
      const projectId = needProjectId(payload)
      return briefing.buildBriefing(root, projectId, payload)
    }

    // ── AI 味评分（0–100）────────────────────────────────────
    //
    // 和 lint.check 的区别：lint 给的是「命中了几条」，这个给的是「这段有多像 AI 写的」。
    // 命中数没法比较（长章天然命中多），分数能——所以它能当闸门用。
    case 'aiscore.check': {
      const projectId = needProjectId(payload)
      let text = String(payload.text ?? '')
      let chapter = Number(payload.chapter) || 0
      if (!text.trim() && chapter) {
        const ch = await store.getChapter(root, projectId, chapter)
        text = String(ch.text ?? '')
      }
      if (!text.trim()) invalid('要算分得有正文：给 text，或者给 chapter')
      // 项目自己的词表只作参考：scoreText 用的是内置 28 条规则，
      // 自定义词条（作者加的「微微」「缓缓」这类）在这里单独数一遍，一起交回去。
      const lexicon = await store.getAiLexicon(root, projectId)
      const custom = Array.isArray(lexicon.custom) ? lexicon.custom : []
      const customHits = []
      for (const row of custom) {
        const phrase = String(row?.phrase ?? '').trim()
        if (!phrase) continue
        let count = 0
        let from = 0
        for (;;) {
          const at = text.indexOf(phrase, from)
          if (at < 0) break
          count += 1
          from = at + phrase.length
        }
        if (count) customHits.push({ phrase, hint: row?.hint ?? '', count })
      }
      const result = aiscore.scoreText(text, {
        whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : undefined,
      })
      return {
        ...result,
        chapter,
        custom: customHits,
        lexicon: { total: lexicon.items.length, custom: custom.length, disabled: lexicon.disabled.length },
      }
    }

    // ── 内容保真：改写有没有把原稿弄丢 ──────────────────────
    case 'fidelity.check': {
      const projectId = needProjectId(payload)
      const chapter = Number(payload.chapter) || 0
      const after = String(payload.after ?? '')
      if (!after.trim()) invalid('要校验得给 after（改完的正文）')
      let before = String(payload.before ?? '')
      if (!before.trim() && chapter) {
        const ch = await store.getChapter(root, projectId, chapter)
        before = String(ch.text ?? '')
      }
      if (!before.trim()) invalid('要校验得给 before，或者给 chapter（拿现稿当原稿）')
      const ledger = await store.getLedger(root, projectId)
      const names = (ledger?.characters?.rows ?? [])
        .map((row) => String(row?.name ?? row?.title ?? '').trim())
        .filter(Boolean)
      const result = fidelity.checkFidelity(before, after, {
        names,
        ratio: payload.ratio === undefined ? undefined : Number(payload.ratio),
      })
      return { ...result, chapter, names }
    }

    // ── 段落地址索引：界面靠它显示「这条提案指哪一段」──
    case 'anchor.index': {
      const projectId = needProjectId(payload)
      const chapter = Number(payload.chapter) || 0
      if (!chapter) invalid('要建索引得给 chapter')
      const ch = await store.getChapter(root, projectId, chapter)
      const text = String(ch.text ?? '')
      const index = anchors.buildIndex(chapter, text)
      return {
        ...index,
        chapterHash: anchors.chapterHash(text),
        words: ch.words ?? 0,
        total: index.paras.length,
      }
    }

    // ── 成本：读 DSH 会话日志估钱 ───────────────────────────
    case 'usage.scan': {
      const projectId = String(payload.projectId ?? '').trim()
      let dataDir = ''
      let cwd = String(payload.cwd ?? '').trim()
      if (projectId) {
        dataDir = await store.projectDir(root, projectId)
      }
      if (!cwd && dataDir) cwd = dataDir
      return usage.scanProjectSessions({ dataDir, cwd, limit: Number(payload.limit) || 0 })
    }
    case 'usage.budget': {
      return usage.estimateBudget({
        chapters: Number(payload.chapters) || 0,
        chapterWords: Number(payload.chapterWords) || 0,
        model: String(payload.model ?? ''),
        contextFactor: payload.contextFactor === undefined ? undefined : Number(payload.contextFactor),
      })
    }
    case 'usage.models': {
      return { prices: usage.DEFAULT_PRICES, charsPerToken: usage.CHARS_PER_TOKEN, models: Object.keys(usage.DEFAULT_PRICES) }
    }

    // 派单能力自检：宿主支不支持 spawn、哪个岗位派下去它有什么工具。
    // 界面拿这个决定「派给某某」按钮是亮的还是灰的，别让作者点了才报错。
    case 'subagent.status': {
      return spawn.spawnCatalog(ctx, options.parent)
    }

    // 冷读回执：交回来的是一段结论 + 一堆「第几回哪里不好」。
    // 顺手把 items 灌进意见池，作者不用再从回执里手工抄一遍。
    case 'coldread.submit': {
      const projectId = needProjectId(payload)
      const score = Number(payload.score)
      const verdict = String(payload.verdict ?? '').trim()
      const items = Array.isArray(payload.items) ? payload.items : []
      const pkg = String(payload.file ?? payload.fileName ?? '').trim()
      let pooled = null
      if (items.length) {
        pooled = await opinions.bulkAdd(root, projectId, {
          source: 'coldread',
          role: 'nightwrite-reader-proxy',
          createdBy: 'coldread',
          items,
        })
      }
      // 分数与结论本身也留一条：下次想知道「三个月前冷读给几分」有据可查
      const summary = await opinions.saveOpinion(root, projectId, {
        chapter: Number(items[0]?.chapter ?? payload.chapter ?? 0) || 0,
        para: 0,
        source: 'coldread',
        role: 'nightwrite-reader-proxy',
        kind: 'note',
        status: 'open',
        severity: 'note',
        text: `冷读结论：${Number.isFinite(score) ? `${score} 分` : '未给分'}${verdict ? ` · ${verdict}` : ''}${pkg ? `（${pkg}）` : ''}`,
        createdBy: 'coldread',
      }).catch(() => null)
      return {
        score: Number.isFinite(score) ? score : null,
        verdict,
        pooled: pooled ? { added: pooled.added, skipped: pooled.skipped.length } : { added: 0, skipped: 0 },
        summary: summary?.item ?? null,
        counts: (await opinions.listOpinions(root, projectId)).counts,
      }
    }

    // ── 提案 ────────────────────────────────────────────────
    case 'proposal.list': {
      const projectId = needProjectId(payload)
      return store.listProposals(root, projectId)
    }

    case 'proposal.save': {
      const projectId = needProjectId(payload)
      return store.saveProposal(root, projectId, payload.proposal ?? payload)
    }

    case 'proposal.decide': {
      const projectId = needProjectId(payload)
      const action = String(payload.action ?? '').trim()
      if (action !== 'accept' && action !== 'reject') invalid('proposal.decide 的 action 只能是 accept / reject')
      return store.decideProposal(root, projectId, String(payload.id ?? ''), action, payload)
    }

    case 'proposal.preview': {
      const projectId = needProjectId(payload)
      return store.previewProposal(root, projectId, String(payload.id ?? ''))
    }

    case 'proposal.remove': {
      const projectId = needProjectId(payload)
      return store.removeProposal(root, projectId, String(payload.id ?? ''))
    }

    // ── 问题 ────────────────────────────────────────────────
    case 'problem.list': {
      const projectId = needProjectId(payload)
      return store.listProblems(root, projectId)
    }

    case 'problem.save': {
      const projectId = needProjectId(payload)
      return store.saveProblem(root, projectId, payload.problem ?? payload)
    }

    case 'problem.resolve': {
      const projectId = needProjectId(payload)
      return store.resolveProblem(root, projectId, String(payload.id ?? ''), String(payload.status ?? 'fixed'))
    }

    case 'problem.remove': {
      const projectId = needProjectId(payload)
      return store.removeProblem(root, projectId, String(payload.id ?? ''))
    }

    // ── 岗位 / 派单 / 回执 ───────────────────────────────────
    case 'role.list':
      return { items: dispatch.roleCatalog() }

    case 'dispatch.list': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.listDispatches(dir, {
        status: String(payload.status ?? ''),
        role: String(payload.role ?? ''),
        limit: Number(payload.limit ?? 0) || 0,
      })
    }

    case 'dispatch.get': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.getDispatch(dir, String(payload.id ?? ''))
    }

    case 'dispatch.issue': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      // pack 默认开：材料落盘、prompt 只给清单，是这套派单能撑住长书的唯一原因。
      // 想退回「材料直接写进 prompt」的旧行为，传 pack:false。
      let materials = payload.materials
      let packInfo = null
      if (payload.pack !== false) {
        const built = await taskpack.buildTaskPack(root, projectId, {
          role: payload.role,
          chapter: payload.chapter,
          task: payload.task,
          extra: payload.extra,
        })
        packInfo = { pack: built.pack, dir: built.dir }
        const section = taskpack.packPromptSection(built)
        materials = materials ? `${materials}\n\n${section}` : section
      }
      const ticket = await dispatch.issueDispatch(dir, {
        role: payload.role,
        task: payload.task,
        materials,
        pack: packInfo?.pack ?? '',
        packDir: packInfo?.dir ?? '',
        chapter: payload.chapter,
        runId: payload.runId,
        stageId: payload.stageId,
      })
      return packInfo ? { ...ticket, pack: packInfo.pack } : ticket
    }

    case 'dispatch.send': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return sendDispatch(dir, payload, ctx, options)
    }

    case 'dispatch.revoke': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.revokeDispatch(dir, String(payload.id ?? ''))
    }

    case 'dispatch.sweep': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.sweepExpired(dir)
    }

    case 'report.list': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.listReports(dir, {
        role: String(payload.role ?? ''),
        limit: Number(payload.limit ?? 0) || 0,
      })
    }

    case 'report.submit': {
      const projectId = needProjectId(payload)
      const dir = await store.projectDir(root, projectId)
      return dispatch.submitReport(dir, String(payload.id ?? ''), {
        text: payload.text,
        verdict: payload.verdict,
        submittedBy: payload.submittedBy,
      })
    }

    // ── 文风校验 ────────────────────────────────────────────
    case 'lint.rules':
      return { items: lint.listRules(), total: lint.RULE_IDS.length, groups: lint.listGroups() }

    case 'lint.degenerate': {
      // 「这章是不是模型跑偏了」跟「这章文笔好不好」是两个问题。
      // 前者要的是快判断（重跑还是继续），所以单独开一个只跑退化组的 op，
      // 界面拿到 hits 就能直接给一个结论，不必让作者在 28 条里找。
      let body = payload.text !== undefined ? String(payload.text ?? '') : ''
      let chapter = Number(payload.chapter ?? 0) || 0
      if (!body && payload.projectId && chapter) {
        const projectId = needProjectId(payload)
        const got = await store.getChapter(root, projectId, chapter)
        body = String(got?.text ?? '')
        chapter = Number(got?.chapter ?? chapter)
      }
      const result = lint.checkDegenerate(body, {
        whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : [],
      })
      return {
        ...result,
        chapter,
        verdict: result.total === 0
          ? '没看出模型跑偏的迹象，可以继续写下一章。'
          : `有 ${result.total} 处像是模型跑偏了（复读/截断/占位语）。这类问题逐句修不好，直接重跑这一章更省事。`,
      }
    }

    case 'text.normalize': {
      // 标点归一化：默认只报告不改（省略号用「……」还是「...」是风格选择，
      // 不替作者决定），apply:true 才返回改后的全文。
      let body = payload.text !== undefined ? String(payload.text ?? '') : ''
      if (!body && payload.projectId && payload.chapter) {
        const projectId = needProjectId(payload)
        const got = await store.getChapter(root, projectId, Number(payload.chapter))
        body = String(got?.text ?? '')
      }
      const result = textnorm.normalizeText(body, {
        apply: payload.apply === true,
        style: payload.style,
        whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : [],
        only: Array.isArray(payload.only) ? payload.only : undefined,
      })
      return { ...result, rules: textnorm.listNormalizeRules() }
    }

    case 'outline.copy': {
      // 细纲照搬检测：正文与同章细纲连续重合超过阈值就报。
      const projectId = needProjectId(payload)
      const chapter = Number(payload.chapter ?? 0) || 0
      if (!chapter) invalid('要检查第几章（chapter）')
      const got = await store.getChapter(root, projectId, chapter)
      const body = payload.text !== undefined ? String(payload.text ?? '') : String(got?.text ?? '')
      const outline = await store.getOutline(root, projectId)
      const vol = (outline?.volumes ?? []).find((v) => (v.chapters ?? []).some((c) => Number(c.chapter) === chapter))
      const node = vol ? (vol.chapters ?? []).find((c) => Number(c.chapter) === chapter) : null
      const parts = node ? [node.title, node.summary, node.hook].filter(Boolean) : []
      const result = outlinecopy.findOutlineCopy(body, parts, { minChars: payload.minChars })
      return { chapter, ...result, verdict: outlinecopy.judge(result, { warnChars: payload.warnChars }) }
    }

    case 'wordcount.check': {
      // 字数口径单点：界面「实时字数」和章节清单都走这里，避免两处各算一套。
      const text = payload.text !== undefined
        ? String(payload.text ?? '')
        : ''
      if (!text && payload.projectId && payload.chapter) {
        const projectId = needProjectId(payload)
        const got = await store.getChapter(root, projectId, Number(payload.chapter))
        return { ...wordcount.measure(String(got?.text ?? '')), chapter: Number(got?.chapter ?? 0) }
      }
      return wordcount.measure(text)
    }

    case 'lint.check': {
      // 两种入参：直接给 text，或给 projectId+chapter 读盘上的正文。
      const text = payload.text !== undefined
        ? String(payload.text ?? '')
        : ''
      let body = text
      let chapter = Number(payload.chapter ?? 0) || 0
      if (!body && payload.projectId && chapter) {
        const projectId = needProjectId(payload)
        const got = await store.getChapter(root, projectId, chapter)
        body = String(got?.text ?? '')
        chapter = Number(got?.chapter ?? chapter)
      }
      // 这本书量过就用它自己的阈值；没量过就走全局。
      // 手动传 thresholds 优先级最高，方便界面「试试别的阈值会怎样」。
      let thresholds = payload.thresholds && typeof payload.thresholds === 'object' ? payload.thresholds : null
      if (!thresholds && payload.projectId && payload.useCalibration !== false) {
        try {
          const own = await store.getCalibration(root, needProjectId(payload))
          if (own?.count) thresholds = own.thresholds
        } catch {
          // 校准文件坏了不该让校验整体失败——退回全局阈值就是它能做的最好事
        }
      }
      const result = lint.checkText(body, {
        whitelist: Array.isArray(payload.whitelist) ? payload.whitelist : [],
        only: Array.isArray(payload.only) ? payload.only : undefined,
        skip: Array.isArray(payload.skip) ? payload.skip : [],
        thresholds: thresholds ?? undefined,
      })
      return {
        ...result,
        chapter,
        summary: lint.summarize(result.hits),
        calibrated: Boolean(thresholds),
      }
    }

    // ── 每本书自己的阈值（阶段 C）──────────────────────────
    case 'lint.calibration':
      return store.getCalibration(root, needProjectId(payload))

    case 'lint.calibrate': {
      const projectId = needProjectId(payload)
      return store.calibrateProject(root, projectId, { limit: payload.limit })
    }

    case 'lint.calibrate.save':
      return store.saveCalibration(root, needProjectId(payload), {
        thresholds: payload.thresholds,
      })

    case 'feedback.get':
      return store.getFeedback(root, needProjectId(payload))

    case 'feedback.learn':
      return store.learnFeedback(root, needProjectId(payload))

    case 'corpus.list':
      return corpus.listBooks(root)

    case 'corpus.add':
      return corpus.addBook(root, payload)

    case 'corpus.remove':
      return corpus.removeBook(root, String(payload?.id ?? ''))

    case 'corpus.thresholds':
      return corpus.deriveThresholds(root, { minBooks: Number(payload?.minBooks ?? 3) })

    case 'corpus.apply': {
      const projectId = needProjectId(payload)
      const applied = await corpus.applyToCalibration(root, projectId, {
        only: Array.isArray(payload?.only) ? payload.only : [],
        minBooks: Number(payload?.minBooks ?? 3),
      })
      if (!applied.count) return applied
      const saved = await store.saveCalibration(root, projectId, { thresholds: applied.thresholds })
      return { ...applied, saved }
    }

    // ── 拆书 / 导入 / 扫榜 ─────────────────────────────────
    case 'analyze.list':
      return analyze.listAnalyses(root, needProjectId(payload))
    case 'analyze.get':
      return analyze.getAnalysis(root, needProjectId(payload), payload.id)
    case 'analyze.start': {
      const projectId = needProjectId(payload)
      const data = await analyze.startAnalyze(root, projectId, payload)
      return {
        id: data.id,
        title: data.title,
        chapters: data.chapters,
        totalWords: data.totalWords,
        avgEmotion: data.avgEmotion,
        avgDialogue: data.avgDialogue,
        hookCount: data.hookCount,
        noise: data.noise,
        opening: data.opening,
        rows: data.rows,
      }
    }
    case 'analyze.remove':
      return analyze.removeAnalysis(root, needProjectId(payload), payload.id)
    // 预览不落盘，所以不做 needProjectId —— 选文件的那一刻还没选作品也可能要看一眼。
    case 'import.preview':
      return importer.previewImport(payload)
    case 'import.dir':
      return importer.listDirFiles(payload.dir)
    case 'import.run': {
      const projectId = needProjectId(payload)
      const result = await importer.runImport(root, projectId, payload)
      // 大纲是「机械铺卷」，不动已有的 brief 摘要 —— 摘要可能已经是 AI 写好的。
      if (payload.writeOutline !== false && Array.isArray(result.outlinePatch?.volumes)) {
        const prev = await store.getOutline(root, projectId)
        await store.saveOutline(root, projectId, {
          brief: prev.brief,
          volumes: prev.volumes.length ? prev.volumes : result.outlinePatch.volumes,
        })
      }
      return result
    }
    case 'scan.list':
      return scan.listScans(root, needProjectId(payload))
    case 'scan.get':
      return scan.getScan(root, needProjectId(payload), payload.id)
    case 'scan.save':
      return scan.saveScan(root, needProjectId(payload), payload)
    case 'scan.fetch':
      return scan.fetchRanking(payload)

    default:
      return invalid(`未实现：${op}`)
  }
}

// ── HTTP ─────────────────────────────────────────────────────

function sendJson(res, status, value) {
  const text = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  })
  res.end(text)
}

function sendError(res, error) {
  const code = error instanceof RpcError || error instanceof store.StoreError
    ? error.code ?? 'invalid'
    : 'internal'
  const message = error instanceof Error ? error.message : String(error)
  const details = error instanceof RpcError ? error.details : null
  const body = { ok: false, error: { code, message } }
  // details 带结构化信息（比如硬拦命中列表），界面靠它把每一处问题画在正文上。
  if (details !== null && details !== undefined) body.error.details = details
  sendJson(res, code === 'missing' ? 404 : 400, body)
}

class BodyTooLarge extends Error {}

/** 把请求体剩下的字节读完并丢掉（不解析），用于回 413 之前把连接腾干净 */
async function drain(req) {
  try {
    for await (const chunk of req) void chunk // eslint-disable-line no-unused-vars
  } catch {
    /* 客户端提前断开也无所谓 */
  }
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBody()) throw new BodyTooLarge(`请求体超过 ${mbText(maxBody())}`)
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text.trim()) return {}
  const parsed = JSON.parse(text)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  throw invalid('请求体必须是 JSON 对象')
}

function loopbackOnly(req) {
  const host = String(req?.headers?.host ?? '').toLowerCase()
  const name = host.replace(/:\d+$/, '')
  if (!name) return false
  return name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name === '::1'
}

export function guard(req, connection) {
  if (connection && typeof connection.requestRejection === 'function') {
    try {
      const rejection = connection.requestRejection({ headers: req?.headers ?? {} })
      if (rejection === undefined || rejection === null || rejection === false) return undefined
      // 只认真正的错误状态码：400–599 的整数。
      // true / '' / 0 / NaN 这类「真值但不是状态码」一律按 403 处理——
      // 之前 Number(true) === 1 会被当成状态码写进 writeHead，直接抛 RangeError。
      const status = typeof rejection === 'number' ? rejection : Number(rejection)
      if (Number.isInteger(status) && status >= 400 && status <= 599) return status
      return 403
    } catch {
      /* 落到回环兜底，不放行任意来源 */
    }
  }
  return loopbackOnly(req) ? undefined : 403
}

export function createHandler(ctx = {}, options = {}) {
  return async function handler(req, res) {
    const connection = options.connection ?? ctx?.get?.('connection')
    const rejection = guard(req, connection)
    if (rejection !== undefined) {
      res.writeHead(rejection, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' })
      res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname.replace(/\/+$/, '').endsWith('/ping')) {
      try {
        sendJson(res, 200, { ok: true, value: await handleRpc({ op: 'ping' }, ctx, options) })
      } catch (error) {
        sendError(res, error)
      }
      return
    }
    // GET /nightwrite/api/export?projectId=... 直接回一个 zip 字节流。
    // 不走 POST + base64：几十 MB 的 base64 塞进 JSON 再让浏览器二次解码，
    // 峰值内存翻三倍，而且 <a download> 拿 blob 更方便。
    if (req.method === 'GET' && url.pathname.replace(/\/+$/, '').endsWith('/book')) {
      // GET /nightwrite/api/book?projectId=...&format=epub 直接回成书字节。
      // 与 /export 的区别：/export 是「把整个项目目录打包带走」（备份/迁移），
      // /book 是「把正文排成一本书」（给人读）。两者不共用一条路由，
      // 因为前者要目录结构，后者要的是干净的章节顺序与元信息。
      const projectId = String(url.searchParams.get('projectId') ?? '').trim()
      const format = String(url.searchParams.get('format') ?? 'txt').trim().toLowerCase()
      // 默认跳过被否掉的章：作者判它不算数，就不该出现在交出去的书里。
      // 想连否掉的草稿一起带走，传 skipRejected=0。
      const skipRejected = String(url.searchParams.get('skipRejected') ?? '1') !== '0'
      if (!projectId) {
        sendJson(res, 400, { ok: false, error: { code: 'invalid', message: '缺少 projectId' } })
        return
      }
      try {
        const root = options.root ?? store.defaultRoot()
        const { meta } = await store.getProject(root, projectId)
        const rows = await store.listChapters(root, projectId)
        const chapters = []
        for (const row of rows) {
          // 导出要全文：listChapters 只给元信息（字数走缓存），正文得逐章取。
          // 一千章会有 1000 次读盘，但这条路是一次性动作，且比「读整个目录再过滤」更省内存。
          if (skipRejected && String(row.status ?? '') === 'rejected') continue
          try {
            const got = await store.getChapter(root, projectId, row.chapter)
            chapters.push({ chapter: row.chapter, title: row.title, status: row.status, text: got?.text ?? '' })
          } catch {
            // 单章读不出来不该让整本导不出——跳过并在头里记数
          }
        }
        const book = ebook.assembleBook({ meta, chapters })
        const rendered = ebook.renderBook(book, format)
        res.writeHead(200, {
          'content-type': rendered.mime,
          'content-length': String(rendered.buffer.length),
          'content-disposition': `attachment; filename="${encodeURIComponent(rendered.filename)}"; filename*=UTF-8''${encodeURIComponent(rendered.filename)}`,
          'cache-control': 'no-store',
          'x-nightwrite-chapters': String(book.chapters.length),
          'x-nightwrite-words': String(book.words),
          'x-nightwrite-skipped': String(rows.length - chapters.length),
          'x-nightwrite-format': format,
        })
        res.end(rendered.buffer)
      } catch (error) {
        sendError(res, error)
      }
      return
    }
    if (req.method === 'GET' && url.pathname.replace(/\/+$/, '').endsWith('/export')) {
      const projectId = String(url.searchParams.get('projectId') ?? '').trim()
      if (!projectId) {
        sendJson(res, 400, { ok: false, error: { code: 'invalid', message: '缺少 projectId' } })
        return
      }
      try {
        const { dir, files, count } = await store.collectProjectFiles(options.root ?? store.defaultRoot(), projectId)
        const buffer = buildZip(files, { prefix: projectId })
        const name = `${projectId}-${new Date().toISOString().slice(0, 10)}.zip`
        res.writeHead(200, {
          'content-type': 'application/zip',
          'content-length': String(buffer.length),
          'content-disposition': `attachment; filename="${encodeURIComponent(name)}"`,
          'cache-control': 'no-store',
          'x-nightwrite-files': String(count),
          'x-nightwrite-dir': encodeURIComponent(dir),
        })
        res.end(buffer)
      } catch (error) {
        sendError(res, error)
      }
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: { code: 'invalid', message: `只支持 POST ${ROUTE}（GET /ping 与 /export 除外）` } })
      return
    }
    const contentType = String(req.headers?.['content-type'] ?? '').toLowerCase()
    if (!contentType.startsWith('application/json')) {
      sendJson(res, 415, { ok: false, error: { code: 'invalid', message: 'content-type 必须是 application/json' } })
      return
    }
    // 先看 Content-Length：声明就超了，把剩下的字节读干净再回 413。
    // 不能直接 req.destroy()——客户端还有几 MB 在上传，服务端一销毁 socket，
    // 客户端拿到的是 ECONNRESET 而不是那个 413，等于错误码丢了。
    const declared = Number(req.headers?.['content-length'] ?? 0)
    if (Number.isFinite(declared) && declared > maxBody()) {
      await drain(req)
      res.setHeader('connection', 'close')
      sendJson(res, 413, { ok: false, error: { code: 'invalid', message: `请求体超过 ${mbText(maxBody())}` } })
      return
    }
    try {
      const body = await readBody(req)
      const value = await handleRpc(body, ctx, options)
      sendJson(res, 200, { ok: true, value })
    } catch (error) {
      if (error instanceof BodyTooLarge) {
        await drain(req)
        res.setHeader('connection', 'close')
        sendJson(res, 413, { ok: false, error: { code: 'invalid', message: error.message } })
        return
      }
      sendError(res, error)
    }
  }
}

function safeSerialize(value) {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (char) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  }[char]))
}

/** 把 window.__NIGHTWRITE_BOOT__ 插到 </head> 前（幂等） */
export function injectBoot(html, options = {}) {
  const source = String(html ?? '')
  if (source.includes('window.__NIGHTWRITE_BOOT__')) return source
  const boot = { apiUrl: String(options.apiUrl ?? ROUTE), name, version: VERSION }
  const tag = `<script>window.__NIGHTWRITE_BOOT__=${safeSerialize(boot)}</script>`
  if (/<\/head\s*>/i.test(source)) return source.replace(/<\/head\s*>/i, `${tag}</head>`)
  return `${tag}${source}`
}

export function mountRoute(ctx) {
  if (!ctx || typeof ctx.inject !== 'function') return
  ctx.inject(['webServer'], (c) => {
    const webServer = c?.webServer
    if (!webServer || typeof webServer.register !== 'function') return
    const connection = c.get?.('connection')
    const root = store.defaultRoot()
    const disposers = []

    let apiUrl = ROUTE
    try {
      if (!apiUrl) {
        const origin = String(webServer.getOrigin?.() ?? '')
        const authed = origin ? connection?.authenticatedUrl?.(origin + ROUTE) : ''
        if (authed) apiUrl = String(authed)
      }
    } catch {
      apiUrl = ROUTE
    }

    const disposeApi = webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: createHandler(ctx, { connection, webServer, root }),
    })
    if (typeof disposeApi === 'function') disposers.push(disposeApi)

    if (typeof webServer.tapIndex === 'function') {
      const disposeTap = webServer.tapIndex((html) => injectBoot(html, { apiUrl }))
      if (typeof disposeTap === 'function') disposers.push(disposeTap)
    }

    const effect = c.effect ?? ctx.effect
    if (typeof effect === 'function') {
      effect(() => () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            /* 已清理 */
          }
        }
      }, 'nightwrite: route')
    }
  })
}

// ── agent 工具 ───────────────────────────────────────────────

const TOOL_DESCRIPTION = [
  '长夜小说工作台的数据入口：读写同一份章节 / 大纲 / 账本 / 队列 / 提案 / 问题单，和界面完全一致。',
  `可用 op：${RPC_OPS.join(' / ')}。`,
  '',
  '四个阶段各有一个入口：',
  '· 出方案：outline.get 看当前骨架；outline.save 整份写回（brief + volumes，每章 title/summary/hook）；',
  '  outline.generate 按 brief 的 volumes × chaptersPerVolume 机械铺出骨架位置（不会替你编故事）；',
  '  outline.intent 取某一回该写成什么（意图 + 钩子），下笔前先调它。',
  '· 写正文：queue.add 排一章；chapter.get 取上一章尾巴续上；chapter.save 写回（纯文本，首行「第X回 标题」）。',
  '· 提改动：proposal.save 提 before/after（before 必须是正文里的逐字原文，对不上会被整条拒掉），',
  '  先 proposal.preview 看每条 before 在正文里出现几次（>1 说明会改错位置），再等人在验收台拍板；',
  '  不要自己直接改人家已采纳的稿子。',
  '· 记毛病：problem.save 记一条（type: ai-style / logic / style / other），problem.list 看未修清单；',
  '  chapter.aistyle 可以扫某章正文里的 AI 套话，命中会带段号与引文。',
  '',
  '其它：overview 取待验收 / 欠账 / 建议；ledger.upsert 记人物、伏笔、术语；',
  'search 跨章正文 + 账本 + 大纲做全文搜索（Ctrl+K 用的就是它）。',
  '',
  '派人干活（11 个岗位，每人一份手册在 agents/<id>.md）：',
  '· role.list 看有哪些岗位、各自负责什么、放行条件是什么；',
  '· dispatch.issue 开一张派单票（role + task 必填，可带 chapter / materials）；',
  '  dispatch.send 把任务书投递到对话，对话里的模型会自己读手册；',
  '  dispatch.list 看票的状态（issued / claimed / submitted / expired / revoked）；',
  '· report.submit 交回执（### 结论 / 依据 / 要别人做的事 / 风险 四段），report.list 看历史回执；',
  '  只有总编（nightwrite-coordinator）有派单权，其余岗位需要配合时把需求写进回执。',
  '',
  '文风校验（比作者自己的词表更硬的一层）：',
  '· lint.rules 看规则表（blocking 硬拦 / advisory 提示，各带 review 归类）；',
  '· lint.check 校验一段正文（给 text）或某一章（给 projectId + chapter），',
  '  返回逐条命中：段号 para、段内字位 offset、引文 quote，以及按规则聚合的 summary。',
  '  blocking 项必须改掉再保存：元叙述泄漏、对偶否定、破折号滥用、连续否定、电报体、总结式收尾。',
  '',
  '安全网（这几条是给「改错了怎么办」准备的）：',
  '· chapter.history 看某章历史版本（每次覆盖前自动留底，保留最近 20 版）；',
  '· chapter.restore 回滚到某一版（回滚前当前稿也会留底，可再滚回来）；',
  '· chapter.trash 看回收站，chapter.recover 还原，chapter.purge 彻底清空；',
  '  chapter.delete 现在只是移到回收站，不会真删。',
  '',
  '外部意见（作者最缺的是「陌生人怎么看」，不是「自己觉得怎么样」）：',
  '· coldread.prepare 把指定范围正文汇成一份 txt（scope: book / chapter / range），',
  '  返回文件路径 + 一段给独立审稿人的提示词；让一个没读过设定的人一次读完整本，',
  '  它才有资格说「第 12 回我想跳过」。coldread.list 看已经生成过哪些包。',
  '· coldread.submit 把回执交回来（score + verdict + items[]），items 会自动进意见池；',
  '· opinion.list 看意见池（来源 coldread / reader / consistency / lint / author，状态 open / adopted / dismissed）；',
  '  opinion.decide 记下采纳或不采纳与理由；opinion.collect 把问题单与 AI 味命中拉进来，',
  '  opinion.bulk 一次灌一批。意见池只汇总不仲裁——改不改是作者的决定。',
  '',
  '开新对话时先要一份对齐简报：briefing.get 返回现在几回 / 约多少字 / 谁在场 /',
  '欠了什么（没验收的章、过期的伏笔、没处理的提案）/ 最近五回 / 下一步该干嘛。',
  '别从第一章开始重读，也别凭印象猜进度。',
].join('\n')

export function createTool(root, pluginCtx = null) {
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: {
      op: { type: 'string', required: true, description: `操作名，取值：${RPC_OPS.join(', ')}` },
      payload: { type: 'object', description: '操作参数（projectId 必填，除 project.list / project.create / ping）' },
    },
    async execute(args = {}, exec = undefined) {
      // exec.agent 是「当前这个活着的父代理」。派子代理必须拿到它：
      // 宿主 startActivation 会校验 parent 就是 agents 注册表里那个实例。
      const value = await handleRpc(
        { op: args.op, payload: args.payload ?? {} },
        pluginCtx ?? {},
        { root, parent: exec?.agent },
      )
      return value
    },
  }
}

const DISPATCH_TOOL_DESCRIPTION = [
  '给长夜的某个岗位派活：开一张票、把任务书投递到当前对话，然后那个岗位的模型会自己读手册干活。',
  '当用户说「派给架构师」「让审校查一下这一章」「叫读者代理看看」「开一轮审校」时用这个工具。',
  '',
  'role 取下列之一（带中文名，方便对上用户说法）：',
  ...dispatch.roleCatalog().map((row) => `· ${row.id}（${row.label}）—— ${row.duty}；放行条件：${row.gate}`),
  '',
  '参数：projectId 必填；task 写清「要它做什么」，不要写「你是某某」这种角色描述（手册里已经有了）；',
  'chapter 填章号（做某一章的事就填）；materials 可以贴正文片段或账本条目。',
  '',
  '第一次用建议 dryRun: true——只把任务书文本拿回来，看清楚再真发。',
  '返回里带 sessionId 时说明已经进了某个对话；send:false 时不投递，只开票留档。',
].join('\n')

export function createDispatchTool(root, pluginCtx = null) {
  return {
    name: 'nightwrite_dispatch',
    description: DISPATCH_TOOL_DESCRIPTION,
    parameters: {
      projectId: { type: 'string', required: true, description: '作品 id（project.list 可取）' },
      role: { type: 'string', required: true, description: `岗位 id，取值：${dispatch.ROLE_IDS.join(', ')}` },
      task: { type: 'string', required: true, description: '要它做什么（一句话到一段话，写清交付物）' },
      chapter: { type: 'number', description: '章号，做某一章的事时填' },
      materials: { type: 'string', description: '附带给它的材料：正文片段、账本条目、审校意见等' },
      extra: { type: 'object', description: '任务包额外材料（键值对，落盘到 pack 目录）' },
      pack: { type: 'boolean', description: 'false = 不落材料包，材料直接写进任务书（不推荐，长书会撑爆）' },
      dryRun: { type: 'boolean', description: 'true = 只生成任务书不投递，用来预览' },
      send: { type: 'boolean', description: 'false = 只开票不投递（留档，之后可在界面点发送）' },
      sessionId: { type: 'string', description: '投递到哪个对话；不填则自动挑最近的普通会话' },
      workspaceId: { type: 'string', description: '没有可用会话时新建会话需要的工作区 id' },
      spawn: {
        type: 'string',
        description: '\'auto\' 或 true = 优先派独立子代理（推荐）；\'only\' = 派不了就报错，不退回会话；不填 = 老路写会话',
      },
    },
    async execute(args = {}, exec = undefined) {
      const projectId = needProjectId(args)
      const dir = await store.projectDir(root, projectId)
      // pack 默认开：材料落盘、prompt 只给清单。这是派单能撑住长书的唯一原因。
      let materials = args.materials
      let packInfo = null
      if (args.pack !== false) {
        const built = await taskpack.buildTaskPack(root, projectId, {
          role: args.role,
          chapter: args.chapter,
          task: args.task,
          extra: args.extra,
        })
        packInfo = { pack: built.pack, dir: built.dir }
        const section = taskpack.packPromptSection(built)
        materials = materials ? `${materials}\n\n${section}` : section
      }
      const ticket = await dispatch.issueDispatch(dir, {
        role: args.role,
        task: args.task,
        materials,
        pack: packInfo?.pack ?? '',
        packDir: packInfo?.dir ?? '',
        chapter: args.chapter,
      })
      if (args.send === false) {
        return { ticket, sent: false, prompt: dispatch.buildDispatchPrompt(ticket, { repoRoot: REPO_ROOT }) }
      }
      return sendDispatch(
        dir,
        {
          id: ticket.id,
          dryRun: args.dryRun,
          sessionId: args.sessionId,
          workspaceId: args.workspaceId,
          spawn: args.spawn,
        },
        pluginCtx ?? {},
        { parent: exec?.agent, cwd: exec?.agent?.session?.header?.cwd },
      )
    },
  }
}

/**
 * 配置 schema。
 *
 * 宿主只在**插件入口**找 `export const Config`，所以真正定义在 lib/config.js、
 * 这里原样转发——不是两套 schema，是一套挂两个位置。
 * 宿主拿它画设置表单、校验用户填的值；`apply()` 拿到的就是校验后的对象。
 */
export const Config = configLib.Config

export function apply(ctx, config = {}) {
  mountRoute(ctx)
  // 先归一化再落槽：作者手填的东西常常差一点（30 写成 300、on 写成 yes），
  // 归一化会把坏项退回默认并留一条 warning，而不是让插件带着 NaN 跑。
  const { value, warnings } = configLib.normalizeConfig(config)
  configLib.setRuntimeConfig(value, warnings)
  for (const line of warnings) console.warn(`[nightwrite] 配置：${line}`)
  const root = String(value.root ?? '').trim() || store.defaultRoot()
  // 原生写工具绕不过 RPC 的那一层，靠钩子补：pre 按项目策略拦，post 追提醒与分数。
  const guard = hooks.registerWriteGuard(ctx, { root })
  if (guard.pre || guard.post) {
    console.log(`[nightwrite] 写入守卫已挂载 pre=${guard.pre} post=${guard.post}`)
  }
  if (ctx && typeof ctx.tools?.register === 'function') {
    try {
      ctx.tools.register(createTool(root, ctx))
    } catch (error) {
      console.warn('[nightwrite] 工具注册失败', error)
    }
    try {
      ctx.tools.register(createDispatchTool(root, ctx))
    } catch (error) {
      console.warn('[nightwrite] 派单工具注册失败', error)
    }
  }
}
