import { createAgentClients } from '../../../agent'
import type { AgentRunSnapshot } from '../../../agent'
import { createTaskSink } from '../../../agent/sink'
import {
  PRODUCT_POSITIONING_FLOW_ID,
  runProductPositionFlow,
} from '../../../features/product-position/agent/product-position-flow'
import { createProductMockResponder } from '../../../features/product-position/agent/demo-responder'
import { saveReport } from '../../product-position/store'
import {
  SKILL_VERSION,
  TEMPLATE_VERSION,
  newReportId,
  nowIso,
  type ProductReportSnapshot,
} from '../../product-position/types'
import type { WorkbenchTaskRepository } from '../repository'
import type { ProductPositioningPayload, WorkbenchTaskRecord } from '../types'

/**
 * 产品定位分析的后台执行器。
 *
 * 与页面内运行共用同一个 flow；差别只在 sink 落到任务 payload，以及结果写入
 * 产品定位本机库（报告与输入快照绑定，失败也保留可回看的原文）。
 */
export async function executeProductPositioning(
  repo: WorkbenchTaskRepository,
  job: WorkbenchTaskRecord,
  signal?: AbortSignal,
): Promise<void> {
  const payloadRec = await repo.getPayload(job.payloadId)
  const payload = payloadRec?.data as ProductPositioningPayload | undefined
  if (!payload) throw new Error('产品定位任务数据丢失')

  const clients = createAgentClients({ mockResponder: createProductMockResponder() })

  let currentPayload = payload
  const sink = createTaskSink({
    patchMeta: async (meta) => {
      await repo.patchJob(job.id, { meta: { ...job.meta, ...meta } })
    },
    patchSnapshot: async (snapshot: AgentRunSnapshot) => {
      currentPayload = { ...currentPayload, run: snapshot }
      await repo.patchPayload(job.payloadId, currentPayload)
    },
  })

  const startedAt = nowIso()
  const reportId = newReportId()
  const base: ProductReportSnapshot = {
    id: reportId,
    ownerSub: payload.snapshot.product.ownerSub,
    productId: payload.productId,
    taskId: job.id,
    markdown: '',
    status: 'running',
    issues: [],
    skillVersion: SKILL_VERSION,
    templateVersion: TEMPLATE_VERSION,
    inputSnapshot: payload.snapshot,
    createdAt: startedAt,
    updatedAt: startedAt,
  }
  await saveReport(base)

  try {
    const result = await runProductPositionFlow({
      snapshot: payload.snapshot,
      clients,
      sink,
      signal,
    })

    if (signal?.aborted || (await repo.getJob(job.id))?.status === 'cancelled') {
      throw new DOMException('Aborted', 'AbortError')
    }

    const finished: ProductReportSnapshot = {
      ...base,
      markdown: result.markdown,
      view: result.view,
      status: result.ok ? 'succeeded' : 'failed',
      issues: result.issues,
      error: result.ok ? undefined : '报告结构不符合模板，已保留原文。',
      updatedAt: nowIso(),
    }
    await saveReport(finished)

    currentPayload = {
      ...currentPayload,
      reportId: finished.id,
      reportMarkdown: finished.markdown,
      issues: finished.issues,
      view: finished.view,
      usedMock: result.usedMock,
    }
    await repo.patchPayload(job.payloadId, currentPayload)
    await repo.patchJob(job.id, {
      status: result.ok ? 'succeeded' : 'failed',
      finishedAt: Date.now(),
      errorMessage: result.ok ? undefined : '报告结构不符合模板',
      meta: {
        ...job.meta,
        productId: payload.productId,
        status: result.ok ? 'done' : 'failed',
        pct: result.ok ? '100' : '0',
        reportId: finished.id,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '产品定位分析失败'
    await saveReport({
      ...base,
      status: 'failed',
      error: message,
      updatedAt: nowIso(),
    })
    throw error
  }
}

export { PRODUCT_POSITIONING_FLOW_ID }
