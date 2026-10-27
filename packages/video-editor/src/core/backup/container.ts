/**
 * 工程二进制打包备份与安全恢复容器 (.vedit)
 * 采用 [Magic(8B) | Version(4B) | ManifestLen(4B) | ManifestJSON | BinaryAssets...] 布局，
 * 彻底消除 base64 膨胀，单点验证越界与损坏。
 */

import type { EditorDocument } from '../project.ts'
import { validateEditorDocument } from '../schema.ts'
import { cloneDocument } from '../serialization.ts'

const MAGIC_BYTES = new Uint8Array([0x4e, 0x4f, 0x39, 0x39, 0x36, 0x56, 0x45, 0x44]) // 'NO996VED'
const BACKUP_CONTAINER_VERSION = 1

export type BackupAssetMeta = {
  blobId: string
  name: string
  mimeType: string
  size: number
  offset: number // 相对于整个容器开头的绝对字节偏移
}

export type BackupManifest = {
  version: 1
  createdAt: number
  document: EditorDocument
  assets: BackupAssetMeta[]
}

export class BackupCorruptedError extends Error {
  code: string
  constructor(message: string, code = 'BACKUP_CORRUPTED') {
    super(message)
    this.name = 'BackupCorruptedError'
    this.code = code
  }
}

/**
 * 将工程及其引用的所有本地 Blob 打包为统一的二进制备份文件
 */
