/**
 * 时间轴时间与像素缩放换算器
 */

import type { TimeUs } from '../../core/time.ts'
import { ONE_SECOND_US, formatTimeCode } from '../../core/time.ts'

export const BASE_PIXELS_PER_SECOND = 100 // 默认 zoom=1 时，1秒占 100 像素
export const MIN_ZOOM = 0.1 // 最紧凑：1秒 10 像素
export const MAX_ZOOM = 10.0 // 最放大：1秒 1000 像素
/** 标尺/轨道末端留白，便于在片尾继续拖入素材 */
export const TIMELINE_CONTENT_PAD_PX = 200
export const TIMELINE_MIN_CONTENT_WIDTH_PX = 800

/** 时间轴横向画布宽度：至少铺满视口，避免轨道条带右侧露出空白底 */
export function computeTimelineContentWidth(
  durationUs: TimeUs,
  zoom: number,
  viewportWidthPx = 0,
): number {
  const byDuration = timeUsToPixels(durationUs, zoom) + TIMELINE_CONTENT_PAD_PX
  const base = Math.max(TIMELINE_MIN_CONTENT_WIDTH_PX, Math.ceil(byDuration))
  const viewport = Number.isFinite(viewportWidthPx) ? Math.max(0, viewportWidthPx) : 0
  return viewport > 0 ? Math.max(base, Math.ceil(viewport)) : base
}

export function timeUsToPixels(timeUs: TimeUs, zoom = 1.0): number {
  const safeTimeUs = Math.max(0, Number.isFinite(timeUs) ? timeUs : 0)
  const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(zoom) ? zoom : 1.0))
  return (safeTimeUs / ONE_SECOND_US) * BASE_PIXELS_PER_SECOND * safeZoom
}

export function pixelsToTimeUs(pixels: number, zoom = 1.0): TimeUs {
  const safePixels = Number.isFinite(pixels) ? pixels : 0
  const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(zoom) ? zoom : 1.0))
  return Math.round((safePixels / (BASE_PIXELS_PER_SECOND * safeZoom)) * ONE_SECOND_US)
}

export type RulerTick = {
  timeUs: TimeUs
  pixel: number
  label: string
  isMajor: boolean
}

/**
 * 依据当前缩放比，自动计算最优刻度步长（10s / 5s / 1s / 0.5s / 0.1s），杜绝刻度文字重叠。
 * `contentWidthPx` 与轨道同宽时，空工程也会在可视区域内铺满刻度。
 */
export function computeRulerTicks(
  durationUs: TimeUs,
  zoom = 1.0,
  contentWidthPx?: number,
): RulerTick[] {
  const safeZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
  const spanFromWidthUs =
    contentWidthPx && contentWidthPx > 0
      ? pixelsToTimeUs(contentWidthPx, safeZoom)
      : ONE_SECOND_US
  const safeDurationUs = Math.max(ONE_SECOND_US, durationUs, spanFromWidthUs)

  // 根据每秒像素量动态确定大刻度间隔
  const pps = BASE_PIXELS_PER_SECOND * safeZoom
  let majorIntervalSeconds = 5

  if (pps >= 400) {
    majorIntervalSeconds = 0.5 // 500ms
  } else if (pps >= 180) {
    majorIntervalSeconds = 1 // 1s
  } else if (pps >= 60) {
    majorIntervalSeconds = 5 // 5s
  } else if (pps >= 25) {
    majorIntervalSeconds = 10 // 10s
  } else {
    majorIntervalSeconds = 30 // 30s
  }

  const majorIntervalUs = Math.round(majorIntervalSeconds * ONE_SECOND_US)
  const minorIntervalUs = Math.round(majorIntervalUs / 5) // 5 等分小刻度
  const ticks: RulerTick[] = []

  for (let currentUs = 0; currentUs <= safeDurationUs + majorIntervalUs; currentUs += minorIntervalUs) {
    const isMajor = currentUs % majorIntervalUs === 0
    const pixel = timeUsToPixels(currentUs, safeZoom)

    ticks.push({
      timeUs: currentUs,
      pixel,
      label: isMajor ? formatTimeCode(currentUs) : '',
      isMajor,
    })
  }

  return ticks
}
