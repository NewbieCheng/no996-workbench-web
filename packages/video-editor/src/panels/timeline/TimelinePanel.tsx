/**
 * 完整时间轴面板组件（支持 Full 专业多轨与 Compact 精简/IP 两种展示模式）
 * 共享同一套底层 EditorInstance、CommandManager 与撤销栈
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { TimeUs } from '../../core/time.ts'
import type { ShotClipElement, TimelineTrack, TrackElement, TrackType } from '../../core/project.ts'
import {
  SplitElementCommand,
  DeleteElementsCommand,
  MoveElementsCommand,
  MoveElementToTrackCommand,
  UpdateElementTransformCommand,
  canMoveElementToTrack,
} from '../../core/commands/timeline-commands.ts'
import { TrimShotCommand } from '../../core/commands/shot-commands.ts'
import {
  SetTrackPropertiesCommand,
  AddTrackCommand,
  DeleteTrackCommand,
  ReorderTracksCommand,
  DuplicateElementsCommand,
} from '../../core/commands/track-commands.ts'
import { InsertShotCommand } from '../../core/commands/shot-commands.ts'
import {
  computeTrackEndStartUs,
  isDefaultInsertTrack,
  SetDefaultInsertTrackCommand,
} from '../../core/commands/insert-track-defaults.ts'
import { canLandShotOnTrack, shotElementAllowsCrossTrack } from '../shots/shot-insert-policy.ts'
import { resolveShotInsertTrack } from '../shots/resolve-shot-insert-track.ts'
import {
  commitMovesSyncingCaptions,
  commitTrimSyncingCaptions,
} from '../captions/sync-text-track.ts'
import { TimelineRuler } from './TimelineRuler.tsx'
import { TimelineTrackHeader } from './TimelineTrackHeader.tsx'
import { TimelineTrackView, type TimelineDropPayload } from './TimelineTrackView.tsx'
import { TrackActionMenu } from './TrackActionMenu.tsx'
import { TimelineToolbar, type TimelinePlaybackControls } from './TimelineToolbar.tsx'
import { computeNudgeMoves } from './nudge-logic.ts'
import { collectSnapReferencePoints, mergeExternalSnapPoints, resolveSnapping } from './snapping.ts'
import { computeBoxSelection } from './selection-box.ts'
import { computeTimelineContentWidth, pixelsToTimeUs, timeUsToPixels } from './zoom-scale.ts'
import {
  isCaptionTextClip,
  selectAllCaptionClipIds,
  cueIdFromCaptionClipId,
} from '../captions/sync-text-track.ts'
import { shiftCaptions } from '../captions/caption-ops.ts'
import { UpdateCaptionsCommand } from '../../core/commands/timeline-commands.ts'
import { BatchCommand } from '../../core/commands/base.ts'
import {
  applySnapToTrim,
  applyTrimToElement,
  computeTrimFromOrigin,
  createTrimOrigin,
  type TrimSessionOrigin,
} from './trim-session.ts'
import {
  applyStorylineOriginStarts,
  computeStorylineLayout,
  reflowStorylineMoves,
  storylineProbeUs,
  type StorylineGhost,
} from './storyline-layout.ts'
import { CLIP_LAYOUT_MS, type ClipDragVisual } from './timeline-clip-motion.ts'
import {
  buildTrackReorderStyle,
  resolveTrackDropDocIndexFromDelta,
  resolveTrackHeaderDocIndex,
  type TrackDragVisual,
} from './track-reorder-motion.ts'
import { canReorderTrackPair } from './track-reorder-policy.ts'
import './timeline-clips.css'
import { getTrackHeight, TIMELINE_RULER_HEIGHT, type TimelineDensity } from './track-grouping.ts'
export type TimelinePanelVariant = 'full' | 'compact'

/**
 * 单条轨道。
 *
 * 播放头每 1/30 秒推进会重渲染整个面板；用 memo 把轨道内容挡在外面 ——
 * 轨道数据、选区、缩放不变时，片段 DOM 完全不动，播放只更新播放头线。
 */
const TimelineTrackRow = React.memo(function TimelineTrackRow({
  track,
  height,
  assets,
  zoom,
  durationUs,
  contentWidthPx,
  selectedElementIds,
  onSelectElement,
  onEditElement,
  onDuplicateElement,
  onClearSelection,
  onMoveElement,
  onTrimStart,
  onTrimEnd,
  onDropPayload,
  highlightCrossTrack,
  clipDrag,
  layoutAnimate,
  storylineGhost,
  reorderMotionStyle,
}: {
  track: TimelineTrack
  height?: number
  assets: Record<string, { name?: string }> | undefined
  zoom: number
  durationUs: TimeUs
  contentWidthPx: number
  selectedElementIds: string[]
  onSelectElement: (e: React.MouseEvent, elementId: string) => void
  onEditElement?: (elementId: string) => void
  onDuplicateElement?: (elementId: string) => void
  onClearSelection: () => void
  onMoveElement: (
    elementId: string,
    deltaPx: number,
    commit: boolean,
    deltaYPx?: number,
    clientX?: number,
    clientY?: number,
  ) => void
  onTrimStart: (elementId: string, deltaPx: number, commit: boolean) => void
  onTrimEnd: (elementId: string, deltaPx: number, commit: boolean) => void
  highlightCrossTrack?: boolean
  onDropPayload: (payload: TimelineDropPayload, timeUs: TimeUs, trackId: string) => void
  clipDrag?: ClipDragVisual | null
  layoutAnimate?: boolean
  storylineGhost?: StorylineGhost | null
  reorderMotionStyle?: React.CSSProperties
}) {
  return (
    <TimelineTrackView
      track={track}
      height={height}
      assets={assets}
      zoom={zoom}
      durationUs={durationUs}
      contentWidthPx={contentWidthPx}
      selectedElementIds={selectedElementIds}
      onSelectElement={onSelectElement}
      onEditElement={onEditElement}
      onDuplicateElement={onDuplicateElement}
      onClearSelection={onClearSelection}
      onDropPayload={(payload, timeUs) => onDropPayload(payload, timeUs, track.id)}
      onMoveElement={onMoveElement}
      onTrimStart={onTrimStart}
      onTrimEnd={onTrimEnd}
      highlightCrossTrack={highlightCrossTrack}
      clipDrag={clipDrag}
      layoutAnimate={layoutAnimate}
      storylineGhost={storylineGhost}
      reorderMotionStyle={reorderMotionStyle}
    />
  )
})

function findElementContext(
  tracks: TimelineTrack[],
  elementId: string,
): { element: TrackElement; track: TimelineTrack } | undefined {
  for (const track of tracks) {
    const element = track.elements.find((e) => e.id === elementId)
    if (element) return { element, track }
  }
  return undefined
}

/** 镜头轨上纯镜头片段：首尾相接故事线布局 */
function trackUsesShotStorylineLayout(track: TimelineTrack): boolean {
  return (
    track.type === 'shot' &&
    track.elements.length > 0 &&
    track.elements.every((e) => e.type === 'shot')
  )
}

function resolveTrackIdAtPoint(clientX: number, clientY: number): string | null {
  const hit = document.elementFromPoint(clientX, clientY)
  if (!hit) return null
  const trackEl = (hit as HTMLElement).closest('[data-testid^="timeline-track-"]')
  if (!trackEl) return null
  const testId = trackEl.getAttribute('data-testid') ?? ''
  return testId.replace('timeline-track-', '') || null
}