export async function createProjectBackup(
  document: EditorDocument,
  assetResolver: (blobId: string) => Promise<Blob | null>
): Promise<Blob> {
  validateEditorDocument(document)

  // 1. 收集需打包的本地资源
  const uniqueBlobIds = new Set<string>()
  for (const asset of Object.values(document.assets)) {
    if (asset.blobId) {
      uniqueBlobIds.add(asset.blobId)
    }
  }

  const assetPayloads: Array<{ blobId: string; name: string; mimeType: string; data: Uint8Array }> = []

  for (const blobId of uniqueBlobIds) {
    const blob = await assetResolver(blobId)
    if (blob) {
      const buffer = await blob.arrayBuffer()
      const asset = Object.values(document.assets).find((a) => a.blobId === blobId)
      assetPayloads.push({
        blobId,
        name: asset?.name ?? 'unnamed-asset',
        mimeType: blob.type || asset?.mimeType || 'application/octet-stream',
        data: new Uint8Array(buffer),
      })
    }
  }

  // 2. 预计算文件头与 Manifest 结构
  // 先占位构建 Manifest 文本计算其 UTF-8 长度
  const tempManifest: BackupManifest = {
    version: 1,
    createdAt: Date.now(),
    document: cloneDocument(document),
    assets: [],
  }

  const encoder = new TextEncoder()
  let manifestJson = JSON.stringify(tempManifest)
  let manifestBytes = encoder.encode(manifestJson)

  // Header = 8B(Magic) + 4B(Version) + 4B(ManifestLen) = 16B
  const headerLen = 16

  // 迭代计算精确的 offset
  let payloadOffset = headerLen + manifestBytes.byteLength
  const assetMetaList: BackupAssetMeta[] = []

  for (const item of assetPayloads) {
    assetMetaList.push({
      blobId: item.blobId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.data.byteLength,
      offset: payloadOffset,
    })
    payloadOffset += item.data.byteLength
  }

  tempManifest.assets = assetMetaList
  manifestJson = JSON.stringify(tempManifest)
  manifestBytes = encoder.encode(manifestJson)

  // 如果第二次序列化后的 manifest 长度与预估一致，若有微小长度变化修正 offset
  const finalManifestLen = manifestBytes.byteLength
  let cursor = headerLen + finalManifestLen
  for (const meta of tempManifest.assets) {
    meta.offset = cursor
    cursor += meta.size
  }

  const finalManifestJson = JSON.stringify(tempManifest)
  const finalManifestBytes = encoder.encode(finalManifestJson)

  // 3. 组装最终二进制流
  const headerBuffer = new ArrayBuffer(headerLen)
  const headerView = new DataView(headerBuffer)

  // 写入 Magic
  new Uint8Array(headerBuffer, 0, 8).set(MAGIC_BYTES)
  // 写入 Version
  headerView.setUint32(8, BACKUP_CONTAINER_VERSION, true) // 小端序
  // 写入 ManifestLen
  headerView.setUint32(12, finalManifestBytes.byteLength, true)

  const parts: BlobPart[] = [headerBuffer, finalManifestBytes]
  for (const item of assetPayloads) {
    parts.push(item.data.buffer.slice(item.data.byteOffset, item.data.byteOffset + item.data.byteLength) as ArrayBuffer)
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

/**
 * 快速检查备份文件，读取 Manifest 元数据与媒体清单（不解出全部大媒体）
 */
export function inspectProjectBackup(fileBuffer: ArrayBuffer): BackupManifest {
  if (fileBuffer.byteLength < 16) {
    throw new BackupCorruptedError('文件长度不足，不是合法的工程备份')
  }

  const fileBytes = new Uint8Array(fileBuffer)

  // 1. 验证 Magic
  for (let i = 0; i < 8; i++) {
    if (fileBytes[i] !== MAGIC_BYTES[i]) {
      throw new BackupCorruptedError('文件头魔数不匹配，不是合法的 .vedit 备份')
    }
  }

  const view = new DataView(fileBuffer)
  const version = view.getUint32(8, true)
  if (version !== BACKUP_CONTAINER_VERSION) {
    throw new BackupCorruptedError(`不支持的备份版本号: ${version}`)
  }

  const manifestLen = view.getUint32(12, true)
  if (16 + manifestLen > fileBuffer.byteLength) {
    throw new BackupCorruptedError('Manifest 长度损坏，超出文件总大小')
  }

  const decoder = new TextDecoder('utf-8')
  const manifestBytes = fileBytes.subarray(16, 16 + manifestLen)
  let manifest: BackupManifest

  try {
    manifest = JSON.parse(decoder.decode(manifestBytes))
  } catch {
    throw new BackupCorruptedError('Manifest JSON 解析失败，数据已损坏')
  }

  validateEditorDocument(manifest.document)

  // 验证各资源的 offset 与 size
  for (const asset of manifest.assets) {
    if (asset.offset < 16 + manifestLen || asset.offset + asset.size > fileBuffer.byteLength) {
      throw new BackupCorruptedError(`资源 ${asset.blobId} 的数据偏移已越界`)
    }
  }

  return manifest
}

/**
 * 安全恢复工程，解出各个 Blob 并注入到目标 scope 仓储，重新赋予当前安全 scope
 */
export async function restoreProjectBackup(
  fileBuffer: ArrayBuffer,
  targetScope: string,
  assetSaver: (blobId: string, scope: string, blob: Blob) => Promise<void>
): Promise<EditorDocument> {
  const manifest = inspectProjectBackup(fileBuffer)
  const fileBytes = new Uint8Array(fileBuffer)

  // 1. 解压并保存所有素材到当前账号
  for (const assetMeta of manifest.assets) {
    const chunk = fileBytes.subarray(assetMeta.offset, assetMeta.offset + assetMeta.size)
    const blob = new Blob([chunk], { type: assetMeta.mimeType })
    await assetSaver(assetMeta.blobId, targetScope, blob)
  }

  // 2. 强行归属到当前安全 scope，并赋予新 ID 避免覆盖已有同名工程
  const restoredDoc = cloneDocument(manifest.document)
  restoredDoc.id = `restored-${crypto.randomUUID()}`
  restoredDoc.scope = targetScope
  restoredDoc.updatedAt = Date.now()
  restoredDoc.revision = 1

  return restoredDoc
}
