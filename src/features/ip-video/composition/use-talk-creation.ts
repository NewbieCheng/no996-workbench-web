import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditorDocument, useEditorInstance, type EditorDocument } from '@no996/video-editor'
import { createAgentClients, type AgentRunSnapshot } from '../../../agent'
import { resolveAgentMode } from '../../../agent/clients'
import { apiErrorMessage } from '../../../api/client'
import { createIndexedDbWorkbenchTaskRepository, useWorkbenchTaskActions, useWorkbenchTasks, type IPVideoCreatePayload } from '../../../services/workbench-tasks'
import { toastTaskEnqueued } from '../../../lib/toast-task-enqueued'
import { runTalkCreationFlow, createTalkCreationMockResponder } from '../agent/video-assembly-flow'
import type { TalkCreationInput, TalkCreationResult } from '../agent/types'
import { compileTalkDirectorPlan } from './talk-director-compiler'
import { humanizeTalkCreationError } from './talk-creation-errors'
import { editTalk, talkSettings, type TalkDocument } from './talk-model'

/** Ignore bookkeeping and voice catalog loading, but compare every editable program field. */
export function talkCreationFingerprint(doc: EditorDocument): string {
  const state = talkSettings(doc)
  return JSON.stringify({ name: doc.name, canvas: doc.canvas, durationUs: doc.durationUs, tracks: doc.tracks, captions: doc.captions, captionStyle: doc.captionStyle, assets: doc.assets, script: state.script, speed: state.speed, aiProtected: state.aiProtected, styleTemplate: state.styleTemplate, photoMotion: state.photoMotion })
}

type PendingResult = { id: string; payloadId?: string; input: TalkCreationInput; result: TalkCreationResult }
type AppliedCreationPayload = IPVideoCreatePayload & { appliedTo?: { documentId: string; revision: number } }
export type TalkCreationOptions = Omit<TalkCreationInput, 'document'>

