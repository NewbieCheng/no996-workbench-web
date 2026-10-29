import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentRunSnapshot } from '../../../agent'
import {
  useWorkbenchTaskActions,
  useWorkbenchTasks,
  type WorkbenchTaskRecord,
} from '../../../services/workbench-tasks'
import type { SocialComposeResult } from '../agent/task-types'

type UseSocialComposeTaskOptions = {
  targetType: 'xiaohongshu' | 'wechat-article'
  mode: 'wizard' | 'studio'
  onResult?: (result: SocialComposeResult, task: WorkbenchTaskRecord) => void
  onText?: (text: string) => void
  onError?: (message: string, task: WorkbenchTaskRecord) => void
}

const POLL_MS = 1500

/**
 * 图文生产任务的页面侧观察器。
 *
 * 爆款复刻与灵感创作共用：任务在后台跑，页面只负责把 run 快照、流式正文、
 * 当前任务结果接回自己的状态。任务列表的 1s 轮询由 WorkbenchTaskProvider 负责，
 * 这里只额外读 payload（正文和结果都在 payload 里）。
 */
export function useSocialComposeTask({
  targetType,
  mode,
  onResult,
  onText,
  onError,
}: UseSocialComposeTaskOptions) {
  const tasks = useWorkbenchTasks({ kind: 'social_compose' })
  const { getPayload, cancelTask } = useWorkbenchTaskActions()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null)
  const [streamingText, setStreamingText] = useState('')
  const [result, setResult] = useState<SocialComposeResult | null>(null)
  const appliedFinishedAtRef = useRef(0)
  const errorHandledRef = useRef(0)
  const lastTextRef = useRef('')
  const autoBoundRef = useRef(false)
  const callbacksRef = useRef({ onResult, onText, onError })
  callbacksRef.current = { onResult, onText, onError }

  const pageTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.meta?.targetType === targetType &&
          task.meta?.mode === mode,
      ),
    [tasks, targetType, mode],
  )

  const activeTask = useMemo(
    () =>
      pageTasks
        .filter((task) => task.status === 'queued' || task.status === 'running')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0],
    [pageTasks],
  )

  const task = useMemo(
    () => pageTasks.find((item) => item.id === taskId) ?? null,
    [pageTasks, taskId],
  )

  const bindTask = useCallback((next: WorkbenchTaskRecord | string) => {
    setTaskId(typeof next === 'string' ? next : next.id)
    setSnapshot(null)
    setStreamingText('')
    lastTextRef.current = ''
  }, [])

  const reset = useCallback(() => {
    setTaskId(null)
    setSnapshot(null)
    setStreamingText('')
    setResult(null)
    lastTextRef.current = ''
  }, [])

  // 刷新/进入页面时，自动接回本入口正在跑的任务（不自动灌入旧的已完成结果）。
  useEffect(() => {
    if (autoBoundRef.current || taskId || !activeTask) return
    autoBoundRef.current = true
    bindTask(activeTask)
  }, [activeTask, bindTask, taskId])

  useEffect(() => {
    if (!task) return
    if (task.status !== 'queued' && task.status !== 'running') return
    let alive = true
    const poll = () => {
      void getPayload(task.payloadId).then((raw) => {
        if (!alive || !raw || typeof raw !== 'object') return
        const data = raw as {
          run?: AgentRunSnapshot | null
          result?: SocialComposeResult | null
        }
        if (data.run) setSnapshot(data.run)
        if (data.result) setResult(data.result)
        const bodyStage = data.run?.stages.find((stage) => stage.id === 'compose-body')
        const text =
          bodyStage?.streamingContent?.trim() ||
          (typeof bodyStage?.output === 'string' ? bodyStage.output.trim() : '')
        if (text && text !== lastTextRef.current) {
          lastTextRef.current = text
          setStreamingText(text)
          callbacksRef.current.onText?.(text)
        }
      })
    }
    poll()
    const timer = window.setInterval(poll, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [getPayload, task])

  useEffect(() => {
    if (!task || task.status !== 'succeeded' || task.finishedAt == null) return
    if (task.finishedAt <= appliedFinishedAtRef.current) return
    appliedFinishedAtRef.current = task.finishedAt
    void getPayload(task.payloadId).then((raw) => {
      const data = raw as { result?: SocialComposeResult | null; run?: AgentRunSnapshot | null } | null
      if (!data?.result) {
        callbacksRef.current.onError?.('任务已完成，但没有找到成稿数据。', task)
        return
      }
      setResult(data.result)
      if (data.run) setSnapshot(data.run)
      callbacksRef.current.onResult?.(data.result, task)
    })
  }, [getPayload, task])

  useEffect(() => {
    if (!task || (task.status !== 'failed' && task.status !== 'cancelled')) return
    const stamp = task.finishedAt ?? task.createdAt ?? 0
    if (stamp <= errorHandledRef.current) return
    errorHandledRef.current = stamp
    callbacksRef.current.onError?.(task.errorMessage || '图文生成未完成，请重试。', task)
  }, [task])

  const bodyStage = snapshot?.stages.find((stage) => stage.id === 'compose-body')
  const textReady =
    task?.meta?.textReady === '1' ||
    bodyStage?.status === 'done' ||
    bodyStage?.status === 'skipped' ||
    task?.meta?.action === 'images_only'
  const imageStage = snapshot?.stages.find((stage) => stage.id === 'generate-images')
  const imageProgress = imageStage?.progress ?? { done: 0, total: 0 }

  return {
    task,
    tasks: pageTasks,
    activeTask,
    snapshot,
    streamingText,
    result,
    textReady,
    imageProgress,
    bindTask,
    reset,
    cancel: () => {
      const id = task?.id ?? taskId
      return id ? cancelTask(id) : Promise.resolve()
    },
  }
}
