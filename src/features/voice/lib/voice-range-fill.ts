import type { CSSProperties } from 'react'

/** 与爆款标题 `titles-tone-range` 一致的轨道填充比例 */
export function voiceRangeFillStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min
  const pct = span <= 0 ? 0 : ((value - min) / span) * 100
  return { '--voice-range-fill': `${pct}%` } as CSSProperties
}
