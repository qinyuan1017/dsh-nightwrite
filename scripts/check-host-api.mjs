#!/usr/bin/env node
/**
 * 长夜 · DSH 宿主 API 漂移监控
 *
 * 干什么：把 scripts/host-api.json 里记录的宿主 API 名字，拿到 DSH 宿主的产物里
 * 做一次**只读**检索，确认它们还以同样的拼写存在。名字没了 = 宿主改过 API，
 * 长夜对应的功能可能已经断了，这时 exit 1 并列出「可能已改名 / 移除」的项。
 *
 * 为什么这么实现（而不是解析 d.ts 或解包 asar）：
 *   - 宿主的产物是 `D:/DSH/resources/app.asar` 这样一个 180MB+ 的单体文件，
 *     `ls` 会说 "Not a directory" —— 它不能被当目录遍历，只能当二进制 grep。
 *   - 打包后的代码里没有 `.d.ts`（实测 `find app.asar -name "*.d.ts"` 返回 0 个），
 *     而 `grep -a` 出来的名字是**真实运行的那一份**，比类型声明更可信。
 *   - 解包 asar 需要额外依赖，且会在 CI 里拖很久；只读检索够了。
 *
 * 设计原则 —— **宁粗不错，不许天天误报**：
 *   1. 检不到宿主产物（比如在 ubuntu CI 上跑）→ 打一条说明，exit 0。
 *      这不是漂移，是「这一次没条件检查」。
 *   2. 检索是纯子串匹配，不做词法分析；宿主内部改名但保留了调用点写法也能命中。
 *   3. `required: false` 的项检不到只 warning，不影响退出码。
 *      只有 `required: true` 的项检不到才 exit 1。
 *   4. 每条记录只认一个 needle，但允许再加 `alt` 备选拼写（任一命中即算在）。
 *
 * 用法：
 *   node scripts/check-host-api.mjs              # 检查，结论 + 退出码
 *   node scripts/check-host-api.mjs --verbose    # 每条都打命中数
 *   node scripts/check-host-api.mjs --counts     # 只打命中数（调快照时用）
 *   node scripts/check-host-api.mjs --json       # 机器可读结果
 *   node scripts/check-host-api.mjs --snapshot <path>   # 指定别的快照文件
 *   node scripts/check-host-api.mjs --host <path>       # 直接指定宿主产物
 *
 * 环境变量：
 *   DSH_ASAR      宿主产物路径（优先级最高，CI 里用它指到 runner 上的位置）
 *   DSH_HOST_ROOT 宿主安装根目录；脚本会自己往下找 resources/app.asar
 *
 * 退出码：0 = 全部 required 都在（或无条件检查）；1 = 有 required 项检不到；
 *         2 = 快照文件本身坏了（读不到 / 不是合法 JSON / 结构不对）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '..')

// ══ 参数 ══════════════════════════════════════════════════
const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(name)
const flagValue = (name) => {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined
}

const VERBOSE = hasFlag('--verbose') || hasFlag('-v')
const COUNTS_ONLY = hasFlag('--counts')
const AS_JSON = hasFlag('--json')
const QUIET = hasFlag('--quiet') || hasFlag('-q')

// ══ 宿主产物定位 ══════════════════════════════════════════
// 按可信度排序：显式指定 → 环境变量 → 常见安装位置。
// 找不到就返回 null，调用方走「无条件检查」分支 exit 0。
const CANDIDATE_PATHS = [
  flagValue('--host'),
  process.env.DSH_ASAR,
  process.env.DSH_HOST_ROOT && path.join(process.env.DSH_HOST_ROOT, 'resources', 'app.asar'),
  'D:/DSH/resources/app.asar',
  'C:/Program Files/DSH/resources/app.asar',
  path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'DSH', 'resources', 'app.asar'),
  '/Applications/DSH.app/Contents/Resources/app.asar',
  '/opt/DSH/resources/app.asar',
  // 插件自己装在 profile 里时，宿主包就在上级目录，兜一下
  path.resolve(repoRoot, '..', '..', 'resources', 'app.asar'),
].filter(Boolean)

function locateHost() {
  for (const candidate of CANDIDATE_PATHS) {
    try {
      const stat = fs.statSync(candidate)
      if (stat.isFile() && stat.size > 1024) return { file: candidate, size: stat.size }
    } catch {
      // 继续试下一个
    }
  }
  return null
}

// ══ 二进制子串检索 ════════════════════════════════════════
// 一次读 8MB，块与块之间留 (maxNeedle-1) 的重叠窗口，
// 免得正好跨块边界的命中被漏掉。计数用 indexOf 逐次推进。
const CHUNK = 8 * 1024 * 1024

/**
 * 流式统计多个 needle 在一个二进制文件里的出现次数。
 * @param {string} file
 * @param {string[]} needles
 * @returns {Promise<Map<string, number>>}
 */
