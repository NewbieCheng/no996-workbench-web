import { resolveMediaUrl } from '../../api/media.ts'
import { sniffAudioMime } from '../../lib/audio-mime.ts'
import { isEmbeddablePlaybackUrl, upgradeInsecureMediaUrl } from '../../lib/secure-media-url.ts'
import type { WorkbenchTaskRepository } from './repository.ts'
import type { VoiceTtsPayload, WorkbenchTaskRecord } from './types.ts'

export async function getVoiceUpstreamAudioUrl(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  if (task.kind !== 'voice_tts' && task.kind !== 'ip_video_audio') return ''
  const payloadRec = await repo.getPayload(task.payloadId)
  const payload = payloadRec?.data as VoiceTtsPayload | undefined
  const raw = payload?.upstreamAudioUrl?.trim()
  return raw ?? ''
}

export async function resolveVoicePlaybackUrl(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  if ((task.kind !== 'voice_tts' && task.kind !== 'ip_video_audio') || task.status !== 'succeeded') return ''

  const payloadRec = await repo.getPayload(task.payloadId)
  const payload = payloadRec?.data as VoiceTtsPayload | undefined

  if (task.blobId) {
    const blob = await repo.getBlob(task.blobId)
    if (blob?.data) {
      const data = blob.data instanceof Blob ? await blob.data.arrayBuffer() : blob.data
      if (data.byteLength > 0) {
        const mime = blob.mime || sniffAudioMime(data)
        return URL.createObjectURL(new Blob([data], { type: mime }))
      }
    }
  }

  if (payload?.mediaPath) {
    const sameOrigin = resolveMediaUrl(payload.mediaPath)
    if (sameOrigin && isEmbeddablePlaybackUrl(sameOrigin)) return sameOrigin
  }

  const upstream = payload?.upstreamAudioUrl?.trim()
  if (upstream?.startsWith('http://') || upstream?.startsWith('https://')) {
    const upgraded = upgradeInsecureMediaUrl(upstream)
    if (isEmbeddablePlaybackUrl(upgraded)) return upgraded
  }

  return ''
}

/** Remote HTTPS / same-origin URL for in-page playback when blob fails (not blob). */
export async function resolveVoiceEmbedFallbackUrl(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  if ((task.kind !== 'voice_tts' && task.kind !== 'ip_video_audio') || task.status !== 'succeeded') return ''

  const payloadRec = await repo.getPayload(task.payloadId)
  const payload = payloadRec?.data as VoiceTtsPayload | undefined

  const upstream = payload?.upstreamAudioUrl?.trim()
  if (upstream?.startsWith('http://') || upstream?.startsWith('https://')) {
    const upgraded = upgradeInsecureMediaUrl(upstream)
    if (isEmbeddablePlaybackUrl(upgraded)) return upgraded
  }

  if (payload?.mediaPath) {
    const sameOrigin = resolveMediaUrl(payload.mediaPath)
    if (sameOrigin && isEmbeddablePlaybackUrl(sameOrigin)) return sameOrigin
  }

  return ''
}

/** Download prefers vendor OSS / same-origin media over ephemeral blob URLs. */
export async function resolveVoiceDownloadUrl(
  repo: WorkbenchTaskRepository,
  task: WorkbenchTaskRecord,
): Promise<string> {
  if ((task.kind !== 'voice_tts' && task.kind !== 'ip_video_audio') || task.status !== 'succeeded') return ''

  const payloadRec = await repo.getPayload(task.payloadId)
  const payload = payloadRec?.data as VoiceTtsPayload | undefined

  const upstream = payload?.upstreamAudioUrl?.trim()
  if (upstream?.startsWith('http://') || upstream?.startsWith('https://')) {
    return upgradeInsecureMediaUrl(upstream)
  }

  if (payload?.mediaPath) {
    const sameOrigin = resolveMediaUrl(payload.mediaPath)
    if (sameOrigin) return sameOrigin
  }

  return resolveVoicePlaybackUrl(repo, task)
}
