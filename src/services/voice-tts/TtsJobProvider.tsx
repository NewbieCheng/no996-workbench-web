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
import { useAuth } from '../../auth/AuthContext'
import { createIndexedDbVoiceTtsRepository } from './idb-repository'
import { revokePlaybackUrl } from './playback-cache'
import { resolvePlaybackUrlDeduped } from './playback-resolve'
import { TtsTaskRunner } from './task-runner'
import type { VoiceTtsRepository } from './repository'
import type { EnqueueTtsInput, TtsJobRecord } from './types'
import { countActiveJobs } from './queue-logic'

type Snapshot = {
  userId: number | null
  jobs: TtsJobRecord[]
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
  enqueue: (input: EnqueueTtsInput) => Promise<string>
  removeJob: (id: string) => Promise<void>
  refreshJobs: () => Promise<void>
  getPlaybackUrl: (job: TtsJobRecord) => Promise<string>
}

const ActionsContext = createContext<Actions | null>(null)
const VoiceStaleRefContext = createContext<React.MutableRefObject<
  (() => Promise<unknown>) | undefined
> | null>(null)

let repoSingleton: VoiceTtsRepository | null = null
function getRepo() {
  if (!repoSingleton) repoSingleton = createIndexedDbVoiceTtsRepository()
  return repoSingleton
}

export function TtsJobProvider({ children }: { children: ReactNode }) {
  const { authStatus, userId } = useAuth()
  const location = useLocation()
  const runnerRef = useRef<TtsTaskRunner | null>(null)
  const pathnameRef = useRef(location.pathname)
  const voiceStaleRef = useRef<(() => Promise<unknown>) | undefined>(undefined)
  pathnameRef.current = location.pathname

  const loadJobs = useCallback(async () => {
    const repo = getRepo()
    if (userId == null) {
      snapshot = { userId: null, jobs: [], version: snapshot.version }
      emit()
      return
    }
    const jobs = await repo.listJobsForUser(userId)
    snapshot = { userId, jobs, version: snapshot.version }
    emit()
  }, [userId])

  useEffect(() => {
    const repo = getRepo()
    const runner = new TtsTaskRunner(repo, {
      getIsAuthenticated: () => authStatus === 'authenticated' && userId != null,
      onVoiceListStale: () => voiceStaleRef.current?.() ?? Promise.resolve(),
      onJobsChanged: () => {
        void loadJobs()
      },
      getPathname: () => pathnameRef.current,
    })
    runnerRef.current = runner
    void repo.resetStaleRunning(3 * 60 * 1000).then(() => {
      void loadJobs().then(() => runner.bootstrap())
    })
    return () => {
      runnerRef.current = null
    }
  }, [authStatus, userId, loadJobs])

  useEffect(() => {
    runnerRef.current?.setPaused(authStatus !== 'authenticated' || userId == null)
  }, [authStatus, userId])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const actions = useMemo<Actions>(
    () => ({
      async enqueue(input) {
        if (userId == null) throw new Error('请先登录')
        const trimmed = input.text.trim()
        if (!trimmed) throw new Error('请填写需要朗读的文案。')
        const repo = getRepo()
        const job = await repo.createQueuedJob(userId, input)
        await loadJobs()
        runnerRef.current?.kick()
        return job.id
      },
      async removeJob(id) {
        revokePlaybackUrl(id)
        await getRepo().deleteJob(id)
        await loadJobs()
      },
      refreshJobs: loadJobs,
      async getPlaybackUrl(job) {
        if (job.status !== 'succeeded' || !job.blobId) return ''
        return resolvePlaybackUrlDeduped(job.id, async () => {
          const blob = await getRepo().getBlob(job.blobId!)
          if (!blob) return ''
          return URL.createObjectURL(new Blob([blob.data], { type: blob.mime }))
        })
      },
    }),
    [loadJobs, userId],
  )

  return (
    <VoiceStaleRefContext.Provider value={voiceStaleRef}>
      <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
    </VoiceStaleRefContext.Provider>
  )
}

/** VoicePage 注册 500 时刷新音色列表 */
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

export function useTtsJobs(): TtsJobRecord[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const { userId } = useAuth()
  if (userId == null || snap.userId !== userId) return []
  return snap.jobs
}

export function useTtsJobActiveCount(): number {
  const jobs = useTtsJobs()
  return countActiveJobs(jobs)
}

export function useTtsJobActions(): Actions {
  const ctx = useContext(ActionsContext)
  if (!ctx) throw new Error('useTtsJobActions must be used within TtsJobProvider')
  return ctx
}
