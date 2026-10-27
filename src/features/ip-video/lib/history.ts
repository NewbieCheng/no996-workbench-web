import type { SubtitleStyle, TemplateProject } from './template-project'

export type IPVideoHistory = {
  id: string; ownerUserId: number; createdAt: number; title: string; templateId: string
  script: string; voiceLabel: string; speed: number; duration: number; demo: boolean
  cover: Blob; audio?: Blob; video: Blob; subtitleStyle: SubtitleStyle
  templateProject?: TemplateProject; sourcePhoto?: Blob
}
export type SavedIPCover = { id: string; ownerUserId: number; title: string; blob: Blob; uses: number; createdAt: number; sourcePhoto?: Blob; editableTitle?: string; coverStyle?: string }
const DB_NAME = 'no996-workbench-ip-video'
const MAX_VIDEO_BYTES = 250 * 1024 * 1024
const MAX_VIDEOS = 12

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      for (const name of ['videos', 'covers']) { const store = request.result.createObjectStore(name, { keyPath: 'id' }); store.createIndex('ownerUserId', 'ownerUserId') }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('本机历史存储不可用'))
    request.onblocked = () => reject(new Error('本机历史存储被其他标签页占用，请关闭其他工作台标签页。'))
  })
}
async function readAll<T>(storeName: string, ownerUserId: number): Promise<T[]> {
  const db = await openDatabase()
  try { return await new Promise<T[]>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).index('ownerUserId').getAll(ownerUserId)
    request.onsuccess = () => resolve(request.result as T[]); request.onerror = () => reject(request.error)
  }) } finally { db.close() }
}
async function mutate(storeName: string, fn: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDatabase()
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite'); fn(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error('存储已取消'))
  }) } finally { db.close() }
}
export async function listIPVideos(owner: number): Promise<IPVideoHistory[]> { return (await readAll<IPVideoHistory>('videos', owner)).sort((a, b) => b.createdAt - a.createdAt) }
export async function listIPCovers(owner: number): Promise<SavedIPCover[]> { return (await readAll<SavedIPCover>('covers', owner)).sort((a, b) => b.createdAt - a.createdAt) }
export async function saveIPVideo(record: IPVideoHistory): Promise<void> {
  if (record.video.size + record.cover.size + (record.audio?.size ?? 0) + (record.sourcePhoto?.size ?? 0) > MAX_VIDEO_BYTES) throw new Error('成片超过本机历史容量，请先下载保存。')
  const old = (await listIPVideos(record.ownerUserId)).filter(item => item.id !== record.id)
  let bytes = record.video.size + record.cover.size + (record.audio?.size ?? 0) + (record.sourcePhoto?.size ?? 0)
  const keep: IPVideoHistory[] = []
  for (const item of old) { const size = item.video.size + item.cover.size + (item.audio?.size ?? 0) + (item.sourcePhoto?.size ?? 0); if (keep.length < MAX_VIDEOS - 1 && bytes + size <= MAX_VIDEO_BYTES) { keep.push(item); bytes += size } }
  const keepIds = new Set(keep.map(item => item.id))
  await mutate('videos', store => { for (const item of old) if (!keepIds.has(item.id)) store.delete(item.id); store.put(record) })
}
export async function saveIPCover(record: SavedIPCover): Promise<void> {
  const old = (await listIPCovers(record.ownerUserId)).filter(item => item.id !== record.id)
  await mutate('covers', store => { for (const item of old.slice(23)) store.delete(item.id); store.put(record) })
}
export async function deleteIPVideo(id: string, owner: number): Promise<void> {
  const records = await listIPVideos(owner); if (records.some(item => item.id === id)) await mutate('videos', store => { store.delete(id) })
}
