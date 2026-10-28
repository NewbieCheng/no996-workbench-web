import { createAgentClients } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { runScriptFlow } from '../../../features/script-lab/agent/script-flow'
import { createScriptMockResponder } from '../../../features/script-lab/agent/demo-responder'
import { scriptTaskTitle } from '../../../features/script-lab/agent/task-meta'
import type { WorkbenchTaskRepository } from '../repository'
import type { ScriptTaskPayload, WorkbenchTaskRecord } from '../types'

/**
 * 脚本生成执行器。
 *
 * 关键点：编排在浏览器侧内调用（与 persona_generate 同模式），密钥不进浏览器；
 * 进度通过 createTaskSink 回写任务记录 —— meta 存轻量进度（供列表与进度条），
 * payload 存完整快照（供页面刷新后恢复详细过程）。
 */
export async function executeScriptGenerate(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as ScriptTaskPayload | undefined
  if (!payload?.config) throw new Error('脚本任务数据丢失')
  if (!payload.config.product?.trim()) throw new Error('缺少产品名，请重新提交。')

  const clients = createAgentClients({
    mockResponder: createScriptMockResponder({
      product: payload.config.product,
      mode: payload.config.mode,
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

  const result = await runScriptFlow({
    config: payload.config,
    chatAttachments: payload.chatAttachments,
    clients,
    sink,
    signal,
    resume:
      payload.resumeFromStageId && payload.run
        ? { fromStageId: payload.resumeFromStageId, snapshot: payload.run }
        : undefined,
  })

  await repo.patchPayload(job.payloadId, result)
  // 硬校验未通过不再丢稿：任务算成功，但必须把「还有几处要改」写进 meta，
  // 否则任务中心只会显示「已完成」，用户会以为全部合规。
  const pendingHits = result.hardCheck?.hits ?? []
  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    meta: {
      ...job.meta,
      mode: payload.config.mode,
      status: 'done',
      pct: '100',
      round: String(result.rounds?.length ?? 0),
      fallback: result.fallback ? '1' : '0',
      usedMock: result.usedMock ? '1' : '0',
      retention: String(result.rounds?.at(-1)?.averageRetention ?? ''),
      hardCheck: pendingHits.length ? '1' : '0',
      hardCheckCount: String(pendingHits.length),
      hardCheckLabels: pendingHits.map((hit) => hit.label).slice(0, 3).join('、'),
    },
  })
}

/** 任务标题：与页面同源，避免两处文案漂移 */
export function scriptTaskDisplayTitle(payload: ScriptTaskPayload): string {
  return scriptTaskTitle(payload.config)
}

export { scriptTaskTitle }
