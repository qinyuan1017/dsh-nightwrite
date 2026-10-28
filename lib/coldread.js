/**
 * 长夜 · 冷读（对齐 LNW 的 cold-reader）
 *
 * 冷读是什么：把书稿打包成一份 txt，交给一个**没读过任何设定、没参与写作**的
 * 读者，让它一次读完，只回答"好不好看"。它不查设定矛盾（那是审校的活），
 * 不修句子（那是改稿的活）——它只回答一个作者最难自查的问题：陌生人读到这里
 * 会不会想继续看。
 *
 * 三条设计上的取舍：
 *
 *   1. **把正文汇成单文件再读**。让模型按章调 100 次 chapter.get，它读不到
 *      第 3 章就忘了第 1 章写过什么，那不是冷读，那是抽读。一次读完整本，
 *      才知道"前面埋的东西后面有没有落地"。
 *
 *   2. **提示词强制它别复述剧情**。模型最爱干的事是"第一章讲了……第二章讲
 *      了……"。要求它先说分数和结论，再说不足，且每条必须点到章与段，
 *      这样回执才可能是可执行的。
 *
 *   3. **不替作者改稿**。冷读产出的是意见，进意见池；采纳与否是作者的决定。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as store from './store.js'

const COLD_DIR = 'coldread'
const MAX_BOOK_CHARS = 900000 // 约 90 万字；再长就分批读，不然单次塞爆上下文

function fail(message, code = 'invalid') {
  const error = new Error(message)
  error.code = code
  throw error
}

function stamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '')
}

function trimTitle(text, chapter) {
  const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/)
  let head = 0
  while (head < lines.length && !lines[head].trim()) head += 1
  const first = String(lines[head] ?? '').trim()
  if (/^第\s*[0-9一二三四五六七八九十百千零两]+\s*[回章节]/.test(first) && first.length <= 40) {
    return { title: first, body: lines.slice(head + 1).join('\n').trim() }
  }
  return { title: `第 ${chapter} 回`, body: String(text ?? '').trim() }
}

/**
 * 生成冷读包：把指定范围的正文拼成一份 txt，返回文件路径 + 提示词。
 *
 * @param {{scope?: 'book'|'chapter'|'range', chapter?: number, from?: number, to?: number}} options
 */
export async function prepareColdRead(root, projectId, options = {}) {
  const { meta: project } = await store.getProject(root, projectId)
  const rows = await store.listChapters(root, projectId)
  if (!rows.length) fail('这本书还没有任何章节，冷读无从谈起')

  const scope = ['book', 'chapter', 'range'].includes(options.scope) ? options.scope : 'book'
  let picked = rows.slice()
  if (scope === 'chapter') {
    const chapter = Number(options.chapter) || 0
    if (!chapter) fail('要冷读单章就说第几回（chapter）')
    picked = rows.filter((row) => Number(row.chapter) === chapter)
    if (!picked.length) fail(`没有第 ${chapter} 回`, 'missing')
  } else if (scope === 'range') {
    const from = Number(options.from) || 0
    const to = Number(options.to) || 0
    if (!from || !to) fail('要冷读一段就说 from 与 to')
    picked = rows.filter((row) => Number(row.chapter) >= Math.min(from, to) && Number(row.chapter) <= Math.max(from, to))
    if (!picked.length) fail(`第 ${from}–${to} 回之间没有章节`, 'missing')
  }

  // 被否掉的章不进冷读：作者已经判它不算数，塞进去只会拉低分数
  picked = picked.filter((row) => String(row.status ?? '') !== 'rejected')
  if (!picked.length) fail('选中的章节都被否掉了，没有可读的正文')

  const parts = []
  let chars = 0
  const used = []
  for (const row of picked) {
    const doc = await store.getChapter(root, projectId, Number(row.chapter))
    const text = String(doc?.text ?? '').trim()
    if (!text) continue
    const cut = trimTitle(text, Number(row.chapter))
    const block = `【${cut.title}】\n\n${cut.body}`
    if (chars + block.length > MAX_BOOK_CHARS && used.length > 0) break
    parts.push(block)
    used.push(Number(row.chapter))
    chars += block.length
  }
  if (!parts.length) fail('选中的章节正文都是空的')

  const dir = await store.projectDir(root, projectId)
  const outDir = path.join(dir, COLD_DIR)
  await fs.mkdir(outDir, { recursive: true })
  const name = String(project?.name ?? projectId)
  const tag = scope === 'chapter' ? `第${used[0]}回` : (scope === 'range' ? `第${used[0]}-${used[used.length - 1]}回` : '全文')
  const fileName = `冷读-${name}-${tag}-${stamp()}.txt`
  const filePath = path.join(outDir, fileName)
  await fs.writeFile(filePath, `${name}\n\n${parts.join('\n\n')}\n`, 'utf8')

  const range = scope === 'chapter'
    ? `第 ${used[0]} 回`
    : (used.length > 1 ? `第 ${used[0]}–${used[used.length - 1]} 回（${used.length} 回）` : `第 ${used[0]} 回`)
  const truncated = used.length < picked.length

  const prompt = [
    '你是一个独立审稿人，也是这本书的第一批付费读者。你没读过它的任何设定、大纲、人物卡，也没参与写作——这正是重点。',
    '',
    `书稿在：${filePath}`,
    `书名：${name}；范围：${range}；约 ${chars} 字。${truncated ? '（原文更长，这里只放了前一部分）' : ''}`,
    '',
    '请用 read 工具一次读完这个 txt。不要拆章节，不要调用别的工具，不要问我补充信息。',
    '',
    '读完后，只回答下面四件事，按顺序，不要客套、不要复述剧情：',
    '',
    '1. 分数：0–100 的追读吸引力分。一句话说为什么是这个数。',
    '2. 结论：建议继续付钱追 / 再看看 / 弃书。给一句理由。',
    '3. 不足：哪些地方让你想跳过。**每条以「第N回：」开头**，指到回与段落（能引原句更好），一两条说清一件事，最多 10 条。分成「硬伤」（逻辑不通、人物崩、设定矛盾）和「观感」（拖、水、尬）两类。',
    '4. 高光：真有写得好的地方，单独一两行「高光：第N回……」。这类会被记进高光账本，不需要作者处理。',
    '',
    '最后只调一次工具上报：coldread.submit(op 用 report.submit 也行)，带上 score、verdict、以及 items:[{chapter, kind:"weakness"|"highlight", comment, quote}]。',
    'quote 必须是正文里的逐字原文，否则对不上段落，作者没法一键跳过去看。',
  ].join('\n')

  return {
    filePath,
    fileName,
    scope,
    chapters: used,
    truncated,
    chars,
    words: chars,
    prompt,
    hint: `把这段提示词发到对话里，让 agent 读文件；回执用 report.submit 交回来（role="nightwrite-reader-proxy"）。`,
  }
}

/** 列出已经生成过的冷读包（只列文件，不读内容）。 */
export async function listColdReads(root, projectId) {
  const dir = await store.projectDir(root, projectId)
  const outDir = path.join(dir, COLD_DIR)
  let names = []
  try {
    names = await fs.readdir(outDir)
  } catch (error) {
    if (error?.code === 'ENOENT') return { items: [] }
    throw error
  }
  const items = []
  for (const name of names.filter((n) => n.endsWith('.txt')).sort().reverse().slice(0, 50)) {
    const full = path.join(outDir, name)
    const stat = await fs.stat(full).catch(() => null)
    items.push({
      name,
      path: full,
      bytes: stat?.size ?? 0,
      at: stat ? stat.mtime.toISOString() : '',
    })
  }
  return { items }
}
