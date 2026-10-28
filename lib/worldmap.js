/**
 * 长夜 · 世界地图（对齐 LNW 的 map 面板）
 *
 * 解决的问题：账本里已经有「地点」这一类，但它是一张表——作者看得见「雁门关」
 * 「应天府」各自在第几回出现，看不见它们在空间上什么关系。写到第五章要「从雁门
 * 关赶到应天府」，得翻账本才知道这两个地方离多远、走哪条路。地图就是把这张表
 * 摆平。
 *
 * 三条刻意的设计：
 *
 *   1. **坐标由作者定，不自动推断**。谁也没法从「雁门关」三个字算出它在哪。
 *      所以 map.sync 只负责把账本里新出现的地点摆进画布（螺旋排布，保证不重叠、
 *      可拖动），位置对不对由作者拖。假装能自动布局才是骗人。
 *
 *   2. **地图是账本的视图，不是第二份真相**。节点 id 就是账本行的 id，名字、
 *      状态、首次出现章节全部从账本读；地图文件只存 x/y 与连线。这样账本改名，
 *      地图上跟着变，不会出现「地图写着雁门关、账本写着雁门」两套。
 *
 *   3. **账本删了地点，地图不立刻删节点**，标成 orphan。作者可能只是整理账本，
 *      过一会儿又加回来；地图上突然少一个点比多一个灰点更让人慌。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import * as store from './store.js'

const MAP_FILE = 'map.json'
const MAP_VERSION = 1

/** 画布逻辑坐标系：0..1000 正方形。客户端按这个比例缩放到 SVG 视口。 */
export const MAP_CANVAS = { width: 1000, height: 1000 }

/** 自动摆放：阿基米德螺旋，间距随序号增长，保证新点不压在旧点上。 */
function spiralSlot(index) {
  const step = (index + 1) * 0.9
  const angle = step * 2.399963229728653 // 黄金角，散得均匀又稳定
  const radius = 40 + Math.sqrt(index + 1) * 76
  const cx = MAP_CANVAS.width / 2
  const cy = MAP_CANVAS.height / 2
  return {
    x: Math.round(Math.min(MAP_CANVAS.width - 40, Math.max(40, cx + Math.cos(angle) * radius))),
    y: Math.round(Math.min(MAP_CANVAS.height - 40, Math.max(40, cy + Math.sin(angle) * radius))),
  }
}

function fail(message, code = 'invalid') {
  const error = new Error(message)
  error.code = code
  throw error
}

function mapFile(dir) {
  return path.join(dir, MAP_FILE)
}

const nowIso = () => new Date().toISOString()

function emptyMap() {
  return { schemaVersion: MAP_VERSION, updatedAt: nowIso(), nodes: [], edges: [] }
}

