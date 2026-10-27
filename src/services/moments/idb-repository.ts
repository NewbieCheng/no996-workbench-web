import { commitWeekPlan } from './plan-transaction'
import type {
  MomentsContent,
  MomentsDayMaterial,
  MomentsScheduleItem,
  MomentsWeekRecord,
} from '../../features/moments/domain/moments'

const DB_NAME = 'no996-workbench-moments'
const DB_VERSION = 1
const STORE_WEEKS = 'weeks'
const STORE_ITEMS = 'schedule_items'
const STORE_CONTENTS = 'contents'
const STORE_MATERIALS = 'day_materials'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('本机浏览器不支持 IndexedDB'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开朋友圈本机库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_WEEKS)) {
        db.createObjectStore(STORE_WEEKS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORE_ITEMS)) {
        const store = db.createObjectStore(STORE_ITEMS, { keyPath: 'id' })
        store.createIndex('by_week', 'weekId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_CONTENTS)) {
        const store = db.createObjectStore(STORE_CONTENTS, { keyPath: 'id' })
        store.createIndex('by_week', 'weekId', { unique: false })
        store.createIndex('by_item', 'scheduleItemId', { unique: false })
      }
      if (!db.objectStoreNames.contains(STORE_MATERIALS)) {
        db.createObjectStore(STORE_MATERIALS, { keyPath: 'scheduleItemId' })
      }
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('朋友圈本机库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('朋友圈本机库事务中止'))
  })
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).getAll()
    req.onsuccess = () => resolve((req.result as T[]) ?? [])
    req.onerror = () => reject(req.error ?? new Error('读取失败'))
    tx.oncomplete = () => db.close()
  })
}

async function getById<T>(storeName: string, id: string): Promise<T | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const req = tx.objectStore(storeName).get(id)
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('读取失败'))
    tx.oncomplete = () => db.close()
  })
}

async function put<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).put(value)
  await txDone(tx)
  db.close()
}

async function remove(storeName: string, id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  tx.objectStore(storeName).delete(id)
  await txDone(tx)
  db.close()
}

export async function listWeeks(): Promise<MomentsWeekRecord[]> {
  const rows = await getAll<MomentsWeekRecord>(STORE_WEEKS)
  return rows.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

export async function getWeek(weekId: string): Promise<MomentsWeekRecord | null> {
  return getById<MomentsWeekRecord>(STORE_WEEKS, weekId)
}

export async function putWeek(record: MomentsWeekRecord): Promise<void> {
  await put(STORE_WEEKS, record)
}

export async function listItems(weekId?: string): Promise<MomentsScheduleItem[]> {
  const rows = await getAll<MomentsScheduleItem>(STORE_ITEMS)
  return rows
    .filter((row) => !weekId || row.weekId === weekId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.publishOrder - b.publishOrder)
}

export async function getItem(itemId: string): Promise<MomentsScheduleItem | null> {
  return getById<MomentsScheduleItem>(STORE_ITEMS, itemId)
}

export async function putItem(record: MomentsScheduleItem): Promise<void> {
  await put(STORE_ITEMS, record)
}

export async function removeItem(itemId: string): Promise<void> {
  await remove(STORE_ITEMS, itemId)
}

export async function listContents(weekId?: string): Promise<MomentsContent[]> {
  const rows = await getAll<MomentsContent>(STORE_CONTENTS)
  return rows
    .filter((row) => !weekId || row.weekId === weekId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.publishOrder - b.publishOrder)
}

export async function getContent(contentId: string): Promise<MomentsContent | null> {
  return getById<MomentsContent>(STORE_CONTENTS, contentId)
}

export async function putContent(record: MomentsContent): Promise<void> {
  await put(STORE_CONTENTS, record)
}

export async function removeContent(contentId: string): Promise<void> {
  await remove(STORE_CONTENTS, contentId)
}

export async function getMaterial(scheduleItemId: string): Promise<MomentsDayMaterial | null> {
  return getById<MomentsDayMaterial>(STORE_MATERIALS, scheduleItemId)
}

export async function putMaterial(record: MomentsDayMaterial): Promise<void> {
  await put(STORE_MATERIALS, record)
}

export async function putWeekPlan(record: MomentsWeekRecord, items: MomentsScheduleItem[]): Promise<void> {
  await commitWeekPlan(await openDb(), record, items)
}

export { DB_NAME as MOMENTS_IDB_NAME }
