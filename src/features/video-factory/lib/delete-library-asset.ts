import type { EditorDocument, EditorInstance, ProjectAsset } from '@no996/video-editor'

export function isLibraryAssetReferenced(doc: EditorDocument, assetId: string): boolean {
  for (const track of doc.tracks) {
    for (const element of track.elements) {
      if ('assetId' in element && element.assetId === assetId) return true
    }
  }
  return false
}

export async function deleteLibraryAsset(input: {
  editor: EditorInstance
  asset: ProjectAsset
  deleteBlob: (blobId: string) => Promise<void>
  onEvictPreviewCache?: (assetId: string) => void
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const doc = input.editor.getDocument()
  if (isLibraryAssetReferenced(doc, input.asset.id)) {
    return { ok: false, message: '时间轴仍在使用该素材，请先删除对应片段' }
  }

  const { asset } = input
  input.editor.updateDocument((prev) => {
    const nextAssets = { ...prev.assets }
    delete nextAssets[asset.id]
    return { ...prev, assets: nextAssets }
  })

  if (asset.blobId) {
    await input.deleteBlob(asset.blobId)
  }
  input.onEvictPreviewCache?.(asset.id)
  return { ok: true }
}
