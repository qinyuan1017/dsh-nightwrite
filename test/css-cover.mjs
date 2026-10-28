// 静态核查：src/*.js 里用到的 cy- 类名，是否都在 85-css.js 里定义过。
// 只做「字符串里出现过 cy-xxx」这一层扫描，够抓漏写的样式。
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src')
const files = (await fs.readdir(dir)).filter((f) => /^\d+.*\.js$/.test(f))
const css = await fs.readFile(path.join(dir, '85-css.js'), 'utf8')

const used = new Set()
for (const f of files) {
  if (f === '85-css.js') continue
  const text = await fs.readFile(path.join(dir, f), 'utf8')
  for (const m of text.matchAll(/cy-[a-zA-Z0-9-]+/g)) used.add(m[0])
}
const missing = [...used].filter((c) => !css.includes(`.${c}`)).sort()
console.log(`用到 ${used.size} 个 cy- 类；CSS 里缺 ${missing.length} 个`)
if (missing.length) console.log(missing.join('\n'))
