import type { EditorDocument } from '@no996/video-editor/core/project.ts'

/** Only changes affecting audible output invalidate the shared preview mix. */
export function buildPreviewAudioSignature(doc: EditorDocument | null): string {
  if (!doc) return ''
  const solo = doc.tracks.some(track => track.solo && !track.muted)
  const clips = doc.tracks.flatMap(track => track.elements.flatMap(element => {
    if (element.type !== 'audio' && element.type !== 'video') return []
    if (element.type === 'video' && (doc.assets[element.assetId]?.hasAudio === false || element.volume === 0)) return []
    return [[element.id, element.assetId, doc.assets[element.assetId]?.blobId ?? '', element.sourceInUs, element.sourceOutUs, element.startUs, element.durationUs, element.rate, element.volume, element.type === 'audio' ? element.fadeInUs ?? 0 : 0, element.type === 'audio' ? element.fadeOutUs ?? 0 : 0, track.muted || (solo && !track.solo) ? 'm' : '', JSON.stringify(element.animations ?? {})].join(':')]
  }))
  return clips.length ? `${doc.id}:${doc.durationUs}|${clips.join('|')}` : ''
}
