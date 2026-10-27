import { createAgentClients } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { createSpeech } from '../../../api/tts'
import { resolveMediaUrl } from '../../../api/media'
import { sniffAudioMime } from '../../../lib/audio-mime'
import { ApiError } from '../../../api/errors'
import { concatWavBuffers } from '../../../lib/audio/concat-wav'
import { runVoiceAdvancedFlow } from '../../../features/voice/agent/voice-advanced-flow'
import { createVoiceDubMockResponder } from '../../../features/voice/agent/demo-responder'
import type { WorkbenchTaskRepository } from '../repository'
import type { VoiceDubAdvancedPayload, WorkbenchTaskRecord } from '../types'
import type { VoiceDubSegment } from '../../../features/voice/agent/types'

async function fetchAudioBuffer(absUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(absUrl, { credentials: 'include' })
  if (!res.ok) throw new Error(`分段音频拉取失败（${res.status}）`)
  return res.arrayBuffer()
}

export async function executeVoiceDubAdvanced(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
  onVoiceListStale?: () => Promise<unknown>,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as VoiceDubAdvancedPayload | undefined
  if (!payload?.config) throw new Error('高阶配音任务数据丢失')

  const clients = createAgentClients({
    mockResponder: createVoiceDubMockResponder({
      documentText: payload.config.documentText,
      globalVoiceLabel: payload.config.globalVoiceLabel,
    }),
  })

  let lastSignature = ''
  const sink = createTaskSink({
    patchMeta: async (meta) => {
      await repo.patchJob(job.id, { meta: { ...job.meta, ...meta } })
    },
    patchSnapshot: async (snapshot) => {
      const signature = snapshotProgressSignature(snapshot)
      if (signature === lastSignature) return
      lastSignature = signature
      await repo.patchPayload(job.payloadId, { ...payload, run: snapshot })
    },
    isCancelled: async () => {
      const fresh = await repo.getJob(job.id)
      return fresh?.status === 'cancelled'
    },
  })

  const collectedBuffers: ArrayBuffer[] = []

  const synthesizeSegment = async (
    segment: VoiceDubSegment,
    index: number,
    total: number,
  ): Promise<{ audioBuffer: ArrayBuffer }> => {
    await repo.patchJob(job.id, {
      meta: {
        ...job.meta,
        phase: 'tts',
        segIndex: String(index + 1),
        segTotal: String(total),
        pct: String(Math.round(((index + 1) / total) * 100)),
      },
    })

    if (clients.isMock) {
      // Mock synthesis: returns a dummy valid WAV
      const dummy = new ArrayBuffer(44)
      return { audioBuffer: dummy }
    }

    try {
      const res = await createSpeech({
        input: segment.text,
        voice: segment.voiceId || payload.config.globalVoiceId,
        rate: payload.config.rate,
        volume: payload.config.volume,
        pitch: payload.config.pitch,
        instruction: segment.instruction?.trim() || undefined,
      })

      const absUrl = resolveMediaUrl(res.url)
      const buf = await fetchAudioBuffer(absUrl)
      collectedBuffers.push(buf)

      const segBlobId = `blob_${job.id}_${segment.id}`
      const mime = sniffAudioMime(buf)
      await repo.putBlob({ id: segBlobId, mime, data: buf })
      segment.blobId = segBlobId
      segment.audioUrl = absUrl

      return { audioBuffer: buf }
    } catch (e) {
      if (e instanceof ApiError && e.status === 500 && onVoiceListStale) {
        await onVoiceListStale()
      }
      throw e
    }
  }

  const result = await runVoiceAdvancedFlow({
    config: payload.config,
    clients,
    sink,
    signal,
    confirmedSegments: payload.segments?.length ? payload.segments : undefined,
    resume:
      payload.resumeFromStageId && payload.run
        ? { fromStageId: payload.resumeFromStageId, snapshot: payload.run }
        : undefined,
    synthesizeSegment,
    onStageChange: async (stageId) => {
      if (stageId === 'segment_planner') {
        await repo.patchJob(job.id, {
          meta: {
            ...job.meta,
            phase: 'plan',
          },
        })
      }
    },
    onPlannerBatchesTotal: async (total) => {
      await repo.patchJob(job.id, {
        meta: {
          ...job.meta,
          planner_batches_total: String(total),
        },
      })
    },
    onPlannerCheckpoint: async (checkpoint) => {
      await repo.patchJob(job.id, {
        meta: {
          ...job.meta,
          planner_batch_states: JSON.stringify(checkpoint.planner_batch_states ?? []),
        },
      })
    },
    onPlanBatch: async (current, total) => {
      await repo.patchJob(job.id, {
        meta: {
          ...job.meta,
          plan_batch: `${current}/${total}`,
        },
      })
    },
  })

  if (result.awaitingConfirm) {
    // 方案已规划完成，等待用户在界面确认修改
    await repo.patchPayload(job.payloadId, {
      ...payload,
      title: result.title,
      segments: result.segments,
      run: result.run,
      awaitingConfirm: true,
      usedMock: result.usedMock,
    })
    await repo.patchJob(job.id, {
      status: 'succeeded',
      finishedAt: Date.now(),
      meta: {
        ...job.meta,
        phase: 'awaiting_confirm',
        awaiting_confirm: '1',
        segmentsCount: String(result.segments.length),
        segments_warning: result.segmentsWarning ? '1' : '0',
        plan_batch: '',
      },
    })
    return
  }

  // 完整配音已完成，进行合并与落盘
  let mergedBuf: ArrayBuffer | null = null
  if (collectedBuffers.length > 0) {
    try {
      mergedBuf = concatWavBuffers(collectedBuffers)
    } catch (err) {
      console.warn('WAV 拼接失败，降级为第一段音频', err)
      mergedBuf = collectedBuffers[0]
    }
  }

  if (mergedBuf && mergedBuf.byteLength > 0) {
    const mime = sniffAudioMime(mergedBuf)
    await repo.putBlob({ id: job.id, mime, data: mergedBuf })
  }

  await repo.patchPayload(job.payloadId, {
    ...payload,
    title: result.title,
    segments: result.segments,
    mergedBlobId: job.id,
    run: result.run,
    awaitingConfirm: false,
    usedMock: result.usedMock,
  })

  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    blobId: mergedBuf && mergedBuf.byteLength > 0 ? job.id : undefined,
    audioByteLength: mergedBuf?.byteLength,
    meta: {
      ...job.meta,
      phase: 'done',
      status: 'done',
      pct: '100',
      segmentsCount: String(result.segments.length),
      totalDuration: String(result.totalDurationSeconds ?? 0),
    },
  })
}
