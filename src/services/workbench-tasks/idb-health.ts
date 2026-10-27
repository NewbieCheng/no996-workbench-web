import {
  mainStoreNamesHealthy,
  legacyStoreNamesHealthy,
  shouldWipeLegacy,
  shouldWipeMainFromProbe,
  WORKBENCH_TASKS_DB_VERSION,
  type MainDbProbe,
} from './idb-store-health'
import { LEGACY_VOICE_TTS_DB, readLegacyVoiceTts } from './migrate-voice-tts'

export const WORKBENCH_TASKS_DB = 'no996-workbench-tasks'
export const WORKBENCH_IDB_REPAIR_KEY = 'no996_wb_idb_repair_v2'

const MAIN_STORE_JOBS = 'jobs'
const MAIN_STORE_BLOBS = 'blobs'
const MAIN_STORE_PAYLOADS = 'payloads'

function ensureMainTaskSchema(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(MAIN_STORE_JOBS)) {
    const store = db.createObjectStore(MAIN_STORE_JOBS, { keyPath: 'id' })
    store.createIndex('by_owner_created', ['ownerUserId', 'createdAt'], { unique: false })
    store.createIndex('by_status', 'status', { unique: false })
  }
  if (!db.objectStoreNames.contains(MAIN_STORE_BLOBS)) {
    db.createObjectStore(MAIN_STORE_BLOBS, { keyPath: 'id' })
  }
  if (!db.objectStoreNames.contains(MAIN_STORE_PAYLOADS)) {
    db.createObjectStore(MAIN_STORE_PAYLOADS, { keyPath: 'id' })
  }
}

export { mainStoreNamesHealthy } from './idb-store-health'

function deleteIdbDatabase(name: string, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    try {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = finish
      req.onerror = finish
      req.onblocked = () => {
        window.setTimeout(finish, timeoutMs)
      }
    } catch {
      finish()
      return
    }
    window.setTimeout(finish, timeoutMs)
  })
}

async function idbExists(name: string): Promise<boolean> {
  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases()
    return dbs.some((d) => d.name === name)
  }
  return true
}

type MainOpenResult =
  | { status: 'ok'; db: IDBDatabase }
  /** 库被更高版本写入（如另一个标签页仍是旧代码）：库本身没坏，绝不能删 */
  | { status: Exclude<MainDbProbe, 'ok'> }

async function openMainDbReadonly(): Promise<MainOpenResult> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(WORKBENCH_TASKS_DB, WORKBENCH_TASKS_DB_VERSION)
      req.onerror = () => {
        // VersionError：已存在的库版本更高。这不是损坏，是另一处代码更新。
        if (req.error?.name === 'VersionError') {
          resolve({ status: 'version-ahead' })
          return
        }
        resolve({ status: 'unavailable' })
      }
      req.onblocked = () => resolve({ status: 'unavailable' })
      req.onupgradeneeded = () => {
        ensureMainTaskSchema(req.result)
      }
      req.onsuccess = () => resolve({ status: 'ok', db: req.result })
    } catch {
      resolve({ status: 'unavailable' })
    }
  })
}

async function openLegacyDbReadonly(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(LEGACY_VOICE_TTS_DB, 1)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('jobs')) {
          const store = db.createObjectStore('jobs', { keyPath: 'id' })
          store.createIndex('by_owner_created', ['ownerUserId', 'createdAt'], { unique: false })
          store.createIndex('by_status', 'status', { unique: false })
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
    } catch {
      resolve(null)
    }
  })
}

export type WorkbenchIdbHealthResult = {
  healthy: boolean
  wipeMain: boolean
  wipeLegacy: boolean
}

export async function assessWorkbenchIdbHealth(): Promise<WorkbenchIdbHealthResult> {
  let wipeLegacy = false

  const main = await openMainDbReadonly()
  // 探测失败（打不开 / 版本更高）一律不 wipe：只跳过这次修复，交给下次启动重试
  const mainProbe: MainDbProbe = main.status
  const mainOk = main.status === 'ok' ? mainStoreNamesHealthy(main.db.objectStoreNames) : false
  if (main.status === 'ok') main.db.close()
  if (mainProbe !== 'ok') {
    return { healthy: true, wipeMain: false, wipeLegacy: false }
  }
  const wipeMain = shouldWipeMainFromProbe(mainProbe, mainOk)

  const legacyListed = await idbExists(LEGACY_VOICE_TTS_DB)
  if (!legacyListed) {
    return { healthy: !wipeMain, wipeMain, wipeLegacy: false }
  }

  const legacyDb = await openLegacyDbReadonly()
  if (!legacyDb) {
    return { healthy: !wipeMain, wipeMain, wipeLegacy: false }
  }
  const emptyShell = !legacyStoreNamesHealthy(legacyDb.objectStoreNames)
  legacyDb.close()

  if (emptyShell) {
    wipeLegacy = true
  } else {
    const legacy = await readLegacyVoiceTts()
    wipeLegacy = shouldWipeLegacy(false, legacy.jobs.length, legacy.blobs.length)
  }

  const healthy = !wipeMain && !wipeLegacy
  return { healthy, wipeMain, wipeLegacy }
}

export function isWorkbenchIdbRepairDone(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(WORKBENCH_IDB_REPAIR_KEY) === '1'
}

export function markWorkbenchIdbRepairDone(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(WORKBENCH_IDB_REPAIR_KEY, '1')
}

/** One-time per-origin repair after deploy; returns whether databases were wiped. */
export async function runWorkbenchIdbRepairIfNeeded(): Promise<{ wiped: boolean; skipped: boolean }> {
  if (isWorkbenchIdbRepairDone()) {
    return { wiped: false, skipped: true }
  }

  const assessment = await assessWorkbenchIdbHealth()
  let wiped = false

  if (assessment.wipeMain) {
    await deleteIdbDatabase(WORKBENCH_TASKS_DB)
    wiped = true
  }
  if (assessment.wipeLegacy) {
    await deleteIdbDatabase(LEGACY_VOICE_TTS_DB)
    wiped = true
  }

  markWorkbenchIdbRepairDone()
  return { wiped, skipped: false }
}
