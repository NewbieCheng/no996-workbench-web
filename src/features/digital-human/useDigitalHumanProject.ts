import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { apiErrorMessage } from '../../api/client'
import { resolveMediaUrl } from '../../api/media'
import { useWorkbenchTaskActions, useWorkbenchTasks, type DigitalHumanRetalkPayload } from '../../services/workbench-tasks'
import { readDigitalHumanMedia, validateDigitalHumanDuration } from './lib/media'
import {
  createDigitalHumanProject,
  deleteDigitalHumanProject,
  getDigitalHumanProject,
  listDigitalHumanProjects,
  nextDigitalHumanProjectName,
  saveDigitalHumanProject,
  type DigitalHumanProject,
  type DigitalHumanVersion,
} from './lib/project-store'

export function useDigitalHumanProject(initialId: string | null) {
  const { userId } = useAuth()
  const actions = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks()
  const [project, setProject] = useState<DigitalHumanProject>()
  const [projects, setProjects] = useState<DigitalHumanProject[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const latest = useRef(project); latest.current = project
  const owner = useRef(userId); owner.current = userId
  const saveChain = useRef(Promise.resolve())
  const [revision, setRevision] = useState(0)
  const downloads = useRef(new Map<string, AbortController>())
  const update = useCallback((change: (previous: DigitalHumanProject) => DigitalHumanProject) => {
    const previous = latest.current
    if (!previous || previous.ownerUserId !== owner.current) return
    const next = { ...change(previous), updatedAt: Math.max(Date.now(), previous.updatedAt + 1) }
    latest.current = next; setProject(next); setSaved(false)
  }, [])
  const patchVersion = useCallback((segmentId: string, versionId: string, patch: Partial<DigitalHumanVersion>) => {
    update(previous => ({ ...previous, segments: previous.segments.map(segment => segment.id !== segmentId ? segment : { ...segment, versions: segment.versions.map(version => version.id === versionId ? { ...version, ...patch } : version) }) }))
  }, [update])

  useEffect(() => {
    const pendingDownloads = downloads.current
    return () => { for (const controller of pendingDownloads.values()) controller.abort(); pendingDownloads.clear() }
  }, [userId, project?.id])

  useEffect(() => {
    if (!project || project.ownerUserId !== userId) return
    for (const segment of project.segments) for (const version of segment.versions) {
      if (!version.videoUrl || version.videoBlob || version.status !== 'succeeded' || version.resultCleared) continue
      const url = version.videoUrl
      const key = `${segment.id}:${version.id}:${url}`
      if (downloads.current.has(key)) continue
      const controller = new AbortController()
      downloads.current.set(key, controller)
      void (async () => {
        try {
          const response = await fetch(resolveMediaUrl(url), { signal: controller.signal })
          const currentVersion = () => latest.current?.id === project.id && owner.current === userId && latest.current.segments.find(s => s.id === segment.id)?.versions.find(v => v.id === version.id)
          if (response.ok) {
            const blob = await response.blob()
            const current = currentVersion()
            if (!controller.signal.aborted && current && current.videoUrl === url && !current.videoBlob && !current.resultCleared) patchVersion(segment.id, version.id, { videoBlob: blob })
          }
        } catch {
          if (!controller.signal.aborted) console.warn('成片本地缓存失败，可继续尝试在线播放。')
        } finally {
          if (downloads.current.get(key) === controller) downloads.current.delete(key)
        }
      })()
    }
  }, [project, userId, patchVersion])

  useEffect(() => {
    let active = true
    setProject(undefined); setProjects([])
    if (userId == null) return
    listDigitalHumanProjects(userId).then(async all => {
      const fromUrl = initialId ? await getDigitalHumanProject(initialId, userId) : undefined
      const selected = fromUrl ?? all[0]
      if (!active) return
      setProjects(all)
      setProject(
        selected ?? createDigitalHumanProject(userId, nextDigitalHumanProjectName(all)),
      )
    }).catch(e => { if (active) setError(apiErrorMessage(e)) })
    return () => { active = false }
  }, [userId, initialId])

  const persist = useCallback(async (value = latest.current) => {
    if (!value || value.ownerUserId !== owner.current) throw new Error('当前账号或项目已变更，请重新打开项目')
    const copy = value
    const write = saveChain.current.catch(() => undefined).then(() => saveDigitalHumanProject(copy))
    saveChain.current = write
    await write
    if (owner.current === copy.ownerUserId && latest.current?.id === copy.id && latest.current.updatedAt === copy.updatedAt) setSaved(true)
    const all = await listDigitalHumanProjects(copy.ownerUserId)
    if (owner.current === copy.ownerUserId) setProjects(all)
  }, [])

  useEffect(() => {
    if (!project) return
    const timer = window.setTimeout(() => { void persist(project).catch(e => setError(apiErrorMessage(e))) }, 500)
    return () => window.clearTimeout(timer)
  }, [project, persist])

  // Task results are copied into the owning project; changing an input never overwrites its old version.
  useEffect(() => {
    const current = latest.current
    if (!current || current.ownerUserId !== userId) return
    let active = true
    const controller = new AbortController()
    void (async () => {
      const remoteJobs = await Promise.all(tasks.filter(task => task.kind === 'digital_human_retalk').map(async task => ({ task, payload: await actions.getPayload(task.payloadId) as DigitalHumanRetalkPayload | null })))
      for (const segment of current.segments) for (const version of segment.versions) {
        if (!active) return
        const audioTask = tasks.find(task => task.id === version.audioTaskId)
        const remoteJob = remoteJobs.find(item => item.task.id === version.localTaskId || item.payload?.projectId === current.id && item.payload.versionId === version.id && item.payload.segmentId === segment.id)
        const retalkTask = remoteJob?.task
        try {
          if (audioTask && !version.audio && !version.error) {
            if (audioTask.status === 'succeeded') {
              const url = await actions.getVoicePlaybackUrl(audioTask)
              if (!url) throw new Error('配音结果不可用，请从历史中重新选择')
              const response = await fetch(url, { signal: controller.signal })
              if (!response.ok) throw new Error('配音下载失败')
              const audio = await response.blob()
              const metadata = await readDigitalHumanMedia(audio, 'audio', controller.signal)
              validateDigitalHumanDuration(metadata.duration)
              if (active && latest.current?.id === current.id && owner.current === userId) patchVersion(segment.id, version.id, { audio, audioDuration: metadata.duration, status: 'audio_ready', error: undefined })
            } else if (audioTask.status === 'failed' || audioTask.status === 'cancelled') {
              if (active) patchVersion(segment.id, version.id, { status: audioTask.status, error: audioTask.errorMessage ?? '配音任务已取消' })
            }
          }
          if (version.resultCleared) {
            continue
          }

          if (retalkTask) {
            const raw = remoteJob?.payload
            const remote = raw?.result
            const isFinished = remote?.status === 'SUCCEEDED' || raw?.status === 'SUCCEEDED' || retalkTask.status === 'succeeded'
            const videoUrl = remote?.video_url ?? version.videoUrl
            const patch: Partial<DigitalHumanVersion> = {
              status: isFinished ? 'succeeded' : (remote?.status ?? raw?.status ?? retalkTask.status),
              taskId: remote?.task_id ?? raw?.taskId ?? version.taskId,
              localTaskId: retalkTask.id,
              videoUrl,
              sourceVideoUrl:
                (remote as { source_url?: string } | undefined)?.source_url ?? version.sourceVideoUrl,
              pointsCharged: remote?.points_charged ?? version.pointsCharged,
              error: isFinished ? undefined : (retalkTask.errorMessage || raw?.observationError || remote?.error),
              submissionUncertain: raw?.submissionUncertain,
              observationPaused: raw?.observationPaused,
              retryAfterUntil: raw?.retryAfterUntil,
            }
            if (active && latest.current?.id === current.id && owner.current === userId && Object.entries(patch).some(([key, value]) => version[key as keyof DigitalHumanVersion] !== value)) patchVersion(segment.id, version.id, patch)
          }
        } catch (e) {
          if (active && latest.current?.id === current.id && owner.current === userId) patchVersion(segment.id, version.id, { ...(audioTask && !version.audio ? { status: 'failed' } : {}), error: apiErrorMessage(e) })
        }
      }
    })().catch(e => { if (active) setError(apiErrorMessage(e)) })
    return () => { active = false; controller.abort() }
  }, [tasks, actions, project?.id, userId, patchVersion, revision])

  async function open(id: string) {
    if (userId == null) return
    await persist()
    const next = await getDigitalHumanProject(id, userId)
    if (next && owner.current === userId) { latest.current = next; setProject(next); setRevision(n => n + 1) }
  }
  async function create(name: string) {
    if (userId == null) return
    if (latest.current) await persist()
    const next = createDigitalHumanProject(userId, name)
    await persist(next)
    if (owner.current !== userId) throw new DOMException('当前账号已变更', 'AbortError')
    latest.current = next; setProject(next); setRevision(n => n + 1)
  }
  async function remove() {
    const previous = latest.current
    if (!previous || userId == null) return
    await saveChain.current.catch(() => undefined)
    if (owner.current !== userId || latest.current?.id !== previous.id) {
      throw new DOMException('当前账号或项目已变更', 'AbortError')
    }
    const deletedId = previous.id
    const remaining = (await listDigitalHumanProjects(userId)).filter(item => item.id !== deletedId)
    const createdNew = remaining.length === 0
    const next = createdNew
      ? createDigitalHumanProject(userId, nextDigitalHumanProjectName(remaining))
      : remaining[0]
    // 先切换活动项目，避免排队中的自动保存把已删项目写回 IndexedDB
    latest.current = next
    setProject(next)
    setRevision(n => n + 1)
    if (createdNew) await saveDigitalHumanProject(next)
    await deleteDigitalHumanProject(deletedId, userId)
    const all = await listDigitalHumanProjects(userId)
    if (owner.current === userId) setProjects(all)
  }
  return { project, projects, update, patchVersion, persist, open, create, remove, error, setError, saved, tasks, refreshResults: () => setRevision(n => n + 1) }
}
