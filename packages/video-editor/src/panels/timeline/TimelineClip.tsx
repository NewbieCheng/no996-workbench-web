/**
 * 时间轴单个片段组件（包含类型外观、选中态、左右裁切手柄与拖拽事件）
 */

import React, { useEffect, useState } from 'react'
import { Copy, SquarePen } from 'lucide-react'
import type { TrackElement } from '../../core/project.ts'
import { timeUsToPixels } from './zoom-scale.ts'
import { buildClipDragStyle } from './timeline-clip-motion.ts'
import './timeline-clips.css'

export type TimelineClipProps = {
  element: TrackElement
  assetName?: string
  zoom: number
  isSelected: boolean
  isLocked: boolean
  /** 正在拖动的片段跟手偏移（故事线模式） */
  dragDeltaPx?: number
  dragDeltaYPx?: number
  isDragActive?: boolean
  dragSettling?: boolean
  layoutAnimate?: boolean
  onSelect: (e: React.MouseEvent, elementId: string) => void
  onEdit?: (elementId: string) => void
  onDuplicate?: (elementId: string) => void
  onTrimStart?: (elementId: string, deltaPx: number, commit: boolean) => void
  onTrimEnd?: (elementId: string, deltaPx: number, commit: boolean) => void
  /**
   * 整体拖动片段。
   * commit=false 是拖动过程中的实时位移；commit=true 是松手落定。
   * deltaYPx 用于跨轨拖动检测（相对按下点）。
   */
  onMove?: (
    elementId: string,
    deltaPx: number,
    commit: boolean,
    deltaYPx?: number,
    clientX?: number,
    clientY?: number,
  ) => void
}

const TRIM_HIT_WIDTH = 12

const TYPE_COLORS: Record<string, { bg: string; border: string; label: string; text?: string }> = {
  video: { bg: '#2563eb', border: '#1d4ed8', label: '视频' },
  audio: { bg: '#059669', border: '#047857', label: '音频' },
  image: { bg: '#7c3aed', border: '#6d28d9', label: '图像' },
  text: { bg: '#d97706', border: '#b45309', label: '文本' },
  shot: { bg: '#e88850', border: '#d07842', label: '镜头' },
}

/** 片段标签：镜头显示名称 + 定制文案摘要 + 时长，其余保持原样。 */
function clipLabel(element: TrackElement, assetName?: string): { primary: string; secondary?: string; subtitle?: string } {
  if (element.type === 'shot') {
    const shotName = element.shotId.split('/').slice(-1)[0]
    const overrides = element.overrides || {}
    const textPreview = overrides.text || overrides.title || overrides.metric || overrides.brand
    return {
      primary: shotName,
      secondary: `${(element.durationUs / 1_000_000).toFixed(1)}s`,
      subtitle: textPreview ? `"${textPreview}"` : undefined,
    }
  }
  if (element.type === 'text') return { primary: element.text }
  if ('assetId' in element) return { primary: assetName || element.assetId }
  return { primary: '素材' }
}

