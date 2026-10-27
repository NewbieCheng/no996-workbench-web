import type { TtsParams } from '../hooks/useTtsSession'
import { voicePreviewText } from '../voice-constants'

/** 平台 `/media/…` 与上游 OSS 直链约 24h 失效，缓存略短于 24h 主动过期。 */
export const VOICE_PREVIEW_CACHE_TTL_MS = 23 * 60 * 60 * 1000

type CacheEntry = {
  url: string
  cachedAt: number
}

const cache = new Map<string, CacheEntry>()

export function voicePreviewCacheKey(voiceId: string, params: TtsParams): string {
  const instruction = params.instruction?.trim() ?? ''
  return `${voiceId}|${voicePreviewText()}|${params.rate}|${params.volume}|${params.pitch}|${instruction}`
}

function isExpired(entry: CacheEntry): boolean {
  return Date.now() - entry.cachedAt > VOICE_PREVIEW_CACHE_TTL_MS
}

export function getVoicePreviewCachedUrl(key: string): string | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (isExpired(entry)) {
    cache.delete(key)
    return undefined
  }
  return entry.url
}

export function setVoicePreviewCachedUrl(key: string, url: string) {
  cache.set(key, { url, cachedAt: Date.now() })
}

export function evictVoicePreviewCacheKey(key: string) {
  cache.delete(key)
}

export function evictVoicePreviewCache(voiceId: string) {
  const prefix = `${voiceId}|`
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

const PLAYBACK_FAILED = 'VOICE_PREVIEW_PLAYBACK_FAILED'

/** 加载并播放；资源 404/解码失败时 reject，供外层清缓存后重新合成。 */
export async function playVoicePreviewOnAudio(el: HTMLAudioElement, url: string): Promise<void> {
  el.src = url
  el.load()

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const fail = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error(PLAYBACK_FAILED))
    }
    const succeed = () => {
      if (settled) return
      settled = true
      cleanup()
      void el.play().then(
        () => resolve(),
        (err) => reject(err instanceof Error ? err : new Error(PLAYBACK_FAILED)),
      )
    }
    const cleanup = () => {
      el.removeEventListener('error', fail)
      el.removeEventListener('canplaythrough', succeed)
      el.removeEventListener('loadeddata', succeed)
    }

    el.addEventListener('error', fail, { once: true })
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      succeed()
      return
    }
    el.addEventListener('canplaythrough', succeed, { once: true })
    el.addEventListener('loadeddata', succeed, { once: true })
  })
}

export function isVoicePreviewPlaybackError(err: unknown): boolean {
  return err instanceof Error && err.message === PLAYBACK_FAILED
}
