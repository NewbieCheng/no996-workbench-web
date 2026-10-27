import { FlowExplain, type FlowExplainProps } from '@no996/ui/flow-explain'
import type { AgentStageDef } from '../../agent'
import { agentFlowSteps } from './flow-explain-map'

/**
 * 「了解生产流程」面板 · agent 适配层。
 *
 * 为什么要有这一层：通用件 `@no996/ui/flow-explain` 只认「步骤」这种任何板块都有的形状，
 * 不认识 agent 的 `roleName` / `roleTag` / `kind`。映射只写在这一处（`flow-explain-map.ts`），
 * 三个创作页不必各自知道字段怎么对上（与 `AgentProgress` 同一思路）。
 *
 * 用法：与 `WorkbenchPageViewTabs` 一并放进 `Page` 的 `titleExtra`（标题右侧 `page-title-extra`），
 * 页面上只是一颗带专家数角标的小按钮，点开才弹出面板。
 */
export type AgentFlowExplainProps = Omit<FlowExplainProps, 'steps'> & {
  defs: AgentStageDef[]
}

export function AgentFlowExplain({ defs, ...rest }: AgentFlowExplainProps) {
  return <FlowExplain {...rest} steps={agentFlowSteps(defs)} />
}

export { agentFlowCounts, agentFlowLead, agentFlowSteps } from './flow-explain-map'

export default AgentFlowExplain
