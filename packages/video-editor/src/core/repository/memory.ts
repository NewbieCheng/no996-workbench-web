/**
 * 内存仓储实现（用于无浏览器环境、测试与轻量宿主）
 */

import type { EditorDocument } from '../project.ts'
import {
  type ProjectRepository,
  type AssetRepository,
  type ProjectMetadata,
  REPOSITORY_QUOTAS,
  StorageQuotaExceededError,
  RevisionConflictError,
} from './types.ts'
import { cloneDocument } from '../serialization.ts'
import { validateEditorDocument } from '../schema.ts'

export class MemoryProjectRepository implements ProjectRepository {
  private projects = new Map<string, EditorDocument>()

  private makeKey(id: string, scope: string): string {
    return `${scope}::${id}`
  }

  async listProjects(scope: string): Promise<ProjectMetadata[]> {
    const list: ProjectMetadata[] = []
    for (const doc of this.projects.values()) {
      if (doc.scope === scope) {
        list.push({
          id: doc.id,
          name: doc.name,
          scope: doc.scope,
          revision: doc.revision,
          durationUs: doc.durationUs,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })
      }
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getProject(id: string, scope: string): Promise<EditorDocument | null> {
    const doc = this.projects.get(this.makeKey(id, scope))
    return doc ? cloneDocument(doc) : null
  }

  async saveProject(doc: EditorDocument, expectedRevision?: number): Promise<void> {
    validateEditorDocument(doc)
    const key = this.makeKey(doc.id, doc.scope)
    const existing = this.projects.get(key)

    // 乐观锁检查
    if (existing && expectedRevision !== undefined && existing.revision !== expectedRevision) {
      throw new RevisionConflictError(
        `工程已被较新的操作修改 (当前: r${existing.revision}, 预期: r${expectedRevision})`
      )
    }

    // 新增工程配额检查
    if (!existing) {
      const currentList = await this.listProjects(doc.scope)
      if (currentList.length >= REPOSITORY_QUOTAS.maxProjectsPerScope) {
        throw new StorageQuotaExceededError(
          `工程数量超出上限 (最多允许 ${REPOSITORY_QUOTAS.maxProjectsPerScope} 个工程)`
        )
      }
    }

    this.projects.set(key, cloneDocument(doc))
  }

  async deleteProject(id: string, scope: string): Promise<void> {
    this.projects.delete(this.makeKey(id, scope))
  }

  clear(): void {
    this.projects.clear()
  }
}

export class MemoryAssetRepository implements AssetRepository {
  private blobs = new Map<string, { blob: Blob; size: number }>()

  private makeKey(blobId: string, scope: string): string {
    return `${scope}::${blobId}`
  }

  async getAssetBlob(blobId: string, scope: string): Promise<Blob | null> {
    const item = this.blobs.get(this.makeKey(blobId, scope))
    return item ? item.blob : null
  }

  async saveAssetBlob(blobId: string, scope: string, blob: Blob): Promise<void> {
    if (blob.size > REPOSITORY_QUOTAS.maxSingleAssetBytes) {
      throw new StorageQuotaExceededError(
        `单个媒体体积超限 (最大允许 ${REPOSITORY_QUOTAS.maxSingleAssetBytes / 1024 / 1024} MB)`
      )
    }

    const usage = await this.getScopeStorageUsage(scope)
    const key = this.makeKey(blobId, scope)
    const existing = this.blobs.get(key)
    const sizeDelta = blob.size - (existing ? existing.size : 0)

    if (usage.totalBytes + sizeDelta > REPOSITORY_QUOTAS.maxAssetBytesPerScope) {
      throw new StorageQuotaExceededError(
        `总媒体仓储超出上限 (最大允许 ${REPOSITORY_QUOTAS.maxAssetBytesPerScope / 1024 / 1024} MB)`
      )
    }

    this.blobs.set(key, { blob, size: blob.size })
  }

  async deleteAssetBlob(blobId: string, scope: string): Promise<void> {
    this.blobs.delete(this.makeKey(blobId, scope))
  }

  async getScopeStorageUsage(scope: string): Promise<{ totalBytes: number; count: number }> {
    let totalBytes = 0
    let count = 0
    const prefix = `${scope}::`
    for (const [key, item] of this.blobs.entries()) {
      if (key.startsWith(prefix)) {
        totalBytes += item.size
        count++
      }
    }
    return { totalBytes, count }
  }

  clear(): void {
    this.blobs.clear()
  }
}
