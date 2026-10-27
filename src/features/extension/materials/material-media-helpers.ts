import type { SavedMaterial } from '../../../services/materials/material-repository'
import { resolveMaterialMediaLayout } from './material-public-media'

export type MaterialMediaTab = 'image' | 'video' | 'cover'

export function defaultMaterialMediaTab(
  images: string[],
  videos: string[],
  covers: string[],
  initial?: MaterialMediaTab,
): MaterialMediaTab {
  if (initial === 'video' && videos.length) return 'video'
  if (initial === 'cover' && covers.length) return 'cover'
  if (initial === 'image' && images.length) return 'image'
  if (videos.length) return 'video'
  if (images.length) return 'image'
  return 'cover'
}

export function materialBodyFallbackAt(material: SavedMaterial, index: number): string | undefined {
  return material.imageFallbackDataUrls?.[index]
}

export function materialCoverFallback(material: SavedMaterial): string | undefined {
  return material.coverFallbackDataUrl
}

export function materialMediaFromSaved(material: SavedMaterial) {
  const layout = resolveMaterialMediaLayout(material)
  return {
    images: layout.bodyImageUrls,
    covers: layout.coverUrls,
    videos: layout.videoUrls.length ? layout.videoUrls : material.playUrl ? [material.playUrl] : [],
    firstBodySharesCover: Boolean(layout.firstBodySharesCoverAsset),
  }
}
