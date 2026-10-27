/**
 * 舞台画面所见即所得交互蒙层与原位快捷编辑器
 *
 * - 播放中静默
 * - 字幕默认不参与命中；选中后仅「拖动」手柄可移位置（CSS 跟手，松手一次提交）
 * - 单击选中；双击原位改字；overlay 内点击一律不冒泡到 frame（禁误触播放）
 */

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import type { EditorDocument } from '../../core/project.ts'
import type { EditorInstance } from '../../core/instance.ts'
import { UpdateShotClipCommand } from '../../core/commands/shot-commands.ts'
import { UpdateTextClipCommand, UpdateCaptionStyleCommand } from '../../core/commands/timeline-commands.ts'
import {
  mapClientToCanvasPoint,
  collectStageHotspots,
  hitTestHotspots,
  isCaptionArmed,
  type StageHotspot,
} from './stage-hit-testing.ts'
import { commitCaptionTextFromClipId } from '../captions/sync-text-track.ts'
import { ratiosFromDragDelta } from '../captions/caption-geometry.ts'
import { refineTextWithAi } from '../../../../../src/features/video-factory/lib/ai-refine-text'
import {
  SparklesIcon,
  CloseIcon,
  CheckIcon,
  EditIcon,
  PaletteIcon,
} from '../inspector/inspector-icons.tsx'
import './stage-interactive-overlay.css'

export type StageInteractiveOverlayProps = {
  doc: EditorDocument
  editor: EditorInstance
  playheadUs: number
  isPlaying?: boolean
  selectedIds: string[]
  displayWidth?: number
  displayHeight?: number
}

const PRESET_COLORS = [
  { id: 'dark-blue', name: '深蓝', color: '#4d7cff' },
  { id: 'neon-purple', name: '暗紫', color: '#9d4dff' },
  { id: 'cyber-teal', name: '青绿', color: '#19d3b4' },
  { id: 'obsidian-gold', name: '黑金', color: '#e0b354' },
  { id: 'sunset-orange', name: '暖阳', color: '#ff5722' },
  { id: 'porcelain-light', name: '瓷白', color: '#2563eb' },
]

