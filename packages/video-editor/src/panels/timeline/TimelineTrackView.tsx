/**
 * 时间轴单个轨道的片段容器视口
 */

import React, { type CSSProperties } from 'react'
import type { TimelineTrack } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'
import { TimelineClip } from './TimelineClip.tsx'
import { pixelsToTimeUs, timeUsToPixels } from './zoom-scale.ts'
import type { ClipDragVisual } from './timeline-clip-motion.ts'
import type { StorylineGhost } from './storyline-layout.ts'

/** 拖放载荷：只允许纯 JSON，不传 DOM 或函数 */
export type TimelineDropPayload =
  | { kind: 'shot'; shotId: string; durationInFrames: number }
  | { kind: 'audio'; audioKind: 'sfx' | 'bgm'; label: string; path: string }

export type TimelineTrackViewProps = {
  track: TimelineTrack
  height?: number
  assets?: Record<string, { name?: string }>
  zoom: number
  durationUs: TimeUs
  /** 与标尺统一的横向宽度（像素） */
  contentWidthPx: number
  selectedElementIds: string[]
  onSelectElement: (e: React.MouseEvent, elementId: string) => void
  onEditElement?: (elementId: string) => void
  onDuplicateElement?: (elementId: string) => void
  onClearSelection?: () => void
  onTrimStart?: (elementId: string, deltaPx: number, commit: boolean) => void
  onTrimEnd?: (elementId: string, deltaPx: number, commit: boolean) => void
  /** 从镜头库 / 音效库拖入时的落点回调；timeUs 已按落点换算 */
  onDropPayload?: (payload: TimelineDropPayload, timeUs: TimeUs) => void
  /** 整体拖动片段（commit=true 表示松手落定） */
  onMoveElement?: (
    elementId: string,
    deltaPx: number,
    commit: boolean,
    deltaYPx?: number,
    clientX?: number,
    clientY?: number,
  ) => void
  /** 跨轨拖动目标高亮 */
  highlightCrossTrack?: boolean
  clipDrag?: ClipDragVisual | null
  layoutAnimate?: boolean
  /** 故事线换位时的落槽幽灵 */
  storylineGhost?: StorylineGhost | null
  reorderMotionStyle?: CSSProperties
}

