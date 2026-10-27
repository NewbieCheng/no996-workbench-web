export type SeparatorDirection = 1 | -1
export type SeparatorKey = 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End'

export function pointerResizeDelta(
  previousX: number,
  currentX: number,
  direction: SeparatorDirection,
  scale = 1,
): number {
  return (currentX - previousX) * scale * direction
}

export function keyboardResizeDelta(
  key: SeparatorKey,
  direction: SeparatorDirection,
  step: number,
  value?: number,
  min?: number,
  max?: number,
): number | undefined {
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    return (key === 'ArrowRight' ? step : -step) * direction
  }
  if (value === undefined) return undefined
  if (key === 'Home' && min !== undefined) return min - value
  if (key === 'End' && max !== undefined) return max - value
  return undefined
}
