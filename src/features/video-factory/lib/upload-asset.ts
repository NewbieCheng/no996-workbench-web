/**
 * 素材上传
 *
 * MediaPanel 的 onUploadAsset 需要一个返回 ProjectAsset 的函数。
 * 这里负责：探测元数据 → 存 Blob 到 IndexedDB → 返回资产描述。
 */

import type { EditorInstance, ProjectAsset } from '@no996/video-editor'
import { probeMediaDuration } from '@no996/video-editor'

export type UploadAssetOptions = {
  saveBlob: (blobId: string, blob: Blob) => Promise<void>
}

function kindOf(mime: string): ProjectAsset['kind'] | null {
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  return null
}

export async function uploadAsset(
  editor: EditorInstance,
  file: File,
  options: UploadAssetOptions,
): Promise<ProjectAsset> {
  const kind = kindOf(file.type)
  if (!kind) throw new Error(`不支持的文件类型：${file.type || '未知'}`)

  const blobId = `blob-${crypto.randomUUID()}`
  await options.saveBlob(blobId, file)

  const assetId = `asset-${crypto.randomUUID()}`
  const durationUs = kind === 'image' ? undefined : await probeMediaDuration(file)

  const asset: ProjectAsset = {
    id: assetId,
    kind,
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    durationUs,
    blobId,
    createdAt: Date.now(),
  }

  // 图片素材顺带记录宽高，便于后续布局预设
  if (kind === 'image') {
    try {
      const bitmap = await createImageBitmap(file)
      asset.width = bitmap.width
      asset.height = bitmap.height
      bitmap.close()
    } catch {
      // 尺寸探测失败不影响素材可用
    }
  }

  editor.updateDocument((prev) => ({ ...prev, assets: { ...prev.assets, [assetId]: asset } }))
  return asset
}
