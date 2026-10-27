import type { CSSProperties } from 'react'

/** 轨道已滑过区段比例（与语音工作台 voice-range 一致） */
export function timelineRangeFillStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min
  const pct = span <= 0 ? 0 : ((value - min) / span) * 100
  return { '--ve-range-fill': `${pct}%` } as CSSProperties
}
