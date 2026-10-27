import { createAgentClients } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { isMomentsFlowError } from '../../../features/moments/agent/errors'
import { createMomentsCopyMockResponder } from '../../../features/moments/agent/demo-responder'
import { createMomentsPlanMockResponder } from '../../../features/moments/agent/demo-responder'
import { runMomentsCopyFlow } from '../../../features/moments/agent/copy-flow'
import { runMomentsPlanFlow } from '../../../features/moments/agent/plan-flow'
import type { MomentsCopyTaskPayload, MomentsPlanTaskPayload } from '../../../features/moments/agent/types'
import {
  replaceContentVersions,
  savePlan,
  setItemGenerationStatus,
  upsertDayContents,
} from '../../../features/moments/service/moments-store'
import type { WorkbenchTaskRepository } from '../repository'
import type { WorkbenchTaskRecord } from '../types'

async function failJob(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  error: unknown,
): Promise<never> {
  const fresh = await repo.getJob(job.id)
  if (fresh?.status === 'cancelled') throw error instanceof Error ? error : new Error(String(error))
  const message = error instanceof Error ? error.message : String(error)
  const code = isMomentsFlowError(error) ? error.code : 'ERROR'
  await repo.patchJob(job.id, {
    status: 'failed',
    finishedAt: Date.now(),
    errorMessage: message,
    meta: { ...job.meta, status: 'failed', pct: '100', errorCode: code },
  })
  throw error instanceof Error ? error : new Error(message)
}

export async function executeMomentsPlan(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as MomentsPlanTaskPayload | undefined
  if (!payload?.input) throw new Error('朋友圈规划任务数据丢失')

  const clients = createAgentClients({
    mockResponder: createMomentsPlanMockResponder(payload.input),
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

  try {
    const result = await runMomentsPlanFlow({
      input: payload.input,
      clients,
      sink,
      signal,
      resume:
        payload.resumeFromStageId && payload.run
          ? { fromStageId: payload.resumeFromStageId, snapshot: payload.run }
          : undefined,
    })
    if (signal?.aborted || (await repo.getJob(job.id))?.status === 'cancelled') throw new DOMException('Aborted', 'AbortError')
    await savePlan(payload.input, result.days)
    await repo.patchPayload(job.payloadId, {
      ...payload,
      days: result.days,
      run: result.run,
      usedMock: result.usedMock,
    })
    await repo.patchJob(job.id, {
      status: 'succeeded',
      finishedAt: Date.now(),
      meta: {
        ...job.meta,
        status: 'done',
        pct: '100',
        usedMock: result.usedMock ? '1' : '0',
        dayCount: String(result.days.length),
      },
    })
  } catch (error) {
    await failJob(repo, job, error)
  }
}

export async function executeMomentsCopy(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as MomentsCopyTaskPayload | undefined
  if (!payload?.input) throw new Error('朋友圈文案任务数据丢失')

  const clients = createAgentClients({
    mockResponder: createMomentsCopyMockResponder(payload.input),
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

  const rewrite = payload.input.rewrite
  try {
    if (!rewrite) {
      for (const item of payload.input.items) {
        await setItemGenerationStatus(item.id, 'generating')
      }
    }
    const result = await runMomentsCopyFlow({
      input: payload.input,
      clients,
      sink,
      signal,
      resume:
        payload.resumeFromStageId && payload.run
          ? { fromStageId: payload.resumeFromStageId, snapshot: payload.run }
          : undefined,
    })
    if (rewrite) {
      const draft = result.drafts.find((row) => row.scheduleItemId === rewrite.scheduleItemId) ?? result.drafts[0]
      if (draft) {
        await replaceContentVersions(rewrite.contentId, draft, rewrite.currentVersion, result.usedMock)
      }
    } else {
      await upsertDayContents(payload.input.weekId, result.drafts, result.usedMock)
    }
    await repo.patchPayload(job.payloadId, {
      ...payload,
      drafts: result.drafts,
      run: result.run,
      usedMock: result.usedMock,
    })
    await repo.patchJob(job.id, {
      status: 'succeeded',
      finishedAt: Date.now(),
      meta: {
        ...job.meta,
        status: 'done',
        pct: '100',
        usedMock: result.usedMock ? '1' : '0',
        itemCount: String(result.drafts.length),
      },
    })
  } catch (error) {
    if (!rewrite) {
      for (const item of payload.input.items) {
        await setItemGenerationStatus(item.id, 'failed', error instanceof Error ? error.message : String(error)).catch(
          () => undefined,
        )
      }
    }
    await failJob(repo, job, error)
  }
}