export function TimelineTrackView({
  track,
  height = 48,
  assets,
  zoom,
  contentWidthPx,
  selectedElementIds,
  onSelectElement,
  onEditElement,
  onDuplicateElement,
  onClearSelection,
  onTrimStart,
  onTrimEnd,
  onDropPayload,
  onMoveElement,
  highlightCrossTrack,
  clipDrag,
  layoutAnimate = false,
  storylineGhost,
  reorderMotionStyle,
}: TimelineTrackViewProps) {
  const selectedSet = new Set(selectedElementIds)
  const trackWidth = Math.max(1, contentWidthPx)
  const trackHasSelectedClip = track.elements.some((elem) => selectedSet.has(elem.id))
  const trackHostsDragClip =
    Boolean(clipDrag?.elementId) && track.elements.some((elem) => elem.id === clipDrag?.elementId)
  const allowClipChromeOverflow = trackHasSelectedClip || trackHostsDragClip || Boolean(storylineGhost)

  /**
   * 把落点的 x 坐标换成时间轴时间。
   * 用当前元素的 boundingRect，因此横向滚动不会把落点算偏。
   */
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onDropPayload) return
    const shotRaw = event.dataTransfer.getData('application/x-no996-shot')
    const audioRaw = event.dataTransfer.getData('application/x-no996-audio')
    if (!shotRaw && !audioRaw) return
    event.preventDefault()
    event.stopPropagation()

    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.max(0, event.clientX - rect.left)
    const timeUs = pixelsToTimeUs(x, zoom)

    try {
      if (shotRaw) {
        const parsed = JSON.parse(shotRaw) as { shotId?: string; durationInFrames?: number }
        if (parsed.shotId) {
          onDropPayload(
            {
              kind: 'shot',
              shotId: parsed.shotId,
              durationInFrames: parsed.durationInFrames ?? 90,
            },
            timeUs,
          )
        }
        return
      }
      const parsed = JSON.parse(audioRaw) as { kind?: string; label?: string; path?: string }
      if (parsed.path) {
        onDropPayload(
          {
            kind: 'audio',
            audioKind: parsed.kind === 'bgm' ? 'bgm' : 'sfx',
            label: parsed.label ?? '音效',
            path: parsed.path,
          },
          timeUs,
        )
      }
    } catch {
      // 载荷不是我们的格式：忽略，不要抛错打断整个拖拽流程
    }
  }

  return (
    <div
      onClick={() => onClearSelection?.()}
      onDragOver={(event) => {
        if (!onDropPayload) return
        // 不 preventDefault 浏览器就不允许 drop
        event.preventDefault()
        event.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={handleDrop}
      data-testid={`timeline-track-${track.id}`}
      style={{
        position: 'relative',
        height,
        width: trackWidth,
        background: track.locked ? 'var(--muted)' : 'var(--background)',
        borderBottom: '1px solid var(--border)',
        boxShadow: highlightCrossTrack
          ? 'inset 0 0 0 2px color-mix(in srgb, var(--primary, #f06418) 55%, transparent)'
          : undefined,
        userSelect: 'none',
        overflow: allowClipChromeOverflow ? 'visible' : 'hidden',
        zIndex: allowClipChromeOverflow ? 3 : undefined,
        boxSizing: 'border-box',
        transition: 'height 0.15s ease',
        ...reorderMotionStyle,
      }}
    >
      {storylineGhost ? (
        <>
          <div
            className="ve-timeline-drop-ghost"
            aria-hidden="true"
            data-testid="timeline-storyline-ghost"
            style={{
              left: timeUsToPixels(storylineGhost.startUs, zoom),
              width: Math.max(16, timeUsToPixels(storylineGhost.durationUs, zoom)),
            }}
          />
          <div
            className="ve-timeline-insertion-guide"
            aria-hidden="true"
            style={{ left: timeUsToPixels(storylineGhost.startUs, zoom) }}
          />
        </>
      ) : null}

      {/* 轨道内元素列表 */}
      {track.elements.map((elem) => {
        const assetName = 'assetId' in elem && assets && assets[elem.assetId] ? assets[elem.assetId].name : undefined
        return (
          <TimelineClip
            key={elem.id}
            element={elem}
            assetName={assetName}
            zoom={zoom}
            isSelected={selectedSet.has(elem.id)}
            isLocked={track.locked}
            onSelect={onSelectElement}
            onEdit={onEditElement}
            onDuplicate={onDuplicateElement}
            onTrimStart={onTrimStart}
            onTrimEnd={onTrimEnd}
            onMove={onMoveElement}
            isDragActive={clipDrag?.elementId === elem.id}
            dragDeltaPx={clipDrag?.elementId === elem.id ? clipDrag.deltaPx : 0}
            dragDeltaYPx={clipDrag?.elementId === elem.id ? clipDrag.deltaYPx ?? 0 : 0}
            dragSettling={clipDrag?.elementId === elem.id ? Boolean(clipDrag.settling) : false}
            layoutAnimate={layoutAnimate}
          />
        )
      })}
    </div>
  )
}

/** 分组在时间轴内容视口中的对应隔断条（严格保持左右高度像素一致） */
export type TimelineGroupDividerProps = {
  height?: number
  contentWidthPx: number
}

export function TimelineGroupDivider({ height = 24, contentWidthPx }: TimelineGroupDividerProps) {
  return (
    <div
      style={{
        height,
        width: Math.max(1, contentWidthPx),
        background: 'var(--muted)',
        opacity: 0.7,
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    />
  )
}
