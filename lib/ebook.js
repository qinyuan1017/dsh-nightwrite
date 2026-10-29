/**
 * 长夜 · 成书导出（TXT / MD / EPUB / DOCX）
 *
 * 治的病：小说写到能读之后，作者第一件事是拿去给朋友看，或者上传到平台。
 * 这时候如果只能导出「原始 txt 文件夹」，读者收到的是 chapters/0001.txt 这种
 * 一坨一坨的文件，还得自己拼。成书导出就是把「文件集合」变成「一本书」。
 *
 * 四条刻意的设计：
 *   1. **目录和正文分开生成**，任何格式都从同一份 chapter 列表出发。
 *      格式只决定「怎么排」，不决定「收哪些章」——否则四种格式会导出差不同的书。
 *   2. **跳过废弃章**。status==='rejected' 的章是作者明确不要的，导出时不能混进去。
 *   3. **EPUB 按标准顺序写**：mimetype 必须是第一个条目且不压缩，否则阅读器
 *      直接判定「不是合法 EPUB」——这是最常见的自研导出翻车点。
 *   4. **不引依赖**。EPUB 和 DOCX 都是 zip + XML，lib/zip.js 已经能打 store 模式
 *      的 zip，再引 jszip / docx 只会多一个要跟着宿主升级的东西。
 *
 * 生成的字节直接交给 HTTP 层下载，不落盘——落盘会产生「导出文件」这类
 * 需要清理、需要版本管理、和正文混在一起的垃圾。
 */

import { buildZip } from './zip.js'

export const BOOK_FORMATS = ['txt', 'md', 'epub', 'docx']

/** 导出时跳过这些状态：作者已经明确不要的章不该出现在成书里。 */
const SKIP_STATUS = new Set(['rejected'])

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 章节按章号排序；同号按状态优先 accepted > review > draft > 其它。 */
const STATUS_RANK = { accepted: 0, review: 1, draft: 2 }

function orderChapters(chapters) {
  return [...chapters]
    .filter((c) => !SKIP_STATUS.has(c.status))
    .sort((a, b) => {
      const na = Number(a.chapter) || 0
      const nb = Number(b.chapter) || 0
      if (na !== nb) return na - nb
      return (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)
    })
}

/** 正文首行如果是「第X回 标题」就当章名，正文里不再重复一遍。 */
function splitTitle(chapter, text) {
  const body = String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
  const lines = body.split('\n')
  const first = (lines[0] ?? '').trim()
  const looksTitle =
    /^第\s*[0-9一二三四五六七八九十百千零〇两]+\s*[回章节]/.test(first) ||
    (first.length <= 30 && lines.length > 1)
  if (looksTitle) {
    return { title: first, body: lines.slice(1).join('\n').trim() }
  }
  return { title: String(chapter.title ?? `第 ${chapter.chapter} 回`), body }
}

/** 统一成「一行一段，空行分段」的纯文本，TXT / EPUB / DOCX 都吃这个形态。 */
function paragraphs(body) {
  return String(body ?? '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, '').trim())
    .filter(Boolean)
}

/** ── TXT ──────────────────────────────────────────────── */
export function buildTxt(book) {
  const lines = []
  lines.push(book.title)
  if (book.author) lines.push(`作者：${book.author}`)
  lines.push('')
  lines.push('目录')
  lines.push('')
  for (const ch of book.chapters) lines.push(`  ${ch.title}`)
  lines.push('')
  for (const ch of book.chapters) {
    lines.push('')
    lines.push('—'.repeat(20))
    lines.push(ch.title)
    lines.push('')
    lines.push(...paragraphs(ch.body))
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

/** ── Markdown ─────────────────────────────────────────── */
export function buildMarkdown(book) {
  const lines = []
  lines.push(`# ${book.title}`)
  lines.push('')
  if (book.author) lines.push(`> 作者：${book.author}`)
  if (book.genre) lines.push(`> 题材：${book.genre}`)
  lines.push('')
  lines.push('## 目录')
  lines.push('')
  for (const ch of book.chapters) lines.push(`- ${ch.title}`)
  lines.push('')
  for (const ch of book.chapters) {
    lines.push(`## ${ch.title}`)
    lines.push('')
    for (const p of paragraphs(ch.body)) {
      lines.push(p)
      lines.push('')
    }
  }
  return Buffer.from(`${lines.join('\n')}\n`, 'utf8')
}

/** ── EPUB 3 ───────────────────────────────────────────── */
export function buildEpub(book, options = {}) {
  const uuid = String(options.uuid ?? `urn:uuid:nightwrite-${Date.now()}`)
  const files = {}

  // 必须第一个、必须不压缩（本项目的 zip 是 store 模式，天然满足）
  files.mimetype = 'application/epub+zip'

  files['META-INF/container.xml'] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">',
    '  <rootfiles>',
    '    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    '  </rootfiles>',
    '</container>',
  ].join('\n')

  const manifest = []
  const spine = []
  const nav = []
  book.chapters.forEach((ch, index) => {
    const id = `ch${String(index + 1).padStart(4, '0')}`
    const name = `text/${id}.xhtml`
    manifest.push(`    <item id="${id}" href="${name}" media-type="application/xhtml+xml"/>`)
    spine.push(`    <itemref idref="${id}"/>`)
    nav.push(`      <li><a href="${name}">${esc(ch.title)}</a></li>`)
    const paras = paragraphs(ch.body)
      .map((p) => `    <p>${esc(p)}</p>`)
      .join('\n')
    files[`OEBPS/${name}`] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE html>',
      '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">',
      '<head>',
      '  <meta charset="UTF-8"/>',
      `  <title>${esc(ch.title)}</title>`,
      '  <link rel="stylesheet" type="text/css" href="../style.css"/>',
      '</head>',
      '<body>',
      `  <h2>${esc(ch.title)}</h2>`,
      paras,
      '</body>',
      '</html>',
    ].join('\n')
  })

  files['OEBPS/content.opf'] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">',
    '  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">',
    `    <dc:identifier id="bookid">${esc(uuid)}</dc:identifier>`,
    `    <dc:title>${esc(book.title)}</dc:title>`,
    `    <dc:language>zh-CN</dc:language>`,
    book.author ? `    <dc:creator>${esc(book.author)}</dc:creator>` : '',
    '    <meta property="dcterms:modified">' +
      new Date().toISOString().replace(/\.\d+Z$/, 'Z') +
      '</meta>',
    '  </metadata>',
    '  <manifest>',
    '    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>',
    '    <item id="css" href="style.css" media-type="text/css"/>',
    ...manifest,
    '  </manifest>',
    '  <spine>',
    '    <itemref idref="nav"/>',
    ...spine,
    '  </spine>',
    '</package>',
  ]
    .filter(Boolean)
    .join('\n')

  files['OEBPS/nav.xhtml'] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE html>',
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN">',
    '<head><meta charset="UTF-8"/><title>目录</title></head>',
    '<body>',
    '  <nav epub:type="toc" id="toc">',
    '    <h1>目录</h1>',
    '    <ol>',
    ...nav,
    '    </ol>',
    '  </nav>',
    '</body>',
    '</html>',
  ].join('\n')

  files['OEBPS/style.css'] = [
    'body { line-height: 1.85; margin: 1em; }',
    'p { text-indent: 2em; margin: 0 0 0.6em 0; }',
    'h1, h2 { text-align: center; font-weight: normal; margin: 1.2em 0 1em 0; }',
  ].join('\n')

  // 顺序：mimetype 先写，其余按字典序（内容顺序无所谓，只要 mimetype 在最前）
  const ordered = {}
  ordered.mimetype = files.mimetype
  for (const key of Object.keys(files).sort()) {
    if (key !== 'mimetype') ordered[key] = files[key]
  }
  return buildZip(ordered)
}

