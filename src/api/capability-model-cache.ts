import { invalidateDefaultChatModelCache } from './default-chat-model-cache'

export const CAPABILITY_MODEL_TTL_MS = 10 * 60 * 1000

export const DEFAULT_TTS_MODEL_STORAGE_KEY = 'no996-default-tts-model'
export const DEFAULT_LIPSYNC_MODEL_STORAGE_KEY = 'no996-default-lipsync-model'
export const DEFAULT_VISION_MODEL_STORAGE_KEY = 'no996-default-vision-model'

export type CachedModelCode = {
  model_code: string
  fetched_at: number
}

export type CachedTtsConfig = {
  model_code: string
  default_voice: string
  platform_voices: Array<{ id: string; label: string }>
  fetched_at: number
}

let ttsMemory: CachedTtsConfig | null | undefined
let ttsInflight: Promise<CachedTtsConfig> | null = null

let lipsyncMemory: CachedModelCode | null | undefined
let lipsyncInflight: Promise<string> | null = null

let visionMemory: CachedModelCode | null | undefined
let visionInflight: Promise<string> | null = null

export function isCapabilityCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CAPABILITY_MODEL_TTL_MS
}

export function readSessionJson<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode */
  }
}

export function getTtsMemory(): CachedTtsConfig | null | undefined {
  return ttsMemory
}

export function setTtsMemory(entry: CachedTtsConfig | null | undefined): void {
  ttsMemory = entry
}

export function getTtsInflight(): Promise<CachedTtsConfig> | null {
  return ttsInflight
}

export function setTtsInflight(promise: Promise<CachedTtsConfig> | null): void {
  ttsInflight = promise
}

export function getLipsyncMemory(): CachedModelCode | null | undefined {
  return lipsyncMemory
}

export function setLipsyncMemory(entry: CachedModelCode | null | undefined): void {
  lipsyncMemory = entry
}

export function getLipsyncInflight(): Promise<string> | null {
  return lipsyncInflight
}

export function setLipsyncInflight(promise: Promise<string> | null): void {
  lipsyncInflight = promise
}

export function getVisionMemory(): CachedModelCode | null | undefined {
  return visionMemory
}

export function setVisionMemory(entry: CachedModelCode | null | undefined): void {
  visionMemory = entry
}

export function getVisionInflight(): Promise<string> | null {
  return visionInflight
}

export function setVisionInflight(promise: Promise<string> | null): void {
  visionInflight = promise
}

export function invalidateAllDefaultModelCaches(): void {
  invalidateDefaultChatModelCache()
  invalidateCapabilityModelCaches()
}

export function invalidateCapabilityModelCaches(): void {
  // Lazy import avoids cycle: catalog resets when TTS cache clears.
  void import('./platform-voice-catalog').then((m) => m.resetPlatformVoiceCatalog())
  ttsMemory = undefined
  ttsInflight = null
  lipsyncMemory = undefined
  lipsyncInflight = null
  visionMemory = undefined
  visionInflight = null
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(DEFAULT_TTS_MODEL_STORAGE_KEY)
  sessionStorage.removeItem(DEFAULT_LIPSYNC_MODEL_STORAGE_KEY)
  sessionStorage.removeItem(DEFAULT_VISION_MODEL_STORAGE_KEY)
}
