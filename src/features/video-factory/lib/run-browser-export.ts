import type { EditorDocument } from '@no996/video-editor'
import { ExportController } from '@no996/video-editor/core/export/controller.ts'
import { MediabunnyMediaAdapter } from '@no996/video-editor/media/mediabunny-adapter.ts'
import { abortable, throwIfAborted } from '@no996/video-editor/media/pcm.ts'
import { runPreviewExport } from '@no996/video-editor/panels/export/run-preview-export.ts'
import { captionFontByFamily, loadCaptionFont } from '../../ip-video/editor/caption-fonts'
import {
  createAssetResolverFromDocument,
  createAudioBlobResolverFromDocument,
  type GetAssetBlobFn,
} from './export-asset-resolver.ts'
import { isDocumentHidden, waitForDocumentVisible } from './export-visibility.ts'

export type ExportResolutionPreset = '1080p' | '720p'
export type BrowserExportComposition = 'preview' | 'offline'

export type RunBrowserExportInput = {
  doc: EditorDocument
  resolutionPreset: ExportResolutionPreset
  getAssetBlob: GetAssetBlobFn
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  /** 标签页隐藏时回调（用于任务 meta 提示） */
  onPausedForVisibility?: () => void
  /** preview：预览直录（默认）；offline：逐帧精确导出 */
  composition?: BrowserExportComposition
}

export type RunBrowserExportResult = {
  blob: Blob
  fileName: string
}

export async function runBrowserExport(input: RunBrowserExportInput): Promise<RunBrowserExportResult> {
  const { doc, resolutionPreset, getAssetBlob, signal, onProgress, onPausedForVisibility, composition = 'preview' } = input
  throwIfAborted(signal)
  // 同一导出复用 Blob，视频解码和原声混音不重复读取本机仓储。
  const blobCache = new Map<string, Promise<Blob | null>>()
  const cachedGetBlob: GetAssetBlobFn = (id) => {
    let pending = blobCache.get(id)
    if (!pending) { pending = getAssetBlob(id); blobCache.set(id, pending) }
    return pending
  }
  const assetResolver = createAssetResolverFromDocument(doc, cachedGetBlob)
  const audioBlobResolver = createAudioBlobResolverFromDocument(doc, cachedGetBlob)
  const assetChecker = async (assetId: string) => {
    const asset = doc.assets[assetId]
    return Boolean(asset?.blobId && (await cachedGetBlob(asset.blobId))?.size)
  }

  const adapter = new MediabunnyMediaAdapter()
  const controller = new ExportController()

  const abortExport = () => controller.cancel()
  signal?.addEventListener('abort', abortExport)

  let lastProgressWrite = 0
  const throttledProgress = (p: number, stage: string) => {
    if (isDocumentHidden()) {
      onPausedForVisibility?.()
      void waitForDocumentVisible(signal).then(() => {
        if (!signal?.aborted) onProgress?.(p, stage)
      }, () => { /* 取消由导出主流程上报，不产生游离的 rejection。 */ })
      return
    }
    const now = Date.now()
    if (now - lastProgressWrite < 400 && p < 1) return
    lastProgressWrite = now
    onProgress?.(p, stage)
  }

  try {
    while (isDocumentHidden()) {
      onPausedForVisibility?.()
      await waitForDocumentVisible(signal)
    }

    throwIfAborted(signal)
    // 后台任务可在重新打开标签页后恢复，不能依赖编辑页面注册过字体 CSS。
    const families = new Set(doc.captions
      .filter(cue => (cue.styleOverride?.burn ?? doc.captionStyle.burn) && cue.text.trim())
      .map(cue => cue.styleOverride?.font ?? doc.captionStyle.font))
    await abortable(Promise.all([...families].map(family => {
      const font = captionFontByFamily(family)
      return font ? loadCaptionFont(font.id) : Promise.resolve()
    })), signal)
    throwIfAborted(signal)
    if (composition === 'preview') {
      return await runPreviewExport({
        doc,
        resolutionPreset,
        getAssetBlob: cachedGetBlob,
        signal,
        onProgress: (p, stage) => throttledProgress(p, stage),
      })
    }
    const { artifact } = await controller.exportDocument(
      doc,
      adapter,
      assetResolver,
      assetChecker,
      {
        format: 'mp4',
        resolutionPreset,
        audioBlobResolver,
        onProgress: (p, stage) => throttledProgress(p, stage),
      },
    )

    const safeName = (doc.name || 'video').replace(/[<>:"/\\|?*]/g, '_')
    return { blob: artifact.blob, fileName: `${safeName}.mp4` }
  } finally {
    signal?.removeEventListener('abort', abortExport)
    assetResolver.dispose()
    blobCache.clear()
    adapter.dispose()
  }
}
