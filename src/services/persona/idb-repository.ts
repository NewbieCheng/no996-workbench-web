import { migrateLegacyProfile } from '../../features/persona/lib/account-card'
import type { PersonaRepository } from './repository'
import { personaStoreChanged, reconcilePersonaRecords } from './store-maintenance'
import {
  EMPTY_COMPANY_FORM,
  EMPTY_QUESTIONNAIRE,
  newPersonaId,
  nowIso,
  type PersonaRecord,
  type ProfileKind,
} from './types'

const DB_NAME = 'no996-workbench-persona'
const DB_VERSION = 1
const STORE = 'personas'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error ?? new Error('打开人设本地库失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('by_kind', 'kind', { unique: false })
        store.createIndex('by_kind_active', ['kind', 'isActive'], { unique: false })
      }
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('人设本地库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('人设本地库事务中止'))
  })
}

function isRecord(value: unknown): value is PersonaRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    (r.kind === 'user' || r.kind === 'company') &&
    typeof r.name === 'string' &&
    typeof r.summary === 'string' &&
    typeof r.content === 'string' &&
    typeof r.isActive === 'boolean' &&
    typeof r.updatedAt === 'string' &&
    r.formData !== null &&
    typeof r.formData === 'object'
  )
}

async function migrateLegacyRecords(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const request = store.openCursor()
  request.onsuccess = () => {
    const cursor = request.result
    if (!cursor) return
    const record = cursor.value as unknown
    if (isRecord(record) && record.kind === 'user' && !record.legacyContent) {
      const content = migrateLegacyProfile(record.content)
      if (content) cursor.update({ ...record, legacyContent: record.content, content })
    }
    cursor.continue()
  }
  await txDone(tx)
}

/** 读取并做一次去重/清空空壳，写回库，避免重复档长期留在本机。 */
async function getAll(db: IDBDatabase): Promise<PersonaRecord[]> {
  await migrateLegacyRecords(db)
  return updateRecords(db, (raw) => {
    const reconciled = reconcilePersonaRecords(raw)
    return { records: reconciled, result: reconciled, changed: personaStoreChanged(raw, reconciled) }
  })
}

function updateRecords<T>(db: IDBDatabase, update: (records: PersonaRecord[]) => { records: PersonaRecord[]; result: T; changed: boolean }): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.getAll()
    let result: T
    request.onsuccess = () => {
      try {
        const raw = (request.result as unknown[]).filter(isRecord)
        const next = update(raw)
        result = next.result
        if (next.changed) {
          const ids = new Set(next.records.map((record) => record.id))
          for (const record of raw) if (!ids.has(record.id)) store.delete(record.id)
          for (const record of next.records) store.put(record)
        }
      } catch (error) {
        reject(error)
        tx.abort()
      }
    }
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('人设本地库事务失败'))
    tx.onabort = () => reject(tx.error ?? new Error('人设本地库事务中止'))
  })
}

async function putMany(db: IDBDatabase, records: PersonaRecord[]): Promise<void> {
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  for (const record of records) store.put(record)
  await txDone(tx)
}

function ensureActiveInvariant(records: PersonaRecord[], kind: ProfileKind): PersonaRecord[] {
  const ofKind = records.filter((r) => r.kind === kind)
  if (ofKind.length === 0) return records
  if (ofKind.some((r) => r.isActive)) return records
  const firstId = ofKind[0].id
  return records.map((r) => (r.id === firstId ? { ...r, isActive: true } : r))
}

export function createIndexedDbPersonaRepository(): PersonaRepository {
  return {
    async list(kind) {
      const db = await openDb()
      const all = await getAll(db)
      return all.filter((r) => r.kind === kind).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    async get(id) {
      const db = await openDb()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const req = tx.objectStore(STORE).get(id)
        req.onsuccess = () => resolve(isRecord(req.result) ? req.result : null)
        req.onerror = () => reject(req.error ?? new Error('读取人设失败'))
      })
    },

    async getActive(kind) {
      const db = await openDb()
      const all = await getAll(db)
      if (kind) {
        return all.find((r) => r.kind === kind && r.isActive) ?? all.find((r) => r.kind === kind) ?? null
      }
      return (
        all.find((r) => r.kind === 'user' && r.isActive) ??
        all.find((r) => r.kind === 'company' && r.isActive) ??
        all.find((r) => r.isActive) ??
        all[0] ??
        null
      )
    },

    async create(kind, name) {
      const db = await openDb()
      const all = await getAll(db)
      const count = all.filter((r) => r.kind === kind).length
      const label = name?.trim() || (count === 0 ? '默认分身' : `分身 ${count + 1}`)
      const hasActive = all.some((r) => r.kind === kind && r.isActive)
      const record: PersonaRecord = {
        id: newPersonaId(),
        kind,
        name: label,
        summary: '',
        content: '',
        formData: kind === 'user' ? { ...EMPTY_QUESTIONNAIRE } : { ...EMPTY_COMPANY_FORM },
        isActive: !hasActive,
        updatedAt: nowIso(),
      }
      await putMany(db, [record])
      return record
    },

    async upsert(record) {
      if (record.content.length > 45000) throw new Error('人设内容过长，请缩减至 45,000 字符以内。')
      const db = await openDb()
      return updateRecords(db, (raw) => {
        let all = reconcilePersonaRecords(raw)
        const next = { ...record, updatedAt: nowIso() }
        const idx = all.findIndex((r) => r.id === record.id)
        if (idx === -1) all = [...all, next]
        else all = all.map((r) => r.id === record.id ? next : r)
        if (next.isActive) {
          all = all.map((r) => (r.kind === next.kind ? { ...r, isActive: r.id === next.id } : r))
        }
        all = ensureActiveInvariant(all, next.kind)
        return { records: all, result: all.find((r) => r.id === next.id) ?? next, changed: true }
      })
    },

    async rename(id, name) {
      const record = await this.get(id)
      if (!record) return null
      const trimmed = name.trim()
      if (!trimmed) return record
      return this.upsert({ ...record, name: trimmed })
    },

    async setActive(id) {
      const record = await this.get(id)
      if (!record) return null
      return this.upsert({ ...record, isActive: true })
    },

    async delete(id) {
      const db = await openDb()
      await updateRecords(db, (raw) => {
        const all = reconcilePersonaRecords(raw)
        const target = all.find((r) => r.id === id)
        if (!target) return { records: all, result: undefined, changed: personaStoreChanged(raw, all) }
        if (target.isActive) throw new Error('不能删除当前启用的人设，请先启用其他分身。')
        const next = ensureActiveInvariant(all.filter((r) => r.id !== id), target.kind)
        return { records: next, result: undefined, changed: true }
      })
    },
  }
}
