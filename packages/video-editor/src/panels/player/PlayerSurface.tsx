/**
 * 中央监视器/播放器舞台组件 (PlayerSurface)
 * 基于 Canvas 2D 与统一 RenderPlan，实时合成预览画面并与播放时钟同步
 */

import React, { useRef, useEffect, useState } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { CanvasRatio, ShotClipElement } from '../../core/project.ts'
import { buildRenderPlan, sceneAtTime, type RenderPlan } from '../../render/plan.ts'
import { renderSceneToCanvas, type CanvasAssetSource } from '../../render/compositor.ts'
import { canvasRatioLabel } from '../../core/canvas-ratio.ts'
import { CanvasRatioControl } from './CanvasRatioControl.tsx'
import { formatTimeCode } from '../../core/time.ts'
import { LiveShotLayer } from './LiveShotLayer.tsx'
import { LayeredPlayer } from './layered-player.tsx'
import { StageInteractiveOverlay } from './StageInteractiveOverlay.tsx'
import { PerformanceHealthPopover } from '../shared/PerformanceHealthPopover.tsx'
import './player-surface.css'

export type PlayerSurfaceProps = {
  editor: EditorInstance
  playheadUs: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSeek: (timeUs: number) => void
  assetSourceResolver?: (elementId: string) => CanvasAssetSource
  style?: React.CSSProperties
  className?: string
  /** 循环播放（视频工厂用；IP 页不传，行为不变） */
  loop?: boolean
  onToggleLoop?: () => void
  /** 在走带区右侧显示画幅与帧率 */
  showMeta?: boolean
  /** 帧步进按钮（视频工厂用） */
  frameStep?: boolean
  /** 单监视器区域：去掉外框套内框，画幅贴满视口 */
  compactViewport?: boolean
  /** 外层已算好舞台像素尺寸时，监视器不再二次 letterbox */
  stageSize?: { width: number; height: number }
  /** 点击角标切换画幅（视频工厂） */
  onRatioChange?: (ratio: CanvasRatio) => void
  /** 走带区由时间轴承接时隐藏（视频工厂） */
  hideTransport?: boolean
  /** 画幅控件移到时间轴顶栏时，监视器内不再叠角标 */
  hideRatioControl?: boolean
  /** Simplified hosts supply their own object controls without loading factory actions. */
  interactionOverlay?: React.ReactNode
  simple?: boolean
  /** IP preview: interleave live shots with consecutive canvas items in RenderPlan order. */
  layeredShots?: boolean
}

