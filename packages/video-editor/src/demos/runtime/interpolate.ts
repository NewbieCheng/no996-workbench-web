/**
 * Remotion 兼容运行时 —— 插值、缓动与弹簧
 *
 * 这是整条链路最容易翻车的地方：参考项目把 `Easing` 当成**可组合高阶函数**用
 * （`Easing.out(Easing.cubic)`），不是枚举常量。写成枚举会让 152 个动效全崩。
 *
 * 实测用量（152 个 demo）：
 *   interpolate 54 · Easing 42 · spring 9
 *   Easing.out(cubic) 38 · out(quad) 21 · bezier(...) 51 · inOut(cubic) 8
 *   Easing.out(back(1.4)) 6 · in(cubic|quad) 8 · out(poly(4|5)) 3 · inOut(sin) 3
 */

export type EasingFunction = (t: number) => number

export type ExtrapolateType = 'extend' | 'clamp' | 'identity'

export type InterpolateOptions = {
  easing?: EasingFunction
  extrapolateLeft?: ExtrapolateType
  extrapolateRight?: ExtrapolateType
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

/* ───────────────────────── cubic-bezier ───────────────────────── */

/**
 * cubic-bezier(x1,y1,x2,y2) → (t)=>number，与 CSS 同义。
 * Newton-Raphson 求解，失败退二分。这段实现来自参考项目 `_fixtures/Polish.tsx`，
 * 已在 152 个 demo 里实测可用，直接沿用其数学，避免自己写出细微偏差。
 */
export function bezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  if (x1 === y1 && x2 === y2) return (t: number) => clamp01(t)
  const ax = 1 - 3 * x2 + 3 * x1
  const bx = 3 * x2 - 6 * x1
  const cx = 3 * x1
  const ay = 1 - 3 * y2 + 3 * y1
  const by = 3 * y2 - 6 * y1
  const cy = 3 * y1
  const sx = (u: number) => ((ax * u + bx) * u + cx) * u
  const sy = (u: number) => ((ay * u + by) * u + cy) * u
  const dx = (u: number) => (3 * ax * u + 2 * bx) * u + cx
  const solve = (x: number) => {
    let u = x
    for (let i = 0; i < 8; i++) {
      const err = sx(u) - x
      if (Math.abs(err) < 1e-7) return u
      const d = dx(u)
      if (Math.abs(d) < 1e-6) break
      u -= err / d
    }
    let lo = 0
    let hi = 1
    u = x
    for (let i = 0; i < 40; i++) {
      const v = sx(u)
      if (Math.abs(v - x) < 1e-7) break
      if (v < x) lo = u
      else hi = u
      u = (lo + hi) / 2
    }
    return u
  }
  return (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : sy(solve(t)))
}

/* ───────────────────────── 基础缓动 ───────────────────────── */

const linear: EasingFunction = (t) => t

const quad: EasingFunction = (t) => t * t
const cubic: EasingFunction = (t) => t * t * t
const poly = (n: number): EasingFunction => (t) => Math.pow(t, n)
const sin: EasingFunction = (t) => 1 - Math.cos((t * Math.PI) / 2)
const circle: EasingFunction = (t) => 1 - Math.sqrt(1 - t * t)
const exp: EasingFunction = (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10))
const elastic = (bounciness = 1): EasingFunction => (t) => {
  if (t === 0 || t === 1) return t
  const p = 0.3 * bounciness
  return Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1 - p / 4) * (2 * Math.PI)) / p) + 1
}
const back = (overshoot = 1.70158): EasingFunction => (t) =>
  t * t * ((overshoot + 1) * t - overshoot)
const bounce: EasingFunction = (t) => {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) {
    const u = t - 1.5 / d1
    return n1 * u * u + 0.75
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1
    return n1 * u * u + 0.9375
  }
  const u = t - 2.625 / d1
  return n1 * u * u + 0.984375
}
const ease: EasingFunction = bezier(0.25, 0.1, 0.25, 1)
const step0: EasingFunction = (t) => (t > 0 ? 1 : 0)
const step1: EasingFunction = (t) => (t >= 1 ? 1 : 0)
const steps = (n: number, position: 'start' | 'end' = 'end'): EasingFunction => (t) => {
  const clamped = clamp01(t)
  const stepped = Math.floor(clamped * n) / n
  return position === 'start' ? Math.min(1, stepped + 1 / n) : stepped
}

/* ───────────────────────── 组合器（关键） ───────────────────────── */

/**
 * 组合器语义必须与 Remotion 一致，否则 152 个动效全崩：
 *   Easing.in(e)    = t => e(t)              —— 基础缓动本身就是"in"（起步慢）
 *   Easing.out(e)   = t => 1 - e(1 - t)      —— 镜像成"out"（收尾慢）
 *   Easing.inOut(e) = 对称拼接，以 e 为前半段
 *
 * 验证：Easing.out(Easing.cubic)(0.5) = 1 - 0.5³ = 0.875（缓出），
 *      Easing.inOut(Easing.cubic)(0.25) = cubic(0.5)/2 = 0.0625（标准对称曲线）。
 */
