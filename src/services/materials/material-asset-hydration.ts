import { extensionClient } from '../extension/extension-client'
import { materialRepository } from './material-repository'
import { resolveMaterialMediaLayout } from '../../features/extension/materials/material-public-media'
import { readMaterialPersistImages } from '../../features/extension/materials/material-settings'

const MAX_EDGE = 320
const JPEG_QUALITY = 0.55

async function blobToBlurredDataUrl(blob: Blob): Promise<string | undefined> {
  if (!blob.size || !blob.type.startsWith('image/')) return undefined
  try {
    const bitmap = await createImageBitmap(blob)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height, 1))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.filter = 'blur(1px)'
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    return dataUrl.startsWith('data:image/') ? dataUrl : undefined
  } catch {
    return undefined
  }
}

async function fetchImageDataUrl(url: string): Promise<string | undefined> {
  try {
    const { blob } = await extensionClient.fetchAsset(url)
    return await blobToBlurredDataUrl(blob)
  } catch {
    return undefined
  }
}

export async function hydrateMaterialFallbacks(materialId: string): Promise<void> {
  if (!readMaterialPersistImages()) return
  const material = await materialRepository.getMaterial(materialId)
  if (!material) return

  const layout = resolveMaterialMediaLayout(material)
  const imageFallbackDataUrls: (string | undefined)[] = []
  for (const url of layout.bodyImageUrls) {
    imageFallbackDataUrls.push(await fetchImageDataUrl(url))
  }
  const coverUrl = layout.coverUrls[0]
  const coverFallbackDataUrl = coverUrl ? await fetchImageDataUrl(coverUrl) : undefined

  await materialRepository.patchMaterialFallbacks(materialId, {
    imageFallbackDataUrls,
    coverFallbackDataUrl,
  })
}

export async function clearAllMaterialFallbacks(userId: number): Promise<void> {
  const list = await materialRepository.listMaterials(userId)
  for (const m of list) {
    if (m.imageFallbackDataUrls?.length || m.coverFallbackDataUrl) {
      await materialRepository.patchMaterialFallbacks(m.id, {
        imageFallbackDataUrls: [],
        coverFallbackDataUrl: undefined,
      })
    }
  }
}
