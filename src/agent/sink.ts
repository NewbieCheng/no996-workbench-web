/**
 * 统一 sink：把 StageRunner 的进度快照投递到不同落点。
 *
 * - memorySink：存内存，供页内 useAgentRun 订阅（persona / titles 现有模式）
 * - taskSink：写入后台任务记录（meta 存轻量进度 + payload 存完整快照），
 *   使「关页面 / 切路由 / 刷新」都不丢进度，且顶栏任务中心同步可见。
 *
 * 同一份编排代码因此既能页内跑，也能入队跑 —— 这是解耦的关键开关。
 */
import type { AgentRunSnapshot, AgentSink } from './types'

/* ----------------------------- 内存 sink ----------------------------- */

export type MemorySinkHandle = {
  sink: AgentSink
  subscribe(listener: (snapshot: AgentRunSnapshot) => void): () => void
  getSnapshot(): AgentRunSnapshot | null
}

export function createMemorySink(flowId: string): MemorySinkHandle {
  let snapshot: AgentRunSnapshot | null = null
  const listeners = new Set<(s: AgentRunSnapshot) => void>()

  const handle: MemorySinkHandle = {
    sink: {
      publish(next) {
        snapshot = next
        for (const l of listeners) l(next)
      },
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getSnapshot() {
      return snapshot
    },
  }

  // flowId 仅用于快照标识，这里保持引用避免被误删
  void flowId
  return handle
}

/* ------------------------------ 任务 sink ------------------------------ */

/**
 * 任务侧只需实现这两个方法，避免内核依赖 workbench-tasks 的具体类型。
 * features 层用适配器把 repo 与 job 桥接进来（见 features/script-lab/agent/task-sink.ts）。
 */
export type TaskSinkPort = {
  /** 轻量进度：写入任务 meta，供列表与进度条读取 */
  patchMeta(meta: Record<string, string>): Promise<void> | void
  /** 完整快照：写入任务 payload，供页面恢复详细过程 */
  patchSnapshot(snapshot: AgentRunSnapshot): Promise<void> | void
  /** 任务被外部取消时返回 true，StageRunner 会中止 */
  isCancelled?(): Promise<boolean> | boolean
}

/** 把进度压缩成 meta 字段（meta 值必须是 string） */
/** 任务 payload 去重签名：须包含流式长度，否则画布侧栏看不到增量更新 */
export function snapshotProgressSignature(snapshot: AgentRunSnapshot): string {
  return (
    snapshot.stages
      .map(
        (s) =>
          `${s.id}:${s.status}:${s.streamingContent?.length ?? 0}:${
            s.streamingReasoningContent?.length ?? 0
          }:${s.searchAttempts?.map((a) => `${a.status}:${a.query}:${a.purpose ?? ''}:${a.resultCount ?? 0}:${a.error ?? ''}`).join(',') ?? ''}:${s.reasoningHistory?.map((item) => `${item.turn}:${item.text.length}`).join(',') ?? ''}:${
            s.output === undefined || s.output === null ? 0 : 1
          }`,
      )
      .join('|') + `#${snapshot.round}#${JSON.stringify(snapshot.checkpoints ?? {})}`
  )
}

export function snapshotToMeta(snapshot: AgentRunSnapshot): Record<string, string> {
  const done = snapshot.stages.filter((s) => s.status === 'done').length
  const running = snapshot.stages.find((s) => s.status === 'running')
  const pct = snapshot.stages.length
    ? Math.min(100, Math.round(((done + (running ? 0.5 : 0)) / snapshot.stages.length) * 100))
    : 0
  return {
    status: snapshot.status,
    round: String(snapshot.round),
    stage: running?.id ?? '',
    stageIndex: String(running ? snapshot.stages.findIndex((s) => s.id === running.id) : done),
    stageCount: String(snapshot.stages.length),
    doneCount: String(done),
    pct: String(pct),
    fallback: snapshot.fallback ? '1' : '0',
  }
}

export function createTaskSink(port: TaskSinkPort): AgentSink {
  let pending: Promise<void> = Promise.resolve()
  return {
    publish(snapshot) {
      // 串行化写入，避免并发 patch 覆盖
      pending = pending
        .then(() => port.patchMeta(snapshotToMeta(snapshot)))
        .then(() => port.patchSnapshot(snapshot))
        .catch(() => {
          /* 进度写失败不应中断生成 */
        })
      return pending
    },
  }
}
