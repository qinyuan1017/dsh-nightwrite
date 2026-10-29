// 核对「源码里用到的 nw-* 类名」是否都在 CSS 里有定义。
// 用来防止改界面时写出没有样式的类名（看着加了功能，其实一片裸文本）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const srcDir = path.join(root, 'src')

// 只认真源码段（`NN-*.js`）；`.bak-*` 备份不算，否则旧类名会被当成在用。
const files = fs.readdirSync(srcDir).filter((name) => /^\d+-[a-z-]+\.js$/.test(name))
const source = files
  .filter((name) => name !== '85-css.js')
  .map((name) => fs.readFileSync(path.join(srcDir, name), 'utf8'))
  .join('\n')
const css = fs.readFileSync(path.join(srcDir, '85-css.js'), 'utf8')

// 变量名 `var(--nw-amber)` 也会被正则抓到，它们不是类名，先剥掉。
const used = new Set(source.replace(/--nw-[a-z0-9-]+/g, '').match(/nw-[a-z0-9-]+/g) ?? [])
const defined = new Set((css.match(/\.(nw-[a-z0-9-]+)/g) ?? []).map((hit) => hit.slice(1)))

// 模板前缀片段：拼出来的类名（`nw-tag-${tone}`）本身不会有定义，跳过。
const PREFIX =
  /^nw-(bar|dot|tag|stat|score|prop|prob|ptl|heat|para|export|q|theme|debt-dot|dp|lint|lint-cal|map-edge|opinion|health|policy|cost|lamp|run-verdict|today-run)-$/
const keyframes = new Set(
  (css.match(/@keyframes\s+(nw-[a-z0-9-]+)/g) ?? []).map((hit) => hit.split(/\s+/)[1]),
)

const missing = [...used]
  .filter(
    (name) =>
      !defined.has(name) && !keyframes.has(name) && !PREFIX.test(name) && name !== 'nw-btn-',
  )
  .sort()

console.log(
  `用到 ${used.size} 个 nw-* · CSS 定义 ${defined.size} 个 · keyframes ${keyframes.size} 个`,
)
if (missing.length) {
  console.log(`缺失 ${missing.length} 个：`)
  missing.forEach((name) => console.log(`  ${name}`))
  process.exit(1)
}
console.log('缺失 0 个')
