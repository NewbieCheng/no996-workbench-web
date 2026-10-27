export const DEFAULT_CHAT_MODEL_STORAGE_KEY = 'no996-default-chat-model'
export const DEFAULT_CHAT_MODEL_TTL_MS = 10 * 60 * 1000

export type DefaultChatModelCacheEntry = {
  model_code: string
  fetched_at: number
}

let defaultChatModelMemory: DefaultChatModelCacheEntry | null | undefined
let defaultChatModelInflight: Promise<string> | null = null

export function getDefaultChatModelMemory(): DefaultChatModelCacheEntry | null | undefined {
  return defaultChatModelMemory
}

export function setDefaultChatModelMemory(entry: DefaultChatModelCacheEntry | null | undefined): void {
  defaultChatModelMemory = entry
}

export function getDefaultChatModelInflight(): Promise<string> | null {
  return defaultChatModelInflight
}

export function setDefaultChatModelInflight(promise: Promise<string> | null): void {
  defaultChatModelInflight = promise
}

export function readSessionDefaultChatModel(): DefaultChatModelCacheEntry | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(DEFAULT_CHAT_MODEL_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DefaultChatModelCacheEntry
    if (!parsed?.model_code?.trim() || typeof parsed.fetched_at !== 'number') return null
    return { model_code: parsed.model_code.trim(), fetched_at: parsed.fetched_at }
  } catch {
    return null
  }
}

export function writeSessionDefaultChatModel(entry: DefaultChatModelCacheEntry): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(DEFAULT_CHAT_MODEL_STORAGE_KEY, JSON.stringify(entry))
  } catch {
    /* quota / private mode */
  }
}

export function isDefaultChatModelCacheFresh(entry: DefaultChatModelCacheEntry): boolean {
  return Date.now() - entry.fetched_at < DEFAULT_CHAT_MODEL_TTL_MS
}

export function invalidateDefaultChatModelCache(): void {
  defaultChatModelMemory = undefined
  defaultChatModelInflight = null
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(DEFAULT_CHAT_MODEL_STORAGE_KEY)
  }
}
