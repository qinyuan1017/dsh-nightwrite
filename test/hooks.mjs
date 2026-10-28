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

// 去掉引号内的内容和行内注释，只留下能影响括号深度的骨架。
// 只处理单行字符串 / 模板片 / 注释；本项目没有跨行字符串参与 hook 判定的情形。
function stripNoise(line) {
  return line
    .replace(/\/\/.*$/, '')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``')
}

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

    // 找出这个函数体里所有的 hook 调用行与所有顶层 return 行。
    //
    // 不能靠缩进判断：最常见的早退是
    //     if (broken) {
    //       return h(...)
    //     }
    // return 缩进 4 格，而它确实是顶层返回。只认 `^ {2}return` 会整片漏掉，
    // StudioPage 就是这么漏过去的（扫描器全绿、eslint 报 9 条、页面白屏）。
    //
    // 改成数花括号深度：函数体的 `{` 打开后深度为 1，
    // 深度回到 1 时遇到的 return 就是顶层 return。
    const hooks = []
    const returns = []
    let depth = 0
    // 哪几层是「嵌套函数体」—— 这些层里的 return 不算组件的顶层返回。
    const fnDepths = []
    for (let i = head.at; i < end; i += 1) {
      const raw = lines[i]
      if (/^\s*\/\//.test(raw)) continue
      const line = stripNoise(raw)
      if (i > head.at && HOOK_RE.test(raw)) hooks.push(i)

      // 逐字符走，才能知道每个 `{` 是不是箭头函数 / function 的函数体。
      let before = ''
      for (let k = 0; k < line.length; k += 1) {
        const ch = line[k]
        if (ch === '{') {
          depth += 1
          // `=>` 结尾 → 箭头函数体；含 `function` → 普通函数体。
          if (/=>\s*$/.test(before) || /\bfunction\b/.test(before)) fnDepths.push(depth)
          before = ''
          continue
        }
        if (ch === '}') {
          if (fnDepths.length && fnDepths[fnDepths.length - 1] === depth) fnDepths.pop()
          depth -= 1
          before = ''
          continue
        }
        before += ch
      }

      // 顶层返回 = 已在函数体内(depth>=1)，且不处于任何嵌套函数体里。
      if (depth >= 1 && fnDepths.length === 0 && /\breturn\b/.test(line)) returns.push(i)
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

// ── eslint 兜底 ──
// 手写扫描器总有边界漏（这个文件自己就漏过两版）。
// eslint 的 react-hooks 插件是同一类问题的权威判据，装了就跑，没装就跳过。
// 用 --no-install 保证不会联网装包。
let eslintNote = '（本机没有 eslint，跳过）'
try {
  const { execFileSync } = await import('node:child_process')
  // Windows 上 npx 是 npx.cmd、node_modules/.bin/eslint 是 .cmd 包装，
  // execFileSync 直接调会 ENOENT（或需要 shell:true，而 shell 会把带空格的路径拆开）。
  // 所以直接让 node 去跑 eslint 的入口 js。
  const eslintBin = path.join(here, '..', 'node_modules', 'eslint', 'bin', 'eslint.js')
  const out = execFileSync(process.execPath, [eslintBin, '.', '-f', 'json'], {
    cwd: path.join(here, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 120000,
  }).toString()
  const report = JSON.parse(out)
  const hits = []
  for (const file of report) {
    for (const m of file.messages) {
      if (m.ruleId && m.ruleId.includes('rules-of-hooks')) {
        hits.push(`${path.basename(file.filePath)}:${m.line}  ${m.message}`)
      }
    }
  }
  check('eslint · 没有 hook 顺序告警', hits.length === 0, hits.slice(0, 5).join('\n    '))
  eslintNote = hits.length ? `（eslint 报 ${hits.length} 条）` : '（eslint 通过）'
} catch (error) {
  // eslint 自己报错（未安装 / 配置坏）不算 lint 失败，但要在输出里说清楚。
  eslintNote = `（eslint 跑不起来：${String(error.message).slice(0, 80)}）`
}
check('扫描文件数', files.length >= 15, `实扫 ${files.length} 个`)

console.log('')
if (bad.length) {
  console.log('✗ hooks 顺序违规：')
  bad.forEach((line) => console.log(`  - ${line}`))
  console.log('')
}
console.log(`${pass} 过 / ${fail} 不过 · 共 ${pass + fail} 项`);
console.log(`hook 顺序检查 · ${eslintNote}`)
if (fail) {
  console.log('\n修法：把这些 hook 全部挪到任何一个 `return` 之前。')
  console.log('渲染分支只能决定「画什么」，不能决定「调不调 hook」。')
}
process.exit(fail ? 1 : 0)
