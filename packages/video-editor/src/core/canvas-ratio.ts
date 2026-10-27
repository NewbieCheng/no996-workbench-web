import type { CanvasSettings } from './project.ts'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 监视器角标：预设用 ratio 字段，custom 按宽高约分 */
export function canvasRatioLabel(canvas: Pick<CanvasSettings, 'width' | 'height' | 'ratio'>): string {
  if (canvas.ratio && canvas.ratio !== 'custom') return canvas.ratio
  const g = gcd(canvas.width, canvas.height)
  if (!g) return `${canvas.width}:${canvas.height}`
  return `${canvas.width / g}:${canvas.height / g}`
}
