/**
 * 长夜 · 真实后端端到端测试（不碰界面，只打服务端全链路）
 *
 * 覆盖：
 *   1. handleRpc 的 23 个 op 全量走一遍（happy path）
 *   2. createHandler 起真 HTTP 服务，用真 fetch 打 READ op
 *   3. guard() 的三条分支（connection 允许 / connection 拒绝 / 回环兜底）
 *   4. 边界：缺参、超大体、非 JSON、未知 op、不存在章节、不存在作品
 *   5. createTool 的 execute 与 UI 共用同一份数据（工具写、UI 读得到）
 *   6. 落盘格式（library.json / chapters/0001.txt / ledger.json 可迁移）
 *
 * 全部落盘到 os.tmpdir() 下的临时根目录，跑完删除，不碰真实数据。
 *
 * 注意：返回值形状是「包一层」的（project.list → {projects}、ledger.get → {ledger}、
 * chapter.list → {chapters}、templates.list / queue.list → {items}），
 * 这里一律按真实形状解包断言，跟 client 侧 src/90-shell.js 的取法保持一致。
 */

import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import http from 'node:http'
import net from 'node:net'

import * as store from '../lib/store.js'
import * as hooks from '../lib/hooks.js'
import * as usage from '../lib/usage.js'
import * as lock from '../lib/lock.js'
import {
  handleRpc, createHandler, guard, createTool, mountRoute, injectBoot,
  createDispatchTool,
  ROUTE, TOOL_NAME, VERSION, READ_OPS, WRITE_OPS, RPC_OPS,
} from '../index.js'
import { roleCatalog } from '../lib/roles.js'
import * as lint from '../lib/lint.js'

// ── 断言器 ───────────────────────────────────────────────────

let pass = 0
const fails = []

function check(name, ok, detail) {
  if (ok) {
    pass += 1
    console.log(`✓ ${name}`)
  } else {
    fails.push(name)
    console.log(`✗ ${name}${detail === undefined ? '' : `  → ${detail}`}`)
  }
}

function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  check(name, ok, ok ? undefined : `拿到 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`)
}

async function expectThrow(name, fn, matcher) {
  try {
    await fn()
    check(name, false, '没有抛出，应该抛')
  } catch (error) {
    const msg = String(error?.message ?? error)
    const code = error?.code ?? ''
    const ok = matcher ? matcher.test(msg) || matcher.test(code) : true
    check(name, ok, ok ? undefined : `抛的是「${msg}」code=${code}`)
  }
}

const LEDGER_KINDS = ['characters', 'locations', 'foreshadow', 'events', 'terms', 'rules', 'highlights', 'conflicts']

// ── 开跑 ─────────────────────────────────────────────────────

const root = await mkdtemp(join(tmpdir(), 'nightwrite-be-'))
console.log(`临时根目录：${root}\n`)

