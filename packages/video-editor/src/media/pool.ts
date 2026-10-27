/**
 * 资源池实现：带引用计数的 Blob URL 与对象生命周期管理器
 */

import type { ResourcePool } from './types.ts'

type PooledItem = {
  url: string
  refCount: number
}

export class DefaultResourcePool implements ResourcePool {
  private pool = new Map<string, PooledItem>()

  acquireUrl(blobId: string, blob: Blob): string {
    const existing = this.pool.get(blobId)
    if (existing) {
      existing.refCount++
      return existing.url
    }

    // 检查当前环境是否支持 URL.createObjectURL
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return `mock-blob-url://${blobId}`
    }

    const url = URL.createObjectURL(blob)
    this.pool.set(blobId, { url, refCount: 1 })
    return url
  }

  releaseUrl(blobId: string): void {
    const existing = this.pool.get(blobId)
    if (!existing) return

    existing.refCount--
    if (existing.refCount <= 0) {
      if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(existing.url)
      }
      this.pool.delete(blobId)
    }
  }

  clear(): void {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      for (const item of this.pool.values()) {
        URL.revokeObjectURL(item.url)
      }
    }
    this.pool.clear()
  }

  getActiveCount(): number {
    return this.pool.size
  }
}
