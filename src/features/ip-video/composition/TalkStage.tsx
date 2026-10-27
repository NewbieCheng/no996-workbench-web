import { useCallback, useEffect, useMemo, useRef, type PointerEvent } from 'react'
import { PlayerSurface, useEditorDocument, useEditorInstance, usePlayback } from '@no996/video-editor'
import { mapPlaybackToSourceTimeUs } from '@no996/video-editor/core/speed/mapping.ts'
import { useAssetMediaCache } from '../../../lib/video-editor/use-asset-media-cache'
import { usePreviewAudio } from '../../video-factory/lib/use-preview-audio'
import { ensureCaptionFonts } from '@no996/video-editor/render/captions.ts'
import { captionFontByFamily, loadCaptionFont } from '../editor/caption-fonts'
import { useTalkV2Copy } from './v2-copy'
import { editTalk, patchGlobalStyle, retimePhotos } from './talk-model'
import type { IndexedDBAssetRepository } from '@no996/video-editor/core/repository/indexeddb.ts'

export function TalkStage({ assets, scope, onSelect, onError }: { assets: IndexedDBAssetRepository; scope: string; onSelect: (tab: 'text' | 'media') => void; onError: (message: string) => void }) {
  const { t } = useTalkV2Copy()
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { playheadUs, isPlaying, togglePlay, seek } = usePlayback()
  const getBlob = useCallback((blobId: string) => assets.getAssetBlob(blobId, scope), [assets, scope])
  const cache = useAssetMediaCache({ editor, getAssetBlob: getBlob })
  const resolveBlob = useCallback(async (id: string) => {
    const asset = editor.getDocument().assets[id]
    return asset?.blobId ? getBlob(asset.blobId) : null
  }, [editor, getBlob])
  const audio = usePreviewAudio({ doc, isPlaying, playheadUs, resolveBlob })
  const fontSignature = useMemo(() => JSON.stringify([doc.captionStyle.font, doc.captionStyle.weight, doc.captions.map(c => [c.styleOverride?.font, c.styleOverride?.weight])]), [doc.captionStyle, doc.captions])
  const [fontReady, forceFrame] = useForceFrame()
  useEffect(() => { cache.warmupDocumentAssets(doc) }, [doc.assets, cache.warmupDocumentAssets])
  useEffect(() => {
    let active = true
    const current = editor.getDocument()
    const fonts = new Set([current.captionStyle.font, ...current.captions.flatMap(cue => cue.styleOverride?.font ? [cue.styleOverride.font] : [])])
    void Promise.all([...fonts].map(family => { const entry = captionFontByFamily(family); return entry ? loadCaptionFont(entry.id) : Promise.resolve() })).then(() => ensureCaptionFonts(current)).then(() => { if (active) forceFrame() }).catch(failure => { if (active) onError(failure instanceof Error ? failure.message : String(failure)) })
    return () => { active = false }
  }, [editor, fontSignature, onError, forceFrame])
  useEffect(() => { if (cache.error || audio.error) { editor.setIsPlaying(false); onError(cache.error || audio.error) } }, [cache.error, audio.error, onError, editor])

  useEffect(() => {
    const activeIds = new Set<string>()
    for (const track of doc.tracks) {
      if (track.hidden) continue
      for (const element of track.elements) {
        if (element.type !== 'video' || playheadUs < element.startUs || playheadUs >= element.startUs + element.durationUs) continue
        const video = cache.videoElementsRef.current.get(element.assetId)
        if (!video) continue
        activeIds.add(element.assetId)
        const sourceUs = mapPlaybackToSourceTimeUs(element, playheadUs - element.startUs)
        const target = Math.max(0, sourceUs / 1_000_000)
        video.muted = true
        video.playbackRate = element.rate || 1
        if (Math.abs(video.currentTime - target) > (isPlaying ? 0.12 : 0.015)) video.currentTime = Math.min(Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : target, target)
        if (isPlaying && !element.freeze && !element.reverse) { if (video.paused) void video.play().catch(() => {}) } else video.pause()
      }
    }
    for (const [id, video] of cache.videoElementsRef.current) if (!activeIds.has(id)) video.pause()
  }, [doc, playheadUs, isPlaying, cache.version, cache.videoElementsRef])

  // Recreate the resolver only when an asynchronous image/video/font becomes ready.
  const resolver = useMemo(() => (id: string) => cache.resolveAssetSource(id), [cache.resolveAssetSource, cache.version, fontReady])
  const dragging = useRef<{ x: number; y: number; width: number; height: number; kind: 'caption' | 'media'; id?: string }>()
  const begin = (event: PointerEvent<HTMLButtonElement>, kind: 'caption' | 'media', id?: string) => {
    if (isPlaying) return
    event.stopPropagation()
    const frame = event.currentTarget.parentElement!.getBoundingClientRect()
    dragging.current = { x: event.clientX, y: event.clientY, width: frame.width, height: frame.height, kind, id }
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(kind === 'caption' ? 'text' : 'media')
    if (id) editor.setSelection([id])
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragging.current
    if (!drag) return
    event.stopPropagation()
    event.currentTarget.style.translate = `${event.clientX - drag.x}px ${event.clientY - drag.y}px`
  }
  const end = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const drag = dragging.current
    dragging.current = undefined
    event.currentTarget.style.translate = ''
    if (!drag || cancel) return
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const dx = (event.clientX - drag.x) / drag.width
    const dy = (event.clientY - drag.y) / drag.height
    if (Math.abs(dx) + Math.abs(dy) < 0.003) return
    editTalk(editor, 'move', current => drag.kind === 'caption'
      ? patchGlobalStyle(current, { xRatio: Math.abs((current.captionStyle.xRatio ?? 0.5) + dx - 0.5) < 0.025 ? 0.5 : Math.min(0.9, Math.max(0.1, (current.captionStyle.xRatio ?? 0.5) + dx)), yRatio: Math.min(0.82, Math.max(0.18, current.captionStyle.yRatio + dy)) })
      : retimePhotos({ ...current, tracks: current.tracks.map(t => ({ ...t, elements: t.elements.map(e => e.id === drag.id && 'transform' in e ? { ...e, transform: { ...e.transform, x: e.transform.x + dx * current.canvas.width, y: e.transform.y + dy * current.canvas.height } } : e) })) }))
  }
  const visual = doc.tracks.flatMap(t => t.hidden ? [] : t.elements).filter(e => (e.type === 'image' || e.type === 'video') && playheadUs >= e.startUs && playheadUs < e.startUs + e.durationUs).at(-1)
  return <div className="ipt-stage-wrap">
    <PlayerSurface editor={editor} playheadUs={playheadUs} isPlaying={isPlaying} onTogglePlay={togglePlay} onSeek={seek} assetSourceResolver={resolver} layeredShots simple hideRatioControl
      interactionOverlay={<div className="ipt-stage-overlay" data-playing={isPlaying}>
        <div className="ipt-safe-area" aria-hidden="true" />
        {visual && 'transform' in visual && <button type="button" className="ipt-stage-object" aria-label="调整人物或照片，可拖动位置" style={{ left: `${visual.transform.x / doc.canvas.width * 100}%`, top: `${visual.transform.y / doc.canvas.height * 100}%`, width: `${visual.transform.width / doc.canvas.width * 100}%`, height: `${visual.transform.height / doc.canvas.height * 100}%` }} onPointerDown={e => begin(e, 'media', visual.id)} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onClick={e => { e.stopPropagation(); onSelect('media') }} />}
        {!!doc.captions.length && <button type="button" className="ipt-stage-caption" aria-label="调整字幕外观，可拖动位置" style={{ left: `${((doc.captionStyle.xRatio ?? 0.5) - (doc.captionStyle.widthRatio ?? 0.82) / 2) * 100}%`, top: `${doc.captionStyle.yRatio * 100 - 9}%`, width: `${(doc.captionStyle.widthRatio ?? 0.82) * 100}%`, height: '18%' }} onPointerDown={e => begin(e, 'caption')} onPointerMove={move} onPointerUp={e => end(e)} onPointerCancel={e => end(e, true)} onClick={e => { e.stopPropagation(); onSelect('text') }} />}
      </div>} />
    {!doc.durationUs && <div className="ipt-stage-empty"><strong>你的口播，从这里开始</strong><span>填入文案，或添加已有音视频</span></div>}
    <div className="ipt-stage-note"><span>{t(audio.mixing ? 'preparingAudio' : 'stagePaused')}</span></div>
  </div>
}

import { useState } from 'react'
function useForceFrame(): [number, () => void] {
  const [value, setValue] = useState(0)
  const refresh = useCallback(() => setValue(v => v + 1), [])
  return [value, refresh]
}
