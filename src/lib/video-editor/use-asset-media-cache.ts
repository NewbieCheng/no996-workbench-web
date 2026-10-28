/** Shared local media cache. Sources are scoped to the current document and released on switch. */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { EditorDocument, EditorInstance } from '@no996/video-editor'
import { selectPreviewAssets } from './media-window.ts'

export type UseAssetMediaCacheInput = {
  editor: EditorInstance | null
  getAssetBlob: (blobId: string) => Promise<Blob | null>
}
export type UseAssetMediaCacheResult = {
  resolveAssetSource: (elementId: string) => CanvasImageSource | null
  loadAssetMedia: (assetId: string, blobId: string, blob?: Blob) => Promise<void>
  warmupDocumentAssets: (doc: EditorDocument) => void
  updatePreviewWindow: (doc: EditorDocument, timeUs: number) => void
  evictAsset: (assetId: string) => void
  clearAll: () => void
  videoElementsRef: MutableRefObject<Map<string, HTMLVideoElement>>
  version: number
  error: string
}

const MAX_CONCURRENT_LOADS = 2

export function useAssetMediaCache({ editor, getAssetBlob }: UseAssetMediaCacheInput): UseAssetMediaCacheResult {
  const images = useRef(new Map<string, ImageBitmap>())
  const videoElementsRef = useRef(new Map<string, HTMLVideoElement>())
  const pending = useRef(new Map<string, Promise<void>>())
  const generation = useRef(0)
  const desired = useRef<Set<string> | null>(null)
  const queue = useRef<Array<() => void>>([])
  const running = useRef(0)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState('')
  const editorRef = useRef(editor)
  editorRef.current = editor
  const evictAsset = useCallback((id: string) => {
    images.current.get(id)?.close(); images.current.delete(id)
    const video = videoElementsRef.current.get(id)
    if (video) { video.pause(); video.onloadeddata = null; video.onseeked = null; video.onerror = null; URL.revokeObjectURL(video.src); video.removeAttribute('src'); video.load(); videoElementsRef.current.delete(id) }
  }, [])
  const clearAll = useCallback(() => {
    generation.current++
    desired.current = null
    for (const id of [...images.current.keys(), ...videoElementsRef.current.keys()]) evictAsset(id)
    pending.current.clear()
  }, [evictAsset])
  const loadAssetMedia = useCallback((assetId: string, blobId: string, givenBlob?: Blob): Promise<void> => {
    const existing = pending.current.get(assetId)
    if (existing) return existing
    if (images.current.has(assetId) || videoElementsRef.current.has(assetId)) return Promise.resolve()
    const epoch = generation.current
    let skipped = false
    const wanted = () => epoch === generation.current && (desired.current === null || desired.current.has(assetId))
    const request = new Promise<void>((resolve) => {
      const run = async () => {
        running.current++
        try {
          if (!wanted()) { skipped = true; return }
          const blob = givenBlob ?? await getAssetBlob(blobId)
          if (!wanted()) { skipped = true; return }
          if (!blob) throw new Error('素材未保存在本机，请重新添加。')
          const asset = editorRef.current?.getDocument().assets[assetId]
          if (asset?.kind === 'audio' || blob.type.startsWith('audio/')) return
          if (asset?.kind === 'image' || blob.type.startsWith('image/')) {
            const bitmap = await createImageBitmap(blob)
            if (!wanted()) { skipped = true; bitmap.close(); return }
            images.current.set(assetId, bitmap)
            setVersion(v => v + 1)
          } else {
            const video = document.createElement('video')
            video.preload = 'auto'; video.playsInline = true; video.muted = true
            video.onloadeddata = video.onseeked = () => { if (wanted()) setVersion(v => v + 1) }
            video.onerror = () => { if (wanted()) setError(`无法播放素材「${asset?.name ?? '视频'}」，请更换浏览器支持的格式。`) }
            video.src = URL.createObjectURL(blob)
            videoElementsRef.current.set(assetId, video)
            video.load()
          }
        } catch (failure) { if (wanted()) setError(failure instanceof Error ? failure.message : String(failure)) }
        finally {
          running.current--
          resolve()
          queue.current.shift()?.()
        }
      }
      if (running.current < MAX_CONCURRENT_LOADS) void run()
      else queue.current.push(() => void run())
    })
    pending.current.set(assetId, request)
    void request.finally(() => {
      if (pending.current.get(assetId) !== request) return
      pending.current.delete(assetId)
      // The playhead may have returned to this asset while an obsolete load was finishing.
      if (skipped && wanted()) void loadAssetMedia(assetId, blobId, givenBlob)
    })
    return request
  }, [getAssetBlob])
  const warmupDocumentAssets = useCallback((doc: EditorDocument) => {
    desired.current = null
    for (const [id, asset] of Object.entries(doc.assets)) if (asset.blobId && asset.kind !== 'audio') void loadAssetMedia(id, asset.blobId)
  }, [loadAssetMedia])
  const updatePreviewWindow = useCallback((doc: EditorDocument, timeUs: number) => {
    const ids = selectPreviewAssets(doc, timeUs)
    const next = new Set(ids)
    desired.current = next
    for (const id of [...images.current.keys(), ...videoElementsRef.current.keys()]) if (!next.has(id)) evictAsset(id)
    for (const id of ids) {
      const blobId = doc.assets[id]?.blobId
      if (blobId) void loadAssetMedia(id, blobId)
    }
  }, [evictAsset, loadAssetMedia])
  const resolveAssetSource = useCallback((elementId: string): CanvasImageSource | null => {
    const element = editorRef.current?.getDocument().tracks.flatMap(t => t.elements).find(e => e.id === elementId)
    if (!element || !('assetId' in element)) return null
    const video = videoElementsRef.current.get(element.assetId)
    return video && video.readyState >= 2 ? video : images.current.get(element.assetId) ?? null
  }, [])
  useEffect(() => { clearAll(); setError(''); return clearAll }, [editor, clearAll])
  return { resolveAssetSource, loadAssetMedia, warmupDocumentAssets, updatePreviewWindow, evictAsset, clearAll, videoElementsRef, version, error }
}
