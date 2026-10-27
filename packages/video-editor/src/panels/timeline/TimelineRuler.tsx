/**
 * 时间轴标尺组件（支持刻度绘制与播放头拖拽 Seek）
 */

import React, { useRef, useCallback, useMemo } from 'react'
import type { TimeUs } from '../../core/time.ts'
import { computeRulerTicks, pixelsToTimeUs, timeUsToPixels } from './zoom-scale.ts'
import { TIMELINE_RULER_HEIGHT } from './track-grouping.ts'

const PLAYHEAD_SIZE = 10

export type TimelineRulerProps = {
  durationUs: TimeUs
  playheadUs: TimeUs
  zoom: number
  onSeek: (timeUs: TimeUs) => void
  /** 与轨道区统一的横向宽度（像素） */
  contentWidthPx: number
}

export function TimelineRuler({
  durationUs,
  playheadUs,
  zoom,
  onSeek,
  contentWidthPx,
}: TimelineRulerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const ticks = useMemo(
    () => computeRulerTicks(durationUs, zoom, contentWidthPx),
    [durationUs, zoom, contentWidthPx],
  )
  const playheadPixel = timeUsToPixels(playheadUs, zoom)

  const handlePointerAtX = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const offsetX = Math.max(0, clientX - rect.left)
      const targetTimeUs = pixelsToTimeUs(offsetX, zoom)
      onSeek(targetTimeUs)
    },
    [zoom, onSeek]
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    isDragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    handlePointerAtX(e.clientX)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging.current) {
      handlePointerAtX(e.clientX)
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }
  }

  const totalWidth = Math.max(1, contentWidthPx)

  return (
    <div
      ref={containerRef}
      className="ve-timeline-ruler"
      role="slider"
      aria-label="时间轴刻度标尺"
      aria-valuemin={0}
      aria-valuemax={durationUs}
      aria-valuenow={playheadUs}
      tabIndex={0}
      style={{
        position: 'relative',
        height: TIMELINE_RULER_HEIGHT,
        width: totalWidth,
        background: 'var(--background)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        cursor: 'pointer',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, playheadUs - 100_000))
        if (e.key === 'ArrowRight') onSeek(Math.min(durationUs, playheadUs + 100_000))
      }}
    >
      {/* 刻度线与时间字 */}
      {ticks.map((tick, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: tick.pixel,
            top: tick.isMajor ? 8 : 14,
            bottom: 0,
            width: 1,
            background: tick.isMajor ? 'var(--muted-foreground)' : 'var(--border)',
            opacity: tick.isMajor ? 0.7 : 0.9,
          }}
        >
          {tick.isMajor && tick.label && (
            <span
              style={{
                position: 'absolute',
                top: -8,
                left: 3,
                fontSize: 9,
                color: 'var(--muted-foreground)',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}
            >
              {tick.label}
            </span>
          )}
        </div>
      ))}

      {/* 播放头指针指示线 */}
      <div
        style={{
          position: 'absolute',
          left: playheadPixel - PLAYHEAD_SIZE / 2,
          top: 0,
          width: PLAYHEAD_SIZE,
          height: PLAYHEAD_SIZE,
          background: 'var(--primary, #f06418)',
          clipPath: 'polygon(0 0, 100% 0, 100% 60%, 50% 100%, 0 60%)',
          zIndex: 10,
        }}
      />
    </div>
  )
}
