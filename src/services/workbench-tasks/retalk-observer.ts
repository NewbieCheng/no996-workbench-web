import { cancelRetalkTask, getRetalkTask, submitRetalk, type RetalkTask } from '../../api/video-retalk'
import { apiErrorMessage } from '../../api/client'
import type { WorkbenchTaskRepository } from './repository'
import type { DigitalHumanRetalkPayload, WorkbenchTaskRecord } from './types'
import { tryTaskLock, withTaskLock } from './task-locks'

export function retalkPollDelay(status?: string): number { return status === 'QUEUED' ? 5_000 : 15_000 }
export function retalkIsTerminal(status?: string): boolean { return ['SUCCEEDED', 'FAILED', 'CANCELED', 'EXPIRED'].includes(status ?? '') }
export function retalkObservationExpired(payload: DigitalHumanRetalkPayload, now: number): boolean {
  return payload.observationStartedAt !== undefined && now - payload.observationStartedAt >= (payload.status === 'QUEUED' ? 600_000 : 1_800_000)
}
function errorStatus(e: unknown): number | undefined { return (e as { status?: number; response?: { status?: number } })?.status ?? (e as { response?: { status?: number } })?.response?.status }

/** Shared per authenticated provider, not per page. All remote mutations serialize per local job across tabs. */
export class RetalkTaskObserver {
  private timer?: ReturnType<typeof setTimeout>
  private disposed = false
  private readonly controllers = new Set<AbortController>()
  private readonly repo: WorkbenchTaskRepository
  private readonly owner: number
  private readonly active: () => boolean
  private readonly changed: () => void
  private readonly visibilityChanged = () => {
    if (typeof document !== 'undefined' && document.hidden) { for (const ac of this.controllers) ac.abort() }
    else void this.recover().catch(() => undefined)
  }
  constructor(repo: WorkbenchTaskRepository, owner: number, active: () => boolean, changed: () => void) {
    this.repo = repo
    this.owner = owner
    this.active = active
    this.changed = changed
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibilityChanged)
  }
  private canRun() { return !this.disposed && this.active() && (typeof document === 'undefined' || !document.hidden) }
  dispose() { this.disposed = true; if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibilityChanged); clearTimeout(this.timer); for (const ac of this.controllers) ac.abort(); this.controllers.clear() }
  start() { if (this.disposed || this.timer) return; this.timer = setTimeout(() => { this.timer = undefined; void this.tick().catch(() => undefined).finally(() => this.start()) }, 1000) }
  private async request<T>(work: (signal: AbortSignal) => Promise<T>) {
    if (!this.canRun()) throw new DOMException('任务观察已暂停', 'AbortError')
    const ac = new AbortController(); this.controllers.add(ac)
    try { return await work(ac.signal) } finally { this.controllers.delete(ac) }
  }
  private async read(id: string) {
    const job = await this.repo.getJob(id)
    if (!job || job.ownerUserId !== this.owner || job.kind !== 'digital_human_retalk') throw new Error('找不到当前账号的数字人任务。')
    const payload = (await this.repo.getPayload(job.payloadId))?.data as DigitalHumanRetalkPayload | undefined
    if (!payload) throw new Error('找不到数字人任务载荷。')
    return { job, payload }
  }
  private async save(job: WorkbenchTaskRecord, payload: DigitalHumanRetalkPayload, task: RetalkTask) {
    const { source_url: _temporarySource, ...result } = task
    const phase = task.status === 'QUEUED' ? 'queued' : 'active'
    const next = { ...payload, taskId: task.task_id, status: task.status, result, submissionUncertain: false, lastCheckedAt: Date.now(), observationError: undefined,
      observationPhase: phase as 'queued' | 'active', observationStartedAt: payload.observationPhase === phase ? payload.observationStartedAt ?? Date.now() : Date.now() }
    await this.repo.patchPayload(job.payloadId, next)
    const status = task.status === 'SUCCEEDED' ? 'succeeded' : task.status === 'CANCELED' ? 'cancelled' : ['FAILED', 'EXPIRED'].includes(task.status) ? 'failed' : 'running'
    await this.repo.patchJob(job.id, { status, finishedAt: retalkIsTerminal(task.status) ? Date.now() : undefined,
      errorMessage: task.status === 'EXPIRED' ? '任务不存在或已过期，请重新提交' : task.status === 'FAILED' ? task.error || '数字人生成失败' : undefined,
      meta: { ...job.meta, remote_task_id: task.task_id, remote_status: task.status, remote_note: task.error || '', ...(task.queue_position !== undefined ? { queue_position: String(task.queue_position) } : {}) } })
    this.changed()
  }
  async recover() {
    const jobs = await this.repo.listJobsForUser(this.owner)
    for (const job of jobs) {
      if (!this.canRun()) return
      if (job.kind !== 'digital_human_retalk' || job.status !== 'running') continue
      await withTaskLock(`retalk-job:${job.id}`, async () => {
        const current = await this.read(job.id)
        if (!this.canRun() || current.job.status !== 'running') return
        // A crash between the local running marker and the durable pre-request marker is safe to requeue.
        if (!current.payload.taskId && !current.payload.submissionAttempted) {
          await this.repo.patchJob(job.id, { status: 'queued', startedAt: undefined })
          this.changed()
        }
      })
    }
  }
  async submit(id: string, explicitRetry = false) {
    return withTaskLock(`retalk-job:${id}`, async () => {
      if (!this.canRun()) return
      const { job, payload } = await this.read(id)
      if (payload.taskId || retalkIsTerminal(payload.status) || job.status === 'cancelled') return
      if (explicitRetry && !payload.submissionUncertain) throw new Error('该提交已明确结束，请修改输入后创建新任务。')
      if (payload.submissionAttempted && !explicitRetry) return // HTTP uncertainty never causes automatic re-submission.
      if (job.status !== 'running') await this.repo.patchJob(id, { status: 'running', startedAt: Date.now() })
      const attempted = { ...payload, submissionAttempted: true, submissionUncertain: true }
      await this.repo.patchPayload(job.payloadId, attempted) // durable before any network side effect
      let task: RetalkTask
      try {
        task = await this.request((signal) => submitRetalk({ video: payload.video, audio: payload.audio, face_reference: payload.faceReference, video_extension: payload.videoExtension, client_request_id: payload.clientRequestId }, signal))
      } catch (e) {
        const status = errorStatus(e)
        const uncertain = !status || status >= 500 || status === 408
        const details = e as { code?: string; retryAfterSeconds?: number }
        const retryAfterUntil = status === 429 && details.code === 'QUEUE_SATURATED' && Number.isFinite(details.retryAfterSeconds) && details.retryAfterSeconds! > 0 ? Date.now() + details.retryAfterSeconds! * 1000 : undefined
        await this.repo.patchPayload(job.payloadId, { ...attempted, submissionUncertain: uncertain, observationError: apiErrorMessage(e), submissionErrorCode: details?.code, retryAfterSeconds: details?.retryAfterSeconds, retryAfterUntil })
        if (!uncertain) await this.repo.patchJob(id, { status: 'failed', finishedAt: Date.now(), errorMessage: apiErrorMessage(e) })
        else await this.repo.patchJob(id, { meta: { ...job.meta, remote_note: '提交结果待确认，请使用原提交标识手动确认，勿新建重复任务。' } })
        this.changed()
        if (explicitRetry) throw e
        return
      }
      // Storage errors must never overwrite an already saved remote task ID with the pre-request payload.
      // Persist even after dispose: the accepted response belongs to this owner's original submission.
      await this.save(job, attempted, task)
    })
  }
  async refresh(id: string, manual = true) {
    return withTaskLock(`retalk-job:${id}`, async () => {
      if (!this.canRun()) throw new Error('请在登录且页面可见时刷新任务。')
      const { job, payload } = await this.read(id)
      if (!payload.taskId) throw new Error('提交结果尚未确认，请使用原提交标识手动确认。')
      if (!manual && retalkIsTerminal(payload.status)) {
        if (payload.result && job.status === 'running') await this.save(job, payload, payload.result)
        return
      }
      const now = Date.now()
      if (!manual && (payload.observationPaused || now - (payload.lastCheckedAt ?? 0) < retalkPollDelay(payload.status))) return
      if (!manual && retalkObservationExpired(payload, now)) {
        await this.repo.patchPayload(job.payloadId, { ...payload, observationPaused: true, observationError: '仍在处理中，可稍后回来手动刷新。' }); this.changed(); return
      }
      const current = manual ? { ...payload, observationStartedAt: now, observationPaused: false } : payload
      let task: RetalkTask
      try {
        task = await this.request((signal) => getRetalkTask(payload.taskId!, signal))
      } catch (e) {
        if (!this.canRun()) return
        if (errorStatus(e) === 404 && payload.status !== 'SUCCEEDED') await this.save(job, current, { task_id: payload.taskId, status: 'EXPIRED', created_at: new Date(job.createdAt).toISOString() })
        else { await this.repo.patchPayload(job.payloadId, { ...current, lastCheckedAt: now, observationError: apiErrorMessage(e) }); this.changed() }
        if (manual) throw e
        return
      }
      if (this.canRun()) await this.save(job, current, task)
    })
  }
  async cancel(id: string) {
    return withTaskLock(`retalk-job:${id}`, async () => {
      if (!this.canRun()) throw new Error('请在登录且页面可见时取消任务。')
      const { job, payload } = await this.read(id)
      if (payload.taskId) {
        // 409 propagates unchanged; no optimistic cancelled state is written.
        const task = await this.request((signal) => cancelRetalkTask(payload.taskId!, signal))
        await this.save(job, payload, task)
      } else if (payload.submissionAttempted) throw new Error('提交结果待确认，请先确认远端任务状态。')
      else { await this.repo.patchJob(id, { status: 'cancelled', finishedAt: Date.now() }); this.changed() }
    })
  }
  private async tick() {
    if (!this.canRun()) return
    await tryTaskLock(`retalk-observer:${this.owner}`, async () => {
      const jobs = await this.repo.listJobsForUser(this.owner)
      for (const job of jobs) {
        if (!this.canRun()) break
        if (job.kind !== 'digital_human_retalk' || job.status !== 'running') continue
        await this.refresh(job.id, false).catch(() => undefined)
      }
    })
  }
}
