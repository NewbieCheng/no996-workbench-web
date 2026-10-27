export function coverOutputSize(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16) throw new Error('封面画布尺寸无效。')
  return { width: Math.round(width), height: Math.round(height) }
}
