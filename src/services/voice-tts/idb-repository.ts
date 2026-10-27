import { canTransition, newJobId, planPruneForUser, pickNextQueuedJob } from './queue-logic'
import type { VoiceTtsRepository } from './repository'
import { TTS_JOB_LIMITS, type TtsBlobRecord, type TtsJobRecord } from './types'

const DB_NAME = 'no996-workbench-voice-tts'
const DB_VERSION = 1
const STORE_JOBS = 'jobs'
const STORE_BLOBS = 'blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开配音本地库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_JOBS)) {
        const store = db.createObjectStore(STORE_JOBS, { keyPath: 'id' })
        store.createIndex('by_owner_created', ['ownerUserId', 'createdAt'], { unique: false })
        store.createIndex('by_status', 'status', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' })
      }
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('配音本地库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('配音本地库事务中止'))
  })
}

function isJob(value: unknown): value is TtsJobRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.ownerUserId === 'number' &&
    typeof r.status === 'string' &&
    typeof r.createdAt === 'number' &&
    typeof r.text === 'string'
  )
}

async function getAllJobs(db: IDBDatabase): Promise<TtsJobRecord[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_JOBS, 'readonly')
    const req = tx.objectStore(STORE_JOBS).getAll()
    req.onsuccess = () => resolve((req.result as unknown[]).filter(isJob))
    req.onerror = () => reject(req.error ?? new Error('读取配音任务失败'))
  })
}

export function createIndexedDbVoiceTtsRepository(): VoiceTtsRepository {
  return {
    async putJob(job) {
      const db = await openDb()
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).put(job)
      await txDone(tx)
    },

    async patchJob(id, patch) {
      const db = await openDb()
      const existing = await new Promise<TtsJobRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_JOBS, 'readonly')
        const req = tx.objectStore(STORE_JOBS).get(id)
        req.onsuccess = () => resolve(isJob(req.result) ? req.result : null)
        req.onerror = () => reject(req.error)
      })
      if (!existing) return null
      if (patch.status && !canTransition(existing.status, patch.status)) {
        throw new Error(`非法任务状态: ${existing.status} → ${patch.status}`)
      }
      const next: TtsJobRecord = { ...existing, ...patch }
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      tx.objectStore(STORE_JOBS).put(next)
      await txDone(tx)
      return next
    },

    async getJob(id) {
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_JOBS, 'readonly')
        const req = tx.objectStore(STORE_JOBS).get(id)
        req.onsuccess = () => resolve(isJob(req.result) ? req.result : null)
        req.onerror = () => reject(req.error)
      })
    },

    async listJobsForUser(ownerUserId) {
      const all = await this.listAllJobs()
      return all
        .filter((j) => j.ownerUserId === ownerUserId)
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    async listAllJobs() {
      const db = await openDb()
      return getAllJobs(db)
    },

    async deleteJob(id) {
      const db = await openDb()
      const tx = db.transaction([STORE_JOBS, STORE_BLOBS], 'readwrite')
      tx.objectStore(STORE_JOBS).delete(id)
      tx.objectStore(STORE_BLOBS).delete(id)
      await txDone(tx)
    },

    async putBlob(blob) {
      try {
        const db = await openDb()
        const tx = db.transaction(STORE_BLOBS, 'readwrite')
        tx.objectStore(STORE_BLOBS).put(blob)
        await txDone(tx)
      } catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          throw new Error('本机存储空间不足，请删除部分历史记录后重试。')
        }
        throw e
      }
    },

    async getBlob(id) {
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, 'readonly')
        const req = tx.objectStore(STORE_BLOBS).get(id)
        req.onsuccess = () => {
          const v = req.result as TtsBlobRecord | undefined
          if (!v || typeof v.id !== 'string' || !(v.data instanceof ArrayBuffer)) {
            resolve(null)
            return
          }
          resolve(v)
        }
        req.onerror = () => reject(req.error)
      })
    },

    async deleteBlob(id) {
      const db = await openDb()
      const tx = db.transaction(STORE_BLOBS, 'readwrite')
      tx.objectStore(STORE_BLOBS).delete(id)
      await txDone(tx)
    },

    async pickNextQueued() {
      const jobs = await this.listAllJobs()
      return pickNextQueuedJob(jobs)
    },

    async resetStaleRunning(maxAgeMs) {
      const db = await openDb()
      const jobs = await getAllJobs(db)
      const now = Date.now()
      let count = 0
      const tx = db.transaction(STORE_JOBS, 'readwrite')
      const store = tx.objectStore(STORE_JOBS)
      for (const job of jobs) {
        if (job.status !== 'running') continue
        const started = job.startedAt ?? job.createdAt
        if (now - started > maxAgeMs) {
          store.put({ ...job, status: 'queued', startedAt: undefined })
          count += 1
        }
      }
      await txDone(tx)
      return count
    },

    async pruneForUser(ownerUserId) {
      const db = await openDb()
      const jobs = await getAllJobs(db)
      const blobBytes = new Map<string, number>()
      for (const j of jobs) {
        if (j.blobId && j.audioByteLength) blobBytes.set(j.blobId, j.audioByteLength)
      }
      const plan = planPruneForUser({
        jobs,
        blobBytes,
        ownerUserId,
        now: Date.now(),
      })
      if (plan.deleteJobIds.length === 0) return
      const tx = db.transaction([STORE_JOBS, STORE_BLOBS], 'readwrite')
      const jobStore = tx.objectStore(STORE_JOBS)
      const blobStore = tx.objectStore(STORE_BLOBS)
      for (const id of plan.deleteBlobIds) blobStore.delete(id)
      for (const id of plan.deleteJobIds) jobStore.delete(id)
      await txDone(tx)
    },

    async createQueuedJob(ownerUserId, input) {
      const trimmed = input.text.trim()
      const job: TtsJobRecord = {
        id: newJobId(),
        ownerUserId,
        status: 'queued',
        createdAt: Date.now(),
        text: trimmed,
        textPreview: trimmed.slice(0, TTS_JOB_LIMITS.textPreviewLen),
        voiceId: input.voiceId,
        voiceLabel: input.voiceLabel,
        rate: input.rate,
        volume: input.volume,
        pitch: input.pitch,
        instruction: input.instruction?.trim() || undefined,
        audioMime: 'audio/wav',
      }
      await this.putJob(job)
      return job
    },
  }
}
