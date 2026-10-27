import { Check, CircleDashed, Loader2, MinusCircle, TriangleAlert } from 'lucide-react'
import {
  normalizeSteps,
  stageProgressText,
  stageStepText,
  type StageProgressProps,
  type StageProgressStatus,
} from './stage-progress-model'

/**
 * 通用步骤进度条（跨板块复用）
 *
 * 把「进行到哪一步了」渲染成「一行步 + 每步状态」，可带进度（第 N 步 / 共 M 步）、
 * 轮次、演示徽标与流式正文。
 *
 * **不依赖 agent 内核、不依赖任何业务**：调用方自己把步骤定义（`steps`）与步骤状态
 * （`states`）喂进来，任何多步骤流程的板块都能用。令牌走 `--sp-*` → `--sl-*` → 全局
 * 主题令牌三级回退，所以脱离 `script-lab` 也能正常配色（明暗主题都稳定）。
 *
 * 三条约定（都来自真机复测踩出来的教训，别改回去；断言在 `stage-progress-model.test.mjs`）：
 * - **状态文案只有一份**：用导出的 `STAGE_STATUS_LABEL`，别在调用点各写一套。
 * - **`headline` 只在 `running` 时展示**：它是「运行中文案」，跑完还渲染就会留下
 *   「已完成 ✔ ／ 正在拆解客群定位…」这种自相矛盾的一行。
 * - **不自造数据**：没有 state 的步骤按 `idle` 显示；没有真实计时就不显示耗时。
 *
 * 计算逻辑都在 `stage-progress-model.ts`，这里只负责画出来。
 */
export type {
  StageProgressProps,
  StageProgressState,
  StageProgressStatus,
  StageProgressStep,
} from './stage-progress-model'
export {
  STAGE_STATUS_LABEL,
  stageDurationText,
  stageProgressPercent,
  stageProgressText,
  stageStepText,
} from './stage-progress-model'

function StatusIcon({ status }: { status: StageProgressStatus }) {
  const cls = 'stage-step__icon'
  if (status === 'done') return <Check className={`${cls} ${cls}--done`} size={14} aria-hidden="true" />
  if (status === 'running') return <Loader2 className={`${cls} ${cls}--running`} size={14} aria-hidden="true" />
  if (status === 'failed') return <TriangleAlert className={`${cls} ${cls}--failed`} size={14} aria-hidden="true" />
  if (status === 'skipped') return <MinusCircle className={`${cls} ${cls}--skipped`} size={14} aria-hidden="true" />
  return <CircleDashed className={cls} size={14} aria-hidden="true" />
}

export function StageProgress({
  steps,
  states,
  variant = 'compact',
  title,
  roundText,
  streamingText,
  mock,
  hideProgress,
}: StageProgressProps) {
  const { ordered, stateOf } = normalizeSteps(steps, states)
  const progressText = hideProgress ? undefined : stageProgressText(steps, states)

  return (
    <div className={`stage-progress stage-progress--${variant}`} data-slot="stage-progress">
      {title || progressText || roundText || mock ? (
        <div className="stage-progress__head">
          {title ? <span className="stage-progress__title">{title}</span> : null}
          {progressText ? <span className="stage-progress__progress">{progressText}</span> : null}
          {roundText ? <span className="stage-progress__round">{roundText}</span> : null}
          {mock ? <span className="stage-progress__badge">演示</span> : null}
        </div>
      ) : null}
      <ol className="stage-progress__list">
        {ordered.map((step) => {
          const state = stateOf(step.id)
          return (
            <li key={step.id} className="stage-step" data-status={state.status} data-kind={step.kind}>
              <StatusIcon status={state.status} />
              <span className="stage-step__order">{step.order}</span>
              <span className="stage-step__label">{step.label}</span>
              {step.tag ? (
                <span className={step.kind ? `stage-step__tag stage-step__tag--${step.kind}` : 'stage-step__tag'}>
                  {step.tag}
                </span>
              ) : null}
              {variant === 'full' && step.note ? <span className="stage-step__note">{step.note}</span> : null}
              <span className="stage-step__status">{stageStepText(state)}</span>
              {state.error ? <span className="stage-step__error">{state.error}</span> : null}
            </li>
          )
        })}
      </ol>
      {streamingText ? (
        <p className="stage-progress__stream" aria-live="polite">
          {streamingText}
          <span className="stage-progress__caret" aria-hidden="true" />
        </p>
      ) : null}
    </div>
  )
}

export default StageProgress
