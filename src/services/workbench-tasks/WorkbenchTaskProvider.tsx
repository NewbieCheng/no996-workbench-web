import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import { resolveAgentMode } from '../../agent'
import { getAccessToken } from '../../api/client'
import { parseJwtPayload } from '../../auth/jwt'
import { useAuth } from '../../auth/AuthContext'
import { toastError, toastSuccess } from '../../lib/toast'
import { toastTaskEnqueued } from '../../lib/toast-task-enqueued.tsx'
import { runWorkbenchIdbRepairIfNeeded } from './idb-health'
import { createIndexedDbWorkbenchTaskRepository } from './idb-repository'
import {
  resolveVoiceDownloadUrl,
  resolveVoiceEmbedFallbackUrl,
  resolveVoicePlaybackUrl,
} from './voice-playback-url'
import {
  resolveVideoExportDownloadUrl,
  resolveVideoExportFileName,
} from './video-export-download-url'
import { revokePlaybackUrl } from './playback-cache'
import { resolveVoicePlaybackUrlDeduped } from './voice-playback-resolve'
import { WorkbenchTaskRunner } from './task-runner'
import type { WorkbenchTaskRepository } from './repository'
import type {
  EnqueueDigitalHumanRetalkInput,
  EnqueueIPVideoAudioInput,
  EnqueueIPVideoCreateInput,
  EnqueuePersonaInput,
  EnqueueProductPositioningInput,
  EnqueueScriptGenerateInput,
  EnqueueSourceCreateInput,
  EnqueueTitlesGenerateInput,
  EnqueueMomentsPlanInput,
  EnqueueMomentsCopyInput,
  EnqueueVideoFactoryExportInput,
  EnqueueVoiceCloneInput,
  EnqueueVoiceDubAdvancedInput,
  EnqueueVoiceTtsInput,
  VoiceTtsPayload,
  VoiceTtsTaskView,
  WorkbenchTaskKind,
  WorkbenchTaskRecord,
} from './types'
import { countActiveTasks } from './queue-logic.ts'

/** 有进行中任务时，任务列表的轮询间隔（进度由执行器直接写 IndexedDB，不会触发 runner 通知） */
const TASK_PROGRESS_POLL_MS = 1000

type Snapshot = {
  userId: number | null
  jobs: WorkbenchTaskRecord[]
  version: number
}

let snapshot: Snapshot = { userId: null, jobs: [], version: 0 }
const listeners = new Set<() => void>()

function emit() {
  snapshot = { ...snapshot, version: snapshot.version + 1 }
  for (const l of listeners) l()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return snapshot
}

type Actions = {
  enqueueDigitalHumanRetalk: (input: EnqueueDigitalHumanRetalkInput) => Promise<string>
  refreshRetalkTask: (id: string) => Promise<void>
  retryDigitalHumanRetalk: (id: string) => Promise<void>
  enqueueIPVideoCreate: (input: EnqueueIPVideoCreateInput) => Promise<string>
  enqueueIPVideoAudio: (input: EnqueueIPVideoAudioInput) => Promise<string>
  enqueueVoiceTts: (input: EnqueueVoiceTtsInput) => Promise<string>
  enqueueVoiceClone: (input: EnqueueVoiceCloneInput) => Promise<string>
  enqueueVoiceDubAdvanced: (input: EnqueueVoiceDubAdvancedInput) => Promise<string>
  enqueuePersona: (input: EnqueuePersonaInput) => Promise<string>
  enqueueProductPositioning: (input: EnqueueProductPositioningInput) => Promise<string>
  enqueueSourceCreate: (input: EnqueueSourceCreateInput) => Promise<string>
  enqueueScriptGenerate: (input: EnqueueScriptGenerateInput) => Promise<string>
  enqueueTitlesGenerate: (input: EnqueueTitlesGenerateInput) => Promise<string>
  enqueueMomentsPlan: (input: EnqueueMomentsPlanInput) => Promise<string>
  enqueueMomentsCopy: (input: EnqueueMomentsCopyInput) => Promise<string>
  enqueueVideoFactoryExport: (input: EnqueueVideoFactoryExportInput) => Promise<string>
  retryVideoFactoryExport: (id: string) => Promise<string>
  removeTask: (id: string) => Promise<void>
  cancelTask: (id: string) => Promise<void>
  updateProjectTasksTitle: (projectId: string, title: string) => Promise<void>
  updateTaskTitle: (taskId: string, title: string) => Promise<void>
  refreshTasks: () => Promise<void>
  getVoicePlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoiceDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoiceEmbedFallbackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVoicePayload: (task: WorkbenchTaskRecord) => Promise<VoiceTtsPayload | null>
  getVideoExportDownloadUrl: (task: WorkbenchTaskRecord) => Promise<string>
  getVideoExportFileName: (task: WorkbenchTaskRecord) => Promise<string>
  getPayload: (payloadId: string) => Promise<unknown>
}

