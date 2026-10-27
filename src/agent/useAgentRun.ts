/**
 * React 侧运行态：订阅 sink 发布的快照。
 *
 * 与 WorkbenchUI 的 useDemoGeneration 刻意区分：
 * - useDemoGeneration 是演示页的本地确定性样例
 * - useAgentRun 是真实 agent 流程（可能入队、可能调正式模型）
 * 两者不合并，避免把「演示」伪装成「真实」。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { createMemorySink, type MemorySinkHandle } from './sink'
import { createAgentClients } from './clients'
import type { AgentClientOptions } from './mock-clients'
import type { AgentClients, AgentRunSnapshot } from './types'

export type UseAgentRunResult = {
  snapshot: AgentRunSnapshot | null
  /** 是否演示模式（UI 必须据此显示「演示」标记） */
  isMock: boolean
  running: boolean
  /** 在页内直接运行一个流程时把 sink 交给 flow */
  sink: MemorySinkHandle['sink']
  /** 清空上一轮快照 */
  reset: () => void
  /** 页内运行所需的客户端（已按 demo/远端解析） */
  clients: AgentClients
}

/**
 * 页内运行一个 agent 流程（demo / 远端自动判定）。
 *
 * 注意与 useDemoGeneration 的区别：那是演示页的本地确定性样例，
 * 这里是真的跑 agent 流程。两者不合并，避免把演示伪装成真实。
 *
 * @param flowId 用于快照标识
 * @param options 演示模式下的业务应答器
 */
export function useAgentRun(flowId: string, options: AgentClientOptions = {}): UseAgentRunResult {
  const handleRef = useRef<MemorySinkHandle | null>(null)
  if (!handleRef.current) handleRef.current = createMemorySink(flowId)
  const handle = handleRef.current

  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(handle.getSnapshot())
  const clientsRef = useRef<AgentClients | null>(null)
  if (!clientsRef.current) clientsRef.current = createAgentClients(options)

  useEffect(() => handle.subscribe(setSnapshot), [handle])

  /** 清空上一轮快照（开始新一次运行前调用） */
  const reset = useCallback(() => setSnapshot(null), [])

  return {
    snapshot,
    isMock: clientsRef.current.isMock,
    running: snapshot?.status === 'running',
    sink: handle.sink,
    reset,
    clients: clientsRef.current,
  }
}
