import type { TemplateProject } from '../lib/template-project.ts'
import { applyLayout, extractLayout, validLayout, type TemplateLayout } from './model.ts'

export const PRESET_LIMIT = 20
const DB_NAME = 'no996-workbench-ip-template-presets'
const STORE = 'presets'
export type TemplatePreset = { id: string; owner: number; name: string; templateId: string; createdAt: number; layout: TemplateLayout }
function assertOwner(owner: number): void {
  if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('invalidOwner')
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('storageUnavailable')); return }
    const request = indexedDB.open(DB_NAME, 1)
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true; window.clearTimeout(timer); reject(new Error('storageUnavailable'))
    }
    const timer = window.setTimeout(fail, 5000)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' })
      store.createIndex('owner', 'owner')
    }
    request.onerror = fail
    request.onblocked = fail
    request.onsuccess = () => {
      window.clearTimeout(timer)
      const db = request.result
      if (settled) { db.close(); return }
      settled = true
      db.onversionchange = () => db.close()
      resolve(db)
    }
  })
}
function validPreset(value: unknown, owner: number): value is TemplatePreset {
  if (!value || typeof value !== 'object') return false
  const preset = value as TemplatePreset
  return preset.owner === owner && typeof preset.id === 'string' && typeof preset.name === 'string' && preset.name.length > 0 && preset.name.length <= 80 && typeof preset.templateId === 'string' && Number.isFinite(preset.createdAt) && validLayout(preset.layout)
}
/** All reads and writes include the account key, including deletion by id. */
export async function listPresets(owner: number): Promise<TemplatePreset[]> {
  assertOwner(owner)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).index('owner').getAll(IDBKeyRange.only(owner))
    tx.oncomplete = () => { db.close(); resolve((request.result as unknown[]).filter((value): value is TemplatePreset => validPreset(value, owner)).sort((a, b) => b.createdAt - a.createdAt).slice(0, PRESET_LIMIT)) }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('storageUnavailable')) }
  })
}
export async function savePreset(owner: number, name: string, project: TemplateProject): Promise<TemplatePreset> {
  assertOwner(owner)
  const cleanName = name.trim()
  if (!cleanName || cleanName.length > 80) throw new Error('invalidPresetName')
  const layout = extractLayout(project)
  if (!validLayout(layout)) throw new Error('invalidLayout')
  const record: TemplatePreset = { id: crypto.randomUUID(), owner, name: cleanName, templateId: project.templateId, createdAt: Date.now(), layout }
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    let full = false
    const count = store.index('owner').count(IDBKeyRange.only(owner))
    count.onsuccess = () => {
      if (count.result >= PRESET_LIMIT) { full = true; tx.abort(); return }
      store.add(record)
    }
    tx.oncomplete = () => { db.close(); resolve(record) }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error(full ? 'presetLimit' : 'storageUnavailable')) }
  })
}
export async function deletePreset(owner: number, id: string): Promise<void> {
  assertOwner(owner)
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.get(id)
    request.onsuccess = () => { if (request.result?.owner === owner) store.delete(id) }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = tx.onerror = () => { db.close(); reject(new Error('storageUnavailable')) }
  })
}
export function applyPreset(project: TemplateProject, preset: TemplatePreset, owner: number): TemplateProject {
  assertOwner(owner)
  if (!validPreset(preset, owner)) throw new Error('invalidLayout')
  return applyLayout(project, preset.layout)
}