/** 跨轨下拖：在轨道栈下方空白处新建轨道时的目标类型 */
function resolveNewTrackTypeForElement(element: TrackElement): TrackType {
  if (element.type === 'shot') return 'video'
  if (element.type === 'audio') return 'audio'
  if (element.type === 'text') return 'text'
  if (element.type === 'image') return 'overlay'
  return 'video'
}

function isPointerBelowTracksStack(clientY: number): boolean {
  const stack = document.querySelector('.ve-timeline-tracks-stack')
  if (!stack) return false
  const rect = stack.getBoundingClientRect()
  return clientY > rect.bottom - 4
}

export type TimelinePanelProps = {
  editor: EditorInstance
  variant?: TimelinePanelVariant
  playheadUs?: TimeUs
  onSeek?: (timeUs: TimeUs) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  style?: React.CSSProperties
  className?: string
  /**
   * 从库面板拖入音频时的处理器。
   * 面板本身拿不到 Blob（音频是 public 下的大文件，要按需 fetch），因此交给宿主处理。
   * 不传时音频拖放被忽略，镜头拖放仍可用。
   */
  onDropAudio?: (input: {
    trackId: string
    audioKind: 'sfx' | 'bgm'
    label: string
    path: string
    startUs: TimeUs
  }) => void | Promise<void>
  /** 是否启用磁吸吸附（含片段边界、播放头、节拍网格） */
  snapEnabled?: boolean
  /** 音乐节拍网格（微秒）。由宿主用 beat-detect 算出后传入 */
  snapBeatPoints?: number[]
  playback?: TimelinePlaybackControls
  toolbarSimplified?: boolean
  /** 工具栏右侧扩展（如节拍检测按钮） */
  toolbarExtras?: React.ReactNode
}

