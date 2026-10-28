/**
 * 长夜 · 对齐简报（对齐 LNW 的 briefing）
 *
 * 解决的问题：每次开一个新对话，agent 都不知道这本书已经写到哪了。作者要么
 * 重贴一遍设定，要么看着 agent 从第一章重新猜。猜错的地方就是"AI 记不住"。
 *
 * 简报不是摘要，是**接口**：把"现在该知道的"压成一份几千字的文本，一个
 * briefing.get 就能拿到全貌——现在几回、卡在哪、谁欠了什么、下一步该干嘛。
 *
 * 三条设计原则：
 *   1. **只放会影响下一步决策的东西**。全书账本八十条不进来，只放"最近出场
 *      的人"和"该回收没回收的伏笔"。
 *   2. **标明哪些是事实、哪些是欠账**。事实（写到第几回）和待办（三章没验收）
 *      混在一起，读的人就没法判断哪些能信。
 *   3. **给出明确的下一步**，不是罗列状态。宁可给一个可能不对的建议，也不要
 *      让 agent 自己从一片数据里猜该干嘛。
 */

import * as store from './store.js'

const RECENT_CHAPTERS = 5
const MAX_PEOPLE = 8
const MAX_FORESHADOW = 10
const MAX_TEXT = 12000 // 简报硬上限：超过这个长度它就不再是"简报"，而是第二份书稿

