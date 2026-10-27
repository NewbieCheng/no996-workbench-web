/** 快速导出：挂载预览舞台 → 预览媒体池出帧 → recordComposition。 */
import { toCanvas } from 'html-to-image'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { EditorDocument } from '../../core/project.ts'
import { resolveExportDimensions } from '../../core/export/controller.ts'
import { recordComposition } from '../../core/export/composition-recorder.ts'
import { runExportPreflight } from '../../core/export/preflight.ts'
import { collectDocumentAudioClips, mixDocumentAudio } from '../../media/audio-mixer.ts'
import { abortable, throwIfAborted } from '../../media/pcm.ts'
import { ensureCaptionFonts } from '../../render/captions.ts'
import { PreviewMediaPool, type GetAssetBlobFn } from '../../core/export/preview-media-pool.ts'
import { PreviewCaptureStage } from './preview-capture-stage.tsx'

export type PreviewExportInput = {
  doc: EditorDocument
  resolutionPreset: '720p' | '1080p'
  getAssetBlob: GetAssetBlobFn
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
}

export async function runPreviewExport(input: PreviewExportInput): Promise<{ blob: Blob; fileName: string }> {
  const { doc, resolutionPreset, getAssetBlob, signal, onProgress } = input
  throwIfAborted(signal)
  const dimensions = resolveExportDimensions(doc, resolutionPreset)
  const preflight = await runExportPreflight(doc, async (assetId) => {
    const asset = doc.assets[assetId]
    return Boolean(asset?.blobId && (await getAssetBlob(asset.blobId))?.size)
  }, { ...dimensions, format: 'mp4', checkEncoding: true, signal })
  if (!preflight.valid) throw new Error(`导出预检未通过: ${preflight.issues.map((issue) => issue.message).join('; ')}`)

  onProgress?.(0.02, '正在准备预览合成舞台')
  await abortable(ensureCaptionFonts(doc), signal)

  const pool = new PreviewMediaPool()
  const host = document.createElement('div')
  host.setAttribute('data-export-capture-host', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-12000px',
    top: '0',
    width: `${dimensions.width}px`,
    height: `${dimensions.height}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '0',
  } as CSSStyleDeclaration)
  document.body.appendChild(host)

  const canvasRef = { current: null as HTMLCanvasElement | null }
  const stageRef = { current: null as HTMLDivElement | null }
  let playheadUs = 0
  let root: Root | null = null
  let ready = () => {}

  const waitReady = () => new Promise<void>((resolve) => { ready = resolve })
  const renderStage = () => {
    root?.render(createElement(PreviewCaptureStage, {
      doc,
      playheadUs,
      width: dimensions.width,
      height: dimensions.height,
      canvasRef,
      stageRef,
      resolve: (elementId) => pool.resolve(doc, elementId),
      onReady: () => ready(),
    }))
  }

  try {
    await pool.load(doc, getAssetBlob, signal)
    root = createRoot(host)
    const first = waitReady()
    renderStage()
    await abortable(first, signal)

    let pcm: Awaited<ReturnType<typeof mixDocumentAudio>> | undefined
    if (collectDocumentAudioClips(doc).length > 0) {
      onProgress?.(0.05, '正在混合音轨与视频原声')
      pcm = await mixDocumentAudio(doc, (assetId) => {
        const asset = doc.assets[assetId]
        return asset?.blobId ? getAssetBlob(asset.blobId) : Promise.resolve(null)
      }, { signal })
    }

    const fps = doc.canvas.fps.num / doc.canvas.fps.den
    const capture = document.createElement('canvas')
    capture.width = dimensions.width
    capture.height = dimensions.height
    const captureCtx = capture.getContext('2d')
    if (!captureCtx) throw new Error('无法创建导出画布')

    let lastShot: HTMLCanvasElement | undefined
    let shotBusy = false
    const snapshotShots = () => {
      const layer = stageRef.current?.querySelector('[data-export-shot-layer]')
      if (!(layer instanceof HTMLElement) || !layer.querySelector('[data-live-shot]') || shotBusy) return
      shotBusy = true
      void toCanvas(layer, {
        skipFonts: true,
        cacheBust: false,
        pixelRatio: 1,
        width: capture.width,
        height: capture.height,
      }).then((canvas) => { lastShot = canvas }).catch(() => {}).finally(() => { shotBusy = false })
    }
    snapshotShots()
    if (doc.tracks.some((track) => track.elements.some((el) => el.type === 'shot'))) {
      await new Promise((resolve) => window.setTimeout(resolve, 80))
    }

    const { blob } = await recordComposition({
      canvas: capture,
      durationMs: doc.durationUs / 1000,
      fps,
      pcm,
      signal,
      onProgress,
      onPaint: async (timeUs) => {
        playheadUs = timeUs
        const painted = waitReady()
        renderStage()
        await pool.seekScene(doc, timeUs, signal)
        await painted
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        const media = canvasRef.current
        captureCtx.fillStyle = doc.canvas.backgroundColor || '#000000'
        captureCtx.fillRect(0, 0, capture.width, capture.height)
        snapshotShots()
        if (lastShot) captureCtx.drawImage(lastShot, 0, 0, capture.width, capture.height)
        else blitRasterChildren(stageRef.current?.querySelector('[data-export-shot-layer]'), stageRef.current, captureCtx, capture.width, capture.height)
        if (media) captureCtx.drawImage(media, 0, 0, capture.width, capture.height)
      },
    })

    const safeName = (doc.name || 'video').replace(/[<>:"/\\|?*]/g, '_')
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4'
    return { blob, fileName: `${safeName}.${ext}` }
  } finally {
    root?.unmount()
    host.remove()
    pool.dispose()
  }
}

function blitRasterChildren(
  layer: Element | null | undefined,
  stage: HTMLElement | null,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  if (!(layer instanceof HTMLElement) || !stage) return
  const stageBox = stage.getBoundingClientRect()
  if (!stageBox.width || !stageBox.height) return
  const scaleX = width / stageBox.width
  const scaleY = height / stageBox.height
  for (const node of Array.from(layer.querySelectorAll('canvas, img, video'))) {
    if (!(node instanceof HTMLCanvasElement || node instanceof HTMLVideoElement || node instanceof HTMLImageElement)) continue
    const box = node.getBoundingClientRect()
    try {
      ctx.drawImage(
        node,
        (box.left - stageBox.left) * scaleX,
        (box.top - stageBox.top) * scaleY,
        box.width * scaleX,
        box.height * scaleY,
      )
    } catch { /* 跨域或未就绪则跳过 */ }
  }
}
