import { createAgentClients } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { runTitlesFlow } from '../../../features/titles/agent/titles-flow'
import { createTitlesMockResponder } from '../../../features/titles/agent/demo-responder'
import type { WorkbenchTaskRepository } from '../repository'
import type { TitlesTaskPayload, WorkbenchTaskRecord } from '../types'

/**
 * 爆款标题执行器。
 *
 * 与 script_generate 同模式：编排在浏览器侧内调用（密钥不进浏览器），
 * 进度经 createTaskSink 回写 —— meta 存轻量进度，payload 存完整快照（供页面恢复）。
 */
export async function executeTitlesGenerate(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as TitlesTaskPayload | undefined
  if (!payload?.input) throw new Error('标题任务数据丢失')
  if (!payload.input.topic?.trim()) throw new Error('缺少主题，请重新提交。')

  const clients = createAgentClients({
    mockResponder: createTitlesMockResponder({
      topic: payload.input.topic,
      audience: payload.input.audience,
      platform: payload.input.platform,
    }),
  })
  let lastSignature = ''

  const sink = createTaskSink({
    patchMeta: async (meta) => {
      await repo.patchJob(job.id, { meta: { ...job.meta, ...meta } })
    },
    patchSnapshot: async (snapshot) => {
      // 只在阶段状态真正变化时写整份快照，避免频繁大对象写入
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

  const result = await runTitlesFlow({
    input: payload.input,
    chatAttachments: payload.chatAttachments,
    clients,
    sink,
    signal,
    resume:
      payload.resumeFromStageId && payload.run
        ? { fromStageId: payload.resumeFromStageId, snapshot: payload.run }
        : undefined,
  })

  const best = result.candidates.find((c) => c.isRecommended) ?? result.candidates[0]

  await repo.patchPayload(job.payloadId, result)
  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    meta: {
      ...job.meta,
      status: 'done',
      pct: '100',
      platform: payload.input.platform,
      round: String(result.review.rounds.length),
      fallback: result.fallback ? '1' : '0',
      usedMock: result.usedMock ? '1' : '0',
      score: String(best?.score ?? ''),
      pareto: String(result.candidates.filter((c) => c.isParetoOptimal).length),
    },
  })
}