export function useTalkCreation({ owner, selectedTaskId, flush, onError, onApplied }: {
  owner: number
  selectedTaskId?: string
  flush: () => Promise<void>
  onError: (message: string) => void
  onApplied: () => void
}) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const tasks = useWorkbenchTasks({ kind: 'ip_video_create' })
  const actions = useWorkbenchTaskActions()
  const [submittedId, setSubmittedId] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [demoRun, setDemoRun] = useState<AgentRunSnapshot>()
  const [processRun, setProcessRun] = useState<AgentRunSnapshot>()
  const [directions, setDirections] = useState<Extract<TalkCreationResult, { kind: 'directions' }> | null>(null)
  const [pending, setPending] = useState<PendingResult | null>(null)
  const [lastFailure, setLastFailure] = useState<string | null>(null)
  const alive = useRef(true)
  const submission = useRef(false)
  const demoAbort = useRef<AbortController | null>(null)
  const seen = useRef(new Set<string>())
  const sessionSubmitted = useRef(new Set<string>())
  const applyCallback = useRef(onApplied)
  applyCallback.current = onApplied
  const demo = resolveAgentMode() === 'demo'
  const task = tasks.find(t => t.id === (submittedId ?? selectedTaskId) && t.meta?.projectId === doc.id)
    ?? tasks.find(t => t.meta?.projectId === doc.id)
  const busy = submitting || task?.status === 'queued' || task?.status === 'running'

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; demoAbort.current?.abort() }
  }, [editor])

  const apply = useCallback((item: PendingResult) => {
    if (item.result.kind !== 'composition') return
    const current = editor.getDocument()
    if (current.scope !== String(owner) || item.input.document.id !== current.id || item.input.document.scope !== current.scope) throw new Error('该方案不属于当前账号或作品。')
    const previous = talkSettings(current).creation
    if (previous?.appliedTaskIds?.includes(item.id)) { setPending(null); return }
    if (talkCreationFingerprint(current) !== talkCreationFingerprint(item.input.document)) throw new Error('作品在 AI 工作期间已修改。请按当前作品重新规划，或先另存一份查看原方案。')
    const plan = item.result.plan
    editTalk(editor, 'director-apply', source => {
      const next = compileTalkDirectorPlan(source, plan, { ...item.input, document: source }, item.id) as TalkDocument
      return { ...next, ipVideo: { ...talkSettings(next), creation: { ...previous, brief: item.input.brief, summary: plan.summary, usedMock: item.result.usedMock, appliedTaskIds: [...(previous?.appliedTaskIds ?? []), item.id] } } }
    })
    setPending(null)
    setLastFailure(null)
    applyCallback.current()
    void flush().then(async () => {
      if (!item.payloadId) return
      const repo = createIndexedDbWorkbenchTaskRepository()
      const stored = await repo.getPayload(item.payloadId)
      if (stored?.kind === 'ip_video_create') await repo.patchPayload(item.payloadId, { ...(stored.data as IPVideoCreatePayload), appliedTo: { documentId: current.id, revision: editor.getDocument().revision } })
    }).catch(failure => { if (alive.current) onError(humanizeTalkCreationError(apiErrorMessage(failure))) })
  }, [editor, flush, onError, owner])

  const receive = useCallback((item: PendingResult) => {
    if (!alive.current || editor.getDocument().id !== item.input.document.id) return
    setProcessRun(item.result.run)
    if (item.result.kind === 'directions') { setDirections(item.result); return }
    if (talkSettings(editor.getDocument()).creation?.appliedTaskIds?.includes(item.id)) return
    if (talkCreationFingerprint(editor.getDocument()) !== talkCreationFingerprint(item.input.document)) { setPending(item); return }
    apply(item)
  }, [editor, apply])

  useEffect(() => {
    if (!task || task.ownerUserId !== owner || seen.current.has(task.id)) return
    const currentSettings = talkSettings(editor.getDocument()).creation
    if (currentSettings?.dismissedTaskIds?.includes(task.id)) return
    if (task.status === 'failed' || task.status === 'cancelled') {
      seen.current.add(task.id)
      if (task.status === 'failed') {
        const message = humanizeTalkCreationError(task.errorMessage || 'AI 制作失败，当前作品已保留。可修改要求后重新提交。')
        setLastFailure(message)
        // Only toast failures that started in this browser session.
        if (sessionSubmitted.current.has(task.id)) onError(message)
      }
      return
    }
    if (task.status !== 'succeeded' && task.status !== 'running') return
    let active = true
    void actions.getPayload(task.payloadId).then(raw => {
      if (!active || !alive.current) return
      const payload = raw as AppliedCreationPayload | null
      if (!payload?.input || payload.input.document.scope !== String(owner) || payload.input.document.id !== editor.getDocument().id) return
      setProcessRun(payload.run ?? payload.result?.run)
      if (task.status !== 'succeeded' || !payload.result) return
      seen.current.add(task.id)
      if (payload.appliedTo?.documentId === editor.getDocument().id) return
      receive({ id: task.id, payloadId: task.payloadId, input: payload.input, result: payload.result })
    }).catch(failure => { if (active) onError(humanizeTalkCreationError(apiErrorMessage(failure))) })
    return () => { active = false }
  }, [task, actions, editor, onError, owner, receive])

  const submit = async (options: TalkCreationOptions) => {
    if (submission.current || busy) return
    submission.current = true
    setSubmitting(true)
    setDirections(null); setPending(null); setProcessRun(undefined); setDemoRun(undefined); setLastFailure(null)
    try {
      await flush()
      if (!alive.current) return
      const document = structuredClone(editor.getDocument())
      if (document.scope !== String(owner)) throw new Error('请在当前账号的作品中制作。')
      const input: TalkCreationInput = { ...options, document }
      if (demo) {
        const controller = new AbortController()
        demoAbort.current = controller
        const result = await runTalkCreationFlow({ input, clients: createAgentClients({ mockResponder: createTalkCreationMockResponder(input) }), signal: controller.signal, sink: { publish(snapshot) { if (alive.current) setDemoRun(snapshot) } } })
        if (!alive.current || controller.signal.aborted) return
        receive({ id: `demo-${crypto.randomUUID()}`, input, result })
      } else {
        const id = await actions.enqueueIPVideoCreate(input)
        sessionSubmitted.current.add(id)
        if (alive.current) setSubmittedId(id)
        toastTaskEnqueued({ message: 'AI 创作已加入后台任务，可到历史查看进度。请保持浏览器打开。' })
      }
    } catch (failure) {
      if (alive.current && !(failure instanceof DOMException && failure.name === 'AbortError')) {
        const message = humanizeTalkCreationError(apiErrorMessage(failure))
        setLastFailure(message)
        onError(message)
      }
    } finally {
      submission.current = false
      if (alive.current) setSubmitting(false)
    }
  }

  const dismiss = () => {
    if (!pending) return
    const id = pending.id
    editTalk(editor, 'director-dismiss', current => ({ ...current, ipVideo: { ...talkSettings(current), creation: { brief: talkSettings(current).creation?.brief ?? '', ...talkSettings(current).creation, dismissedTaskIds: [...(talkSettings(current).creation?.dismissedTaskIds ?? []), id] } } }))
    setPending(null)
  }
  const cancel = () => {
    if (demo) demoAbort.current?.abort()
    else if (task) void actions.cancelTask(task.id).catch(failure => onError(humanizeTalkCreationError(apiErrorMessage(failure))))
  }
  const run = demoRun ?? processRun
  const runningStage = run?.stages.find(stage => stage.status === 'running')
  return {
    submit,
    busy,
    task,
    run,
    directions,
    clearDirections: () => setDirections(null),
    pending,
    dismiss,
    cancel,
    demo,
    lastFailure,
    dismissFailure: () => setLastFailure(null),
    stageLabel: runningStage?.headline ?? task?.meta?.headline ?? (task?.status === 'queued' ? '创作已排队，等待开始…' : '正在为你安排口播内容与画面…'),
  }
}