export function PlayerSurface({
  editor,
  playheadUs,
  isPlaying,
  onTogglePlay,
  onSeek,
  assetSourceResolver,
  style,
  className,
  loop = false,
  onToggleLoop,
  showMeta = false,
  frameStep = false,
  compactViewport = false,
  stageSize,
  onRatioChange,
  hideTransport = false,
  hideRatioControl = false,
  interactionOverlay,
  simple = false,
  layeredShots = false,
}: PlayerSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())
  /** 舞台可用尺寸：用来把画布按工程比例装进监视器，而不是拉满整个舞台 */
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 })
  const [frameReady, setFrameReady] = useState(false)
  const [draftMode, setDraftMode] = useState(false)
  /** 渲染计划按文档 revision 缓存，播放时不再每帧重建 */
  const planRef = useRef<{ revision: number; plan: RenderPlan } | null>(null)

  const getPlan = React.useCallback((doc: ReturnType<EditorInstance['getDocument']>): RenderPlan => {
    if (planRef.current?.revision !== doc.revision || planRef.current?.plan.documentId !== doc.id) {
      planRef.current = { revision: doc.revision, plan: buildRenderPlan(doc) }
    }
    return planRef.current.plan
  }, [])

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  // 监视器尺寸随容器变化：用于等比缩放画布（固定 stageSize 时由外层传入）
  useEffect(() => {
    if (stageSize) return
    const el = stageRef.current
    if (!el) return
    const update = () => setStageBox({ width: el.clientWidth, height: el.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [stageSize])

  /**
   * 合成当前时刻的图文 / 字幕层。
   *
   * 有镜头时画布保持透明、只画非镜头元素，镜头由 `LiveShotLayer` 实时挂载；
   * 没有镜头时仍走整帧 canvas。导出继续用光栅化管线，和这里的实时预览互不影响。
   */
  const drawScene = React.useCallback(
    async (targetUs: number) => {
      if (layeredShots) return // LayeredPlayer commits its slices and live shots together.
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const currentDoc = editor.getDocument()
      const plan = getPlan(currentDoc)
      const scene = sceneAtTime(plan, targetUs)

      /**
       * 有镜头元素时：镜头交给 LiveShotLayer 实时挂载，画布只画图文 / 字幕，
       * 背景由舞台底层负责。这样播放时不需要 html-to-image 逐帧光栅化。
       */
      const hasShots = scene.items.some((item) => item.element.type === 'shot')
      const canvasScene = hasShots
        ? {
            ...scene,
            backgroundColor: 'transparent',
            items: scene.items.filter((item) => item.element.type !== 'shot'),
          }
        : scene

      renderSceneToCanvas(
        ctx,
        canvasScene,
        (elemId) => (assetSourceResolver ? assetSourceResolver(elemId) : null),
      )
      if (!hasShots) setFrameReady(true)
    },
    [editor, assetSourceResolver, getPlan, layeredShots],
  )

  // 画面合成与重绘（静态与暂停时）
  useEffect(() => {
    if (isPlaying) return
    void drawScene(playheadUs)
  }, [doc, playheadUs, isPlaying, drawScene])

  // 播放中的连续重绘
  useEffect(() => {
    if (!isPlaying || layeredShots) return
    let cancelled = false
    let running = false
    let lastDrawnUs = -1

    const tick = async () => {
      if (cancelled) return
      if (!running) {
        const currentUs = editor.getPlayheadUs()
        // 播放头按 30Hz 推进，rAF 是 60Hz：同一时刻不重复合成
        if (currentUs === lastDrawnUs) {
          requestAnimationFrame(tick)
          return
        }
        running = true
        lastDrawnUs = currentUs
        await drawScene(currentUs)
        running = false
      }
      if (!cancelled) requestAnimationFrame(tick)
    }

    const id = requestAnimationFrame(tick)
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [isPlaying, editor, drawScene, layeredShots])

  // 空格键触发播放/暂停
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase()
      if (activeTag === 'input' || activeTag === 'textarea') return

      if (e.code === 'Space') {
        e.preventDefault()
        onTogglePlay()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onTogglePlay])

  const { width, height } = doc.canvas
  const ratio = width / height
  const pad = compactViewport ? 0 : 8
  const ratioLabel = canvasRatioLabel(doc.canvas)
  const frameFps = doc.canvas.fps.num / doc.canvas.fps.den
  const frameStepUs = Math.round(1_000_000 / frameFps)
  const canPlay = doc.durationUs > 0
  const fixedStage = stageSize && stageSize.width > 0 && stageSize.height > 0
  const availW = fixedStage ? stageSize.width : Math.max(1, stageBox.width - pad * 2)
  const availH = fixedStage ? stageSize.height : Math.max(1, stageBox.height - pad * 2)
  const fittedW = fixedStage ? stageSize.width : Math.min(availW, availH * ratio)
  const fittedH = fixedStage ? stageSize.height : fittedW / ratio
  const fitStyle: React.CSSProperties = fixedStage
    ? { width: '100%', height: '100%' }
    : stageBox.width > 0
      ? { width: Math.max(1, Math.floor(fittedW)), height: Math.max(1, Math.floor(fittedH)) }
      : { width: '100%', height: '100%' }
  const stageStyle: React.CSSProperties = fixedStage
    ? { width: stageSize.width, height: stageSize.height, padding: 0 }
    : { padding: pad }

  // 切换工程时重新等待首帧
  useEffect(() => {
    setFrameReady(false)
  }, [doc.id])

  // 当前时刻的镜头交给实时层；画布只保留图文 / 字幕
  const liveScene = sceneAtTime(getPlan(doc), playheadUs)
  const liveShotElements = liveScene.items
    .filter((item) => item.element.type === 'shot')
    .map((item) => item.element as ShotClipElement)
  const handleLiveShotReady = React.useCallback(() => setFrameReady(true), [])

  const rootClass = [
    className,
    've-player',
    compactViewport ? 've-player--compact' : '',
    fixedStage ? 've-player--fixed-stage' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} data-testid="player-surface" style={style}>
      <div ref={stageRef} className="ve-player-stage" style={stageStyle}>
        <div
          className="ve-player-frame"
          onClick={(e) => {
            // 暂停编辑时点击落在舞台蒙层（选中/清选）不得切播放
            if ((e.target as HTMLElement).closest('.ve-stage-overlay')) return
            if (canPlay) onTogglePlay()
          }}
          style={{
            maxWidth: fixedStage ? undefined : '100%',
            maxHeight: fixedStage ? undefined : '100%',
            ...fitStyle,
            cursor: canPlay ? 'pointer' : 'default',
          }}
        >
          {compactViewport && !hideRatioControl && onRatioChange ? (
            <CanvasRatioControl value={doc.canvas.ratio} onChange={onRatioChange} placement="stage" />
          ) : null}
          {compactViewport && !hideRatioControl && !onRatioChange ? (
            <div className="ve-player-ratio-anchor">
              <span className="ve-player-ratio-badge" aria-hidden>
                {ratioLabel}
              </span>
            </div>
          ) : null}

          {/* 监视器右上角性能健康指示器 */}
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {!simple && <PerformanceHealthPopover
              doc={doc}
              draftMode={draftMode}
              onToggleDraftMode={setDraftMode}
            />}
          </div>

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: liveScene.backgroundColor || '#000000',
              zIndex: 0,
            }}
          />
          {layeredShots ? <LayeredPlayer
            key={doc.id}
            doc={doc}
            scene={liveScene}
            displayWidth={fittedW > 0 ? Math.floor(fittedW) : doc.canvas.width}
            draftMode={draftMode}
            resolve={assetSourceResolver}
            onReady={handleLiveShotReady}
          /> : <>
          <LiveShotLayer
            doc={doc}
            elements={liveShotElements}
            playheadUs={playheadUs}
            displayWidth={fittedW > 0 ? Math.floor(fittedW) : doc.canvas.width}
            draftMode={draftMode}
            onReady={handleLiveShotReady}
          />
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{
              position: 'relative',
              zIndex: 2,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
            }}
          />
          </>}

          {/* 舞台顶层所见即所得交互蒙层与原位快捷编辑器 */}
          {interactionOverlay ?? <StageInteractiveOverlay
            doc={doc}
            editor={editor}
            playheadUs={playheadUs}
            isPlaying={isPlaying}
            selectedIds={selectedIds}
            displayWidth={fittedW > 0 ? Math.floor(fittedW) : doc.canvas.width}
            displayHeight={fittedH > 0 ? Math.floor(fittedH) : doc.canvas.height}
          />}

          {/* 选区变换高亮框指示层 */}
          {doc.tracks
            .flatMap((t) => t.elements)
            .filter((e) => selectedIds.includes(e.id) && 'transform' in e && (e as any).transform)
            .map((elem: any) => {
              const t = elem.transform
              if (!t) return null
              const leftPct = (t.x / width) * 100
              const topPct = (t.y / height) * 100
              const widthPct = (t.width / width) * 100
              const heightPct = (t.height / height) * 100

              const rotate = t.rotationDeg ? `rotate(${t.rotationDeg}deg)` : undefined
              return (
                <div
                  key={elem.id}
                  className="ve-player-selection"
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                    transform: rotate,
                    transformOrigin: 'center center',
                  }}
                >
                  <span className="ve-player-selection__handle ve-player-selection__handle--tl" />
                  <span className="ve-player-selection__handle ve-player-selection__handle--tr" />
                  <span className="ve-player-selection__handle ve-player-selection__handle--bl" />
                  <span className="ve-player-selection__handle ve-player-selection__handle--br" />
                </div>
              )
            })}

          {/* 当工程无视觉素材时，展示温和的舞台指引，防止纯黑视觉困惑 */}
          {doc.tracks.every((t) => t.elements.length === 0) && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: '#a1a1aa',
                pointerEvents: 'none',
                background: 'rgba(24, 24, 27, 0.7)',
                backdropFilter: 'blur(2px)',
                userSelect: 'none',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.12)',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11" />
                  <rect x="2" y="6" width="14" height="12" rx="2" />
                </svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{ratioLabel} 视频编排舞台</span>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>从左侧镜头库拖入镜头，或添加图文开始创作</span>
            </div>
          )}

          {/* 首帧尚未光栅化完成：给一个轻提示，避免纯黑被当成播放故障 */}
          {!frameReady && doc.tracks.some((t) => t.elements.length > 0) ? (
            <div
              aria-live="polite"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 12,
                transform: 'translateX(-50%)',
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(9, 10, 15, 0.72)',
                color: '#d4d4d8',
                fontSize: 11,
                lineHeight: 1.4,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              正在渲染预览…
            </div>
          ) : null}
        </div>
      </div>

      {hideTransport ? null : (
      <div className="ve-player-transport">
        <div className="ve-player-transport__left">
          <button
            type="button"
            className="ve-player-btn ve-player-btn--primary"
            disabled={!canPlay}
            onClick={onTogglePlay}
            title={!canPlay ? '工程暂无素材或时长为0' : isPlaying ? '暂停 (Space)' : '播放 (Space)'}
            aria-label={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="m7 4 13 8-13 8V4z" />
              </svg>
            )}
          </button>
          <button
            type="button"
            className="ve-player-btn"
            onClick={() => onSeek(Math.max(0, playheadUs - 1_000_000))}
            title="后退 1 秒"
            aria-label="后退 1 秒"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m11 17-5-5 5-5m7 10-5-5 5-5" />
            </svg>
          </button>
          <button
            type="button"
            className="ve-player-btn"
            onClick={() => onSeek(Math.min(doc.durationUs, playheadUs + 1_000_000))}
            title="前进 1 秒"
            aria-label="前进 1 秒"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
              <path d="m13 17 5-5-5-5M6 17l5-5-5-5" />
            </svg>
          </button>
        </div>

        <div className="ve-player-transport__right">
          {frameStep && (
            <>
              <button
                type="button"
                className="ve-player-btn ve-player-btn--ghost"
                onClick={() => onSeek(Math.max(0, playheadUs - frameStepUs))}
                title="上一帧"
              >
                ◀|
              </button>
              <button
                type="button"
                className="ve-player-btn ve-player-btn--ghost"
                onClick={() => onSeek(Math.min(doc.durationUs, playheadUs + frameStepUs))}
                title="下一帧"
              >
                |▶
              </button>
            </>
          )}
          {onToggleLoop && (
            <label className="ve-player-loop">
              <input type="checkbox" checked={loop} onChange={() => onToggleLoop()} />
              循环
            </label>
          )}
          {showMeta && (
            <span className="ve-player-meta">
              {doc.canvas.width}×{doc.canvas.height} · {doc.canvas.fps.num}fps
            </span>
          )}
          <span className="ve-player-timecode">
            <span className="ve-player-timecode__current">{formatTimeCode(playheadUs)}</span>
            <span> / {formatTimeCode(doc.durationUs)}</span>
          </span>
        </div>
      </div>
      )}
    </div>
  )
}
