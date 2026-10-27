import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from './button'
import { cn } from './utils'
import {
  computeProgress,
  computeTotalDuration,
  computeWorkflowLayout,
  normalizeWorkflowEventTimes,
  stateAt,
  WORKFLOW_NODE_TYPE_META,
  type LayoutedWorkflowNode,
  type WorkflowCanvasNodeDef,
  type WorkflowLogEvent,
  type WorkflowNodeRuntimeState,
  type WorkflowRuntimeState,
} from './workflow-canvas-model'

/** 真实 wall-clock（ms）与画布内合成时间轴（小数值 ms）区分展示 */
function isWallClockMs(t: number): boolean {
  return t > 1e11
}

function formatWorkflowStartLabel(t: number): string {
  if (!t || t <= 0) return '—'
  if (isWallClockMs(t)) {
    return new Date(t).toLocaleTimeString('zh-CN', { hour12: false })
  }
  return `${(t / 1000).toFixed(2)}s`
}

function formatPlaybackClock(ms: number): string {
  if (!ms || ms < 0) return '0.0s'
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.floor(s % 60)
  return `${m}:${String(rem).padStart(2, '0')}`
}

function formatWorkflowDurationMs(startedAt: number, finishedAt: number): string {
  if (!startedAt || !finishedAt || finishedAt <= startedAt) return '—'
  const ms = finishedAt - startedAt
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export type WorkflowCanvasProps = {
  title?: string
  nodes: readonly WorkflowCanvasNodeDef[]
  /** 外部直接传入的节点实时状态字典（与 events 二选一或配合使用） */
  runtimeState?: WorkflowRuntimeState
  /** 完整的事件日志流，用于时间轴回放与切片推导 */
  events?: readonly WorkflowLogEvent[]
  /** 外部指明的当前运行中节点 */
  activeNodeId?: string
  onSelectNode?: (node: LayoutedWorkflowNode | null) => void
  onRetryNode?: (nodeId: string) => void
  canRetryNode?: (nodeId: string) => boolean
  retryDisabledReason?: string
  className?: string
}

export function WorkflowCanvas({
  title = 'AI 工作流',
  nodes,
  runtimeState,
  events = [],
  activeNodeId,
  onSelectNode,
  onRetryNode,
  canRetryNode,
  retryDisabledReason = '此步骤缺少可恢复检查点，请从第一步重新生成。',
  className,
}: WorkflowCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [cam, setCam] = useState({ x: 0, y: 0, k: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [isSmooth, setIsSmooth] = useState(true)
  const [follow, setFollow] = useState(true)
  const [live, setLive] = useState(true)
  const [viewT, setViewT] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [thinkingRevealed, setThinkingRevealed] = useState(false)
  const [outputCopied, setOutputCopied] = useState(false)
  const [outputCopyError, setOutputCopyError] = useState(false)
  const copyFeedbackTimerRef = useRef<number | null>(null)
  const replayRef = useRef<number | null>(null)
  const initialFitDoneRef = useRef(false)
  const userAdjustedCamRef = useRef(false)
  const lastLayoutKeyRef = useRef('')

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current)
  }, [])

  const handleCopyOutput = useCallback(async (text: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(text)
      setOutputCopied(true)
      setOutputCopyError(false)
      if (copyFeedbackTimerRef.current !== null) window.clearTimeout(copyFeedbackTimerRef.current)
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setOutputCopied(false)
        copyFeedbackTimerRef.current = null
      }, 1800)
    } catch {
      setOutputCopied(false)
      setOutputCopyError(true)
    }
  }, [])

  // 1. 拓扑与几何布局计算
  const { layoutedNodes, edges } = useMemo(() => {
    return computeWorkflowLayout(nodes)
  }, [nodes])

  const nodeMap = useMemo(() => {
    const map = new Map<string, LayoutedWorkflowNode>()
    layoutedNodes.forEach((n) => map.set(n.id, n))
    return map
  }, [layoutedNodes])

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes])

  // 2. 总时长与当前推导状态（回放轴始终从 0 起算）
  const playbackEvents = useMemo(() => normalizeWorkflowEventTimes(events), [events])
  const totalDuration = useMemo(() => computeTotalDuration(playbackEvents), [playbackEvents])

  // 如果是在实时模式且有 events，自动跟到最新时间
  useEffect(() => {
    if (live && totalDuration > 0) {
      setViewT(totalDuration)
    }
  }, [live, totalDuration])

  // 当前呈现的状态机字典
  const currentState: WorkflowRuntimeState = useMemo(() => {
    if (!events.length && runtimeState) {
      return runtimeState
    }
    if (playbackEvents.length > 0) {
      const derived = stateAt(
        nodeIds,
        playbackEvents,
        live ? totalDuration || Infinity : viewT,
      )
      if (live && runtimeState) {
        const merged: WorkflowRuntimeState = { ...derived }
        for (const id of nodeIds) {
          const rs = runtimeState[id]
          const dr = derived[id]
          if (!rs) continue
          merged[id] = {
            ...(dr ?? { status: 'pending', text: '', startedAt: 0, finishedAt: 0 }),
            ...rs,
            text: rs.text?.length ? rs.text : (dr?.text ?? ''),
            thinkingText: rs.thinkingText?.length ? rs.thinkingText : dr?.thinkingText,
          }
        }
        return merged
      }
      return derived
    }
    // 降级：全 pending
    const fallback: WorkflowRuntimeState = {}
    nodeIds.forEach((id) => {
      fallback[id] = { status: 'pending', text: '', startedAt: 0, finishedAt: 0 }
    })
    return fallback
  }, [playbackEvents, events.length, nodeIds, live, totalDuration, viewT, runtimeState])

  // 3. 计算完成度与当前正在执行的步骤
  const { doneCount, runningNodeId, percent } = useMemo(() => {
    return computeProgress(nodes.length, currentState)
  }, [nodes.length, currentState])

  const effectiveRunningId = activeNodeId ?? runningNodeId

  // 4. 自适应居中 (Fit)
  const fitToScreen = useCallback(
    (smooth = true) => {
      const container = containerRef.current
      if (!container || !layoutedNodes.length) return
      const rect = container.getBoundingClientRect()
      if (!rect.width || !rect.height) return

      const W = 280
      const H = 168
      const bw = Math.max(...layoutedNodes.map((n) => n.x + W))
      const bh = Math.max(...layoutedNodes.map((n) => n.y + H))

      const k = Math.min(1, (rect.width - 80) / bw, (rect.height - 180) / bh)
      const nextK = Math.max(0.25, Math.min(1.2, k))
      setIsSmooth(smooth)
      setCam({
        k: nextK,
        x: (rect.width - bw * nextK) / 2,
        y: (rect.height - bh * nextK) / 2 + 15,
      })
    },
    [layoutedNodes]
  )

  const nodeLayoutKey = nodeIds.join('|')

  // 5. 聚焦到指定节点 (Focus)：跟随时只平移，保留用户缩放倍数
  const focusNode = useCallback(
    (id: string) => {
      const target = nodeMap.get(id)
      const container = containerRef.current
      if (!target || !container) return
      const rect = container.getBoundingClientRect()
      const W = 280
      const H = 168

      setIsSmooth(true)
      setCam((prev) => ({
        k: prev.k,
        x: rect.width / 2 - (target.x + W / 2) * prev.k,
        y: rect.height / 2 - (target.y + H / 2) * prev.k,
      }))
    },
    [nodeMap]
  )

  // 首次有布局时适应；拓扑 id 变化且仍开启跟随时才再适应（流式更新不反复 fit）
  useEffect(() => {
    if (!layoutedNodes.length) return
    if (!initialFitDoneRef.current) {
      fitToScreen(false)
      initialFitDoneRef.current = true
      lastLayoutKeyRef.current = nodeLayoutKey
      return
    }
    if (nodeLayoutKey !== lastLayoutKeyRef.current) {
      lastLayoutKeyRef.current = nodeLayoutKey
      if (follow && !userAdjustedCamRef.current) {
        fitToScreen(false)
      }
    }
  }, [nodeLayoutKey, layoutedNodes.length, fitToScreen, follow])

  // 镜头自动跟随正在运行的节点（仅在运行节点切换时平移）
  const lastFollowedRunningRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!follow || !effectiveRunningId) {
      lastFollowedRunningRef.current = undefined
      return
    }
    if (lastFollowedRunningRef.current === effectiveRunningId) return
    lastFollowedRunningRef.current = effectiveRunningId
    focusNode(effectiveRunningId)
  }, [follow, effectiveRunningId, focusNode])

  // 缩放操作
  const zoom = useCallback(
    (factor: number, cx?: number, cy?: number) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const mx = cx ?? rect.width / 2
      const my = cy ?? rect.height / 2

      userAdjustedCamRef.current = true
      setCam((prev) => {
        const nextK = Math.min(2, Math.max(0.25, prev.k * factor))
        return {
          k: nextK,
          x: mx - ((mx - prev.x) * nextK) / prev.k,
          y: my - ((my - prev.y) * nextK) / prev.k,
        }
      })
    },
    []
  )

  // 交互拖拽
  const dragStartRef = useRef<{ clientX: number; clientY: number; cx: number; cy: number } | null>(
    null
  )

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.awf-node, .awf-hud')) return
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      cx: cam.x,
      cy: cam.y,
    }
    setIsDragging(true)
    setIsSmooth(false)
    setFollow(false)
    userAdjustedCamRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current
    if (!start) return
    const dx = e.clientX - start.clientX
    const dy = e.clientY - start.clientY
    setCam((prev) => ({
      ...prev,
      x: start.cx + dx,
      y: start.cy + dy,
    }))
  }

  const handlePointerUp = () => {
    dragStartRef.current = null
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setIsSmooth(false)
    setFollow(false)
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const factor = Math.exp(-e.deltaY * 0.0015)
    zoom(factor, e.clientX - rect.left, e.clientY - rect.top)
  }

  // 节点选择
  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id)
    setThinkingRevealed(false)
    onSelectNode?.(id ? nodeMap.get(id) ?? null : null)
  }

  // 回放功能
  const handleReplay = () => {
    if (totalDuration <= 0) return
    setLive(false)
    if (replayRef.current) cancelAnimationFrame(replayRef.current)

    const startTime = performance.now()
    const speed = 2.5 // 2.5倍速回放

    const step = () => {
      const elapsed = (performance.now() - startTime) * speed
      if (elapsed >= totalDuration) {
        setViewT(totalDuration)
        replayRef.current = null
      } else {
        setViewT(elapsed)
        replayRef.current = requestAnimationFrame(step)
      }
    }
    replayRef.current = requestAnimationFrame(step)
  }

  useEffect(() => {
    return () => {
      if (replayRef.current) cancelAnimationFrame(replayRef.current)
    }
  }, [])

  // 选中节点的运行时详情
  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null
  const selectedState = selectedNodeId ? currentState[selectedNodeId] : null
  const selectedTypeMeta = selectedNode
    ? WORKFLOW_NODE_TYPE_META[selectedNode.type] ?? WORKFLOW_NODE_TYPE_META.llm
    : null

  const runningNodeObj = effectiveRunningId ? nodeMap.get(effectiveRunningId) : null

  return (
    <div
      ref={containerRef}
      className={['awf-viewport', isDragging && 'is-dragging', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        backgroundPosition: `${cam.x}px ${cam.y}px`,
        backgroundSize: `${24 * cam.k}px ${24 * cam.k}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      role="region"
      aria-label={title}
    >
      {/* 画布主舞台 */}
      <div
        className={['awf-stage', isSmooth && 'is-smooth'].filter(Boolean).join(' ')}
        style={{
          transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`,
        }}
      >
        {/* SVG 连线层 */}
        <svg className="awf-edges">
          {edges.map((edge) => {
            const fromState = currentState[edge.from]
            const toState = currentState[edge.to]
            const isDone =
              (fromState?.status === 'done' || fromState?.status === 'error') &&
              toState &&
              (toState.status === 'done' || toState.status === 'error')
            const isFlow =
              fromState?.status === 'done' && toState?.status === 'running'
            const isSkipped = fromState?.status === 'skipped' || toState?.status === 'skipped'

            return (
              <path
                key={edge.id}
                d={edge.d}
                className={[isDone && 'is-done', isFlow && 'is-flow', isSkipped && 'is-skipped']
                  .filter(Boolean)
                  .join(' ')}
              />
            )
          })}
        </svg>

        {/* 节点层 */}
        {layoutedNodes.map((node) => {
          const typeMeta =
            WORKFLOW_NODE_TYPE_META[node.type] ?? WORKFLOW_NODE_TYPE_META.llm
          const state: WorkflowNodeRuntimeState = currentState[node.id] ?? {
            status: 'pending',
            text: '',
            startedAt: 0,
            finishedAt: 0,
          }
          const isSelected = selectedNodeId === node.id
          const durationSec =
            state.finishedAt > state.startedAt
              ? ((state.finishedAt - state.startedAt) / 1000).toFixed(1)
              : null

          return (
            <div
              key={node.id}
              className={[
                'awf-node',
                isSelected && 'is-selected',
              ]
                .filter(Boolean)
                .join(' ')}
              data-id={node.id}
              data-status={state.status}
              tabIndex={0}
              style={
                {
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '280px',
                  height: '168px',
                  '--c': `var(${typeMeta.cssVar})`,
                } as React.CSSProperties
              }
              onClick={(e) => {
                e.stopPropagation()
                handleSelectNode(node.id)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  handleSelectNode(node.id)
                }
              }}
            >
              <i className="awf-bar" aria-hidden="true" />
              {node.order != null ? (
                <span className="awf-seq" aria-hidden="true">{node.order}</span>
              ) : null}
              <div className="awf-hd">
                <span className="awf-ic" aria-hidden="true">{typeMeta.icon}</span>
                <span className="awf-ti" title={node.title}>
                  {node.title}
                </span>
                <span className="awf-st">
                  {state.status === 'done'
                    ? durationSec ? `${durationSec}s` : '已完成'
                    : state.status === 'running'
                      ? '执行中'
                      : state.status === 'error'
                        ? '失败'
                        : state.status === 'skipped'
                          ? '未命中'
                          : '待命'}
                </span>
              </div>
              <div className="awf-ds" title={node.desc}>
                <span className="awf-ds__kind">{typeMeta.label}</span>
                {node.desc ? <span className="awf-ds__text">{node.desc}</span> : null}
              </div>
              <div className="awf-out">
                <div>
                  {state.text || ''}
                  {state.status === 'running' ? (
                    <span className="awf-cur" aria-hidden="true" />
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 顶部状态 HUD */}
      <div className="awf-hud awf-top">
        <b>{title}</b>
        <div className="awf-prog">
          <i style={{ width: `${percent}%` }} />
        </div>
        <div className="awf-sub">
          {doneCount === nodes.length
            ? `流程已结束 · 共处理 ${nodes.length} 个节点`
            : runningNodeObj
              ? `当前阶段：${runningNodeObj.title}（${doneCount + 1}/${nodes.length}）`
              : `待命 · 0/${nodes.length}`}
        </div>
      </div>

      {/* 右上角操作控制器 HUD */}
      <div className="awf-hud awf-ctl">
        <button
          type="button"
          className={follow ? 'is-active' : ''}
          onClick={() => setFollow((v) => !v)}
          title="镜头跟随当前运行步骤"
        >
          跟随
        </button>
        <button
          type="button"
          onClick={() => {
            setFollow(false)
            userAdjustedCamRef.current = false
            fitToScreen(true)
          }}
          title="适应全部画面"
        >
          适应
        </button>
        <button
          type="button"
          onClick={() => {
            setFollow(false)
            zoom(0.8)
          }}
          title="缩小"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => {
            setFollow(false)
            zoom(1.25)
          }}
          title="放大"
        >
          +
        </button>
      </div>

      {/* 底部时间轴 HUD */}
      {totalDuration > 0 ? (
        <div className="awf-hud awf-tl">
          <button type="button" onClick={handleReplay} title="从头回放执行流程">
            ⟲ 回放
          </button>
          <input
            type="range"
            className="awf-tl-range"
            min={0}
            max={totalDuration}
            value={live ? totalDuration : viewT}
            style={
              {
                '--awf-tl-fill':
                  totalDuration > 0
                    ? `${(100 * (live ? totalDuration : viewT)) / totalDuration}%`
                    : '0%',
              } as CSSProperties
            }
            onChange={(e) => {
              setLive(false)
              if (replayRef.current) cancelAnimationFrame(replayRef.current)
              setViewT(Number(e.target.value))
            }}
            aria-label="执行时间轴"
          />
          <Button
            type="button"
            variant="outline"
            className={cn('awf-tl-live', live && 'is-active')}
            onClick={() => {
              setLive(true)
              if (replayRef.current) cancelAnimationFrame(replayRef.current)
              setViewT(totalDuration)
            }}
            title="查看最新实时状态"
          >
            实时
          </Button>
          <span>
            {formatPlaybackClock(live ? totalDuration : viewT)} /{' '}
            {formatPlaybackClock(totalDuration)}
          </span>
        </div>
      ) : null}

      {/* 右侧节点详情抽屉 */}
      <aside
        className={['awf-hud awf-dr', selectedNode && 'is-open']
          .filter(Boolean)
          .join(' ')}
      >
        {selectedNode && selectedState && selectedTypeMeta ? (
          <>
            <div className="awf-dr-hd">
              <div>
                <h3>{selectedNode.title}</h3>
                <div className="awf-sub">
                  {selectedTypeMeta.label}节点{' '}
                  {selectedNode.desc ? `· ${selectedNode.desc}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="awf-dr-close"
                onClick={() => handleSelectNode(null)}
                aria-label="关闭详情"
              >
                ✕
              </button>
            </div>

            <dl>
              <dt>状态</dt>
              <dd>
                {{
                  pending: '等待中',
                  running: '正在运行',
                  done: '已完成',
                  error: '失败',
                  skipped: '未命中',
                }[selectedState.status]}
              </dd>
              <dt>依赖上游</dt>
              <dd>
                {selectedNode.deps?.length
                  ? selectedNode.deps
                      .map((d) => nodeMap.get(d)?.title ?? d)
                      .join('、')
                  : '无（流程起点）'}
              </dd>
              <dt>开始时刻</dt>
              <dd>
                {selectedState.status === 'pending' || selectedState.status === 'skipped'
                  ? '—'
                  : formatWorkflowStartLabel(selectedState.startedAt)}
              </dd>
              <dt>执行耗时</dt>
              <dd>
                {selectedState.status === 'running' &&
                selectedState.startedAt > 0 &&
                isWallClockMs(selectedState.startedAt)
                  ? formatWorkflowDurationMs(selectedState.startedAt, Date.now())
                  : selectedState.status === 'done' || selectedState.status === 'error'
                    ? formatWorkflowDurationMs(selectedState.startedAt, selectedState.finishedAt)
                    : '—'}
              </dd>
              <dt>输出字数</dt>
              <dd>{selectedState.text.length} 字</dd>
            </dl>

            <div className="awf-dr-output-box">
              <div className="awf-dr-output-hd">
                <b>输出产物摘要</b>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="awf-dr-copy"
                  disabled={!selectedState.text}
                  onClick={() => void handleCopyOutput(selectedState.text)}
                  aria-label={outputCopyError ? '复制失败，请检查浏览器剪贴板权限' : outputCopied ? '已复制输出产物摘要' : '复制输出产物摘要'}
                >
                  {outputCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {outputCopied ? '已复制' : outputCopyError ? '复制失败' : '复制'}
                </Button>
              </div>
              <pre
                className={
                  selectedState.status === 'running' && selectedState.text ? 'awf-dr-stream' : undefined
                }
              >
                {selectedState.text ||
                  (selectedState.status === 'pending'
                    ? '（该步骤尚未开始）'
                    : selectedState.status === 'running'
                      ? '（执行中，产出将随步骤完成写入）'
                      : '（该步骤无结构化产出记录）')}
                {selectedState.status === 'running' && selectedState.text ? (
                  <span className="awf-stream-caret" aria-hidden="true" />
                ) : null}
              </pre>
            </div>

            {onRetryNode ? (
              <div className="awf-dr-retry">
                <p>从此步骤重试会重新执行后续步骤，可能再次消耗积分。</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={canRetryNode ? !canRetryNode(selectedNode.id) : false}
                  onClick={() => onRetryNode(selectedNode.id)}
                >
                  从此步骤重试
                </Button>
                {canRetryNode && !canRetryNode(selectedNode.id) ? (
                  <span role="status">{retryDisabledReason}</span>
                ) : null}
              </div>
            ) : null}

            {selectedNode.type === 'llm' &&
            (selectedState.thinkingText || selectedState.status === 'running') ? (
              <div className="awf-dr-thinking-box">
                <div className="awf-dr-thinking-hd">
                  <b>思考过程</b>
                  <button
                    type="button"
                    className="awf-dr-thinking-toggle"
                    onClick={() => setThinkingRevealed((v) => !v)}
                  >
                    {thinkingRevealed ? '收起' : '展开查看'}
                  </button>
                </div>
                <pre
                  className={['awf-dr-thinking-body', !thinkingRevealed && 'is-masked']
                    .filter(Boolean)
                    .join(' ')}
                >
                  {selectedState.thinkingText ||
                    (selectedState.status === 'running'
                      ? '思考内容生成中…'
                      : '（本步未记录思考摘要）')}
                </pre>
              </div>
            ) : null}
          </>
        ) : null}
      </aside>
    </div>
  )
}

export default WorkflowCanvas
