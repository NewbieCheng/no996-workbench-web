import type { SavedMaterial } from '../../../services/materials/material-repository'
import { getMaterialDisplayCoverUrl, resolveMaterialMediaLayout } from './material-public-media'
import { resolveXiaohongshuDisplayTitle } from './xhs-material-display'

export function materialCoverUrl(material: SavedMaterial): string | undefined {
  return getMaterialDisplayCoverUrl(material)
}

export function materialBodyImages(material: SavedMaterial): string[] {
  return resolveMaterialMediaLayout(material).bodyImageUrls
}

export function materialCoverUrls(material: SavedMaterial): string[] {
  return resolveMaterialMediaLayout(material).coverUrls
}

export function materialVideoUrls(material: SavedMaterial): string[] {
  return resolveMaterialMediaLayout(material).videoUrls
}

export function materialDisplayTitle(material: SavedMaterial): string {
  if (material.platformId === 'xiaohongshu') {
    const fromXhs = resolveXiaohongshuDisplayTitle(material.title, material.content)
    if (fromXhs) return fromXhs
  }
  const title = (material.title ?? '').replace(/\s+/g, ' ').trim()
  if (title) return title
  return material.url
}

export function materialBodyText(material: SavedMaterial): string {
  const content = (material.content ?? '').trim()
  if (content) return content
  return (material.title ?? '').trim()
}

export function materialFirstBodySharesCover(material: SavedMaterial): boolean {
  return Boolean(material.mediaLayout?.firstBodySharesCoverAsset)
}
