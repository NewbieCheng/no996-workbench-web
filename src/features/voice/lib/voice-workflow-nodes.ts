import type { WorkflowCanvasNodeDef, WorkflowCanvasNodeType } from '@no996/ui/workflow-canvas-model'

/** 与 `VOICE_DUB_STAGES` 对齐的静态元数据，避免测试环境拉取 agent 注册表。 */
const VOICE_WORKFLOW_STAGE_META: Record<
  string,
  { roleName: string; kind: 'algo' | 'model' | 'tool'; principle: string; order: number }
> = {
  ingest: {
    order: 1,
    roleName: '文稿整理',
    kind: 'algo',
    principle: '规范化长文本，清理异常字符与空行，检查单段长度限制。',
  },
  plan_review: {
    order: 3,
    roleName: '方案校验',
    kind: 'algo',
    principle: '校验分段完整性；语气说明与段正文篇幅限制。',
  },
  segment_tts: {
    order: 4,
    roleName: '逐段配音',
    kind: 'tool',
    principle: '按确认后的文案与语气参数分段合成音频。',
  },
  merge_audio: {
    order: 5,
    roleName: '拼接成片',
    kind: 'algo',
    principle: '顺序拼接多段音频为一条 WAV。',
  },
  finalize: {
    order: 6,
    roleName: '成片定稿',
    kind: 'algo',
    principle: '生成成片元数据与分段试听索引。',
  },
}

export type PlannerBatchState = {
  index: number
  status: 'pending' | 'running' | 'done'
  segmentCount?: number
}

export type SegmentPlannerCheckpoint = {
  planner_batches_total?: number
  planner_batch_states?: PlannerBatchState[]
  segment_planner_batches?: Array<{ index: number; segments: unknown[] }>
}

function stageType(kind: string): WorkflowCanvasNodeType {
  switch (kind) {
    case 'model':
      return 'llm'
    case 'tool':
      return 'tool'
    case 'algo':
      return 'guard'
    default:
      return 'llm'
  }
}

export function parsePlannerBatchStates(meta?: Record<string, string>): PlannerBatchState[] {
  const raw = meta?.planner_batch_states
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as PlannerBatchState[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function resolvePlannerBatchTotal(
  meta?: Record<string, string>,
  checkpoint?: SegmentPlannerCheckpoint | null,
): number {
  const fromMeta = Number.parseInt(meta?.planner_batches_total ?? '', 10)
  if (fromMeta > 0) return fromMeta
  if (checkpoint?.planner_batches_total && checkpoint.planner_batches_total > 0) {
    return checkpoint.planner_batches_total
  }
  return 1
}

export function parsePlanBatchCurrent(planBatch?: string): number | null {
  if (!planBatch) return null
  const m = /^(\d+)\s*\/\s*\d+/.exec(planBatch.trim())
  if (!m) return null
  const n = Number.parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function resolvePlannerBatchStates(
  meta?: Record<string, string>,
  checkpoint?: SegmentPlannerCheckpoint | null,
): PlannerBatchState[] {
  const fromCheckpoint = checkpoint?.planner_batch_states ?? []
  if (fromCheckpoint.length) return fromCheckpoint
  return parsePlannerBatchStates(meta)
}

/** 当前规划批序号：meta → checkpoint running → segment_planner 进行中默认 1 */
export function resolveEffectivePlanBatchIndex(
  meta?: Record<string, string>,
  checkpoint?: SegmentPlannerCheckpoint | null,
  plannerRunning?: boolean,
): number | null {
  const fromMeta = parsePlanBatchCurrent(meta?.plan_batch)
  if (fromMeta) return fromMeta
  const states = resolvePlannerBatchStates(meta, checkpoint)
  const running = states.find((s) => s.status === 'running')
  if (running) return running.index
  if (plannerRunning) return 1
  return null
}

/** 配音高阶：ingest → N 个拆段批节点 → 汇总 → 后续固定阶段（隐藏单节点 segment_planner）。 */
export function buildVoiceWorkflowNodes(batchTotal: number): WorkflowCanvasNodeDef[] {
  const total = Math.max(1, batchTotal)
  const nodes: WorkflowCanvasNodeDef[] = []

  const ingestDef = VOICE_WORKFLOW_STAGE_META.ingest
  nodes.push({
    id: 'ingest',
    title: ingestDef.roleName,
    order: 1,
    type: stageType(ingestDef.kind),
    desc: ingestDef.principle,
    deps: [],
  })

  const batchIds: string[] = []
  for (let i = 1; i <= total; i++) {
    const id = `segment_planner_batch_${i}`
    batchIds.push(id)
    nodes.push({
      id,
      title: `AI 拆段 · 节点 ${i}`,
      order: 2 + i * 0.01,
      type: 'llm',
      desc: '按口播结构拆解本批文稿并生成播读风格说明。',
      deps: ['ingest'],
    })
  }

  nodes.push({
    id: 'segment_planner_merge',
    title: '方案汇总合并',
    order: 3,
    type: 'guard',
    desc: '合并各批分段结果，统一标题与段落顺序。',
    deps: batchIds,
  })

  const tailIds = ['plan_review', 'segment_tts', 'merge_audio', 'finalize'] as const
  let prevDeps = ['segment_planner_merge']
  for (const stageId of tailIds) {
    const def = VOICE_WORKFLOW_STAGE_META[stageId]
    nodes.push({
      id: stageId,
      title: def.roleName,
      order: def.order + 10,
      type: stageType(def.kind),
      desc: def.principle,
      deps: prevDeps,
    })
    prevDeps = [stageId]
  }

  return nodes
}
