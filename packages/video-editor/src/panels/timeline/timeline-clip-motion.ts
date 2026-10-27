/**
 * 时间轴片段拖动动效（对齐剪映 / FCP：抬起跟手、邻块滑动让位、落点指示）
 */

import type { CSSProperties } from 'react'

/** 邻镜 / 落位：略带回弹的 ease-out（接近 Apple 动效曲线） */
export const CLIP_LAYOUT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
export const CLIP_LAYOUT_MS = 240
export const CLIP_LIFT_MS = 160

export type ClipDragVisual = {
  elementId: string
  /** 水平跟手偏移（故事线拖动时文档 startUs 仍停在按下点） */
  deltaPx: number
  /** 竖向跟手偏移（跨轨预览） */
  deltaYPx?: number
  /** 松手后残余偏移，动画收回落槽 */
  settling?: boolean
}

export function clipLayoutTransition(reducedMotion: boolean): string {
  if (reducedMotion) return 'none'
  return `left ${CLIP_LAYOUT_MS}ms ${CLIP_LAYOUT_EASE}, box-shadow ${CLIP_LIFT_MS}ms ease, transform ${CLIP_LAYOUT_MS}ms ${CLIP_LAYOUT_EASE}`
}

export function buildClipDragStyle(options: {
  isDragging: boolean
  settling?: boolean
  layoutAnimate: boolean
  dragDeltaPx: number
  dragDeltaYPx?: number
  reducedMotion: boolean
}): CSSProperties {
  const { isDragging, settling, layoutAnimate, dragDeltaPx, dragDeltaYPx = 0, reducedMotion } = options

  const transition = isDragging
    ? reducedMotion
      ? 'none'
      : `box-shadow ${CLIP_LIFT_MS}ms ease, transform ${CLIP_LIFT_MS}ms ease`
    : settling || layoutAnimate
      ? clipLayoutTransition(reducedMotion)
      : reducedMotion
        ? 'none'
        : 'box-shadow 0.15s ease'

  const liftY = isDragging ? dragDeltaYPx || -3 : 0
  const transform =
    isDragging && !reducedMotion
      ? `translateX(${dragDeltaPx}px) translateY(${liftY}px) scale(1.025)`
      : dragDeltaPx !== 0 && !reducedMotion
        ? `translateX(${dragDeltaPx}px)`
        : undefined

  const boxShadow = isDragging
    ? '0 10px 28px rgba(0, 0, 0, 0.38), 0 0 0 1px color-mix(in srgb, var(--primary, #f06418) 55%, transparent)'
    : undefined

  return {
    transition,
    transform,
    boxShadow,
    zIndex: isDragging || settling ? 30 : undefined,
    cursor: isDragging ? 'grabbing' : undefined,
    willChange: isDragging || settling || layoutAnimate ? 'left, transform' : undefined,
  }
}
