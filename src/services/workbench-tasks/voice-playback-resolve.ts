import { getCachedPlaybackUrl, setCachedPlaybackUrl } from './playback-cache.ts'

const inflightByTaskId = new Map<string, Promise<string>>()

/** Dedupe concurrent playback URL resolution so only one blob URL is created per task. */
export function resolveVoicePlaybackUrlDeduped(
  taskId: string,
  resolve: () => Promise<string>,
): Promise<string> {
  const cached = getCachedPlaybackUrl(taskId)
  if (cached) return Promise.resolve(cached)

  const inflight = inflightByTaskId.get(taskId)
  if (inflight) return inflight

  const promise = (async () => {
    const url = await resolve()
    if (url.startsWith('blob:')) {
      setCachedPlaybackUrl(taskId, url)
    }
    return url
  })().finally(() => {
    inflightByTaskId.delete(taskId)
  })

  inflightByTaskId.set(taskId, promise)
  return promise
}
