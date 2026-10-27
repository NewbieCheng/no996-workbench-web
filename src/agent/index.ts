/**
 * Agent 编排内核 · 统一出口
 *
 * 使用方式（新增 AI 功能的标准动作）：
 *   1. features/<name>/agent/stages.ts    —— defineFlow 声明阶段（含 kind 诚实标注）
 *   2. features/<name>/agent/prompts.ts   —— 写 «变量» 模板提示词
 *   3. features/<name>/agent/<name>-flow.ts —— 调 runner.runModel / runTool / runAlgo
 *   4. 页面用 createAgentClients + createStageRunner + sink，进度交给 <AgentProgress>
 */
export * from './types'
export * from './models'
export * from './budgets'
export * from './prompt'
export * from './parse'
export * from './runtime'
export * from './hard-check'
export * from './sink'
export * from './registry'
export * from './stream-filter'
export {
  StageRunner,
  createStageRunner,
  type RunModelRequest,
  type RunModelWithToolsRequest,
  type StageRunnerInput,
} from './stage-runner'
export { createAgentClients, createRemoteAgentClients, resolveAgentMode } from './clients'
export { createMockAgentClients, type MockResponder, type AgentClientOptions } from './mock-clients'
export { useAgentRun, type UseAgentRunResult } from './useAgentRun'