/** ── DOCX ─────────────────────────────────────────────── */
export function buildDocx(book) {
  const files = {}

  files['[Content_Types].xml'] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '  <Default Extension="xml" ContentType="application/xml"/>',
    '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
    '</Types>',
  ].join('\n')

  files['_rels/.rels'] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '</Relationships>',
  ].join('\n')

  files['word/_rels/document.xml.rels'] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '</Relationships>',
  ].join('\n')

  files['word/styles.xml'] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '  <w:docDefaults>',
    '    <w:rPrDefault><w:rPr>',
    '      <w:rFonts w:ascii="Times New Roman" w:eastAsia="宋体" w:hAnsi="Times New Roman"/>',
    '      <w:sz w:val="24"/>',
    '    </w:rPr></w:rPrDefault>',
    '    <w:pPrDefault><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:pPrDefault>',
    '  </w:docDefaults>',
    '  <w:style w:type="paragraph" w:styleId="Body"><w:name w:val="Body"/><w:pPr><w:ind w:firstLine="480"/></w:pPr></w:style>',
    '  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>',
    '</w:styles>',
  ].join('\n')

  const para = (text, style) =>
    `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`

  const body = []
  body.push(para(book.title, 'Heading1'))
  if (book.author) body.push(para(`作者：${book.author}`))
  for (const ch of book.chapters) {
    body.push(para(''))
    body.push(para(ch.title, 'Heading1'))
    for (const p of paragraphs(ch.body)) body.push(para(p, 'Body'))
  }

  files['word/document.xml'] = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    ...body,
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1800" w:bottom="1440" w:left="1800"/></w:sectPr>',
    '</w:body>',
    '</w:document>',
  ].join('\n')

  return buildZip(files)
}

/**
 * 成书装配：把 chapters（含 text）+ 作品元信息变成统一结构。
 *
 * @param {{meta:object, chapters:Array<{chapter,title,status,text}>}} input
 */
export function assembleBook(input) {
  const meta = input?.meta ?? {}
  const chapters = orderChapters(input?.chapters ?? []).map((ch) => {
    const { title, body } = splitTitle(ch, ch.text)
    return { chapter: Number(ch.chapter) || 0, title, body, status: ch.status }
  })
  return {
    title: String(meta.name ?? '未命名'),
    author: String(meta.author ?? ''),
    genre: String(meta.genre ?? ''),
    chapters,
    words: chapters.reduce((sum, ch) => sum + ch.body.replace(/\s+/g, '').length, 0),
  }
}

/** 按格式出字节 + 建议文件名。 */
export function renderBook(book, format, options = {}) {
  const fmt = String(format ?? 'txt').toLowerCase()
  if (!BOOK_FORMATS.includes(fmt)) {
    const error = new Error(`不支持的格式：${fmt}；可用：${BOOK_FORMATS.join(' / ')}`)
    error.code = 'invalid'
    throw error
  }
  const safeName = book.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 60) || 'book'
  const map = {
    txt: { buffer: () => buildTxt(book), mime: 'text/plain; charset=utf-8', ext: 'txt' },
    md: { buffer: () => buildMarkdown(book), mime: 'text/markdown; charset=utf-8', ext: 'md' },
    epub: { buffer: () => buildEpub(book, options), mime: 'application/epub+zip', ext: 'epub' },
    docx: {
      buffer: () => buildDocx(book),
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ext: 'docx',
    },
  }
  const pick = map[fmt]
  return {
    format: fmt,
    buffer: pick.buffer(),
    mime: pick.mime,
    filename: `${safeName}.${pick.ext}`,
  }
}
