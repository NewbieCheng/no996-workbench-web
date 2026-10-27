/** 离线导出调度控制器：不可变快照、真实逐帧素材与统一画幅缩放。 */
import type { EditorDocument } from '../project.ts'
import type { MediaEngineAdapter, VideoEncodingFormat } from '../../media/types.ts'
import { cloneDocument } from '../serialization.ts'
import { runExportPreflight, type PreflightReport } from './preflight.ts'
import { durationToTotalFrames, frameIndexToTimeUs } from '../time.ts'
import { mapPlaybackToSourceTimeUs } from '../speed/mapping.ts'
import { buildRenderPlan, sceneAtTime, type SceneSnapshot } from '../../render/plan.ts'
import { renderSceneToCanvas, type CanvasAssetSource } from '../../render/compositor.ts'
import { ensureCaptionFonts } from '../../render/captions.ts'
import { getShotFrameCache, resolveShotFrame } from '../../render/shot-cache.ts'
import { abortable, throwIfAborted } from '../../media/pcm.ts'
import { collectDocumentAudioClips, mixDocumentAudio } from '../../media/audio-mixer.ts'

/** 一参数旧调用兼容；视频返回的临时位图在当前合成帧结束后释放。 */
export type ExportAssetResolver = (
  assetId: string,
  sourceTimeUs?: number,
  signal?: AbortSignal,
) => Promise<CanvasAssetSource>

export type ExportArtifact = {
  id: string
  documentId: string
  revision: number
  renderSignature: string
  mimeType: string
  sizeBytes: number
  blob: Blob
  createdAt: number
}
export type ExportProgressCallback = (progress: number, stage: string) => void
type ExportResolutionPreset = '720p' | '1080p'

/** 短边档位，保留原工程画幅；编码尺寸取最近偶数，不改工程坐标或字号。 */
export function resolveExportDimensions(doc: EditorDocument, preset?: ExportResolutionPreset) {
  const { width, height } = doc.canvas
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('工程画布尺寸无效')
  if (!preset) return { width, height }
  const scale = (preset === '720p' ? 720 : 1080) / Math.min(width, height)
  return {
    width: Math.max(2, Math.round(width * scale / 2) * 2),
    height: Math.max(2, Math.round(height * scale / 2) * 2),
  }
}

export class ExportController {
  private abortController: AbortController | null = null
  private isExporting = false
  getIsExporting(): boolean { return this.isExporting }
  cancel(): void { this.abortController?.abort() }

