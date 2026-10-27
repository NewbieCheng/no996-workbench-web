/**
 * Remotion 兼容运行时 —— 渲染闸门
 *
 * `lead-word-zoom-assemble` 用 `delayRender()` 挂起截图，等它量完真实 DOM
 * 文本宽度后才 `continueRender()`。若不实现，该镜头永远停在 `opacity: 0`，
 * 导出的就是一帧空白。
 *
 * 语义与 Remotion 对齐：
 *   delayRender(label)   → 返回 handle，登记一个待完成的门
 *   continueRender(h)    → 关闭该门；全部关闭后截图可以继续
 *
 * 注意 handle 必须幂等（重复 continueRender 不重复计数），并且设置超时 ——
 * 任何 demo 忘了 continueRender 都不应让整段导出永久卡死。
 */

export type DelayRenderHandle = number

let nextHandle = 1
const openHandles = new Map<DelayRenderHandle, number>()
const waiters = new Set<() => void>()

/** 单次截图最多等这么久，超时后放行并留一条警告（比永久卡死好）。 */
const GATE_TIMEOUT_MS = 6000

function notifyIfDrained() {
  if (openHandles.size === 0) {
    for (const resolve of waiters) resolve()
    waiters.clear()
  }
}

export function delayRender(label = ''): DelayRenderHandle {
  const handle = nextHandle++
  openHandles.set(handle, Date.now())
  if (label && typeof console !== 'undefined') {
    // 只在开发期留痕，便于定位是哪个 demo 挂起了渲染
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.debug(`[delayRender] ${handle} ${label}`)
    }
  }
  return handle
}

export function continueRender(handle: DelayRenderHandle): void {
  if (!openHandles.delete(handle)) return
  notifyIfDrained()
}

/** 管线调用：等待所有 delayRender 门关闭。 */
export function waitForRenderGate(timeoutMs = GATE_TIMEOUT_MS): Promise<void> {
  if (openHandles.size === 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      waiters.delete(onReady)
      clearTimeout(timer)
      resolve()
    }
    const onReady = () => finish()
    waiters.add(onReady)
    const timer = setTimeout(() => {
      if (openHandles.size > 0 && typeof console !== 'undefined') {
        console.warn(`[delayRender] ${openHandles.size} 个门超时未关闭，已放行`)
      }
      finish()
    }, timeoutMs)
  })
}

/** 新一帧开始前清掉上一帧遗留的门，避免跨帧互相拖累。 */
export function resetRenderGate(): void {
  if (openHandles.size > 0) {
    openHandles.clear()
    notifyIfDrained()
  }
}

export function openRenderGateCount(): number {
  return openHandles.size
}

/**
 * `getRemotionEnvironment()` 的最小等价物。
 * demo 用它判断是否在渲染中，从而决定要不要加 `willChange` 之类的运行时提示。
 * 我们的光栅化属于渲染，所以 `isRendering: true`。
 */
export function getRemotionEnvironment(): {
  isRendering: boolean
  isPlayer: boolean
  isStudio: boolean
} {
  return { isRendering: true, isPlayer: false, isStudio: false }
}
