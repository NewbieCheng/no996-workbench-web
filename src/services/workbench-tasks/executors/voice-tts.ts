import { createSpeech } from '../../../api/tts'
import { resolveMediaUrl } from '../../../api/media'
import { sniffAudioMime } from '../../../lib/audio-mime'
import { ApiError } from '../../../api/errors'
import type { WorkbenchTaskRepository } from '../repository'
import type { IPVideoAudioPayload, VoiceTtsPayload, WorkbenchTaskRecord } from '../types'

export async function executeVoiceTts(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  onVoiceListStale?: () => Promise<unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as VoiceTtsPayload | IPVideoAudioPayload | undefined
  if (!payload) throw new Error('配音任务数据丢失')
  const checkCancelled = () => { if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError') }
  try {
    checkCancelled()
    const res = await createSpeech({ input: payload.text, voice: payload.voiceId,
      rate: 'speed' in payload ? payload.speed : payload.rate,
      volume: 'volume' in payload ? payload.volume : undefined,
      pitch: 'pitch' in payload ? payload.pitch : undefined,
      instruction: 'instruction' in payload ? payload.instruction : undefined,
    }, signal)
    checkCancelled()
    const mediaPath = res.url
    const upstreamAudioUrl = res.source_url?.trim()
    const response = await fetch(resolveMediaUrl(mediaPath), { credentials: 'include', signal })
    if (!response.ok) throw new Error(`音频拉取失败（${response.status}）`)
    const buf = await response.arrayBuffer()
    checkCancelled()
    const mime = sniffAudioMime(buf)
    await repo.putBlob({ id: job.id, mime, data: buf })
    checkCancelled()
    await repo.patchPayload(job.payloadId, { ...payload, mediaPath, ...(upstreamAudioUrl ? { upstreamAudioUrl } : {}) })
    checkCancelled()
    await repo.patchJob(job.id, { status: 'succeeded', finishedAt: Date.now(), blobId: job.id, audioByteLength: buf.byteLength })
    await repo.pruneForUser(job.ownerUserId)
  } catch (e) {
    checkCancelled()
    if (e instanceof ApiError && e.status === 500 && onVoiceListStale) await onVoiceListStale()
    throw e
  }
}
