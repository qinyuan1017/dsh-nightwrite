/**
 * 长夜 · 扫榜（第 4 批）
 *
 * 先说清楚这一块的诚实边界：
 *   粘榜单文本进来解析 —— 稳，永远能用。
 *   自动抓网页 —— 反爬随时变，只能「尽力而为」，抓不到就要说抓不到。
 *
 * 所以两个入口分开做，界面上也分开摆：不把易碎的东西伪装成可靠的东西。
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { projectDir, StoreError } from './store.js'
import { serializeBy } from './lock.js'

const fail = (message, code = 'invalid') => { throw new StoreError(message, code) }

/**
 * 把「粘进来的榜单」解析成行。
 *
 * 真实榜单粘出来长这样（各种平台略有差别）：
 *   1. 我在大明当暴君  历史  38.2万收藏
 *   2 重生之我家有矿 都市 96.5万
 *   第3名 北望山河（权谋）21.7万
 *   4、纸上谈兵 古言 18.9万 ↑12
 * 共同点是：名次在前、书名在后、中间或后面跟题材与数字。
 * 所以策略是「先剥名次，再找数字，中间那段拆成书名+题材」，而不是死磕某一种格式。
 */
export function parseRanking(text) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((row) => row.trim()).filter(Boolean)
  const rows = []
  for (const line of lines) {
    // 表头 / 分隔线 / 说明句，跳过。
    // 说明句的坑：真实榜单底部一定有「说明：数据每小时更新」，它没有名次也没有数字，
    // 光靠「剥名次失败」判断不出来，会当成一本没有收藏的书混进榜里。
    if (/(?:排名|名次|序号|书名|作品|平台|题材|收藏|趋势|热度)/.test(line) && !/^\d/.test(line)) continue
    if (/^(?:说明|备注|注|数据来源|更新时间|统计时间|提示)[：:（(]/.test(line)) continue
    if (/^[-=_—–\s|·]+$/.test(line)) continue
    if (line.length < 3) continue

    let rest = line
    // 1) 剥名次：开头的 1. / 1、/ 第1名 / [1] / 1)
    let rank = 0
    const rankHit = /^(?:第\s*)?(\d{1,4})\s*(?:名|位)?\s*[.、,，)）:：|\]]?\s*/.exec(rest)
    if (rankHit) {
      rank = Number(rankHit[1])
      rest = rest.slice(rankHit[0].length).trim()
    }
    if (!rest) continue

    // 2) 收藏 / 热度数字：38.2万、96.5 万、1.2亿、12.3w
    let collect = ''
    const collectHit = /(\d+(?:\.\d+)?)\s*(万|亿|w|W|千)?\s*(?:收藏|追读|在读|热度|推荐|月票)?/.exec(rest)
    if (collectHit) {
      const unit = collectHit[2] ?? ''
      collect = `${collectHit[1]}${unit}`
      rest = (rest.slice(0, collectHit.index) + rest.slice(collectHit.index + collectHit[0].length)).trim()
    }

    // 3) 趋势：↑12 / ↓2 / — 0 / +5
    let trend = ''
    const trendHit = /([↑↓—–+-])\s*(\d{1,4})/.exec(rest)
    if (trendHit) {
      const sign = trendHit[1] === '+' ? '↑' : trendHit[1] === '-' ? '↓' : trendHit[1]
      trend = `${sign} ${trendHit[2]}`
      rest = (rest.slice(0, trendHit.index) + rest.slice(trendHit.index + trendHit[0].length)).trim()
    }

    // 4) 剩下的：书名 + 题材。括号里的当题材；没有括号就看最后一个空格分段
    let book = rest
    let genre = ''
    const paren = /[（(【\[]([^）)】\]]{1,10})[）)】\]]/.exec(rest)
    if (paren) {
      genre = paren[1].trim()
      book = (rest.slice(0, paren.index) + rest.slice(paren.index + paren[0].length)).trim()
    } else {
      const parts = rest.split(/[\s|/·]+/).filter(Boolean)
      if (parts.length >= 2) {
        genre = parts[parts.length - 1]
        book = parts.slice(0, -1).join(' ')
      }
    }
    book = book.replace(/^[《「]|[》」]$/g, '').replace(/\s+/g, ' ').trim()
    if (!book) continue
    // 一行里既没名次也没数字，多半不是榜单行（说明句、页脚、广告）。
    // 保留它会把「本书单每日更新」变成一本 0 收藏的书，污染题材分布与上升榜。
    if (!rank && !collect) continue
    if (!rank) rank = rows.length + 1

    rows.push({
      rank, book, genre, collect, trend, raw: line,
    })
  }
  return rows
}