try {
  // ══ 1. 连通与导出契约 ════════════════════════════════════
  console.log('— 1. 连通与导出契约')
  const ping = await handleRpc({ op: 'ping' }, {}, { root })
  check('ping 返回 name=nightwrite', ping?.name === 'nightwrite', JSON.stringify(ping))
  check('ping 带版本与 op 数', ping?.version === '0.1.0' && ping?.ops === 119, JSON.stringify(ping))
  eq('VERSION', VERSION, '0.1.0')
  eq('ROUTE', ROUTE, '/nightwrite/api')
  eq('TOOL_NAME', TOOL_NAME, 'nightwrite_op')
  eq('READ_OPS 60 个', READ_OPS.length, 60)
  eq('WRITE_OPS 59 个', WRITE_OPS.length, 59)
  eq('RPC_OPS 合计 119', RPC_OPS.length, 119)
  check('READ/WRITE 无交集', READ_OPS.every((op) => !WRITE_OPS.includes(op)))
  // overview / ping 是扁平历史 op（客户端 src/20-cockpit.js 直接 api('overview')），
  // 其余全部按 resource.action 命名。断言「除白名单外都带点号」。
  check('op 除白名单外都带点号命名空间', RPC_OPS.filter((op) => !['ping', 'overview', 'search'].includes(op)).every((op) => op.includes('.')), RPC_OPS.join(','))

  // ══ 2. 空库 ══════════════════════════════════════════════
  console.log('\n— 2. 空库状态')
  eq('project.list 空数组', (await handleRpc({ op: 'project.list' }, {}, { root })).projects, [])

  // ══ 3. 建作品 ════════════════════════════════════════════
  console.log('\n— 3. 建作品（project.create）')
  const created = await handleRpc({
    op: 'project.create',
    payload: { name: '元末女帝', genre: '历史穿越', targetWords: 2500, monthlyBudget: 60, qualityGate: 80 },
  }, {}, { root })
  const pid = created?.id
  check('返回作品 id', typeof pid === 'string' && pid.length > 0, JSON.stringify(created))
  check('返回数据目录', typeof created?.dir === 'string' && created.dir.length > 0, created?.dir)
  check('meta 落盘书名', created?.meta?.name === '元末女帝', created?.meta?.name)
  check('meta 落盘题材', created?.meta?.genre === '历史穿越', created?.meta?.genre)
  check('meta 落盘质量门槛', Number(created?.meta?.qualityGate) === 80, created?.meta?.qualityGate)
  check('meta 落盘月预算', Number(created?.meta?.monthlyBudget) === 60, created?.meta?.monthlyBudget)
  check('meta 有 schemaVersion', created?.meta?.schemaVersion !== undefined, created?.meta?.schemaVersion)
  check('meta 初始 worldState 有空文本', created?.meta?.worldState?.text === '', JSON.stringify(created?.meta?.worldState))

  const got = await handleRpc({ op: 'project.get', payload: { projectId: pid } }, {}, { root })
  check('project.get 包一层 project', got?.project?.id === pid, JSON.stringify(got)?.slice(0, 60))
  check('project.get 带 dir', typeof got?.dir === 'string')

  const listAfter = await handleRpc({ op: 'project.list' }, {}, { root })
  check('project.list 出现 1 个', listAfter.projects.length === 1, listAfter.projects.length)
  check('列表项带 chapters 计数（0）', Number(listAfter.projects[0]?.chapters) === 0, listAfter.projects[0]?.chapters)
  check('列表项带 words 计数（0）', Number(listAfter.projects[0]?.words) === 0, listAfter.projects[0]?.words)

  // project.save 改名 + 世界状态
  await handleRpc({ op: 'project.save', payload: { projectId: pid, patch: { name: '元末女帝（改）', qualityGate: 75 } } }, {}, { root })
  const saved2 = await handleRpc({ op: 'project.get', payload: { projectId: pid } }, {}, { root })
  check('project.save 改名生效', saved2.project.name === '元末女帝（改）', saved2.project.name)
  check('project.save 改门槛生效', Number(saved2.project.qualityGate) === 75, saved2.project.qualityGate)
  check('未传的字段不被清空', saved2.project.genre === '历史穿越', saved2.project.genre)
  const listRenamed = await handleRpc({ op: 'project.list' }, {}, { root })
  check('library.json 索引同步改名', listRenamed.projects[0]?.name === '元末女帝（改）', listRenamed.projects[0]?.name)

  // ══ 4. 写章节 ════════════════════════════════════════════
  console.log('\n— 4. 写章节（chapter.save / get / list）')
  const ch1 = '第一回 城头夜雨\n\n雨落了三天。城头的火把熄了两回，守卒换班时踩进泥里，骂了一声又咽回去。'
  const s1 = await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 1, text: ch1 } }, {}, { root })
  check('chapter.save 回章号', Number(s1?.chapter) === 1, JSON.stringify(s1))
  check('chapter.save 回 meta', typeof s1?.meta === 'object', typeof s1?.meta)
  check('新章默认进待验收（review）', s1?.meta?.status === 'review', s1?.meta?.status)
  check('meta 记了字数', Number(s1?.meta?.words) > 0, s1?.meta?.words)

  const g1 = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 1 } }, {}, { root })
  check('chapter.get 取回正文', String(g1?.text ?? '').includes('城头夜雨'), String(g1?.text ?? '').slice(0, 30))
  check('chapter.get 回字数', Number(g1?.words) > 0, g1?.words)
  check('chapter.get 回文件名 0001.txt', g1?.file === '0001.txt', g1?.file)
  check('chapter.get 状态是 review', g1?.meta?.status === 'review', g1?.meta?.status)
  check('chapter.get 有 issues/violations 空数组',
    Array.isArray(g1?.meta?.issues) && Array.isArray(g1?.meta?.violations))

  // 第二章
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 2, text: '第二回 火器局\n\n匠户的名册压在案底，朱重八翻了三遍，指尖停在第七行。' } }, {}, { root })
  const l2 = await handleRpc({ op: 'chapter.list', payload: { projectId: pid } }, {}, { root })
  check('chapter.list 包一层 chapters', Array.isArray(l2?.chapters), typeof l2?.chapters)
  check('chapter.list 有 2 章', l2.chapters.length === 2, l2.chapters.length)
  check('列表按章号升序', l2.chapters[0].chapter < l2.chapters[1].chapter, l2.chapters.map((c) => c.chapter).join(','))
  check('列表项带标题（取正文首行）', String(l2.chapters[0]?.title ?? '').includes('第一回'), l2.chapters[0]?.title)
  check('列表项不灌整章正文', l2.chapters.every((c) => c.text === undefined), '返回里带了 text')
  check('列表项带 words/status/score/issues',
    l2.chapters.every((c) => typeof c.words === 'number' && typeof c.status === 'string'
      && typeof c.score === 'number' && typeof c.issues === 'number' && typeof c.violations === 'number'),
    JSON.stringify(l2.chapters[0])?.slice(0, 100))

  // 重存不改状态
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 1, text: ch1 + '\n\n又补一句。' } }, {}, { root })
  const g1b = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 1 } }, {}, { root })
  check('重存正文不丢状态', g1b?.meta?.status === 'review', g1b?.meta?.status)
  check('重存后正文变长', String(g1b?.text ?? '').includes('又补一句'))

  // ══ 5. 账本 ══════════════════════════════════════════════
  console.log('\n— 5. 账本（ledger.get / upsert / remove / save）')
  const blank = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('ledger.get 包一层 ledger', !!blank && typeof blank === 'object', typeof blank)
  check('空账本 8 栏齐全', LEDGER_KINDS.every((k) => Array.isArray(blank?.[k])), Object.keys(blank ?? {}).join(','))
  check('空账本每栏都是空数组', LEDGER_KINDS.every((k) => blank[k].length === 0))

  const up1 = await handleRpc({
    op: 'ledger.upsert',
    payload: { projectId: pid, kind: 'characters', row: { name: '朱重八', role: '主角', goal: '活下去' } },
  }, {}, { root })
  check('upsert 回 kind/row/rows', up1?.kind === 'characters' && up1?.row && Array.isArray(up1?.rows), JSON.stringify(up1)?.slice(0, 60))
  check('upsert 自动发 id', typeof up1?.row?.id === 'string' && up1.row.id.length > 0, up1?.row?.id)
  check('upsert 自动发 createdAt', typeof up1?.row?.createdAt === 'string', up1?.row?.createdAt)

  await handleRpc({ op: 'ledger.upsert', payload: { projectId: pid, kind: 'characters', row: { name: '马秀英', role: '女主' } } }, {}, { root })
  await handleRpc({ op: 'ledger.upsert', payload: { projectId: pid, kind: 'foreshadow', row: { title: '第七行名册', plannedChapter: 9 } } }, {}, { root })

  const led1 = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('人物 2 条', led1.characters.length === 2, led1.characters.length)
  check('伏笔 1 条', led1.foreshadow.length === 1, led1.foreshadow.length)
  check('人物字段保住', led1.characters.some((r) => r.name === '朱重八' && r.goal === '活下去'))

  // 同 id 再 upsert 是更新不是新增
  const zhuId = led1.characters.find((r) => r.name === '朱重八')?.id
  await handleRpc({ op: 'ledger.upsert', payload: { projectId: pid, kind: 'characters', row: { id: zhuId, flaw: '多疑' } } }, {}, { root })
  const led2 = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('同 id upsert 不新增（仍 2 条）', led2.characters.length === 2, led2.characters.length)
  check('同 id upsert 是合并（名字+新字段都在）',
    led2.characters.some((r) => r.id === zhuId && r.name === '朱重八' && r.flaw === '多疑'),
    JSON.stringify(led2.characters.find((r) => r.id === zhuId)))

  const rm = await handleRpc({ op: 'ledger.remove', payload: { projectId: pid, kind: 'characters', id: zhuId } }, {}, { root })
  check('remove 回 removed id', rm?.removed === zhuId, JSON.stringify(rm))
  const led3 = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('删除后人物 1 条', led3.characters.length === 1, led3.characters.length)
  check('删的正是朱重八', led3.characters[0]?.name === '马秀英', led3.characters[0]?.name)

  const savedLed = await handleRpc({
    op: 'ledger.save',
    payload: { projectId: pid, ledger: { ...led3, terms: [{ id: 't1', term: '火器局', note: '军器监下属' }] } },
  }, {}, { root })
  check('ledger.save 包一层 ledger', Array.isArray(savedLed?.ledger?.terms), typeof savedLed?.ledger)
  const led4 = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('整本覆盖生效', led4.terms.length === 1 && led4.terms[0].term === '火器局', JSON.stringify(led4.terms))

  await expectThrow('未知账本类别被拒', () => handleRpc({ op: 'ledger.upsert', payload: { projectId: pid, kind: '瞎编', row: {} } }, {}, { root }), /未知账本类别|invalid/i)

  // ══ 6. 模板 ══════════════════════════════════════════════
  console.log('\n— 6. 模板（templates.list / save / remove）')
  const t0 = (await handleRpc({ op: 'templates.list', payload: { projectId: pid } }, {}, { root })).items
  check('templates.list 包一层 items', Array.isArray(t0), typeof t0)
  check('默认模板 6 个', t0.length === 6, t0.length)
  check('默认模板带 name/intent', t0.every((t) => typeof t.name === 'string' && typeof t.intent === 'string'), JSON.stringify(t0[0]))

  const tSave = await handleRpc({ op: 'template.save', payload: { projectId: pid, template: { name: '爽点模板', intent: '三章一小爽' } } }, {}, { root })
  check('template.save 回 template 与 items', tSave?.template?.name === '爽点模板' && Array.isArray(tSave?.items), JSON.stringify(tSave?.template))
  check('新增模板带 id', typeof tSave?.template?.id === 'string' && tSave.template.id.length > 0, tSave?.template?.id)
  const t1 = (await handleRpc({ op: 'templates.list', payload: { projectId: pid } }, {}, { root })).items
  check('模板数 +1', t1.length === t0.length + 1, `${t0.length} → ${t1.length}`)
  await handleRpc({ op: 'template.remove', payload: { projectId: pid, id: tSave.template.id } }, {}, { root })
  const t2 = (await handleRpc({ op: 'templates.list', payload: { projectId: pid } }, {}, { root })).items
  check('删除后回到 6 个', t2.length === t0.length, t2.length)

  await expectThrow('空模板名被拒', () => handleRpc({ op: 'template.save', payload: { projectId: pid, template: { name: '  ' } } }, {}, { root }), /模板名|invalid/i)

  // ══ 7. 队列 ══════════════════════════════════════════════
  console.log('\n— 7. 队列（queue.add / list / update / remove）')
  const q0 = (await handleRpc({ op: 'queue.list', payload: { projectId: pid } }, {}, { root })).items
  check('queue.list 包一层 items', Array.isArray(q0), typeof q0)
  check('队列初始为空', q0.length === 0, q0.length)

  const qAdd = await handleRpc({ op: 'queue.add', payload: { projectId: pid, item: { chapter: 3, intent: '写火器局查案', words: 3000 } } }, {}, { root })
  const qid = qAdd?.item?.id
  check('queue.add 回 item.id', typeof qid === 'string' && qid.length > 0, JSON.stringify(qAdd)?.slice(0, 60))
  check('队列项初始状态 queued', qAdd?.item?.status === 'queued', qAdd?.item?.status)
  check('队列项保住章号与指令', qAdd?.item?.chapter === 3 && qAdd?.item?.intent === '写火器局查案', JSON.stringify(qAdd?.item))
  check('队列项保住字数', Number(qAdd?.item?.words) === 3000, qAdd?.item?.words)

  const q1 = (await handleRpc({ op: 'queue.list', payload: { projectId: pid } }, {}, { root })).items
  check('队列 1 条', q1.length === 1, q1.length)

  await handleRpc({ op: 'queue.update', payload: { projectId: pid, id: qid, patch: { status: 'running' } } }, {}, { root })
  const q2 = (await handleRpc({ op: 'queue.list', payload: { projectId: pid } }, {}, { root })).items
  check('queue.update 改状态生效', q2[0]?.status === 'running', q2[0]?.status)

  await handleRpc({ op: 'queue.remove', payload: { projectId: pid, id: qid } }, {}, { root })
  const q3 = (await handleRpc({ op: 'queue.list', payload: { projectId: pid } }, {}, { root })).items
  check('queue.remove 生效', q3.length === 0, q3.length)

  await expectThrow('更新不存在的队列项被拒', () => handleRpc({ op: 'queue.update', payload: { projectId: pid, id: 'q_nope', patch: {} } }, {}, { root }), /没有|missing/i)

  // ══ 8. overview ══════════════════════════════════════════
  console.log('\n— 8. overview（驾驶舱取数）')
  const ov = await handleRpc({ op: 'overview', payload: { projectId: pid } }, {}, { root })
  check('overview 是平铺对象（不包一层）', ov?.project?.id === pid, ov?.project?.id)
  check('overview 有 stats', !!ov?.stats, Object.keys(ov?.stats ?? {}).join(','))
  eq('stats.chapters = 2', Number(ov?.stats?.chapters), 2)
  check('stats.totalWords > 0', Number(ov?.stats?.totalWords) > 0, ov?.stats?.totalWords)
  eq('stats.pending = 2（两章待验收）', Number(ov?.stats?.pending), 2)
  eq('stats.accepted = 0', Number(ov?.stats?.accepted), 0)
  eq('stats.targetWords 透传', Number(ov?.stats?.targetWords), 2500)
  check('stats 有 writeToday', typeof ov?.stats?.writeToday === 'number', ov?.stats?.writeToday)
  check('stats 有 streak', typeof ov?.stats?.streak === 'number', ov?.stats?.streak)
  check('stats 有 avgScore', typeof ov?.stats?.avgScore === 'number', ov?.stats?.avgScore)

  check('debts 是数组', Array.isArray(ov?.debts), typeof ov?.debts)
  check('debts 每项有 level/kind/title/sub/target',
    ov.debts.every((d) => d.level && d.kind && d.title && 'sub' in d && d.target), JSON.stringify(ov.debts)?.slice(0, 120))
  check('debts.level 只用 red/orange/yellow', ov.debts.every((d) => ['red', 'orange', 'yellow'].includes(d.level)),
    ov.debts.map((d) => d.level).join(',') || '(空)')
  check('debts.target.page 是合法页名',
    ov.debts.every((d) => ['cockpit', 'studio', 'review', 'world', 'scout', 'settings'].includes(d.target.page)),
    ov.debts.map((d) => d.target.page).join(',') || '(空)')

  check('有 suggestion 文本', typeof ov?.suggestion === 'string' && ov.suggestion.length > 0, ov?.suggestion)
  check('recent 最多 6 条', Array.isArray(ov?.recent) && ov.recent.length <= 6, ov?.recent?.length)
  check('recent 是倒序（第 2 回在前）', ov.recent[0]?.chapter === 2, ov.recent[0]?.chapter)
  check('worldCounts 是对象', !!ov?.worldCounts && typeof ov.worldCounts === 'object', JSON.stringify(ov?.worldCounts))
  check('worldCounts 8 栏都有', LEDGER_KINDS.every((k) => typeof ov.worldCounts[k] === 'number'), Object.keys(ov?.worldCounts ?? {}).join(','))
  eq('worldCounts.characters = 1', ov.worldCounts.characters, 1)
  eq('worldCounts.foreshadow = 1', ov.worldCounts.foreshadow, 1)
  check('unclosedForeshadow 是数字', typeof ov?.unclosedForeshadow === 'number', ov?.unclosedForeshadow)

  // ══ 9. review.action ═════════════════════════════════════
  console.log('\n— 9. 验收动作（review.action）')
  const ac = await handleRpc({ op: 'review.action', payload: { projectId: pid, action: 'accept', chapter: 1, worldState: '火器局初立' } }, {}, { root })
  check('accept 回 meta', ac?.meta?.status === 'accepted', ac?.meta?.status)
  check('accept 记了 acceptedAt', typeof ac?.meta?.acceptedAt === 'string', ac?.meta?.acceptedAt)
  const afterAccept = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 1 } }, {}, { root })
  check('落盘后状态是 accepted', afterAccept?.meta?.status === 'accepted', afterAccept?.meta?.status)
  const projAfterAccept = await handleRpc({ op: 'project.get', payload: { projectId: pid } }, {}, { root })
  check('accept 顺手写世界状态', projAfterAccept?.project?.worldState?.text === '火器局初立', JSON.stringify(projAfterAccept?.project?.worldState))
  check('世界状态记了来源章号', Number(projAfterAccept?.project?.worldState?.fromChapter) === 1, projAfterAccept?.project?.worldState?.fromChapter)

  const rj = await handleRpc({ op: 'review.action', payload: { projectId: pid, action: 'reject', chapter: 2 } }, {}, { root })
  check('reject 回 rejected', rj?.meta?.status === 'rejected', rj?.meta?.status)

  const rr = await handleRpc({ op: 'review.action', payload: { projectId: pid, action: 'rerun', chapter: 2, intent: '重写' } }, {}, { root })
  check('rerun 状态变 queued', rr?.meta?.status === 'queued', rr?.meta?.status)
  check('rerun 记了 rerunCount', Number(rr?.meta?.rerunCount) === 1, rr?.meta?.rerunCount)
  const qAfterRerun = (await handleRpc({ op: 'queue.list', payload: { projectId: pid } }, {}, { root })).items
  check('rerun 自动重新入队', qAfterRerun.length === 1, qAfterRerun.length)
  check('入队项带章号 2', qAfterRerun[0]?.chapter === 2, qAfterRerun[0]?.chapter)

  const mn = await handleRpc({ op: 'review.action', payload: { projectId: pid, action: 'manual', chapter: 2 } }, {}, { root })
  check('manual 状态变 manual', mn?.meta?.status === 'manual', mn?.meta?.status)

  await expectThrow('未知 action 被拒', () => handleRpc({ op: 'review.action', payload: { projectId: pid, action: '砸了', chapter: 1 } }, {}, { root }), /未知验收动作|invalid/i)

  // ══ 10. 边界与异常 ═══════════════════════════════════════
  console.log('\n— 10. 边界与异常')
  await expectThrow('未知 op 被拒', () => handleRpc({ op: '不存在的操作' }, {}, { root }), /未知 op|invalid/i)
  await expectThrow('空 op 被拒', () => handleRpc({}, {}, { root }), /未知 op|invalid/i)
  await expectThrow('缺 projectId 被拒', () => handleRpc({ op: 'overview', payload: {} }, {}, { root }), /projectId|invalid/i)
  await expectThrow('取不存在的作品被拒', () => handleRpc({ op: 'overview', payload: { projectId: 'nope' } }, {}, { root }), /找不到|missing/i)
  await expectThrow('chapter.save 缺 text 被拒', () => handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 5 } }, {}, { root }), /text|invalid/i)

  // ══ 11. guard 分支 ═══════════════════════════════════════
  console.log('\n— 11. guard（来源校验）')
  eq('回环 localhost 放行', guard({ headers: { host: 'localhost:49980' } }), undefined)
  eq('回环 127.0.0.1 放行', guard({ headers: { host: '127.0.0.1:8080' } }), undefined)
  eq('回环 [::1] 放行', guard({ headers: { host: '[::1]:8080' } }), undefined)
  eq('外网域名 403', guard({ headers: { host: 'evil.example.com' } }), 403)
  eq('无 host 头 403', guard({ headers: {} }), 403)

  const connAllow = { requestRejection: () => undefined }
  eq('connection 放行优先于回环判定', guard({ headers: { host: 'evil.example.com' } }, connAllow), undefined)

  const connDeny401 = { requestRejection: () => 401 }
  eq('connection 返回 401 就地生效', guard({ headers: { host: 'localhost' } }, connDeny401), 401)

  const connDenyTrue = { requestRejection: () => true }
  eq('connection 返回非数字 → 403 兜底', guard({ headers: { host: 'localhost' } }, connDenyTrue), 403)

  const connBoom = { requestRejection: () => { throw new Error('boom') } }
  eq('connection 抛错 → 回落到回环（localhost 放行）', guard({ headers: { host: 'localhost' } }, connBoom), undefined)
  eq('connection 抛错 → 外网仍 403', guard({ headers: { host: 'evil.example.com' } }, connBoom), 403)

  // ══ 12. 真 HTTP 服务 ═════════════════════════════════════
  console.log('\n— 12. 真 HTTP（createHandler + fetch）')
  const handler = createHandler({}, { root })
  const server = http.createServer((req, res) => { handler(req, res) })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  const base = `http://127.0.0.1:${port}${ROUTE}`
  console.log(`   起在 http://127.0.0.1:${port}${ROUTE}`)

  const rPing = await fetch(`${base}/ping`)
  eq('GET /ping 200', rPing.status, 200)
  const jPing = await rPing.json()
  check('GET /ping 返回 ok:true', jPing?.ok === true, JSON.stringify(jPing))
  check('GET /ping value 里有 name', jPing?.value?.name === 'nightwrite', JSON.stringify(jPing?.value))

  const rList = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'project.list' }),
  })
  eq('POST project.list 200', rList.status, 200)
  const jList = await rList.json()
  check('POST 返回 {ok:true, value}', jList?.ok === true && !!jList?.value, JSON.stringify(jList)?.slice(0, 60))
  eq('HTTP 读到的作品数 = 1', jList.value.projects.length, 1)
  eq('HTTP 读到章节数 = 2', jList.value.projects[0].chapters, 2)

  const rOv = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'overview', payload: { projectId: pid } }),
  })
  const jOv = await rOv.json()
  eq('HTTP overview 与进程内一致（chapters=2）', jOv?.value?.stats?.chapters, 2)

  const rGet = await fetch(`${base}?x=1`, { method: 'GET' })
  eq('GET 非 /ping → 405', rGet.status, 405)

  const rForm = await fetch(base, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'op=ping' })
  eq('非 JSON content-type → 415', rForm.status, 415)

  const rBadJson = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' })
  eq('坏 JSON → 400', rBadJson.status, 400)
  const jBad = await rBadJson.json()
  check('坏 JSON 带 ok:false + error.code', jBad?.ok === false && !!jBad?.error?.code, JSON.stringify(jBad))

  const rUnknown = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: '没有这个op' }),
  })
  eq('未知 op → 400', rUnknown.status, 400)
  check('未知 op 的 ok:false', (await rUnknown.json())?.ok === false)

  const rMissing = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'chapter.get', payload: { projectId: 'nope', chapter: 1 } }),
  })
  eq('取不存在作品的章节 → 404', rMissing.status, 404)

  const rNoPid = await fetch(base, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ op: 'overview', payload: {} }),
  })
  eq('缺 projectId → 400', rNoPid.status, 400)

  const bigBody = JSON.stringify({ op: 'chapter.save', payload: { projectId: pid, chapter: 9, text: 'x'.repeat(9 * 1024 * 1024) } })
  const rBig = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: bigBody })
  eq('超 8MB → 413', rBig.status, 413)

  const rArray = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '[1,2,3]' })
  eq('顶层数组请求体 → 400', rArray.status, 400)

  const rEmpty = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '' })
  eq('空请求体 → 400（缺 op）', rEmpty.status, 400)

  // 跨源：没有 connection 时，Host 头非回环要 403。
  // fetch 不允许覆盖 Host，这里用裸 socket 手发请求，才能真的伪造 Host 头。
  const rawStatus = await new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => {
      const body = JSON.stringify({ op: 'ping' })
      socket.write(
        'POST /nightwrite/api HTTP/1.1\r\n'
        + 'Host: evil.example.com\r\n'
        + 'Content-Type: application/json\r\n'
        + `Content-Length: ${Buffer.byteLength(body)}\r\n`
        + 'Connection: close\r\n\r\n'
        + body,
      )
    })
    let buf = ''
    socket.on('data', (chunk) => { buf += chunk.toString('utf8') })
    socket.on('end', () => resolve(buf.split('\r\n')[0]))
    socket.on('error', reject)
  })
  check('伪造外网 Host 头 → 403', rawStatus.includes('403'), rawStatus)

  await new Promise((resolve) => server.close(resolve))
  console.log('   服务已关闭')

  // ══ 13. nightwrite_op 工具 ══════════════════════════════════
  console.log('\n— 13. nightwrite_op 工具（agent 侧入口）')
  const tool = createTool(root)
  eq('工具名对得上', tool.name, TOOL_NAME)
  check('工具有描述且提到长夜', typeof tool.description === 'string' && tool.description.includes('长夜'), String(tool.description).slice(0, 30))
  check('工具描述列出全部 op', RPC_OPS.every((op) => tool.description.includes(op)), '描述里少了 op')
  check('工具声明 op 必填', tool.parameters?.op?.required === true)
  check('工具声明 payload 是对象', tool.parameters?.payload?.type === 'object')

  const tList = await tool.execute({ op: 'project.list' })
  eq('工具读到同一份作品', tList.projects.length, 1)

  const tRead = await tool.execute({ op: 'chapter.get', payload: { projectId: pid, chapter: 1 } })
  check('工具读得到 UI 写的正文', String(tRead?.text ?? '').includes('城头夜雨'), String(tRead?.text ?? '').slice(0, 20))

  await tool.execute({ op: 'chapter.save', payload: { projectId: pid, chapter: 7, text: '第七回 名册\n\n名册第七行，朱重八看了很久。' } })
  const uiSees = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 7 } }, {}, { root })
  check('工具写的章节 UI 立刻读得到', String(uiSees?.text ?? '').includes('第七行'), String(uiSees?.text ?? '').slice(0, 20))
  check('工具写的新章也进待验收', uiSees?.meta?.status === 'review', uiSees?.meta?.status)

  const tOv = await tool.execute({ op: 'overview', payload: { projectId: pid } })
  eq('工具取 overview 章节数 = 3', Number(tOv?.stats?.chapters), 3)

  await tool.execute({ op: 'ledger.upsert', payload: { projectId: pid, kind: 'locations', row: { name: '应天府' } } })
  const ledAfterTool = (await handleRpc({ op: 'ledger.get', payload: { projectId: pid } }, {}, { root })).ledger
  check('工具写账本 UI 读得到', ledAfterTool.locations.some((r) => r.name === '应天府'), JSON.stringify(ledAfterTool.locations))

  await expectThrow('工具调用缺 op 被拒', () => tool.execute({}), /未知 op|invalid/i)

  // ══ 14. 落盘格式（数据可迁移） ═══════════════════════════
  console.log('\n— 14. 落盘格式')
  const dir = await store.projectDir(root, pid)
  const projFile = JSON.parse(await readFile(join(dir, 'project.json'), 'utf8'))
  check('project.json 是合法 JSON', typeof projFile === 'object', typeof projFile)
  check('project.json 带书名', projFile?.name === '元末女帝（改）', projFile?.name)
  check('project.json 带世界状态', projFile?.worldState?.text === '火器局初立', JSON.stringify(projFile?.worldState))

  const chFile = await readFile(join(dir, 'chapters', '0001.txt'), 'utf8')
  check('章节是纯文本 0001.txt', chFile.includes('城头夜雨'), chFile.slice(0, 30))
  check('章节首行是标题行', chFile.split('\n')[0].startsWith('第一回'), chFile.split('\n')[0])

  const metaFile = JSON.parse(await readFile(join(dir, 'chapters', '0001.meta.json'), 'utf8'))
  check('章节 meta 独立落盘', metaFile?.status === 'accepted', metaFile?.status)

  const ledgerFile = JSON.parse(await readFile(join(dir, 'ledger.json'), 'utf8'))
  check('ledger.json 是合法 JSON', typeof ledgerFile === 'object')
  check('ledger.json 有 8 栏', LEDGER_KINDS.every((k) => Array.isArray(ledgerFile[k])), Object.keys(ledgerFile).join(','))

  const libIndex = JSON.parse(await readFile(join(root, 'library.json'), 'utf8'))
  check('根目录 library.json 有索引', Array.isArray(libIndex?.projects) && libIndex.projects.length === 1, JSON.stringify(libIndex)?.slice(0, 80))

  // ══ 17. 大纲：老板给方案 → 出大纲 ═════════════════════════
  console.log('\n— 17. 大纲（brief → 骨架）')
  const o0 = (await handleRpc({ op: 'outline.get', payload: { projectId: pid } }, {}, { root })).outline
  eq('空大纲 schemaVersion', o0.schemaVersion, '0.1.0')
  eq('空大纲 brief.volumes 默认 3', o0.brief.volumes, 3)
  eq('空大纲 chaptersPerVolume 默认 20', o0.brief.chaptersPerVolume, 20)
  eq('空大纲 volumes 为空', o0.volumes.length, 0)

  const savedBrief = (await handleRpc({
    op: 'outline.save',
    payload: {
      projectId: pid,
      outline: {
        brief: {
          premise: '元末，女主带着系统穿到朱元璋身边，要从他手里抢下天下。',
          genre: '历史穿越 / 女帝',
          protagonist: '林晚',
          goal: '在朱元璋称帝前重建秩序',
          conflict: '系统只给三年',
          hook: '第一回城头夜雨',
          volumes: 2,
          chaptersPerVolume: 3,
        },
      },
    },
  }, {}, { root })).outline
  check('brief.premise 落盘', savedBrief.brief.premise.includes('元末'), savedBrief.brief.premise.slice(0, 12))
  eq('brief.volumes = 2', savedBrief.brief.volumes, 2)
  check('save 之后 volumes 仍是空', savedBrief.volumes.length === 0)

  const gen = (await handleRpc({ op: 'outline.generate', payload: { projectId: pid } }, {}, { root })).outline
  eq('生成 2 卷', gen.volumes.length, 2)
  eq('每卷 3 章 → 总 6 章', gen.volumes.reduce((n, v) => n + v.chapters.length, 0), 6)
  eq('第一卷 from=1', gen.volumes[0].from, 1)
  eq('第一卷 to=3', gen.volumes[0].to, 3)
  eq('第二卷 from=4', gen.volumes[1].from, 4)
  eq('第一卷标题兜底', gen.volumes[0].title, '第1卷')
  check('gen.updatedAt 非空', Boolean(gen.updatedAt))

  // 已落盘的第 1 章（review）、第 7 章不在骨架范围内 → 第 1 章应标 drafted
  check('已落盘章节不标 todo', gen.volumes[0].chapters[0].status !== 'todo', gen.volumes[0].chapters[0].status)
  eq('未落盘章节标 todo', gen.volumes[0].chapters[2].status, 'todo')

  // 手填一次标题，重生成要保住
  const edited = JSON.parse(JSON.stringify(gen))
  edited.volumes[0].chapters[0].title = '城头夜雨'
  edited.volumes[0].chapters[0].summary = '林晚在濠州城头第一次见到朱重八。'
  edited.volumes[0].chapters[0].hook = '系统面板亮了'
  await handleRpc({ op: 'outline.save', payload: { projectId: pid, outline: edited } }, {}, { root })
  const regen = (await handleRpc({ op: 'outline.generate', payload: { projectId: pid } }, {}, { root })).outline
  eq('重生成保住手填标题', regen.volumes[0].chapters[0].title, '城头夜雨')
  check('重生成保住摘要', regen.volumes[0].chapters[0].summary.includes('濠州'))
  check('重生成保住钩子', regen.volumes[0].chapters[0].hook === '系统面板亮了')

  const intent = (await handleRpc({ op: 'outline.intent', payload: { projectId: pid, chapter: 1 } }, {}, { root })).intent
  check('intent 含摘要', intent.includes('濠州'), intent)
  check('intent 含钩子', intent.includes('本章末钩子'), intent)
  check('intent 含本卷目标或为空', typeof intent === 'string')
  const intentNone = (await handleRpc({ op: 'outline.intent', payload: { projectId: pid, chapter: 99 } }, {}, { root })).intent
  eq('越界章号 intent 是空串', intentNone, '')
  await expectThrow('outline.get 缺 projectId 被拒', () => handleRpc({ op: 'outline.get', payload: {} }, {}, { root }), /projectId/i)

  // ══ 18. 提案：before / after 必须真的写回正文 ═════════════
  console.log('\n— 18. 提案（采纳写回正文）')
  await handleRpc({
    op: 'chapter.save',
    payload: {
      projectId: pid,
      chapter: 11,
      text: '第十一回 名册\n\n雨落了三天。城头的火把熄了两回，守卒换班时踩进泥里，骂了一声又咽回去。\n\n朱重八看了很久，把名册合上。',
    },
  }, {}, { root })

  const pr1 = await handleRpc({
    op: 'proposal.save',
    payload: {
      projectId: pid,
      proposal: {
        id: 'pr_fix1',
        chapter: 11,
        kind: 'patch',
        title: '把「看了很久」改成具体动作',
        diffs: [
          { before: '朱重八看了很久，把名册合上。', after: '朱重八用指节压住名册边角，翻了三遍，才合上。', why: '抽象 → 具体' },
        ],
      },
    },
  }, {}, { root })
  eq('提案落盘 id', pr1.proposal.id, 'pr_fix1')
  eq('提案默认 pending', pr1.proposal.status, 'pending')
  eq('提案有 1 条 diff', pr1.proposal.diffs.length, 1)

  const pl = (await handleRpc({ op: 'proposal.list', payload: { projectId: pid } }, {}, { root })).items
  eq('proposal.list 1 条', pl.length, 1)

  const acc = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_fix1', action: 'accept' } }, {}, { root })
  eq('采纳 applied = 1', acc.applied, 1)
  eq('采纳之后 missed 空', acc.missed.length, 0)
  eq('采纳之后状态 accepted', acc.proposal.status, 'accepted')
  const chAfter = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 11 } }, {}, { root })
  check('正文真的被改（旧句没了）', !String(chAfter.text).includes('看了很久，把名册合上'), String(chAfter.text).slice(-30))
  check('正文真的被改（新句写进去了）', String(chAfter.text).includes('用指节压住名册边角'), String(chAfter.text).slice(-40))
  check('采纳之后 meta 变回 review', chAfter.meta?.status === 'review', chAfter.meta?.status)

  // 对不上的 patch 必须整体拒，不能写半截
  const pr2 = await handleRpc({
    op: 'proposal.save',
    payload: {
      projectId: pid,
      proposal: {
        id: 'pr_bad', chapter: 11, kind: 'patch', diffs: [{ before: '这句话正文里根本没有', after: 'X' }],
      },
    },
  }, {}, { root })
  eq('坏提案也能落盘', pr2.proposal.id, 'pr_bad')
  const beforeBad = String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 11 } }, {}, { root })).text)
  // 地址系统上来之后，一条都对不上不再抛错：提案被打成 outdated，正文一字不动。
  // 抛错会让界面只看到一个红条，作者不知道该重出提案；标 outdated 才是真话。
  const badAcc = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_bad', action: 'accept' } }, {}, { root })
  eq('一条都对不上 → 采不回任何改动', badAcc.applied, 0)
  check('一条都对不上 → 标成 outdated', badAcc.outdated === true && badAcc.proposal.status === 'outdated', JSON.stringify(badAcc.proposal.status))
  eq('一条都对不上 → missed 有内容', badAcc.missed.length, 1)
  const afterBad = String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 11 } }, {}, { root })).text)
  eq('被拒之后正文一字未变', afterBad, beforeBad)

  const rej = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_bad', action: 'reject' } }, {}, { root })
  eq('reject 之后状态 rejected', rej.proposal.status, 'rejected')

  const pr3 = await handleRpc({
    op: 'proposal.save',
    payload: { projectId: pid, proposal: { id: 'pr_rw', chapter: 11, kind: 'rewrite', diffs: [{ after: '第十一回 名册（整章重写）\n\n全换了。' }] } },
  }, {}, { root })
  eq('整章重写提案 kind', pr3.proposal.kind, 'rewrite')
  const accRw = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_rw', action: 'accept' } }, {}, { root })
  eq('rewrite 采纳 applied=1', accRw.applied, 1)
  const rwText = String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 11 } }, {}, { root })).text)
  check('rewrite 真的整章替换', rwText.includes('全换了') && !rwText.includes('城头的火把'), rwText.slice(0, 30))

  await expectThrow('未知提案动作被拒', () => handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_fix1', action: 'merge' } }, {}, { root }), /accept \/ reject/)
  await expectThrow('采纳不存在的提案被拒', () => handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_none', action: 'accept' } }, {}, { root }), /没有提案/)
  await expectThrow('提案没有 diffs 被拒', () => handleRpc({ op: 'proposal.save', payload: { projectId: pid, proposal: { chapter: 11, diffs: [] } } }, {}, { root }), /before \/ after/)
  await expectThrow('提案缺章号被拒', () => handleRpc({ op: 'proposal.save', payload: { projectId: pid, proposal: { diffs: [{ before: 'a', after: 'b' }] } } }, {}, { root }), /章号/)
  const rmPr = await handleRpc({ op: 'proposal.remove', payload: { projectId: pid, id: 'pr_bad' } }, {}, { root })
  eq('删提案 removed', rmPr.removed, 'pr_bad')
  check('删完 pr_bad 不在列表', !rmPr.items.some((r) => r.id === 'pr_bad'))

  // ══ 19. 问题单：能开能关 ═════════════════════════════════
  console.log('\n— 19. 问题单（闭环）')
  const pb1 = await handleRpc({
    op: 'problem.save',
    payload: { projectId: pid, problem: { id: 'pb_1', chapter: 11, type: 'ai-style', severity: 'major', text: '「仿佛」用了三次', quote: '仿佛一切都是' } },
  }, {}, { root })
  eq('问题落盘 id', pb1.problem.id, 'pb_1')
  eq('问题默认 open', pb1.problem.status, 'open')
  eq('问题 type 落盘', pb1.problem.type, 'ai-style')

  const pbBad = await handleRpc({ op: 'problem.save', payload: { projectId: pid, problem: { id: 'pb_x', chapter: 11, type: 'nonsense', severity: 'z', text: '兜底' } } }, {}, { root })
  eq('乱填 type 兜底 other', pbBad.problem.type, 'other')
  eq('乱填 severity 兜底 minor', pbBad.problem.severity, 'minor')

  await expectThrow('问题没有说明文字被拒', () => handleRpc({ op: 'problem.save', payload: { projectId: pid, problem: { chapter: 11, text: '  ' } } }, {}, { root }), /说明文字/)
  await expectThrow('问题缺章号被拒', () => handleRpc({ op: 'problem.save', payload: { projectId: pid, problem: { text: 'x' } } }, {}, { root }), /章号/)

  const fixed = await handleRpc({ op: 'problem.resolve', payload: { projectId: pid, id: 'pb_1', status: 'fixed' } }, {}, { root })
  eq('改状态 fixed', fixed.problem.status, 'fixed')
  check('fixed 带 resolvedAt', Boolean(fixed.problem.resolvedAt))
  const reopened = await handleRpc({ op: 'problem.resolve', payload: { projectId: pid, id: 'pb_1', status: 'open' } }, {}, { root })
  eq('打回 open 清空 resolvedAt', reopened.problem.resolvedAt, '')
  await expectThrow('未知问题状态被拒', () => handleRpc({ op: 'problem.resolve', payload: { projectId: pid, id: 'pb_1', status: 'zzz' } }, {}, { root }), /未知问题状态/)
  await expectThrow('resolve 不存在的问题被拒', () => handleRpc({ op: 'problem.resolve', payload: { projectId: pid, id: 'pb_none', status: 'fixed' } }, {}, { root }), /没有问题/)

  const pbList = (await handleRpc({ op: 'problem.list', payload: { projectId: pid } }, {}, { root })).items
  eq('problem.list 2 条', pbList.length, 2)
  const rmPb = await handleRpc({ op: 'problem.remove', payload: { projectId: pid, id: 'pb_x' } }, {}, { root })
  eq('删问题 removed', rmPb.removed, 'pb_x')
  eq('删完剩 1 条', rmPb.items.length, 1)

  // 新数据层也要走 agent 工具
  const tOutline = await tool.execute({ op: 'outline.get', payload: { projectId: pid } })
  eq('工具读得到大纲', tOutline.outline.volumes.length, 2)
  const tPb = await tool.execute({ op: 'problem.list', payload: { projectId: pid } })
  eq('工具读得到问题单', tPb.items.length, 1)
  await tool.execute({ op: 'proposal.save', payload: { projectId: pid, proposal: { id: 'pr_tool', chapter: 11, diffs: [{ before: '全换了', after: '全改了' }] } } })
  const accTool = await tool.execute({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_tool', action: 'accept' } })
  eq('工具采纳提案 applied=1', accTool.applied, 1)
  check('工具采纳后正文可见', String((await tool.execute({ op: 'chapter.get', payload: { projectId: pid, chapter: 11 } })).text).includes('全改了'))

  // ══ 14.5 安全网：历史版本 / 回收站 / 搜索 / AI 味 / 提案预检 ══
  console.log('\n— 14.5 安全网（history / trash / search / aistyle / preview）')
  const safeText = '第二十一回 夜审\n\n空气仿佛凝固了。他眼底闪过一丝不忍，嘴角微微勾起。'
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 21, text: safeText } }, {}, { root })

  const h0 = await handleRpc({ op: 'chapter.history', payload: { projectId: pid, chapter: 21 } }, {}, { root })
  eq('首次写入没有历史版本', h0.versions.length, 0)
  check('history 回了 keep 上限', Number(h0.keep) > 0, h0.keep)

  // 覆盖一次 → 旧正文必须留底
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 21, text: `${safeText}\n\n他又补了一句。` } }, {}, { root })
  const h1 = await handleRpc({ op: 'chapter.history', payload: { projectId: pid, chapter: 21 } }, {}, { root })
  eq('覆盖一次留 1 版', h1.versions.length, 1)
  check('版本名带章号与时间戳', /^0021-\d{8}T\d{9}Z\.(txt|md)$/.test(h1.versions[0]?.name ?? ''), h1.versions[0]?.name)
  check('版本里有字数控', Number(h1.versions[0]?.words) > 0, h1.versions[0]?.words)
  check('history 回了当前字数', Number(h1.currentWords) > 0, h1.currentWords)

  const v1 = await handleRpc({ op: 'chapter.version', payload: { projectId: pid, chapter: 21, name: h1.versions[0].name } }, {}, { root })
  check('取回的旧版含原句', String(v1.text).includes('空气仿佛凝固'), String(v1.text).slice(0, 40))
  check('取回的旧版不含后补句', !String(v1.text).includes('又补了一句'), String(v1.text).slice(-20))
  await expectThrow('历史版本名必须匹配章号',
    () => handleRpc({ op: 'chapter.version', payload: { projectId: pid, chapter: 22, name: h1.versions[0].name } }, {}, { root }), /不合法|invalid/)
  await expectThrow('路径穿越被拒',
    () => handleRpc({ op: 'chapter.version', payload: { projectId: pid, chapter: 21, name: '../../ledger.json' } }, {}, { root }), /不合法|invalid/)

  await handleRpc({ op: 'chapter.restore', payload: { projectId: pid, chapter: 21, name: h1.versions[0].name } }, {}, { root })
  check('回滚后正文恢复旧版',
    String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 21 } }, {}, { root })).text).includes('空气仿佛凝固'))
  const h2 = await handleRpc({ op: 'chapter.history', payload: { projectId: pid, chapter: 21 } }, {}, { root })
  eq('回滚本身也留底（2 版）', h2.versions.length, 2)
  const back = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 21 } }, {}, { root })
  eq('meta 记了 restoredFrom', back.meta.restoredFrom, h1.versions[0].name)
  check('回滚让 rev 自增', Number(back.meta.rev) >= 2, back.meta.rev)

  // AI 味词表
  const ai = await handleRpc({ op: 'chapter.aistyle', payload: { projectId: pid, chapter: 21 } }, {}, { root })
  check('aistyle 扫出命中', ai.hits.length >= 2, ai.hits.map((x) => x.pattern).join(' / '))
  check('命中带段号与引文', ai.hits.every((x) => typeof x.para === 'number' && x.quote), JSON.stringify(ai.hits[0]))
  check('命中含「空气仿佛凝固」', ai.hits.some((x) => x.pattern === '空气仿佛凝固'), ai.hits.map((x) => x.pattern).join(','))
  check('aistyle 回密度', typeof ai.density === 'number', ai.density)
  const aiClean = await handleRpc({ op: 'chapter.aistyle', payload: { projectId: pid, chapter: 11 } }, {}, { root })
  eq('干净正文零命中', aiClean.hits.length, 0)

  // problem.save 自动挂 aiHits
  await handleRpc({ op: 'problem.save', payload: { projectId: pid, problem: { id: 'pb_ai', chapter: 21, text: '这句有 AI 味', quote: '空气仿佛凝固了' } } }, {}, { root })
  const pbAi = (await handleRpc({ op: 'problem.list', payload: { projectId: pid } }, {}, { root })).items.find((x) => x.id === 'pb_ai')
  eq('命中词表时自动标 ai-style', pbAi.type, 'ai-style')
  check('挂了 aiHits', Array.isArray(pbAi.aiHits) && pbAi.aiHits.length > 0, JSON.stringify(pbAi.aiHits))

  // 全文搜索
  const s1r = await handleRpc({ op: 'search', payload: { projectId: pid, q: '空气仿佛' } }, {}, { root })
  eq('search 找到第 21 回', s1r.hits[0]?.chapter, 21)
  check('search 命中带段号', typeof s1r.hits[0]?.para === 'number', s1r.hits[0]?.para)
  check('search 命中带引文', String(s1r.hits[0]?.quote ?? '').includes('空气仿佛'), s1r.hits[0]?.quote)
  eq('search 记了 scope', s1r.scope, 'all')
  const s3r = await handleRpc({ op: 'search', payload: { projectId: pid, q: '第', scope: 'chapters', limit: 1 } }, {}, { root })
  check('limit 生效并标记 truncated', s3r.hits.length === 1 && s3r.truncated, `${s3r.hits.length}/${s3r.total}`)
  const s4r = await handleRpc({ op: 'search', payload: { projectId: pid, q: '朱重八' } }, {}, { root })
  check('search 能命中正文里的名字', s4r.total >= 1, s4r.total)
  const s5r = await handleRpc({ op: 'search', payload: { projectId: pid, q: '   ' } }, {}, { root })
  eq('空关键词回空', s5r.hits.length, 0)

  // 提案预检：before 出现两次要标出来
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 22, text: '第二十二回 双影\n\n他抬头看天。他抬头看天。' } }, {}, { root })
  await handleRpc({ op: 'proposal.save', payload: { projectId: pid, proposal: { id: 'pr_amb', chapter: 22, kind: 'patch', diffs: [{ before: '他抬头看天。', after: '他低头看地。' }] } } }, {}, { root })
  const pv = await handleRpc({ op: 'proposal.preview', payload: { projectId: pid, id: 'pr_amb' } }, {}, { root })
  eq('preview 数出 2 处相同', pv.rows[0].count, 2)
  check('preview 标 ambiguous', pv.rows[0].ambiguous === true)
  check('preview ok=false', pv.ok === false, JSON.stringify({ a: pv.ambiguous, m: pv.missing }))
  const accAmb = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: 'pr_amb', action: 'accept' } }, {}, { root })
  eq('采纳仍成功 applied=1', accAmb.applied, 1)
  eq('采纳结果带回 ambiguous 警告', accAmb.ambiguous.length, 1)
  check('ambiguous 记了处数', accAmb.ambiguous[0].count === 2, JSON.stringify(accAmb.ambiguous[0]))
  await handleRpc({ op: 'proposal.save', payload: { projectId: pid, proposal: { id: 'pr_ok', chapter: 22, kind: 'patch', diffs: [{ before: '他低头看地。', after: '他抬头望月。' }] } } }, {}, { root })
  const pvOk = await handleRpc({ op: 'proposal.preview', payload: { projectId: pid, id: 'pr_ok' } }, {}, { root })
  check('唯一命中时 ok=true', pvOk.ok === true && pvOk.rows[0].count === 1, JSON.stringify(pvOk.rows[0]))
  await handleRpc({ op: 'proposal.remove', payload: { projectId: pid, id: 'pr_ok' } }, {}, { root })
  await handleRpc({ op: 'proposal.remove', payload: { projectId: pid, id: 'pr_amb' } }, {}, { root })

  // 回收站
  const delc = await handleRpc({ op: 'chapter.delete', payload: { projectId: pid, chapter: 22 } }, {}, { root })
  eq('delete 回删掉的章号', delc.deleted, 22)
  check('delete 回了回收站名', /^\d{8}T\d{9}Z$/.test(delc.trash ?? ''), delc.trash)
  check('delete 回了文件数', delc.files >= 2, delc.files)
  const gone = await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 22 } }, {}, { root })
  eq('删后正文为空', String(gone.text ?? ''), '')
  const tr = await handleRpc({ op: 'chapter.trash', payload: { projectId: pid } }, {}, { root })
  eq('回收站有 1 项', tr.items.length, 1)
  eq('回收站记了章号', tr.items[0].chapter, 22)
  check('回收站记了标题', String(tr.items[0].title ?? '').length > 0, tr.items[0].title)
  check('回收站记了字数', Number(tr.items[0].words) > 0, tr.items[0].words)
  await expectThrow('回收站名不合法被拒',
    () => handleRpc({ op: 'chapter.recover', payload: { projectId: pid, trash: '../../etc' } }, {}, { root }), /不合法|invalid/)

  const rc = await handleRpc({ op: 'chapter.recover', payload: { projectId: pid, trash: delc.trash } }, {}, { root })
  eq('还原回章号', rc.recovered, 22)
  check('还原后正文回来了',
    String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 22 } }, {}, { root })).text).includes('他低头看地'))
  eq('还原后回收站空了', (await handleRpc({ op: 'chapter.trash', payload: { projectId: pid } }, {}, { root })).items.length, 0)

  // 原位置已有同名文件时还原要报冲突，不能覆盖
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 23, text: '第二十三回 暂存\n\n先放一句。' } }, {}, { root })
  const del23 = await handleRpc({ op: 'chapter.delete', payload: { projectId: pid, chapter: 23 } }, {}, { root })
  await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 23, text: '第二十三回 新稿\n\n这是新写的。' } }, {}, { root })
  await expectThrow('原位置有稿时还原报冲突',
    () => handleRpc({ op: 'chapter.recover', payload: { projectId: pid, trash: del23.trash } }, {}, { root }), /已经有正文|conflict/)
  check('冲突时不覆盖现有稿',
    String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 23 } }, {}, { root })).text).includes('这是新写的'))
  const pg = await handleRpc({ op: 'chapter.purge', payload: { projectId: pid, trash: del23.trash } }, {}, { root })
  eq('purge 指定盒子', pg.purged, del23.trash)
  eq('purge 后回收站空', (await handleRpc({ op: 'chapter.trash', payload: { projectId: pid } }, {}, { root })).items.length, 0)

  // ── 插章 / 重排：章号就是文件名，插入必须把后面的章整体推后 ──
  const insBefore = (await handleRpc({ op: 'chapter.list', payload: { projectId: pid } }, {}, { root })).chapters
  const shiftTarget = insBefore[0].chapter
  const ins = await handleRpc({ op: 'chapter.insert', payload: { projectId: pid, at: 1, title: '第一回 楔子' } }, {}, { root })
  eq('插章落在指定位置', ins.chapter, 1)
  check('插章回了被推后的章数', Number(ins.shifted) >= 1, ins.shifted)
  const afterIns = (await handleRpc({ op: 'chapter.list', payload: { projectId: pid } }, {}, { root })).chapters
  check('原第一章被推到第 2 位', afterIns.some((row) => row.chapter === 2), afterIns.map((r) => r.chapter).join(','))
  check('插出来的第 1 回是空的',
    String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: 1 } }, {}, { root })).text).includes('楔子'))
  check('原来写在 shiftTarget 的正文还在，只是换了号',
    String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid, chapter: shiftTarget + 1 } }, {}, { root })).text).length > 4,
    `原第 ${shiftTarget} 回 → 第 ${shiftTarget + 1} 回`)
  await expectThrow('插章位置不合法被拒',
    () => handleRpc({ op: 'chapter.insert', payload: { projectId: pid, at: 0 } }, {}, { root }), /正整数|invalid/)
  const moved = await handleRpc({ op: 'chapter.move', payload: { projectId: pid, from: 2, to: 4 } }, {}, { root })
  check('move 仍可用', Number(moved.changed) >= 1, JSON.stringify(moved))

  // writeToday / dailyWords 按本地日期聚合
  const ov2 = await handleRpc({ op: 'overview', payload: { projectId: pid } }, {}, { root })
  check('writeToday 是数字', typeof ov2.stats.writeToday === 'number', ov2.stats.writeToday)
  check('writeToday > 0（今天写过）', ov2.stats.writeToday > 0, ov2.stats.writeToday)
  check('dailyWords 是 14 天', Array.isArray(ov2.stats.dailyWords) && ov2.stats.dailyWords.length === 14, ov2.stats.dailyWords?.length)
  check('dailyWords 每项有 day/words',
    ov2.stats.dailyWords.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && typeof d.words === 'number'),
    JSON.stringify(ov2.stats.dailyWords?.[0]))
  check('dailyWords 最后一天是今天且等于 writeToday',
    ov2.stats.dailyWords[13].words === ov2.stats.writeToday, `${ov2.stats.dailyWords[13].words} vs ${ov2.stats.writeToday}`)
  check('dailyWords 合计等于总字数',
    ov2.stats.dailyWords.reduce((s, d) => s + d.words, 0) === ov2.stats.totalWords,
    `${ov2.stats.dailyWords.reduce((s, d) => s + d.words, 0)} vs ${ov2.stats.totalWords}`)

  // 字数缓存：listChapters 不读全文也能给字数
  const lc2 = await handleRpc({ op: 'chapter.list', payload: { projectId: pid } }, {}, { root })
  check('列表项仍带 rev', lc2.chapters.every((c) => typeof c.rev === 'number'), JSON.stringify(lc2.chapters[0]))
  check('列表项字数都大于 0', lc2.chapters.every((c) => c.words > 0), lc2.chapters.map((c) => c.words).join(','))

  // ══ 17. 岗位 / 派单 / 回执 ═══════════════════════════════
  console.log('\n— 17. 岗位 / 派单 / 回执')
  const rolesRes = await handleRpc({ op: 'role.list' }, {}, { root })
  check('role.list 给 11 个岗位', rolesRes.items.length === 11, String(rolesRes.items.length))
  check('role.list 每项带 label/duty/gate', rolesRes.items.every((r) => r.label && r.duty && r.gate))
  check('只有总编能派单', rolesRes.items.filter((r) => r.canDispatch).map((r) => r.id).join() === 'nightwrite-coordinator')
  check('role.list 不带文件路径', rolesRes.items.every((r) => !('path' in r) && !('file' in r)))

  const dpEmpty = await handleRpc({ op: 'dispatch.list', payload: { projectId: pid } }, {}, { root })
  eq('派单列表初始为空', dpEmpty.items.length, 0)

  await expectThrow('派单缺 role 被拒', () => handleRpc({ op: 'dispatch.issue', payload: { projectId: pid, task: '写第三章' } }, {}, { root }), /岗位|invalid-role|没有这个岗位/i)
  await expectThrow('派单写错 role 被拒', () => handleRpc({ op: 'dispatch.issue', payload: { projectId: pid, role: 'nobody', task: 'x' } }, {}, { root }), /没有这个岗位/i)
  await expectThrow('派单缺 task 被拒', () => handleRpc({ op: 'dispatch.issue', payload: { projectId: pid, role: 'nightwrite-story-architect' } }, {}, { root }), /task|做什么/i)

  const dp1 = await handleRpc({ op: 'dispatch.issue', payload: { projectId: pid, role: 'nightwrite-story-architect', task: '排第三回细纲', chapter: 3, materials: '前两回正文见章节列表' } }, {}, { root })
  check('派单回票据 id', /^dp_[0-9a-f]{12}$/.test(String(dp1?.id ?? '')), String(dp1?.id))
  eq('派单初始状态 issued', dp1.status, 'issued')
  eq('派单带岗位中文名', dp1.roleLabel, '故事架构师')
  eq('派单章号落库', Number(dp1.chapter), 3)
  check('派单有 60 分钟有效期', String(dp1.expiresAt) > String(dp1.createdAt))

  const dpList = await handleRpc({ op: 'dispatch.list', payload: { projectId: pid } }, {}, { root })
  eq('派单列表 1 条', dpList.items.length, 1)
  const dpListRole = await handleRpc({ op: 'dispatch.list', payload: { projectId: pid, role: 'nightwrite-coordinator' } }, {}, { root })
  eq('按岗过滤能滤空', dpListRole.items.length, 0)

  const dpGot = await handleRpc({ op: 'dispatch.get', payload: { projectId: pid, id: dp1.id } }, {}, { root })
  eq('按 id 取回票', dpGot.id, dp1.id)
  await expectThrow('取不存在的票报 missing', () => handleRpc({ op: 'dispatch.get', payload: { projectId: pid, id: 'dp_ffffffffffff' } }, {}, { root }), /没有这张派单票|missing/i)

  const dry = await handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: dp1.id, dryRun: true } }, {}, { root })
  check('dryRun 回任务书', typeof dry?.prompt === 'string' && dry.prompt.length > 200, String(dry?.prompt?.length))
  check('任务书给手册绝对路径', /agents[\\/]nightwrite-story-architect\.md/.test(dry.prompt), dry.prompt.slice(0, 200))
  check('任务书先讲边界', dry.prompt.indexOf('## 边界') < dry.prompt.indexOf('## 本单要你做的事'))
  check('任务书带票据号', dry.prompt.includes(dp1.id))
  check('任务书给 skill 清单', dry.prompt.includes('nightwrite-plan-novel'))
  check('任务书列回执四段', ['### 结论', '### 依据', '### 要别人做的事', '### 风险'].every((x) => dry.prompt.includes(x)))
  check('非总编的任务书不授权派单', !/允许你调用 subagent/.test(dry.prompt))
  const co = await handleRpc({ op: 'dispatch.issue', payload: { projectId: pid, role: 'nightwrite-coordinator', task: '决定第三回能不能发' } }, {}, { root })
  const coDry = await handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: co.id, dryRun: true } }, {}, { root })
  check('总编任务书才给派单权', /允许你调用 subagent/.test(coDry.prompt))
  eq('dryRun 不改票状态', coDry.ticket.status, 'issued')

  await expectThrow('无会话服务时投递被拒', () => handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: dp1.id } }, {}, { root }), /sessionController|会话服务/i)
  const afterFail = await handleRpc({ op: 'dispatch.get', payload: { projectId: pid, id: dp1.id } }, {}, { root })
  check('投递失败记在票上', String(afterFail.lastError).includes('sessionController'), String(afterFail.lastError))
  eq('投递失败不改状态', afterFail.status, 'issued')

  await expectThrow('回执正文不能空', () => handleRpc({ op: 'report.submit', payload: { projectId: pid, id: dp1.id, text: '   ' } }, {}, { root }), /回执|不能空/i)

  const reportText = [
    '### 结论',
    '不通过，第三回细纲缺章末钩子。',
    '### 依据',
    '细纲第 12 行「他离开了」没有留下未解问题。',
    '### 要别人做的事',
    '交给 nightwrite-chapter-writer：等钩子补齐再动笔。',
    '### 风险',
    '照现在写，章末会掉人。',
  ].join('\n')
  const submitted = await handleRpc({ op: 'report.submit', payload: { projectId: pid, id: dp1.id, text: reportText } }, {}, { root })
  eq('回执后票变 submitted', submitted.status, 'submitted')
  check('回执按 ### 切段', submitted.report.sections.length === 4, JSON.stringify(submitted.report.sections.map((x) => x.title)))
  eq('回执第一段标题', submitted.report.sections[0].title, '结论')
  check('回执提取结论句', String(submitted.report.verdict).startsWith('不通过'), submitted.report.verdict)

  const repList = await handleRpc({ op: 'report.list', payload: { projectId: pid } }, {}, { root })
  eq('回执列表 1 条', repList.items.length, 1)
  check('回执挂在票上', repList.items[0].id === dp1.id && !!repList.items[0].report)

  await expectThrow('已交回执的票不能再交', () => handleRpc({ op: 'report.submit', payload: { projectId: pid, id: dp1.id, text: '### 结论\n又一份' } }, {}, { root }), /已经交过|submitted|作废/i)
  await expectThrow('已交回执的票不能再投递', () => handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: dp1.id, dryRun: true } }, {}, { root }), /已经交过回执|submitted/i)

  const revoked = await handleRpc({ op: 'dispatch.revoke', payload: { projectId: pid, id: co.id } }, {}, { root })
  eq('作废后状态 revoked', revoked.status, 'revoked')
  await expectThrow('已作废的票不能投递', () => handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: co.id, dryRun: true } }, {}, { root }), /作废/i)

  const swept = await handleRpc({ op: 'dispatch.sweep', payload: { projectId: pid } }, {}, { root })
  eq('新票不会被 sweep 扫掉', swept.swept, 0)

  // 过期票：直接改盘上的 expiresAt 再 sweep
  const coFile = join(root, 'projects', pid, 'dispatches.json')
  const dpBook = JSON.parse(await readFile(coFile, 'utf8'))
  const target = dpBook.items.find((row) => row.id === co.id)
  target.status = 'issued'
  target.expiresAt = '2000-01-01T00:00:00.000Z'
  await writeFile(coFile, JSON.stringify(dpBook, null, 2), 'utf8')
  const swept2 = await handleRpc({ op: 'dispatch.sweep', payload: { projectId: pid } }, {}, { root })
  eq('过期票被扫成 expired', swept2.swept, 1)
  const expiredRow = await handleRpc({ op: 'dispatch.get', payload: { projectId: pid, id: co.id } }, {}, { root })
  eq('过期票状态 expired', expiredRow.status, 'expired')
  check('过期票带 expired 标记', expiredRow.expired === true)
  await expectThrow('过期票不能投递', () => handleRpc({ op: 'dispatch.send', payload: { projectId: pid, id: co.id, dryRun: true } }, {}, { root }), /过期/i)

  // ══ 18. 文风校验 ═════════════════════════════════════════
  console.log('\n— 18. 文风校验（lint）')
  const rulesRes = await handleRpc({ op: 'lint.rules' }, {}, { root })
  check('lint.rules 给 28 条', rulesRes.items.length === 28, String(rulesRes.items.length))
  check('规则分 blocking / advisory 两档', rulesRes.items.some((r) => r.severity === 'blocking') && rulesRes.items.some((r) => r.severity === 'advisory'))
  check('规则带 review 归类', rulesRes.items.every((r) => r.review === 'mechanical' || r.review === 'semantic'))
  // not-is 在 214 章真稿上取样 18 条全是正常叙述，已降为提示，所以硬拦是 12 不是 13
  check('硬拦有 12 条', rulesRes.items.filter((r) => r.severity === 'blocking').length === 12, String(rulesRes.items.filter((r) => r.severity === 'blocking').length))

  const cleanLint = await handleRpc({ op: 'lint.check', payload: { text: '第一回 名册\n\n朱重八把名册摊在案上，指尖从左往右点，停在第七行。' } }, {}, { root })
  eq('干净正文零命中', cleanLint.total, 0)

  // 样例要挑真硬拦的规则：元叙述章号 + 章末总结式。not-is 现在是提示，不能当硬拦样本
  const dirtyLint = await handleRpc({ op: 'lint.check', payload: { text: '这一章里，他没有说话。\n\n这一切，才刚刚开始。\n\n这个伏笔要留到后面回收。' } }, {}, { root })
  check('脏正文有硬拦', dirtyLint.blocking >= 2, String(dirtyLint.blocking))
  check('命中带段号', dirtyLint.hits.every((h) => Number.isInteger(h.para) && h.para >= 0))
  check('命中带段内字位', dirtyLint.hits.every((h) => Number.isInteger(h.offset)))
  check('命中带引文', dirtyLint.hits.every((h) => typeof h.quote === 'string'))
  // ── 阶段 A：每条规则带判据（why），命中项直接带出，界面不用回头再查一次
  check('每条规则都有 why', rulesRes.items.every((r) => typeof r.why === 'string' && r.why.length > 10))
  check('没有规则走兜底 why', rulesRes.items.every((r) => !r.why.startsWith('这条规则还没写清')))
  check('why 说的不是"AI 味"空话', rulesRes.items.every((r) => !/AI ?味/i.test(r.why)))
  check('命中项带 why', dirtyLint.hits.every((h) => typeof h.why === 'string' && h.why.length > 10))
  check('why 与 hint 是两件事', dirtyLint.hits.every((h) => h.why !== h.hint))
  check('summary 按规则聚合', Array.isArray(dirtyLint.summary) && dirtyLint.summary.length >= 2)

  const whiteLint = await handleRpc({ op: 'lint.check', payload: { text: '这不是他的错，而是时势。', whitelist: ['不是他的错'] } }, {}, { root })
  eq('白名单能屏蔽命中', whiteLint.total, 0)

  const onlyLint = await handleRpc({ op: 'lint.check', payload: { text: '他不是不想说，而是不能说。', only: ['meta-chapter'] } }, {}, { root })
  eq('only 只跑指定规则', onlyLint.total, 0)

  await expectThrow('chapter.save 硬拦元叙述', () => handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 31, text: '第三十一回 试\n\n这一章里，他什么也没说。' } }, {}, { root }), /硬伤|这一章/i)
  const forced = await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 31, text: '第三十一回 试\n\n这一章里，他什么也没说。', force: true } }, {}, { root })
  eq('force 可强行保存', Number(forced.chapter), 31)
  await expectThrow('新写的章也要过校验', () => handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 32, text: '第三十二回 试\n\n【提示】读者会喜欢。' } }, {}, { root }), /硬伤|读者/i)
  const lintOff = await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 32, text: '第三十二回 试\n\n【提示】读者会喜欢。', lint: false } }, {}, { root })
  eq('lint:false 跳过校验', Number(lintOff.chapter), 32)

  const byChapter = await handleRpc({ op: 'lint.check', payload: { projectId: pid, chapter: 31 } }, {}, { root })
  eq('按章号取正文校验', Number(byChapter.chapter), 31)
  check('按章号也能抓出硬拦', byChapter.blocking >= 1, String(byChapter.blocking))

  const metaWithStyle = await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 33, text: '第三十三回 试\n\n空气仿佛凝固了，他深吸一口气。', lint: false } }, {}, { root })
  check('meta 记下作者词表命中数', Number(metaWithStyle.meta.styleIssues) >= 1, String(metaWithStyle.meta.styleIssues))

  // ── 阶段 C：每本书自己的阈值 ───────────────────────────────
  console.log('\n— 18b. 每本书自己的阈值（阶段 C）')
  const emptyCal = await handleRpc({ op: 'lint.calibration', payload: { projectId: pid } }, {}, { root })
  eq('没量过时覆盖数为 0', emptyCal.count, 0)
  check('规则表带出全局阈值', emptyCal.items.filter((r) => Object.keys(r.threshold).length > 0).length >= 15, String(emptyCal.items.filter((r) => Object.keys(r.threshold).length > 0).length))
  check('没量过时标记未覆盖', emptyCal.items.every((r) => r.overridden === false))

  const tooFew = await handleRpc({ op: 'lint.calibrate', payload: { projectId: pid } }, {}, { root })
  check('章太少时给出警告不改阈值', tooFew.notes.some((n) => n.level === 'warn'), tooFew.summary)
  eq('章太少时不写阈值', Object.keys(tooFew.thresholds).length, 0)

  // 先灌 6 章够量的正文
  for (let n = 41; n <= 46; n += 1) {
    const body = `第${n}回 试\n\n` + '他把碗放下，抬头看了眼灰蒙蒙的天。'.repeat(24) + '\n\n' + '空气仿佛凝固了，他深吸一口气。'.repeat(4)
    // eslint-disable-next-line no-await-in-loop
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: n, text: body, lint: false } }, {}, { root })
  }
  const calibrated = await handleRpc({ op: 'lint.calibrate', payload: { projectId: pid } }, {}, { root })
  check('量到足够章数', calibrated.samples >= 6, String(calibrated.samples))
  check('给出人话总结', typeof calibrated.summary === 'string' && calibrated.summary.includes('章'), calibrated.summary)
  check('每条规则都有分布数据', Object.keys(calibrated.measured ?? {}).length === 28, String(Object.keys(calibrated.measured ?? {}).length))
  check('一次都没命中的规则不硬调', calibrated.notes.filter((n) => n.level === 'idle').length >= 5, String(calibrated.notes.filter((n) => n.level === 'idle').length))

  const calAfter = await handleRpc({ op: 'lint.calibration', payload: { projectId: pid } }, {}, { root })
  check('校准已落盘', calAfter.measuredAt.length > 0, calAfter.measuredAt)
  check('界面能看出哪条被覆盖', calAfter.items.every((r) => typeof r.overridden === 'boolean'))

  // 这本书自己的阈值真的会影响判定
  const notIsText = '他不是不想说，而是不能说。\n\n他不是怕死，而是怕连累人。\n\n他不是不会，而是不肯。'
  const loose = await handleRpc({ op: 'lint.check', payload: { projectId: pid, text: notIsText, thresholds: { 'not-is': { perKilo: 0.1, minHits: 99 } } } }, {}, { root })
  eq('手动阈值能压住命中', loose.hits.filter((h) => h.id === 'not-is').length, 0)
  check('标出用了校准阈值', loose.calibrated === true)

  const cleared = await handleRpc({ op: 'lint.calibrate.save', payload: { projectId: pid, thresholds: null } }, {}, { root })
  eq('能清空覆盖回到全局', cleared.count, 0)

  // ── 阶段 D：把采纳 / 驳回当标注 ────────────────────────────
  console.log('\n— 18c. 从判断里学（阶段 D）')
  const emptyFb = await handleRpc({ op: 'feedback.get', payload: { projectId: pid } }, {}, { root })
  eq('没学过时样本为 0', emptyFb.samples, 0)
  check('没学过时给一句人话', /还没学过/.test(emptyFb.summary), emptyFb.summary)

  // 造 4 条「改掉硬拦毛病」的提案，全部驳回 —— 等于说「这条判得太勤」
  const fbBase = await handleRpc({ op: 'feedback.learn', payload: { projectId: pid } }, {}, { root })
  for (let n = 0; n < 4; n += 1) {
    // eslint-disable-next-line no-await-in-loop
    const created = await handleRpc({
      op: 'proposal.save',
      payload: {
        projectId: pid,
        chapter: 41,
        title: `改掉元叙述 ${n}`,
        diffs: [{ before: '这一章里，他没有说话。', after: '雨落在他肩上，他没有抬头。' }],
      },
    }, {}, { root })
    // eslint-disable-next-line no-await-in-loop
    await handleRpc({ op: 'proposal.decide', payload: { projectId: pid, id: created.proposal.id, action: 'reject' } }, {}, { root })
  }
  const learned = await handleRpc({ op: 'feedback.learn', payload: { projectId: pid } }, {}, { root })
  eq('学到新增的 4 条改动片段', learned.proposals - fbBase.proposals, 4)
  check('认出被驳回的规则', learned.rules.some((r) => r.rule === 'meta-chapter' && r.rejected === 4), JSON.stringify(learned.rules))
  check('给的是倾向不是命令', learned.rules.every((r) => ['keep', 'loosen', 'unclear'].includes(r.lean)))
  check('结论说人话', learned.notes.some((n) => /可能判得太勤/.test(n.text)), JSON.stringify(learned.notes.map((n) => n.text)))
  check('总结带数字', /看了 \d+ 条改动片段/.test(learned.summary), learned.summary)

  const fbAfter = await handleRpc({ op: 'feedback.get', payload: { projectId: pid } }, {}, { root })
  check('结论已落盘', fbAfter.learnedAt.length > 0, fbAfter.learnedAt)
  eq('再次读取不重算', fbAfter.proposals, learned.proposals)

  // 不自动改分类：学完之后规则档位一个都没动
  const rulesAfter = await handleRpc({ op: 'lint.rules' }, {}, { root })
  eq('学完不改规则的档位', rulesAfter.items.filter((r) => r.severity === 'blocking').length, 12)

  // ── 阶段 B：语料池 ────────────────────────────────────────
  console.log('\n— 18d. 语料池（阶段 B）')
  const emptyPool = await handleRpc({ op: 'corpus.list' }, {}, { root })
  eq('空池子 0 本', emptyPool.totals.books, 0)
  eq('空池子还差 5584 章', emptyPool.totals.gap, 5584)

  const mkBook = (n) => {
    const chs = []
    for (let i = 1; i <= n; i += 1) {
      chs.push(`第${i}章 试`)
      chs.push('他推门出去，雨还没停。街上没人，只有一盏灯在风里晃。')
      chs.push('他没有回头，也没有停。')
      chs.push('远处传来更夫的梆子声，两下，停一停，又是两下。')
      chs.push('')
    }
    return chs.join('\n')
  }

  const addA = await handleRpc({ op: 'corpus.add', payload: { name: '样本甲', text: mkBook(30), source: 'self' } }, {}, { root })
  check('收书成功', addA.book?.chapters === 30, JSON.stringify(addA.book))
  eq('量出 30 章', addA.measured.chapters, 30)
  check('每条规则都有记录（含 0 命中）', addA.measured.rules.length === 28, String(addA.measured.rules.length))

  const dup = await handleRpc({ op: 'corpus.add', payload: { name: '样本甲副本', text: mkBook(30), source: 'self' } }, {}, { root })
  check('同一本书换名字不重复计入', dup.duplicate === true, JSON.stringify(dup.message))
  eq('池子里还是 1 本', (await handleRpc({ op: 'corpus.list' }, {}, { root })).totals.books, 1)

  await handleRpc({ op: 'corpus.add', payload: { name: '样本乙', text: mkBook(40).replace(/他推门/g, '他推窗'), source: 'public' } }, {}, { root })
  const pool2 = await handleRpc({ op: 'corpus.list' }, {}, { root })
  eq('两本合计 70 章', pool2.totals.chapters, 70)
  check('按来源分开记', pool2.totals.bySource.self.chapters === 30 && pool2.totals.bySource.public.chapters === 40, JSON.stringify(pool2.totals.bySource))
  check('算出还差多少本', pool2.totals.booksNeeded >= 25, String(pool2.totals.booksNeeded))

  const th = await handleRpc({ op: 'corpus.thresholds', payload: { minBooks: 3 } }, {}, { root })
  check('样本不足时明确说别当真', th.rules.every((r) => r.enough === false || r.books >= 3), th.summary)
  check('结论带书数', /池子里只有 2 本书/.test(th.summary), th.summary)

  const notEnough = await handleRpc({ op: 'corpus.apply', payload: { projectId: pid } }, {}, { root })
  eq('样本不足时不落盘任何阈值', notEnough.count, 0)

  await handleRpc({ op: 'corpus.add', payload: { name: '样本丙', text: mkBook(50).replace(/他推门/g, '他推帘'), source: 'owned' } }, {}, { root })
  const th3 = await handleRpc({ op: 'corpus.thresholds', payload: { minBooks: 3 } }, {}, { root })
  check('三本之后给出分位数', th3.rules.some((r) => r.enough && typeof r.p90 === 'number'), JSON.stringify(th3.rules.filter((r) => r.enough).slice(0, 2)))

  const applied = await handleRpc({ op: 'corpus.apply', payload: { projectId: pid, only: ['not-is'] } }, {}, { root })
  eq('只量指定的那条', applied.count, 1)
  check('写进了这本书的校准文件', Boolean(applied.saved?.thresholds?.['not-is']), JSON.stringify(applied.saved?.thresholds))

  await handleRpc({ op: 'lint.calibrate.save', payload: { projectId: pid, thresholds: null } }, {}, { root })
  const oneId = (await handleRpc({ op: 'corpus.list' }, {}, { root })).books[0].id
  await handleRpc({ op: 'corpus.remove', payload: { id: oneId } }, {}, { root })
  eq('删掉一本', (await handleRpc({ op: 'corpus.list' }, {}, { root })).totals.books, 2)

  // ══ 19. nightwrite_dispatch 工具 ══════════════════════════
  console.log('\n— 19. nightwrite_dispatch 工具')
  const dispatchTool = createDispatchTool(root)
  eq('工具名', dispatchTool.name, 'nightwrite_dispatch')
  check('工具描述列了 11 个岗位', roleCatalog().every((r) => dispatchTool.description.includes(r.id)))
  check('工具必填 projectId/role/task', ['projectId', 'role', 'task'].every((k) => dispatchTool.parameters[k].required === true))
  const toolTicket = await dispatchTool.execute({ projectId: pid, role: 'nightwrite-consistency-checker', task: '查第三十一回设定冲突', chapter: 31, send: false })
  check('工具 send:false 只开票', toolTicket.sent === false && /^dp_/.test(toolTicket.ticket.id))
  check('工具也回任务书', String(toolTicket.prompt).includes('nightwrite-consistency-checker.md'))
  const toolDry = await dispatchTool.execute({ projectId: pid, role: 'nightwrite-reader-proxy', task: '看第三十一回追读', dryRun: true })
  check('工具 dryRun 走投递层', toolDry.dryRun === true && toolDry.prompt.length > 200)

  // ══ 20. 拆书管道（analyze.*） ════════════════════════════
  console.log('\n— 20. 拆书管道')

  const BOOK = [
    '第一章 城头夜雨',
    '雨落下来的时候，他站在城头，看着远处的火光。',
    '他抬手抹了一把脸，把雨水和血一起抹掉。',
    '',
    '作者的话：今天两更，明天可能请假。',
    '',
    '第二章 血战',
    '刀劈过来，他侧身让开。血溅在墙上。',
    '他喊了一声：「你还活着吗？」',
    '对方没有回答，只有风声。',
    '',
    '第三章 疑云',
    '他翻出那封信，原来那个人根本没死。',
    '真相竟是这样，他坐在灯下想了很久。',
    '',
    '第四章 暗涌',
    '次日清晨，她把刀擦干净，插回鞘里。',
    '「等我回来。」他说。',
  ].join('\n')

  const an = await handleRpc({ op: 'analyze.start', payload: { projectId: pid, title: '测试拆书', text: BOOK } }, {}, { root })
  eq('analyze.start 认出 4 章', an.chapters, 4)
  check('analyze.start 回 id', /^an_[0-9a-f]{12}$/.test(String(an.id)), an.id)
  check('analyze.start 把作者的话单列进 noise', an.noise.length === 1 && /作者的话/.test(an.noise[0]), JSON.stringify(an.noise))
  check('analyze.start 统计总字数', an.totalWords > 50, String(an.totalWords))
  eq('analyze.start 只摘前三章当黄金开头', an.opening.length, 3)
  eq('analyze.start 每行都有钩子判定', an.rows.every((row) => row.hook && row.hook.id), true)
  check('analyze.start 揭示类钩子被认出来（不是威胁）',
    an.rows.find((row) => row.num === 3)?.hook.id === 'reveal',
    JSON.stringify(an.rows.map((r) => `${r.num}:${r.hook.id}`)))
  check('analyze.start 有对话比', an.rows.find((row) => row.num === 2)?.dialogue > 0,
    String(an.rows.find((row) => row.num === 2)?.dialogue))
  check('analyze.start 每章都有剧情点或事实', an.rows.every((row) => row.beats.length || row.facts.length))
  check('analyze.start 章号按出现顺序补', an.rows.map((row) => row.num).join(',') === '1,2,3,4',
    an.rows.map((row) => row.num).join(','))

  const anList = await handleRpc({ op: 'analyze.list', payload: { projectId: pid } }, {}, { root })
  check('analyze.list 有这次拆书', anList.items.some((row) => row.id === an.id), String(anList.total))

  const anGet = await handleRpc({ op: 'analyze.get', payload: { projectId: pid, id: an.id } }, {}, { root })
  eq('analyze.get 回完整 rows', anGet.rows.length, 4)
  check('analyze.get 保留了每一章的剧情点', Array.isArray(anGet.rows[2].beats), JSON.stringify(anGet.rows[2].beats))

  await expectThrow('analyze.get 对非法 id 报错',
    () => handleRpc({ op: 'analyze.get', payload: { projectId: pid, id: 'xx' } }, {}, { root }), /不合法/)
  await expectThrow('analyze.get 对不存在的 id 报错',
    () => handleRpc({ op: 'analyze.get', payload: { projectId: pid, id: 'an_000000000000' } }, {}, { root }), /没有这次拆书|missing/)
  await expectThrow('analyze.start 空正文被拒',
    () => handleRpc({ op: 'analyze.start', payload: { projectId: pid, text: '   ' } }, {}, { root }), /没有正文|读不到/)
  await expectThrow('analyze.start 认不出章节被拒',
    () => handleRpc({ op: 'analyze.start', payload: { projectId: pid, text: '一段没有章节标题的话。' } }, {}, { root }), /章节标题/)

  // 章号：中文数字与阿拉伯数字都得认
  const anCn = await handleRpc({
    op: 'analyze.start',
    payload: { projectId: pid, text: '第十二章 重逢\n他们又见面了，谁也没先开口。\n第一百零三章 结局\n一切都结束了。' },
  }, {}, { root })
  check('analyze.start 认得中文数字章号',
    anCn.rows.map((row) => row.num).join(',') === '12,103',
    anCn.rows.map((row) => row.num).join(','))

  const anDel = await handleRpc({ op: 'analyze.remove', payload: { projectId: pid, id: an.id } }, {}, { root })
  check('analyze.remove 回 removed', anDel.removed === true, JSON.stringify(anDel))
  const anList2 = await handleRpc({ op: 'analyze.list', payload: { projectId: pid } }, {}, { root })
  check('analyze.remove 之后列表里没有了', !anList2.items.some((row) => row.id === an.id))

  // ══ 21. 导入（import.*） ═════════════════════════════════
  console.log('\n— 21. 导入已有小说')

  // 这一节前面的用例已经写过章，所以一律按「相对前后的增量」断言，不假设空库。
  const rowsBefore = await store.listChapters(root, pid)
  const chaptersBefore = rowsBefore.length
  // 前面用例的章号不连续（写过又删过），所以增量判断要按「最大章号」而不是「章数」
  const maxBefore = rowsBefore.reduce((m, row) => Math.max(m, Number(row.chapter) || 0), 0)

  const ipv = await handleRpc({ op: 'import.preview', payload: { text: BOOK } }, {}, { root })
  eq('import.preview 认出的章数', ipv.chapters, 4)
  check('import.preview 列出作者的话', ipv.noise.length === 1, JSON.stringify(ipv.noise))
  check('import.preview 带首行预览', ipv.head[0].firstLine.length > 0, JSON.stringify(ipv.head[0]))
  eq('import.preview 不算落盘（章节数没变）',
    (await store.listChapters(root, pid)).length, chaptersBefore)

  const outlineBefore = (await handleRpc({ op: 'outline.get', payload: { projectId: pid } }, {}, { root })).outline
  const volumesBefore = outlineBefore.volumes.length

  const im = await handleRpc({ op: 'import.run', payload: { projectId: pid, text: BOOK, mode: 'append' } }, {}, { root })
  eq('import.run 写了 4 章', im.written, 4)
  eq('import.run 接在已有最大章号后面', im.from, maxBefore + 1)
  eq('import.run 写到最大章号 +4', im.to, maxBefore + 4)
  const afterIm = await store.listChapters(root, pid)
  eq('导入后 chapters 目录里多了 4 章', afterIm.length, chaptersBefore + 4)
  const importedRows = afterIm.filter((row) => row.chapter > maxBefore)
  check('导入的章都是待验收状态', importedRows.length === 4 && importedRows.every((row) => row.status === 'review'), JSON.stringify(importedRows.map((r) => `${r.chapter}:${r.status}`)))
  check('导入的章标题落进了 meta', importedRows[0].title.includes('城头夜雨'), String(importedRows[0]?.title))
  check('导入的章有字数缓存', importedRows.every((row) => Number(row.words) > 0), JSON.stringify(importedRows.map((r) => r.words)))
  eq('导入顺手铺了卷', im.outlinePatch.volumes.length, 1)
  const ol = await handleRpc({ op: 'outline.get', payload: { projectId: pid } }, {}, { root })
  check('导入不覆盖已有大纲', JSON.stringify(ol.outline.volumes) === JSON.stringify(outlineBefore.volumes), JSON.stringify(ol.outline.volumes.map((v) => `${v.from}-${v.to}`)))
  // 已有的卷不许被导入覆盖：大纲里可能有 AI 写好的摘要，覆盖掉是数据损失
  eq('已有卷没被导入覆盖', ol.outline.volumes.length, volumesBefore)
  eq('导入回的新卷自己带够 4 章', im.outlinePatch.volumes[0].chapters.length, 4)

  // 再导一次：append 模式要接在后面，不覆盖
  const im2 = await handleRpc({ op: 'import.run', payload: { projectId: pid, text: '第一章 新的一章\n他推开门，屋里没人。', mode: 'append' } }, {}, { root })
  eq('append 接着最大章号往后', im2.from, maxBefore + 5)
  eq('append 之后又多了 1 章', (await store.listChapters(root, pid)).length, chaptersBefore + 5)

  // replace 模式：先清空（进回收站）
  const im3 = await handleRpc({ op: 'import.run', payload: { projectId: pid, text: '第一章 只有这一章\n她走了。', mode: 'replace' } }, {}, { root })
  eq('replace 清空后只剩 1 章', (await store.listChapters(root, pid)).length, 1)
  const trashAfter = await handleRpc({ op: 'chapter.trash', payload: { projectId: pid } }, {}, { root })
  check('replace 清掉的章进了回收站（没真删）', trashAfter.items.length >= 1, String(trashAfter.items.length))

  await expectThrow('import.run 空正文被拒',
    () => handleRpc({ op: 'import.run', payload: { projectId: pid, text: '' } }, {}, { root }), /没有正文|读不到/)
  await expectThrow('import.preview 空正文被拒',
    () => handleRpc({ op: 'import.preview', payload: {} }, {}, { root }), /没有正文/)

  // ══ 22. 扫榜（scan.*） ═══════════════════════════════════
  console.log('\n— 22. 扫榜')

  const BOARD = [
    '排名 书名 题材 收藏 趋势',
    '1. 我在大明当暴君 历史 38.2万 ↑12',
    '2 重生之我家有矿（都市）96.5万 ↑5',
    '第3名 北望山河 权谋 21.7万 ↓2',
    '4、纸上谈兵 古言 18.9万 — 0',
    '-------',
    '说明：本榜每半小时更新',
  ].join('\n')

  const scRes = await handleRpc({ op: 'scan.save', payload: { projectId: pid, platform: '起点', text: BOARD } }, {}, { root })
  eq('scan.save 解析出 4 行（表头与说明被跳过）', scRes.count, 4)
  check('scan.save 认出书名', scRes.rows[0].book === '我在大明当暴君', JSON.stringify(scRes.rows[0]))
  check('scan.save 认出收藏数字', /38\.2/.test(scRes.rows[0].collect), JSON.stringify(scRes.rows[0].collect))
  check('scan.save 认出趋势', /↑/.test(scRes.rows[0].trend), JSON.stringify(scRes.rows[0].trend))
  check('scan.save 括号里的题材也认', scRes.rows[1].genre === '都市', JSON.stringify(scRes.rows[1]))
  check('scan.save 空格分隔的题材也认', scRes.rows[2].genre === '权谋', JSON.stringify(scRes.rows[2]))
  check('scan.save 算出题材分布', Array.isArray(scRes.genres) && scRes.genres.length > 0, JSON.stringify(scRes.genres))
  check('scan.save 算出上升最快（降的不该排前面）',
    scRes.rising[0].delta > 0, JSON.stringify(scRes.rising.slice(0, 2)))

  const scList = await handleRpc({ op: 'scan.list', payload: { projectId: pid } }, {}, { root })
  check('scan.list 有这次扫榜', scList.items.some((row) => row.id === scRes.id), String(scList.total))
  const scGet = await handleRpc({ op: 'scan.get', payload: { projectId: pid, id: scRes.id } }, {}, { root })
  eq('scan.get 回完整行', scGet.rows.length, 4)
  await expectThrow('scan.get 对非法 id 报错',
    () => handleRpc({ op: 'scan.get', payload: { projectId: pid, id: 'zz' } }, {}, { root }), /不合法/)
  await expectThrow('scan.save 一行都解析不出时被拒',
    () => handleRpc({ op: 'scan.save', payload: { projectId: pid, text: '' } }, {}, { root }), /没解析出来/)
  await expectThrow('scan.fetch 对非 http 地址报错',
    () => handleRpc({ op: 'scan.fetch', payload: { url: 'file:///etc/passwd' } }, {}, { root }), /http/)

  // ══ 23. 借鉴五项 + 成书导出（m13037） ═══════════════════════
  console.log('\n— 23. 借鉴五项（退化组 / 标点归一 / 细纲照搬 / 字数口径 / 任务包含手册）')

  // ① 退化检测独立成组
  const rules = await handleRpc({ op: 'lint.rules' }, {}, { root })
  check('lint.rules 带 groups', Array.isArray(rules.groups) && rules.groups.length === 4, JSON.stringify(rules.groups?.map((g) => g.id)))
  check('每条规则都有 group', rules.items.every((r) => typeof r.group === 'string' && r.group), JSON.stringify(rules.items.find((r) => !r.group)))
  const degenerateGroup = rules.groups.find((g) => g.id === 'degenerate')
  check('退化组有 4 条规则', degenerateGroup?.rules === 4, JSON.stringify(degenerateGroup))

  const degDirty = '他把碗放下，抬头看了眼灰蒙蒙的天。\n\n他把碗放下，抬头看了眼灰蒙蒙的天。\n\n此处省略三千字。'
  const deg = await handleRpc({ op: 'lint.degenerate', payload: { text: degDirty } }, {}, { root })
  check('lint.degenerate 抓到复读', deg.hits.some((h) => h.id === 'degenerate-repeat-sent'), JSON.stringify(deg.hits.map((h) => h.id)))
  check('lint.degenerate 抓到占位语', deg.hits.some((h) => h.id === 'degenerate-placeholder'), JSON.stringify(deg.hits.map((h) => h.id)))
  check('lint.degenerate 给一句结论', typeof deg.verdict === 'string' && deg.verdict.length > 8, deg.verdict)
  const degClean = await handleRpc({ op: 'lint.degenerate', payload: { text: '风从城头卷下来。\n\n她把手按在刀柄上，没有松开。' } }, {}, { root })
  eq('干净正文退化组 0 命中', degClean.total, 0)

  // ② 标点归一化
  const norm = await handleRpc({
    op: 'text.normalize',
    payload: { text: '他抬头看天...\n\n---\n\n然后说"我不去"！！！\n\n他走了。。。', apply: true },
  }, {}, { root })
  check('text.normalize 认出英文三点省略', norm.byRule['ellipsis-dots'] >= 1, JSON.stringify(norm.byRule))
  check('text.normalize 认出 markdown 分隔线', norm.byRule['md-divider'] >= 1, JSON.stringify(norm.byRule))
  check('text.normalize 把 ... 改成 ……', norm.text.includes('……'), norm.text.slice(0, 40))
  check('text.normalize 把弯引号归一', norm.text.includes('“我不去”'), norm.text.slice(0, 60))
  check('text.normalize 去掉重复感叹号', !/！{2,}/.test(norm.text), norm.text)
  check('text.normalize 返回规则表', Array.isArray(norm.rules) && norm.rules.length >= 4, JSON.stringify(norm.rules?.map((r) => r.id)))
  const normDry = await handleRpc({ op: 'text.normalize', payload: { text: '他说...好' } }, {}, { root })
  check('默认不给 text（防静默改稿）', normDry.text === undefined, JSON.stringify(normDry.text))
  check('默认给 preview 让人看改完什么样', normDry.preview === '他说……好', String(normDry.preview))
  check('但仍报出改动条数', normDry.total >= 1, String(normDry.total))

  // ③ 细纲照搬检测：造一章和细纲重合的正文
  const ocOutline = (await handleRpc({ op: 'outline.get', payload: { projectId: pid } }, {}, { root })).outline
  const ocVol = ocOutline.volumes?.[0]
  const ocNode = ocVol?.chapters?.[0]
  check('前置：细纲有第 1 回', !!ocNode, JSON.stringify(ocVol?.chapters?.map((c) => c.chapter)))
  if (ocNode) {
    const copied = `第1回 ${ocNode.title || '夜雨'}\n\n${String(ocNode.summary || '他推开门，看见雪停了。').slice(0, 40)}\n\n我自己加的：风从城头卷下来。`
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid, chapter: 1, text: copied, force: true } }, {}, { root })
    const oc = await handleRpc({ op: 'outline.copy', payload: { projectId: pid, chapter: 1 } }, {}, { root })
    check('outline.copy 找到重合', oc.total >= 1, JSON.stringify({ total: oc.total, hits: oc.hits?.map((h) => h.chars) }))
    check('outline.copy 给出重合字数', oc.hits.every((h) => h.chars >= oc.minChars), JSON.stringify(oc.hits?.map((h) => h.chars)))
    check('outline.copy 给出比例', typeof oc.ratio === 'number' && oc.ratio > 0, String(oc.ratio))
    check('outline.copy 给一句结论', typeof oc.verdict?.text === 'string' && oc.verdict.text.length > 8, JSON.stringify(oc.verdict))
    const ocClean = await handleRpc({
      op: 'outline.copy',
      payload: { projectId: pid, chapter: 1, text: '第1回 夜雨\n\n她把刀放在桌上，转身出了门。\n\n没有人拦她。' },
    }, {}, { root })
    eq('自己写的正文不报照搬', ocClean.total, 0)
    await expectThrow('outline.copy 缺 chapter 被拒',
      () => handleRpc({ op: 'outline.copy', payload: { projectId: pid } }, {}, { root }), /第几章/)
  }

  // ④ 字数口径统一
  const wc = await handleRpc({ op: 'wordcount.check', payload: { text: '第 12 回 夜雨\n\n他抬头看天。\n\n风很大。' } }, {}, { root })
  eq('wordcount.check 口径名', wc.metric, 'visible_chars_v1')
  eq('wordcount.check 数出 16 字（标题行不算）', wc.words, 16)
  check('wordcount.check 带段落数', wc.paragraphs === 3, String(wc.paragraphs))
  const wcStore = store.countWords('第 12 回 夜雨\n\n他抬头看天。\n\n风很大。')
  eq('store.countWords 与 wordcount 同口径', wcStore, 16)
  const wcChapter = await handleRpc({ op: 'wordcount.check', payload: { projectId: pid, chapter: 1 } }, {}, { root })
  check('wordcount.check 能直接读盘上章节', wcChapter.words > 0 && wcChapter.chapter === 1, JSON.stringify(wcChapter))

  // ⑤ 任务包带手册（只给路径，不嵌正文）
  const packRes = await handleRpc({
    op: 'taskpack.build',
    payload: { projectId: pid, role: 'nightwrite-chapter-writer', chapter: 1, task: '写第一回' },
  }, {}, { root })
  const skillFile = packRes.manifest.files.find((f) => f.key === 'skills')
  check('任务包含 skills 材料', !!skillFile, JSON.stringify(packRes.manifest.files.map((f) => f.key)))
  check('skills 材料只给路径不嵌正文（< 3KB）', skillFile && skillFile.bytes < 3072, String(skillFile?.bytes))
  const skillText = await readFile(join(packRes.dir, 'materials', 'skills.md'), 'utf8')
  check('skills.md 里有手册路径', /SKILL\.md/.test(skillText), skillText.slice(0, 120))
  check('skills.md 路径不是百分号编码', !/%E[0-9A-F]{2}/i.test(skillText), skillText.slice(0, 200))
  check('skills.md 里有一句话说明', /当.+时，用这份手册/.test(skillText), skillText.slice(0, 200))

  // ⑥ 成书导出：四种格式
  console.log('— 23.6 成书导出（/book）')
  const bookServer = http.createServer((req, res) => { handler(req, res) })
  await new Promise((resolve) => bookServer.listen(0, '127.0.0.1', resolve))
  const bookPort = bookServer.address().port
  const bookBase = `http://127.0.0.1:${bookPort}${ROUTE}/book`
  try {
    for (const [fmt, mime] of [
      ['txt', 'text/plain'],
      ['md', 'text/markdown'],
      ['epub', 'application/epub+zip'],
      ['docx', 'application/vnd.openxmlformats'],
    ]) {
      const res = await fetch(`${bookBase}?projectId=${pid}&format=${fmt}`)
      eq(`${fmt} 导出 200`, res.status, 200)
      check(`${fmt} content-type 正确`, String(res.headers.get('content-type') ?? '').includes(mime), String(res.headers.get('content-type')))
      const buf = Buffer.from(await res.arrayBuffer())
      check(`${fmt} 有内容`, buf.length > 50, String(buf.length))
      check(`${fmt} 带章节数头`, Number(res.headers.get('x-nightwrite-chapters')) >= 1, String(res.headers.get('x-nightwrite-chapters')))
      check(`${fmt} 带字数头`, Number(res.headers.get('x-nightwrite-words')) > 0, String(res.headers.get('x-nightwrite-words')))
    }
    const epubRes = await fetch(`${bookBase}?projectId=${pid}&format=epub`)
    const epubBuf = Buffer.from(await epubRes.arrayBuffer())
    // EPUB 合法性：第一个本地文件头后紧跟 "mimetype" 且内容是 application/epub+zip
    check('epub 首条目是 mimetype', epubBuf.slice(30, 38).toString('utf8') === 'mimetype', epubBuf.slice(30, 40).toString('utf8'))
    check('epub mimetype 内容正确', epubBuf.slice(38, 58).toString('utf8') === 'application/epub+zip', epubBuf.slice(38, 60).toString('utf8'))
    check('epub 里有 container.xml', epubBuf.includes(Buffer.from('META-INF/container.xml')), 'missing container.xml')
    check('epub 里有 content.opf', epubBuf.includes(Buffer.from('OEBPS/content.opf')), 'missing content.opf')

    const docxRes = await fetch(`${bookBase}?projectId=${pid}&format=docx`)
    const docxBuf = Buffer.from(await docxRes.arrayBuffer())
    check('docx 里有 Content_Types', docxBuf.includes(Buffer.from('[Content_Types].xml')), 'missing')
    check('docx 里有 document.xml', docxBuf.includes(Buffer.from('word/document.xml')), 'missing')

    const bad = await fetch(`${bookBase}?projectId=${pid}&format=pdf`)
    eq('不支持的格式 → 400', bad.status, 400)
    const noPid = await fetch(`${bookBase}?format=txt`)
    eq('缺 projectId → 400', noPid.status, 400)
    const noBook = await fetch(`${bookBase}?projectId=nope&format=txt`)
    check('不存在的作品 → 404/400', noBook.status === 404 || noBook.status === 400, String(noBook.status))
  } finally {
    await new Promise((resolve) => bookServer.close(resolve))
  }

  // ══ 15. 删作品 ═══════════════════════════════════════════
  console.log('\n— 15. 删作品（project.delete）')
  const del = await handleRpc({ op: 'project.delete', payload: { projectId: pid } }, {}, { root })
  check('delete 回 deleted id', del?.deleted === pid, JSON.stringify(del))
  const afterDel = await handleRpc({ op: 'project.list' }, {}, { root })
  eq('删除后列表为空', afterDel.projects.length, 0)
  await expectThrow('删后取 overview 报不存在', () => handleRpc({ op: 'overview', payload: { projectId: pid } }, {}, { root }), /找不到|missing/i)
  await expectThrow('删不存在的作品被拒', () => handleRpc({ op: 'project.delete', payload: { projectId: 'nope' } }, {}, { root }), /找不到|missing/i)

  // ══ 16. injectBoot / mountRoute ══════════════════════════
  console.log('\n— 16. 启动注入与路由挂载')
  const html = '<html><head><title>t</title></head><body></body></html>'
  const injected = injectBoot(html, { apiUrl: '/nightwrite/api' })
  check('injectBoot 插进 </head> 前',
    injected.includes('__NIGHTWRITE_BOOT__') && injected.indexOf('__NIGHTWRITE_BOOT__') < injected.indexOf('</head>'))
  eq('injectBoot 幂等（跑两遍一模一样）', injectBoot(injected), injected)
  check('没有 </head> 也能插', injectBoot('<div>x</div>').includes('__NIGHTWRITE_BOOT__'))
  check('注入内容转义 < > &', !injectBoot(html, { apiUrl: '</script><x>' }).includes('</script><x>'))
  check('boot 里有 apiUrl', injectBoot(html, { apiUrl: '/nightwrite/api' }).includes('/nightwrite/api'))

  let mounted = null
  let tapped = false
  const fakeCtx = {
    inject(list, fn) {
      check('mountRoute 只 inject webServer', list.length === 1 && list[0] === 'webServer', list.join(','))
      fn({
        webServer: {
          register: (x) => { mounted = x; return () => {} },
          tapIndex: (fn2) => { tapped = typeof fn2 === 'function'; return () => {} },
          getOrigin: () => 'http://localhost',
        },
        get: () => undefined,
      })
    },
  }
  mountRoute(fakeCtx)
  eq('mountRoute 注册 prefix 路由', mounted?.kind, 'prefix')
  eq('挂载路径是 /nightwrite/api', mounted?.path, ROUTE)
  eq('路由带 handler 函数', typeof mounted?.handler, 'function')
  check('mountRoute 也挂了 tapIndex（注入 boot）', tapped)
  check('mountRoute 对空 ctx 不炸', (() => { try { mountRoute(null); return true } catch { return false } })())
  check('mountRoute 对无 inject 的 ctx 不炸', (() => { try { mountRoute({}); return true } catch { return false } })())

