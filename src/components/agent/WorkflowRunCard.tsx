import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ListTree, Network, RotateCcw, Search, Square } from 'lucide-react'
import type { AgentRunSnapshot, AgentSearchAttempt, AgentStageDef } from '../../agent'
import { stageProgressPercent } from '@no996/ui/stage-progress-model'
import { AgentProgress } from './AgentProgress'
import AgentWorkflowCanvas from './AgentWorkflowCanvas'
import { useNotifyOperationMessage } from '@/lib/toast'

/**
 * Workflow 运行大卡片（三页共用）。
 *
 * - 卡头：状态、渐进式等待动画与 SVG 操作按钮；列表按钮展开编号步骤，流程图按钮打开详细拓扑。
 * - 卡身默认折叠，展开后显示真实步骤状态与可展示流式正文；**绝不渲染 actualPrompt**。
 */

export type WorkflowRunStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type WorkflowRunCardProps = {
  /** 卡头标题，例如「正在生成 · 爆款标题」 */
  title: string
  status: WorkflowRunStatus
  /** 当前执行阶段的角色名，如「写手」 */
  activeRoleLabel?: string
  /** 用户输入摘要（用户原文，不是提示词），以 chips 形式回显 */
  chips: string[]
  submittedAt?: number
  roundText?: string
  mock?: boolean
  /** 流式正文（已过 createDisplayDelta 的可展示文本） */
  streamingText?: string
  snapshot: AgentRunSnapshot | null
  defs: AgentStageDef[]
  /** 进度条只展示其中一部分时传（例如脚本页只展示六步） */
  progressIds?: readonly string[]
  /** 预先展示成功 / 兜底分支的阶段 id。 */
  branchStageIds?: readonly string[]
  detailTitle?: string
  error?: string
  onCancel?: () => void
  onRetry?: () => void
  retryLabel?: string
  onRetryStage?: (stageId: string) => void
  /** 替换默认 AgentWorkflowCanvas（如配音多批节点图） */
  /** 为 true 时用 snapshot 阶段完成度驱动进度条，不用时间假动画 */
  progressFromSnapshot?: boolean
  /** 初始展开步骤列表（朋友圈生成页等需要一眼看到 1–5 步） */
  defaultStepsOpen?: boolean
  renderWorkflowCanvas?: (ctx: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    snapshot: AgentRunSnapshot | null
    streamingText?: string
  }) => ReactNode
}

