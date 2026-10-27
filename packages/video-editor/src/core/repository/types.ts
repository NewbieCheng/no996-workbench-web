/**
 * 剪辑器持久化与资源仓储接口契约
 */

import type { EditorDocument } from '../project.ts'

export type ProjectMetadata = {
  id: string
  name: string
  scope: string
  revision: number
  durationUs: number
  createdAt: number
  updatedAt: number
}

export const REPOSITORY_QUOTAS = {
  maxProjectsPerScope: 20,
  maxAssetBytesPerScope: 600 * 1024 * 1024, // 600 MB
  maxSingleAssetBytes: 250 * 1024 * 1024, // 250 MB
} as const

export class StorageQuotaExceededError extends Error {
  code: string
  constructor(message: string, code = 'QUOTA_EXCEEDED') {
    super(message)
    this.name = 'StorageQuotaExceededError'
    this.code = code
  }
}

export class RevisionConflictError extends Error {
  code: string
  constructor(message: string, code = 'REVISION_CONFLICT') {
    super(message)
    this.name = 'RevisionConflictError'
    this.code = code
  }
}

export interface ProjectRepository {
  listProjects(scope: string): Promise<ProjectMetadata[]>
  getProject(id: string, scope: string): Promise<EditorDocument | null>
  saveProject(doc: EditorDocument, expectedRevision?: number): Promise<void>
  deleteProject(id: string, scope: string): Promise<void>
}

export interface AssetRepository {
  getAssetBlob(blobId: string, scope: string): Promise<Blob | null>
  saveAssetBlob(blobId: string, scope: string, blob: Blob): Promise<void>
  deleteAssetBlob(blobId: string, scope: string): Promise<void>
  getScopeStorageUsage(scope: string): Promise<{ totalBytes: number; count: number }>
}