function bindTrimPointer(
  elementId: string,
  isLocked: boolean,
  handler: ((id: string, deltaPx: number, commit: boolean) => void) | undefined,
) {
  return (e: React.PointerEvent) => {
    if (isLocked || !handler) return
    if (e.button !== 0) return
    e.stopPropagation()
    const captureEl = e.currentTarget as HTMLElement
    captureEl.setPointerCapture(e.pointerId)
    const startX = e.clientX
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - startX
      if (!moved && Math.abs(delta) < 2) return
      moved = true
      handler(elementId, delta, false)
    }
    const onUp = (ev: PointerEvent) => {
      try {
        captureEl.releasePointerCapture(e.pointerId)
      } catch {
        /* already released */
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (moved) handler(elementId, ev.clientX - startX, true)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }
}

export function TimelineClip({
  element,
  assetName,
  zoom,
  isSelected,
  isLocked,
  onSelect,
  onEdit,
  onDuplicate,
  onTrimStart,
  onTrimEnd,
  onMove,
  dragDeltaPx = 0,
  dragDeltaYPx = 0,
  isDragActive = false,
  dragSettling = false,
  layoutAnimate = false,
}: TimelineClipProps) {
  const [hovered, setHovered] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const showHandles = !isLocked && (isSelected || hovered) && !isDragActive

  const leftPx = timeUsToPixels(element.startUs, zoom)
  const widthPx = Math.max(16, timeUsToPixels(element.durationUs, zoom))

  const theme = TYPE_COLORS[element.type] || { bg: '#475569', border: '#334155', label: '素材' }
  const label = clipLabel(element, assetName)
  const motionStyle = buildClipDragStyle({
    isDragging: isDragActive && !dragSettling,
    settling: dragSettling,
    layoutAnimate,
    dragDeltaPx,
    dragDeltaYPx,
    reducedMotion,
  })

  const showShotCustomize =
    element.type === 'shot' && (hovered || isSelected) && widthPx >= 84 && !isDragActive

  const clipClassName = [
    've-timeline-clip',
    `ve-timeline-clip--type-${element.type}`,
    isSelected && 've-timeline-clip--selected',
    isDragActive && 've-timeline-clip--dragging',
    showHandles && 've-timeline-clip--handles',
  ]
    .filter(Boolean)
    .join(' ')

  const useSelectionChrome = isSelected || isDragActive
  const trackEdgeInset =
    useSelectionChrome && !isDragActive ? 1 : element.type === 'text' ? 2 : 3

  return (
    <div
      className={clipClassName}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(e, element.id)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onSelect(e, element.id)
        onEdit?.(element.id)
      }}
      onPointerDown={(e) => {
        if (isLocked || !onMove) return
        if (e.button !== 0) return
        const target = e.target as HTMLElement
        if (target.closest('[data-trim-handle]')) return
        if (target.closest('.ve-timeline-shot-action')) return
        e.stopPropagation()
        e.currentTarget.setPointerCapture(e.pointerId)
        const startX = e.clientX
        const startY = e.clientY
        let moved = false
        const onPointerMove = (moveEvent: PointerEvent) => {
          const deltaX = moveEvent.clientX - startX
          const deltaY = moveEvent.clientY - startY
          if (!moved && Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return
          moved = true
          onMove(element.id, deltaX, false, deltaY, moveEvent.clientX, moveEvent.clientY)
        }
        const onPointerUp = (upEvent: PointerEvent) => {
          try {
            e.currentTarget.releasePointerCapture(e.pointerId)
          } catch {
            /* already released */
          }
          window.removeEventListener('pointermove', onPointerMove)
          window.removeEventListener('pointerup', onPointerUp)
          window.removeEventListener('pointercancel', onPointerUp)
          if (moved) {
            onMove(
              element.id,
              upEvent.clientX - startX,
              true,
              upEvent.clientY - startY,
              upEvent.clientX,
              upEvent.clientY,
            )
          }
        }
        window.addEventListener('pointermove', onPointerMove)
        window.addEventListener('pointerup', onPointerUp)
        window.addEventListener('pointercancel', onPointerUp)
      }}
      data-element-id={element.id}
      data-testid={`timeline-clip-${element.id}`}
      data-selected={isSelected ? 'true' : undefined}
      style={{
        position: 'absolute',
        left: leftPx,
        top: trackEdgeInset,
        bottom: trackEdgeInset,
        width: widthPx,
        backgroundColor: theme.bg,
        border: useSelectionChrome ? undefined : `1px solid ${theme.border}`,
        ...(motionStyle.boxShadow ? { boxShadow: motionStyle.boxShadow } : {}),
        borderRadius: element.type === 'text' ? 4 : 5,
        overflow: isDragActive || isSelected ? 'visible' : 'hidden',
        userSelect: 'none',
        cursor: motionStyle.cursor ?? (isLocked ? 'not-allowed' : 'grab'),
        opacity: isLocked ? 0.6 : isDragActive ? 0.96 : 1,
        zIndex: motionStyle.zIndex ?? (useSelectionChrome ? 5 : undefined),
        transition:
          isDragActive || dragSettling || layoutAnimate ? motionStyle.transition : undefined,
        transform: motionStyle.transform,
        willChange: motionStyle.willChange,
        display: 'flex',
        alignItems: 'center',
        padding: '0 6px',
        color: theme.text ?? '#ffffff',
        fontSize: element.type === 'text' ? 10.5 : 11,
        boxSizing: 'border-box',
        touchAction: 'none',
      }}
    >
      {!isLocked && (
        <div
          data-trim-handle="start"
          data-testid="trim-left-handle"
          onPointerDown={bindTrimPointer(element.id, isLocked, onTrimStart)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: TRIM_HIT_WIDTH,
            cursor: 'ew-resize',
            zIndex: 3,
          }}
        >
          <div className="ve-timeline-clip__trim-bar ve-timeline-clip__trim-bar--start" aria-hidden />
        </div>
      )}

      <div
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          lineHeight: 1.15,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          pointerEvents: 'none',
        }}
      >
        <span style={{ opacity: 0.85, fontWeight: 600, fontSize: 10, flexShrink: 0 }}>
          [{theme.label}]
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: label.subtitle ? 600 : 400 }}>
          {label.primary}
        </span>
        {label.subtitle ? (
          <span
            style={{
              opacity: 0.95,
              color: '#fff',
              background: 'rgba(0, 0, 0, 0.28)',
              padding: '0 4px',
              borderRadius: 3,
              fontSize: 10,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label.subtitle}
          </span>
        ) : null}
        {label.secondary || showShotCustomize ? (
          <div
            className="ve-timeline-shot-customize-row"
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
              pointerEvents: showShotCustomize ? 'auto' : 'none',
            }}
          >
            {showShotCustomize && onDuplicate ? (
              <button
                type="button"
                className="ve-timeline-shot-customize ve-timeline-shot-action"
                aria-label="复制镜头片段"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(e, element.id)
                  onDuplicate(element.id)
                }}
              >
                <Copy className="ve-timeline-shot-customize__icon" size={10} strokeWidth={2} aria-hidden />
                <span>复制</span>
              </button>
            ) : null}
            {showShotCustomize ? (
              <button
                type="button"
                className="ve-timeline-shot-customize ve-timeline-shot-action"
                aria-label="定位画面并定制动效文案"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(e, element.id)
                  onEdit?.(element.id)
                }}
              >
                <SquarePen className="ve-timeline-shot-customize__icon" size={10} strokeWidth={2} aria-hidden />
                <span>定制</span>
              </button>
            ) : null}
            {label.secondary ? (
              <span style={{ opacity: 0.8, fontSize: 9.5, flexShrink: 0 }}>{label.secondary}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isLocked && (
        <div
          data-trim-handle="end"
          data-testid="trim-right-handle"
          onPointerDown={bindTrimPointer(element.id, isLocked, onTrimEnd)}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: TRIM_HIT_WIDTH,
            cursor: 'ew-resize',
            zIndex: 3,
          }}
        >
          <div className="ve-timeline-clip__trim-bar ve-timeline-clip__trim-bar--end" aria-hidden />
        </div>
      )}
    </div>
  )
}
