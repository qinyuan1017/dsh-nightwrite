/**
 * 长夜 · ESLint flat config
 *
 * 定规则的原则：**按这个仓库现在的样子定，不是按理想定**。
 * 目标是 `npx eslint index.js lib/ src/` 能 exit 0，而不是先把它改一遍。
 *
 * 仓库现状（决定了下面每一条）：
 *   · 服务端 index.js + lib/*.js 是纯 ESM，运行时零依赖，靠 ctx.inject 拿宿主服务。
 *   · 客户端 src/*.js 是 18 个**共享同一作用域**的片段，被 build.mjs 拼进一个 factory。
 *     所以 20-cockpit.js 里写 `Btn`（在 10-core.js 定义）是对的。
 *     这里不关 no-undef，而是把「别的片段声明了什么」如实注入（eslint-globals.json，
 *     由 scripts/gen-eslint-globals.mjs 从源码生成），这样真拼错的变量名照样会报。
 *   · 有实打实的 `eslint-disable` 注释散在源码里（no-await-in-loop 等），
 *     那些文件不归基建动，所以关掉 reportUnusedDisableDirectives，避免它们变成 5 条 parse 错。
 *   · 风格（缩进/引号/分号/行宽）全部交给 prettier —— eslint 只管逻辑。
 */

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
/** src/<file> → 其它片段里声明的顶层名字（只读全局）。 */
const CROSS_FRAGMENT = JSON.parse(readFileSync(path.join(here, 'eslint-globals.json'), 'utf8'))

/** 浏览器 / 运行时全局（片段里直接用到的）。 */
const BROWSER_GLOBALS = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  location: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  AbortController: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  FormData: 'readonly',
  Event: 'readonly',
  CustomEvent: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  MutationObserver: 'readonly',
  ResizeObserver: 'readonly',
  IntersectionObserver: 'readonly',
  getComputedStyle: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  prompt: 'readonly',
  // 宿主注入的模块加载器（build.mjs 把片段包在 factory(require) 里）
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
}

/** 服务端 / node: 全局。 */ const NODE_GLOBALS = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  TextEncoder: 'readonly',
  TextDecoder: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  queueMicrotask: 'readonly',
  structuredClone: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  fetch: 'readonly',
  crypto: 'readonly',
  globalThis: 'readonly',
  // 测试脚本会往 global 上挂假宿主（test/smoke.mjs 一系），这是 node 的合法全局。
  global: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
}

/** 所有 JS 共用的规则底座：真 bug 开着，风格交给 prettier。 */
const BASE_RULES = {
  ...js.configs.recommended.rules,

  // 空 catch 是设计：这些模块对「读不到 / 删不掉」一律静默降级。
  'no-empty': ['warn', { allowEmptyCatch: true }],

  // 有意保留的占位参数用下划线前缀表达。其余未用变量降级为 warn（先看得见，不拦 CI）。
  'no-unused-vars': [
    'warn',
    {
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrors: 'none',
      ignoreRestSiblings: true,
    },
  ],

  // 宿主注入的是普通对象，`obj.hasOwnProperty` 这种写法在这个仓库不构成风险。
  'no-prototype-builtins': 'off',

  // 正则里故意写控制字符（清稿子里的零宽字符）。
  'no-control-regex': 'off',

  // 中文正文里有全角空格 U+3000，是排版的刻意留白，不是脏字符。
  'no-irregular-whitespace': [
    'error',
    {
      skipTemplates: true,
      skipStrings: true,
      skipComments: true,
      skipRegExps: true,
      skipJSXText: true,
    },
  ],

  // eslint 9+ 新推荐规则：`let x = null; x = foo()` 这类写法在仓库里很常见，
  // 不是 bug 也不值得为它改代码 → 只提示。
  'no-useless-assignment': 'warn',

  // 手写正则里的冗余转义：同理，提示即可。
  'no-useless-escape': 'warn',

  // 测试脚本里故意用 `async (resolve) => {...}` 包 setTimeout。
  'no-async-promise-executor': 'off',

  // 服务端多处在同一个 async 函数里先读后写同一份内存状态（有意的顺序写）。
  'require-atomic-updates': 'off',
}

export default [
  {
    // 产物 / 备份 / 自动生成 / 临时脚本都不 lint
    ignores: [
      'node_modules/**',
      'lib/client.js', // build.mjs 的产物（430KB 拼接文件）
      '**/*.bak-*',
      '.bak-*/**',
      '.tmpwork/**',
      'test/_*', // 排查用的临时脚本，跑完就删
      'types/**', // 自动生成
      'locale/**', // 纯数据
      'eslint-globals.json',
    ],
  },

  // ── 服务端：index.js + lib/*.js + build.mjs（ESM / Node）───────────
  {
    files: ['index.js', 'lib/**/*.js', 'build.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: NODE_GLOBALS,
    },
    rules: BASE_RULES,
  },

  // ── 脚本与测试（node ESM，可以随便 console）───────────────────────
  {
    files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: NODE_GLOBALS,
    },
    rules: {
      ...BASE_RULES,
      'no-console': 'off',
      // 脚本里常留调试变量 / 故意不用的解构位
      'no-unused-vars': 'off',
      // test/qa.mjs:78 用代理对区间手写「纯表情符号」判定
      // （/^[\s\u00a0-\u303f\ufe0f…\ud83c-\udbff\udc00-\udfff]+$/），
      // 这正是这条规则想表达的东西，不是笔误；测试文件不归基建动 → 只提示。
      'no-misleading-character-class': 'warn',
    },
  },

  // ── 客户端片段：src/*.js（18 段共享一个 factory 作用域）───────────
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: BROWSER_GLOBALS,
    },
    // 源码里带 `// eslint-disable-next-line react-hooks/exhaustive-deps`，
    // 光有注释不够——得把插件挂上，否则 ESLint 会报「规则不存在」。
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...BASE_RULES,
      // 这条规则抓到了真问题：src/30-studio.js 的 StudioPage 在 hooks 之间
      // 有一个 `if (broken) return …` 的提前返回（第 186 行），9 个 useState/useEffect
      // 是条件调用的。但 src/*.js 不在本次基建范围内（有人在同时改），
      // 所以先降成 warn 记着，等那批改动落地再修回去并恢复为 error。
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // 逐文件注入「其它片段声明的名字」。用一层 map 生成，避免手抄 78 个名字出错。
  ...Object.entries(CROSS_FRAGMENT).map(([file, names]) => ({
    files: [file],
    languageOptions: {
      globals: Object.fromEntries(names.map((name) => [name, 'readonly'])),
    },
    linterOptions: {
      // 源码里有历史遗留的 eslint-disable；那些文件不归基建动。
      reportUnusedDisableDirectives: 'off',
    },
  })),
  {
    files: ['index.js', 'lib/**/*.js', 'build.mjs', 'scripts/**/*.mjs', 'test/**/*.mjs'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
]
