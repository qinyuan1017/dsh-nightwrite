/**
 * 长夜 · 派单票据
 *
 * 工作台点「派给架构师」，服务端开一张票，把任务书写进 dispatches.json，
 * 然后由投递层（index.js 的 dispatch.send）把任务书塞进对话。
 * 对话里的模型拿到的不是「请你扮演架构师」这种口头约定，而是：
 *   · 一份手册的绝对路径（agents/<id>.md）
 *   · 该岗位能用的 skill 名单
 *   · 明确的只读边界：能读什么、不能改什么
 *   · 固定的回执格式，方便回执层解析
 *
 * 为什么票据要落盘而不是内存：
 *   LNW 用 Map，进程重启就丢，派出去的单子从此无法回执。
 *   长夜把票写进作品目录，重启后仍能对上「这张回执是哪张单子的」。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { ROLES, normalizeRole, agentFile, roleCatalog, ROLE_IDS } from './roles.js'
import * as config from './config.js'
import { withLock } from './lock.js'

/** 票据有效期：60 分钟。超时未回执的票不再接受提交。 */
export const DISPATCH_TTL_MS = 60 * 60 * 1000

/**
 * 运行时实际用的票据有效期。
 *
 * 60 分钟对「派给一个 agent 读完三章再交回执」其实偏紧；反过来，
 * 一个闪念派的单子挂两小时也没意义。做成配置项，按活的重不重自己调。
 */
function dispatchTtlMs() {
  const min = Number(config.getRuntimeConfig().dispatchTtlMin)
  return Number.isFinite(min) && min > 0 ? Math.round(min) * 60 * 1000 : DISPATCH_TTL_MS
}

export const DISPATCH_STATUS = ['issued', 'claimed', 'submitted', 'expired', 'revoked']

const nowIso = () => new Date().toISOString()

function ticketId() {
  return `dp_${randomBytes(6).toString('hex')}`
}

function fail(message, code = 'invalid') {
  const error = new Error(message)
  error.code = code
  throw error
}

function dispatchFile(dir) {
  return path.join(dir, 'dispatches.json')
}

async function readBook(dir) {
  try {
    const text = await fs.readFile(dispatchFile(dir), 'utf8')
    const parsed = JSON.parse(text)
    return { items: Array.isArray(parsed?.items) ? parsed.items : [] }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { items: [] }
    if (error instanceof SyntaxError) fail('dispatches.json 不是合法 JSON', 'corrupt')
    throw error
  }
}

