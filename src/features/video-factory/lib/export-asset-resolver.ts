import type { EditorDocument, EditorInstance } from '@no996/video-editor'
import type { ExportAssetResolver } from '@no996/video-editor/core/export/controller.ts'
import { MediabunnyMediaAdapter } from '@no996/video-editor/media/mediabunny-adapter.ts'
import { abortable, throwIfAborted } from '@no996/video-editor/media/pcm.ts'

export type GetAssetBlobFn = (blobId: string) => Promise<Blob | null>
export type DisposableExportAssetResolver = ExportAssetResolver & { dispose(): void }

/** 旧的一参数调用仍可用；视频时间以源素材微秒传入，视频位图由调用方 close。 */
export function createAssetResolverFromDocument(
  doc: EditorDocument,
  getAssetBlob: GetAssetBlobFn,
): DisposableExportAssetResolver {
  const adapter = new MediabunnyMediaAdapter()
  const blobs = new Map<string, Promise<Blob>>()
  const images = new Map<string, Promise<ImageBitmap>>()
  let disposed = false
  const resolve: ExportAssetResolver = async (assetId, sourceTimeUs = 0, signal) => {
    throwIfAborted(signal)
    if (disposed) throw new Error('导出素材解析器已释放')
    const asset = doc.assets[assetId]
    if (!asset?.blobId) throw new Error(`缺少本机媒体素材：${asset?.name || assetId}`)
    let pendingBlob = blobs.get(assetId)
    if (!pendingBlob) {
      pendingBlob = getAssetBlob(asset.blobId).then((blob) => {
        if (!blob?.size) throw new Error(`媒体文件缺失或为空：${asset.name || assetId}`)
        return blob
      })
      blobs.set(assetId, pendingBlob)
    }
    const blob = await abortable(pendingBlob, signal)
    throwIfAborted(signal)
    if (disposed) throw new Error('导出素材解析器已释放')
    if (asset.kind === 'video') return adapter.decodeFrame(blob, sourceTimeUs, signal)
    if (asset.kind !== 'image') throw new Error(`素材不是可绘制媒体：${asset.name || assetId}`)
    let image = images.get(assetId)
    if (!image) {
      image = createImageBitmap(blob).then((bitmap) => {
        if (disposed) { bitmap.close(); throw new Error('导出素材解析器已释放') }
        return bitmap
      })
      images.set(assetId, image)
    }
    return abortable(image, signal)
  }
  return Object.assign(resolve, {
    dispose() {
      if (disposed) return
      disposed = true
      adapter.dispose()
      for (const image of images.values()) void image.then((bitmap) => bitmap.close(), () => {})
      images.clear()
      blobs.clear()
    },
  })
}

export function createAssetResolver(
  editor: EditorInstance,
  getAssetBlob: GetAssetBlobFn,
): DisposableExportAssetResolver {
  return createAssetResolverFromDocument(editor.getDocument(), getAssetBlob)
}

export function createAudioBlobResolverFromDocument(
  doc: EditorDocument,
  getAssetBlob: GetAssetBlobFn,
): (assetId: string) => Promise<Blob | null> {
  return async (assetId) => {
    const asset = doc.assets[assetId]
    if (!asset?.blobId) return null
    return getAssetBlob(asset.blobId)
  }
}

export function createAudioBlobResolver(
  editor: EditorInstance,
  getAssetBlob: GetAssetBlobFn,
): (assetId: string) => Promise<Blob | null> {
  return createAudioBlobResolverFromDocument(editor.getDocument(), getAssetBlob)
}
