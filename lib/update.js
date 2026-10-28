/**
 * 长夜 · 检查更新（对齐 LNW 的 update 面板）
 *
 * 只做一件事：告诉作者「你现在跑的这版，npm 上是不是已经有更新的了」。
 *
 * 三条刻意的克制：
 *   1. **不自动装**。写作中途被替换掉半本书的文件是灾难，装不装由人来按。
 *   2. **不每次开页面都请求**。默认 6 小时缓存；失败也缓存 10 分钟，避免
 *      npm 挂了的时候每刷新一次页面就卡 4 秒。
 *   3. **查不到就说查不到**。没有网络、registry 超时、包还没发到 npm
 *      （本地 `file:` 安装的常态），都要给出人能看懂的原因，而不是抛错让
 *      设置页整块白掉。
 */

const PKG = 'dsh-changye'
const CACHE_MS = 6 * 60 * 60 * 1000
const FAIL_MS = 10 * 60 * 1000

let cache = { at: 0, value: null }

export function parseVersion(text) {
  return String(text ?? '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10) || 0)
}

/** 1 = a 更新，-1 = b 更新，0 = 一样。只比前三段（语义化版本的主次修订）。 */
export function compareVersion(a, b) {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i += 1) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x !== y) return x > y ? 1 : -1
  }
  return 0
}

function describeGap(installed, latest) {
  if (!latest) return '不知道最新版是多少'
  const a = parseVersion(installed)
  const b = parseVersion(latest)
  if (compareVersion(installed, latest) >= 0) return '已经是最新的'
  const bits = []
  if ((b[0] || 0) > (a[0] || 0)) bits.push('大版本')
  else if ((b[1] || 0) > (a[1] || 0)) bits.push('新功能')
  else bits.push('修 bug')
  const behind = (b[2] || 0) - (a[2] || 0)
  return bits[0] + (behind > 0 ? `，落后 ${behind} 个小版` : '')
}

/**
 * 查 npm 上的最新版。
 *
 * @param {{installed?: string, timeoutMs?: number, force?: boolean}} options
 * @returns {Promise<{installed, latest, hasUpdate, behind, checked, source, error?, packageName}>}
 */
export async function checkLatest(options = {}) {
  const installed = String(options.installed ?? '').trim() || '0.0.0'
  const force = options.force === true
  const timeoutMs = Math.max(1000, Math.min(15000, Number(options.timeoutMs) || 4000))
  const now = Date.now()

  if (!force && cache.value) {
    const ttl = cache.value.error ? FAIL_MS : CACHE_MS
    if (now - cache.at < ttl) {
      return { ...cache.value, installed, hasUpdate: compareVersion(installed, cache.value.latest) < 0 }
    }
  }

  const url = `https://registry.npmjs.org/${PKG}/latest`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let result
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
    if (res.status === 404) {
      // 本地 file: 装的包，npm 上本来就没有——这不是错误，是要说清楚的状态
      result = {
        packageName: PKG,
        latest: '',
        checked: new Date().toISOString(),
        source: 'npm',
        error: `npm 上没有 ${PKG} 这个包（本地开发版通常是这种情况，不影响使用）`,
      }
    } else if (!res.ok) {
      result = {
        packageName: PKG,
        latest: '',
        checked: new Date().toISOString(),
        source: 'npm',
        error: `npm 回了 ${res.status}`,
      }
    } else {
      const data = await res.json()
      result = {
        packageName: PKG,
        latest: String(data?.version ?? ''),
        published: String(data?.dist?.tarball ?? '') ? undefined : undefined,
        checked: new Date().toISOString(),
        source: 'npm',
      }
    }
  } catch (error) {
    const aborted = error?.name === 'AbortError'
    result = {
      packageName: PKG,
      latest: '',
      checked: new Date().toISOString(),
      source: 'npm',
      error: aborted ? `查 npm 超时了（${timeoutMs} 毫秒）` : `连不上 npm：${error?.message ?? error}`,
    }
  } finally {
    clearTimeout(timer)
  }

  cache = { at: now, value: result }
  return {
    ...result,
    installed,
    hasUpdate: Boolean(result.latest) && compareVersion(installed, result.latest) < 0,
    behind: describeGap(installed, result.latest),
    installHint: '这是本地开发版，升级方式是改完源码再同步到 profile（不需要 npm install）。',
  }
}

export function clearCache() {
  cache = { at: 0, value: null }
}