async function writeBook(dir, book) {
  const file = dispatchFile(dir)
  const tmp = `${file}.tmp-${randomBytes(4).toString('hex')}`
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(tmp, JSON.stringify({ items: book.items }, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

/** 过期判定：issued/claimed 且已过 expiresAt。不改盘，只算状态。 */
function effectiveStatus(row) {
  if (!row) return ''
  if (row.status === 'issued' || row.status === 'claimed') {
    if (String(row.expiresAt ?? '') && String(row.expiresAt) < nowIso()) return 'expired'
  }
  return String(row.status ?? '')
}

function decorate(row) {
  const status = effectiveStatus(row)
  return { ...row, status, expired: status === 'expired' }
}

/**
 * 开一张票。
 * @param {string} dir 作品目录
 * @param {{role:string, task:string, materials?:string, chapter?:number, runId?:string, stageId?:string}} input
 */
export async function issueDispatch(dir, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(path.join(dir, 'dispatches.json'), () => issueDispatchInner(dir, input))
}

async function issueDispatchInner(dir, input = {}) {
  const role = normalizeRole(input.role)
  const task = String(input.task ?? '').trim()
  if (!task) fail('派单必须写清要它做什么（task 不能空）', 'invalid')
  const at = nowIso()
  const row = {
    id: ticketId(),
    role,
    roleLabel: ROLES[role].label,
    task,
    materials: String(input.materials ?? '').trim(),
    pack: String(input.pack ?? '').trim(),
    packDir: String(input.packDir ?? '').trim(),
    chapter: Number(input.chapter ?? 0) || 0,
    runId: String(input.runId ?? '').trim(),
    stageId: String(input.stageId ?? '').trim(),
    status: 'issued',
    createdAt: at,
    expiresAt: new Date(Date.now() + dispatchTtlMs()).toISOString(),
    claimedAt: '',
    submittedAt: '',
    sessionId: '',
    deliveries: 0,
    lastError: '',
  }
  const book = await readBook(dir)
  book.items.push(row)
  await writeBook(dir, book)
  return decorate(row)
}

/** 全部票据，新的在前。 */
export async function listDispatches(dir, options = {}) {
  const book = await readBook(dir)
  const wanted = String(options.status ?? '').trim()
  let rows = book.items.map(decorate)
  if (wanted) rows = rows.filter((row) => row.status === wanted)
  const role = String(options.role ?? '').trim()
  if (role) rows = rows.filter((row) => row.role === role)
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
  const limit = Number(options.limit ?? 0) || 0
  return { items: limit > 0 ? rows.slice(0, limit) : rows, total: rows.length }
}

export async function getDispatch(dir, id) {
  const book = await readBook(dir)
  const found = book.items.find((row) => row.id === String(id ?? ''))
  if (!found) fail(`没有这张派单票：${id}`, 'missing')
  return decorate(found)
}

/** 改票据字段（投递层记 sessionId、回执层记 submitted）。 */
export async function patchDispatch(dir, id, patch = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(path.join(dir, 'dispatches.json'), () => patchDispatchInner(dir, id, patch))
}

async function patchDispatchInner(dir, id, patch = {}) {
  const book = await readBook(dir)
  const at = book.items.findIndex((row) => row.id === String(id ?? ''))
  if (at < 0) fail(`没有这张派单票：${id}`, 'missing')
  book.items[at] = { ...book.items[at], ...patch }
  await writeBook(dir, book)
  return decorate(book.items[at])
}

/** 投递成功后回填会话 id 与投递次数。 */
export async function markDelivered(dir, id, sessionId) {
  const row = await getDispatch(dir, id)
  return patchDispatch(dir, id, {
    status: row.status === 'expired' ? 'expired' : 'claimed',
    claimedAt: row.claimedAt || nowIso(),
    sessionId: String(sessionId ?? ''),
    deliveries: Number(row.deliveries ?? 0) + 1,
    lastError: '',
  })
}

/** 投递失败记录原因，票保持可用（用户可重试）。 */
export async function markDeliveryFailed(dir, id, message) {
  const row = await getDispatch(dir, id)
  return patchDispatch(dir, id, {
    deliveries: Number(row.deliveries ?? 0) + 1,
    lastError: String(message ?? '').slice(0, 500),
    status: row.status === 'expired' ? 'expired' : row.status,
  })
}

/**
 * 收一份回执。
 *
 * 回执直接挂在票上，不单开文件——因为它天然属于某一张单，
 * 分开存就得维护外键，还要处理「票被删了回执怎么办」。
 *
 * 正文按 ### 小标题切成段，落到 sections 里，界面直接渲染成卡片；
 * 切不出来也照样存全文（text），不让格式不合规变成丢数据。
 */
export async function submitReport(dir, id, input = {}) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(path.join(dir, 'dispatches.json'), () => submitReportInner(dir, id, input))
}

async function submitReportInner(dir, id, input = {}) {
  const row = await getDispatch(dir, id)
  if (row.status === 'revoked') fail('这张票已作废，不能用它交回执', 'conflict')
  if (row.status === 'expired') fail('这张票已过期（超过 60 分钟），请重新派单', 'expired')
  // 一张票只收一份回执：覆盖会让「谁在什么时候说了什么」失去痕迹。
  if (row.status === 'submitted') fail('这张票已经交过回执了；要重做请重新派单', 'conflict')
  const text = String(input.text ?? '').trim()
  if (!text) fail('回执正文不能空', 'invalid')

  const sections = []
  const parts = text.split(/\n(?=###\s)/)
  for (const part of parts) {
    const m = /^###\s*(.+?)\s*\n([\s\S]*)$/.exec(part.trim())
    if (m) sections.push({ title: m[1].trim(), body: m[2].trim() })
    else if (part.trim() && !sections.length) sections.push({ title: '正文', body: part.trim() })
    else if (part.trim()) sections[sections.length - 1].body += `\n\n${part.trim()}`
  }

  const verdict = String(input.verdict ?? '').trim()
    || (sections.find((s) => s.title === '结论')?.body ?? '').split('\n')[0].trim()

  return patchDispatch(dir, id, {
    status: 'submitted',
    submittedAt: nowIso(),
    report: {
      text,
      sections,
      verdict: verdict.slice(0, 300),
      submittedBy: String(input.submittedBy ?? 'conversation'),
      at: nowIso(),
    },
  })
}

/** 回执列表：只取已交的，新的在前。 */
export async function listReports(dir, options = {}) {
  const book = await readBook(dir)
  let rows = book.items.filter((row) => row.report)
  const role = String(options.role ?? '').trim()
  if (role) rows = rows.filter((row) => row.role === role)
  rows.sort((a, b) => String(b.report?.at ?? '').localeCompare(String(a.report?.at ?? '')))
  const limit = Number(options.limit ?? 0) || 0
  return { items: (limit > 0 ? rows.slice(0, limit) : rows).map(decorate), total: rows.length }
}

/** 作废：用户点「算了不派了」。 */
export async function revokeDispatch(dir, id) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(path.join(dir, 'dispatches.json'), () => revokeDispatchInner(dir, id))
}

async function revokeDispatchInner(dir, id) {
  const row = await getDispatch(dir, id)
  if (row.status === 'submitted') fail('这张票已经交回执了，不能作废', 'conflict')
  return patchDispatch(dir, id, { status: 'revoked' })
}

/** 把过期的票标成 expired（落盘），返回清掉多少张。 */
export async function sweepExpired(dir) {
  // 读-改-写整体串行：两个人同时点同一个按钮，不串行就会丢一条。
  // 锁的边界见 lib/lock.js：只在单进程内有效，也不管跨调用的业务竞态。
  return withLock(path.join(dir, 'dispatches.json'), () => sweepExpiredInner(dir))
}

async function sweepExpiredInner(dir) {
  const book = await readBook(dir)
  let changed = 0
  book.items = book.items.map((row) => {
    if ((row.status === 'issued' || row.status === 'claimed') && String(row.expiresAt ?? '') < nowIso()) {
      changed += 1
      return { ...row, status: 'expired' }
    }
    return row
  })
  if (changed) await writeBook(dir, book)
  return { swept: changed }
}

/**
 * 任务书正文。这是投递给对话的那段文字。
 *
 * 写法上有三条刻意的约束：
 * 1. 手册用绝对路径给，不用「你的角色是……」的描述——描述会和文件内容打架。
 * 2. 边界写在前面而不是最后，因为「不能改哪些」被忽略的代价最大。
 * 3. 回执要求固定小标题，回执层要按标题切段。
 */
export function buildDispatchPrompt(ticket, options = {}) {
  const role = normalizeRole(ticket?.role)
  const info = ROLES[role]
  const repoRoot = String(options.repoRoot ?? '').trim()
  const manual = repoRoot ? agentFile(repoRoot, role) : `agents/${role}.md`
  const lines = []

  lines.push(`【长夜派单 · ${info.label}】`)
  lines.push('')
  lines.push('## 先读手册，再动手')
  lines.push(`你的岗位手册在：${manual}`)
  lines.push('开工前先把它完整读一遍；手册里的规定优先于本单的任何措辞。')
  lines.push('')
  lines.push('## 边界（先看这条）')
  lines.push('- 你只能读和算，不要修改正文、账本、细纲文件；所有落盘改动必须通过 nightwrite_op 走服务端的校验。')
  lines.push('- 你没有派单权。需要别人配合，把需求写进回执，由总编（nightwrite-coordinator）决定派给谁。')
  if (info.canDispatch) {
    lines.push('- 你是总编，本单允许你调用 subagent 派给其他岗位；每次派单只能派给一个岗位，且必须说明理由。')
  }
  lines.push(`- 你这一关的放行条件：${info.gate}`)
  lines.push('')
  lines.push('## 能用的 skill')
  lines.push(info.skills.map((s) => `- ${s}`).join('\n'))
  lines.push('')
  lines.push('## 本单要你做的事')
  lines.push(ticket.task)
  if (ticket.chapter) {
    lines.push('')
    lines.push(`涉及章号：第 ${ticket.chapter} 回`)
  }
  if (ticket.materials) {
    lines.push('')
    lines.push(ticket.materials.startsWith('## ') ? ticket.materials : '## 给你的材料')
    if (!ticket.materials.startsWith('## ')) lines.push(ticket.materials)
  }
  if (ticket.pack) {
    lines.push('')
    lines.push(`任务包：${ticket.pack}`)
    lines.push('回执里要写清你实际读了哪几份材料——服务端会按 sha1 核对。')
  }
  lines.push('')
  lines.push('## 回执格式（按这几个小标题写，缺一项算没交）')
  lines.push('### 结论')
  lines.push('一句话说结果：通过 / 不通过 / 需要 X 补齐。')
  lines.push('### 依据')
  lines.push('每条结论后面跟证据：正文原句、账本条目、细纲字段，指到具体位置。')
  lines.push('### 要别人做的事')
  lines.push('没有就写「无」。有就写清交给哪个岗位、要它产出什么。')
  lines.push('### 风险')
  lines.push('这一关漏过去会怎样。没有就写「无」。')
  lines.push('')
  lines.push(`票据号：${ticket.id}（回执时带上它，服务端靠它把结果挂回工作台）`)

  return lines.join('\n')
}

export { ROLES, ROLE_IDS, roleCatalog, normalizeRole, agentFile }
