import { TalkTemplateError, templateScope, templateName, validateTalkTemplate, type TalkStyleTemplate } from './model.ts'

/** Independent from both editor projects and the legacy TemplateProject store. */
export const TALK_TEMPLATES_DB_NAME = 'no996-ip-talk-style-templates'
export const TALK_TEMPLATES_DB_VERSION = 1
const STORE = 'styles'
const MAX_TEMPLATES = 500
const DEADLINE_MS = 10_000
const changes = new Set<() => void>()
export function subscribeTalkTemplates(listener: () => void): () => void { changes.add(listener); return () => { changes.delete(listener) } }
function changed() { for (const listener of changes) listener() }
function storageFailure(error: DOMException | null): TalkTemplateError { return new TalkTemplateError(error?.name === 'ConstraintError' ? 'duplicateName' : error?.name === 'QuotaExceededError' ? 'storageFull' : 'storageFailed') }
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new TalkTemplateError('storageUnavailable')); return }
    let done = false
    const timer = setTimeout(() => { if (!done) { done = true; reject(new TalkTemplateError('storageBlocked')) } }, DEADLINE_MS)
    const request = indexedDB.open(TALK_TEMPLATES_DB_NAME, TALK_TEMPLATES_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.createObjectStore(STORE, { keyPath: ['scope', 'id'] })
      store.createIndex('scope', 'scope')
      store.createIndex('scopeName', ['scope', 'nameKey'], { unique: true })
    }
    request.onerror = () => { clearTimeout(timer); if (!done) { done = true; reject(storageFailure(request.error)) } }
    request.onblocked = () => { clearTimeout(timer); if (!done) { done = true; reject(new TalkTemplateError('storageBlocked')) } }
    request.onsuccess = () => {
      clearTimeout(timer)
      const db = request.result
      db.onversionchange = () => db.close()
      if (done) { db.close(); return }
      done = true; resolve(db)
    }
  })
}
async function transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void, fail: (error: unknown) => void) => void): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      let value: T, ready = false, error: unknown
      const timer = setTimeout(() => { error = new TalkTemplateError('storageBlocked'); tx.abort() }, DEADLINE_MS)
      const fail = (failure: unknown) => { error = failure; tx.abort() }
      tx.oncomplete = () => { clearTimeout(timer); ready ? resolve(value) : reject(new TalkTemplateError('storageFailed')) }
      tx.onabort = () => { clearTimeout(timer); reject(error ?? storageFailure(tx.error)) }
      tx.onerror = event => { error ??= storageFailure((event.target as IDBRequest | null)?.error ?? tx.error) }
      try { work(tx.objectStore(STORE), next => { value = next; ready = true }, fail) } catch (failure) { fail(failure) }
    })
  } finally { db.close() }
}
export async function listTalkTemplates(owner: number): Promise<TalkStyleTemplate[]> {
  const scope = templateScope(owner)
  return transaction('readonly', (store, result, fail) => {
    const request = store.index('scope').getAll(IDBKeyRange.only(scope), MAX_TEMPLATES + 1)
    request.onsuccess = () => {
      try {
        if (request.result.length > MAX_TEMPLATES) throw new TalkTemplateError('libraryFull')
        result(request.result.map(item => validateTalkTemplate(item, owner)).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)))
      } catch (failure) { fail(failure) }
    }
  })
}
export async function getTalkTemplate(owner: number, id: string): Promise<TalkStyleTemplate> {
  const scope = templateScope(owner)
  return transaction('readonly', (store, result, fail) => {
    const request = store.get([scope, id])
    request.onsuccess = () => { try { if (!request.result) throw new TalkTemplateError('missingTemplate'); result(validateTalkTemplate(request.result, owner)) } catch (failure) { fail(failure) } }
  })
}
export async function saveTalkTemplate(owner: number, template: TalkStyleTemplate): Promise<void> {
  const value = validateTalkTemplate(template, owner)
  await transaction<void>('readwrite', (store, result, fail) => {
    const count = store.index('scope').count(IDBKeyRange.only(templateScope(owner)))
    count.onsuccess = () => {
      if (count.result >= MAX_TEMPLATES) { fail(new TalkTemplateError('libraryFull')); return }
      // add, never put: matching ids/names must fail, never replace an existing style.
      store.add(value).onsuccess = () => result(undefined)
    }
  })
  changed()
}
export async function renameTalkTemplate(owner: number, id: string, revision: number, name: string): Promise<void> {
  const scope = templateScope(owner), named = templateName(name)
  await transaction<void>('readwrite', (store, result, fail) => {
    const request = store.get([scope, id])
    request.onsuccess = () => {
      try {
        if (!request.result) throw new TalkTemplateError('missingTemplate')
        const current = validateTalkTemplate(request.result, owner)
        if (current.revision !== revision) throw new TalkTemplateError('staleTemplate')
        const next = validateTalkTemplate({ ...current, ...named, revision: current.revision + 1, updatedAt: Math.max(Date.now(), current.updatedAt) }, owner)
        store.put(next).onsuccess = () => result(undefined)
      } catch (failure) { fail(failure) }
    }
  })
  changed()
}
export async function deleteTalkTemplate(owner: number, id: string, revision: number): Promise<void> {
  const scope = templateScope(owner)
  await transaction<void>('readwrite', (store, result, fail) => {
    const request = store.get([scope, id])
    request.onsuccess = () => {
      try {
        if (!request.result) throw new TalkTemplateError('missingTemplate')
        const current = validateTalkTemplate(request.result, owner)
        if (current.revision !== revision) throw new TalkTemplateError('staleTemplate')
        store.delete([scope, id]).onsuccess = () => result(undefined)
      } catch (failure) { fail(failure) }
    }
  })
  changed()
}
