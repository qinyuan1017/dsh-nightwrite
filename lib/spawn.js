/**
 * 长夜 · 真派子代理（第 2 条：不注入 subagents）
 *
 * 原先派单只有一个办法：拿一张票，把任务书写进「某个已经存在的对话」里。
 * 挑不到会话就报「没有 workspaceId，无法新建会话」。这条路有三个毛病：
 *   1. 得有人在界面里先开一个对话，否则派不出去；
 *   2. 派出去的是同一个会话，子代理和作者共用上下文，前后互相污染；
 *   3. 岗位的工具白名单只是任务书里的一句话，模型可以不理。
 *
 * 现在走宿主原生的 `ctx.subagents.startActivation()`：
 *   · provider 用 'spawn'（in-process 子代理，能读到父代理的 Context）；
 *   · 通过 `agent/created` 事件在子代理「第一次发模型请求之前」把人格与工具白名单按上去，
 *     宿主会 await 这个事件，所以不存在「先跑起来再收窄」的窗口；
 *   · `maxDepth: 1` —— 子代理不能再派子代理，否则成本会乘起来。
 *
 * 为什么不在 RPC 里派：
 *   startActivation 会校验 `parent` 是「当前活着的那个 Agent 实例」
 *   （ctx.get('agents').get(parent.id) === parent，见宿主源码），
 *   而 /nightwrite/api 是一条 HTTP 路由，手里没有任何 Agent。
 *   所以派单必须从工具里发起（exec.agent 就是活的父代理），RPC 那条路只能退回写会话。
 *
 * 零依赖：不 import @deepseek-ai/*，宿主服务全从 ctx 上取。
 */

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import * as roles from './roles.js'

/** 宿主内置的进程内子代理 provider 名。 */
export const SPAWN_PROVIDER = 'spawn'

/** 子代理最深一层，不能再往下派。 */
export const SPAWN_MAX_DEPTH = 1

/** 人格段的优先级：排在部署人格前缀那一档，压住默认系统提示。 */
const PERSONA_SECTION = 'deployment:persona-prefix'

/** 读到的岗位手册缓存：同一进程里改文件不用重启也能生效，靠 mtime 判断。 */
const personaCache = new Map()

/**
 * 取岗位手册正文（agents/<id>.md）。
 *
 * 手册是 markdown，开头有 YAML frontmatter。frontmatter 里的 name/description
 * 是给技能加载器看的，塞进系统提示只会浪费 token，所以这里剥掉。
 */
export function personaOf(repoRoot, roleId) {
  const file = roles.agentFile(repoRoot, roleId)
  if (!file) return { ok: false, text: '', file: '', reason: 'no-such-role' }
  let stat
  try {
    stat = fs.statSync(file)
  } catch {
    return { ok: false, text: '', file, reason: 'missing-file' }
  }
  const key = `${file}:${stat.mtimeMs}:${stat.size}`
  const hit = personaCache.get(file)
  if (hit && hit.key === key) return hit.value
  let raw = ''
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (error) {
    return { ok: false, text: '', file, reason: `read-failed:${error?.message ?? error}` }
  }
  const value = { ok: true, text: stripFrontmatter(raw).trim(), file, reason: '' }
  personaCache.set(file, { key, value })
  return value
}

/** 去掉开头 `--- ... ---` 那段；没有就原样返回。 */
export function stripFrontmatter(text) {
  const src = String(text ?? '')
  if (!src.startsWith('---')) return src
  const end = src.indexOf('\n---', 3)
  if (end < 0) return src
  const after = src.indexOf('\n', end + 4)
  const rest = after < 0 ? '' : src.slice(after + 1)
  return rest.replace(/^\s*\n/, '')
}

/** 宿主有没有 subagents 服务、有没有 spawn provider。 */
export function spawnStatus(ctx) {
  const service = ctx?.subagents ?? ctx?.get?.('subagents')
  const provider =
    typeof service?.getProvider === 'function' ? service.getProvider(SPAWN_PROVIDER) : undefined
  return {
    service: Boolean(service) && typeof service.startActivation === 'function',
    provider: Boolean(provider),
    providerName: SPAWN_PROVIDER,
    maxDepth: SPAWN_MAX_DEPTH,
    reason: !service
      ? '宿主没有 subagents 服务'
      : typeof service.startActivation !== 'function'
        ? 'subagents 服务没有 startActivation（宿主版本偏旧）'
        : !provider
          ? `没有名为 ${SPAWN_PROVIDER} 的子代理 provider`
          : '',
  }
}

/**
 * 子代理能用的工具：在岗位白名单基础上砍掉「再派一层」的能力。
 *
 * 总编的 toolSet 里有 subagent 与 nightwrite_dispatch，那是给「顶层的总编」用的。
 * 一旦它自己是子代理，宿主的 maxDepth 已经拦住了，但工具还挂在清单里——
 * 模型会试，试了报错，白烧一轮。所以派下去的时候直接摘掉。
 */
export function childTools(roleId) {
  return roles
    .roleTools(roleId)
    .filter((name) => name !== 'subagent' && name !== 'nightwrite_dispatch')
}