  async exportDocument(
    editorDoc: EditorDocument,
    mediaAdapter: MediaEngineAdapter,
    assetResolver: ExportAssetResolver,
    assetChecker: (assetId: string) => Promise<boolean>,
    options: {
      format?: VideoEncodingFormat
      resolutionPreset?: ExportResolutionPreset
      onProgress?: ExportProgressCallback
      /** 存在可听媒体时必需，缺省仅允许真正静音的工程。 */
      audioBlobResolver?: (assetId: string) => Promise<Blob | null>
    } = {},
  ): Promise<{ artifact: ExportArtifact; preflight: PreflightReport }> {
    if (this.isExporting) throw new Error('已有导出任务正在进行中')
    this.isExporting = true
    this.abortController = new AbortController()
    const signal = this.abortController.signal
    let projectCanvas: HTMLCanvasElement | undefined
    let outputCanvas: HTMLCanvasElement | undefined
    try {
      const frozenDoc = cloneDocument(editorDoc)
      const dimensions = resolveExportDimensions(frozenDoc, options.resolutionPreset)
      const format = options.format ?? 'mp4'
      const renderSignature = `render-sig-${frozenDoc.id}-r${frozenDoc.revision}-${dimensions.width}x${dimensions.height}-${format}`
      const preflight = await abortable(runExportPreflight(frozenDoc, assetChecker, {
        ...dimensions, format, checkEncoding: true, signal,
      }), signal)
      throwIfAborted(signal)
      if (!preflight.valid) throw new Error(`导出预检未通过: ${preflight.issues.map((issue) => issue.message).join('; ')}`)
      if (typeof globalThis.document?.createElement !== 'function') throw new Error('视频导出需要真实浏览器 Canvas 环境')
      await abortable(ensureCaptionFonts(frozenDoc), signal)
      throwIfAborted(signal)

      const plan = buildRenderPlan(frozenDoc)
      const totalFrames = durationToTotalFrames(frozenDoc.durationUs, frozenDoc.canvas.fps)
      projectCanvas = globalThis.document.createElement('canvas')
      projectCanvas.width = frozenDoc.canvas.width
      projectCanvas.height = frozenDoc.canvas.height
      const projectCtx = projectCanvas.getContext('2d')
      outputCanvas = globalThis.document.createElement('canvas')
      outputCanvas.width = dimensions.width
      outputCanvas.height = dimensions.height
      const outputCtx = outputCanvas.getContext('2d')
      if (!projectCtx || !outputCtx) throw new Error('无法创建导出 Canvas 2D 上下文')
      const renderCanvas = projectCanvas
      const encodeCanvas = outputCanvas
      options.onProgress?.(0, '正在准备字体与媒体素材')

      // 图片在整个导出中仅取一张；视频必须按元素的源时间逐帧解码。
      const images = new Map<string, CanvasAssetSource>()
      for (const track of frozenDoc.tracks) {
        if (track.hidden) continue
        for (const element of track.elements) {
          if (element.type !== 'image' || images.has(element.assetId)) continue
          const source = await assetResolver(element.assetId, 0, signal)
          throwIfAborted(signal)
          if (!source) throw new Error(`图片素材无法读取：${element.assetId}`)
          images.set(element.assetId, source)
        }
      }

      let pcm: import('../../media/pcm.ts').PCM | undefined
      const hasAudibleClips = collectDocumentAudioClips(frozenDoc).length > 0
      if (hasAudibleClips && !options.audioBlobResolver) throw new Error('工程包含音频或视频原声，但未配置音频素材解析器')
      if (hasAudibleClips && options.audioBlobResolver) {
        options.onProgress?.(0, '正在混合音轨与视频原声')
        pcm = await mixDocumentAudio(frozenDoc, options.audioBlobResolver, { signal })
      }
      throwIfAborted(signal)

      const finalBlob = await mediaAdapter.encodeVideo({
        ...dimensions,
        frameRate: frozenDoc.canvas.fps,
        format, totalFrames, signal, onProgress: options.onProgress, pcm,
        renderFrame: async (frameIndex) => {
          throwIfAborted(signal)
          const timeUs = frameIndexToTimeUs(frameIndex, frozenDoc.canvas.fps)
          const scene = sceneAtTime(plan, timeUs)
          const sources = new Map<string, CanvasAssetSource>()
          const temporaryFrames: ImageBitmap[] = []
          try {
            for (const item of scene.items) {
              const element = item.element
              if (element.type === 'image') sources.set(element.id, images.get(element.assetId) ?? null)
              if (element.type !== 'video') continue
              const sourceTimeUs = mapPlaybackToSourceTimeUs(element, item.localTimeUs)
              const source = await assetResolver(element.assetId, sourceTimeUs, signal)
              if (source && typeof (source as ImageBitmap).close === 'function') temporaryFrames.push(source as ImageBitmap)
              throwIfAborted(signal)
              if (!source) throw new Error(`视频素材无法解码：${frozenDoc.assets[element.assetId]?.name || element.assetId}`)
              sources.set(element.id, source)
            }
            const shotFrames = await prepareShotFrames(scene, frozenDoc, timeUs, signal)
            throwIfAborted(signal)
            renderSceneToCanvas(projectCtx, scene, (elementId) => sources.get(elementId) ?? null,
              ({ elementId }) => shotFrames.get(elementId) ?? null)
            // 在完整工程画布上完成渲染后整体缩放，字幕、字号、描边、空间变换保持同一比例。
            outputCtx.fillStyle = frozenDoc.canvas.backgroundColor || '#000000'
            outputCtx.fillRect(0, 0, dimensions.width, dimensions.height)
            const scale = Math.min(dimensions.width / renderCanvas.width, dimensions.height / renderCanvas.height)
            const width = renderCanvas.width * scale
            const height = renderCanvas.height * scale
            outputCtx.drawImage(renderCanvas, (dimensions.width - width) / 2, (dimensions.height - height) / 2, width, height)
            return encodeCanvas
          } finally {
            for (const frame of new Set(temporaryFrames)) frame.close()
          }
        },
      })
      throwIfAborted(signal)
      if (!finalBlob.size) throw new Error('编码器未返回有效视频文件')
      return { preflight, artifact: {
        id: `artifact-${crypto.randomUUID()}`, documentId: frozenDoc.id,
        revision: frozenDoc.revision, renderSignature, mimeType: finalBlob.type,
        sizeBytes: finalBlob.size, blob: finalBlob, createdAt: Date.now(),
      } }
    } finally {
      if (projectCanvas) projectCanvas.width = projectCanvas.height = 0
      if (outputCanvas) outputCanvas.width = outputCanvas.height = 0
      this.isExporting = false
      this.abortController = null
    }
  }
}

async function prepareShotFrames(
  scene: SceneSnapshot,
  doc: EditorDocument,
  timeUs: number,
  signal: AbortSignal,
): Promise<Map<string, CanvasImageSource>> {
  const result = new Map<string, CanvasImageSource>()
  const cache = getShotFrameCache()
  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  await Promise.all(scene.items.filter((item) => item.element.type === 'shot').map(async (item) => {
    throwIfAborted(signal)
    const element = item.element
    if (element.type !== 'shot') return
    const frame = resolveShotFrame({ playheadUs: timeUs, startUs: element.startUs, rate: element.rate,
      fps, sourceDurationFrames: element.sourceDurationFrames })
    const canvas = await cache.getFullRes({ shotId: element.shotId, frame,
      presentation: element.presentation, instanceId: `${doc.id}:${element.id}`, sourceDurationFrames: element.sourceDurationFrames,
      width: doc.canvas.width, height: doc.canvas.height, fps,
      props: { ...element.slots, ...element.overrides } })
    throwIfAborted(signal)
    if (!canvas) throw new Error(`镜头素材渲染失败：${element.shotId}`)
    result.set(element.id, canvas)
  }))
  return result
}
