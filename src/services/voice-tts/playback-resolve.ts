import { getCachedPlaybackUrl, setCachedPlaybackUrl } from './playback-cache.ts'

const inflightByJobId = new Map<string, Promise<string>>()

export function resolvePlaybackUrlDeduped(jobId: string, resolve: () => Promise<string>): Promise<string> {
  const cached = getCachedPlaybackUrl(jobId)
  if (cached) return Promise.resolve(cached)

  const inflight = inflightByJobId.get(jobId)
  if (inflight) return inflight

  const promise = (async () => {
    const url = await resolve()
    if (url.startsWith('blob:')) {
      setCachedPlaybackUrl(jobId, url)
    }
    return url
  })().finally(() => {
    inflightByJobId.delete(jobId)
  })

  inflightByJobId.set(jobId, promise)
  return promise
}