/** 落盘目录：<project>/scans/sb_xxx.json */
async function scansDir(root, projectId, { create = false } = {}) {
  const dir = await projectDir(root, projectId)
  const base = path.join(dir, 'scans')
  if (create) await fs.mkdir(base, { recursive: true })
  return base
}

async function readIndex(base) {
  try {
    const raw = await fs.readFile(path.join(base, 'index.json'), 'utf8')
    const data = JSON.parse(raw)
    return Array.isArray(data?.items) ? data.items : []
  } catch {
    return []
  }
}

async function writeIndex(base, items) {
  await fs.writeFile(path.join(base, 'index.json'), JSON.stringify({ items }, null, 2), 'utf8')
}

/**
 * 保存一次扫榜结果。platform 必填 —— 不写平台，下次看这张表就不知道是哪个榜。
 */
export async function saveScan(root, projectId, payload = {}) {
  const rows = Array.isArray(payload.rows) ? payload.rows : parseRanking(payload.text)
  if (!rows.length) fail('一行都没解析出来。确认粘的是「名次 书名 题材 数字」这种一行一条的榜。')
  const platform = String(payload.platform ?? '').trim() || '未注明'
  const genre = String(payload.genre ?? '').trim()
  const data = {
    id: `sb_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    platform,
    genre,
    note: String(payload.note ?? '').trim(),
    createdAt: new Date().toISOString(),
    rows,
    count: rows.length,
    // 榜单自身能算出来的三件事：题材分布、收藏中位数、上升最多
    genres: Object.entries(rows.reduce((acc, row) => {
      const key = row.genre || '未标注'
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {})).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    rising: rows
      .map((row) => ({ book: row.book, delta: Number(String(row.trend ?? '').replace(/[^\d]/g, '')) || 0, sign: /↓/.test(row.trend) ? -1 : 1 }))
      .map((row) => ({ ...row, delta: row.delta * row.sign }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5),
  }
  const base = await scansDir(root, projectId, { create: true })
  // 单次扫榜文件按 id 命名，不冲突；冲突的是 index.json 那份数组。
  await serializeBy(path.join(base, 'index.json'), async () => {
    await fs.writeFile(path.join(base, `${data.id}.json`), JSON.stringify(data, null, 2), 'utf8')
    const items = await readIndex(base)
    await writeIndex(base, [{ id: data.id, platform, genre, createdAt: data.createdAt, count: data.count }, ...items].slice(0, 40))
  })
  return data
}

export async function listScans(root, projectId) {
  const base = await scansDir(root, projectId)
  const items = await readIndex(base)
  return { items, total: items.length }
}

export async function getScan(root, projectId, id) {
  const base = await scansDir(root, projectId)
  const name = String(id ?? '').trim()
  if (!/^sb_[0-9a-z]{4,20}$/.test(name)) fail('扫榜 id 不合法')
  try {
    return JSON.parse(await fs.readFile(path.join(base, `${name}.json`), 'utf8'))
  } catch {
    fail(`没有这次扫榜：${name}`, 'missing')
  }
}

/**
 * 尽力而为的抓取。
 *
 * 这里刻意不写一堆选择器：榜单页结构一个月能改三版，写死的选择器只会变成
 * 「昨天还能用」的谎言。做法是抓 HTML → 去标签 → 交给 parseRanking 同一套规则，
 * 抓不到就老实返回 ok:false 让人改成粘贴。超时也是短的：卡住比失败更烦人。
 */
export async function fetchRanking(payload = {}) {
  const url = String(payload.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) fail('要给 http(s) 开头的地址')
  const timeout = Math.max(3000, Math.min(20000, Number(payload.timeout ?? 8000) || 8000))
  let html = ''
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeout),
      headers: {
        // 不带 UA 会被一部分站点直接 403，带太像脚本也会。这句是折中。
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9',
      },
    })
    if (!res.ok) return { ok: false, status: res.status, reason: `站点回了 HTTP ${res.status}`, rows: [], text: '' }
    html = await res.text()
  } catch (error) {
    return { ok: false, status: 0, reason: `抓不到：${error.message}（榜单站反爬很常见，改成手动粘贴吧）`, rows: [], text: '' }
  }
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<\/(?:li|tr|div|p|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map((row) => row.trim()).filter(Boolean).join('\n')
  const rows = parseRanking(text)
  return {
    ok: rows.length > 0,
    status: 200,
    reason: rows.length ? '' : '抓到了网页，但没认出榜单行 —— 大概率是结构变了或需要登录',
    rows,
    text: text.slice(0, 20000),
    html: text.length,
  }
}
