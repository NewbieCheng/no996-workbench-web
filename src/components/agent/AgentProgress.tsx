import type { AgentStageDef, AgentStageState } from '../../agent'
import {
  StageProgress,
  stageProgressPercent,
  stageProgressText,
  type StageProgressState,
  type StageProgressStep,
} from '@no996/ui/stage-progress'

/**
 * Agent 步骤进度：把通用步骤进度条（`@no996/ui/stage-progress`）接到 agent 内核的
 * `AgentStageDef` / `AgentStageState` 上。
 *
 * 为什么要这一层：通用件只认「步骤 + 状态」这种任何板块都有的形状，不认识 `roleName` /
 * `principle` / `kind` 这些 agent 字段。映射只写这一处，三个创作页与 `WorkflowRunCard`
 * 不必各自知道字段怎么对上。
 *
 * 状态文案与耗时文案都由通用件提供，这里原样再导出 —— `AgentStageDetail` 一直在用同一份
 * `AGENT_STATUS_LABEL`，两个面板说法必须一致（各写一套时真机复测就抓出过不一致）。
 */
export type AgentProgressProps = {
  stages: AgentStageState[]
  defs: AgentStageDef[]
  variant?: 'compact' | 'full'
  /** 例如「第 2 轮」；不传则不显示轮次 */
  roundText?: string
  /** 当前正在执行并需要打字展示的文本 */
  streamingText?: string
  /** 演示模式标记 */
  mock?: boolean
  /**
   * 藏掉面板自带的「创作过程」标题。
   * 用于外层已经给了更贴切标题的场景（如标题页左栏叫「接力过程」），
   * 避免同一块出现两个标题；轮次与「演示」徽标不受影响。
   */
  hideTitle?: boolean
  /**
   * 藏掉面板内的「第 N 步 / 共 M 步」。
   * 默认藏：外层卡头（`WorkflowRunCard`）已经在写同一个数字，卡内再印一遍就是重复。
   * 直接嵌在页面里、外面没有进度文案时传 `false`。
   */
  showProgress?: boolean
}

function toSteps(defs: AgentStageDef[]): StageProgressStep[] {
  return defs.map((def) => ({
    id: def.id,
    order: def.order,
    label: def.roleName,
    kind: def.kind,
    tag: def.roleTag,
    note: def.principle,
  }))
}

function toStates(stages: AgentStageState[]): StageProgressState[] {
  return stages.map((s) => ({
    id: s.id,
    status: s.status,
    headline: s.headline,
    error: s.error,
    startedAt: s.startedAt,
    finishedAt: s.finishedAt,
    progress: s.progress,
  }))
}

/**
 * 「第 N 步 / 共 M 步」文案，喂给外层卡头用。
 * 与面板内用的是同一个算法（公共件里的 `stageProgressText`），别在卡头自己再算一遍 ——
 * 各写一套时同一个数字会算出两个值。
 */
export function agentProgressText(defs: AgentStageDef[], stages: AgentStageState[]): string | undefined {
  return stageProgressText(toSteps(defs), toStates(stages))
}

export function agentProgressPercent(defs: AgentStageDef[], stages: AgentStageState[]): number {
  return stageProgressPercent(toSteps(defs), toStates(stages))
}

export function AgentProgress({
  stages,
  defs,
  variant = 'compact',
  roundText,
  streamingText,
  mock,
  hideTitle,
  showProgress,
}: AgentProgressProps) {
  return (
    <StageProgress
      steps={toSteps(defs)}
      states={toStates(stages)}
      variant={variant}
      title={hideTitle ? undefined : '创作过程'}
      roundText={roundText}
      streamingText={streamingText}
      mock={mock}
      hideProgress={!showProgress}
    />
  )
}

export default AgentProgress

export { STAGE_STATUS_LABEL as AGENT_STATUS_LABEL, stageDurationText } from '@no996/ui/stage-progress'