export function TimelinePanel({
  editor,
  variant = 'full',
  playheadUs = 0,
  onSeek,
  collapsed = false,
  onDropAudio,
  snapEnabled = true,
  snapBeatPoints,
  onToggleCollapse,
  playback,
  toolbarSimplified = false,
  toolbarExtras,
  style,
  className,
}: TimelinePanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [zoom, setZoom] = useState(1.0)
  const [rippleEnabled, setRippleEnabled] = useState(false)
  // 吸附开关由外部 prop 控制；内部只为工具栏留一个本地副本同步显示
  const [snapLocal, setSnapLocal] = useState(snapEnabled)
  useEffect(() => setSnapLocal(snapEnabled), [snapEnabled])
  // 拖动起点：一次拖动过程中的原始位置
  const dragOriginRef = useRef<{
    elementId: string
    startUs: number
    storylineStarts?: Map<string, TimeUs>
  } | null>(null)
  const trimSessionRef = useRef<TrimSessionOrigin | null>(null)
  const [snapGuideUs, setSnapGuideUs] = useState<TimeUs | null>(null)
  const [marquee, setMarquee] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
    additive: boolean
  } | null>(null)
  const marqueeRef = useRef<typeof marquee>(null)
  const [crossTrackHighlightId, setCrossTrackHighlightId] = useState<string | null>(null)
  const crossTrackPreviewRef = useRef<{ elementId: string; trackId: string } | null>(null)
  const [clipDrag, setClipDrag] = useState<ClipDragVisual | null>(null)
  const [storylineGhost, setStorylineGhost] = useState<StorylineGhost | null>(null)
  const [layoutMotionEnabled, setLayoutMotionEnabled] = useState(false)
  const [trackDrag, setTrackDrag] = useState<TrackDragVisual | null>(null)
  const [trackLayoutMotionEnabled, setTrackLayoutMotionEnabled] = useState(false)
  const trackDragStartYRef = useRef(0)
  const trackDragPointerIdRef = useRef<number | null>(null)
  const trackLayoutMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const layoutMotionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleDragRef = useRef<number | null>(null)
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>(() => editor.getSelectedElementIds())
  const fps = doc.canvas.fps.num / doc.canvas.fps.den

  const pulseLayoutMotion = useCallback(() => {
    setLayoutMotionEnabled(true)
    if (layoutMotionTimerRef.current) clearTimeout(layoutMotionTimerRef.current)
    layoutMotionTimerRef.current = setTimeout(() => {
      setLayoutMotionEnabled(false)
      layoutMotionTimerRef.current = null
    }, CLIP_LAYOUT_MS + 40)
  }, [])

  const pulseTrackLayoutMotion = useCallback(() => {
    setTrackLayoutMotionEnabled(true)
    if (trackLayoutMotionTimerRef.current) clearTimeout(trackLayoutMotionTimerRef.current)
    trackLayoutMotionTimerRef.current = setTimeout(() => {
      setTrackLayoutMotionEnabled(false)
      trackLayoutMotionTimerRef.current = null
    }, CLIP_LAYOUT_MS + 40)
  }, [])

  const endClipDragVisual = useCallback(() => {
    setClipDrag(null)
    setStorylineGhost(null)
  }, [])

  const settleStorylineClip = useCallback(
    (elementId: string, originStartUs: TimeUs, deltaPx: number, newStartUs: TimeUs) => {
      const residualPx =
        timeUsToPixels(originStartUs, zoom) + deltaPx - timeUsToPixels(newStartUs, zoom)
      setStorylineGhost(null)
      pulseLayoutMotion()
      if (Math.abs(residualPx) < 1) {
        setClipDrag(null)
        return
      }
      setClipDrag({ elementId, deltaPx: residualPx, settling: true })
      if (settleDragRef.current != null) cancelAnimationFrame(settleDragRef.current)
      settleDragRef.current = requestAnimationFrame(() => {
        settleDragRef.current = requestAnimationFrame(() => {
          setClipDrag(null)
          settleDragRef.current = null
        })
      })
    },
    [zoom, pulseLayoutMotion],
  )

  useEffect(() => {
    return () => {
      if (layoutMotionTimerRef.current) clearTimeout(layoutMotionTimerRef.current)
      if (trackLayoutMotionTimerRef.current) clearTimeout(trackLayoutMotionTimerRef.current)
      if (settleDragRef.current != null) cancelAnimationFrame(settleDragRef.current)
    }
  }, [])

  const containerRef = useRef<HTMLDivElement>(null)
  const leftHeadersScrollRef = useRef<HTMLDivElement>(null)
  const rightViewportScrollRef = useRef<HTMLDivElement>(null)
  const [viewportWidthPx, setViewportWidthPx] = useState(0)

  useEffect(() => {
    const el = rightViewportScrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => setViewportWidthPx(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [collapsed])

  const timelineContentWidthPx = useMemo(
    () => computeTimelineContentWidth(doc.durationUs, zoom, viewportWidthPx),
    [doc.durationUs, zoom, viewportWidthPx],
  )

  // 左右联动滚动事件：右侧轨道视口滚动时，精准带动左侧轨道头部纵向同步
  const handleRightViewportScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (leftHeadersScrollRef.current) {
      leftHeadersScrollRef.current.scrollTop = e.currentTarget.scrollTop
    }
  }, [])

  // 监听文档更新与选区同步
  useEffect(() => {
    const unsubscribe = editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedElementIds(editor.getSelectedElementIds())
    })
    return unsubscribe
  }, [editor])

  const canUndo = editor.canUndo()
  const canRedo = editor.canRedo()

  // 轨道过滤（compact 模式可根据需要展示核心音视频轨）
  const visibleTracks = doc.tracks.filter((track) => {
    if (variant === 'compact') {
      return !track.hidden
    }
    return true
  })

  // 轨道密度（标准模式 / 紧凑模式：文字轨 28px、音频轨 34px、镜头视轨 44px）
  const [density, setDensity] = useState<TimelineDensity>(variant === 'compact' ? 'compact' : 'standard')

  const trackHeightsPx = useMemo(
    () => doc.tracks.map((track) => getTrackHeight(track.type, density)),
    [doc.tracks, density],
  )

  const getTrackReorderMotionStyle = useCallback(
    (trackId: string, docIndex: number) =>
      buildTrackReorderStyle({
        trackId,
        docIndex,
        drag: trackDrag,
        trackHeights: trackHeightsPx,
        layoutAnimate: trackLayoutMotionEnabled,
        reducedMotion: false,
      }),
    [trackDrag, trackHeightsPx, trackLayoutMotionEnabled],
  )

  // 轨道添加与管理菜单状态
  const [trackActionMenuOpen, setTrackActionMenuOpen] = useState(false)
  const trackAddButtonRef = useRef<HTMLButtonElement>(null)

  // 识别所有无素材且非核心主轨（shot 轨是主故事线，不可删）的空轨道
  const emptyTracks = useMemo(() => {
    return doc.tracks.filter(
      (track) => track.type !== 'shot' && track.elements.length === 0 && !track.locked,
    )
  }, [doc.tracks])

  // 添加新轨道
  const handleAddTrack = useCallback(
    (type: TrackType, defaultName?: string) => {
      const sameTypeCount = doc.tracks.filter((t) => t.type === type).length
      const label =
        defaultName ??
        (type === 'video'
          ? '视频轨'
          : type === 'audio'
            ? '音频轨'
            : type === 'text'
              ? '文字轨'
              : '画中画')
      const name = `${label} ${sameTypeCount + 1}`
      const id = `track-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

      const newTrack: TimelineTrack = {
        id,
        type,
        name,
        muted: false,
        hidden: false,
        locked: false,
        elements: [],
      }

      try {
        editor.executeCommand(new AddTrackCommand(newTrack))
      } catch (err) {
        console.warn('添加轨道失败:', err)
      }
    },
    [doc.tracks, editor],
  )

  // 一键清理所有空轨道（极大压缩纵向体积）
  const handleCleanEmptyTracks = useCallback(() => {
    if (emptyTracks.length === 0) return
    for (const track of emptyTracks) {
      try {
        editor.executeCommand(new DeleteTrackCommand(track.id))
      } catch (err) {
        console.warn('删除空轨道失败:', err)
      }
    }
  }, [emptyTracks, editor])

  // 单条空轨道删除
  const handleDeleteTrack = useCallback(
    (trackId: string) => {
      const track = doc.tracks.find((t) => t.id === trackId)
      if (!track || track.type === 'shot' || track.locked) return
      try {
        editor.executeCommand(new DeleteTrackCommand(trackId))
      } catch (err) {
        console.warn('删除轨道失败:', err)
      }
    },
    [doc.tracks, editor],
  )

  // 选中处理：Shift / Ctrl / Cmd 加减选
  const handleSelectElement = useCallback((e: React.MouseEvent, elementId: string) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      const current = editor.getSelectedElementIds()
      const next = current.includes(elementId)
        ? current.filter((id) => id !== elementId)
        : [...current, elementId]
      editor.setSelection(next)
    } else {
      editor.setSelection([elementId])
    }
  }, [editor])

  const handleClearSelection = useCallback(() => {
    editor.clearSelection()
  }, [editor])

  /** 点击轨头：选中该轨全部片段（整轨平移等） */
  const handleSelectTrack = useCallback(
    (trackId: string) => {
      const track = editor.getDocument().tracks.find((t) => t.id === trackId)
      if (!track) return
      const ids = track.elements.map((el) => el.id)
      editor.setSelection(ids)
      setSelectedElementIds(ids)
    },
    [editor],
  )

  const handleEditElement = useCallback((elementId: string) => {
    editor.setSelection([elementId])
    const ctx = findElementContext(doc.tracks, elementId)
    if (ctx) {
      editor.setPlayheadUs(ctx.element.startUs)
      onSeek?.(ctx.element.startUs)
    }
    window.dispatchEvent(new CustomEvent('video-factory:focus-inspector', { detail: { elementId } }))
  }, [editor, doc.tracks, onSeek])

  // 分割操作
  const handleSplit = useCallback(() => {
    if (selectedElementIds.length === 0) return
    const targetId = selectedElementIds[0]

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === targetId)
      if (elem) {
        if (playheadUs > elem.startUs && playheadUs < elem.startUs + elem.durationUs) {
          try {
            const cmd = new SplitElementCommand(targetId, playheadUs)
            editor.executeCommand(cmd)
          } catch (err) {
            console.warn('分割失败:', err)
          }
        }
        break
      }
    }
  }, [doc, selectedElementIds, playheadUs, editor])

  // 删除操作（字幕 marker 与 CaptionCue 同批删除）
  const handleDelete = useCallback(() => {
    if (selectedElementIds.length === 0) return
    const ids = [...selectedElementIds]
    const docSnap = editor.getDocument()
    const removingCueIds = new Set<string>()
    for (const id of ids) {
      const fromId = cueIdFromCaptionClipId(id)
      if (fromId) {
        removingCueIds.add(fromId)
        continue
      }
      for (const track of docSnap.tracks) {
        const el = track.elements.find((e) => e.id === id)
        if (el && isCaptionTextClip(el)) {
          const propCue = (el as { component?: { props?: { cueId?: string } } }).component?.props?.cueId
          if (typeof propCue === 'string') removingCueIds.add(propCue)
        }
      }
    }
    try {
      const deleteCmd = new DeleteElementsCommand(ids, rippleEnabled)
      if (removingCueIds.size > 0) {
        const nextCues = (docSnap.captions || []).filter((c) => !removingCueIds.has(c.id))
        editor.executeCommand(
          new BatchCommand([deleteCmd, new UpdateCaptionsCommand(nextCues)]),
        )
      } else {
        editor.executeCommand(deleteCmd)
      }
      setSelectedElementIds([])
    } catch (err) {
      console.warn('删除失败:', err)
    }
  }, [selectedElementIds, rippleEnabled, editor])

  const canFlipSelection = useMemo(() => {
    if (selectedElementIds.length === 0) return false
    return doc.tracks.some((track) =>
      track.elements.some((el) => selectedElementIds.includes(el.id) && 'transform' in el),
    )
  }, [doc.tracks, selectedElementIds])

  const handleFlip = useCallback(() => {
    for (const id of selectedElementIds) {
      const ctx = findElementContext(doc.tracks, id)
      if (!ctx || !('transform' in ctx.element)) continue
      const flipX = !Boolean(ctx.element.transform.flipX)
      editor.executeCommand(new UpdateElementTransformCommand(id, { flipX }))
    }
  }, [doc.tracks, selectedElementIds, editor])

  const applyStorylineReflowForTrack = useCallback(
    (trackId: string, preserveSelection?: string[]) => {
      const track = editor.getDocument().tracks.find((t) => t.id === trackId)
      if (!track || !trackUsesShotStorylineLayout(track)) return
      const shots = track.elements.filter((e) => e.type === 'shot') as ShotClipElement[]
      const moves = reflowStorylineMoves(shots)
      const changed = moves.some((m) => {
        const shot = shots.find((s) => s.id === m.elementId)
        return shot != null && Math.abs(shot.startUs - m.newStartUs) >= 1000
      })
      if (changed) {
        editor.executeCommand(new MoveElementsCommand(moves))
        if (preserveSelection?.length) {
          editor.setSelection(preserveSelection)
          setSelectedElementIds(preserveSelection)
        }
      }
    },
    [editor],
  )

  const handleDuplicateElement = useCallback(
    (elementId: string) => {
      const ctx = findElementContext(doc.tracks, elementId)
      if (!ctx || ctx.track.locked) return
      try {
        editor.executeCommand(new DuplicateElementsCommand([elementId]))
        const createdIds = [...editor.getSelectedElementIds()]
        if (trackUsesShotStorylineLayout(ctx.track)) {
          applyStorylineReflowForTrack(ctx.track.id)
        }
        if (createdIds.length > 0) {
          editor.setSelection(createdIds)
          setSelectedElementIds(createdIds)
        }
      } catch (err) {
        console.warn('复制失败:', err)
      }
    },
    [doc.tracks, editor, applyStorylineReflowForTrack],
  )

  // 拖放落点：镜头直接插入当前轨；音频交给宿主（它才拿得到 Blob）
  const handleDropPayload = useCallback(
    (payload: TimelineDropPayload, timeUs: TimeUs, trackId: string) => {
      const track = doc.tracks.find((item) => item.id === trackId) ?? doc.tracks[0]
      if (!track || track.locked) return

      if (payload.kind === 'shot') {
        const fps = doc.canvas.fps.num / doc.canvas.fps.den
        try {
          const landedOnPolicyTrack =
            !track.locked && canLandShotOnTrack(payload.shotId, track.type)
          const resolved = resolveShotInsertTrack(editor, payload.shotId, {
            explicitTrackId: landedOnPolicyTrack ? track.id : undefined,
            dropTimeUs: landedOnPolicyTrack ? Math.max(0, Math.round(timeUs)) : undefined,
          })
          editor.executeCommand(
            new InsertShotCommand(
              {
                trackId: resolved.track.id,
                shotId: payload.shotId,
                sourceDurationFrames: payload.durationInFrames,
                startUs: resolved.startUs,
                canvasWidth: doc.canvas.width,
                canvasHeight: doc.canvas.height,
              },
              fps,
            ),
          )
        } catch (err) {
          console.warn('插入镜头失败:', err)
        }
        return
      }

      // 音频：找音频轨（或当前轨若已是音频轨）
      const audioTrack =
        track.type === 'audio' && !track.locked
          ? track
          : doc.tracks.find((item) => item.type === 'audio' && !item.locked)
      if (!audioTrack) return
      void onDropAudio?.({
        trackId: audioTrack.id,
        audioKind: payload.audioKind,
        label: payload.label,
        path: payload.path,
        startUs: Math.max(0, Math.round(timeUs)),
      })
    },
    [doc, editor, onDropAudio],
  )

  const getSnapReferences = useCallback(
    (excludeElementIds: string[]) => {
      const references = collectSnapReferencePoints(doc.tracks, playheadUs, excludeElementIds)
      return mergeExternalSnapPoints(references, snapBeatPoints)
    },
    [doc.tracks, playheadUs, snapBeatPoints],
  )

  const applyMovesToDocument = useCallback(
    (moves: Array<{ elementId: string; newStartUs: TimeUs }>) => {
      const moveMap = new Map(moves.map((m) => [m.elementId, m.newStartUs]))
      editor.updateDocument((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          elements: track.elements.map((element) =>
            moveMap.has(element.id)
              ? { ...element, startUs: Math.round(moveMap.get(element.id)!) }
              : element,
          ),
        })),
      }))
    },
    [editor],
  )

  const restoreStorylineFromRef = useCallback(() => {
    const origin = dragOriginRef.current?.storylineStarts
    if (!origin) return
    applyMovesToDocument(
      Array.from(origin.entries()).map(([elementId, newStartUs]) => ({ elementId, newStartUs })),
    )
  }, [applyMovesToDocument])

  const handleTrim = useCallback(
    (elementId: string, edge: 'start' | 'end', deltaPx: number, commit: boolean) => {
      const ctx = findElementContext(doc.tracks, elementId)
      if (!ctx || ctx.track.locked) return

      if (!trimSessionRef.current || trimSessionRef.current.elementId !== elementId) {
        trimSessionRef.current = createTrimOrigin(ctx.element, edge)
      } else if (trimSessionRef.current.edge !== edge) {
        trimSessionRef.current = createTrimOrigin(ctx.element, edge)
      }

      const origin = trimSessionRef.current
      let computed = computeTrimFromOrigin(origin, deltaPx, zoom)

      if (snapLocal) {
        const refs = getSnapReferences([elementId])
        const snapTarget =
          edge === 'start'
            ? resolveSnapping(computed.startUs, refs, zoom, 8)
            : resolveSnapping(computed.startUs + computed.durationUs, refs, zoom, 8)
        if (snapTarget.hasSnapped) {
          computed = applySnapToTrim(computed, edge, snapTarget.snappedTimeUs)
          setSnapGuideUs(snapTarget.snapPointUs ?? snapTarget.snappedTimeUs)
        } else {
          setSnapGuideUs(null)
        }
      } else {
        setSnapGuideUs(null)
      }

      if (!commit) {
        editor.updateDocument((prev) => ({
          ...prev,
          tracks: prev.tracks.map((track) => ({
            ...track,
            elements: track.elements.map((element) =>
              element.id === elementId ? applyTrimToElement(element, computed, fps) : element,
            ),
          })),
        }))
        return
      }

      setSnapGuideUs(null)
      const session = trimSessionRef.current
      trimSessionRef.current = null
      if (!session) return

      const unchanged =
        Math.abs(computed.startUs - session.originStartUs) < 1000 &&
        Math.abs(computed.durationUs - session.originDurationUs) < 1000

      if (unchanged) {
        editor.updateDocument((prev) => ({
          ...prev,
          tracks: prev.tracks.map((track) => ({
            ...track,
            elements: track.elements.map((element) =>
              element.id === elementId
                ? applyTrimToElement(
                    element,
                    {
                      startUs: session.originStartUs,
                      durationUs: session.originDurationUs,
                      sourceInUs: session.sourceInUs,
                      sourceOutUs: session.sourceOutUs,
                    },
                    fps,
                  )
                : element,
            ),
          })),
        }))
        return
      }

      editor.updateDocument((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          elements: track.elements.map((element) =>
            element.id === elementId
              ? applyTrimToElement(
                  element,
                  {
                    startUs: session.originStartUs,
                    durationUs: session.originDurationUs,
                    sourceInUs: session.sourceInUs,
                    sourceOutUs: session.sourceOutUs,
                  },
                  fps,
                )
              : element,
          ),
        })),
      }))

      if (ctx.element.type === 'shot') {
        editor.executeCommand(
          new TrimShotCommand(
            elementId,
            { startUs: computed.startUs, durationUs: computed.durationUs },
            fps,
          ),
        )
        return
      }

      const patch: {
        startUs: TimeUs
        durationUs: TimeUs
        sourceInUs?: TimeUs
        sourceOutUs?: TimeUs
      } = {
        startUs: computed.startUs,
        durationUs: computed.durationUs,
      }
      if (computed.sourceInUs !== undefined) patch.sourceInUs = computed.sourceInUs
      if (computed.sourceOutUs !== undefined) patch.sourceOutUs = computed.sourceOutUs
      commitTrimSyncingCaptions(editor, elementId, patch)
    },
    [doc.tracks, zoom, snapLocal, getSnapReferences, editor, fps],
  )

  const handleTrimStart = useCallback(
    (elementId: string, deltaPx: number, commit: boolean) => {
      handleTrim(elementId, 'start', deltaPx, commit)
    },
    [handleTrim],
  )

  /**
   * 整体拖动片段。
   *
   * 关键设计：拖动中（commit=false）只更新一个「预览偏移」，松手时（commit=true）
   * 才写一条 MoveElementsCommand。否则每次 mousemove 都进撤销栈，
   * 拖一下要按几十次撤销才能退回去。
   *
   * 吸附：拖动中的落点会先经过 resolveSnapping，命中就贴到参考点
   * （片段边界 / 播放头 / 音乐节拍网格）。
   */
  const handleMoveElement = useCallback(
    (
      elementId: string,
      deltaPx: number,
      commit: boolean,
      deltaYPx = 0,
      clientX?: number,
      clientY?: number,
    ) => {
      const ctx = findElementContext(doc.tracks, elementId)
      if (!ctx || ctx.track.locked) return

      const { element: found, track: sourceTrack } = ctx
      const foundShotId = found.type === 'shot' ? found.shotId : undefined
      // 纯镜头轨磁性故事线：横向换位；竖向跨轨时退出磁性预览
      const isShotStoryline =
        sourceTrack.type === 'shot' &&
        found.type === 'shot' &&
        sourceTrack.elements.length > 0 &&
        sourceTrack.elements.every((e) => e.type === 'shot')

      const baseStart =
        dragOriginRef.current?.elementId === elementId
          ? dragOriginRef.current.startUs
          : found.startUs
      const rawStart = Math.max(0, baseStart + pixelsToTimeUs(deltaPx, zoom))
      let finalStart = rawStart

      const canCross =
        found.type !== 'shot' || shotElementAllowsCrossTrack(found.shotId)
      const crossTrackIntent =
        Math.abs(deltaYPx) >= 12 &&
        canCross &&
        clientX !== undefined &&
        clientY !== undefined

      if (crossTrackIntent && !commit) {
        const targetTrackId = resolveTrackIdAtPoint(clientX!, clientY!)
        const targetTrack = targetTrackId
          ? doc.tracks.find((t) => t.id === targetTrackId)
          : undefined
        if (
          targetTrack &&
          !targetTrack.locked &&
          canMoveElementToTrack(found.type, targetTrack.type, foundShotId) &&
          targetTrack.id !== sourceTrack.id
        ) {
          crossTrackPreviewRef.current = { elementId, trackId: targetTrack.id }
          setCrossTrackHighlightId(targetTrack.id)
        } else if (isPointerBelowTracksStack(clientY!)) {
          crossTrackPreviewRef.current = { elementId, trackId: '__new__' }
          setCrossTrackHighlightId(null)
        } else {
          crossTrackPreviewRef.current = null
          setCrossTrackHighlightId(null)
        }
      }

      if (!isShotStoryline && !crossTrackIntent && snapLocal) {
        const snapped = resolveSnapping(rawStart, getSnapReferences([elementId]), zoom, 8)
        if (snapped.hasSnapped) {
          finalStart = snapped.snappedTimeUs
          setSnapGuideUs(snapped.snapPointUs ?? snapped.snappedTimeUs)
        } else {
          setSnapGuideUs(null)
        }
      } else if (!commit) {
        setSnapGuideUs(null)
      }

      const liveShots = sourceTrack.elements.filter((e) => e.type === 'shot') as ShotClipElement[]

      if (!commit) {
        if (!dragOriginRef.current || dragOriginRef.current.elementId !== elementId) {
          const storylineStarts = isShotStoryline
            ? new Map(
                sourceTrack.elements.map((e) => [e.id, e.startUs] as [string, TimeUs]),
              )
            : undefined
          dragOriginRef.current = { elementId, startUs: found.startUs, storylineStarts }
        }

        setLayoutMotionEnabled(true)

        if (isShotStoryline && !crossTrackIntent) {
          const originRef = dragOriginRef.current
          const shots = applyStorylineOriginStarts(liveShots, originRef.storylineStarts)
          const probeUs = storylineProbeUs(
            originRef.startUs,
            found.durationUs,
            pixelsToTimeUs(deltaPx, zoom),
          )
          const moves = computeStorylineLayout(shots, elementId, probeUs)
          const insertUs = moves.find((m) => m.elementId === elementId)?.newStartUs ?? 0
          setStorylineGhost({ startUs: insertUs, durationUs: found.durationUs })
          setClipDrag({ elementId, deltaPx, deltaYPx: 0 })
          applyMovesToDocument(moves.filter((m) => m.elementId !== elementId))
        } else if (crossTrackIntent) {
          setStorylineGhost(null)
          if (isShotStoryline) restoreStorylineFromRef()
          setClipDrag({ elementId, deltaPx, deltaYPx })
        } else {
          setStorylineGhost(null)
          setClipDrag({ elementId, deltaPx: 0, deltaYPx: 0 })
          editor.updateDocument((prev) => ({
            ...prev,
            tracks: prev.tracks.map((track) => ({
              ...track,
              elements: track.elements.map((element) =>
                element.id === elementId
                  ? { ...element, startUs: Math.round(finalStart) }
                  : element,
              ),
            })),
          }))
        }
        return
      }

      setSnapGuideUs(null)
      setCrossTrackHighlightId(null)
      const crossPreviewAtCommit =
        crossTrackIntent && clientX !== undefined && clientY !== undefined
          ? crossTrackPreviewRef.current
          : null
      const origin = dragOriginRef.current
      crossTrackPreviewRef.current = null

      if (!origin) {
        dragOriginRef.current = null
        endClipDragVisual()
        return
      }

      if (
        crossTrackIntent &&
        clientX !== undefined &&
        clientY !== undefined &&
        crossPreviewAtCommit?.elementId === elementId
      ) {
        const rect = rightViewportScrollRef.current?.getBoundingClientRect()
        const scrollLeft = rightViewportScrollRef.current?.scrollLeft ?? 0
        const xInTrack = rect ? clientX - rect.left + scrollLeft : 0
        const dropTimeUs = Math.max(0, Math.round(pixelsToTimeUs(xInTrack, zoom)))
        restoreStorylineFromRef()
        dragOriginRef.current = null
        endClipDragVisual()

        if (crossPreviewAtCommit.trackId === '__new__') {
          const newType = resolveNewTrackTypeForElement(found)
          const newTrackId = `track-${newType}-${crypto.randomUUID().slice(0, 8)}`
          const typeLabel =
            newType === 'video'
              ? '视频'
              : newType === 'audio'
                ? '音频'
                : newType === 'text'
                  ? '文字'
                  : newType === 'overlay'
                    ? '贴图'
                    : '轨道'
          editor.executeCommand(
            new AddTrackCommand({
              id: newTrackId,
              type: newType,
              name: `${typeLabel}轨`,
              muted: false,
              hidden: false,
              locked: false,
              elements: [],
            }),
          )
          editor.executeCommand(new MoveElementToTrackCommand(elementId, newTrackId, dropTimeUs))
          return
        }

        const targetTrack = doc.tracks.find((t) => t.id === crossPreviewAtCommit.trackId)
        const timeUs =
          targetTrack?.type === 'shot'
            ? computeTrackEndStartUs(targetTrack)
            : dropTimeUs
        editor.executeCommand(
          new MoveElementToTrackCommand(elementId, crossPreviewAtCommit.trackId, timeUs),
        )
        if (targetTrack?.type === 'shot') {
          applyStorylineReflowForTrack(crossPreviewAtCommit.trackId, [elementId])
        }
        return
      }

      if (isShotStoryline) {
        const shots = applyStorylineOriginStarts(liveShots, origin.storylineStarts)
        const probeUs = storylineProbeUs(
          origin.startUs,
          found.durationUs,
          pixelsToTimeUs(deltaPx, zoom),
        )
        const moves = computeStorylineLayout(shots, elementId, probeUs)
        const storylineOrigins = origin.storylineStarts
        const changed = moves.some((m) => {
          const prevStart = storylineOrigins?.get(m.elementId) ?? m.newStartUs
          return Math.abs(m.newStartUs - prevStart) >= 1000
        })
        dragOriginRef.current = null
        if (!changed) {
          applyMovesToDocument(
            Array.from(storylineOrigins?.entries() ?? []).map(([id, newStartUs]) => ({
              elementId: id,
              newStartUs,
            })),
          )
          endClipDragVisual()
          return
        }
        const landed = moves.find((m) => m.elementId === elementId)?.newStartUs ?? origin.startUs
        commitMovesSyncingCaptions(editor, moves)
        settleStorylineClip(elementId, origin.startUs, deltaPx, landed)
        return
      }

      dragOriginRef.current = null
      endClipDragVisual()
      pulseLayoutMotion()

      if (Math.abs(finalStart - origin.startUs) < 1000) {
        editor.updateDocument((prev) => ({
          ...prev,
          tracks: prev.tracks.map((track) => ({
            ...track,
            elements: track.elements.map((element) =>
              element.id === elementId ? { ...element, startUs: origin.startUs } : element,
            ),
          })),
        }))
        return
      }

      editor.updateDocument((prev) => ({
        ...prev,
        tracks: prev.tracks.map((track) => ({
          ...track,
          elements: track.elements.map((element) =>
            element.id === elementId ? { ...element, startUs: origin.startUs } : element,
          ),
        })),
      }))
      commitMovesSyncingCaptions(editor, [
        { elementId, newStartUs: Math.round(finalStart) },
      ])
    },
    [
      doc.tracks,
      zoom,
      snapLocal,
      getSnapReferences,
      editor,
      applyMovesToDocument,
      restoreStorylineFromRef,
      endClipDragVisual,
      pulseLayoutMotion,
      settleStorylineClip,
      applyStorylineReflowForTrack,
    ],
  )

  const handleTrimEnd = useCallback(
    (elementId: string, deltaPx: number, commit: boolean) => {
      handleTrim(elementId, 'end', deltaPx, commit)
    },
    [handleTrim],
  )

  const handleReorderTracks = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return
      const tracks = doc.tracks
      const fromTrack = tracks[fromIndex]
      const toTrack = tracks[toIndex]
      if (!fromTrack || !toTrack) return
      if (!canReorderTrackPair(fromTrack, toTrack)) return

      const ids = tracks.map((t) => t.id)
      const [removed] = ids.splice(fromIndex, 1)
      ids.splice(toIndex, 0, removed)
      try {
        editor.executeCommand(new ReorderTracksCommand(ids))
      } catch (err) {
        console.warn('轨道排序失败:', err)
      }
    },
    [doc.tracks, editor],
  )

  const startTrackReorderDrag = useCallback(
    (trackId: string, fromDocIndex: number, clientY: number, pointerId?: number) => {
      trackDragStartYRef.current = clientY
      trackDragPointerIdRef.current = pointerId ?? null
      setTrackDrag({
        trackId,
        fromDocIndex,
        dropDocIndex: fromDocIndex,
        deltaYPx: 0,
        dragging: true,
      })
    },
    [],
  )

  const trackDragRef = useRef(trackDrag)
  trackDragRef.current = trackDrag

  useEffect(() => {
    if (!trackDrag?.dragging) return
    const tracks = doc.tracks
    const onMove = (ev: PointerEvent) => {
      const deltaYPx = ev.clientY - trackDragStartYRef.current
      setTrackDrag((prev) => {
        if (!prev?.dragging) return prev
        const fromTrack = tracks[prev.fromDocIndex]
        if (!fromTrack) return prev

        const hitIndex = resolveTrackHeaderDocIndex(ev.clientY, prev.fromDocIndex)
        const deltaIndex = resolveTrackDropDocIndexFromDelta(
          prev.fromDocIndex,
          deltaYPx,
          trackHeightsPx,
        )
        const candidate = hitIndex ?? deltaIndex

        let dropDocIndex = prev.dropDocIndex
        const targetTrack = tracks[candidate]
        if (targetTrack && canReorderTrackPair(fromTrack, targetTrack)) {
          dropDocIndex = candidate
        }

        return {
          ...prev,
          dropDocIndex,
          deltaYPx,
        }
      })
    }
    const onUp = () => {
      const snapshot = trackDragRef.current
      setTrackDrag(null)
      pulseTrackLayoutMotion()
      if (
        snapshot?.dragging &&
        snapshot.fromDocIndex !== snapshot.dropDocIndex
      ) {
        handleReorderTracks(snapshot.fromDocIndex, snapshot.dropDocIndex)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [trackDrag?.dragging, doc.tracks, trackHeightsPx, handleReorderTracks, pulseTrackLayoutMotion])

  // 轨道状态切换
  const handleToggleMute = useCallback(
    (trackId: string) => {
      const track = doc.tracks.find((t) => t.id === trackId)
      if (track) {
        editor.executeCommand(
          new SetTrackPropertiesCommand(trackId, { muted: !track.muted })
        )
      }
    },
    [doc, editor]
  )

  const handleToggleHidden = useCallback(
    (trackId: string) => {
      const track = doc.tracks.find((t) => t.id === trackId)
      if (track) {
        editor.executeCommand(
          new SetTrackPropertiesCommand(trackId, { hidden: !track.hidden })
        )
      }
    },
    [doc, editor]
  )

  const handleToggleLock = useCallback(
    (trackId: string) => {
      const track = doc.tracks.find((t) => t.id === trackId)
      if (track) {
        editor.executeCommand(
          new SetTrackPropertiesCommand(trackId, { locked: !track.locked })
        )
      }
    },
    [doc, editor]
  )

  const handleSetDefaultInsertTrack = useCallback(
    (trackId: string) => {
      try {
        editor.executeCommand(new SetDefaultInsertTrackCommand(trackId))
      } catch (err) {
        console.warn('设置默认上轴轨道失败:', err)
      }
    },
    [editor],
  )

  // 键盘快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发剪辑快捷键
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      if (e.key === 'Escape') {
        e.preventDefault()
        editor.clearSelection()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        // 优先：若已有选中所在轨，选整轨；否则选全部字幕 clip；再否则全选可见片段
        const current = editor.getSelectedElementIds()
        if (current.length > 0) {
          const ctxTrack = doc.tracks.find((t) => t.elements.some((el) => el.id === current[0]))
          if (ctxTrack) {
            editor.setSelection(ctxTrack.elements.map((el) => el.id))
            return
          }
        }
        const captionIds = selectAllCaptionClipIds(doc)
        if (captionIds.length > 0) {
          editor.setSelection(captionIds)
          return
        }
        editor.setSelection(doc.tracks.flatMap((t) => (t.locked ? [] : t.elements.map((el) => el.id))))
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        if (selectedElementIds.length > 0) {
          try {
            editor.executeCommand(new DuplicateElementsCommand(selectedElementIds))
          } catch (err) {
            console.warn('复制失败:', err)
          }
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        handleDelete()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        handleSplit()
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          if (editor.canRedo()) editor.redo()
        } else {
          if (editor.canUndo()) editor.undo()
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (selectedElementIds.length > 0) {
          e.preventDefault()
          const stepUs = e.shiftKey ? 1_000_000 : 100_000 // Shift: 1s, 普通: 0.1s
          const delta = e.key === 'ArrowLeft' ? -stepUs : stepUs
          // 字幕多选：Shift+方向键批量平移 cue
          const allCaptions = selectedElementIds.every((id) => {
            const el = doc.tracks.flatMap((t) => t.elements).find((e) => e.id === id)
            return el ? isCaptionTextClip(el) : id.startsWith('caption-clip:')
          })
          if (allCaptions && e.shiftKey) {
            const cues = shiftCaptions(doc.captions || [], delta)
            editor.executeCommand(new UpdateCaptionsCommand(cues))
            return
          }
          const moves = computeNudgeMoves(selectedElementIds, delta, doc.tracks)
          if (moves.length > 0) {
            const resolved = moves.map((m) => {
              let newStartUs = m.newStartUs
              if (snapLocal) {
                const snapped = resolveSnapping(newStartUs, getSnapReferences([m.elementId]), zoom, 8)
                if (snapped.hasSnapped) newStartUs = snapped.snappedTimeUs
              }
              return { elementId: m.elementId, newStartUs }
            })
            commitMovesSyncingCaptions(editor, resolved)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDelete, handleSplit, editor, selectedElementIds, doc, snapLocal, getSnapReferences, zoom])

  const toolbar = (
    <TimelineToolbar
      playheadUs={playheadUs}
      durationUs={doc.durationUs}
      zoom={zoom}
      rippleEnabled={rippleEnabled}
      snapEnabled={snapLocal}
      canUndo={canUndo}
      canRedo={canRedo}
      hasSelection={selectedElementIds.length > 0}
      isCollapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onSplit={handleSplit}
      onDelete={handleDelete}
      canFlip={canFlipSelection}
      onFlip={handleFlip}
      onToggleRipple={() => setRippleEnabled((v) => !v)}
      onToggleSnap={() => setSnapLocal((v) => !v)}
      onUndo={() => editor.undo()}
      onRedo={() => editor.redo()}
      onZoomChange={setZoom}
      playback={playback}
      simplified={toolbarSimplified}
      toolbarExtras={toolbarExtras}
      statusHint={
        collapsed && variant === 'full'
          ? `已编排 ${visibleTracks.length} 轨道`
          : undefined
      }
    />
  )

  if (collapsed) {
    return (
      <div
        className={['ve-timeline-shell ve-timeline-shell--collapsed', className].filter(Boolean).join(' ')}
        data-testid="timeline-panel-collapsed"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: '0 0 auto',
          width: '100%',
          minHeight: 0,
          background: 'var(--card)',
          color: 'var(--foreground)',
          userSelect: 'none',
          overflow: 'hidden',
          borderTop: '1px solid var(--border)',
          ...style,
        }}
      >
        {toolbar}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="timeline-panel"
      data-variant={variant}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--card)',
        color: 'var(--foreground)',
        userSelect: 'none',
        overflow: 'hidden',
        borderTop: '1px solid var(--border)',
        ...style,
      }}
    >
      {toolbar}

      {/* 时间轴主体：包含左侧固定轨道头与右侧可滚动的刻度标尺及轨道内容 */}
      <div style={{ display: 'flex', flex: 1, overflow: trackDrag?.dragging ? 'visible' : 'hidden' }}>
        {/* 左侧轨道头部控制区 */}
        <div
          style={{
            position: 'relative',
            width: variant === 'compact' ? 140 : 160,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--card)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 与标尺对齐的轨道控制枢纽（高度与 TIMELINE_RULER_HEIGHT 像素对齐） */}
          <div
            style={{
              height: TIMELINE_RULER_HEIGHT,
              background: 'var(--card)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 6px',
              fontSize: 10,
              color: 'var(--foreground)',
              fontWeight: 600,
              boxSizing: 'border-box',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--foreground)' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: 'var(--primary)' }}>
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
              <span>{variant === 'compact' ? '精简轨道' : '轨道'}</span>
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  fontWeight: 500,
                  padding: '1px 4px',
                  borderRadius: 4,
                  background: 'var(--muted)',
                  lineHeight: 1,
                }}
              >
                {visibleTracks.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* 新增/管理轨道按钮 */}
              <button
                ref={trackAddButtonRef}
                type="button"
                onClick={() => setTrackActionMenuOpen((v) => !v)}
                title="添加轨道或清理空轨道"
                aria-label="添加轨道或清理空轨道"
                aria-expanded={trackActionMenuOpen}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  background: trackActionMenuOpen ? 'var(--primary)' : 'var(--muted)',
                  border: `1px solid ${trackActionMenuOpen ? 'var(--primary)' : 'var(--border)'}`,
                  color: trackActionMenuOpen ? '#fff' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* 密度切换（标准/紧凑） */}
              <button
                type="button"
                onClick={() => setDensity((d) => (d === 'standard' ? 'compact' : 'standard'))}
                title={density === 'standard' ? '切换紧凑轨道 (文字轨28px，大幅节约空间)' : '恢复标准轨道高度'}
                aria-label={density === 'standard' ? '切换紧凑轨道' : '恢复标准轨道'}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  background: density === 'compact' ? 'var(--primary)' : 'var(--muted)',
                  border: `1px solid ${density === 'compact' ? 'var(--primary)' : 'var(--border)'}`,
                  color: density === 'compact' ? '#fff' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* 新增/管理轨道轻量弹层 */}
          <TrackActionMenu
            isOpen={trackActionMenuOpen}
            anchorRef={trackAddButtonRef}
            onClose={() => setTrackActionMenuOpen(false)}
            onAddTrack={handleAddTrack}
            onCleanEmptyTracks={handleCleanEmptyTracks}
            emptyTrackCount={emptyTracks.length}
          />

          {/* 各轨道头部列表（使用受控双向联动纵向同步滚动） */}
          <div
            ref={leftHeadersScrollRef}
            style={{
              flex: 1,
              overflowY: trackDrag?.dragging ? 'visible' : 'hidden',
            }}
          >
            {visibleTracks.map((track) => {
              const docIndex = doc.tracks.findIndex((item) => item.id === track.id)
              const trackElementIds = track.elements.map((el) => el.id)
              const trackSelected =
                trackElementIds.length > 0 &&
                trackElementIds.every((id) => selectedElementIds.includes(id))
              return (
                <TimelineTrackHeader
                  key={track.id}
                  track={track}
                  height={getTrackHeight(track.type, density)}
                  trackIndex={docIndex >= 0 ? docIndex : undefined}
                  canReorder={!track.locked && docIndex >= 0}
                  reorderMotionStyle={docIndex >= 0 ? getTrackReorderMotionStyle(track.id, docIndex) : undefined}
                  onReorderDragStart={
                    docIndex >= 0 && !track.locked
                      ? (clientY, pointerId) =>
                          startTrackReorderDrag(track.id, docIndex, clientY, pointerId)
                      : undefined
                  }
                  canDelete={track.type !== 'shot' && !track.locked && track.elements.length === 0}
                  onDelete={() => handleDeleteTrack(track.id)}
                  onToggleMute={() => handleToggleMute(track.id)}
                  onToggleHidden={() => handleToggleHidden(track.id)}
                  onToggleLock={() => handleToggleLock(track.id)}
                  isDefaultInsertTrack={isDefaultInsertTrack(doc, track.id)}
                  onSetDefaultInsertTrack={() => handleSetDefaultInsertTrack(track.id)}
                  onSelectTrack={handleSelectTrack}
                  trackSelected={trackSelected}
                />
              )
            })}
          </div>
        </div>

        {/* 右侧主视口（标尺与轨道内容：统一垂直与水平滚动中心） */}
        <div
          ref={rightViewportScrollRef}
          onScroll={handleRightViewportScroll}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            background: 'var(--background)',
          }}
        >
          {/* 标尺与播放头 */}
          <TimelineRuler
            durationUs={doc.durationUs}
            playheadUs={playheadUs}
            zoom={zoom}
            contentWidthPx={timelineContentWidthPx}
            onSeek={(t) => onSeek?.(t)}
          />

          {/* 各轨道内容视口与贯穿播放线（z-index 高于标尺，选中片段外环不被裁切） */}
          <div
            className="ve-timeline-tracks-stack"
            style={{ position: 'relative', width: timelineContentWidthPx }}
            onPointerDown={(e) => {
              // 仅空白处（非 clip）开始框选
              const target = e.target as HTMLElement
              if (target.closest('.ve-timeline-clip') || target.closest('button')) return
              const stack = e.currentTarget
              const rect = stack.getBoundingClientRect()
              const next = {
                startX: e.clientX - rect.left + stack.scrollLeft,
                startY: e.clientY - rect.top,
                endX: e.clientX - rect.left + stack.scrollLeft,
                endY: e.clientY - rect.top,
                additive: e.shiftKey || e.ctrlKey || e.metaKey,
              }
              marqueeRef.current = next
              setMarquee(next)
              stack.setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              if (!marqueeRef.current) return
              const stack = e.currentTarget
              const rect = stack.getBoundingClientRect()
              const next = {
                ...marqueeRef.current,
                endX: e.clientX - rect.left + stack.scrollLeft,
                endY: e.clientY - rect.top,
              }
              marqueeRef.current = next
              setMarquee(next)
            }}
            onPointerUp={(e) => {
              const box = marqueeRef.current
              marqueeRef.current = null
              setMarquee(null)
              try {
                e.currentTarget.releasePointerCapture(e.pointerId)
              } catch {
                /* ignore */
              }
              if (!box) return
              const minX = Math.min(box.startX, box.endX)
              const maxX = Math.max(box.startX, box.endX)
              const minY = Math.min(box.startY, box.endY)
              const maxY = Math.max(box.startY, box.endY)
              if (maxX - minX < 4 && maxY - minY < 4) return
              const startUs = pixelsToTimeUs(minX, zoom)
              const endUs = pixelsToTimeUs(maxX, zoom)
              // 按 Y 粗略映射可见轨
              let yCursor = 0
              const hitTrackIds: string[] = []
              for (const track of visibleTracks) {
                const h = getTrackHeight(track.type, density)
                const top = yCursor
                const bottom = yCursor + h
                if (maxY >= top && minY <= bottom) hitTrackIds.push(track.id)
                yCursor = bottom
              }
              const ids = computeBoxSelection(
                {
                  startUs,
                  endUs,
                  trackIds: hitTrackIds.length > 0 ? hitTrackIds : undefined,
                },
                doc.tracks,
                editor.getSelectedElementIds(),
                box.additive,
              )
              editor.setSelection(ids)
            }}
          >
            {marquee ? (
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: Math.min(marquee.startX, marquee.endX),
                  top: Math.min(marquee.startY, marquee.endY),
                  width: Math.abs(marquee.endX - marquee.startX),
                  height: Math.abs(marquee.endY - marquee.startY),
                  border: '1px dashed var(--primary, #f06418)',
                  background: 'color-mix(in srgb, var(--primary, #f06418) 12%, transparent)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            <div
              style={{
                position: 'absolute',
                left: timeUsToPixels(playheadUs, zoom),
                top: 0,
                bottom: 0,
                width: 1,
                background: 'var(--primary, #f06418)',
                zIndex: 10,
                pointerEvents: 'none',
              }}
            />
            {snapGuideUs !== null ? (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: timeUsToPixels(snapGuideUs, zoom),
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: 'color-mix(in srgb, var(--primary, #f06418) 70%, white)',
                  boxShadow: '0 0 6px color-mix(in srgb, var(--primary, #f06418) 45%, transparent)',
                  zIndex: 11,
                  pointerEvents: 'none',
                }}
              />
            ) : null}
            {visibleTracks.map((track) => {
              const docIndex = doc.tracks.findIndex((item) => item.id === track.id)
              return (
              <TimelineTrackRow
                key={track.id}
                track={track}
                height={getTrackHeight(track.type, density)}
                reorderMotionStyle={docIndex >= 0 ? getTrackReorderMotionStyle(track.id, docIndex) : undefined}
                assets={doc.assets}
                zoom={zoom}
                durationUs={doc.durationUs}
                contentWidthPx={timelineContentWidthPx}
                selectedElementIds={selectedElementIds}
                onSelectElement={handleSelectElement}
                onEditElement={handleEditElement}
                onDuplicateElement={handleDuplicateElement}
                onClearSelection={handleClearSelection}
                onMoveElement={handleMoveElement}
                onTrimStart={handleTrimStart}
                onTrimEnd={handleTrimEnd}
                onDropPayload={handleDropPayload}
                highlightCrossTrack={crossTrackHighlightId === track.id}
                clipDrag={clipDrag}
                layoutAnimate={layoutMotionEnabled}
                storylineGhost={track.type === 'shot' ? storylineGhost : null}
              />
            )})}
          </div>
        </div>
      </div>
    </div>
  )
}
