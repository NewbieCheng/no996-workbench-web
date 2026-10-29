import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ActivityIcon, Loader2Icon, RotateCcwIcon, SquareIcon, XIcon } from 'lucide-react'
import type { AgentRunSnapshot, AgentStageDef } from '../../agent'
import { AgentProgress, agentProgressPercent, agentProgressText } from './AgentProgress'
import { StreamingText } from './StreamingText'
import './agent-step-run.css'

export type AgentStepRunStatus = 'idle' | 'queued' | 'running' | 'done' | 'failed' | 'cancelled'

export type AgentStepRunCardProps = {
  title: string
  status: AgentStepRunStatus
  snapshot: AgentRunSnapshot | null
  defs: AgentStageDef[]
  /** 已过滤、可直接展示的流式摘要；不要传 JSON 原文。 */
  streamingText?: string
  /** 没有可展示正文时的实时说明（例如“已接收 320 字，正在解析…”）。 */
  emptyHint?: string
  /** 明确告诉用户当前流还在动；即使还没有可展示字段也不空白。 */
  streamHint?: string
  detailTitle?: string
  onCancel?: () => void
  onRetry?: () => void
  retryLabel?: string
}

const STATUS_LABEL: Record<AgentStepRunStatus, string> = {
  idle: '等待开始',
  queued: '排队中',
  running: '进行中',
  done: '已完成',
  failed: '失败',
  cancelled: '已取消',
}

/**
 * 单步运行卡：进度条 + 当前节点 + 可展开的右侧过程面板。
 *
 * 用于「这一步本身就是一个 Agent 阶段」的等待反馈（如爆款复刻的内容规划）。
 * 组件只消费快照，不自己算假进度；后续步骤直接复用，不要再写一套 spinner。
 */
export function AgentStepRunCard({
  title,
  status,
  snapshot,
  defs,
  streamingText,
  emptyHint = '结果会在这一步完成后以结构化表单展示。',
  streamHint,
  detailTitle,
  onCancel,
  onRetry,
  retryLabel = '重新执行',
}: AgentStepRunCardProps) {
  const [open, setOpen] = useState(false)
  const stages = snapshot?.stages ?? []
  const pct = useMemo(() => agentProgressPercent(defs, stages), [defs, stages])
  const progressText = useMemo(() => agentProgressText(defs, stages), [defs, stages])
  const activeStage = useMemo(
    () => stages.find((stage) => stage.status === 'running'),
    [stages],
  )
  const showProgress = status !== 'failed' && status !== 'cancelled'
  const running = status === 'running' || status === 'queued'

  const drawer = open && typeof document !== 'undefined'
    ? createPortal(
        <div className="agent-step-run__portal" role="presentation">
          <button
            type="button"
            className="agent-step-run__backdrop"
            aria-label="关闭过程面板"
            onClick={() => setOpen(false)}
          />
          <aside
            className="agent-step-run__drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`${detailTitle || title} · 过程`}
          >
            <header className="agent-step-run__drawer-head">
              <div>
                <span className="agent-step-run__eyebrow">AGENT 过程</span>
                <h3>{detailTitle || title}</h3>
              </div>
              <button type="button" className="agent-step-run__icon" onClick={() => setOpen(false)} aria-label="关闭">
                <XIcon className="size-4" />
              </button>
            </header>

            <div className="agent-step-run__drawer-meter">
              <div className="agent-step-run__meter" aria-hidden>
                <span style={{ width: `${pct}%` }} />
              </div>
              <strong>{pct}%</strong>
            </div>
            <p className="agent-step-run__drawer-stage">
              {activeStage?.headline || activeStage?.progress?.label || progressText || STATUS_LABEL[status]}
            </p>

            {running ? (
              <div className="agent-step-run__stream-line" aria-hidden>
                <span />
              </div>
            ) : null}

            <div className="agent-step-run__drawer-scroll">
              <AgentProgress
                stages={stages}
                defs={defs}
                variant="full"
                showProgress
              />
              <div className="agent-step-run__stream-head">
                <span>流式输出</span>
                <span className="agent-step-run__stream-state" data-running={running || undefined}>
                  {running ? '实时接收中' : STATUS_LABEL[status]}
                </span>
              </div>
              {streamingText ? (
                <div className="agent-step-run__stream" aria-live="polite">
                  <StreamingText text={streamingText} />
                </div>
              ) : (
                <p className="agent-step-run__empty">
                  {running ? (
                    <StreamingText
                      text={streamHint || '模型正在生成，首个可展示字段到达后会逐字出现…'}
                    />
                  ) : (
                    emptyHint
                  )}
                </p>
              )}
            </div>

            <footer className="agent-step-run__drawer-foot">
              {running && onCancel ? (
                <button type="button" className="agent-step-run__btn" onClick={onCancel}>
                  <SquareIcon className="size-3.5" /> 停止
                </button>
              ) : null}
              {!running && onRetry ? (
                <button type="button" className="agent-step-run__btn" onClick={onRetry}>
                  <RotateCcwIcon className="size-3.5" /> {retryLabel}
                </button>
              ) : null}
            </footer>
          </aside>
        </div>,
        document.body,
      )
    : null

  return (
    <section className="agent-step-run" data-status={status}>
      <div className="agent-step-run__head">
        <span className="agent-step-run__dot" aria-hidden>
          {status === 'running' ? <Loader2Icon className="size-4 animate-spin" /> : <ActivityIcon className="size-4" />}
        </span>
        <div className="agent-step-run__head-main">
          <div className="agent-step-run__title-row">
            <strong>{title}</strong>
            <span className="agent-step-run__status">{STATUS_LABEL[status]}</span>
            {progressText ? <span className="agent-step-run__step">{progressText}</span> : null}
          </div>
          <p className="agent-step-run__stage">
            {activeStage?.progress?.label || activeStage?.headline || '准备开始…'}
          </p>
          {showProgress ? (
            <div className="agent-step-run__meter-row">
              <div
                className="agent-step-run__meter"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="单步执行进度"
              >
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="agent-step-run__pct">{pct}%</span>
            </div>
          ) : null}
        </div>
        <div className="agent-step-run__actions">
          <button type="button" className="agent-step-run__detail-btn" onClick={() => setOpen(true)}>
            <ActivityIcon className="size-3.5" />
            查看过程
          </button>
          {running && onCancel ? (
            <button type="button" className="agent-step-run__icon agent-step-run__icon--danger" onClick={onCancel} aria-label="停止">
              <SquareIcon className="size-3.5" />
            </button>
          ) : null}
          {!running && status !== 'idle' && onRetry ? (
            <button type="button" className="agent-step-run__icon" onClick={onRetry} aria-label={retryLabel}>
              <RotateCcwIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {drawer}
    </section>
  )
}
