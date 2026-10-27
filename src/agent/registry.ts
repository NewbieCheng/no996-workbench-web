/**
 * 流程注册表：新增 AI 功能时在此登记，供任务中心、调试面板与文档统一读取。
 */
import type { AgentFlowDefinition, AgentStageDef } from './types'

const flows = new Map<string, AgentFlowDefinition>()

/** 声明一个流程（阶段顺序由 order 决定） */
export function defineFlow(id: string, stages: AgentStageDef[]): AgentFlowDefinition {
  const def: AgentFlowDefinition = {
    id,
    stages: [...stages].sort((a, b) => a.order - b.order),
  }
  flows.set(id, def)
  return def
}

export function getFlow(id: string): AgentFlowDefinition | undefined {
  return flows.get(id)
}

export function listFlows(): AgentFlowDefinition[] {
  return Array.from(flows.values())
}

/** 阶段类型标签的唯一来源，确保「纯算法」不会被写成 AI */
export function roleTagFor(kind: AgentStageDef['kind'], override?: string): string {
  if (override) return override
  if (kind === 'algo') return '纯算法'
  if (kind === 'tool') return '检索'
  return 'AI'
}