// ── 退化组：命中项必须带 group，界面才能把「该重跑」和「该改句子」分开 ──
{
  const got = lint.checkDegenerate('他走了………。他走了………。')
  check('退化 · 命中项都带 group=degenerate', got.hits.length > 0 && got.hits.every((h) => h.group === 'degenerate'),
    `${got.hits.length} 条`)
  const groups = lint.listGroups()
  eq('规则分四组', groups.length, 4)
  check('退化组只有一组', groups.filter((g) => g.id === 'degenerate').length === 1)
  check('四组都有中文名', groups.every((g) => typeof g.label === 'string' && g.label.length > 0))
}

  // ══ 30. 补差距：评分 / 保真 / 段落地址 / 成本 / 钩子 / 岗位白名单 ══
  console.log('\n— 30. 补差距的六件事')
  {
    const pid2 = (await handleRpc({ op: 'project.create', payload: { name: '补差距' } }, {}, { root })).id
    const clean = '他推开门，风灌进来，桌上的纸动了动。屋里没人。\n\n他把伞靠在门边，抖了抖袖子上的水。'
    const dirty = '空气仿佛凝固了。他眼底闪过一丝慌乱，嘴角勾起。\n\n他心中一震，不由得深吸一口气。'
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid2, chapter: 1, text: clean } }, {}, { root })

    // ── 评分 ──
    const scClean = await handleRpc({ op: 'aiscore.check', payload: { projectId: pid2, text: clean } }, {}, { root })
    check('评分 · 干净段落低分', scClean.score <= 30, scClean.score)
    check('评分 · 干净段落 pass', scClean.pass === true, JSON.stringify({ s: scClean.score, w: scClean.worst && scClean.worst.id }))
    check('评分 · 短文本标不自信', scClean.confident === false, scClean.chars)
    check('评分 · 六个信号都在', scClean.signals.length === 6, scClean.signals.length)
    check('评分 · 分数落在 0–100', scClean.score >= 0 && scClean.score <= 100)
    const scDirty = await handleRpc({ op: 'aiscore.check', payload: { projectId: pid2, text: dirty.repeat(6) } }, {}, { root })
    check('评分 · 套话堆叠分更高', scDirty.score > scClean.score, scDirty.score + ' vs ' + scClean.score)
    check('评分 · 有 worst 信号', scDirty.worst !== null, JSON.stringify(scDirty.worst && scDirty.worst.id))
    check('评分 · worst 有点数', scDirty.worst && scDirty.worst.points > 0, JSON.stringify(scDirty.worst && scDirty.worst.points))
    check('评分 · 有分档文案', typeof scDirty.text === 'string' && scDirty.text.length > 0, scDirty.text)
    check('评分 · 词表统计回得来', typeof scDirty.lexicon.total === 'number' && scDirty.lexicon.total > 0, JSON.stringify(scDirty.lexicon))
    const scByChapter = await handleRpc({ op: 'aiscore.check', payload: { projectId: pid2, chapter: 1 } }, {}, { root })
    eq('评分 · 给章号也能算', scByChapter.score, scClean.score)
    await expectThrow('评分 · 没正文要报错', () => handleRpc({ op: 'aiscore.check', payload: { projectId: pid2 } }, {}, { root }), /正文/)

    // ── 保真 ──
    const origin = '三年前他借了三百两银子，签了二十张契。\n\n“我不会走。”他说。'
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid2, chapter: 5, text: origin } }, {}, { root })
    const fidOk = await handleRpc({ op: 'fidelity.check', payload: { projectId: pid2, chapter: 5, after: origin } }, {}, { root })
    eq('保真 · 原样复制判 ok', fidOk.level, 'ok')
    eq('保真 · 数字全在', fidOk.numbers.kept, fidOk.numbers.total)
    eq('保真 · 引语全在', fidOk.quotes.kept, fidOk.quotes.total)
    const fidBad = await handleRpc({ op: 'fidelity.check', payload: { projectId: pid2, chapter: 5, after: '他借了银子，签了契。\n\n“我不会走。”他说。' } }, {}, { root })
    eq('保真 · 数字丢光判 block', fidBad.level, 'block')
    check('保真 · 报了丢哪些数字', fidBad.numbers.lost.length > 0, JSON.stringify(fidBad.numbers.lost.map((x) => x.raw)))
    check('保真 · block 时有话说', typeof fidBad.text === 'string' && fidBad.text.length > 0, fidBad.text)
    const fidQuote = await handleRpc({ op: 'fidelity.check', payload: { projectId: pid2, chapter: 5, after: '三年前他借了三百两银子，签了二十张契。\n\n他一句话没说。' } }, {}, { root })
    eq('保真 · 引语丢了 ratio 掉下来', fidQuote.quotes.ratio, 0)
    await expectThrow('保真 · 没 after 要报错', () => handleRpc({ op: 'fidelity.check', payload: { projectId: pid2, chapter: 5 } }, {}, { root }), /after/)

    // ── 段落地址 ──
    const idx = await handleRpc({ op: 'anchor.index', payload: { projectId: pid2, chapter: 5 } }, {}, { root })
    eq('地址 · 段数对得上', idx.total, idx.paras.length)
    check('地址 · pid 形如 c0005p00', /^c0005p00$/.test(idx.paras[0].pid), idx.paras[0].pid)
    check('地址 · 每段带 hash 与 head', idx.paras.every((x) => /^[0-9a-f]{12}$/.test(x.hash) && x.head.length > 0))
    check('地址 · 章哈希是 12 位 hex', /^[0-9a-f]{12}$/.test(idx.chapterHash), idx.chapterHash)
    await expectThrow('地址 · 没章号要报错', () => handleRpc({ op: 'anchor.index', payload: { projectId: pid2 } }, {}, { root }), /chapter/)

    // 同句两处：只改提案指向的那一段
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid2, chapter: 6, text: '他抬头看天。\n\n风很大。\n\n他抬头看天。' } }, {}, { root })
    const saved = await handleRpc({ op: 'proposal.save', payload: { projectId: pid2, proposal: { id: 'pr_anc', chapter: 6, diffs: [{ before: '他抬头看天。', after: '他低头看地。' }] } } }, {}, { root })
    check('地址 · 保存时挂了 anchor', Boolean(saved.proposal.diffs[0].anchor && saved.proposal.diffs[0].anchor.pid), JSON.stringify(saved.proposal.diffs[0].anchor))
    const acc = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid2, id: 'pr_anc', action: 'accept' } }, {}, { root })
    eq('地址 · 采纳改了 1 条', acc.applied, 1)
    const after6 = String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid2, chapter: 6 } }, {}, { root })).text).trim()
    check('地址 · 只改第一段', after6.startsWith('他低头看地。'), after6)
    check('地址 · 第三段原样', after6.endsWith('他抬头看天。'), after6)

    // 失效提案：正文换了 → 标 outdated，正文一字不动
    await handleRpc({ op: 'proposal.save', payload: { projectId: pid2, proposal: { id: 'pr_stale', chapter: 6, diffs: [{ before: '风很大。', after: '风很小。' }] } } }, {}, { root })
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid2, chapter: 6, text: '完全换掉了。\n\n没有那段了。' } }, {}, { root })
    const stale = await handleRpc({ op: 'proposal.decide', payload: { projectId: pid2, id: 'pr_stale', action: 'accept' } }, {}, { root })
    eq('地址 · 失效提案 applied=0', stale.applied, 0)
    eq('地址 · 失效提案标 outdated', stale.proposal.status, 'outdated')
    eq('地址 · outdated 在状态白名单里', store.PROPOSAL_STATUS.includes('outdated'), true)
    const afterStale = String((await handleRpc({ op: 'chapter.get', payload: { projectId: pid2, chapter: 6 } }, {}, { root })).text)
    check('地址 · 失效时正文没动', afterStale.includes('没有那段了'), afterStale)

    // 列表要能看出「哪条已经对不上」
    await handleRpc({ op: 'proposal.save', payload: { projectId: pid2, proposal: { id: 'pr_live', chapter: 6, diffs: [{ before: '完全换掉了。', after: '全换了。' }] } } }, {}, { root })
    const fresh = await handleRpc({ op: 'proposal.list', payload: { projectId: pid2 } }, {}, { root })
    const freshRow = fresh.items.find((x) => x.id === 'pr_live')
    eq('地址 · 新鲜提案 staleCount=0', freshRow.staleCount, 0)
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid2, chapter: 6, text: '又换了。\n\n这段全不一样。' } }, {}, { root })
    const stale2 = await handleRpc({ op: 'proposal.list', payload: { projectId: pid2 } }, {}, { root })
    const staleRow = stale2.items.find((x) => x.id === 'pr_live')
    check('地址 · 正文变了 staleCount 涨起来', staleRow.staleCount >= 1, JSON.stringify(staleRow.staleCount))
    check('地址 · 带提示文案', typeof staleRow.hint === 'string' && staleRow.hint.length > 0, staleRow.hint)

    // ── 成本 ──
    const bud = await handleRpc({ op: 'usage.budget', payload: { chapters: 100, chapterWords: 3000 } }, {}, { root })
    eq('成本 · 总字数 = 章数×每章', bud.totalWords, 300000)
    check('成本 · 估出正数', bud.cost > 0 && bud.inputTokens > 0 && bud.outputTokens > 0, JSON.stringify(bud.cost))
    const mods = await handleRpc({ op: 'usage.models', payload: {} }, {}, { root })
    check('成本 · 价目表有默认档', Boolean(mods.prices.default), JSON.stringify(mods.models))
    check('成本 · 每 token 字符数给出来', typeof mods.charsPerToken === 'number' && mods.charsPerToken > 0, mods.charsPerToken)
    const scan = await handleRpc({ op: 'usage.scan', payload: { projectId: pid2 } }, {}, { root })
    check('成本 · 扫描不炸且带说明', typeof scan.note === 'string', scan.note)
    check('成本 · 会话目录编码可解', (() => { const enc = usage.encodeCwd('C:\\a\\b'); return enc.startsWith('--') && enc.endsWith('--') && enc.includes('-a-b-') })())

    // ── 岗位工具白名单 ──
    const cats = await handleRpc({ op: 'role.list', payload: {} }, {}, { root })
    check('岗位 · 每个都带 tools', cats.items.every((r) => Array.isArray(r.tools) && r.tools.length > 0), JSON.stringify(cats.items.map((r) => r.id)))
    check('岗位 · 每个都带 toolSet', cats.items.every((r) => typeof r.toolSet === 'string' && r.toolSet.length > 0), JSON.stringify(cats.items.map((r) => r.toolSet)))
    const checker = cats.items.find((r) => r.id === 'nightwrite-consistency-checker')
    check('岗位 · 审校只读（无 write/edit）', !checker.tools.includes('write') && !checker.tools.includes('edit'), checker.tools.join(','))
    const writer = cats.items.find((r) => r.id === 'nightwrite-chapter-writer')
    check('岗位 · 写手能写', writer.tools.includes('write') && writer.tools.includes('edit'), writer.tools.join(','))
    const coord = cats.items.find((r) => r.id === 'nightwrite-coordinator')
    check('岗位 · 只有总编能派单', coord.tools.includes('nightwrite_dispatch') && !writer.tools.includes('nightwrite_dispatch'))
    check('岗位 · 只有总编能起子 agent', coord.tools.includes('subagent') && cats.items.filter((r) => r.tools.includes('subagent')).length === 1, cats.items.filter((r) => r.tools.includes('subagent')).map((r) => r.id).join(','))
    check('岗位 · 所有岗位都能调 nightwrite_op', cats.items.every((r) => r.tools.includes('nightwrite_op')))
    check('岗位 · 只有总编 canDispatch', cats.items.filter((r) => r.canDispatch === true).length === 1, cats.items.filter((r) => r.canDispatch).map((r) => r.id).join(','))

    // ── 宿主钩子 ──
    eq('钩子 · 默认策略是 warn', hooks.projectWritePolicy({}).level, 'warn')
    eq('钩子 · 缺项目时按 warn', hooks.projectWritePolicy(null).level, 'warn')
    check('钩子 · 策略项齐全', ['off', 'warn', 'enforce'].includes(hooks.projectWritePolicy({ writePolicy: { level: 'enforce' } }).level))
    const absCh6 = join(await store.projectDir(root, pid2), 'chapters', '0006.txt')
    const info6 = await hooks.locateProject(root, absCh6)
    check('钩子 · 认得项目里的正文路径', Boolean(info6 && info6.guarded) && info6.projectId === pid2, JSON.stringify(info6 && { id: info6.projectId, rel: info6.rel }))
    eq('钩子 · 认得出这是章节文件', hooks.chapterOf(info6.rel), 6)
    eq('钩子 · 认不出项目外路径', await hooks.locateProject(root, join(root, 'nope.txt')), null)
    eq('钩子 · warn 不拦', hooks.guardDecision(info6, { level: 'warn', allowChapter: false }), null)
    eq('钩子 · off 不拦', hooks.guardDecision(info6, { level: 'off', allowChapter: false }), null)
    check('钩子 · enforce 拦正文', typeof hooks.guardDecision(info6, { level: 'enforce', allowChapter: false }) === 'string')
    eq('钩子 · enforce 放行正文时不管', hooks.guardDecision(info6, { level: 'enforce', allowChapter: true }), null)
    eq('钩子 · view 不算改文件', hooks.mutationPath('str_replace_editor', { command: 'view', path: 'x' }), '')
    eq('钩子 · read 不算改文件', hooks.mutationPath('read', { path: 'x' }), '')
    eq('钩子 · edit 算改文件', hooks.mutationPath('edit', { path: 'y' }), 'y')
    eq('钩子 · write 认 file_path 别名', hooks.mutationPath('write', { file_path: 'z' }), 'z')
    const msg = hooks.noticeMessage('正文提示', '摘要')
    check('钩子 · 提醒消息形状对', msg.role === 'user' && msg.source.form === 'notice' && msg.content[0].text === '正文提示' && typeof msg.id === 'string', JSON.stringify(Object.keys(msg)))
    eq('钩子 · 提醒排在下游前面', hooks.prependContext('a', ['b']).join(','), 'a,b')
    eq('钩子 · 下游没有 contexts 时也成数组', hooks.prependContext('a', undefined).join(','), 'a')
    const fakeOn = []
    const fakeCtx = { on: (name, fn) => fakeOn.push({ name, fn }) }
    const reg = hooks.registerWriteGuard(fakeCtx, { root })
    check('钩子 · 两个事件都挂上', reg.pre === true && reg.post === true && fakeOn.length === 2, JSON.stringify(reg))
    eq('钩子 · 无 ctx 不炸', JSON.stringify(hooks.registerWriteGuard(null, { root })), '{"pre":false,"post":false}')
    const pre = fakeOn.find((x) => x.name === 'tools/pre-execute').fn
    const allowed = await pre({ name: 'write', arguments: { path: join(root, 'far.txt') }, agent: { session: { header: { cwd: root } } } }, async () => ({ kind: 'allow' }))
    eq('钩子 · 项目外的写放行', allowed.kind, 'allow')
    const notFile = await pre({ name: 'read', arguments: { path: absCh6 } }, async () => ({ kind: 'allow' }))
    eq('钩子 · 读文件不问策略', notFile.kind, 'allow')
    const post = fakeOn.find((x) => x.name === 'tools/post-execute').fn
    const posted = await post({ name: 'write', arguments: { path: absCh6 }, agent: { session: { header: { cwd: root } } } }, { isError: false }, async () => ({ kind: 'accept' }))
    check('钩子 · 改完追一条提醒', posted.kind === 'accept' && Array.isArray(posted.additionalContexts) && posted.additionalContexts.length === 1, JSON.stringify(posted.kind))
    check('钩子 · 提醒里点了 chapter.save', posted.additionalContexts[0].content[0].text.includes('chapter.save'))
    check('钩子 · 提醒里带 AI 味评分', /AI 味评分/.test(posted.additionalContexts[0].content[0].text))
    const blockedDown = await post({ name: 'write', arguments: { path: join(root, 'far.txt') } }, { isError: false }, async () => ({ kind: 'block', feedback: 'x' }))
    eq('钩子 · 下游 block 原样透传', blockedDown.kind, 'block')
    const errDown = await post({ name: 'write', arguments: { path: absCh6 } }, { isError: true }, async () => ({ kind: 'accept' }))
    check('钩子 · 工具报错时不多嘴', errDown.additionalContexts === undefined, JSON.stringify(Object.keys(errDown)))

    // ── 串行锁 ──
    const order = []
    await Promise.all([1, 2, 3, 4, 5].map((n) => lock.serializeBy('/x/y', async () => {
      order.push('a' + n)
      await new Promise((r) => setTimeout(r, 4))
      order.push('b' + n)
    })))
    eq('锁 · 同一 key 严格串行', order.join(','), 'a1,b1,a2,b2,a3,b3,a4,b4,a5,b5')
    check('锁 · 统计能查', typeof lock.lockStats().active === 'number', JSON.stringify(lock.lockStats()))

    // ── 并发写提案不丢（第 9 条） ──
    await Promise.all(Array.from({ length: 20 }, (_, i) => handleRpc({ op: 'proposal.save', payload: { projectId: pid2, proposal: { id: 'pr_c' + i, chapter: 5, diffs: [{ before: '三年前', after: '四年前' }] } } }, {}, { root })))
    const many = await handleRpc({ op: 'proposal.list', payload: { projectId: pid2 } }, {}, { root })
    eq('锁 · 20 个并发提案一个不少', many.items.filter((x) => /^pr_c\d+$/.test(x.id)).length, 20)

    // ── library.json 只有一把锁 ──
    // 建作品是「读 library.json → push 一条 → 写回去」。不串行的话
    // 十个并发建完只剩一条，看着像「点了没反应」。
    const made = await Promise.all(Array.from({ length: 10 }, (_, i) => handleRpc({ op: 'project.create', payload: { name: '并发' + i } }, {}, { root })))
    const libAfter = JSON.parse(await readFile(join(root, 'library.json'), 'utf8'))
    eq('锁 · 10 个并发建作品一条不少', libAfter.projects.filter((p) => /^并发\d+$/.test(p.name)).length, 10)
    eq('锁 · 建作品回的是不同 id', new Set(made.map((r) => r.id)).size, 10)

    // 并发改名：saveProject 要同时写 project.json 和 library.json 两处。
    await Promise.all(Array.from({ length: 8 }, (_, i) => store.saveProject(root, pid2, { logline: '第' + i + '版' })))
    const libNames = JSON.parse(await readFile(join(root, 'library.json'), 'utf8'))
    check('锁 · 并发改名后 library 里这作品还在', libNames.projects.some((p) => p.id === pid2))
    const back = await store.getProject(root, pid2)
    check('锁 · 并发改名后 project.json 可读且是最后写入之一', /^第[0-7]版$/.test(back.meta.logline), back.meta.logline)

    // ── state.json 的版本号 ──
    // bumpState 是「读 → 加一 → 写」。不串行时十个并发最后都是 1。
    const { dir: stateDir } = await store.getProject(root, pid2)
    const before = (await store.readState(stateDir)).revision
    await Promise.all(Array.from({ length: 10 }, (_, i) => store.bumpState(stateDir, { touched: { op: 'test' + i } })))
    eq('锁 · 10 次并发 bump 版本走满 10 格', (await store.readState(stateDir)).revision, before + 10)

    // ── 章节树 ──
    // 同一章并发存 6 次：rev 是「每存一次 +1」，串行才对得上；
    // 不串行时几次会读到同一个 rev，最终 rev 小于 6。
    await Promise.all(Array.from({ length: 6 }, (_, i) => store.saveChapter(root, pid2, 9, '第 ' + i + ' 次的正文\n', {}, {})))
    const ch9 = await store.getChapter(root, pid2, 9)
    eq('锁 · 同章并发 6 次存盘 rev 走满 6 格', ch9.meta.rev, 6)

    // 存盘与重排同时发生：重排会把 0009 搬成 0010，两个动作必须排队。
    const raced = await Promise.allSettled([
      store.saveChapter(root, pid2, 9, '重排期间写入\n', {}, {}),
      store.moveChapter(root, pid2, 9, 12),
    ])
    check('锁 · 存盘与重排并发不抛', raced.every((r) => r.status === 'fulfilled'), JSON.stringify(raced.map((r) => r.status)))
    const nums = (await store.listChapters(root, pid2)).map((r) => r.chapter)
    check('锁 · 重排后章号不重复也不丢', new Set(nums).size === nums.length && nums.includes(12), JSON.stringify(nums))

    // ── 索引类（拆书 / 扫榜）──
    // 这两处写的是 index.json：读整个数组、插一条、写回去。
    const scanRows = [{ rank: 1, book: '甲', genre: '仙侠', heat: 100 }, { rank: 2, book: '乙', genre: '仙侠', heat: 90 }]
    await Promise.all(Array.from({ length: 5 }, (_, i) => handleRpc({ op: 'scan.save', payload: { projectId: pid2, platform: 'p' + i, rows: scanRows } }, {}, { root })))
    const scans = await handleRpc({ op: 'scan.list', payload: { projectId: pid2 } }, {}, { root })
    eq('锁 · 5 个并发扫榜索引一条不少', scans.items.length, 5)

    // 拆书的 id 是内容哈希：同一本书拆十次只该留一份，这是对的。
    // 所以要测「索引不丢」，得让四本书真的不一样。
    const bookOf = (k) => Array.from({ length: 3 }, (_, i) => '第' + (i + 1) + '章 标题' + k + String.fromCharCode(10, 10) + '第' + k + '本的正文若干字。').join(String.fromCharCode(10, 10))
    await Promise.all(Array.from({ length: 4 }, (_, i) => handleRpc({ op: 'analyze.start', payload: { projectId: pid2, text: bookOf(i), title: '拆' + i } }, {}, { root })))
    const analyses = await handleRpc({ op: 'analyze.list', payload: { projectId: pid2 } }, {}, { root })
    eq('锁 · 4 个并发拆书索引一条不少', analyses.items.length, 4)
    // 同一本书再拆一次：索引里那条被原位替换，不该变成 5 条。
    await handleRpc({ op: 'analyze.start', payload: { projectId: pid2, text: bookOf(0), title: '拆0重跑' } }, {}, { root })
    eq('锁 · 同一本书重拆不新增条目', (await handleRpc({ op: 'analyze.list', payload: { projectId: pid2 } }, {}, { root })).items.length, 4)
  }

  // ══ 31. 真派子代理（第 2 条：subagents 注入 + 人格 + 工具白名单） ══
  {
    const spawn = await import('../lib/spawn.js')
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
    const rolesMod = await import('../lib/roles.js')

    // ── 手册正文：剥 frontmatter，改文件后按 mtime 重新读 ──
    const p1 = spawn.personaOf(repoRoot, 'nightwrite-consistency-checker')
    check('派单 · 手册能读出来', p1.ok === true && p1.text.length > 300, `${p1.ok} ${p1.text.length}`)
    check('派单 · frontmatter 被剥掉', !p1.text.startsWith('---') && !/\nname:\s/.test(p1.text.slice(0, 200)), JSON.stringify(p1.text.slice(0, 20)))
    check('派单 · 手册第一句是「你是」', p1.text.startsWith('你是'), JSON.stringify(p1.text.slice(0, 10)))
    eq('派单 · 不存在的岗位没手册', spawn.personaOf(repoRoot, 'nope').ok, false)
    eq('派单 · stripFrontmatter 无 frontmatter 原样返回', spawn.stripFrontmatter('# 标题\n\n正文'), '# 标题\n\n正文')
    eq('派单 · stripFrontmatter 剥掉开头那段', spawn.stripFrontmatter('---\nname: x\n---\n\n# 标题'), '# 标题')

    // ── 子代理工具白名单：要摘掉「再派一层」 ──
    const childCoord = spawn.childTools('nightwrite-coordinator')
    check('派单 · 子代理拿不到 subagent', !childCoord.includes('subagent'), childCoord.join(','))
    check('派单 · 子代理拿不到 nightwrite_dispatch', !childCoord.includes('nightwrite_dispatch'), childCoord.join(','))
    check('派单 · 子代理仍能读写', childCoord.includes('read') && childCoord.includes('write'), childCoord.join(','))
    const childChecker = spawn.childTools('nightwrite-consistency-checker')
    check('派单 · 审校派下去仍然只读', !childChecker.includes('write') && !childChecker.includes('edit'), childChecker.join(','))
    check('派单 · 顶层总编才有 subagent', rolesMod.roleTools('nightwrite-coordinator').includes('subagent'))
    eq('派单 · 未知岗位白名单为空', spawn.childTools('nope').length, 0)

    // ── spawnStatus / canSpawn ──
    eq('派单 · 空 ctx 没有服务', spawn.spawnStatus({}).service, false)
    const noProvider = { subagents: { startActivation: async () => ({}), getProvider: () => undefined } }
    const st2 = spawn.spawnStatus(noProvider)
    check('派单 · 有服务没 provider 要报清楚', st2.service === true && st2.provider === false && st2.reason.includes('spawn'), st2.reason)
    const noParent = spawn.canSpawn({ subagents: { startActivation: async () => ({}), getProvider: () => ({}) } }, undefined)
    check('派单 · 没有父代理就派不了', noParent.ok === false && noParent.reason.includes('父代理'), noParent.reason)
    let threw = null
    await spawn.spawnRole({}, { role: 'nightwrite-editor', prompt: 'x' }).catch((e) => { threw = e })
    check('派单 · 服务不全时抛 spawn-unavailable', threw?.code === 'spawn-unavailable', threw?.code ?? String(threw))
    threw = null
    await spawn.spawnRole(noProvider, { role: 'nope', prompt: 'x', parent: { id: 'p' } }).catch((e) => { threw = e })
    eq('派单 · 岗位非法优先报 invalid-role', threw?.code, 'invalid-role')

    // ── configureRoleAgent：人格段 + 工具收窄 ──
    const calls = []
    const fakeAgent = {
      id: 'a1',
      ctx: {
        get: (name) => (name === 'systemPrompt'
          ? { getSectionOrder: () => 7, section: (arg) => calls.push({ kind: 'persona', arg }) }
          : name === 'tools'
            ? { restrict: (arg) => calls.push({ kind: 'tools', arg }) }
            : undefined),
      },
    }
    const applied = spawn.configureRoleAgent(fakeAgent, { role: 'nightwrite-consistency-checker', persona: '你是审校。' })
    check('派单 · 人格与工具都按上', applied.persona === true && applied.tools === true, JSON.stringify(applied))
    eq('派单 · 先插人格再收窄工具', calls.map((x) => x.kind).join(','), 'persona,tools')
    eq('派单 · 人格段位置取自宿主', calls[0].arg.order, 7)
    eq('派单 · 人格段文本原样', calls[0].arg.text, '你是审校。')
    check('派单 · 工具白名单是子代理版', !calls[1].arg.allow.includes('subagent'), calls[1].arg.allow.join(','))
    const bare = spawn.configureRoleAgent({ id: 'a2', ctx: { get: () => undefined } }, { role: 'nightwrite-editor', persona: 'x' })
    check('派单 · 宿主没服务时如实报失败', bare.persona === false && bare.tools === false && bare.reason.includes('systemPrompt'), bare.reason)

    // ── spawnRole 端到端：假宿主按 agent/created 创建子代理 ──
    const listeners = []
    const made = []
    const fakeService = {
      getProvider: () => ({ name: 'spawn' }),
      async startActivation(spec) {
        made.push(spec)
        // 宿主真实行为：先创建子代理并 await agent/created 监听器，再返回。
        const child = {
          id: spec.childId,
          ctx: {
            get: (name) => (name === 'systemPrompt'
              ? { getSectionOrder: () => 7, section: () => {} }
              : name === 'tools' ? { restrict: () => {} } : undefined),
          },
        }
        const created = { id: 'evt', agent: child }
        for (const one of listeners) one.fn(created)
        return { childId: spec.childId, messageId: 'm1', result: Promise.resolve({ output: [{ type: 'text', text: '审校结论：无冲突。' }], stopReason: 'end' }), dispose: async () => { made.push('disposed') } }
      },
    }
    const parent = {
      id: 'parent-1',
      session: { header: { cwd: repoRoot } },
      ctx: { on: (name, fn) => { listeners.push({ name, fn }); return () => {} } },
    }
    const fakeCtx = { subagents: fakeService }
    const run = await spawn.spawnRole(fakeCtx, {
      parent,
      role: 'nightwrite-consistency-checker',
      repoRoot,
      label: '审校 · 第 6 章',
      prompt: '查第 6 章的设定冲突',
    })
    eq('派单 · 真的调了 startActivation', made.filter((x) => typeof x === 'object').length, 1)
    const spec = made[0]
    eq('派单 · provider 是 spawn', spec.provider, 'spawn')
    eq('派单 · maxDepth 锁死 1', spec.request.maxDepth, 1)
    eq('派单 · 父代理原样交过去', spec.request.parent, parent)
    eq('派单 · prompt 是 content block', JSON.stringify(spec.request.prompt), '[{"type":"text","text":"查第 6 章的设定冲突"}]')
    eq('派单 · delivery 用 caller（不往父对话塞通知）', spec.delivery, 'caller')
    check('派单 · 人格确实按上了', run.personaApplied.persona === true && run.personaApplied.tools === true, JSON.stringify(run.personaApplied))
    eq('派单 · 返回 childId 与宿主一致', run.childId, spec.childId)
    const out = await run.result
    check('派单 · 子代理结果拿得到', out.output[0].text.includes('审校结论'), JSON.stringify(out.output))
    eq('派单 · 宿主没在发布前建子代理时要退回', typeof run.dispose, 'function')
    eq('派单 · 监听器已注销', listeners.length, 1)

    // 没按上人格 → 拒绝裸跑并 dispose
    made.length = 0
    const deafService = { getProvider: () => ({ name: 'spawn' }), async startActivation(spec) { made.push(spec); return { childId: spec.childId, result: Promise.resolve({ output: [], stopReason: 'end' }), dispose: async () => { made.push('disposed') } } } }
    let fail = null
    await spawn.spawnRole({ subagents: deafService }, { parent, role: 'nightwrite-editor', repoRoot, prompt: 'x' }).catch((e) => { fail = e })
    eq('派单 · 没按上人格就报 spawn-not-configured', fail?.code, 'spawn-not-configured')
    check('派单 · 报错前先 dispose 掉裸跑的子代理', made.includes('disposed'), made.map((x) => (typeof x === 'object' ? 'spec' : x)).join(','))

    // ── subagent.status op ──
    const cat = await handleRpc({ op: 'subagent.status', payload: {} }, {}, { root })
    check('派单 · subagent.status 报得出来', typeof cat.service === 'boolean' && Array.isArray(cat.roles), JSON.stringify(Object.keys(cat)))
    eq('派单 · subagent.status 列出 11 个岗位', cat.roles.length, 11)
    check('派单 · 每个岗位带工具清单', cat.roles.every((r) => Array.isArray(r.tools) && r.tools.length > 0))
  }

  // ══ 32. 配置 schema（第 9 条：宿主能画出设置表单，填了真生效） ══
  {
    const cfg = await import('../lib/config.js')
    const aiscore = await import('../lib/aiscore.js')

    // ── 宿主读的形状 ──
    check('配置 · index.js 真的导出了 Config', typeof cfg.Config === 'object' && cfg.Config !== null)
    eq('配置 · 类型声明是 object', cfg.Config.type, 'object')
    check('配置 · 每个字段都有说明（设置页要显示给人看）',
      Object.values(cfg.Config.dict).every((f) => typeof f?.meta?.description === 'string' && f.meta.description.length > 8),
      JSON.stringify(Object.entries(cfg.Config.dict).filter(([, f]) => !(f?.meta?.description?.length > 8)).map(([k]) => k)))
    // dict 是给设置页直接投影的字段树，refs 是给 toJSON 按 uid 解引用的节点表；
    // 两份内容必须一致，否则「画出来的行」和「宿主校验的节点」会对不上。
    eq('配置 · dict 与 refs 的字段说明逐条一致',
      Object.entries(cfg.Config.dict).filter(([key, f]) => {
        const ref = Object.values(cfg.Config.refs).find((r) => r?.meta?.description === f?.meta?.description)
        return !ref || ref.type !== f.type || String(ref.meta.default) !== String(f.meta.default)
      }).map(([k]) => k), [])
    check('配置 · 校验入口是 standard-schema', typeof cfg.Config['~standard']?.validate === 'function')
    eq('配置 · 走 standard-schema 拿回归一化后的值', cfg.Config['~standard'].validate({ scorePassMax: 55 }).value.scorePassMax, 55)

    // ── 归一是「坏一项不影响别项」 ──
    const bad = cfg.normalizeConfig({ scorePassMax: 300, historyKeep: 'x', dispatchTtlMin: 60, aiStyleBlock: 'no', writePolicy: 'ENFORCE', root: '  /tmp/x  ' })
    eq('配置 · 超范围退回默认', bad.value.scorePassMax, 30)
    eq('配置 · 非数字退回默认', bad.value.historyKeep, 20)
    eq('配置 · 正常项照收', bad.value.dispatchTtlMin, 60)
    eq('配置 · 只有明确 false 才关硬拦', bad.value.aiStyleBlock, true)
    eq('配置 · 大小写不算数，退回默认', bad.value.writePolicy, 'warn')
    eq('配置 · 字符串两边空白去掉', bad.value.root, '/tmp/x')
    eq('配置 · 坏了几项就报几条（aiStyleBlock 填 "no" 静默当默认，属于设计）', bad.warnings.length, 3)
    check('配置 · warning 说的是人话', bad.warnings.every((w) => /已用默认/.test(w)), JSON.stringify(bad.warnings))

    // ── 三项从配置真的流到用它的地方 ──
    const pid3 = (await handleRpc({ op: 'project.create', payload: { name: '配置生效' } }, {}, { root })).id
    cfg.setRuntimeConfig({ scorePassMax: 45, historyKeep: 3, maxBodyBytes: 256 * 1024 })

    eq('配置 · 运行时槽拿到新值', cfg.getRuntimeConfig().scorePassMax, 45)
    eq('配置 · AI 味放行线跟着配置走', aiscore.scoreText('他说：“走吧。”'.repeat(60)).passMax, 45)
    const big = '风从窗缝里挤进来。'.repeat(20000) // 180000 字
    await handleRpc({ op: 'chapter.save', payload: { projectId: pid3, chapter: 1, text: big, force: true } }, {}, { root })
    const bigSaved = await handleRpc({ op: 'chapter.get', payload: { projectId: pid3, chapter: 1 } }, {}, { root })
    eq('配置 · 18 万字的章存得下', String(bigSaved.text ?? '').length, 180000)
    const kept = await handleRpc({ op: 'chapter.history', payload: { projectId: pid3, chapter: 1 } }, {}, { root })
    eq('配置 · 章节历史上限跟着配置走', kept.keep, 3)

    // 超了要拒，且报的数字跟着配置变（不是写死的 8MB）
    const tooBig = await new Promise((resolve) => {
      const srv = http.createServer(createHandler(root))
      srv.listen(0, '127.0.0.1', async () => {
        const port = srv.address().port
        const res = await fetch(`http://127.0.0.1:${port}/nightwrite/api`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ op: 'ping', pad: 'y'.repeat(300 * 1024) }),
        })
        resolve({ status: res.status, body: await res.json() })
        srv.close()
      })
    })
    eq('配置 · 超过上限回 413', tooBig.status, 413)
    check('配置 · 提示里的数字是配置值', /256KB/.test(tooBig.body.error.message), tooBig.body.error.message)

    // aiStyleBlock: false 之后硬拦整段跳过
    // degenerate-repeat-punct 是 blocking 档，最稳的一颗子弹
    const dirtyLine = '他走了。。。。'
    cfg.setRuntimeConfig({ aiStyleBlock: false })
    const passed = await handleRpc({ op: 'chapter.save', payload: { projectId: pid3, chapter: 2, text: dirtyLine } }, {}, { root }).catch((e) => e)
    eq('配置 · 关掉硬拦后脏稿能落盘', passed?.chapter, 2)
    cfg.setRuntimeConfig({})
    const blocked = await handleRpc({ op: 'chapter.save', payload: { projectId: pid3, chapter: 3, text: dirtyLine } }, {}, { root }).catch((e) => e)
    eq('配置 · 打开硬拦后同一句话被拒', blocked?.code, 'style-blocking')

    // ── 界面切写策略走 patch，不重启 ──
    // setRuntimeConfig 是整体替换（apply 时用），所以先摆一个已知状态再 patch。
    cfg.setRuntimeConfig({ scorePassMax: 45, historyKeep: 3 })
    cfg.patchRuntimeConfig({ scorePassMax: 12 })
    eq('配置 · patch 只改一项', cfg.getRuntimeConfig().scorePassMax, 12)
    eq('配置 · patch 不动别的项', cfg.getRuntimeConfig().historyKeep, 3)
    cfg.setRuntimeConfig({})
  }

  // ══ 收官 ═════════════════════════════════════════════════
  console.log(`\n${'─'.repeat(52)}`)
  console.log(`${pass} 过 / ${fails.length} 不过 · 共 ${pass + fails.length} 项`)
  if (fails.length) {
    console.log('\n不过的：')
    for (const f of fails) console.log(`  · ${f}`)
  }
} finally {
  await rm(root, { recursive: true, force: true })
  console.log(`\n临时目录已清理：${root}`)
}

process.exit(fails.length ? 1 : 0)