const inFn = (e: EasingFunction): EasingFunction => (t) => e(clamp01(t))
const outFn = (e: EasingFunction): EasingFunction => (t) => 1 - e(1 - clamp01(t))
const inOutFn = (e: EasingFunction): EasingFunction => (t) => {
  const x = clamp01(t)
  return x < 0.5 ? e(x * 2) / 2 : 1 - e(2 - x * 2) / 2
}

/**
 * Remotion 的 `Easing` 形状：既是缓动函数集合，又提供 `in` / `out` / `inOut` 组合器。
 * 因为 demo 里写的是 `Easing.out(Easing.cubic)`，组合器必须接收任意缓动并返回新缓动。
 */
export const Easing = Object.assign(
  (t: number) => t,
  {
    linear,
    ease,
    quad,
    cubic,
    poly,
    sin,
    circle,
    exp,
    elastic,
    back,
    bounce,
    bezier,
    step0,
    step1,
    steps,
    in: inFn,
    out: outFn,
    inOut: inOutFn,
  },
)

/* ───────────────────────── interpolate ───────────────────────── */

function findRange(input: number, inputRange: readonly number[]): number {
  for (let i = 1; i < inputRange.length; i++) {
    if (input <= inputRange[i]) return i - 1
  }
  return inputRange.length - 2
}

/**
 * 与 Remotion 同语义：默认 `extrapolateLeft/Right: 'extend'`（不是 clamp）。
 * 需要钳位的 demo 都显式传了 `'clamp'`，所以默认值必须照 Remotion 来。
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number {
  if (inputRange.length < 2) {
    throw new Error('interpolate 至少需要 2 个 inputRange 值')
  }
  if (inputRange.length !== outputRange.length) {
    throw new Error(
      `interpolate 的 inputRange(${inputRange.length}) 与 outputRange(${outputRange.length}) 长度必须一致`,
    )
  }

  const { easing = linear, extrapolateLeft = 'extend', extrapolateRight = 'extend' } = options

  const first = inputRange[0]
  const last = inputRange[inputRange.length - 1]

  if (input < first) {
    if (extrapolateLeft === 'identity') return input
    if (extrapolateLeft === 'clamp') return outputRange[0]
  }
  if (input > last) {
    if (extrapolateRight === 'identity') return input
    if (extrapolateRight === 'clamp') return outputRange[outputRange.length - 1]
  }

  const index = Math.max(0, Math.min(findRange(input, inputRange), inputRange.length - 2))
  const inMin = inputRange[index]
  const inMax = inputRange[index + 1]
  const outMin = outputRange[index]
  const outMax = outputRange[index + 1]

  const span = inMax - inMin
  const raw = span === 0 ? 0 : (input - inMin) / span
  const progress = easing(clamp01(raw))
  return outMin + (outMax - outMin) * progress
}

/* ───────────────────────── spring ───────────────────────── */

export type SpringConfig = {
  damping?: number
  mass?: number
  stiffness?: number
  overshootClamping?: boolean
}

export type SpringOptions = {
  frame: number
  fps: number
  config?: SpringConfig
  from?: number
  to?: number
  durationInFrames?: number
  durationRestThreshold?: number
}

const DEFAULT_SPRING: Required<SpringConfig> = {
  damping: 10,
  mass: 1,
  stiffness: 100,
  overshootClamping: false,
}

/**
 * 阻尼弹簧。用固定子步长数值积分（每帧 8 子步），保证：
 *  1. 确定性 —— 同输入必同输出；
 *  2. 三参数（damping / stiffness / mass）都真实生效 —— 否则 9 个 demo 的节奏全错。
 *
 * 不用 Remotion 的解析解，是因为临界/过阻尼分支容易在改写时引入细微偏差；
 * 数值积分在小步长下与解析解在视觉上无法区分。
 */
export function spring({
  frame,
  fps,
  config = {},
  from = 0,
  to = 1,
  durationInFrames,
  durationRestThreshold,
}: SpringOptions): number {
  const cfg = { ...DEFAULT_SPRING, ...config }
  if (cfg.mass <= 0) throw new Error('spring 的 mass 必须大于 0')

  const target = 1
  let position = 0
  let velocity = 0

  const totalFrames = durationInFrames ?? frame
  const stepsPerFrame = 8
  const dt = 1 / (fps * stepsPerFrame)
  const steps = Math.max(0, Math.round(totalFrames * stepsPerFrame))

  for (let i = 0; i < steps; i++) {
    const force = -cfg.stiffness * (position - target) - cfg.damping * velocity
    const acceleration = force / cfg.mass
    velocity += acceleration * dt
    position += velocity * dt
    if (cfg.overshootClamping && position > target) {
      position = target
      velocity = 0
    }
  }

  // 收敛阈值：接近静止时直接落定，避免尾部无限逼近
  const threshold = durationRestThreshold ?? 0.00001
  const value = Math.abs(position - target) < threshold && Math.abs(velocity) < threshold ? target : position

  return from + (to - from) * value
}

/** 供断言与调试：一帧一帧跑出曲线。 */
export function springCurve(options: Omit<SpringOptions, 'frame'>, frames: number): number[] {
  return Array.from({ length: frames }, (_, frame) => spring({ ...options, frame }))
}