async function countInFile(file, needles) {
  const counts = new Map(needles.map((n) => [n, 0]))
  if (!needles.length) return counts
  const maxLen = Math.max(...needles.map((n) => Buffer.byteLength(n, 'utf8')))
  const overlap = Math.max(0, maxLen - 1)

  const stream = fs.createReadStream(file, { highWaterMark: CHUNK })
  let tail = Buffer.alloc(0)

  for await (const chunk of stream) {
    const buf = tail.length ? Buffer.concat([tail, chunk]) : chunk
    for (const needle of needles) {
      const nb = Buffer.from(needle, 'utf8')
      let from = 0
      for (;;) {
        const at = buf.indexOf(nb, from)
        if (at < 0) break
        counts.set(needle, (counts.get(needle) ?? 0) + 1)
        from = at + 1
      }
    }
    // 保留尾部，供下一块做边界补查；短 needle 时 tail 很小
    tail = overlap > 0 ? buf.subarray(Math.max(0, buf.length - overlap)) : Buffer.alloc(0)
  }
  return counts
}

// ══ 快照读取 ══════════════════════════════════════════════
function loadSnapshot(file) {
  let raw
  try {
    raw = fs.readFileSync(file, 'utf8')
  } catch (error) {
    fail(`读不到快照文件 ${file}：${error.message}`)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    fail(`快照文件不是合法 JSON（${file}）：${error.message}`)
  }
  if (!parsed || !Array.isArray(parsed.apis) || !parsed.apis.length) {
    fail(`快照文件结构不对（${file}）：需要 { apis: [{ name, kind, required }] }`)
  }
  for (const [i, api] of parsed.apis.entries()) {
    if (!api || typeof api.name !== 'string' || !api.name) {
      fail(`快照第 ${i + 1} 条缺少 name`)
    }
    if (!Array.isArray(api.needle ? [api.needle] : (api.alt ?? []))) {
      fail(`快照第 ${i + 1} 条（${api.name}）的 needle/alt 结构不对`)
    }
  }
  return parsed
}

function fail(message) {
  console.error(`✖ ${message}`)
  process.exit(2)
}

// ══ 主流程 ════════════════════════════════════════════════
const snapshotFile = flagValue('--snapshot') ?? path.join(here, 'host-api.json')
const snapshot = loadSnapshot(snapshotFile)
const apis = snapshot.apis

// 每条 API 允许一组等价拼写；needle 与 alt 任一命中即算「还在」。
const needlesOf = (api) => {
  const list = []
  if (typeof api.needle === 'string' && api.needle) list.push(api.needle)
  if (Array.isArray(api.alt)) {
    for (const alt of api.alt) if (typeof alt === 'string' && alt) list.push(alt)
  }
  return list
}

const host = locateHost()