const ActionsContext = createContext<Actions | null>(null)
const VoiceStaleRefContext = createContext<React.MutableRefObject<
  (() => Promise<unknown>) | undefined
> | null>(null)

let repoSingleton: WorkbenchTaskRepository | null = null
function getRepo() {
  if (!repoSingleton) repoSingleton = createIndexedDbWorkbenchTaskRepository()
  return repoSingleton
}

let idbRepairBootPromise: Promise<{ wiped: boolean }> | null = null
function ensureIdbRepairBoot(): Promise<{ wiped: boolean }> {
  if (!idbRepairBootPromise) {
    idbRepairBootPromise = runWorkbenchIdbRepairIfNeeded()
  }
  return idbRepairBootPromise
}

export function WorkbenchTaskProvider({ children }: { children: ReactNode }) {
  const { authStatus, userId } = useAuth()
  const location = useLocation()
  const runnerRef = useRef<WorkbenchTaskRunner | null>(null)
  const pathnameRef = useRef(location.pathname)
  const voiceStaleRef = useRef<(() => Promise<unknown>) | undefined>(undefined)
  const lastLoadErrorToastAt = useRef(0)
  const identityRef = useRef({ authStatus, userId })
  identityRef.current = { authStatus, userId }
  pathnameRef.current = location.pathname

  const loadJobs = useCallback(async () => {
    await ensureIdbRepairBoot()
    const repo = getRepo()
    await repo.ensureMigrated()
    if (userId == null) {
      snapshot = { userId: null, jobs: [], version: snapshot.version }
      emit()
      return
    }
    const jobs = await repo.listJobsForUser(userId)
    if (identityRef.current.userId !== userId || identityRef.current.authStatus !== 'authenticated') return
    snapshot = { userId, jobs, version: snapshot.version }
    emit()
  }, [userId])

  const safeLoadJobs = useCallback(async () => {
    try {
      await loadJobs()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '加载本机任务失败'
      const now = Date.now()
      if (now - lastLoadErrorToastAt.current > 5000) {
        lastLoadErrorToastAt.current = now
        toastError(`${msg}。可尝试清除本站数据后刷新。`)
      }
      throw e
    }
  }, [loadJobs])

  useEffect(() => {
    if (authStatus !== 'authenticated' || userId == null) return

    const repo = getRepo()
    const updates = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`no996-task-updates:${userId}`) : null
    if (updates) updates.onmessage = () => { void safeLoadJobs().catch(() => undefined) }
    const runner = new WorkbenchTaskRunner(repo, {
      ownerUserId: userId,
      getIsAuthenticated: () => identityRef.current.authStatus === 'authenticated' && identityRef.current.userId === userId && parseJwtPayload(getAccessToken() ?? '')?.uid === userId,
      onVoiceListStale: () => voiceStaleRef.current?.() ?? Promise.resolve(),
      onJobsChanged: () => {
        if (identityRef.current.userId !== userId || identityRef.current.authStatus !== 'authenticated') return
        updates?.postMessage('changed')
        void safeLoadJobs().catch(() => undefined)
      },
      getPathname: () => pathnameRef.current,
    })
    runnerRef.current = runner
    const onCredentialStorageChange = () => {
      if (parseJwtPayload(getAccessToken() ?? '')?.uid !== userId) runner.dispose()
    }
    window.addEventListener('storage', onCredentialStorageChange)

    void (async () => {
      try {
        const { wiped } = await ensureIdbRepairBoot()
        if (wiped) {
          toastSuccess('已重置本机配音历史缓存，请重新生成。')
        }
        await safeLoadJobs()
        await runner.bootstrap()
      } catch (e) {
        if (identityRef.current.userId === userId && e instanceof Error) toastError(e.message)
      }
    })()

    return () => {
      runner.dispose()
      window.removeEventListener('storage', onCredentialStorageChange)
      updates?.close()
      if (runnerRef.current === runner) runnerRef.current = null
    }
  }, [authStatus, userId, safeLoadJobs])

  useEffect(() => {
    runnerRef.current?.setPaused(authStatus !== 'authenticated' || userId == null)
  }, [authStatus, userId])

  useEffect(() => {
    if (authStatus !== 'authenticated' || userId == null) return
    void safeLoadJobs().catch(() => undefined)
  }, [authStatus, userId, safeLoadJobs])

  /**
   * 进行中任务的进度同步。
   *
   * 执行器把 `meta.pct` / `meta.progress` 直接写进 IndexedDB，不会经过
   * WorkbenchTaskRunner 的 onJobsChanged；没有这个轮询时，任务中心只会在
   * 「开始」和「结束」刷新两次，进度条会一直停在 0%，直到任务完成才跳到 100%。
   *
   * 只在当前账号确实有 queued / running 任务时读取，任务全部结束后自动空转。
   */
  useEffect(() => {
    if (authStatus !== 'authenticated' || userId == null) return
    let alive = true
    const timer = window.setInterval(() => {
      if (!alive) return
      const hasActive = snapshot.jobs.some(
        (job) =>
          job.ownerUserId === userId && (job.status === 'queued' || job.status === 'running'),
      )
      if (!hasActive) return
      void safeLoadJobs().catch(() => undefined)
    }, TASK_PROGRESS_POLL_MS)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [authStatus, userId, safeLoadJobs])

  const actions = useMemo<Actions>(
    () => ({
      async enqueueDigitalHumanRetalk(input) {
        if (userId == null || identityRef.current.userId !== userId || identityRef.current.authStatus !== 'authenticated' || parseJwtPayload(getAccessToken() ?? '')?.uid !== userId) throw new Error('请先登录')
        const job = await getRepo().createDigitalHumanRetalkJob(userId, input)
        await safeLoadJobs()
        runnerRef.current?.kick()
        return job.id
      },
      async refreshRetalkTask(id) {
        const runner = runnerRef.current
        if (!runner) throw new Error('请先登录')
        await runner.retalk.refresh(id)
        await safeLoadJobs()
      },
      async retryDigitalHumanRetalk(id) {
        const runner = runnerRef.current
        if (!runner) throw new Error('请先登录')
        await runner.retalk.submit(id, true)
        await safeLoadJobs()
      },
      async enqueueIPVideoCreate(input) {
        const assertOwner = () => {
          if (userId == null || identityRef.current.userId !== userId || identityRef.current.authStatus !== 'authenticated' || parseJwtPayload(getAccessToken() ?? '')?.uid !== userId) throw new Error('请先登录当前工程所属账号。')
          if (input.document.scope !== String(userId)) throw new Error('工程不属于当前账号。')
        }
        assertOwner()
        if (resolveAgentMode() === 'demo') throw new Error('演示模式不进入正式任务队列，请在页面内运行演示创作。')
        if (userId == null) throw new Error('请先登录当前工程所属账号。')
        const repo = getRepo()
        await repo.ensureMigrated()
        assertOwner()
        const job = await repo.createIPVideoCreateJob(userId, input)
        try {
          await safeLoadJobs()
          if (identityRef.current.userId === userId) runnerRef.current?.kick()
        } catch {
          /* The persisted job remains queued; a later owner-scoped load resumes it. */
        }
        return job.id
      },
      async enqueueIPVideoAudio(input) {
        if (userId == null) throw new Error('请先登录')
        const job = await getRepo().createIPVideoAudioJob(userId, input)
        await safeLoadJobs()
        runnerRef.current?.kick()
        return job.id
      },
      async enqueueVoiceTts(input) {
        if (userId == null) throw new Error('请先登录')
        if (!input.text.trim()) throw new Error('请填写需要朗读的文案。')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createVoiceTtsJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* list refresh failed; job remains queued until next successful load */
        }
        return job.id
      },
      async enqueueVoiceClone(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createVoiceCloneJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueVoiceDubAdvanced(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createVoiceDubAdvancedJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueuePersona(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createPersonaJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueProductPositioning(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createProductPositioningJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueSourceCreate(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createSourceCreateJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueScriptGenerate(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createScriptGenerateJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueTitlesGenerate(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createTitlesJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async enqueueMomentsPlan(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createMomentsPlanJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        toastTaskEnqueued()
        return job.id
      },
      async enqueueMomentsCopy(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createMomentsCopyJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        toastTaskEnqueued()
        return job.id
      },
      async enqueueVideoFactoryExport(input) {
        if (userId == null) throw new Error('请先登录')
        const repo = getRepo()
        await repo.ensureMigrated()
        const job = await repo.createVideoFactoryExportJob(userId, input)
        try {
          await safeLoadJobs()
          runnerRef.current?.kick()
        } catch {
          /* noop */
        }
        return job.id
      },
      async retryVideoFactoryExport(id) {
        if (userId == null) throw new Error('请先登录')
        try {
          const repo = getRepo()
          const job = await repo.getJob(id)
          if (!job || job.ownerUserId !== userId || job.kind !== 'video_factory_export') throw new Error('找不到当前账号的导出任务。')
          const rec = await repo.getPayload(job.payloadId)
          const payload = rec?.data as EnqueueVideoFactoryExportInput | undefined
          if (!payload?.documentSnapshot) throw new Error('导出快照已丢失，请回到作品页重新导出。')
          const next = await repo.createVideoFactoryExportJob(userId, {
            ...payload,
            projectTitle: payload.projectTitle,
          })
          toastTaskEnqueued({
            message: '已重新加入后台任务。合成在本标签页浏览器里进行：请勿刷新、关闭或离开本页。',
          })
          try {
            await safeLoadJobs()
            runnerRef.current?.kick()
          } catch { /* persisted */ }
          return next.id
        } catch (error) {
          toastError(error instanceof Error ? error.message : '重新导出失败')
          throw error
        }
      },
      async removeTask(id) {
        const job = await getRepo().getJob(id)
        if (!job || job.ownerUserId !== userId) throw new Error('找不到当前账号的任务。')
        if (job.kind === 'digital_human_retalk' && (job.status === 'queued' || job.status === 'running')) throw new Error('请先确认远端任务已结束，再删除本机记录。')
        revokePlaybackUrl(id)
        await getRepo().deleteJob(id)
        await safeLoadJobs()
      },
      async cancelTask(id) {
        await runnerRef.current?.cancelTask(id)
        await safeLoadJobs()
      },
      async updateProjectTasksTitle(projectId, title) {
        if (userId == null || !projectId || !title) return
        await getRepo().updateTasksTitleByProjectId(userId, projectId, title)
        snapshot = {
          ...snapshot,
          jobs: snapshot.jobs.map((j) =>
            j.ownerUserId === userId && j.meta?.projectId === projectId ? { ...j, title } : j,
          ),
          version: snapshot.version + 1,
        }
        for (const l of listeners) l()
      },
      async updateTaskTitle(taskId, title) {
        if (userId == null || !taskId || !title) return
        await getRepo().patchJob(taskId, { title })
        snapshot = {
          ...snapshot,
          jobs: snapshot.jobs.map((j) => (j.id === taskId ? { ...j, title } : j)),
          version: snapshot.version + 1,
        }
        for (const l of listeners) l()
      },
      refreshTasks: safeLoadJobs,
      async getVoicePlaybackUrl(task) {
        return resolveVoicePlaybackUrlDeduped(task.id, () => resolveVoicePlaybackUrl(getRepo(), task))
      },
      async getVoiceDownloadUrl(task) {
        return resolveVoiceDownloadUrl(getRepo(), task)
      },
      async getVoiceEmbedFallbackUrl(task) {
        return resolveVoiceEmbedFallbackUrl(getRepo(), task)
      },
      async getVoicePayload(task) {
        if (task.kind !== 'voice_tts') return null
        const rec = await getRepo().getPayload(task.payloadId)
        return (rec?.data as VoiceTtsPayload | undefined) ?? null
      },
      async getVideoExportDownloadUrl(task) {
        return resolveVideoExportDownloadUrl(getRepo(), task)
      },
      async getVideoExportFileName(task) {
        return resolveVideoExportFileName(getRepo(), task)
      },
      async getPayload(payloadId) {
        const rec = await getRepo().getPayload(payloadId)
        return rec?.data ?? null
      },
    }),
    [safeLoadJobs, userId],
  )

  return (
    <VoiceStaleRefContext.Provider value={voiceStaleRef}>
      <ActionsContext.Provider value={actions}>
        <VideoExportBeforeUnloadGuard />
        {children}
      </ActionsContext.Provider>
    </VoiceStaleRefContext.Provider>
  )
}

function VideoExportBeforeUnloadGuard() {
  const tasks = useWorkbenchTasks()
  const runningExport = tasks.some((t) => t.kind === 'video_factory_export' && t.status === 'running')
  useEffect(() => {
    if (!runningExport) return
    const confirmLeave = () => window.confirm('视频正在本页浏览器合成，离开后会中断且无法续传。确定离开？')
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (!(anchor instanceof HTMLAnchorElement)) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('blob:') || href.startsWith('javascript:')) return
      if (!confirmLeave()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [runningExport])
  return null
}

export function useRegisterVoiceListStale(handler: () => Promise<unknown>) {
  const ref = useContext(VoiceStaleRefContext)
  useEffect(() => {
    if (!ref) return
    ref.current = handler
    return () => {
      ref.current = undefined
    }
  }, [handler, ref])
}

export function useWorkbenchTasks(filter?: { kind?: WorkbenchTaskKind }): WorkbenchTaskRecord[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const { userId } = useAuth()
  if (userId == null || snap.userId !== userId) return []
  const jobs = snap.jobs
  if (!filter?.kind) return jobs
  return jobs.filter((j) => j.kind === filter.kind)
}

export function useWorkbenchTaskActiveCount(): number {
  const jobs = useWorkbenchTasks()
  return countActiveTasks(jobs)
}

export function useWorkbenchTaskActions(): Actions {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useWorkbenchTaskActions must be used within WorkbenchTaskProvider')
  return ctx
}

export async function mapVoiceTtsTaskView(
  task: WorkbenchTaskRecord,
  getPayload: (id: string) => Promise<unknown>,
): Promise<VoiceTtsTaskView | null> {
  if (task.kind !== 'voice_tts') return null
  const data = (await getPayload(task.payloadId)) as VoiceTtsPayload | null
  if (!data) return null
  return {
    id: task.id,
    text: data.text,
    voiceLabel: data.voiceLabel,
    rate: data.rate,
    volume: data.volume,
    pitch: data.pitch,
    instruction: data.instruction,
    status: task.status,
    errorMessage: task.errorMessage,
    createdAt: task.createdAt,
  }
}

export type { VoiceTtsPayload }