/** 能不能派：服务在、provider 在、有活的父代理。 */
export function canSpawn(ctx, parent) {
  const status = spawnStatus(ctx)
  if (!status.service) return { ok: false, ...status }
  if (!status.provider) return { ok: false, ...status }
  if (!parent || typeof parent !== 'object' || !parent.id) {
    return {
      ok: false,
      ...status,
      reason: '没有活的父代理（RPC 路由里拿不到 Agent，只能在工具里派）',
    }
  }
  return { ok: true, ...status }
}

/**
 * 把人格与工具白名单按到一个刚创建的子代理上。
 *
 * 两个动作都是硬的：
 *   systemPrompt.section()  插一段系统提示（人格 = 岗位手册正文）
 *   tools.restrict({allow}) 收窄工具白名单，越权调用直接被宿主拒
 *
 * 顺序有讲究：先插人格再收窄工具。反过来的话，万一 section 抛错，
 * 工具已经被收窄了，子代理带着半套限制跑完全程，更难查。
 */
export function configureRoleAgent(agent, options = {}) {
  const roleId = String(options.role ?? '')
  const persona = String(options.persona ?? '').trim()
  const allow = Array.isArray(options.allow) ? options.allow.slice() : childTools(roleId)
  const applied = { persona: false, tools: false, reason: '' }

  const systemPrompt = agent?.ctx?.get?.('systemPrompt')
  if (systemPrompt && typeof systemPrompt.section === 'function') {
    try {
      const order =
        typeof systemPrompt.getSectionOrder === 'function'
          ? systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX')
          : -1000
      systemPrompt.section({
        name: PERSONA_SECTION,
        order: Number.isFinite(order) ? order : -1000,
        text: persona,
      })
      applied.persona = true
    } catch (error) {
      applied.reason += `人格段插入失败：${error?.message ?? error}；`
    }
  } else {
    applied.reason += '宿主没有 systemPrompt 服务，人格没按上；'
  }

  const toolService = agent?.ctx?.get?.('tools')
  if (toolService && typeof toolService.restrict === 'function' && allow.length) {
    try {
      toolService.restrict({ allow })
      applied.tools = true
    } catch (error) {
      applied.reason += `工具白名单收窄失败：${error?.message ?? error}；`
    }
  } else {
    applied.reason += '宿主没有 tools.restrict，工具白名单没生效；'
  }

  applied.role = roleId
  applied.allow = allow
  return applied
}

/**
 * 派一个岗位子代理。
 *
 * 返回 `{childId, messageId, result, dispose, role, allow}`；
 * `result` 是 Promise<SubagentResult>，调用方要不要 await 自己决定
 * （await 就是前台等它干完，不 await 就是后台跑）。
 */
export async function spawnRole(ctx, options = {}) {
  // 先校验岗位再查能力：岗位写错是参数问题，跟宿主支不支持无关，
  // 混着报会让人以为是环境坏了。
  const roleId = roles.normalizeRole(options.role)
  const status = canSpawn(ctx, options.parent)
  if (!status.ok) {
    const error = new Error(status.reason || '无法派子代理')
    error.code = 'spawn-unavailable'
    throw error
  }
  const service = ctx.subagents ?? ctx.get('subagents')
  const label = String(options.label ?? '').trim() || `${roles.ROLES[roleId].label}（长夜派单）`
  const text = String(options.prompt ?? '').trim()
  if (!text) {
    const error = new Error('派子代理要给 prompt')
    error.code = 'invalid'
    throw error
  }
  const persona = personaOf(options.repoRoot ?? '', roleId)
  const allow = childTools(roleId)

  const childId = randomUUID()
  let configured = null
  // 宿主在 agent/created 里是「串行 await」的：这个监听器返回之前，
  // 子代理不会发出第一个模型请求。所以在这里按人格与工具是安全的。
  const unobserve = options.parent.ctx.on(
    'agent/created',
    ({ agent }) => {
      if (!agent || agent.id !== childId) return
      configured = configureRoleAgent(agent, { role: roleId, persona: persona.text, allow })
    },
    { global: true },
  )

  try {
    const activation = await service.startActivation({
      provider: SPAWN_PROVIDER,
      label,
      childId,
      request: {
        parent: options.parent,
        prompt: [{ type: 'text', text }],
        maxDepth: SPAWN_MAX_DEPTH,
        ...(options.cwd ? { cwd: options.cwd } : {}),
      },
      signal: options.signal ?? new AbortController().signal,
      delivery: 'caller',
    })
    if (!configured) {
      // 宿主没在发布前创建子代理 → 人格与白名单都没按上，宁可退掉也不要裸跑。
      await activation.dispose?.()
      const error = new Error('宿主没有在发布前创建子代理，人格与工具白名单没按上，已退回')
      error.code = 'spawn-not-configured'
      throw error
    }
    return {
      childId: activation.childId ?? childId,
      messageId: activation.messageId ?? '',
      result: activation.result,
      dispose: () => activation.dispose?.(),
      role: roleId,
      label,
      allow,
      personaApplied: configured,
      personaFile: persona.file,
      personaOk: persona.ok,
    }
  } finally {
    unobserve()
  }
}

/** 给界面/工具用的一览：这个岗位能派吗、派下去它有什么工具。 */
export function spawnCatalog(ctx, parent) {
  const status = canSpawn(ctx, parent)
  return {
    ...status,
    roles: roles.roleCatalog().map((row) => ({
      id: row.id,
      label: row.label,
      toolSet: row.toolSet,
      tools: row.tools,
      canDispatch: row.canDispatch,
    })),
  }
}
