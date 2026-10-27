import type { ProjectAsset } from '../../core/project.ts'

/** 素材库列表指纹：同 kind + 名称 + 体积视为同一文件 */
export function libraryAssetFingerprint(asset: ProjectAsset): string {
  return `${asset.kind}:${asset.name}:${asset.sizeBytes}`
}

/**
 * 素材面板展示去重：同指纹保留 createdAt 最新的一条。
 */
export function dedupeLibraryAssets(assets: ProjectAsset[]): ProjectAsset[] {
  const byKey = new Map<string, ProjectAsset>()
  for (const asset of assets) {
    const key = libraryAssetFingerprint(asset)
    const prev = byKey.get(key)
    if (!prev || (asset.createdAt ?? 0) >= (prev.createdAt ?? 0)) {
      byKey.set(key, asset)
    }
  }
  return [...byKey.values()].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

export function findReusableAudioAsset(
  assets: Record<string, ProjectAsset>,
  name: string,
  sizeBytes: number,
): ProjectAsset | undefined {
  return Object.values(assets).find(
    (asset) => asset.kind === 'audio' && asset.name === name && asset.sizeBytes === sizeBytes,
  )
}
