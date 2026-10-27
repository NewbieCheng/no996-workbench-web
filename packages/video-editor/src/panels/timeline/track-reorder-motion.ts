/**
 * 轨道头拖拽排序动效（与时间轴片段换位同一套曲线与时长）
 */

import type { CSSProperties } from 'react'
import { CLIP_LAYOUT_EASE, CLIP_LAYOUT_MS, CLIP_LIFT_MS } from './timeline-clip-motion.ts'

export type TrackDragVisual = {
  trackId: string
  fromDocIndex: number
  dropDocIndex: number
  deltaYPx: number
  dragging: boolean
  settling?: boolean
}

export function resolveTrackHeaderDocIndex(
  clientY: number,
  excludeDocIndex?: number | null,
): number | null {
  const nodes = Array.from(document.querySelectorAll('[data-track-header-index]'))
  for (const node of nodes) {
    const raw = node.getAttribute('data-track-header-index')
    if (raw === null) continue
    const index = Number.parseInt(raw, 10)
    if (!Number.isFinite(index) || index === excludeDocIndex) continue
    const rect = node.getBoundingClientRect()
    if (clientY >= rect.top && clientY <= rect.bottom) {
      return index
    }
  }
  return null
}

/** 轨头随指针位移时，排除自身命中后按行高推算落点索引 */
export function resolveTrackDropDocIndexFromDelta(
  fromDocIndex: number,
  deltaYPx: number,
  trackHeights: number[],
): number {
  if (trackHeights.length === 0) return 0
  let index = Math.max(0, Math.min(fromDocIndex, trackHeights.length - 1))
  let remaining = deltaYPx

  while (remaining > (trackHeights[index] ?? 0) / 2 && index < trackHeights.length - 1) {
    remaining -= trackHeights[index] ?? 0
    index += 1
  }
  while (remaining < -(trackHeights[index] ?? 0) / 2 && index > 0) {
    remaining += trackHeights[index - 1] ?? 0
    index -= 1
  }
  return index
}

export function computeNeighborShiftPx(
  docIndex: number,
  drag: TrackDragVisual,
  trackHeights: number[],
): number {
  const { fromDocIndex, dropDocIndex } = drag
  if (fromDocIndex === dropDocIndex) return 0
  const draggedH = trackHeights[fromDocIndex] ?? 0
  if (fromDocIndex < dropDocIndex) {
    if (docIndex > fromDocIndex && docIndex <= dropDocIndex) return -draggedH
  } else if (fromDocIndex > dropDocIndex) {
    if (docIndex >= dropDocIndex && docIndex < fromDocIndex) return draggedH
  }
  return 0
}

function trackLayoutTransition(reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  return `transform ${CLIP_LAYOUT_MS}ms ${CLIP_LAYOUT_EASE}, box-shadow ${CLIP_LIFT_MS}ms ease, opacity ${CLIP_LIFT_MS}ms ease`
}

export function buildTrackReorderStyle(options: {
  trackId: string
  docIndex: number
  drag: TrackDragVisual | null
  trackHeights: number[]
  layoutAnimate: boolean
  reducedMotion: boolean
}): CSSProperties {
  const { trackId, docIndex, drag, trackHeights, layoutAnimate, reducedMotion } = options
  if (!drag) return {}

  const isDragged = drag.trackId === trackId
  const neighborShift = isDragged ? 0 : computeNeighborShiftPx(docIndex, drag, trackHeights)

  const transition = drag.dragging
    ? reducedMotion
      ? 'none'
      : `box-shadow ${CLIP_LIFT_MS}ms ease, transform ${CLIP_LIFT_MS}ms ease`
    : drag.settling || layoutAnimate
      ? trackLayoutTransition(reducedMotion)
      : reducedMotion
        ? 'none'
        : `box-shadow 0.15s ease`

  let transform: string | undefined
  if (isDragged && drag.dragging && !reducedMotion) {
    transform = `translateY(${drag.deltaYPx}px) translateY(-2px) scale(1.02)`
  } else if (isDragged && drag.settling && !reducedMotion) {
    transform = `translateY(${drag.deltaYPx}px)`
  } else if (neighborShift !== 0 && !reducedMotion) {
    transform = `translateY(${neighborShift}px)`
  }

  const boxShadow =
    isDragged && drag.dragging
      ? '0 10px 28px rgba(0, 0, 0, 0.28), 0 0 0 1px color-mix(in srgb, var(--primary, #f06418) 45%, transparent)'
      : undefined

  return {
    transition,
    transform,
    boxShadow,
    zIndex: isDragged && (drag.dragging || drag.settling) ? 25 : isDragged ? 20 : undefined,
    position: isDragged && drag.dragging ? 'relative' : undefined,
    cursor: isDragged && drag.dragging ? 'grabbing' : undefined,
    opacity: isDragged && drag.dragging ? 0.96 : undefined,
    pointerEvents: isDragged && drag.dragging ? 'none' : undefined,
    willChange: drag.dragging || drag.settling || layoutAnimate ? 'transform' : undefined,
  }
}
