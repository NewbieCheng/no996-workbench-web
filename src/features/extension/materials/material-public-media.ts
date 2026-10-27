import type { WorkbenchBridgeMediaLayout } from '../../../services/extension/workbench-bridge-contract'
import type { SavedMaterial } from '../../../services/materials/material-repository'

export function resolveMaterialMediaLayout(material: SavedMaterial): WorkbenchBridgeMediaLayout {
  if (material.mediaLayout) return material.mediaLayout
  const body = material.imageUrls?.filter(Boolean) ?? []
  const cover = material.coverUrl ? [material.coverUrl] : []
  const videos = material.playUrl ? [material.playUrl] : []
  return {
    bodyImageUrls: body,
    coverUrls: cover.length ? cover : (body[0] ? [body[0]] : []),
    videoUrls: videos,
  }
}

/** 给模型 / 下游引用的公网正文图 URL（body-only）。 */
export function getMaterialPublicImageUrls(material: SavedMaterial): string[] {
  return resolveMaterialMediaLayout(material).bodyImageUrls
}

export function getMaterialDisplayCoverUrl(material: SavedMaterial): string | undefined {
  const layout = resolveMaterialMediaLayout(material)
  return layout.bodyImageUrls[0] ?? layout.coverUrls[0]
}

/** UI / 展示层：公网 URL；fallback 由 WorkbenchMediaImage 在直链与 asset.fetch 均失败时使用。 */
export function getMaterialDisplaySrc(
  material: SavedMaterial,
  target: number | 'cover',
): { url?: string; fallbackDataUrl?: string } {
  const layout = resolveMaterialMediaLayout(material)
  if (target === 'cover') {
    const url = layout.coverUrls[0]
    return { url, fallbackDataUrl: material.coverFallbackDataUrl }
  }
  const url = layout.bodyImageUrls[target]
  return { url, fallbackDataUrl: material.imageFallbackDataUrls?.[target] }
}
