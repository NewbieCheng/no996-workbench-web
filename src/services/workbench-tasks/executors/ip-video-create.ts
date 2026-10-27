import { createAgentClients, throwIfAborted, type AgentClients } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { runTalkCreationFlow } from '../../../features/ip-video/agent/video-assembly-flow'
import type { WorkbenchTaskRepository } from '../repository'
import type { IPVideoCreatePayload, WorkbenchTaskRecord } from '../types'

/** Produces a plan only. Applying it and any audio work belong to the page. */
export async function executeIPVideoCreate(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
  isCurrentOwner: () => boolean = () => false,
): Promise<void> {
  const assertActive = async () => {
    throwIfAborted(signal)
    if (!isCurrentOwner()) throw new DOMException('当前账号已变更，创作任务已暂停。', 'AbortError')
    const fresh = await repo.getJob(job.id)
    throwIfAborted(signal)
    if (!isCurrentOwner() || !fresh || fresh.ownerUserId !== job.ownerUserId || fresh.kind !== 'ip_video_create' || fresh.status !== 'running') {
      throw new DOMException('创作任务已停止或不属于当前账号。', 'AbortError')
    }
    return fresh
  }
  await assertActive()
  const record = await repo.getPayload(job.payloadId)
  const payload = record?.data as IPVideoCreatePayload | undefined
  if (record?.kind !== 'ip_video_create' || !payload?.input) throw new Error('IP 视频创作任务数据丢失。')
  if (payload.input.document.scope !== String(job.ownerUserId) || payload.input.document.id !== job.meta?.projectId) {
    throw new Error('创作任务的工程或账号不匹配。')
  }

  // A persisted result is authoritative for this job: recovery must not repeat
  // model calls just because the final job-status write was interrupted.
  if (!payload.result) {
    const fresh = await assertActive()
    if (fresh.meta?.creationAttempted === '1' || payload.run) {
      throw new Error('上次创作已开始但没有完整保存结果。当前流程不支持断点续跑，已停止自动重跑以避免重复计费。请查看历史过程并确认后再发起新任务。')
    }
    const baseClients = createAgentClients()
    if (baseClients.isMock) throw new Error('演示模式不执行正式队列任务，请在页面内运行演示创作。')
    const baseSearch = baseClients.search
    const clients: AgentClients = {
      ...baseClients,
      chat: {
        async complete(request) {
          await assertActive()
          return baseClients.chat.complete(request)
        },
      },
      search: baseSearch ? {
        async search(query, requestSignal) {
          await assertActive()
          return baseSearch.search(query, requestSignal)
        },
      } : undefined,
    }

    // Durable marker BEFORE any paid request. Even a crash before the first
    // stage snapshot must fail closed rather than silently charge again.
    await repo.patchJob(job.id, { meta: { ...fresh.meta, creationAttempted: '1' } })
    await assertActive()
    let lastSignature = ''
    const sink = createTaskSink({
      patchMeta: async meta => {
        const current = await assertActive()
        await repo.patchJob(job.id, { meta: { ...current.meta, ...meta } })
      },
      patchSnapshot: async run => {
        await assertActive()
        const signature = `${run.status}:${run.error ?? ''}:${snapshotProgressSignature(run)}`
        if (signature === lastSignature) return
        await repo.patchPayload(job.payloadId, { ...payload, run })
        payload.run = run
        lastSignature = signature
      },
    })
    const result = await runTalkCreationFlow({ input: payload.input, clients, sink, signal })
    await assertActive()
    payload.result = result
    payload.run = result.run
    await repo.patchPayload(job.payloadId, payload)
  }

  const fresh = await assertActive()
  await repo.patchJob(job.id, {
    status: 'succeeded', finishedAt: Date.now(), errorMessage: undefined,
    meta: { ...fresh.meta, status: 'done', pct: '100' },
  })
}
