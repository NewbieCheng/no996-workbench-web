/**
 * AI 工作流画布 · 纯计算模型（无 JSX、无 React）
 *
 * 负责：
 * 1. 节点类型定义与类型映射（kind → nodeType）
 * 2. 拓扑分列与几何坐标布局（DAG 自动分列并纵向居中）
 * 3. 贝塞尔曲线边数据生成
 * 4. 基于事件日志的时间切片状态推导 stateAt(t)
 * 5. 从快照状态转换为事件日志（打通 AgentRunSnapshot）
 */

export type WorkflowCanvasNodeType = 'input' | 'llm' | 'tool' | 'guard'

export const WORKFLOW_NODE_TYPE_META: Record<
  WorkflowCanvasNodeType,
  { label: string; icon: string; cssVar: string; color: string }
> = {
  input: { label: '输入', icon: 'IN', cssVar: '--awf-input', color: '#2f7df6' },
  llm: { label: '模型推理', icon: 'AI', cssVar: '--awf-llm', color: '#5b4fd6' },
  tool: { label: '联网检索', icon: '网', cssVar: '--awf-tool', color: '#0d8f8f' },
  guard: { label: '本机算法', icon: '算', cssVar: '--awf-guard', color: '#c47a12' },
}

export type WorkflowCanvasNodeDef = {
  id: string
  title: string
  type: WorkflowCanvasNodeType
  /** 流程序号（展示在卡片角标） */
  order?: number
  desc?: string
  deps?: string[]
}

export type LayoutedWorkflowNode = WorkflowCanvasNodeDef & {
  x: number
  y: number
  level: number
}

export type WorkflowEdge = {
  id: string
  from: string
  to: string
  d: string
  fromLevel: number
  toLevel: number
}

export type WorkflowLayoutConfig = {
  nodeWidth: number
  nodeHeight: number
  gapX: number
  gapY: number
}

export const DEFAULT_LAYOUT_CONFIG: WorkflowLayoutConfig = {
  nodeWidth: 280,
  nodeHeight: 168,
  gapX: 88,
  gapY: 40,
}

/**
 * 拓扑分列与几何布局：
 * 根据节点的 deps 计算深度 level，按列放置，各列在全局高度内纵向垂直居中。
 */
export function computeWorkflowLayout(
  nodes: readonly WorkflowCanvasNodeDef[],
  config: WorkflowLayoutConfig = DEFAULT_LAYOUT_CONFIG
): {
  layoutedNodes: LayoutedWorkflowNode[]
  edges: WorkflowEdge[]
  bounds: { width: number; height: number }
} {
  if (!nodes.length) {
    return { layoutedNodes: [], edges: [], bounds: { width: 0, height: 0 } }
  }

  const map = new Map<string, WorkflowCanvasNodeDef>()
  nodes.forEach((n) => map.set(n.id, n))

  // 计算每个节点的拓扑层级（level），防环并带深度上限
  const levels = new Map<string, number>()
  const visited = new Set<string>()

  function getLevel(id: string, depth = 0): number {
    if (depth > 50) return 0
    if (levels.has(id)) return levels.get(id)!
    const node = map.get(id)
    if (!node || !node.deps || node.deps.length === 0) {
      levels.set(id, 0)
      return 0
    }
    if (visited.has(id)) return 0
    visited.add(id)
    let maxDepLevel = 0
    for (const d of node.deps) {
      if (map.has(d)) {
        maxDepLevel = Math.max(maxDepLevel, getLevel(d, depth + 1) + 1)
      }
    }
    visited.delete(id)
    levels.set(id, maxDepLevel)
    return maxDepLevel
  }

  nodes.forEach((n) => getLevel(n.id))

  // 按 level 分列
  const cols = new Map<number, WorkflowCanvasNodeDef[]>()
  nodes.forEach((n) => {
    const lv = levels.get(n.id) ?? 0
    if (!cols.has(lv)) cols.set(lv, [])
    cols.get(lv)!.push(n)
  })

  const colKeys = Array.from(cols.keys()).sort((a, b) => a - b)
  const maxRows = Math.max(...colKeys.map((k) => cols.get(k)!.length))
  const totalH = Math.max(
    config.nodeHeight,
    maxRows * (config.nodeHeight + config.gapY) - config.gapY
  )

  const layoutedMap = new Map<string, LayoutedWorkflowNode>()
  const layoutedNodes: LayoutedWorkflowNode[] = []

  colKeys.forEach((colIndex) => {
    const colNodes = cols.get(colIndex)!
    const colHeight =
      colNodes.length * (config.nodeHeight + config.gapY) - config.gapY
    const offsetY = (totalH - colHeight) / 2
    const x = colIndex * (config.nodeWidth + config.gapX)

    colNodes.forEach((node, rowIndex) => {
      const y = offsetY + rowIndex * (config.nodeHeight + config.gapY)
      const layouted: LayoutedWorkflowNode = {
        ...node,
        x,
        y,
        level: colIndex,
      }
      layoutedMap.set(node.id, layouted)
      layoutedNodes.push(layouted)
    })
  })

  // 生成连线（三次贝塞尔曲线）
  const edges: WorkflowEdge[] = []
  nodes.forEach((node) => {
    const toNode = layoutedMap.get(node.id)
    if (!toNode || !node.deps) return
    node.deps.forEach((depId) => {
      const fromNode = layoutedMap.get(depId)
      if (!fromNode) return
      const x1 = fromNode.x + config.nodeWidth
      const y1 = fromNode.y + config.nodeHeight / 2
      const x2 = toNode.x
      const y2 = toNode.y + config.nodeHeight / 2
      const dx = Math.max(20, (x2 - x1) / 2)
      const d = `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`
      edges.push({
        id: `${depId}->${node.id}`,
        from: depId,
        to: node.id,
        d,
        fromLevel: fromNode.level,
        toLevel: toNode.level,
      })
    })
  })

  const maxX = Math.max(...layoutedNodes.map((n) => n.x + config.nodeWidth))
  const maxY = Math.max(...layoutedNodes.map((n) => n.y + config.nodeHeight))

  return {
    layoutedNodes,
    edges,
    bounds: { width: maxX, height: maxY },
  }
}