const STATUS_LABEL: Record<WorkflowRunStatus, string> = {
  queued: '排队中',
  running: '进行中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

const SEARCH_STATUS_LABEL: Record<AgentSearchAttempt['status'], string> = {
  running: '搜索中',
  succeeded: '搜索成功',
  failed: '搜索失败',
  rejected: '关键词无效',
  cancelled: '已取消',
}

function formatTime(ts?: number): string {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function WorkflowRunCard({
  title,
  status,
  activeRoleLabel,
  chips,
  submittedAt,
  roundText,
  mock,
  streamingText,
  snapshot,
  defs,
  progressIds,
  branchStageIds,
  detailTitle: _detailTitle,
  error,
  onCancel,
  onRetry,
  retryLabel = '重新生成',
  onRetryStage,
  progressFromSnapshot,
  defaultStepsOpen = false,
  renderWorkflowCanvas,
}: WorkflowRunCardProps) {
  useNotifyOperationMessage(error, 'error', `wf-card-${title}`)
  const [stepsOpen, setStepsOpen] = useState(defaultStepsOpen)
  const [searchDetailsOpen, setSearchDetailsOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [progressPct, setProgressPct] = useState(0)

  const stages = snapshot?.stages ?? []
  const searchAttempts = stages.flatMap((stage) => stage.searchAttempts ?? [])
  const ordered = useMemo(() => [...defs].sort((a, b) => a.order - b.order), [defs])
  const progressDefs = useMemo(
    () =>
      progressIds?.length
        ? ordered.filter((d) => (progressIds as readonly string[]).includes(d.id))
        : ordered,
    [ordered, progressIds],
  )

  const activeDef = progressDefs.find((def) => stages.find((stage) => stage.id === def.id)?.status === 'running')
  const firstStartedAt = stages.reduce<number | undefined>((earliest, stage) => {
    if (typeof stage.startedAt !== 'number') return earliest
    return earliest === undefined ? stage.startedAt : Math.min(earliest, stage.startedAt)
  }, undefined)

  useEffect(() => {
    if (status === 'done') {
      setProgressPct(100)
      return
    }
    if (status === 'queued') {
      setProgressPct(0)
      return
    }
    if (status !== 'running') return

    if (progressFromSnapshot && progressDefs.length && stages.length) {
      const updateFromSnapshot = () => {
        const pct = stageProgressPercent(
          progressDefs.map((d) => ({ id: d.id, order: d.order, label: d.roleName })),
          stages.map((s) => ({ id: s.id, status: s.status })),
        )
        setProgressPct(pct)
      }
      updateFromSnapshot()
      const timer = window.setInterval(updateFromSnapshot, 400)
      return () => window.clearInterval(timer)
    }

    const startedAt = firstStartedAt ?? Date.now()
    const updateProgress = () => {
      const elapsed = Math.max(0, Date.now() - startedAt)
      setProgressPct(Math.min(95, 95 * (1 - Math.exp(-elapsed / 10_000))))
    }
    updateProgress()
    const timer = window.setInterval(updateProgress, 100)
    return () => window.clearInterval(timer)
  }, [firstStartedAt, status, progressFromSnapshot, progressDefs, stages])

  const showProgressBar = status !== 'failed'
  const time = formatTime(submittedAt)
  const showTerminate = (status === 'running' || status === 'queued') && Boolean(onCancel)
  const canShowSteps = progressDefs.length > 0 || Boolean(streamingText) || Boolean(error) || searchAttempts.length > 0

  return (
    <section className="wf-card" data-status={status} aria-label={title}>
      <div className="wf-card__head">
        <span className="wf-card__dot" aria-hidden="true" />
        <div className="wf-card__head-main">
          <div className="wf-card__title-row">
            <strong className="wf-card__title">{title}</strong>
            {activeRoleLabel || activeDef ? (
              <span className="wf-card__stage">{activeRoleLabel ?? activeDef?.roleName}</span>
            ) : null}
            {roundText ? <span className="wf-card__round">{roundText}</span> : null}
            {mock ? <span className="wf-card__badge">演示</span> : null}
            {showProgressBar ? (
              <div className="wf-card__meter-row">
                <div
                  className="wf-card__progress"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPct)}
                  aria-label="生成过程动画进度"
                >
                  <span className="wf-card__progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="wf-card__percent">{Math.round(progressPct)}%</span>
              </div>
            ) : null}
            {status !== 'running' ? (
              <span className="wf-card__status">{STATUS_LABEL[status]}</span>
            ) : null}
          </div>
          {chips.length || time ? (
            <div className="wf-card__meta">
              {chips.length ? (
                <span className="wf-card__chips">
                  {chips.map((c) => (
                    <span key={c} className="wf-card__chip">{c}</span>
                  ))}
                </span>
              ) : null}
              {time ? <span className="wf-card__time">提交于 {time}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="wf-card__head-actions" aria-label="生成操作">
          <button
            type="button"
            className="wf-card__icon-btn"
            onClick={() => setCanvasOpen(true)}
            aria-label="查看工作流大图"
          >
            <Network size={17} aria-hidden="true" />
          </button>
          {canShowSteps ? (
            <button
              type="button"
              className="wf-card__icon-btn"
              data-on={stepsOpen || undefined}
              aria-pressed={stepsOpen}
              aria-label={stepsOpen ? '收起步骤' : '展开步骤'}
              onClick={() => setStepsOpen((value) => !value)}
            >
              <ListTree size={17} aria-hidden="true" />
            </button>
          ) : null}
          {searchAttempts.length ? (
            <button
              type="button"
              className="wf-card__icon-btn"
              data-on={searchDetailsOpen || undefined}
              aria-pressed={searchDetailsOpen}
              aria-label={searchDetailsOpen ? '收起搜索详情' : '展开搜索详情'}
              onClick={() => setSearchDetailsOpen((value) => !value)}
            >
              <Search size={17} aria-hidden="true" />
            </button>
          ) : null}
          <span className="wf-card__action-separator" aria-hidden="true" />
          {showTerminate ? (
            <button
              type="button"
              className="wf-card__icon-btn wf-card__icon-btn--danger"
              onClick={onCancel}
              aria-label="停止本次生成"
            >
              <Square size={16} aria-hidden="true" />
            </button>
          ) : null}
          {onRetry ? (
            <button
              type="button"
              className="wf-card__icon-btn"
              onClick={onRetry}
              disabled={status === 'queued' || status === 'running'}
              aria-label={retryLabel}
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {searchDetailsOpen && searchAttempts.length ? (
        <div className="wf-card__search-details" role="region" aria-label="联网搜索详情">
          {searchAttempts.map((attempt, index) => (
            <div
              key={`${attempt.startedAt}-${index}`}
              className="wf-card__search-attempt"
              data-outcome={attempt.status}
            >
              <strong>{index + 1}. {SEARCH_STATUS_LABEL[attempt.status]}</strong>
              <span>关键词：{attempt.query || '无有效关键词'}</span>
              {attempt.purpose ? <span>检索目的：{attempt.purpose}</span> : null}
              {attempt.resultCount !== undefined ? <span>返回来源：{attempt.resultCount} 条</span> : null}
              {attempt.error ? <span>{attempt.error}</span> : null}
            </div>
          ))}
        </div>
      ) : null}

      {stepsOpen ? (
        <div className="wf-card__body">
          {progressDefs.length ? (
            <AgentProgress
              stages={stages}
              defs={progressDefs}
              variant="compact"
              roundText={roundText}
              mock={mock}
              hideTitle
            />
          ) : null}
          {status === 'queued' && !stages.length ? (
            <p className="wf-card__hint">任务已入队，等待开始执行。</p>
          ) : null}
          {streamingText ? (
            <p className="wf-card__stream" aria-live="polite">
              {streamingText}
              <span className="wf-card__caret" aria-hidden="true" />
            </p>
          ) : null}
        </div>
      ) : null}
      {renderWorkflowCanvas ? (
        renderWorkflowCanvas({
          open: canvasOpen,
          onOpenChange: setCanvasOpen,
          title,
          snapshot,
          streamingText,
        })
      ) : (
        <AgentWorkflowCanvas
          open={canvasOpen}
          onOpenChange={setCanvasOpen}
          title={title}
          defs={ordered}
          snapshot={snapshot}
          streamingText={streamingText}
          branchStageIds={branchStageIds}
          onRetryStage={onRetryStage}
        />
      )}
    </section>
  )
}

export default WorkflowRunCard
