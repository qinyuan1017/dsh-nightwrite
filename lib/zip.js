/**
 * 最小 ZIP 打包器（store 模式，不压缩）。
 *
 * 为什么自己写：导出是「把整个作品目录打包带走」这种一次性需求，
 * 为它引一个 archiver / jszip 进来，插件就多一个要跟着宿主升级的依赖。
 * ZIP 的 store 模式（compression method = 0）结构非常简单：
 *   本地文件头 + 原始字节 + 中央目录 + 目录结束记录，
 * 每个文件唯一需要算的是 CRC32。小说正文是纯文本，
 * 不压缩只是包大一点（几 MB），解压出来的内容完全一样。
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  return table
})()

function crc32(buf) {
  let crc = -1
  for (let i = 0; i < buf.length; i += 1) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

/** 递归列出目录下所有文件（相对路径，统一用 /）。跳过临时文件。 */
export async function walkFiles(dir, base = dir, out = []) {
  let entries = []
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    // .reorder-* 是重排章号时的中间态，不属于作品内容。
    if (entry.name.startsWith('.reorder-')) continue
    if (entry.isDirectory()) {
      await walkFiles(full, base, out)
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).split(path.sep).join('/'))
    }
  }
  return out
}

/**
 * 把 { 相对路径: Buffer|string } 打成 zip。
 * 返回 Buffer。默认带一个顶层目录名前缀，解压出来不会把一堆文件撒在桌面。
 */
export function buildZip(files, options = {}) {
  const prefix = String(options.prefix ?? '').replace(/\/+$/, '')
  const local = []
  const central = []
  let offset = 0

  const now = options.date instanceof Date ? options.date : new Date()
  // ZIP 的时间是 DOS 格式：秒只有 2 秒精度，年份从 1980 起算。
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xffff
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const [name, value] of Object.entries(files)) {
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8')
    const entryName = prefix ? `${prefix}/${name}` : name
    const nameBuf = Buffer.from(entryName, 'utf8')
    const crc = crc32(data)

    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0) // 本地文件头签名
    header.writeUInt16LE(20, 4) // 需要版本 2.0
    header.writeUInt16LE(0x0800, 6) // 标志位：文件名用 UTF-8
    header.writeUInt16LE(0, 8) // 压缩方法 0 = store
    header.writeUInt16LE(dosTime, 10)
    header.writeUInt16LE(dosDate, 12)
    header.writeUInt32LE(crc, 14)
    header.writeUInt32LE(data.length, 18) // 压缩后大小
    header.writeUInt32LE(data.length, 22) // 原始大小
    header.writeUInt16LE(nameBuf.length, 26)
    header.writeUInt16LE(0, 28) // 扩展字段长度

    local.push(header, nameBuf, data)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0) // 中央目录签名
    dir.writeUInt16LE(20, 4) // 创建版本
    dir.writeUInt16LE(20, 6) // 需要版本
    dir.writeUInt16LE(0x0800, 8)
    dir.writeUInt16LE(0, 10)
    dir.writeUInt16LE(dosTime, 12)
    dir.writeUInt16LE(dosDate, 14)
    dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(data.length, 20)
    dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(nameBuf.length, 28)
    dir.writeUInt16LE(0, 30) // 扩展字段
    dir.writeUInt16LE(0, 32) // 注释
    dir.writeUInt16LE(0, 34) // 磁盘号
    dir.writeUInt16LE(0, 36) // 内部属性
    dir.writeUInt32LE(0, 38) // 外部属性
    dir.writeUInt32LE(offset, 42) // 本地头偏移
    central.push(dir, nameBuf)

    offset += header.length + nameBuf.length + data.length
  }

  const centralBuf = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0) // 目录结束签名
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralBuf.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // 注释长度

  return Buffer.concat([...local, centralBuf, end])
}

/** 读一个目录，打成 zip（用于「导出全部数据」）。 */
export async function zipDirectory(dir, options = {}) {
  const names = await walkFiles(dir)
  const files = {}
  for (const name of names) {
    files[name] = await fs.readFile(path.join(dir, name))
  }
  return { buffer: buildZip(files, options), count: names.length }
}
