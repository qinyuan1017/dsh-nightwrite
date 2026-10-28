#!/usr/bin/env node
/**
 * 长夜 · 界面文案抽取器（i18n 骨架第一部分）
 *
 * 把 `src/*.js` 里**用户能看见的中文**抽成键值表，写成 locale/zh.json。
 *
 * 为什么用「中文原文当键」（gettext 风格）而不是 `cockpit.title` 这种手写键：
 *   · 18 个片段里 1000 多处文案，手写语义键等于把 18 个文件读一遍再编一套名字，
 *     既慢又必然编不一致。
 *   · 中文原文当键是稳定的：同一句文案永远是同一个键，重新抽取不会漂移，
 *     en.json 里的译文不会被下一版抽取打乱（这是哈希键/序号键做不到的）。
 *   · 接入时 `t('驾驶舱')` 读起来和原来的字面量一模一样，改动最小。
 *
 * 抽取规则（宁可少抽，不要抽错）：
 *   ✗ 注释里的中文（不是文案）
 *   ✗ console.* / throw new Error(*) 里的中文（日志与异常，不上屏）
 *   ✗ 15-mock.js（那是演示用的假书稿，不是界面文案）
 *   ✗ 含 `${…}` 的模板串（带插值，静态表放不下，留给后续 commit）
 *   ✗ 含换行 / 制表符的多行串
 *   ✗ 长度 > 160 的长段落（是正文/提示长文，不是界面文案）
 *   ✓ 其余单/双引号与无插值反引号串里含 CJK 的
 *
 * 用法：
 *   node scripts/gen-i18n.mjs           # 重新生成 locale/zh.json
 *   node scripts/gen-i18n.mjs --check   # 校验 locale/zh.json 与源码同步
 *   node scripts/gen-i18n.mjs --list    # 列出所有键（带出处 file:line）
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const srcDir = path.join(repoRoot, 'src')
const outPath = path.join(repoRoot, 'locale', 'zh.json')

const CJK = /[\u4e00-\u9fff]/
const SKIP_FILES = new Set(['15-mock.js'])
const MAX_LEN = 160

/**
 * 极简 JS 扫描器：只做一件事——把字符串字面量连同「它在什么上下文里」摘出来。
 * 不用正则硬扫，因为 `'` 出现在注释、正则、模板里都会误判。
 * 返回 [{ value, quote, line, expr, before }]
 */
export function scanStrings(source) {
  const out = []
  let i = 0
  let line = 1
  const n = source.length
  while (i < n) {
    const c = source[i]
    if (c === '\n') {
      line++
      i++
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') line++
        i++
      }
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      const startLine = line
      let j = i + 1
      let buf = ''
      let expr = false
      while (j < n) {
        const d = source[j]
        if (d === '\\') {
          buf += source[j] + (source[j + 1] ?? '')
          j += 2
          continue
        }
        if (quote === '`' && d === '$' && source[j + 1] === '{') {
          expr = true
          j += 2
          let depth = 1
          while (j < n && depth) {
            if (source[j] === '{') depth++
            else if (source[j] === '}') depth--
            if (source[j] === '\n') line++
            j++
          }
          continue
        }
        if (d === quote) {
          j++
          break
        }
        if (d === '\n') line++
        buf += d
        j++
      }
      out.push({
        value: buf,
        quote,
        line: startLine,
        expr,
        before: source.slice(Math.max(0, i - 160), i),
      })
      i = j
      continue
    }
    i++
  }
  return out
}

/** 这个字符串是不是「不上屏」的上下文。 */
function isInternal(context) {
  if (/(?:^|[^\w$])console\.\w+\([^()]*$/.test(context.before)) return 'console'
  if (/throw new Error\([^()]*$/.test(context.before)) return 'throw'
  if (/new Error\([^()]*$/.test(context.before)) return 'throw'
  if (/\/\/|\/\*/.test(context.before.slice(-4))) return 'comment'
  return ''
}

const files = (await fs.readdir(srcDir)).filter((f) => /^\d+.*\.js$/.test(f)).sort()

/** key → { file, line, files:Set } */
const keys = new Map()
const skipped = {
  mock: 0,
  expr: 0,
  internal: 0,
  long: 0,
  multiline: 0,
  ascii: 0,
  fragment: 0,
  block: 0,
}

for (const file of files) {
  if (SKIP_FILES.has(file)) {
    skipped.mock += scanStrings(await fs.readFile(path.join(srcDir, file), 'utf8')).length
    continue
  }
  const source = await fs.readFile(path.join(srcDir, file), 'utf8')
  for (const lit of scanStrings(source)) {
    if (!CJK.test(lit.value)) {
      skipped.ascii++
      continue
    }
    if (lit.expr) {
      skipped.expr++
      continue
    }
    if (lit.value.length > MAX_LEN) {
      skipped.long++
      continue
    }
    if (/[\n\t]/.test(lit.value)) {
      skipped.multiline++
      continue
    }
    // 以空白开头 = 拼接片段（`${n}` + ` 字`）。单独一条「 字」翻不了，
    // 强行收进表里只会让译者对着半个词发呆，留给后续带插值的那一批。
    if (lit.value !== lit.value.trimStart()) {
      skipped.fragment++
      continue
    }
    // 字面量里的 \n（提示词模板正文），是多行块不是界面短句。
    if (lit.value.includes(String.fromCharCode(92) + 'n')) {
      skipped.block++
      continue
    }
    const why = isInternal(lit)
    if (why) {
      skipped.internal++
      continue
    }
    const key = lit.value
    if (!keys.has(key)) keys.set(key, { file, line: lit.line, hits: 0 })
    keys.get(key).hits++
  }
}

const sorted = [...keys.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))

if (process.argv.includes('--list')) {
  for (const key of sorted) {
    const at = keys.get(key)
    console.log(`${at.file}:${at.line}\t${at.hits}x\t${key}`)
  }
  console.error(`\n共 ${sorted.length} 条键；跳过：${JSON.stringify(skipped)}`)
  process.exit(0)
}

const zh = {
  _meta: {
    locale: 'zh',
    count: sorted.length,
    source: 'src/*.js',
    note: '中文原文即键（gettext 风格）；重新抽取不会漂移。',
  },
}
for (const key of sorted) zh[key] = key

const json = `${JSON.stringify(zh, null, 2)}\n`
const mode = process.argv.includes('--check') ? 'check' : 'write'

if (mode === 'check') {
  let current = ''
  try {
    current = await fs.readFile(outPath, 'utf8')
  } catch {
    console.error('✗ 缺少 locale/zh.json；先跑 node scripts/gen-i18n.mjs')
    process.exit(1)
  }
  if (current !== json) {
    console.error('✗ locale/zh.json 与 src/*.js 的界面文案不同步；重新生成')
    process.exit(1)
  }
  console.log(`OK locale/zh.json 同步（${sorted.length} 条）`)
} else {
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, json, 'utf8')
  console.log(`OK locale/zh.json  ${sorted.length} 条键`)
  console.log(
    `   跳过：console/throw ${skipped.internal} · 含插值 ${skipped.expr} · 拼接片段 ${skipped.fragment} · 提示词块 ${skipped.block} · 超长 ${skipped.long} · 多行 ${skipped.multiline} · 15-mock ${skipped.mock}`,
  )
}
