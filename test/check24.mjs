/**
 * 长夜 · 24 条界面增补自查
 *
 * 源码里每一处增补都带 `【24 条 #N】` 标记。这个脚本把标记扫出来，
 * 校验 1..24 每条都至少有一处实现，并打印「编号 → 文件:行号 → 代码」对照表。
 *
 * 用法：node test/check24.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, '..')
const srcDir = path.join(root, 'src')

const NAMES = {
  1: '状态灯',
  2: '底栏右侧两个按钮',
  3: 'Ctrl+K 命令面板',
  4: '一句大白话 + 一个按钮',
  5: '两周柱状图',
  6: '全书进度条',
  7: '大纲卡片墙',
  8: '三视图（列表/卡片/时间线）',
  9: 'AI 填整卷摘要',
  10: '上下文可拖可关',
  11: '预算条',
  12: '意图复用最近三次',
  13: '正文右侧彩带',
  14: '点问题正文那句亮起来',
  15: 'J/K/A/R 键盘流',
  16: '提案批量处理',
  17: '问题单只看本章',
  18: '账本每格可点开看出处',
  19: '关系图过滤',
  20: '逾期伏笔标红',
  21: '最近干过什么',
  22: '扫榜结果表格',
  23: '导出全部数据',
  24: '主题第三档「纸」',
}

const files = readdirSync(srcDir).filter((n) => n.endsWith('.js')).sort()
const hits = new Map()
for (const file of files) {
  const lines = readFileSync(path.join(srcDir, file), 'utf8').split('\n')
  lines.forEach((text, i) => {
    const re = /【24 条 #(\d+)】/g
    let m
    while ((m = re.exec(text))) {
      const n = Number(m[1])
      if (!hits.has(n)) hits.set(n, [])
      hits.get(n).push({ file, line: i + 1, code: lines[i + 1]?.trim() ?? '' })
    }
  })
}

let bad = 0
const rows = []
for (let n = 1; n <= 24; n += 1) {
  const list = hits.get(n) ?? []
  if (!list.length) bad += 1
  rows.push({ n, name: NAMES[n], list })
}

console.log('编号  名称                      实现位置')
console.log('────  ────────────────────────  ─────────────────────────────────────────────')
for (const row of rows) {
  if (!row.list.length) {
    console.log(`${String(row.n).padStart(4)}  ${row.name.padEnd(24)}  ✗ 没有实现标记`)
    continue
  }
  row.list.forEach((hit, i) => {
    const head = i === 0 ? `${String(row.n).padStart(4)}  ${row.name.padEnd(24)}  ` : `${' '.repeat(4)}  ${' '.repeat(24)}  `
    console.log(`${head}src/${hit.file}:${hit.line}`)
    if (hit.code) console.log(`${' '.repeat(32)}  ${hit.code.slice(0, 78)}`)
  })
}

const extra = [...hits.keys()].filter((n) => n < 1 || n > 24)
if (extra.length) console.log(`\n有 ${extra.length} 个越界编号：${extra.join(', ')}`)

console.log(`\n覆盖 ${24 - bad} / 24 条 · 共 ${[...hits.values()].reduce((a, b) => a + b.length, 0)} 处标记`)
process.exit(bad ? 1 : 0)
