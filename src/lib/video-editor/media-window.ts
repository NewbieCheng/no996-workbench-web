import type { EditorDocument } from '@no996/video-editor'

/** Current layers always win; only a small number of nearby clips are prefetched. */
export function selectPreviewAssets(doc: EditorDocument, timeUs: number, lookaheadUs = 2_000_000, maxPrefetch = 2): string[] {
  const active = new Set<string>()
  const nearby = new Map<string, number>()
  for (const track of doc.tracks) {
    if (track.hidden) continue
    for (const element of track.elements) {
      if (element.type !== 'image' && element.type !== 'video') continue
      const asset = doc.assets[element.assetId]
      if (!asset?.blobId) continue
      const end = element.startUs + element.durationUs
      if (element.startUs <= timeUs && timeUs < end) active.add(element.assetId)
      else if (element.startUs > timeUs && element.startUs <= timeUs + lookaheadUs) {
        nearby.set(element.assetId, Math.min(nearby.get(element.assetId) ?? Infinity, element.startUs))
      }
    }
  }
  const upcoming = [...nearby].filter(([id]) => !active.has(id)).sort((a, b) => a[1] - b[1]).slice(0, maxPrefetch)
  return [...active, ...upcoming.map(([id]) => id)]
}
