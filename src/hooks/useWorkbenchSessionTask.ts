import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkbenchTaskRecord } from '../services/workbench-tasks'

/** 是否应对会话任务的成功结果做一次 apply（同一 finishedAt 只 apply 一次）。 */
export function shouldApplySessionSuccess(
  task: WorkbenchTaskRecord | undefined,
  lastAppliedFinishedAt: number,
): boolean {
  if (!task || task.status !== 'succeeded' || task.finishedAt == null) return false
  return task.finishedAt > lastAppliedFinishedAt
}

export type UseWorkbenchSessionTaskOptions<TPayload> = {
  tasks: WorkbenchTaskRecord[]
  /** 当前页进行中的后台任务（queued / running），无则 undefined */
  activeTask: WorkbenchTaskRecord | undefined
  /** 为 false 时（演示模式）不绑定队列会话 */
  enabled: boolean
  getPayload: (payloadId: string) => Promise<unknown>
  /** 任务成功后的完整回填（需有成稿字段） */
  applySuccessPayload: (data: TPayload | null) => boolean
  /** 进行中任务：只恢复表单/过程快照，不要求成稿 */
  restoreInFlightDraft: (data: TPayload | null) => void
  /** 进入页面或打开历史时绑定进行中任务 */
  onBindInFlight?: (task: WorkbenchTaskRecord) => void
  /** apply 成功后的副作用（如确保停在创作 Tab） */
  onAppliedSuccess?: () => void
}

export function useWorkbenchSessionTask<TPayload>(options: UseWorkbenchSessionTaskOptions<TPayload>) {
  const {
    tasks,
    activeTask,
    enabled,
    getPayload,
    applySuccessPayload,
    restoreInFlightDraft,
    onBindInFlight,
    onAppliedSuccess,
  } = options

  const [sessionTaskId, setSessionTaskId] = useState<string | null>(null)
  const lastAppliedFinishedAtRef = useRef(0)
  const initialInFlightBoundRef = useRef(false)

  const clearSession = useCallback(() => {
    setSessionTaskId(null)
    lastAppliedFinishedAtRef.current = 0
    initialInFlightBoundRef.current = false
  }, [])

  /** 历史 Tab 已手动回填成稿时调用，避免 success effect 再 apply 一次 */
  const markSessionSuccessHandled = useCallback((finishedAt: number | undefined) => {
    if (finishedAt != null && finishedAt > lastAppliedFinishedAtRef.current) {
      lastAppliedFinishedAtRef.current = finishedAt
    }
  }, [])

  const bindInFlightTask = useCallback(
    (task: WorkbenchTaskRecord) => {
      setSessionTaskId(task.id)
      onBindInFlight?.(task)
      void getPayload(task.payloadId).then((raw) => {
        restoreInFlightDraft(raw as TPayload | null)
      })
    },
    [getPayload, onBindInFlight, restoreInFlightDraft],
  )

  // 进入页面：若已有进行中任务，绑定会话并恢复表单草稿（不灌「最近成功」）
  useEffect(() => {
    if (!enabled || initialInFlightBoundRef.current || !activeTask) return
    initialInFlightBoundRef.current = true
    bindInFlightTask(activeTask)
  }, [enabled, activeTask, bindInFlightTask])

  // 本会话提交的任务成功后，仅对该 taskId 做一次成稿回填
  useEffect(() => {
    if (!enabled || !sessionTaskId) return
    const task = tasks.find((t) => t.id === sessionTaskId)
    if (!shouldApplySessionSuccess(task, lastAppliedFinishedAtRef.current)) return
    lastAppliedFinishedAtRef.current = task!.finishedAt!
    void getPayload(task!.payloadId).then((raw) => {
      if (applySuccessPayload(raw as TPayload | null)) {
        onAppliedSuccess?.()
      }
    })
  }, [enabled, sessionTaskId, tasks, getPayload, applySuccessPayload, onAppliedSuccess])

  return {
    sessionTaskId,
    setSessionTaskId,
    clearSession,
    bindInFlightTask,
    markSessionSuccessHandled,
  }
}
