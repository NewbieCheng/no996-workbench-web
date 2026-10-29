/**
 * 通用步骤进度条的**纯逻辑**（无 JSX、无 React），单独一个模块是为了能被单测直接 import。
 *
 * 组件本体 `stage-progress.tsx` 只负责渲染，把「状态文案 / 进度文案 / 耗时文案」的计算留在这里。
 */

export type StageProgressStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'

export type StageProgressStep = {
  /** 稳定 id，用来和 `states` 对上 */
  id: string
  /** 显示序号 */
  order: number
  /** 这一步是谁在做（角色名 / 环节名） */
  label: string
  /** 可选类型标签（如 `model` / `algo` / `tool`），驱动默认样式与 `data-kind` */
  kind?: string
  /** 类型标签的文案（如「模型」「算法」）；不传则不渲染标签 */
  tag?: string
  /** 这一步在做什么；`variant === 'full'` 时展示 */
  note?: string
}

export type StageProgressState = {
  id: string
  status: StageProgressStatus
  /** 运行中的一句话，**只在 `status === 'running'` 时展示** */
  headline?: string
  error?: string
  startedAt?: number
  finishedAt?: number
  /** 阶段内细进度（如逐张生图 2/4）；只影响运行中那一步的百分比，不改变阶段状态。 */
  progress?: {
    done: number
    total: number
    label?: string
  }
}

export type StageProgressProps = {
  steps: StageProgressStep[]
  /** 步骤状态；没出现的 id 按「待执行」渲染 */
  states: StageProgressState[]
  variant?: 'compact' | 'full'
  /** 面板标题；不传则头部只显示进度 / 轮次 / 演示徽标 */
  title?: string
  /** 例如「第 2 轮」；不传则不显示轮次 */
  roundText?: string
  /** 当前正在长出来的正文（**必须**是可展示文本，别把 JSON 塞进来） */
  streamingText?: string
  /** 演示模式标记 */
  mock?: boolean
  /** 外层已经报过进度时藏掉面板内的进度文案，避免同一个数字出现两次 */
  hideProgress?: boolean
}

/** 步骤状态的统一文案。导出给「详情」类组件用，避免两个面板各写一套后说法不一致。 */
export const STAGE_STATUS_LABEL: Record<StageProgressStatus, string> = {
  idle: '待执行',
  running: '进行中',
  done: '已完成',
  failed: '失败',
  skipped: '已跳过',
}

/** 按 `order` 升序排好，并补上缺 state 的步骤（按「待执行」）。 */
export function normalizeSteps(
  steps: StageProgressStep[],
  states: StageProgressState[],
): { ordered: StageProgressStep[]; stateOf: (id: string) => StageProgressState } {
  const byId = new Map(states.map((s) => [s.id, s]))
  const ordered = [...steps].sort((a, b) => a.order - b.order)
  return {
    ordered,
    stateOf: (id) => byId.get(id) ?? { id, status: 'idle' },
  }
}

/**
 * 进度文案，如「第 3 步 / 共 8 步」。**只报实测到的位置**：
 * 有 `running` 就取那一步，否则取「已完成 + 1」；一步都还没完成时返回 `undefined`
 * —— 还没开跑，报「第 1 步」是猜的，不是实测值。
 */
export function stageProgressText(steps: StageProgressStep[], states: StageProgressState[]): string | undefined {
  const total = steps.length
  if (!total) return undefined
  const { ordered, stateOf } = normalizeSteps(steps, states)
  const doneCount = ordered.filter((s) => stateOf(s.id).status === 'done').length
  const runningIndex = ordered.findIndex((s) => stateOf(s.id).status === 'running') + 1
  const current = runningIndex || (doneCount > 0 && doneCount < total ? doneCount + 1 : 0)
  if (!current) return undefined
  return `第 ${Math.min(current, total)} 步 / 共 ${total} 步`
}

/** 0–100，供卡头进度条使用；与 `stageProgressText` 同源状态，不另造规则。 */
export function stageProgressPercent(steps: StageProgressStep[], states: StageProgressState[]): number {
  const total = steps.length
  if (!total) return 0
  const { ordered, stateOf } = normalizeSteps(steps, states)
  const doneCount = ordered.filter((s) => stateOf(s.id).status === 'done').length
  if (doneCount >= total) return 100
  const running = ordered
    .map((s) => ({ step: s, state: stateOf(s.id) }))
    .find((item) => item.state.status === 'running')
  if (running) {
    const progress = running.state.progress
    const fraction =
      progress && progress.total > 0
        ? Math.max(0, Math.min(1, progress.done / progress.total))
        : 0.5
    return Math.min(99, Math.round(((doneCount + fraction) / total) * 100))
  }
  if (doneCount > 0) return Math.round((doneCount / total) * 100)
  return 0
}

/**
 * 一步的耗时文案。**没有真实计时就返回 undefined**，调用方据此不渲染耗时。
 *
 * 为什么这么写：曾经有调用点算的是
 * `Math.max(1, Math.round(((finishedAt ?? 0) - (startedAt ?? 0)) / 1000))`。
 * 缺计时时它算出 0，再被 `Math.max(1, …)` 抬成「完成 1s」—— **一个凭空捏造的耗时**。
 * 缺数据就该不显示，而不是兜一个数。
 */
export function stageDurationText(state?: { startedAt?: number; finishedAt?: number }): string | undefined {
  const started = state?.startedAt
  const finished = state?.finishedAt
  if (typeof started !== 'number' || typeof finished !== 'number') return undefined
  const ms = finished - started
  if (!Number.isFinite(ms) || ms < 0) return undefined
  return ms < 1000 ? '不到 1s' : `${Math.round(ms / 1000)}s`
}

/** `headline`（如「正在拆解客群定位…」）是运行中文案，跑完还展示会和「已完成」自相矛盾。 */
export function stageStepText(state: StageProgressState): string {
  return state.status === 'running' ? state.headline || STAGE_STATUS_LABEL[state.status] : STAGE_STATUS_LABEL[state.status]
}
