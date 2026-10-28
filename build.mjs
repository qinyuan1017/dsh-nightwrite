/**
 * 长夜 · 客户端构建
 *
 * 把 src/*.js 按文件名顺序拼成 lib/client.js（单文件，无构建工具）。
 * 每个片段都在同一个 factory 作用域内，共享 React / h / 常量 / 控件。
 * 拼接后自动跑 node --check；失败不写盘。
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(here, 'src')
const outFile = path.join(here, 'lib', 'client.js')

const files = (await fs.readdir(srcDir)).filter((name) => /^\d+.*\.js$/.test(name)).sort()
if (!files.length) {
  console.error('src/ 里没有片段')
  process.exit(1)
}

const parts = []
for (const file of files) {
  const text = await fs.readFile(path.join(srcDir, file), 'utf8')
  parts.push(`// ═════════ ${file} ═════════\n${text.trimEnd()}\n`)
}

const head = 'window.__ModuleLoader__.load({\n  id: \'dsh-changye\',\n  factory(require) {\n'
// factory 必须交出一个插件对象：宿主拿到 apply 去挂槽位。
// inject 只能是浏览器侧真有的服务。客户端没有 tools（那是服务端 index.js 的事），
// 写 'tools' 会让 cordis 永远等不到依赖、apply 一次都不跑 —— 症状就是插件装了但界面空白。
// _test 里塞三个内部组件，供 test/smoke.mjs 直接渲染深水区（宿主不会读它）。
const tail = '\nreturn { name: \'changye\', inject: [\'slots\'], apply, _test: { Root, Workbench, ReviewDetail, PlanPage, ProposalBoard, ProblemBoard, CommandPalette, SourcePop, StatusLamp, PipelinePage, DispatchRow, RoleCard, LintPanel, LintBlockModal, LintCalibration, MapView, BookExport, UpdateCard, ColdReadPanel, OpinionBoard, BriefingCard, ChapterHealth, TaskPackBoard } }\n  },\n})\n'

const body = parts.join('\n')
const out = `${head}${body}${tail}`

const tmp = path.join(path.dirname(outFile), `.build-${Date.now()}.js`)
await fs.mkdir(path.dirname(outFile), { recursive: true })
await fs.writeFile(tmp, out, 'utf8')

try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' })
} catch (error) {
  await fs.rm(tmp, { force: true })
  console.error('语法检查失败，未写盘：')
  console.error(String(error.stderr ?? error.message))
  process.exit(1)
}

await fs.rename(tmp, outFile)
const stat = await fs.stat(outFile)
console.log(`OK ${files.length} 段 -> lib/client.js  ${stat.size} 字节`)
