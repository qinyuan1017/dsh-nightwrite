#!/usr/bin/env node
/**
 * 长夜 · ESLint 跨片段全局名生成器
 *
 * 背景：`src/*.js` 不是 18 个独立模块，而是 18 个**共享同一作用域**的片段，
 * 由 build.mjs 按文件名拼进同一个 factory 里。所以 20-cockpit.js 里写 `Btn`
 * 是完全正确的（Btn 在 10-core.js 定义），但 ESLint 单文件看就是 no-undef。
 *
 * 正确解法不是关掉 no-undef（那会把真拼错的变量名一起放过），
 * 而是把这个共享作用域**如实告诉 ESLint**：算出每个片段之外、其它片段定义的名字，
 * 作为该文件的只读全局名注入。
 *
 * 输出 eslint-globals.json：{ "src/20-cockpit.js": ["Btn", "useAsync", ...], ... }
 * 由 eslint.config.mjs 直接 import。
 *
 * 用法：
 *   node scripts/gen-eslint-globals.mjs          # 重新生成
 *   node scripts/gen-eslint-globals.mjs --check  # 只校验是否漂移
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')
const srcDir = path.join(repoRoot, 'src')
const outPath = path.join(repoRoot, 'eslint-globals.json')

/** 顶层声明：const/let/var/function/class，只在行首（0 缩进）匹配。
 *  `async function` / `export function` 这类前缀也要认，否则 api() 这种异步工具函数
 *  会被漏掉，然后在其它 17 个片段里集体报 no-undef。 */
const DECL_RE =
  /^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm
/** `const { a, b: c } = ...` 解构 */
const DESTRUCT_RE = /^(?:const|let|var)\s*\{([^}]*)\}\s*=/gm
/** `const [a, b] = ...` 数组解构 */
const ARRAY_RE = /^(?:const|let|var)\s*\[([^\]]*)\]\s*=/gm

/** 一个片段的顶层声明名。跳过字符串与注释里的假象（行首匹配 + 去注释已足够）。 */
function declaredNames(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const names = new Set()
  for (const m of code.matchAll(DECL_RE)) names.add(m[1])
  for (const m of code.matchAll(DESTRUCT_RE)) {
    for (const part of m[1].split(',')) {
      const key = part.split('=')[0].trim()
      if (!key) continue
      const alias = key.includes(':') ? key.split(':')[1].trim() : key
      if (/^[A-Za-z_$][\w$]*$/.test(alias)) names.add(alias)
    }
  }
  for (const m of code.matchAll(ARRAY_RE)) {
    for (const part of m[1].split(',')) {
      const key = part.trim()
      if (/^[A-Za-z_$][\w$]*$/.test(key)) names.add(key)
    }
  }
  return names
}

const files = (await fs.readdir(srcDir)).filter((name) => /^\d+.*\.js$/.test(name)).sort()
const own = new Map()
for (const name of files) {
  own.set(`src/${name}`, declaredNames(await fs.readFile(path.join(srcDir, name), 'utf8')))
}

const result = {}
for (const name of files) {
  const mine = new Set()
  for (const [other, names] of own) {
    if (other === `src/${name}`) continue
    for (const n of names) mine.add(n)
  }
  // 自己声明的从全局里剔掉，否则 no-redeclare 会报「重复声明」
  for (const n of own.get(`src/${name}`)) mine.delete(n)
  result[`src/${name}`] = [...mine].sort()
}

const json = `${JSON.stringify(result, null, 2)}\n`
const mode = process.argv.includes('--check') ? 'check' : 'write'

if (mode === 'check') {
  let current = ''
  try {
    current = await fs.readFile(outPath, 'utf8')
  } catch {
    console.error('✗ 缺少 eslint-globals.json；先跑 node scripts/gen-eslint-globals.mjs')
    process.exit(1)
  }
  if (current !== json) {
    console.error('✗ eslint-globals.json 与 src/*.js 的顶层声明不同步；重新生成')
    process.exit(1)
  }
  console.log(`OK eslint-globals.json 同步（${files.length} 个片段）`)
} else {
  await fs.writeFile(outPath, json, 'utf8')
  const total = Object.values(result).reduce((n, list) => n + list.length, 0)
  console.log(`OK eslint-globals.json  ${files.length} 个片段 / ${total} 个跨片段名`)
}