/* --------------------------- 状态机与时间切片 --------------------------- */

export type WorkflowNodeStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

/** 条件尚未判定时分支待定；判定后命中路径完成，未命中路径跳过。 */
export function resolveBranchNodeStatus<T extends string>(
  selectedOutcome: T | undefined,
  branchOutcome: T,
): WorkflowNodeStatus {
  if (selectedOutcome === undefined) return 'pending'
  return selectedOutcome === branchOutcome ? 'done' : 'skipped'
}

export type WorkflowLogEvent = {
  t: number
  id: string
  kind: 'start' | 'text' | 'end'
  /** end 事件中，'skipped' 表示条件分支本次未命中，其他 truthy 值表示失败，false 表示完成。 */
  v?: string | number | boolean
}

export type WorkflowNodeRuntimeState = {
  status: WorkflowNodeStatus
  text: string
  /** 思考/假设等，默认在侧栏遮挡展示 */
  thinkingText?: string
  startedAt: number
  finishedAt: number
}

export type WorkflowRuntimeState = Record<string, WorkflowNodeRuntimeState>

/**
 * 根据时间戳 t (从 0 到 totalDuration 毫秒)，纯函数推导出该时刻所有节点的状态与输出
 */
export function stateAt(
  nodeIds: readonly string[],
  log: readonly WorkflowLogEvent[],
  t: number
): WorkflowRuntimeState {
  const s: WorkflowRuntimeState = {}
  nodeIds.forEach((id) => {
    s[id] = { status: 'pending', text: '', startedAt: 0, finishedAt: 0 }
  })

  for (const e of log) {
    if (e.t > t) break
    const x = s[e.id]
    if (!x) continue
    if (e.kind === 'start') {
      x.status = 'running'
      x.startedAt = e.t
    } else if (e.kind === 'text') {
      x.text += typeof e.v === 'string' ? e.v : ''
    } else if (e.kind === 'end') {
      x.status = e.v === 'skipped' ? 'skipped' : e.v ? 'error' : 'done'
      x.finishedAt = e.t
    }
  }

  return s
}

/** 将误用 wall-clock 毫秒的事件流平移到从 0 开始的回放轴 */
export function normalizeWorkflowEventTimes(
  log: readonly WorkflowLogEvent[],
): WorkflowLogEvent[] {
  if (!log.length) return []
  const tMin = Math.min(...log.map((e) => e.t))
  if (tMin <= 1e11) return [...log]
  return log.map((e) => ({ ...e, t: e.t - tMin }))
}

/** 计算事件流总耗时 (ms)，相对回放轴 */
export function computeTotalDuration(log: readonly WorkflowLogEvent[]): number {
  const normalized = normalizeWorkflowEventTimes(log)
  if (!normalized.length) return 0
  return Math.max(0, normalized[normalized.length - 1].t)
}

/** 计算当前完成步骤数与进度百分比 (0 - 100) */
export function computeProgress(
  totalCount: number,
  state: WorkflowRuntimeState
): { doneCount: number; runningNodeId?: string; percent: number } {
  if (totalCount <= 0) return { doneCount: 0, percent: 0 }
  let doneCount = 0
  let runningNodeId: string | undefined

  for (const [id, s] of Object.entries(state)) {
    if (s.status === 'done' || s.status === 'skipped') doneCount++
    if (s.status === 'running') runningNodeId = id
  }

  const percent = Math.min(100, Math.round((doneCount / totalCount) * 100))
  return { doneCount, runningNodeId, percent }
}
