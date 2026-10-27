/**
 * 「了解生产流程」面板 · agent → 通用件的**纯映射**（无 JSX、无 React）。
 *
 * 为什么单独拆一个文件：`scripts/agent-flow-check/entry.ts` 要在本机 Node 里直接断言
 * 「推导出来的数字与文案是诚实的」，而 Node 侧不想把 React / lucide 拖进打包。
 * 与 `stage-progress-model.ts` / `stage-progress.tsx` 同一思路：逻辑归逻辑，画图归画图。
 *
 * **诚实约束**：`tag` 直接取 `roleTag`，不改写、不美化 —— `roleTag` 由 `kind` 推导，
 * 纯算法步骤永远显示「纯算法」，绝不会被这个面板说成 AI；数字也全部由 `kind` 推导。
 */
import { flowKindCounts, flowLeadText, type FlowExplainStep, type FlowKindCounts } from '@no996/ui/flow-explain-model'
import type { AgentStageDef } from '../../agent'

/** `AgentStageDef[]` → 通用件要的步骤形状。也导出给需要同一套数字的调用方（如页头副标题）。 */
export function agentFlowSteps(defs: AgentStageDef[]): FlowExplainStep[] {
  return defs.map((def) => ({
    id: def.id,
    order: def.order,
    label: def.roleName,
    kind: def.kind,
    // 标签与说明都直接取自阶段声明：面板不该有第二份说法，
    // 否则改一处忘一处，面板和进度条就会互相打架。
    tag: def.roleTag,
    note: def.principle,
  }))
}

/**
 * 「N 位 AI 专家协同参与，M 个处理阶段依序执行」（与 flow-explain-model 同源）。
 *
 * 页面**不要手写这两个数字** —— 手写的迟早和 `stages.ts` 对不上，那时候页面就在撒谎。
 * 统一从这里取，改流程时文案自动跟着变。
 */
export function agentFlowLead(defs: AgentStageDef[], lang: 'zh' | 'en' = 'zh'): string {
  return flowLeadText(agentFlowSteps(defs), lang)
}

/**
 * 「几位 AI 专家 / 几道本机环节」的真实数字。
 *
 * 给页头副标题这类需要**单独插值**的地方用（`t('titlesPageDesc', { experts: …, stages: … })`），
 * 免得页面为了取两个数字自己 `filter` 一遍 —— 那样迟早和面板显示的对不上。
 */
export function agentFlowCounts(defs: AgentStageDef[]): FlowKindCounts {
  return flowKindCounts(agentFlowSteps(defs))
}
