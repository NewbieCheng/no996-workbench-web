/**
 * 浏览器原生 IndexedDB 仓储实现
 * 严格按照 [scope, id] / [scope, blobId] 复合主键设计，杜绝不同账号同名 ID 覆盖。
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
import { validateEditorDocument } from '../schema.ts'

export type EditorWorkspace = 'video-factory' | 'ip-video'

// Keep the existing factory database; IP video starts in its own project and asset store.
const DATABASE_NAMES: Record<EditorWorkspace, string> = {
  'video-factory': 'no996-video-editor-v1',
  'ip-video': 'no996-ip-video-editor-v1',
}
const DB_VERSION = 1
const STORE_PROJECTS = 'projects'
const STORE_ASSETS = 'assets'

type StoredProjectRecord = {
  scope: string
  id: string
  document: EditorDocument
  updatedAt: number
}

type StoredAssetRecord = {
  scope: string
  blobId: string
  blob: Blob
  size: number
}

function openDatabase(workspace: EditorWorkspace): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前环境不支持 IndexedDB'))
  }

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE_NAMES[workspace], DB_VERSION)

    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const pStore = db.createObjectStore(STORE_PROJECTS, { keyPath: ['scope', 'id'] })
        pStore.createIndex('scope', 'scope')
        pStore.createIndex('scope_updatedAt', ['scope', 'updatedAt'])
      }
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        const aStore = db.createObjectStore(STORE_ASSETS, { keyPath: ['scope', 'blobId'] })
        aStore.createIndex('scope', 'scope')
      }
    }

    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'))
  })
}

export class IndexedDBProjectRepository implements ProjectRepository {
  private readonly workspace: EditorWorkspace

  constructor(workspace: EditorWorkspace = 'video-factory') {
    this.workspace = workspace
  }
  async listProjects(scope: string): Promise<ProjectMetadata[]> {
    const db = await openDatabase(this.workspace)
    try {
      return await new Promise<ProjectMetadata[]>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly')
        const store = tx.objectStore(STORE_PROJECTS)
        const index = store.index('scope')
        const request = index.getAll(IDBKeyRange.only(scope))

        request.onsuccess = () => {
          const records = (request.result || []) as StoredProjectRecord[]
          const list: ProjectMetadata[] = records.map((r) => ({
            id: r.document.id,
            name: r.document.name,
            scope: r.document.scope,
            revision: r.document.revision,
            durationUs: r.document.durationUs,
            createdAt: r.document.createdAt,
            updatedAt: r.document.updatedAt,
          }))
          resolve(list.sort((a, b) => b.updatedAt - a.updatedAt))
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  }

  async getProject(id: string, scope: string): Promise<EditorDocument | null> {
    const db = await openDatabase(this.workspace)
    try {
      return await new Promise<EditorDocument | null>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readonly')
        const store = tx.objectStore(STORE_PROJECTS)
        const request = store.get([scope, id])

        request.onsuccess = () => {
          const rec = request.result as StoredProjectRecord | undefined
          resolve(rec ? rec.document : null)
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  }

  async saveProject(doc: EditorDocument, expectedRevision?: number): Promise<void> {
    validateEditorDocument(doc)
    const db = await openDatabase(this.workspace)
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite')
        const store = tx.objectStore(STORE_PROJECTS)
        const getReq = store.get([doc.scope, doc.id])

        getReq.onsuccess = () => {
          const existing = getReq.result as StoredProjectRecord | undefined

          if (existing && expectedRevision !== undefined && existing.document.revision !== expectedRevision) {
            reject(
              new RevisionConflictError(
                `工程已被修改 (当前: r${existing.document.revision}, 预期: r${expectedRevision})`
              )
            )
            return
          }

          if (!existing) {
            const index = store.index('scope')
            const countReq = index.count(IDBKeyRange.only(doc.scope))
            countReq.onsuccess = () => {
              if (countReq.result >= REPOSITORY_QUOTAS.maxProjectsPerScope) {
                reject(
                  new StorageQuotaExceededError(
                    `工程数量超限 (最多允许 ${REPOSITORY_QUOTAS.maxProjectsPerScope} 个)`
                  )
                )
                return
              }
              const record: StoredProjectRecord = {
                scope: doc.scope,
                id: doc.id,
                document: doc,
                updatedAt: doc.updatedAt,
              }
              store.put(record)
            }
            countReq.onerror = () => reject(countReq.error)
          } else {
            const record: StoredProjectRecord = {
              scope: doc.scope,
              id: doc.id,
              document: doc,
              updatedAt: doc.updatedAt,
            }
            store.put(record)
          }
        }
        getReq.onerror = () => reject(getReq.error)

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error ?? new Error('保存工程事务失败'))
        tx.onabort = () => reject(tx.error ?? new Error('保存工程事务已终止'))
      })
    } finally {
      db.close()
    }
  }

  async deleteProject(id: string, scope: string): Promise<void> {
    const db = await openDatabase(this.workspace)
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PROJECTS, 'readwrite')
        const store = tx.objectStore(STORE_PROJECTS)
        store.delete([scope, id])
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }
}

export class IndexedDBAssetRepository implements AssetRepository {
  private readonly workspace: EditorWorkspace

  constructor(workspace: EditorWorkspace = 'video-factory') {
    this.workspace = workspace
  }
  async getAssetBlob(blobId: string, scope: string): Promise<Blob | null> {
    const db = await openDatabase(this.workspace)
    try {
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_ASSETS, 'readonly')
        const store = tx.objectStore(STORE_ASSETS)
        const request = store.get([scope, blobId])

        request.onsuccess = () => {
          const rec = request.result as StoredAssetRecord | undefined
          resolve(rec ? rec.blob : null)
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  }

  async saveAssetBlob(blobId: string, scope: string, blob: Blob): Promise<void> {
    if (blob.size > REPOSITORY_QUOTAS.maxSingleAssetBytes) {
      throw new StorageQuotaExceededError(
        `单个媒体体积超限 (最大允许 ${REPOSITORY_QUOTAS.maxSingleAssetBytes / 1024 / 1024} MB)`
      )
    }

    const usage = await this.getScopeStorageUsage(scope)
    const existingBlob = await this.getAssetBlob(blobId, scope)
    const sizeDelta = blob.size - (existingBlob ? existingBlob.size : 0)

    if (usage.totalBytes + sizeDelta > REPOSITORY_QUOTAS.maxAssetBytesPerScope) {
      throw new StorageQuotaExceededError(
        `总媒体仓储超限 (最大允许 ${REPOSITORY_QUOTAS.maxAssetBytesPerScope / 1024 / 1024} MB)`
      )
    }

    const db = await openDatabase(this.workspace)
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ASSETS, 'readwrite')
        const store = tx.objectStore(STORE_ASSETS)
        const record: StoredAssetRecord = {
          scope,
          blobId,
          blob,
          size: blob.size,
        }
        store.put(record)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }

  async deleteAssetBlob(blobId: string, scope: string): Promise<void> {
    const db = await openDatabase(this.workspace)
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ASSETS, 'readwrite')
        const store = tx.objectStore(STORE_ASSETS)
        store.delete([scope, blobId])
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
    } finally {
      db.close()
    }
  }

  async getScopeStorageUsage(scope: string): Promise<{ totalBytes: number; count: number }> {
    const db = await openDatabase(this.workspace)
    try {
      return await new Promise<{ totalBytes: number; count: number }>((resolve, reject) => {
        const tx = db.transaction(STORE_ASSETS, 'readonly')
        const store = tx.objectStore(STORE_ASSETS)
        const index = store.index('scope')
        const request = index.getAll(IDBKeyRange.only(scope))

        request.onsuccess = () => {
          const records = (request.result || []) as StoredAssetRecord[]
          let totalBytes = 0
          for (const r of records) {
            totalBytes += r.size || 0
          }
          resolve({ totalBytes, count: records.length })
        }
        request.onerror = () => reject(request.error)
      })
    } finally {
      db.close()
    }
  }
}
