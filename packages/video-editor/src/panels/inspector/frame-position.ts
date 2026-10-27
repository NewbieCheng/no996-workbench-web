/**
 * 画面在裁剪框内的锚点（对应 CSS object-position 九宫格）
 */

export type FramePositionAnchor =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'left'
  | 'center'
  | 'right'
  | 'bottom-left'
  | 'bottom'
  | 'bottom-right'

export const FRAME_POSITION_ANCHORS: FramePositionAnchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
]

const ANCHOR_FOCUS: Record<FramePositionAnchor, { x: number; y: number }> = {
  'top-left': { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  'top-right': { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  'bottom-left': { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  'bottom-right': { x: 1, y: 1 },
}

export function frameAnchorToFocus(anchor: FramePositionAnchor): { x: number; y: number } {
  return ANCHOR_FOCUS[anchor]
}

export function focusToFrameAnchor(
  contentFocusX?: number,
  contentFocusY?: number
): FramePositionAnchor {
  const x = contentFocusX ?? 0.5
  const y = contentFocusY ?? 0.5
  const snap = (v: number) => (v < 0.34 ? 0 : v > 0.66 ? 1 : 0.5)
  const sx = snap(x)
  const sy = snap(y)
  const entry = Object.entries(ANCHOR_FOCUS).find(([, f]) => f.x === sx && f.y === sy)
  return (entry?.[0] as FramePositionAnchor) ?? 'center'
}

export const FRAME_ANCHOR_LABELS: Record<FramePositionAnchor, string> = {
  'top-left': '左上',
  top: '上',
  'top-right': '右上',
  left: '左',
  center: '居中',
  right: '右',
  'bottom-left': '左下',
  bottom: '下',
  'bottom-right': '右下',
}