async function readMap(dir) {
  try {
    const text = await fs.readFile(mapFile(dir), 'utf8')
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return emptyMap()
    return {
      schemaVersion: Number(parsed.schemaVersion ?? MAP_VERSION),
      updatedAt: String(parsed.updatedAt ?? nowIso()),
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyMap()
    // 坏了不该让世界库整页打不开——退回空图，界面上还有账本表可看
    return emptyMap()
  }
}

async function writeMap(dir, map) {
  const next = { ...map, schemaVersion: MAP_VERSION, updatedAt: nowIso() }
  await fs.writeFile(mapFile(dir), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function clamp(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return null
  return Math.min(MAP_CANVAS.width, Math.max(0, Math.round(v)))
}

/**
 * 把账本里的地点同步进地图。
 *
 * 已在图里的地点保留它的 x/y 与备注（作者手动摆过的位置不能被覆盖）；
 * 新地点走螺旋排布；账本里已经不存在的地点标 orphan，不删。
 */
export async function syncMap(root, projectId) {
  const dir = await store.projectDir(root, projectId)
  const map = await readMap(dir)
  const ledger = await store.getLedger(root, projectId)
  const rows = Array.isArray(ledger?.locations) ? ledger.locations : []

  const byId = new Map(map.nodes.map((node) => [String(node.id), node]))
  const seen = new Set()
  const added = []
  let nextIndex = map.nodes.length

  for (const row of rows) {
    const id = String(row?.id ?? '').trim()
    if (!id) continue
    seen.add(id)
    const existing = byId.get(id)
    if (existing) {
      // 只同步「账本是真相」的字段，位置与备注留着
      existing.name = String(row.name ?? existing.name ?? id)
      existing.type = String(row.type ?? '')
      existing.state = String(row.state ?? '')
      existing.firstChapter = Number(row.firstChapter ?? 0) || 0
      existing.orphan = false
      continue
    }
    const slot = spiralSlot(nextIndex)
    nextIndex += 1
    const node = {
      id,
      name: String(row.name ?? id),
      type: String(row.type ?? ''),
      state: String(row.state ?? ''),
      firstChapter: Number(row.firstChapter ?? 0) || 0,
      x: slot.x,
      y: slot.y,
      note: '',
      orphan: false,
    }
    map.nodes.push(node)
    byId.set(id, node)
    added.push(node)
  }

  let orphaned = 0
  for (const node of map.nodes) {
    if (!seen.has(String(node.id))) {
      if (!node.orphan) orphaned += 1
      node.orphan = true
    }
  }

  const saved = await writeMap(dir, map)
  return { ...saved, added: added.length, orphaned }
}

/** 读地图（不自动同步——读操作不该改盘）。 */
export async function getMap(root, projectId) {
  const dir = await store.projectDir(root, projectId)
  const map = await readMap(dir)
  const ledger = await store.getLedger(root, projectId)
  const rows = Array.isArray(ledger?.locations) ? ledger.locations : []
  const known = new Set(rows.map((row) => String(row?.id ?? '')))
  return {
    ...map,
    canvas: MAP_CANVAS,
    // inLedger=false 的点在界面上画成灰的：地图有、账本没有，说明账本删过
    nodes: map.nodes.map((node) => ({ ...node, inLedger: known.has(String(node.id)) })),
    counts: {
      nodes: map.nodes.length,
      edges: map.edges.length,
      orphan: map.nodes.filter((node) => !known.has(String(node.id))).length,
    },
  }
}

/**
 * 保存位置与连线。
 *
 * 局部更新：只传 nodes: [{id,x,y}] 就只动这几个点的坐标，
 * 不传 edges 就不动连线——避免「拖一个点」把整张图的连线一起覆盖掉。
 */
export async function saveMap(root, projectId, payload = {}) {
  const dir = await store.projectDir(root, projectId)
  const map = await readMap(dir)
  const byId = new Map(map.nodes.map((node) => [String(node.id), node]))

  let moved = 0
  if (Array.isArray(payload.nodes)) {
    for (const patch of payload.nodes) {
      const id = String(patch?.id ?? '').trim()
      if (!id) continue
      const node = byId.get(id)
      if (!node) continue
      const x = clamp(patch.x)
      const y = clamp(patch.y)
      if (x !== null) node.x = x
      if (y !== null) node.y = y
      if (patch.note !== undefined) node.note = String(patch.note ?? '').slice(0, 200)
      if (patch.removed === true) node.hidden = true
      if (patch.removed === false) delete node.hidden
      moved += 1
    }
  }

  if (Array.isArray(payload.edges)) {
    const valid = new Set(map.nodes.map((node) => String(node.id)))
    map.edges = payload.edges
      .map((edge) => ({
        from: String(edge?.from ?? '').trim(),
        to: String(edge?.to ?? '').trim(),
        label: String(edge?.label ?? '').slice(0, 40),
        kind: ['road', 'sea', 'border', 'secret'].includes(edge?.kind) ? edge.kind : 'road',
      }))
      .filter((edge) => edge.from && edge.to && edge.from !== edge.to && valid.has(edge.from) && valid.has(edge.to))
    // 去重：A→B 与 B→A 是同一条路，存一次
    const seen = new Set()
    map.edges = map.edges.filter((edge) => {
      const key = [edge.from, edge.to].sort().join('|')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  const saved = await writeMap(dir, map)
  return { ...saved, moved, canvas: MAP_CANVAS }
}

/** 连线前先算一算：这两个地点之间有没有正文依据？没有就提示「这是你手画的」。 */
export async function explainEdge(root, projectId, from, to) {
  const dir = await store.projectDir(root, projectId)
  const map = await readMap(dir)
  const ledger = await store.getLedger(root, projectId)
  const rows = Array.isArray(ledger?.locations) ? ledger.locations : []
  const pick = (id) => rows.find((row) => String(row.id) === String(id)) ?? null
  const a = pick(from)
  const b = pick(to)
  const known = Array.isArray(map.edges) ? map.edges.find((e) => (
    (String(e.from) === String(from) && String(e.to) === String(to))
    || (String(e.from) === String(to) && String(e.to) === String(from))
  )) : null
  const shared = []
  const ca = Number(a?.firstChapter ?? 0)
  const cb = Number(b?.firstChapter ?? 0)
  if (ca && cb) shared.push(ca === cb ? `两个地点都在第 ${ca} 回首次出现` : `首次出现章隔了 ${Math.abs(ca - cb)} 回`)
  return {
    from: a ? { id: a.id, name: a.name, firstChapter: ca } : null,
    to: b ? { id: b.id, name: b.name, firstChapter: cb } : null,
    existing: known,
    notes: shared,
    hint: known ? '这条线已经画过了。' : '这条线是两个地点之间的手画关系，账本里没有「相邻」这种字段——它只是帮你记路，不会被当成设定校验依据。',
  }
}
