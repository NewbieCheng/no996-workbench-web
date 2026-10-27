/** Shared local media cache. Sources are scoped to the current document and released on switch. */
import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { EditorDocument, EditorInstance } from '@no996/video-editor'

export type UseAssetMediaCacheInput = {
  editor: EditorInstance | null
  getAssetBlob: (blobId: string) => Promise<Blob | null>
}
export type UseAssetMediaCacheResult = {
  resolveAssetSource: (elementId: string) => CanvasImageSource | null
  loadAssetMedia: (assetId: string, blobId: string, blob?: Blob) => Promise<void>
  warmupDocumentAssets: (doc: EditorDocument) => void
  evictAsset: (assetId: string) => void
  clearAll: () => void
  videoElementsRef: MutableRefObject<Map<string, HTMLVideoElement>>
  version: number
  error: string
}

export function useAssetMediaCache({ editor, getAssetBlob }: UseAssetMediaCacheInput): UseAssetMediaCacheResult {
  const images = useRef(new Map<string, ImageBitmap>())
  const videoElementsRef = useRef(new Map<string, HTMLVideoElement>())
  const pending = useRef(new Map<string, Promise<void>>())
  const generation = useRef(0)
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
    for (const id of [...images.current.keys(), ...videoElementsRef.current.keys()]) evictAsset(id)
    pending.current.clear()
  }, [evictAsset])
  const loadAssetMedia = useCallback((assetId: string, blobId: string, givenBlob?: Blob): Promise<void> => {
    const existing = pending.current.get(assetId)
    if (existing) return existing
    if (images.current.has(assetId) || videoElementsRef.current.has(assetId)) return Promise.resolve()
    const epoch = generation.current
    const request = (async () => {
      try {
        const blob = givenBlob ?? await getAssetBlob(blobId)
        if (!blob) throw new Error('素材未保存在本机，请重新添加。')
        if (epoch !== generation.current) return
        const asset = editorRef.current?.getDocument().assets[assetId]
        if (asset?.kind === 'audio' || blob.type.startsWith('audio/')) return
        if (asset?.kind === 'image' || blob.type.startsWith('image/')) {
          const bitmap = await createImageBitmap(blob)
          if (epoch !== generation.current) { bitmap.close(); return }
          images.current.set(assetId, bitmap)
          setVersion(v => v + 1)
        } else {
          const video = document.createElement('video')
          video.preload = 'auto'; video.playsInline = true; video.muted = true
          video.onloadeddata = video.onseeked = () => { if (epoch === generation.current) setVersion(v => v + 1) }
          video.onerror = () => { if (epoch === generation.current) setError(`无法播放素材「${asset?.name ?? '视频'}」，请更换浏览器支持的格式。`) }
          video.src = URL.createObjectURL(blob)
          videoElementsRef.current.set(assetId, video)
          video.load()
        }
      } catch (failure) { if (epoch === generation.current) setError(failure instanceof Error ? failure.message : String(failure)) }
      finally { if (epoch === generation.current) pending.current.delete(assetId) }
    })()
    pending.current.set(assetId, request)
    return request
  }, [getAssetBlob])
  const warmupDocumentAssets = useCallback((doc: EditorDocument) => {
    for (const [id, asset] of Object.entries(doc.assets)) if (asset.blobId && asset.kind !== 'audio') void loadAssetMedia(id, asset.blobId)
  }, [loadAssetMedia])
  const resolveAssetSource = useCallback((elementId: string): CanvasImageSource | null => {
    const element = editorRef.current?.getDocument().tracks.flatMap(t => t.elements).find(e => e.id === elementId)
    if (!element || !('assetId' in element)) return null
    const video = videoElementsRef.current.get(element.assetId)
    return video && video.readyState >= 2 ? video : images.current.get(element.assetId) ?? null
  }, [])
  useEffect(() => { clearAll(); setError(''); return clearAll }, [editor, clearAll])
  return { resolveAssetSource, loadAssetMedia, warmupDocumentAssets, evictAsset, clearAll, videoElementsRef, version, error }
}
