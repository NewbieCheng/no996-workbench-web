/**
 * 快速导出舞台：与监视器同一套分层（LiveShot CSS + Canvas 图文/字幕）。
 * 不走 ShotFrameCache / html-to-image 光栅化管线。
 */
import React, { useEffect, useMemo } from 'react'
import type { EditorDocument, ShotClipElement } from '../../core/project.ts'
import { buildRenderPlan, sceneAtTime } from '../../render/plan.ts'
import { renderSceneToCanvas, type CanvasAssetSource } from '../../render/compositor.ts'
import { LiveShotLayer } from '../player/LiveShotLayer.tsx'

export type PreviewCaptureStageProps = {
  doc: EditorDocument
  playheadUs: number
  width: number
  height: number
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  stageRef: React.RefObject<HTMLDivElement | null>
  resolve: (elementId: string) => CanvasAssetSource
  onReady: () => void
}

export function PreviewCaptureStage({
  doc,
  playheadUs,
  width,
  height,
  canvasRef,
  stageRef,
  resolve,
  onReady,
}: PreviewCaptureStageProps) {
  const plan = useMemo(() => buildRenderPlan(doc), [doc])
  const scene = sceneAtTime(plan, playheadUs)
  const liveShots = scene.items
    .filter((item) => item.element.type === 'shot')
    .map((item) => item.element as ShotClipElement)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    const canvasScene = liveShots.length
      ? { ...scene, backgroundColor: 'transparent', items: scene.items.filter((item) => item.element.type !== 'shot') }
      : scene
    renderSceneToCanvas(ctx, canvasScene, resolve)
  }, [canvasRef, liveShots.length, resolve, scene])

  useEffect(() => {
    const frame = requestAnimationFrame(() => onReady())
    return () => cancelAnimationFrame(frame)
  }, [onReady, playheadUs])

  return (
    <div
      ref={stageRef}
      data-export-capture-stage
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        background: scene.backgroundColor || '#000',
        pointerEvents: 'none',
      }}
    >
      <div
        data-export-shot-layer
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      >
        <LiveShotLayer
          doc={doc}
          elements={liveShots}
          playheadUs={playheadUs}
          displayWidth={width}
          evaluateTransforms
          onReady={onReady}
        />
      </div>
      <canvas
        ref={canvasRef}
        width={doc.canvas.width}
        height={doc.canvas.height}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  )
}