function textOf(value, limit = 200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

function chapterRange(rows) {
  if (!rows.length) return '（还没有章节）'
  const nums = rows.map((row) => Number(row.chapter) || 0).filter(Boolean).sort((a, b) => a - b)
  if (!nums.length) return '（还没有章节）'
  return nums.length === 1 ? `第 ${nums[0]} 回` : `第 ${nums[0]}–${nums[nums.length - 1]} 回`
}

/** 按状态分组，用来算"欠了什么"。 */
function groupByStatus(rows) {
  const buckets = { accepted: [], review: [], draft: [], rejected: [], other: [] }
  for (const row of rows) {
    const key = ['accepted', 'review', 'draft', 'rejected'].includes(String(row.status)) ? String(row.status) : 'other'
    buckets[key].push(row)
  }
  return buckets
}

/**
 * 生成对齐简报。
 *
 * @param {{focus?: string, includeText?: boolean}} options
 *   focus — 可选：作者当前想干的事（"接着写第 13 回"），会改变"下一步"那一段
 */
export async function buildBriefing(root, projectId, options = {}) {
  const { meta: project } = await store.getProject(root, projectId)
  const chapters = await store.listChapters(root, projectId)
  const ledger = await store.getLedger(root, projectId)
  const outline = await store.getOutline(root, projectId)
  const problems = await store.listProblems(root, projectId)
  const proposals = await store.listProposals(root, projectId)
  const queue = await store.listQueue(root, projectId).catch(() => ({ items: [] }))

  const buckets = groupByStatus(chapters)
  const totalWords = chapters.reduce((sum, row) => sum + (Number(row.words) || 0), 0)
  const lastChapter = chapters.length
    ? chapters.slice().sort((a, b) => (Number(a.chapter) || 0) - (Number(b.chapter) || 0)).slice(-1)[0]
    : null

  // ── 事实：这些是确定发生过的事，agent 可以直接当真 ──
  const facts = [
    `书名：${textOf(project?.name, 60) || projectId}`,
    `类型：${textOf(project?.genre, 40) || '未填'}`,
    `已写：${chapterRange(chapters)}（${chapters.length} 回 / 约 ${totalWords} 字）`,
    `验收：通过 ${buckets.accepted.length} 回 · 待验收 ${buckets.review.length} 回 · 草稿 ${buckets.draft.length} 回${buckets.rejected.length ? ` · 已否 ${buckets.rejected.length} 回` : ''}`,
  ]
  // getOutline 永远返回带 brief 的空骨架，所以不能拿「outline 是否为真」判有没有大纲，
  // 要看它到底排没排过章。否则空书也走进第一个分支，facts 里既不说「已排」也不说「还没有」。
  const outlineVolumes = Array.isArray(outline?.volumes) ? outline.volumes : []
  const plannedChapters = outlineVolumes.reduce((sum, vol) => sum + (Array.isArray(vol?.chapters) ? vol.chapters.length : 0), 0)
  const outlineBrief = outline?.brief ?? {}
  if (outline && plannedChapters) {
    facts.push(`大纲：${outlineVolumes.length} 卷 / ${plannedChapters} 回已排${plannedChapters > chapters.length ? `，还差 ${plannedChapters - chapters.length} 回没写` : ''}`)
    if (outlineBrief.premise) facts.push(`一句话：${textOf(outlineBrief.premise, 120)}`)
    if (outlineBrief.protagonist) facts.push(`主角：${textOf(outlineBrief.protagonist, 80)}`)
    if (outlineBrief.goal) facts.push(`主线目标：${textOf(outlineBrief.goal, 100)}`)
  } else {
    facts.push('大纲：还没排（只有书目信息，没有分卷分章）')
    if (outlineBrief.premise) facts.push(`一句话：${textOf(outlineBrief.premise, 120)}`)
  }

  // ── 人：只放最近出场的，全书名单不必进简报 ──
  const people = (Array.isArray(ledger?.characters) ? ledger.characters : [])
    .slice()
    .sort((a, b) => (Number(b.lastChapter) || 0) - (Number(a.lastChapter) || 0))
    .slice(0, MAX_PEOPLE)
    .map((row) => ({
      name: textOf(row.name, 24),
      role: textOf(row.role, 20),
      state: textOf(row.state, 60),
      lastChapter: Number(row.lastChapter) || 0,
    }))

  // ── 欠账：该收没收的伏笔、没验收的章、没处理的问题 ──
  const foreshadows = (Array.isArray(ledger?.foreshadow) ? ledger.foreshadow : [])
    .filter((row) => String(row.status ?? '') !== 'done' && String(row.status ?? '') !== '已回收')
    .map((row) => ({
      name: textOf(row.name, 30),
      plantedChapter: Number(row.plantedChapter) || 0,
      plannedChapter: Number(row.plannedChapter) || 0,
      overdue: Boolean(row.plannedChapter) && lastChapter && Number(row.plannedChapter) <= Number(lastChapter.chapter),
    }))
    .sort((a, b) => (a.plannedChapter || 9e9) - (b.plannedChapter || 9e9))
    .slice(0, MAX_FORESHADOW)

  const debts = []
  if (buckets.review.length) debts.push(`${buckets.review.length} 回写完没验收：第 ${buckets.review.map((r) => r.chapter).join('、')} 回`)
  const openProblems = (problems.items ?? []).filter((row) => row.status === 'open')
  if (openProblems.length) debts.push(`${openProblems.length} 条问题还没处理（集中在第 ${[...new Set(openProblems.map((r) => r.chapter))].slice(0, 6).join('、')} 回）`)
  const pendingProposals = (proposals.items ?? []).filter((row) => row.status === 'pending')
  if (pendingProposals.length) debts.push(`${pendingProposals.length} 条提案等着拍板`)
  const overdue = foreshadows.filter((row) => row.overdue)
  if (overdue.length) debts.push(`${overdue.length} 条伏笔过了计划回收章还没收：${overdue.map((r) => r.name).slice(0, 4).join('、')}`)
  const queued = (queue.items ?? []).filter((row) => row.status === 'queued')
  if (queued.length) debts.push(`队列里还有 ${queued.length} 条待办没派出去`)

  // ── 最近几回：给"接着写"提供上下文，只说发生了什么，不复述正文 ──
  const recent = chapters
    .slice()
    .sort((a, b) => (Number(a.chapter) || 0) - (Number(b.chapter) || 0))
    .slice(-RECENT_CHAPTERS)
    .map((row) => ({
      chapter: Number(row.chapter) || 0,
      title: textOf(row.title, 40),
      words: Number(row.words) || 0,
      status: String(row.status ?? 'draft'),
      outlineSummary: (() => {
        const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
        for (const vol of volumes) {
          const hit = (Array.isArray(vol?.chapters) ? vol.chapters : []).find((ch) => Number(ch.chapter) === Number(row.chapter))
          if (hit) return textOf(hit.summary, 120)
        }
        return ''
      })(),
    }))

  // ── 下一步：给一个，并说清理由。宁可不对，也不要让 agent 在空白里猜 ──
  const nextStep = (() => {
    const focus = textOf(options.focus, 80)
    if (focus) return `作者说了要干这个：${focus}。先确认它对应哪一回，再动笔。`
    if (buckets.review.length) return `先把第 ${buckets.review[0].chapter} 回验收掉——没验收的章不会进账本，后面会越积越多。`
    if (openProblems.length) return `第 ${openProblems[0].chapter} 回有 ${openProblems.filter((r) => r.chapter === openProblems[0].chapter).length} 条问题挂着，先修完再往下写。`
    if (pendingProposals.length) return `有 ${pendingProposals.length} 条提案等拍板，先决定要改哪些，别急着写新章。`
    if (overdue.length) return `「${overdue[0].name}」该在第 ${overdue[0].plannedChapter} 回收，现在已过——这一章顺手把它收了。`
    const volumes = Array.isArray(outline?.volumes) ? outline.volumes : []
    const planned = volumes.flatMap((vol) => (Array.isArray(vol?.chapters) ? vol.chapters : []))
    const nextPlanned = planned.find((ch) => Number(ch.chapter) > (Number(lastChapter?.chapter) || 0))
    if (nextPlanned) return `按大纲该写第 ${nextPlanned.chapter} 回${nextPlanned.title ? `「${textOf(nextPlanned.title, 30)}」` : ''}${nextPlanned.summary ? `：${textOf(nextPlanned.summary, 100)}` : ''}`
    if (!outline) return '还没有大纲。先排大纲，别凭感觉往下写——写完发现方向错了要重写。'
    return '大纲排的章都写完了。要么补新卷大纲，要么回头把已写的再过一遍。'
  })()

  const sections = [
    { id: 'facts', title: '现在是什么状况', lines: facts },
    { id: 'people', title: '最近在场的人', lines: people.map((p) => `${p.name}${p.role ? `（${p.role}）` : ''}：${p.state || '状态未记'}${p.lastChapter ? ` · 最近第 ${p.lastChapter} 回` : ''}`) },
    { id: 'debts', title: '欠着什么', lines: debts.length ? debts : ['没有欠账，干净。'] },
    { id: 'recent', title: `最近 ${recent.length} 回`, lines: recent.map((r) => `第 ${r.chapter} 回${r.title ? `「${r.title}」` : ''} · ${r.words} 字 · ${r.status}${r.outlineSummary ? `\n    大纲：${r.outlineSummary}` : ''}`) },
    { id: 'next', title: '下一步', lines: [nextStep] },
  ]

  const text = [
    `# ${textOf(project?.name, 60) || projectId} · 对齐简报`,
    '',
    ...sections.flatMap((section) => [`## ${section.title}`, ...section.lines.map((line) => `- ${line}`), '']),
    '---',
    '这份简报是只读快照，写于 ' + new Date().toISOString() + '。要改书，走 changye_op；不要凭这份简报里的数字反推正文。',
  ].join('\n')

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    chapters: chapters.length,
    totalWords,
    lastChapter: Number(lastChapter?.chapter) || 0,
    sections,
    people,
    foreshadows,
    recent,
    debts,
    nextStep,
    text: text.slice(0, MAX_TEXT),
    truncated: text.length > MAX_TEXT,
  }
}
