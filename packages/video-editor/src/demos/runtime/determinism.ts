/**
 * Remotion 兼容运行时 —— 确定性伪随机
 *
 * 参考项目有 3 处 Math.random，违反确定性渲染铁律（逐帧抖动、不可复现）。
 * 这里提供 mulberry32 PRNG，同种子跨帧跨渲染完全一致。
 */

/** 32 位整数哈希，用于把任意字符串/数字稳定映射成种子。 */
export function hashSeed(input: string | number): number {
  const text = String(input)
  let h = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/** mulberry32：小、快、足够均匀，且完全确定性。 */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Remotion `random(seed)` 的等价物：同一个 seed 永远返回同一个 [0,1) 值。
 * 注意这不是"每次调用都变"的随机数 —— Remotion 的 random 语义就是按 seed 定值。
 */
export function random(seed: number | string): number {
  return createRandom(typeof seed === 'number' ? seed : hashSeed(seed))()
}

export function randomInt(seed: number | string, min: number, max: number): number {
  const n = Math.floor(random(seed) * (max - min + 1)) + min
  return Math.min(max, n)
}

/** 把 Math.random 的调用点替换成"随帧确定"的值：同帧必同值。 */
export function frameRandom(frame: number, salt = 0): number {
  return random(frame * 2654435761 + salt)
}

/**
 * 参考项目 `_fixtures/Motion.tsx` 里 rand 的等价实现。
 * 部分 demo 直接 import 了它，保持数值一致以免动效细节变化。
 */
export function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}
