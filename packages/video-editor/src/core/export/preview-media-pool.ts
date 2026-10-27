/** 预览直录用的本机图/视频池：HTMLVideoElement 出帧，避免逐帧 WebCodecs 解码。 */
import type { EditorDocument, VideoClipElement } from '../project.ts'
import { mapPlaybackToSourceTimeUs } from '../speed/mapping.ts'
import { throwIfAborted } from '../../media/pcm.ts'

export type GetAssetBlobFn = (blobId: string) => Promise<Blob | null>

export class PreviewMediaPool {
  private images = new Map<string, ImageBitmap>()
  private videos = new Map<string, HTMLVideoElement>()
  private blobs = new Map<string, Blob>()
  private disposed = false

  async load(doc: EditorDocument, getAssetBlob: GetAssetBlobFn, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    const jobs: Promise<void>[] = []
    for (const [id, asset] of Object.entries(doc.assets)) {
      if (!asset.blobId || asset.kind === 'audio') continue
      jobs.push(this.loadAsset(id, asset.blobId, asset.kind, asset.name, getAssetBlob, signal))
    }
    await Promise.all(jobs)
  }

  resolve(doc: EditorDocument, elementId: string): CanvasImageSource | null {
    const element = doc.tracks.flatMap((track) => track.elements).find((item) => item.id === elementId)
    if (!element || !('assetId' in element)) return null
    const video = this.videos.get(element.assetId)
    if (video && video.readyState >= 2) return video
    return this.images.get(element.assetId) ?? null
  }

  async seekScene(doc: EditorDocument, timeUs: number, signal?: AbortSignal): Promise<void> {
    throwIfAborted(signal)
    const seeks: Promise<void>[] = []
    for (const track of doc.tracks) {
      if (track.hidden) continue
      for (const element of track.elements) {
        if (element.type !== 'video') continue
        if (timeUs < element.startUs || timeUs >= element.startUs + element.durationUs) continue
        const video = this.videos.get(element.assetId)
        if (!video) continue
        const localTimeUs = timeUs - element.startUs
        const sourceUs = mapPlaybackToSourceTimeUs(element as VideoClipElement, localTimeUs)
        seeks.push(seekVideo(video, sourceUs / 1_000_000, signal))
      }
    }
    await Promise.all(seeks)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const image of this.images.values()) image.close()
    this.images.clear()
    for (const video of this.videos.values()) {
      video.pause()
      video.onseeked = null
      video.onerror = null
      URL.revokeObjectURL(video.src)
      video.removeAttribute('src')
      video.load()
    }
    this.videos.clear()
    this.blobs.clear()
  }

  private async loadAsset(
    assetId: string,
    blobId: string,
    kind: string,
    name: string,
    getAssetBlob: GetAssetBlobFn,
    signal?: AbortSignal,
  ): Promise<void> {
    throwIfAborted(signal)
    const blob = this.blobs.get(assetId) ?? await getAssetBlob(blobId)
    if (!blob?.size) throw new Error(`媒体文件缺失或为空：${name || assetId}`)
    this.blobs.set(assetId, blob)
    if (kind === 'image' || blob.type.startsWith('image/')) {
      if (this.images.has(assetId)) return
      this.images.set(assetId, await createImageBitmap(blob))
      return
    }
    if (this.videos.has(assetId)) return
    const video = document.createElement('video')
    video.preload = 'auto'
    video.playsInline = true
    video.muted = true
    video.src = URL.createObjectURL(blob)
    this.videos.set(assetId, video)
    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error(`无法播放素材「${name || '视频'}」`))
      video.onloadeddata = () => resolve()
      video.onerror = fail
      video.load()
      signal?.addEventListener('abort', () => reject(new DOMException('编码已取消', 'AbortError')), { once: true })
    })
  }
}

function seekVideo(video: HTMLVideoElement, seconds: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  const target = Math.max(0, seconds)
  if (Math.abs(video.currentTime - target) < 0.03) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const finish = () => {
      video.removeEventListener('seeked', finish)
      signal?.removeEventListener('abort', onAbort)
      window.clearTimeout(timer)
      resolve()
    }
    const onAbort = () => {
      video.removeEventListener('seeked', finish)
      window.clearTimeout(timer)
      reject(new DOMException('编码已取消', 'AbortError'))
    }
    video.addEventListener('seeked', finish, { once: true })
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = window.setTimeout(finish, 48)
    video.currentTime = target
  })
}
