export const ZOOM_MIN = 58
export const ZOOM_MAX = 200
export const ZOOM_DEFAULT = 100

export function clampZoom(percent: number): number {
  if (!Number.isFinite(percent)) return ZOOM_DEFAULT
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(percent)))
}

export function parseStoredZoom(raw: string | null): number {
  if (raw === null || raw.trim() === '') return ZOOM_DEFAULT
  const value = Number(raw)
  if (!Number.isFinite(value) || value < ZOOM_MIN || value > ZOOM_MAX) return ZOOM_DEFAULT
  return Math.round(value)
}

/** 将缩放值归一成百分比并限制在允许范围内。 */
export function normalizeZoomPercent(raw: number): number {
  if (!Number.isFinite(raw)) return ZOOM_DEFAULT
  const percent = raw > 0 && raw <= 1 ? raw * 100 : raw
  return clampZoom(percent)
}
