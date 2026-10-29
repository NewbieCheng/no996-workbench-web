import { createAgentClients, type AgentRunSnapshot } from '../../../agent'
import { createTaskSink, snapshotProgressSignature } from '../../../agent/sink'
import { runSocialComposeProductionFlow } from '../../../features/social-studio/agent/social-compose-production-flow'
import type {
  SocialComposeResult,
  SocialComposeTaskPayload,
} from '../../../features/social-studio/agent/task-types'
import type { WorkbenchTaskRepository } from '../repository'
import type { WorkbenchTaskRecord } from '../types'

/**
 * 图文生产执行器：爆款复刻与灵感创作共用。
 *
 * 正文阶段流式写进 run 快照，页面据此先展示文案；图片阶段逐张更新
 * stage progress 与任务 meta。最终 result 落 payload，历史可恢复。
 */
export async function executeSocialCompose(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as SocialComposeTaskPayload | undefined
  if (!payload) throw new Error('图文任务数据丢失')

  let lastSignature = ''
  let lastSnapshot: AgentRunSnapshot | null = null
  let textReady = payload.action === 'images_only'
  const sink = createTaskSink({
    patchMeta: async (meta) => {
      await repo.patchJob(job.id, {
        meta: {
          ...job.meta,
          targetType: payload.targetType,
          platform: payload.platform,
          mode: payload.mode,
          action: payload.action,
          ...meta,
          textReady: textReady ? '1' : '0',
        },
      })
    },
    patchSnapshot: async (snapshot) => {
      lastSnapshot = snapshot
      const bodyStage = snapshot.stages.find((stage) => stage.id === 'compose-body')
      if (bodyStage?.status === 'done' || bodyStage?.status === 'skipped') textReady = true
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

  const clients = createAgentClients()
  const result: SocialComposeResult = await runSocialComposeProductionFlow({
    payload,
    clients,
    sink,
    signal,
  })

  await repo.patchPayload(job.payloadId, {
    ...payload,
    result,
    run: lastSnapshot,
  })

  await repo.patchJob(job.id, {
    status: 'succeeded',
    finishedAt: Date.now(),
    title: result.title || job.title,
    subtitle: `${payload.mode === 'wizard' ? '爆款复刻' : '灵感创作'} · ${
      payload.platform === 'xhs' ? '小红书' : '公众号'
    }`,
    meta: {
      ...job.meta,
      targetType: payload.targetType,
      platform: payload.platform,
      mode: payload.mode,
      action: payload.action,
      status: 'done',
      pct: '100',
      textReady: '1',
      imageDone: String(result.imageUrls.length),
      imageTotal: String(
        result.imageUrls.length + (result.failedImageCount ?? 0),
      ),
      stageLabel: '已完成',
      failedImages: String(result.failedImageCount ?? 0),
      warning: result.warnings?.length ? result.warnings[0] : '',
      usedMock: clients.isMock ? '1' : '0',
    },
  })
}
