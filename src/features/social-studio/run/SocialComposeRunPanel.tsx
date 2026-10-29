import type { AgentRunSnapshot } from '../../../agent'
import AgentWorkflowCanvas from '../../../components/agent/AgentWorkflowCanvas'
import { StreamingText } from '../../../components/agent/StreamingText'
import WorkflowRunCard, { type WorkflowRunStatus } from '../../../components/agent/WorkflowRunCard'
import { SOCIAL_COMPOSE_STAGES } from '../agent/stages'
import { ImageGenerationBoard } from './ImageGenerationBoard'
import './social-compose-run.css'

export type SocialComposeRunPanelProps = {
  title: string
  status: WorkflowRunStatus
  snapshot: AgentRunSnapshot | null
  chips?: string[]
  streamingText?: string
  submittedAt?: number
  mock?: boolean
  imagePlans?: Array<{ titleText?: string; role?: string }>
  imageUrls?: string[]
  imageProgress?: { done: number; total: number }
  textReady?: boolean
  running?: boolean
  textOnly?: boolean
  onCancel?: () => void
  onRetry?: () => void
  onEnter?: () => void
  enterLabel?: string
  enterDisabled?: boolean
}

/**
 * 图文生产运行面板。
 *
 * 复用三件已有资产：
 * - WorkflowRunCard：进度、阶段、取消/重试（内部就是 AgentProgress）
 * - AgentWorkflowCanvas(embedded)：流程拓扑
 * - ImageGenerationBoard：右侧逐张生图
 *
 * 这里只做布局与业务数据映射，不再自己算百分比或画流程。
 */
export function SocialComposeRunPanel({
  title,
  status,
  snapshot,
  chips = [],
  streamingText,
  submittedAt,
  mock,
  imagePlans = [],
  imageUrls = [],
  imageProgress = { done: 0, total: 0 },
  textReady = false,
  running = false,
  textOnly = false,
  onCancel,
  onRetry,
  onEnter,
  enterLabel = '进入创作画布',
  enterDisabled = false,
}: SocialComposeRunPanelProps) {
  return (
    <section className="sc-run-panel" data-status={status}>
      <WorkflowRunCard
        title={title}
        status={status}
        chips={chips}
        submittedAt={submittedAt}
        mock={mock}
        streamingText={streamingText}
        snapshot={snapshot}
        defs={SOCIAL_COMPOSE_STAGES}
        progressFromSnapshot
        defaultStepsOpen
        hideCanvasButton
        onCancel={onCancel}
        onRetry={onRetry}
      />

      <div className="sc-run-panel__body">
        <div className="sc-run-panel__canvas">
          <AgentWorkflowCanvas
            embedded
            open={false}
            onOpenChange={() => undefined}
            title="AI 图文生产流程"
            defs={SOCIAL_COMPOSE_STAGES}
            snapshot={snapshot}
            streamingText={streamingText}
          />
        </div>

        <div className="sc-run-panel__side">
          <ImageGenerationBoard
            plans={imagePlans}
            imageUrls={imageUrls}
            progress={imageProgress}
            running={running}
            textOnly={textOnly}
          />
          <div className="sc-run-panel__text">
            <div className="sc-run-panel__text-head">
              <strong>正文</strong>
              <span>{textReady ? '文案已就绪' : running ? '正在撰写…' : '等待生成'}</span>
            </div>
            <div className="sc-run-panel__text-body">
              {streamingText?.trim() ? (
                <StreamingText text={streamingText} />
              ) : (
                <span>正文生成后会先出现在这里，配图随后补入。</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {onEnter ? (
        <div className="sc-run-panel__footer">
          <button
            type="button"
            className="sc-run-panel__enter"
            onClick={onEnter}
            disabled={enterDisabled}
          >
            {enterLabel}
          </button>
        </div>
      ) : null}
    </section>
  )
}