if (!host) {
  if (AS_JSON) {
    console.log(
      JSON.stringify(
        { checked: false, reason: 'host-artifact-not-found', apis: apis.length },
        null,
        2,
      ),
    )
    process.exit(0)
  }
  if (!QUIET) {
    console.log('长夜 · 宿主 API 漂移检查')
    console.log('')
    console.log('⚠ 这一台机器上没找到 DSH 宿主产物（app.asar）。')
    console.log('  这不是漂移 —— 只是这一次没有条件检查，退出码 0。')
    console.log('  想在本机检查，用 --host <path> 或设 DSH_ASAR / DSH_HOST_ROOT。')
    console.log(`  已试过的位置：`)
    for (const candidate of CANDIDATE_PATHS.slice(0, 6)) console.log(`    ${candidate}`)
    console.log(`  快照里记了 ${apis.length} 条 API。`)
  }
  process.exit(0)
}

const allNeedles = [...new Set(apis.flatMap(needlesOf))]
const counts = await countInFile(host.file, allNeedles)

const results = apis.map((api) => {
  const needles = needlesOf(api)
  const hits = needles.reduce((sum, n) => sum + (counts.get(n) ?? 0), 0)
  const found = hits > 0
  return {
    name: api.name,
    kind: api.kind ?? 'unknown',
    required: api.required !== false,
    needles,
    hits,
    found,
    note: api.note ?? '',
  }
})

const missingRequired = results.filter((r) => r.required && !r.found)
const missingOptional = results.filter((r) => !r.required && !r.found)

// ── 输出 ──────────────────────────────────────────────────
if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        checked: true,
        host: host.file,
        hostBytes: host.size,
        snapshot: snapshotFile,
        total: results.length,
        missingRequired: missingRequired.map((r) => r.name),
        missingOptional: missingOptional.map((r) => r.name),
        results,
      },
      null,
      2,
    ),
  )
  process.exit(missingRequired.length ? 1 : 0)
}

if (COUNTS_ONLY) {
  for (const r of results) {
    const mark = r.found ? '✓' : r.required ? '✖' : '·'
    console.log(`${mark} ${String(r.hits).padStart(6)}  ${r.name}${r.required ? '' : '（可选）'}`)
  }
  process.exit(missingRequired.length ? 1 : 0)
}

if (!QUIET) {
  const mb = (host.size / 1024 / 1024).toFixed(0)
  console.log('长夜 · 宿主 API 漂移检查')
  console.log(`宿主产物：${host.file}（${mb} MB，只读检索，不解包）`)
  console.log(
    `快照：${path.relative(repoRoot, snapshotFile) || snapshotFile}（${results.length} 条）`,
  )
  console.log('')

  const width = Math.min(34, Math.max(...results.map((r) => r.name.length)))
  for (const r of results) {
    const mark = r.found ? '✓' : r.required ? '✖' : '·'
    const tag = r.required ? '' : ' 可选'
    const detail = VERBOSE || !r.found ? `  ×${r.hits}` : ''
    console.log(`${mark} ${r.name.padEnd(width)}  ${r.kind}${tag}${detail}`)
  }
  console.log('')
}

if (missingRequired.length) {
  console.error(`✖ ${missingRequired.length} 条必需的宿主 API 检不到，可能已改名 / 移除：`)
  for (const r of missingRequired) {
    console.error(`   · ${r.name}`)
    if (r.note) console.error(`     ${r.note}`)
    console.error(`     检索用的 needle：${r.needles.map((n) => `"${n}"`).join(' / ')}`)
  }
  if (missingOptional.length) {
    console.error('')
    console.error(
      `  （另有 ${missingOptional.length} 条可选项也没检到，不影响退出码：${missingOptional.map((r) => r.name).join('、')}）`,
    )
  }
  console.error('')
  console.error(
    '确认宿主确实改了之后：先 `node scripts/check-host-api.mjs --counts` 看新拼写的命中数，',
  )
  console.error('再改 scripts/host-api.json 里的 needle 与 updated 字段，最后同步修长夜的调用点。')
  process.exit(1)
}

if (!QUIET) {
  if (missingOptional.length) {
    console.log(
      `· ${missingOptional.length} 条可选项没检到（不影响结论）：${missingOptional.map((r) => r.name).join('、')}`,
    )
  }
  console.log(`✓ 全部 ${results.filter((r) => r.required).length} 条必需 API 都在，宿主没有漂移。`)
}
process.exit(0)
