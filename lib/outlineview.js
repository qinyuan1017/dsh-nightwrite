/**
 * 大纲取段器（对应 oh-story 的 scripts/outline_view.py，但不需要人工标作用域）
 *
 * 它的做法：卷纲里手写 `> 作用域：卷级常任` / `> 单元级 D1-03`，脚本按标记切字符串。
 * 人忘了标就取不出来，标错了就取错。
 *
 * 我们的数据本来就是结构化的（volumes[].chapters[]），所以不需要标记：
 * 按卷号、章号区间直接切片；并且保证返回体不超过 maxBytes —— 一千章的大纲
 * 整本塞给模型是没意义的，模型看不了，还烧上下文。
 *
 * 三级降级：超预算时先砍 summary，再砍 hook，最后只留章号 + 标题。
 * 每一级都记在 degraded 里，调用方能知道「你看到的是砍过的」。
 */

export const OUTLINE_SLICE_MAX_BYTES = 8192

/** JSON 序列化后的实际字节数（UTF-8，中文 3 字节，不能按字符数算） */
export function byteLength(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return Buffer.byteLength(text, 'utf8')
}

function num(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 把大纲的 volumes 压成统一形状，防止上游存了脏数据 */
function normalizeVolumes(outline) {
  const list = Array.isArray(outline?.volumes) ? outline.volumes : []
  return list.map((vol, index) => {
    const chapters = (Array.isArray(vol?.chapters) ? vol.chapters : [])
      .map((row) => ({
        chapter: num(row?.chapter, 0),
        title: String(row?.title ?? ''),
        summary: String(row?.summary ?? ''),
        hook: String(row?.hook ?? ''),
        status: String(row?.status ?? 'todo'),
      }))
      .filter((row) => row.chapter > 0)
      .sort((a, b) => a.chapter - b.chapter)
    return {
      id: String(vol?.id ?? `vol_${index + 1}`),
      index: num(vol?.index, index + 1),
      title: String(vol?.title ?? `第${index + 1}卷`),
      summary: String(vol?.summary ?? ''),
      chapters,
    }
  })
}

/**
 * 按字段级别裁一章。降级顺序按「对写作者的价值」排：
 *   3 全量（summary + hook）
 *   2 去钩子，留摘要        ← 找「这一章该写什么」时摘要比钩子重要
 *   1 去摘要，留标题        ← 只找章
 *   0 只剩章号              ← 只要目录
 *  -1 只给卷（不给章）       ← 一千章的书，全书视角就该只看到卷
 */
function shapeChapter(row, level) {
  if (level >= 3) {
    return {
      chapter: row.chapter,
      title: row.title,
      summary: row.summary,
      hook: row.hook,
      status: row.status,
    }
  }
  if (level === 2) {
    return { chapter: row.chapter, title: row.title, summary: row.summary, status: row.status }
  }
  if (level === 1) {
    return { chapter: row.chapter, title: row.title, status: row.status }
  }
  if (level === 0) {
    return { chapter: row.chapter }
  }
  return null
}

/** 每卷进度：写了几章、还剩几章、按章数算的百分比 */
export function volumeProgress(vol) {
  const chapters = Array.isArray(vol?.chapters) ? vol.chapters : []
  let written = 0
  let drafted = 0
  for (const row of chapters) {
    const status = String(row?.status ?? 'todo')
    if (status === 'written') written += 1
    else if (status === 'drafted') drafted += 1
  }
  const total = chapters.length
  const done = written + drafted
  return {
    total,
    written,
    drafted,
    todo: total - done,
    percent: total ? Math.round((done / total) * 100) : 0,
  }
}

/**
 * 取大纲的一段。
 *
 * @param {object} outline           getOutline() 的返回值
 * @param {object} [options]
 * @param {number|string} [options.volume]   只要这一卷（卷号）
 * @param {number|string} [options.from]     起始章号（含）
 * @param {number|string} [options.to]       结束章号（含）
 * @param {boolean} [options.toc]            true = 只要目录（等同 withBody:false）
 * @param {boolean} [options.withBody]       是否带 summary / hook，默认 true；toc 时强制 false
 * @param {number}  [options.maxBytes]       返回体字节上限，默认 8192
 * @param {boolean} [options.brief]          是否返回 brief，默认只在没切段时返回
 * @returns {{scope:object, volumes:Array, total:number, returned:number, omitted:number,
 *            bytes:number, level:number, degraded:boolean, truncated:boolean,
 *            brief?:object, progress:object}}
 */
export function pickOutline(outline, options = {}) {
  const all = normalizeVolumes(outline)
  const maxBytes = Math.max(512, num(options.maxBytes, OUTLINE_SLICE_MAX_BYTES))
  const withBody = options.toc === true ? false : options.withBody !== false

  const volumeFilter = options.volume === undefined || options.volume === null || options.volume === ''
    ? null
    : num(options.volume, 0)
  const fromRaw = options.from === undefined || options.from === null || options.from === ''
    ? null
    : num(options.from, 0)
  const toRaw = options.to === undefined || options.to === null || options.to === ''
    ? null
    : num(options.to, 0)
  const lo = fromRaw !== null && toRaw !== null && fromRaw > toRaw ? toRaw : fromRaw
  const hi = fromRaw !== null && toRaw !== null && fromRaw > toRaw ? fromRaw : toRaw

  const inRange = (n) => {
    if (lo !== null && n < lo) return false
    if (hi !== null && n > hi) return false
    return true
  }

  const total = all.reduce((sum, vol) => sum + vol.chapters.length, 0)

  // 先按卷 / 章号筛，再决定预算怎么花
  let picked = all
    .filter((vol) => volumeFilter === null || vol.index === volumeFilter)
    .map((vol) => {
      const chapters = vol.chapters.filter((row) => inRange(row.chapter))
      return { ...vol, chapters }
    })
    .filter((vol) => vol.chapters.length > 0)

  const returned = picked.reduce((sum, vol) => sum + vol.chapters.length, 0)

  const scope = {
    volume: volumeFilter,
    from: picked.length ? picked[0].chapters[0].chapter : null,
    to: picked.length
      ? picked[picked.length - 1].chapters[picked[picked.length - 1].chapters.length - 1].chapter
      : null,
    toc: withBody === false,
  }

  const progress = picked.reduce(
    (acc, vol) => {
      const p = volumeProgress(vol)
      return {
        total: acc.total + p.total,
        written: acc.written + p.written,
        drafted: acc.drafted + p.drafted,
        todo: acc.todo + p.todo,
      }
    },
    { total: 0, written: 0, drafted: 0, todo: 0 },
  )

  const build = (level) => {
    if (level < 0) {
      // 卷级目录：连章号都不给，只给每卷的范围与进度。一千章的书最省的样子。
      return picked.map((vol) => {
        const rows = vol.chapters
        return {
          index: vol.index,
          title: vol.title,
          from: rows[0]?.chapter ?? null,
          to: rows[rows.length - 1]?.chapter ?? null,
          chapters: [],
          progress: volumeProgress(vol),
        }
      })
    }
    return picked.map((vol) => {
      const chapters = vol.chapters
        .map((row) => shapeChapter(row, level))
        .filter(Boolean)
      return {
        index: vol.index,
        title: vol.title,
        from: vol.chapters[0]?.chapter ?? null,
        to: vol.chapters[vol.chapters.length - 1]?.chapter ?? null,
        chapters,
        progress: volumeProgress(vol),
      }
    })
  }

  // 从全量开始逐级降级，直到塞进预算。3→2→1→0→-1：
  // 最后一级是「只给卷，不给章」——宁可少给，也不截断一半章节让调用方
  // 以为看全了。一千章的书在 -1 级约 2.9KB。
  const levels = withBody ? [3, 2, 1, 0, -1] : [1, 0, -1]
  let level = levels[0]
  let volumes = build(level)
  let bytes = byteLength(volumes)

  for (const candidate of levels) {
    level = candidate
    volumes = build(level)
    bytes = byteLength(volumes)
    if (bytes <= maxBytes) break
  }

  const truncated = level < 0
  // 连「只给卷」都塞不下（maxBytes 小到不现实）：如实标超预算，不假装成功
  const overBudget = bytes > maxBytes

  const out = {
    scope,
    volumes,
    total,
    returned,
    kept: volumes.reduce((sum, vol) => sum + vol.chapters.length, 0),
    omitted: total - returned,
    bytes,
    level,
    degraded: level < levels[0],
    truncated,
    overBudget,
    progress,
  }

  // 没切段（看全书）时把 brief 一起给出来，切了段就不占预算
  if (options.brief === true || (options.brief !== false && volumeFilter === null && lo === null && hi === null)) {
    const brief = outline?.brief && typeof outline.brief === 'object' ? outline.brief : null
    if (brief) {
      const trimmed = { ...brief }
      delete trimmed.volumes
      delete trimmed.chaptersPerVolume
      out.brief = trimmed
    }
  }

  return out
}

/** 只算统计不取正文：给「还剩几章没写」这类展示用，返回体极小 */
export function outlineStats(outline) {
  const all = normalizeVolumes(outline)
  const volumes = all.map((vol) => ({
    index: vol.index,
    title: vol.title,
    ...volumeProgress(vol),
  }))
  const total = volumes.reduce((sum, v) => sum + v.total, 0)
  const written = volumes.reduce((sum, v) => sum + v.written, 0)
  const drafted = volumes.reduce((sum, v) => sum + v.drafted, 0)
  return {
    volumes,
    total,
    written,
    drafted,
    todo: total - written - drafted,
    percent: total ? Math.round(((written + drafted) / total) * 100) : 0,
  }
}
