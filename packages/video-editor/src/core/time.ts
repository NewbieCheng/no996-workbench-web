/**
 * 核心时间与时钟系统（微秒整数精度）
 * 消除浮点累积舍入误差，统一帧位置与半开区间。
 */

export type TimeUs = number // 整数微秒，必须为安全整数 >= 0
export type FrameRate = { num: number; den: number }

export const DEFAULT_FRAME_RATE: FrameRate = { num: 30, den: 1 }
export const ONE_SECOND_US = 1_000_000

export function secondsToTimeUs(seconds: number): TimeUs {
  if (!Number.isFinite(seconds) || seconds < 0) return 0
  return Math.round(seconds * ONE_SECOND_US)
}

export function timeUsToSeconds(timeUs: TimeUs): number {
  if (!Number.isFinite(timeUs) || timeUs <= 0) return 0
  return timeUs / ONE_SECOND_US
}

export function frameRateValue(fps: FrameRate = DEFAULT_FRAME_RATE): number {
  if (!fps.den || fps.den <= 0 || !fps.num || fps.num <= 0) return 30
  return fps.num / fps.den
}

/**
 * 严格按照帧序号推导微秒时间戳，禁止循环累加 33333.333 浮点值
 */
export function frameIndexToTimeUs(frameIndex: number, fps: FrameRate = DEFAULT_FRAME_RATE): TimeUs {
  if (!Number.isSafeInteger(frameIndex) || frameIndex <= 0) return 0
  return Math.round((frameIndex * ONE_SECOND_US * fps.den) / fps.num)
}

/**
 * 微秒转帧序号（向下取整求当前帧）
 */
export function timeUsToFrameIndex(timeUs: TimeUs, fps: FrameRate = DEFAULT_FRAME_RATE): number {
  if (!Number.isFinite(timeUs) || timeUs <= 0) return 0
  return Math.floor((timeUs * fps.num) / (ONE_SECOND_US * fps.den))
}

/**
 * 计算总时长包含的总帧数（向上取整保证最后一帧有效覆盖）
 */
export function durationToTotalFrames(durationUs: TimeUs, fps: FrameRate = DEFAULT_FRAME_RATE): number {
  if (!Number.isFinite(durationUs) || durationUs <= 0) return 0
  return Math.max(1, Math.ceil((durationUs * fps.num) / (ONE_SECOND_US * fps.den) - 1e-9))
}

/**
 * 时间码格式化：00:00:00:00 (时:分:秒:帧)
 */
export function formatTimeCode(timeUs: TimeUs, fps: FrameRate = DEFAULT_FRAME_RATE): string {
  const safeTimeUs = Math.max(0, Number.isFinite(timeUs) ? timeUs : 0)
  const fpsVal = frameRateValue(fps)
  const totalSeconds = Math.floor(safeTimeUs / ONE_SECOND_US)
  const frameRemUs = safeTimeUs % ONE_SECOND_US
  const frameIndex = Math.min(Math.floor((frameRemUs * fpsVal) / ONE_SECOND_US), Math.floor(fpsVal) - 1)

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frameIndex)}`
}

export type TimeSpan = {
  startUs: TimeUs
  durationUs: TimeUs
}

/**
 * 半开区间判定：[startUs, startUs + durationUs)
 */
export function timeSpanContains(span: TimeSpan, pointUs: TimeUs): boolean {
  return pointUs >= span.startUs && pointUs < span.startUs + span.durationUs
}

/**
 * 区间相交判定
 */
export function timeSpansOverlap(a: TimeSpan, b: TimeSpan): boolean {
  return a.startUs < b.startUs + b.durationUs && b.startUs < a.startUs + a.durationUs
}

/**
 * 源媒体时间映射（支持倍速 rate 与入点偏移）
 */
export function mapSourceTimeUs(
  localTimeUs: TimeUs,
  sourceInUs: TimeUs,
  rate = 1.0,
  sourceDurationUs?: TimeUs
): TimeUs {
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1.0
  const mapped = Math.round(sourceInUs + localTimeUs * safeRate)
  if (sourceDurationUs !== undefined && sourceDurationUs > 0) {
    return Math.min(mapped, sourceDurationUs)
  }
  return mapped
}
