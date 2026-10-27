import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AgentRunSnapshot } from '../../../agent'
import { resolveStageOutputLayers } from '../../../agent/stage-output-preview'
import { WorkflowCanvasDialog } from '@no996/ui/workflow-canvas-dialog'
import type {
  WorkflowLogEvent,
  WorkflowNodeStatus,
  WorkflowRuntimeState,
} from '@no996/ui/workflow-canvas-model'
import { VOICE_DUB_STAGES } from '../agent/stages'
import { localizeVoiceDubStages } from '../voice-i18n'
import {
  buildVoiceWorkflowNodes,
  resolveEffectivePlanBatchIndex,
  resolvePlannerBatchStates,
  resolvePlannerBatchTotal,
  type SegmentPlannerCheckpoint,
} from '../lib/voice-workflow-nodes'

export type VoiceWorkflowCanvasProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  snapshot: AgentRunSnapshot | null
  meta?: Record<string, string>
  streamingText?: string
}

function mapStageStatus(status?: string): WorkflowNodeStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'done':
      return 'done'
    case 'failed':
      return 'error'
    case 'skipped':
      return 'skipped'
    default:
      return 'pending'
  }
}

function isWallClockMs(t: number | undefined): boolean {
  return typeof t === 'number' && t > 1e11
}

export function VoiceWorkflowCanvas({
  open,
  onOpenChange,
  title,
  snapshot,
  meta,
  streamingText,
}: VoiceWorkflowCanvasProps) {
  const { t, i18n } = useTranslation('voice')
  const resolvedTitle = title ?? t('advanced.workflowTitle')
  const flowStages = useMemo(() => localizeVoiceDubStages(t), [t, i18n.language])
  const plannerCheckpoint = (snapshot?.checkpoints?.segment_planner ??
    null) as SegmentPlannerCheckpoint | null

  const batchTotal = resolvePlannerBatchTotal(meta, plannerCheckpoint)
  const nodes = useMemo(() => buildVoiceWorkflowNodes(batchTotal), [batchTotal])

  const { runtimeState, events, activeNodeId } = useMemo(() => {
    const stateMap: WorkflowRuntimeState = {}
    const eventList: WorkflowLogEvent[] = []
    const stages = snapshot?.stages ?? []
    const byId = new Map(stages.map((stage) => [stage.id, stage]))
    const batchStates = resolvePlannerBatchStates(meta, plannerCheckpoint)
    const plannerStage = byId.get('segment_planner')
    const plannerRunning = plannerStage?.status === 'running'
    const plannerDone = plannerStage?.status === 'done'
    const currentBatch = resolveEffectivePlanBatchIndex(meta, plannerCheckpoint, plannerRunning)
    const plannerStreamText =
      streamingText ||
      (plannerRunning ? plannerStage?.streamingContent?.trim() : '') ||
      ''

    let currentRunning: string | undefined
    let baseTime = 0

    const allBatchesDone =
      batchStates.length > 0
        ? batchStates.every((s) => s.status === 'done')
        : plannerDone || (!plannerRunning && Boolean(plannerStage))

    nodes.forEach((node) => {
      let status: WorkflowNodeStatus = 'pending'
      let text = ''
      let thinkingText: string | undefined
      let startedAt = 0
      let finishedAt = 0

      const batchMatch = /^segment_planner_batch_(\d+)$/.exec(node.id)
      if (batchMatch) {
        const index = Number.parseInt(batchMatch[1], 10)
        const state = batchStates.find((s) => s.index === index)
        if (state?.status === 'done') status = 'done'
        else if (
          state?.status === 'running' ||
          (plannerRunning && (currentBatch === index || (currentBatch == null && index === 1)))
        ) {
          status = 'running'
        } else if (currentBatch != null && index < currentBatch) status = 'done'
        if (state?.segmentCount) {
          text = t('workflow.plannedBatch', { count: state.segmentCount })
        }
        if (status === 'running' && plannerStreamText) {
          text = plannerStreamText
        } else if (status === 'running') {
          text = t('workflow.planning')
        }
      } else if (node.id === 'segment_planner_merge') {
        if (plannerDone || byId.get('plan_review')?.status === 'running' || byId.get('plan_review')?.status === 'done') {
          status = 'done'
          text = t('workflow.merged')
        } else if (plannerRunning && allBatchesDone) {
          status = 'running'
          text = t('workflow.merging')
        } else if (plannerRunning) {
          status = 'pending'
        }
      } else {
        const stage = byId.get(node.id)
        status = mapStageStatus(stage?.status)
        const def = flowStages.find((item) => item.id === node.id) ?? VOICE_DUB_STAGES.find((item) => item.id === node.id)
        if (def) {
          const layers = resolveStageOutputLayers(stage, {
            isRunning: status === 'running',
            stream: status === 'running' ? streamingText : undefined,
            kind: def.kind,
          })
          text = layers.product
          thinkingText = layers.thinking
        }
        startedAt = stage?.startedAt ?? 0
        finishedAt = stage?.finishedAt ?? 0
      }

      const playbackStart = (baseTime += 1000)
      const playbackEnd =
        status === 'done' || status === 'error' || status === 'skipped'
          ? playbackStart + 1200
          : playbackStart
      if (playbackEnd > baseTime) baseTime = playbackEnd
      const detailStarted = isWallClockMs(startedAt) ? startedAt : playbackStart
      const detailFinished =
        isWallClockMs(finishedAt) && finishedAt > detailStarted
          ? finishedAt
          : status === 'done' || status === 'error' || status === 'skipped'
            ? playbackEnd
            : 0

      stateMap[node.id] = {
        status,
        text,
        thinkingText,
        startedAt: detailStarted,
        finishedAt: detailFinished,
      }

      if (status === 'running') currentRunning = node.id
      if (status === 'running' || status === 'done' || status === 'error') {
        eventList.push({ t: playbackStart, id: node.id, kind: 'start' })
        if (text) eventList.push({ t: playbackStart + 300, id: node.id, kind: 'text', v: text })
        if (status === 'done') {
          eventList.push({ t: playbackEnd, id: node.id, kind: 'end', v: 0 })
        }
      }
    })

    return {
      runtimeState: stateMap,
      events: eventList.sort((a, b) => a.t - b.t),
      activeNodeId: currentRunning,
    }
  }, [nodes, snapshot, meta, streamingText, plannerCheckpoint, t, flowStages])

  return (
    <WorkflowCanvasDialog
      open={open}
      onOpenChange={onOpenChange}
      title={resolvedTitle}
      nodes={nodes}
      runtimeState={runtimeState}
      events={events}
      activeNodeId={activeNodeId}
    />
  )
}

export default VoiceWorkflowCanvas
