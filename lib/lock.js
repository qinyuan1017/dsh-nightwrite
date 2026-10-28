/**
 * 长夜 · 串行写锁
 *
 * 为什么需要它：
 *   长夜所有数据都是「读整个 JSON → 改一条 → 写整个 JSON」。
 *   两个请求同时进来时，A 读到 5 条，B 也读到 5 条，A 写回 6 条，B 写回 6 条 ——
 *   结果是 6 条，A 那一条凭空消失。而 writeJsonAtomic 只保证「文件不会写一半」，
 *   它保证不了「后写的不要盖掉先写的」。这两个是不同的保证，很容易混。
 *
 * 做法：按路径串行排队。
 *   同一路径的读-改-写排成一队，前一个 await 完才允许下一个开始读。
 *   不同路径互不影响（改账本不用等改队列）。
 *
 * 边界（必须写清楚，不然会被当成事务用）：
 *   - 只在单个进程内有效。多个 DSH 实例同时写同一个作品目录，这把锁管不到。
 *   - 不是事务：中途抛错不会回滚已落盘的半截数据。
 *   - 不防「先读后决定、再单独调用写」这种跨调用业务竞态 —— 那要靠业务层的
 *     expectRev / 状态机，锁解决不了。
 *   - 同一 async 调用链里重复拿同一把锁直接放行（AsyncLocalStorage 记着，
 *     不会自己等自己死锁）。
 */

import { AsyncLocalStorage } from 'node:async_hooks'

/** 路径 → 该路径当前队尾的 Promise */
const tails = new Map()
/** 当前 async 调用链已经持有的锁集合 */
const holding = new AsyncLocalStorage()

/**
 * 拿一把锁跑一段代码。
 * @template T
 * @param {string} key 锁的键，一般直接给文件绝对路径
 * @param {() => Promise<T>} task 要串行执行的事
 * @returns {Promise<T>}
 */
export async function withLock(key, task) {
  const id = String(key ?? '')
  if (!id) return task()
  const held = holding.getStore()
  // 同一条调用链里已经拿着这把锁：直接跑，否则会自己等自己。
  if (held && held.has(id)) return task()
  const prev = tails.get(id) ?? Promise.resolve()
  let release = () => {}
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const mine = prev.then(() => gate)
  tails.set(id, mine)
  try {
    await prev
    const nextHeld = new Set(held ?? [])
    nextHeld.add(id)
    try {
      return await holding.run(nextHeld, task)
    } finally {
      release()
    }
  } catch (error) {
    release()
    throw error
  } finally {
    // 自己就是队尾才清；否则留给后面的人排队
    if (tails.get(id) === mine) tails.delete(id)
    else mine.then(() => {
      if (tails.get(id) === mine) tails.delete(id)
    })
  }
}

/** 同一个文件的多步读写：等同 withLock(file, fn)，只是名字更直白。 */
export function serializeBy(file, fn) {
  return withLock(file, () => fn(file))
}

/** 当前有多少把锁还挂着（测试与诊断用）。 */
export function lockStats() {
  return { active: tails.size, holding: holding.getStore()?.size ?? 0 }
}

/** 测试收尾：清空排队状态。生产代码不该调。 */
export function resetLocks() {
  tails.clear()
}
