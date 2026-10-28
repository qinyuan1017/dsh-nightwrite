// 长夜 · hooks 顺序检查
//
// 为什么需要这个文件：2026-10-28 用户报「提案界面点了打不开」。根因不是数据、
// 不是路由，是 ProposalBoard 的 useMemo 写在了三个 `if (...) return` 之后。
//
// 第一帧 res.loading 为真，走 `return h(Loading)` 直接退出，那个 useMemo 一次都没调；
// 数据回来重渲染，hook 数量从 5 变成 6，React 数不上就直接抛错，整页白屏。
// 表现就是「点进去一片空白」——不报错、不提示，最难查。
//
// smoke.mjs 只渲染一次、不复现「loading → 有数据」这个转折，所以它抓不到。
// 这个检查器是静态的，把这类错误挡在写代码的时候。
//
// 用法：node test/hooks.mjs

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(here, '..', 'src')

let pass = 0
let fail = 0
const bad = []

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1
  } else {
    fail += 1
    bad.push(`${name}${detail ? `\n    ${detail}` : ''}`)
  }
}

// 本项目所有自定义 hook 的名字都要在这里登记，否则漏检。
const HOOK_RE = /(^|[^.\w$])(useState|useEffect|useMemo|useRef|useCallback|useContext|useReducer|useLayoutEffect|useTransitions?|useDeferredValue|useId|useSyncExternalStore|useAsync|useUndoText|useToast|useKeyed|useInterval)\s*\(/

// 组件/自定义 hook 的开头：顶层 function 大写 或 function use 大写
const HEAD_RE = /^function\s+([A-Z]\w*|use[A-Z]\w*)\s*\(/

const files = readdirSync(srcDir).filter((f) => f.endsWith('.js')).sort()

let scanned = 0
let componentCount = 0

for (const file of files) {
  const lines = readFileSync(path.join(srcDir, file), 'utf8').split('\n')
  const heads = []
  lines.forEach((line, i) => {
    const m = HEAD_RE.exec(line)
    if (m) heads.push({ at: i, name: m[1] })
  })

  heads.forEach((head, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].at : lines.length
    scanned += 1

    // 找出这个函数体里所有的 hook 调用行与所有「缩进 2 格的 return」行。
    const hooks = []
    const returns = []
    for (let i = head.at + 1; i < end; i += 1) {
      const line = lines[i]
      if (/^\s*\/\//.test(line)) continue
      if (HOOK_RE.test(line)) hooks.push(i)
      // 只认函数体顶层（缩进 2 空格）的 return，函数内部的回调不算。
      if (/^ {2}(if\s*\(.*\)\s*)?return\b/.test(line)) returns.push(i)
      // 逐字量出的 `} else {` 之类不影响，这里只看 return 位置。
    }
    if (!hooks.length) return
    componentCount += 1

    const firstHook = hooks[0]
    const earlyReturn = returns.find((i) => i < firstHook)
    if (earlyReturn !== undefined) {
      bad.push(
        `${file}:${head.at + 1} ${head.name} — 第 ${earlyReturn + 1} 行就 return 了，`
        + `第一个 hook 在第 ${firstHook + 1} 行；这个组件第一次渲染会少调 hook`,
      )
      fail += 1
      return
    }

    // hook 之后再出现顶层 return 是正常的（render 前的兜底），
    // 但 return 之后不许再有 hook。
    let sawReturn = false
    for (const i of hooks.slice(1)) {
      if (returns.some((r) => r < i)) sawReturn = true
      if (sawReturn) {
        bad.push(
          `${file}:${head.at + 1} ${head.name} — 第 ${i + 1} 行仍调 hook，`
          + `但它上面已经有顶层 return（第 ${returns.filter((r) => r < i).pop() + 1} 行）`,
        )
        fail += 1
        return
      }
    }
    pass += 1
  })
}

check('扫到了组件（自我检查：防止路径写错导致 0 个组件也算全绿）', componentCount >= 40, `实扫 ${componentCount} 个`)
check('扫描文件数', files.length >= 15, `实扫 ${files.length} 个`)

console.log('')
if (bad.length) {
  console.log('✗ hooks 顺序违规：')
  bad.forEach((line) => console.log(`  - ${line}`))
  console.log('')
}
console.log(`${pass} 过 / ${fail} 不过 · 共 ${pass + fail} 项`)
if (fail) {
  console.log('\n修法：把这些 hook 全部挪到任何一个 `return` 之前。')
  console.log('渲染分支只能决定「画什么」，不能决定「调不调 hook」。')
}
process.exit(fail ? 1 : 0)
