/**
 * 长夜 · 导入已有小说（第 3 批）
 *
 * 真实的痛点：作者手里已经有一本书，几十万字躺在 txt 里，
 * 想接着写，就得先把「第 307 章」这种纯文本变成能排序、能验收、能改的文件树。
 * 手工复制粘贴一千次不现实，所以这一步必须能一把梭。
 *
 * 两条原则：
 *   1. 先给人看预览（认出了几章、哪些是作者的话），确认了再落盘。
 *   2. 落盘走 store.saveChapter，不自己写文件 —— 这样历史版本、字数缓存、
 *      meta 结构跟正常写作完全一致，不会出现「导入的书功能少一半」。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { saveChapter, listChapters, countWords } from './store.js'
import { splitBook } from './analyze.js'

/**
 * 预览：只解析，不落盘。
 * 章号从 startAt 开始重排（默认按出现顺序），这样「第 12 章 序」这种脏号不会打架。
 */
export function previewImport(payload = {}) {
  const text = String(payload.text ?? '')
  if (!text.trim()) throw Object.assign(new Error('没有正文可导入'), { code: 'invalid' })
  const rows = splitBook(text)
  const chapters = rows.filter((row) => !row.noise)
  const noise = rows.filter((row) => row.noise).map((row) => row.title)
  const withBody = chapters.filter((row) => String(row.body ?? '').trim())
  return {
    chapters: withBody.length,
    skippedEmpty: chapters.length - withBody.length,
    noise,
    totalWords: withBody.reduce((sum, row) => sum + countWords(row.body), 0),
    // 预览只给前 20 章的标题与字数，整本列出来会把界面刷爆
    head: withBody.slice(0, 20).map((row, index) => ({
      at: index + 1,
      title: (row.title || row.raw || '').slice(0, 40),
      words: countWords(row.body),
      firstLine: (
        String(row.body)
          .split('\n')
          .find((line) => line.trim()) ?? ''
      )
        .trim()
        .slice(0, 40),
    })),
    truncated: withBody.length > 20,
  }
}

/**
 * 真导入。mode:
 *   append（默认）—— 接在现有最后一章后面
 *   replace      —— 先清空现有章节（进回收站，可找回），再写
 * 导入的章一律 status='review'：别人的稿也得过一遍验收，不该直接算「已采纳」。
 */
export async function runImport(root, projectId, payload = {}) {
  const text = String(payload.text ?? '')
  let body = text
  const source = String(payload.source ?? '').trim()
  if (!body.trim() && source) {
    try {
      body = await fs.readFile(source, 'utf8')
    } catch (error) {
      throw Object.assign(new Error(`读不到这个文件：${error.message}`), { code: 'missing' })
    }
  }
  if (!body.trim())
    throw Object.assign(new Error('没有正文可导入：给 text 或 source'), { code: 'invalid' })

  const rows = splitBook(body).filter((row) => !row.noise && String(row.body ?? '').trim())
  if (!rows.length) {
    throw Object.assign(new Error('一个章节标题都没认出来，检查一下是不是「第一章」这种格式'), {
      code: 'invalid',
    })
  }

  const mode = payload.mode === 'replace' ? 'replace' : 'append'
  const before = await listChapters(root, projectId)
  // 接在「已有最大章号」后面，不是接在「已有章数」后面。
  // 章号是文件名（0001.txt），中间删过章就会有空档：有 1/2/3/5 四章时 length 是 4，
  // 从 4 往后写会覆盖第 5 章 —— 这是会真丢稿的地方，所以取 max 而不是 length。
  const maxNum = before.reduce((max, row) => Math.max(max, Number(row.chapter) || 0), 0)
  let at = mode === 'replace' ? 0 : maxNum
  if (mode === 'replace') {
    // 走 store 的删除（进 .trash），不 fs.rm —— 导错了还能捞回来
    const { deleteChapter } = await import('./store.js')
    for (const row of before) {
      // eslint-disable-next-line no-await-in-loop
      await deleteChapter(root, projectId, row.chapter)
    }
  }

  const written = []
  for (const row of rows) {
    at += 1
    // eslint-disable-next-line no-await-in-loop
    const meta = await saveChapter(root, projectId, at, row.body, {
      status: 'review',
      title: String(row.title || '').slice(0, 60),
      importedAt: new Date().toISOString(),
      importedFrom: source || '(粘贴)',
      score: 0,
      issues: [],
      violations: [],
      cost: 0,
    })
    written.push({ chapter: at, title: meta.title, words: meta.words })
  }

  // 导入完把「卷」按每卷 chaptersPerVolume（默认 100 章）机械铺一层，
  // 让大纲页不是空的。故事层面的摘要留给 AI 回填，这里不假装能写。
  const per = Math.max(1, Math.min(200, Number(payload.chaptersPerVolume ?? 100) || 100))
  const volumes = []
  for (let i = 0; i < written.length; i += per) {
    const slice = written.slice(i, i + per)
    volumes.push({
      id: `vol_${Math.floor(i / per) + 1}`,
      index: Math.floor(i / per) + 1,
      title: `第 ${Math.floor(i / per) + 1} 卷`,
      summary: '',
      from: slice[0].chapter,
      to: slice[slice.length - 1].chapter,
      chapters: slice.map((row) => ({
        chapter: row.chapter,
        title: row.title ?? '',
        summary: '',
        hook: '',
        status: 'drafted',
      })),
    })
  }

  return {
    mode,
    written: written.length,
    from: written[0]?.chapter ?? 0,
    to: written[written.length - 1]?.chapter ?? 0,
    totalWords: written.reduce((sum, row) => sum + row.words, 0),
    volumes,
    // 界面拿这个把卷写进 outline.json；不让 import 直接改大纲，
    // 因为大纲可能已经有 AI 写好的摘要，覆盖掉是数据损失。
    outlinePatch: { volumes },
  }
}

/** 磁盘上的一个目录里所有 .txt/.md，按名排 —— 「把我的书导进来」最常见的入口。 */
export async function listDirFiles(dirPath) {
  const abs = path.resolve(String(dirPath ?? ''))
  let entries = []
  try {
    entries = await fs.readdir(abs, { withFileTypes: true })
  } catch (error) {
    throw Object.assign(new Error(`读不到这个目录：${error.message}`), { code: 'missing' })
  }
  const files = entries
    .filter((row) => row.isFile() && /\.(txt|md)$/i.test(row.name))
    .map((row) => row.name)
    .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { numeric: true }))
  return { dir: abs, files, count: files.length }
}

/** 把一个目录里的所有章节文件拼成一本，交给 splitBook / 导入。 */
export async function readDirAsBook(dirPath) {
  const { dir, files } = await listDirFiles(dirPath)
  if (!files.length)
    throw Object.assign(new Error('这个目录里没有 .txt / .md'), { code: 'missing' })
  const parts = []
  for (const name of files) {
    // eslint-disable-next-line no-await-in-loop
    const text = await fs.readFile(path.join(dir, name), 'utf8')
    parts.push(text)
  }
  return { text: parts.join('\n\n'), files: files.length, dir }
}
