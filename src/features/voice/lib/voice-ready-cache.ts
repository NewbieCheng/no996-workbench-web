const NOTIFIED_VOICES_STORAGE_KEY = 'no996:voice_ready_notified'
const HANDLED_CLONE_JOBS_STORAGE_KEY = 'no996:voice_clone_handled_jobs'

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage
  return null
}

function readSet(key: string): Set<string> {
  const storage = getStorage()
  if (!storage) return new Set()
  try {
    const raw = storage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? new Set(parsed.filter((item): item is string => typeof item === 'string')) : new Set()
  } catch {
    return new Set()
  }
}

function writeSet(key: string, set: Set<string>): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(key, JSON.stringify(Array.from(set)))
  } catch {
    // 忽略存储超限或受限异常
  }
}

/** 检查某音色是否已向用户弹出过可用提醒 */
export function isVoiceReadyNotified(voiceId?: string | null): boolean {
  if (!voiceId) return false
  return readSet(NOTIFIED_VOICES_STORAGE_KEY).has(voiceId)
}

/** 将一个或多个音色标记为已提醒可用，缓存于浏览器，避免重复打扰 */
export function markVoiceReadyNotified(voiceIds: string | string[]): void {
  const ids = Array.isArray(voiceIds) ? voiceIds : [voiceIds]
  const validIds = ids.filter(Boolean)
  if (!validIds.length) return
  const set = readSet(NOTIFIED_VOICES_STORAGE_KEY)
  for (const id of validIds) {
    set.add(id)
  }
  writeSet(NOTIFIED_VOICES_STORAGE_KEY, set)
}

/** 检查声音克隆后台任务是否已被前台处理并引导完成 */
export function isCloneJobHandled(jobId?: string | null): boolean {
  if (!jobId) return false
  return readSet(HANDLED_CLONE_JOBS_STORAGE_KEY).has(jobId)
}

/** 将声音克隆任务标记为已处理，防止每次进页面重复读取载荷与轮询 */
export function markCloneJobHandled(jobId?: string | null): void {
  if (!jobId) return
  const set = readSet(HANDLED_CLONE_JOBS_STORAGE_KEY)
  set.add(jobId)
  writeSet(HANDLED_CLONE_JOBS_STORAGE_KEY, set)
}
