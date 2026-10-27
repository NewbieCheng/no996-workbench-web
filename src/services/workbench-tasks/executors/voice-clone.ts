import { createVoice } from '../../../api/voice-clone'
import type { WorkbenchTaskRepository } from '../repository'
import type { VoiceClonePayload, WorkbenchTaskRecord } from '../types'

export async function executeVoiceClone(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  onVoiceListStale?: () => Promise<unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as VoiceClonePayload | undefined
  if (!payload) throw new Error('声音克隆任务数据丢失')

  const checkCancelled = () => {
    if (signal?.aborted) throw new DOMException('任务已取消', 'AbortError')
  }

  checkCancelled()
  const blobRec = await repo.getBlob(payload.sampleBlobId)
  if (!blobRec) throw new Error('克隆样本音频丢失，请重新录制后提交。')

  const file = new File([blobRec.data], payload.fileName, { type: payload.mimeType || blobRec.mime })
  const form = new FormData()
  form.append('display_name', payload.displayName.slice(0, 32))
  form.append('language_hint', payload.languageHint || 'zh')
  form.append('audio', file)

  checkCancelled()
  const created = await createVoice(form)
  checkCancelled()

  await repo.patchPayload(job.payloadId, { ...payload, createdVoice: created })
  const points =
    created.points_charged != null ? String(created.points_charged) : undefined
  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    subtitle: created.ready_for_synthesis ? '已可用' : '审核中',
    meta: {
      voice_id: created.voice_id,
      display_name: created.display_name,
      ...(points ? { points_charged: points } : {}),
      ready: created.ready_for_synthesis ? '1' : '0',
    },
  })
  await repo.pruneForUser(job.ownerUserId)
  if (onVoiceListStale) await onVoiceListStale()
}
