import { legacyStoreNamesHealthy } from './idb-store-health'
import type { TaskBlobRecord, VoiceTtsPayload, WorkbenchTaskRecord } from './types'

export const LEGACY_VOICE_TTS_DB = 'no996-workbench-voice-tts'

const LEGACY_STORE_JOBS = 'jobs'
const LEGACY_STORE_BLOBS = 'blobs'

export { legacyStoreNamesHealthy, shouldWipeLegacy } from './idb-store-health'

type LegacyJob = {
  id: string
  ownerUserId: number
  status: WorkbenchTaskRecord['status']
  createdAt: number
  startedAt?: number
  finishedAt?: number
  errorMessage?: string
  text: string
  textPreview: string
  voiceId: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
  mediaPath?: string
  blobId?: string
  audioByteLength?: number
}

function openLegacyDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(LEGACY_VOICE_TTS_DB, 1)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(LEGACY_STORE_JOBS)) {
          const store = db.createObjectStore(LEGACY_STORE_JOBS, { keyPath: 'id' })
          store.createIndex('by_owner_created', ['ownerUserId', 'createdAt'], { unique: false })
          store.createIndex('by_status', 'status', { unique: false })
        }
        if (!db.objectStoreNames.contains(LEGACY_STORE_BLOBS)) {
          db.createObjectStore(LEGACY_STORE_BLOBS, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    } catch {
      resolve(null)
    }
  })
}

const emptyLegacy = () => ({
  jobs: [] as WorkbenchTaskRecord[],
  payloads: [] as Array<{ id: string; kind: 'voice_tts'; data: VoiceTtsPayload }>,
  blobs: [] as TaskBlobRecord[],
})

export async function readLegacyVoiceTts(): Promise<{
  jobs: WorkbenchTaskRecord[]
  payloads: Array<{ id: string; kind: 'voice_tts'; data: VoiceTtsPayload }>
  blobs: TaskBlobRecord[]
}> {
  const db = await openLegacyDb()
  if (!db) return emptyLegacy()
  if (!legacyStoreNamesHealthy(db.objectStoreNames)) {
    db.close()
    return emptyLegacy()
  }
  try {
    const jobs = await new Promise<LegacyJob[]>((resolve, reject) => {
      const tx = db.transaction(LEGACY_STORE_JOBS, 'readonly')
      const req = tx.objectStore(LEGACY_STORE_JOBS).getAll()
      req.onsuccess = () => resolve((req.result as LegacyJob[]) ?? [])
      req.onerror = () => reject(req.error)
    })
    const blobs = await new Promise<TaskBlobRecord[]>((resolve, reject) => {
      const tx = db.transaction(LEGACY_STORE_BLOBS, 'readonly')
      const req = tx.objectStore(LEGACY_STORE_BLOBS).getAll()
      req.onsuccess = () => {
        const rows = (req.result as TaskBlobRecord[]) ?? []
        resolve(rows.filter((b) => b && b.data instanceof ArrayBuffer))
      }
      req.onerror = () => reject(req.error)
    })
    const converted: WorkbenchTaskRecord[] = []
    const payloads: Array<{ id: string; kind: 'voice_tts'; data: VoiceTtsPayload }> = []
    for (const old of jobs) {
      if (!old?.id || typeof old.ownerUserId !== 'number') continue
      converted.push({
        id: old.id,
        ownerUserId: old.ownerUserId,
        kind: 'voice_tts',
        status: old.status,
        title: old.textPreview || old.text.slice(0, 40),
        subtitle: old.voiceLabel,
        route: '/workbench/voice',
        createdAt: old.createdAt,
        startedAt: old.startedAt,
        finishedAt: old.finishedAt,
        errorMessage: old.errorMessage,
        payloadId: old.id,
        blobId: old.blobId,
        audioByteLength: old.audioByteLength,
      })
      payloads.push({
        id: old.id,
        kind: 'voice_tts',
        data: {
          text: old.text,
          textPreview: old.textPreview,
          voiceId: old.voiceId,
          voiceLabel: old.voiceLabel,
          rate: old.rate,
          volume: old.volume,
          pitch: old.pitch,
          instruction: old.instruction,
          mediaPath: old.mediaPath,
        },
      })
    }
    return { jobs: converted, payloads, blobs }
  } catch {
    return emptyLegacy()
  } finally {
    db.close()
  }
}