export function StageInteractiveOverlay({
  doc,
  editor,
  playheadUs,
  isPlaying = false,
  selectedIds,
}: StageInteractiveOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    width: number
    height: number
    originXRatio: number
    originYRatio: number
    moved: boolean
  } | null>(null)

  const [hoveredHotspot, setHoveredHotspot] = useState<StageHotspot | null>(null)
  const [activeHotspot, setActiveHotspot] = useState<StageHotspot | null>(null)
  const [editValue, setEditValue] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [altPeek, setAltPeek] = useState(false)
  /** 拖动中跟手偏移（px，相对 frame） */
  const [dragOffset, setDragOffset] = useState<{ dxPx: number; dyPx: number } | null>(null)
  const suppressClickRef = useRef(false)

  const { width: canvasW, height: canvasH } = doc.canvas
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const captionArmed = isCaptionArmed(selectedIds, doc)

  const hitOptions = useMemo(
    () => ({
      captionArmed,
      altPeek,
      selectedIds,
    }),
    [captionArmed, altPeek, selectedIds],
  )

  useEffect(() => {
    if (isPlaying) {
      setHoveredHotspot(null)
      setActiveHotspot(null)
      setDragOffset(null)
      dragRef.current = null
    }
  }, [isPlaying])

  const hotspots = useMemo(() => {
    if (isPlaying) return []
    return collectStageHotspots({ doc, playheadUs })
  }, [doc, playheadUs, isPlaying])

  useEffect(() => {
    if (activeHotspot && !selectedIds.includes(activeHotspot.elementId)) {
      setActiveHotspot(null)
    }
  }, [selectedIds, activeHotspot])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPeek(true)
      if (e.key === 'Escape') {
        setActiveHotspot(null)
        if (!e.defaultPrevented) editor.clearSelection()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPeek(false)
    }
    const onBlur = () => setAltPeek(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [editor])

  const resolveHit = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current
      if (!el) return null
      const rect = el.getBoundingClientRect()
      const pt = mapClientToCanvasPoint(clientX, clientY, rect, canvasW, canvasH)
      return hitTestHotspots(pt, hotspots, hitOptions)
    },
    [canvasW, canvasH, hotspots, hitOptions],
  )

  if (isPlaying) {
    return null
  }

  const getBoxPercentStyle = (
    box: { x: number; y: number; width: number; height: number },
    withDrag = false,
  ) => {
    const base = {
      left: `${(box.x / canvasW) * 100}%`,
      top: `${(box.y / canvasH) * 100}%`,
      width: `${(box.width / canvasW) * 100}%`,
      height: `${(box.height / canvasH) * 100}%`,
    }
    if (withDrag && dragOffset) {
      return {
        ...base,
        transform: `translate(${dragOffset.dxPx}px, ${dragOffset.dyPx}px)`,
      }
    }
    return base
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      const drag = dragRef.current
      const dxPx = e.clientX - drag.startX
      const dyPx = e.clientY - drag.startY
      if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) drag.moved = true
      setDragOffset({ dxPx, dyPx })
      return
    }
    setHoveredHotspot(resolveHit(e.clientX, e.clientY))
  }

  const handlePointerLeave = () => {
    if (!dragRef.current) setHoveredHotspot(null)
  }

  const openHotspotEditor = (hit: StageHotspot) => {
    setActiveHotspot(hit)
    setEditValue(hit.currentValue || '')

    if (hit.kind === 'caption') {
      window.dispatchEvent(
        new CustomEvent('video-factory:focus-captions', {
          detail: { elementId: hit.elementId },
        }),
      )
      window.dispatchEvent(new CustomEvent('video-factory:focus-inspector'))
    } else {
      window.dispatchEvent(new CustomEvent('video-factory:focus-inspector'))
      window.dispatchEvent(
        new CustomEvent('video-factory:focus-inspector-field', {
          detail: {
            shotId: hit.shotId,
            fieldKey: hit.fieldKey,
            category: hit.category || 'content',
          },
        }),
      )
    }

    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 60)
  }

  const applySelection = (elementId: string, additive: boolean) => {
    if (additive) {
      const current = editor.getSelectedElementIds()
      const next = current.includes(elementId)
        ? current.filter((id) => id !== elementId)
        : [...current, elementId]
      editor.setSelection(next)
    } else {
      editor.setSelection([elementId])
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if ((e.target as HTMLElement).closest('.ve-inplace-popover')) return

    const onHandle = (e.target as HTMLElement).closest('.ve-hotspot-drag-handle')
    if (!onHandle) return

    if (!captionArmed && !altPeek) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      originXRatio: doc.captionStyle.xRatio ?? 0.5,
      originYRatio: doc.captionStyle.yRatio ?? 0.82,
      moved: false,
    }
    setDragOffset({ dxPx: 0, dyPx: 0 })
    el.setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const drag = dragRef.current
    dragRef.current = null
    try {
      containerRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    if (drag?.moved) {
      const dxRatio = (e.clientX - drag.startX) / drag.width
      const dyRatio = (e.clientY - drag.startY) / drag.height
      const preview = ratiosFromDragDelta(
        { ...doc.captionStyle, xRatio: drag.originXRatio, yRatio: drag.originYRatio },
        dxRatio,
        dyRatio,
      )
      suppressClickRef.current = true
      editor.executeCommand(new UpdateCaptionStyleCommand(preview))
      e.preventDefault()
    }
    setDragOffset(null)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if ((e.target as HTMLElement).closest('.ve-inplace-popover')) return
    if ((e.target as HTMLElement).closest('.ve-hotspot-drag-handle')) return
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    const hit = resolveHit(e.clientX, e.clientY)
    const additive = e.ctrlKey || e.metaKey || e.shiftKey

    if (hit) {
      applySelection(hit.elementId, additive)
      setActiveHotspot(null)
      if (hit.kind === 'caption') {
        window.dispatchEvent(
          new CustomEvent('video-factory:focus-captions', { detail: { elementId: hit.elementId } }),
        )
      }
      window.dispatchEvent(new CustomEvent('video-factory:focus-inspector'))
      if (hit.isShotHotspot && hit.fieldKey) {
        window.dispatchEvent(
          new CustomEvent('video-factory:focus-inspector-field', {
            detail: {
              shotId: hit.shotId,
              fieldKey: hit.fieldKey,
              category: hit.category || 'content',
            },
          }),
        )
      }
      return
    }

    setActiveHotspot(null)
    if (!additive) editor.clearSelection()
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if ((e.target as HTMLElement).closest('.ve-inplace-popover')) return
    if ((e.target as HTMLElement).closest('.ve-hotspot-drag-handle')) {
      e.preventDefault()
      return
    }
    suppressClickRef.current = false
    const hit = resolveHit(e.clientX, e.clientY)
    if (hit) {
      e.preventDefault()
      editor.setSelection([hit.elementId])
      openHotspotEditor(hit)
    }
  }

  const handleSave = () => {
    if (!activeHotspot) return
    const val = editValue.trim()

    if (activeHotspot.isShotHotspot && activeHotspot.fieldKey) {
      const currentElem = doc.tracks.flatMap((t) => t.elements).find((elem) => elem.id === activeHotspot.elementId)
      const prevOverrides = (currentElem as { overrides?: Record<string, string> })?.overrides || {}
      editor.executeCommand(
        new UpdateShotClipCommand(
          activeHotspot.elementId,
          { overrides: { ...prevOverrides, [activeHotspot.fieldKey]: val } },
          fps,
        ),
      )
    } else if (activeHotspot.kind === 'caption') {
      if (!commitCaptionTextFromClipId(editor, activeHotspot.elementId, val)) {
        editor.executeCommand(new UpdateTextClipCommand(activeHotspot.elementId, { text: val }))
      }
    } else {
      editor.executeCommand(new UpdateTextClipCommand(activeHotspot.elementId, { text: val }))
    }

    activeHotspot.currentValue = val
    setActiveHotspot(null)
  }

  const handleAiRefine = async () => {
    if (!editValue || isRefining || !activeHotspot) return
    setIsRefining(true)
    try {
      const refined = await refineTextWithAi({
        text: editValue,
        fieldLabel: activeHotspot.label,
        maxChars: activeHotspot.fieldKey === 'text' || activeHotspot.fieldKey === 'title' ? 8 : 14,
      })
      if (refined) {
        setEditValue(refined)
        if (activeHotspot.isShotHotspot && activeHotspot.fieldKey) {
          const currentElem = doc.tracks
            .flatMap((t) => t.elements)
            .find((elem) => elem.id === activeHotspot.elementId)
          const prevOverrides = (currentElem as { overrides?: Record<string, string> })?.overrides || {}
          editor.executeCommand(
            new UpdateShotClipCommand(
              activeHotspot.elementId,
              { overrides: { ...prevOverrides, [activeHotspot.fieldKey]: refined } },
              fps,
            ),
          )
        } else if (activeHotspot.kind === 'caption') {
          commitCaptionTextFromClipId(editor, activeHotspot.elementId, refined)
        } else {
          editor.executeCommand(new UpdateTextClipCommand(activeHotspot.elementId, { text: refined }))
        }
      }
    } finally {
      setIsRefining(false)
    }
  }

  const handleColorPick = (colorThemeId: string) => {
    if (!activeHotspot || !activeHotspot.isShotHotspot) return
    const currentElem = doc.tracks.flatMap((t) => t.elements).find((elem) => elem.id === activeHotspot.elementId)
    const prevOverrides = (currentElem as { overrides?: Record<string, string> })?.overrides || {}
    editor.executeCommand(
      new UpdateShotClipCommand(
        activeHotspot.elementId,
        { overrides: { ...prevOverrides, colorTheme: colorThemeId } },
        fps,
      ),
    )
  }

  const getPopoverPlacement = (box: { x: number; y: number; width: number; height: number }) => {
    const topPct = (box.y / canvasH) * 100
    const leftPct = (box.x / canvasW) * 100
    const isLowerHalf = topPct > 55
    return {
      left: `max(8px, min(calc(100% - 220px), ${leftPct}%))`,
      top: isLowerHalf
        ? `max(8px, calc(${topPct}% - 110px))`
        : `min(calc(100% - 120px), calc(${topPct}% + ${(box.height / canvasH) * 100}% + 6px))`,
    }
  }

  const showCaptionChrome =
    captionArmed || altPeek
      ? hotspots.find((h) => h.kind === 'caption' && (selectedIds.includes(h.elementId) || altPeek))
      : null

  const dragging = Boolean(dragOffset)

  return (
    <div
      ref={containerRef}
      className={['ve-stage-overlay', dragging ? 've-stage-overlay--dragging' : ''].filter(Boolean).join(' ')}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {hoveredHotspot &&
        !dragging &&
        !activeHotspot &&
        // 已选中并显示拖动手柄时，不再叠一层悬停徽章
        !(
          showCaptionChrome &&
          selectedIds.includes(showCaptionChrome.elementId) &&
          hoveredHotspot.elementId === showCaptionChrome.elementId
        ) && (
          <div className="ve-hotspot-hover" style={getBoxPercentStyle(hoveredHotspot.box)}>
            <span className="ve-hotspot-hover__badge">
              <span style={{ opacity: 0.8 }}>
                {hoveredHotspot.kind === 'caption'
                  ? '字幕'
                  : hoveredHotspot.kind === 'title-text'
                    ? '标题'
                    : '镜头'}
              </span>
              <span style={{ margin: '0 3px' }}>·</span>
              <span>{hoveredHotspot.label}</span>
              <span style={{ opacity: 0.7, marginLeft: 4 }}>点击选中</span>
            </span>
          </div>
        )}

      {showCaptionChrome && !activeHotspot && selectedIds.includes(showCaptionChrome.elementId) && (
        <div
          className="ve-hotspot-active"
          style={getBoxPercentStyle(showCaptionChrome.box, true)}
        >
          <button
            type="button"
            className="ve-hotspot-drag-handle"
            title="按住拖动 · 双击框内改字"
            aria-label="拖动字幕位置"
            onDoubleClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
            }}
          >
            <span className="ve-hotspot-drag-handle__grip" aria-hidden />
            <span>拖动</span>
          </button>
          <span className="ve-hotspot-handle ve-hotspot-handle--tl" />
          <span className="ve-hotspot-handle ve-hotspot-handle--tr" />
          <span className="ve-hotspot-handle ve-hotspot-handle--bl" />
          <span className="ve-hotspot-handle ve-hotspot-handle--br" />
        </div>
      )}

      {activeHotspot && (
        <div className="ve-hotspot-active" style={getBoxPercentStyle(activeHotspot.box)}>
          <span className="ve-hotspot-active__badge">
            <EditIcon size={10} />
            <span>{activeHotspot.label}</span>
          </span>
          <span className="ve-hotspot-handle ve-hotspot-handle--tl" />
          <span className="ve-hotspot-handle ve-hotspot-handle--tr" />
          <span className="ve-hotspot-handle ve-hotspot-handle--bl" />
          <span className="ve-hotspot-handle ve-hotspot-handle--br" />
        </div>
      )}

      {activeHotspot && (
        <div
          className="ve-inplace-popover"
          style={getPopoverPlacement(activeHotspot.box)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="ve-inplace-popover__head">
            <span className="ve-inplace-popover__title">
              <EditIcon size={11} />
              <span>{activeHotspot.label}</span>
            </span>
            <button
              type="button"
              className="ve-inplace-popover__close"
              onClick={() => setActiveHotspot(null)}
              title="关闭 (Esc)"
            >
              <CloseIcon size={11} />
            </button>
          </div>

          <div className="ve-inplace-popover__body">
            <input
              ref={inputRef}
              type="text"
              className="ve-inplace-popover__input"
              value={editValue}
              placeholder="改字后 Enter…"
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                } else if (e.key === 'Escape') {
                  setActiveHotspot(null)
                }
              }}
            />

            <div className="ve-inplace-popover__actions">
              <button
                type="button"
                className="ve-inplace-popover__btn ve-inplace-popover__btn--ghost"
                disabled={isRefining || !editValue}
                onClick={handleAiRefine}
                title="精炼文案"
              >
                <SparklesIcon size={10} />
                <span>{isRefining ? '…' : '精炼'}</span>
              </button>

              <div className="ve-inplace-popover__actions-end">
                <button
                  type="button"
                  className="ve-inplace-popover__btn ve-inplace-popover__btn--ghost"
                  onClick={() => setActiveHotspot(null)}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="ve-inplace-popover__btn ve-inplace-popover__btn--primary"
                  onClick={handleSave}
                >
                  <CheckIcon size={10} />
                  <span>确定</span>
                </button>
              </div>
            </div>

            {activeHotspot.isShotHotspot && (
              <div className="ve-inplace-popover__colors">
                <PaletteIcon size={11} />
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="ve-inplace-color-dot"
                    style={{ background: c.color }}
                    title={c.name}
                    onClick={() => handleColorPick(c.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
