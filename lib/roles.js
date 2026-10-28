/**
 * 长夜 · 岗位表
 *
 * 把 agents/ 里的 11 个 Markdown 岗位登记成可派单的角色。
 * 这里只描述「谁存在、读哪份手册、能用哪些 skill」，不含任何提示词正文——
 * 正文在 agents/*.md 里，派单时把路径交给对话，由对话自己读。
 *
 * 为什么不在代码里内联提示词：
 *   agent 文件是给「装载系统 / 对话」读的，改它不用改代码、不用重新构建；
 *   内联进 JS 就会有两份副本，早晚不一致。
 */

import path from 'node:path'

/**
 * 岗位 → 可用工具白名单（第 3 条）。
 *
 * 为什么要在代码里写死：任务书里写「你只能读和算」是提示，模型可以不理；
 * tools.restrict({allow}) 是硬约束，越权调用直接被宿主拒。
 *
 * 三档：
 *   READ_ONLY  只能读。审校、读者代理、责编靠这个，它们要出结论不要动手。
 *   WRITE      能读写正文。写手、改写、文风、角色、世界观都要落盘。
 *   FULL       读写 + 命令行 + 联网。只有资料员和总编有。
 *
 * changye_op 是常驻项：所有岗位都要能调 RPC 读项目数据（账本、章节、字统计）。
 * changye_dispatch 与 subagent 只给总编——岗位互相派单会把成本乘起来。
 */
export const TOOL_SETS = {
  read: ['read', 'glob', 'grep', 'changye_op'],
  write: ['read', 'glob', 'grep', 'write', 'edit', 'changye_op'],
  full: ['read', 'glob', 'grep', 'write', 'edit', 'bash', 'web_search', 'web_fetch', 'changye_op'],
  dispatch: [
    'read',
    'glob',
    'grep',
    'write',
    'edit',
    'bash',
    'web_search',
    'web_fetch',
    'changye_op',
    'changye_dispatch',
    'subagent',
  ],
}

/** 白名单档位名称，界面与文档用。 */
export const TOOL_SET_IDS = Object.keys(TOOL_SETS)

/** 取某岗位的工具白名单；未知岗位返回空数组（调用方自行决定怎么兜）。 */
export function roleTools(roleId) {
  const row = ROLES[String(roleId ?? '')]
  if (!row) return []
  return TOOL_SETS[row.toolSet ?? 'read'].slice()
}

/** 岗位 id → 元信息。id 必须与 agents/<id>.md 的文件名一致。 */
export const ROLES = {
  'changye-coordinator': {
    toolSet: 'dispatch',
    label: '总编',
    duty: '排产、仲裁、唯一有权派单和签发',
    canDispatch: true,
    skills: ['changye-plan-novel', 'changye-quality-rubric'],
    gate: 'G1 细纲门 / G2 事实门 / G3 体验门',
  },
  'changye-story-architect': {
    toolSet: 'write',
    label: '故事架构师',
    duty: '总纲、卷纲、章节细纲、伏笔埋设计划、因果链',
    canDispatch: false,
    skills: ['changye-plan-novel', 'changye-beat-sheet', 'changye-chapter-hook', 'changye-foreshadow-ledger'],
    gate: '交出可执行的细纲（含禁写项与放行项）',
  },
  'changye-chapter-writer': {
    toolSet: 'write',
    label: '正文写手',
    duty: '按细纲把一回写成正文',
    canDispatch: false,
    skills: ['changye-write-chapter', 'changye-dialogue-voice', 'changye-context-memory'],
    gate: '交稿 = 正文 + 本章引用设定清单 + 破格申请',
  },
  'changye-consistency-checker': {
    toolSet: 'read',
    label: '设定审校',
    duty: '查设定冲突、伏笔断线、时间线矛盾、人物行为越界',
    canDispatch: false,
    skills: ['changye-continuity-pass', 'changye-story-bible', 'changye-foreshadow-ledger', 'changye-character-state'],
    gate: '致命项为零才放行',
  },
  'changye-reader-proxy': {
    toolSet: 'read',
    label: '读者代理',
    duty: '判断读者会不会追下去（七栏体验表）',
    canDispatch: false,
    skills: ['changye-reader-report', 'changye-reader-question', 'changye-engagement-curve', 'changye-drop-off-check'],
    gate: '追读指数 ≥ 门槛且弃书风险非「高」',
  },
  'changye-editor': {
    toolSet: 'read',
    label: '责编',
    duty: '从商业可读性给改法，判断节奏能不能发',
    canDispatch: false,
    skills: ['changye-quality-rubric', 'changye-comment-simulation', 'changye-paywall-check'],
    gate: '给出可执行的修改优先级',
  },
  'changye-rewrite-specialist': {
    toolSet: 'write',
    label: '改写专家',
    duty: '按意见动结构地改稿',
    canDispatch: false,
    skills: ['changye-revision-pass', 'changye-de-ai-style'],
    gate: '改完要能逐条对上原意见',
  },
  'changye-style-specialist': {
    toolSet: 'write',
    label: '文风专家',
    duty: '去 AI 味、贴作者本人文风',
    canDispatch: false,
    skills: ['changye-de-ai-style', 'changye-style-distillation'],
    gate: 'AI 味命中下降且不丢信息',
  },
  'changye-character-designer': {
    toolSet: 'write',
    label: '角色设计师',
    duty: '建角色底色卡、修「不像他」',
    canDispatch: false,
    skills: ['changye-character-arc', 'changye-character-state', 'changye-dialogue-voice'],
    gate: '弧光四段齐全（起点/欲望/转折/终点）',
  },
  'changye-worldbuilder': {
    toolSet: 'write',
    label: '世界观构建师',
    duty: '世界规则、势力、历史、专名索引',
    canDispatch: false,
    skills: ['changye-worldbuilding-bible', 'changye-story-bible'],
    gate: '规则可判定（能被违反、能被查出来）',
  },
  'changye-researcher': {
    toolSet: 'full',
    label: '资料员',
    duty: '查现实考据，不许凭空编',
    canDispatch: false,
    skills: ['changye-worldbuilding-bible'],
    gate: '每条给来源，查不到就说查不到',
  },
}

/** 稳定的岗位顺序，界面上按这个排。 */
export const ROLE_IDS = Object.keys(ROLES)

/** 岗位的 agent 文件绝对路径：<repo>/agents/<id>.md */
export function agentFile(repoRoot, roleId) {
  const id = String(roleId ?? '')
  if (!Object.prototype.hasOwnProperty.call(ROLES, id)) return ''
  return path.join(repoRoot, 'agents', `${id}.md`)
}

/** 校验并归一化岗位 id；不合法抛错由调用方处理。 */
export function normalizeRole(roleId) {
  const id = String(roleId ?? '').trim()
  if (!Object.prototype.hasOwnProperty.call(ROLES, id)) {
    const known = ROLE_IDS.join(', ')
    const error = new Error(`没有这个岗位：${id || '(空)'}；可用：${known}`)
    error.code = 'invalid-role'
    throw error
  }
  return id
}

/** 给界面用的一览：不含文件路径，只给能显示的东西。 */
export function roleCatalog() {
  return ROLE_IDS.map((id) => ({
    id,
    label: ROLES[id].label,
    duty: ROLES[id].duty,
    canDispatch: ROLES[id].canDispatch,
    gate: ROLES[id].gate,
    skills: ROLES[id].skills.slice(),
    toolSet: ROLES[id].toolSet ?? 'read',
    tools: roleTools(id),
  }))
}
