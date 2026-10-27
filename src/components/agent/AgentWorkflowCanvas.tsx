import { useMemo } from 'react'
import type { AgentRunSnapshot, AgentStageDef, AgentStageState } from '../../agent'
import { resolveStageOutputLayers } from '../../agent/stage-output-preview'
import { WorkflowCanvasDialog } from '@no996/ui/workflow-canvas-dialog'
import { resolveBranchNodeStatus } from '@no996/ui/workflow-canvas-model'
import type {
  WorkflowCanvasNodeDef,
  WorkflowCanvasNodeType,
  WorkflowLogEvent,
  WorkflowNodeStatus,
  WorkflowRuntimeState,
} from '@no996/ui/workflow-canvas-model'

export type AgentWorkflowCanvasProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  defs: readonly AgentStageDef[]
  snapshot: AgentRunSnapshot | null
  streamingText?: string
  /** 需要预先展示成功 / 兜底分支的阶段 id。 */
  branchStageIds?: readonly string[]
  onRetryStage?: (stageId: string) => void
}

type SearchBranch = { stageId: string; outcome: 'succeeded' | 'fallback' }

function mapKindToType(kind: AgentStageDef['kind']): WorkflowCanvasNodeType {
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

function isWallClockMs(t: number | undefined): boolean {
  return typeof t === 'number' && t > 1e11
}

function mapStageStatus(status?: AgentStageState['status']): WorkflowNodeStatus {
  switch (status) {
    case 'running':
      return 'running'
    case 'done':
      return 'done'
    case 'failed':
      return 'error'
    case 'skipped':
      return 'skipped'
    case 'idle':
    default:
      return 'pending'
  }
}

function searchAttemptText(
  attempts: NonNullable<AgentStageState['searchAttempts']>,
  outcome: SearchBranch['outcome'],
): string {
  const matching = attempts.filter((attempt) =>
    outcome === 'succeeded' ? attempt.status === 'succeeded' : attempt.status === 'failed' || attempt.status === 'rejected',
  )
  return matching.map((attempt, index) => {
    const lines = [
      `${index + 1}. 搜索关键词：${attempt.query || '未提供'}`,
      `检索目的：${attempt.purpose || '模型未说明'}`,
    ]
    if (attempt.status === 'succeeded') {
      lines.push(`搜索成功，返回 ${attempt.resultCount ?? 0} 条来源。`)
    } else if (attempt.status === 'rejected') {
      lines.push(`关键词未通过检查：${attempt.error || '请改用具体主题词。'}`)
    } else {
      lines.push(`搜索失败：${attempt.error || '联网搜索服务暂不可用。'}；接下来由纯模型根据已有资料继续。`)
    }
    return lines.join('\n')
  }).join('\n\n')
}

export function AgentWorkflowCanvas({
  open,
  onOpenChange,
  title = '生产流程画布',
  defs,
  snapshot,
  streamingText,
  branchStageIds = [],
  onRetryStage,
}: AgentWorkflowCanvasProps) {
  const { nodes, orderedDefs, searchBranches } = useMemo(() => {
    const sorted = [...defs].sort((a, b) => a.order - b.order)
    const nodeList: WorkflowCanvasNodeDef[] = []
    const branchMap = new Map<string, SearchBranch>()
    let previousIds: string[] = []

    for (const def of sorted) {
      nodeList.push({
        id: def.id,
        title: def.roleName,
        order: def.order,
        type: mapKindToType(def.kind),
        desc: def.principle,
        deps: previousIds,
      })

      if (branchStageIds.includes(def.id)) {
        const successId = `${def.id}-search-succeeded`
        const fallbackId = `${def.id}-search-fallback`
        nodeList.push(
          {
            id: successId,
            title: '联网检索成功',
            order: def.order + 0.1,
            type: 'tool',
            desc: '模型提出检索目的与关键词，搜索返回的来源进入后续生成。',
            deps: [def.id],
          },
          {
            id: fallbackId,
            title: '联网检索失败 · 纯模型继续',
            order: def.order + 0.2,
            type: 'llm',
            desc: '搜索失败或关键词无效时，不再依赖搜索结果；模型使用用户资料与已有知识继续。',
            deps: [def.id],
          },
        )
        branchMap.set(successId, { stageId: def.id, outcome: 'succeeded' })
        branchMap.set(fallbackId, { stageId: def.id, outcome: 'fallback' })
        previousIds = [successId, fallbackId]
      } else {
        previousIds = [def.id]
      }
    }
    return { nodes: nodeList, orderedDefs: sorted, searchBranches: branchMap }
  }, [defs, branchStageIds])

  const { runtimeState, events, activeNodeId } = useMemo(() => {
    const stateMap: WorkflowRuntimeState = {}
    const eventList: WorkflowLogEvent[] = []
    const stages = snapshot?.stages ?? []
    const byId = new Map(stages.map((stage) => [stage.id, stage]))
    let currentRunning: string | undefined
    let baseTime = 0

    nodes.forEach((node) => {
      let status: WorkflowNodeStatus
      let text = ''
      let thinkingText: string | undefined
      let startedAt = 0
      let finishedAt = 0
      const branch = searchBranches.get(node.id)

      if (branch) {
        const source = byId.get(branch.stageId)
        const attempts = source?.searchAttempts ?? []
        const latestAttempt = attempts[attempts.length - 1]
        const outcome = latestAttempt?.status === 'succeeded'
          ? 'succeeded'
          : latestAttempt?.status === 'failed' || latestAttempt?.status === 'rejected'
            ? 'fallback'
            : undefined
        const matching = attempts.filter((attempt) =>
          branch.outcome === 'succeeded'
            ? attempt.status === 'succeeded'
            : attempt.status === 'failed' || attempt.status === 'rejected',
        )
        const selected = outcome === branch.outcome
        status = resolveBranchNodeStatus(outcome, branch.outcome)
        text = selected
          ? searchAttemptText(attempts, branch.outcome)
          : outcome
            ? branch.outcome === 'succeeded'
              ? '本次未命中成功分支；联网搜索失败后已切换到纯模型兜底。'
              : '本次未命中兜底分支；联网搜索成功，后续使用检索来源生成。'
            : ''
        startedAt = matching[0]?.startedAt ?? 0
        finishedAt = matching[matching.length - 1]?.finishedAt ?? 0
      } else {
        const stage = byId.get(node.id)
        status = mapStageStatus(stage?.status)
        const def = orderedDefs.find((item) => item.id === node.id)
        if (!def) return
        const layers = resolveStageOutputLayers(stage, {
          isRunning: status === 'running',
          stream: status === 'running' ? streamingText : undefined,
          kind: def.kind,
        })
        text = layers.product
        thinkingText = layers.thinking
        if (def.kind === 'tool' && stage?.searchAttempts?.length) {
          text = stage.searchAttempts.map((attempt, index) => {
            const lines = [`${index + 1}. 搜索关键词：${attempt.query || '无有效关键词'}`]
            if (attempt.purpose) lines.push(`检索目的：${attempt.purpose}`)
            if (attempt.status === 'running') lines.push('正在请求联网搜索服务。')
            else if (attempt.status === 'succeeded') lines.push(`搜索成功，返回 ${attempt.resultCount ?? 0} 条来源。`)
            else if (attempt.status === 'rejected') lines.push(`关键词未通过检查：${attempt.error || '请改用具体主题词。'}`)
            else if (attempt.status === 'failed') lines.push(`搜索失败：${attempt.error || '联网搜索服务暂不可用。'}`)
            else if (attempt.status === 'cancelled') lines.push('搜索已取消。')
            return lines.join('\n')
          }).join('\n\n')
        }
        startedAt = stage?.startedAt ?? 0
        finishedAt = stage?.finishedAt ?? 0
        if (status === 'running') currentRunning = node.id
      }

      const playbackStart = (baseTime += 1000)
      const playbackEnd = status === 'done' || status === 'error' || status === 'skipped' ? playbackStart + 1200 : playbackStart
      if (playbackEnd > baseTime) baseTime = playbackEnd
      const detailStarted = isWallClockMs(startedAt) ? startedAt : playbackStart
      const detailFinished = isWallClockMs(finishedAt) && finishedAt > detailStarted
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
        } else if (status === 'error') {
          eventList.push({ t: playbackEnd || playbackStart + 500, id: node.id, kind: 'end', v: '搜索失败' })
        }
      } else if (status === 'skipped') {
        if (text) eventList.push({ t: playbackStart, id: node.id, kind: 'text', v: text })
        eventList.push({ t: playbackEnd, id: node.id, kind: 'end', v: 'skipped' })
      }
    })

    return {
      runtimeState: stateMap,
      events: eventList.sort((a, b) => a.t - b.t),
      activeNodeId: currentRunning,
    }
  }, [nodes, orderedDefs, searchBranches, snapshot, streamingText])

  const canRetryNode = (stageId: string) => {
    const index = orderedDefs.findIndex((stage) => stage.id === stageId)
    if (index < 0) return false
    if (index === 0) return true
    const previousId = orderedDefs[index - 1]?.id
    return Boolean(previousId && snapshot?.checkpoints?.[previousId] !== undefined)
  }

  return (
    <WorkflowCanvasDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      nodes={nodes}
      runtimeState={runtimeState}
      events={events}
      activeNodeId={activeNodeId}
      onRetryNode={onRetryStage}
      canRetryNode={canRetryNode}
    />
  )
}

export default AgentWorkflowCanvas
