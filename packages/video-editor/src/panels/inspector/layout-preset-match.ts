import type { TransformBox } from '../../core/project.ts'

export type LayoutPresetType =
  | 'fullscreen'
  | 'fit-contain'
  | 'pip-top-right'
  | 'pip-bottom-right'
  | 'split-vertical-top'
  | 'split-vertical-bottom'
  | 'center-card'

const TOLERANCE = 3

function near(a: number, b: number, tol = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol
}

function sameTransform(t: TransformBox, expected: Partial<TransformBox>): boolean {
  const crop = expected.cropMode ?? 'cover'
  if ((t.cropMode || 'cover') !== crop) return false
  if (expected.x !== undefined && !near(t.x, expected.x)) return false
  if (expected.y !== undefined && !near(t.y, expected.y)) return false
  if (expected.width !== undefined && !near(t.width, expected.width)) return false
  if (expected.height !== undefined && !near(t.height, expected.height)) return false
  if (expected.round !== undefined && !near(t.round || 0, expected.round)) return false
  return true
}

export function matchLayoutPresetFromTransform(
  transform: TransformBox,
  canvasWidth: number,
  canvasHeight: number
): LayoutPresetType | null {
  const w35 = Math.round(canvasWidth * 0.35)
  const h35 = Math.round(canvasHeight * 0.35)
  const w80 = Math.round(canvasWidth * 0.8)
  const h80 = Math.round(canvasHeight * 0.8)
  const halfH = Math.round(canvasHeight / 2)

  const candidates: Array<{ id: LayoutPresetType; patch: Partial<TransformBox> }> = [
    {
      id: 'fullscreen',
      patch: { x: 0, y: 0, width: canvasWidth, height: canvasHeight, cropMode: 'cover' },
    },
    {
      id: 'fit-contain',
      patch: { x: 0, y: 0, width: canvasWidth, height: canvasHeight, cropMode: 'contain', round: 0 },
    },
    {
      id: 'pip-top-right',
      patch: {
        x: canvasWidth - w35 - 40,
        y: 40,
        width: w35,
        height: h35,
        round: 16,
        cropMode: 'cover',
      },
    },
    {
      id: 'pip-bottom-right',
      patch: {
        x: canvasWidth - w35 - 40,
        y: canvasHeight - h35 - 40,
        width: w35,
        height: h35,
        round: 16,
        cropMode: 'cover',
      },
    },
    {
      id: 'split-vertical-top',
      patch: { x: 0, y: 0, width: canvasWidth, height: halfH, cropMode: 'cover' },
    },
    {
      id: 'split-vertical-bottom',
      patch: { x: 0, y: Math.round(canvasHeight / 2), width: canvasWidth, height: halfH, cropMode: 'cover' },
    },
    {
      id: 'center-card',
      patch: {
        x: Math.round((canvasWidth - w80) / 2),
        y: Math.round((canvasHeight - h80) / 2),
        width: w80,
        height: h80,
        round: 24,
        cropMode: 'cover',
      },
    },
  ]

  for (const c of candidates) {
    if (sameTransform(transform, c.patch)) {
      return c.id
    }
  }
  return null
}
