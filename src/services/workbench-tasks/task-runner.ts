import { RetalkTaskObserver } from './retalk-observer'
import { requireTaskLocks, tryTaskLock, withTaskLock } from './task-locks'
import { apiErrorMessage } from '../../api/client'
import { toastError, toastSuccess } from '../../lib/toast'
import { executePersonaGenerate } from './executors/persona-generate'
import { executeProductPositioning } from './executors/product-positioning'
import { executeScriptGenerate } from './executors/script-generate'
import { executeSocialCompose } from './executors/social-compose'
import { executeSourceCreate } from './executors/source-create'
import { executeIPVideoCreate } from './executors/ip-video-create'
import { executeTitlesGenerate } from './executors/titles-generate'
import { executeMomentsCopy, executeMomentsPlan } from './executors/moments-generate'
import { humanizeVoiceCloneError } from '../../features/voice/voice-clone-errors'
import { executeVoiceClone } from './executors/voice-clone'
import { executeVoiceTts } from './executors/voice-tts'
import { executeVoiceDubAdvanced } from './executors/voice-dub-advanced'
import { executeVideoFactoryExport } from './executors/video-factory-export'
import type { WorkbenchTaskRepository } from './repository'
import { taskSuccessToast } from './task-display'
import type { WorkbenchTaskRecord } from './types'

export type TaskRunnerOptions = {
  ownerUserId: number
  getIsAuthenticated: () => boolean
  onVoiceListStale?: () => Promise<unknown>
  onJobsChanged: () => void
  getPathname: () => string
}

export class WorkbenchTaskRunner {
  private processing = false
  private paused = false
  private disposed = false
  private wakeTimer?: ReturnType<typeof setTimeout>
  private bootstrapped = false
  readonly retalk: RetalkTaskObserver
  private readonly repo: WorkbenchTaskRepository
  private readonly options: TaskRunnerOptions
  private readonly abortByTaskId = new Map<string, AbortController>()

  constructor(repo: WorkbenchTaskRepository, options: TaskRunnerOptions) {
    this.repo = repo
    this.options = options
    this.retalk = new RetalkTaskObserver(repo, options.ownerUserId, () => !this.disposed && !this.paused && options.getIsAuthenticated(), options.onJobsChanged)
  }

  dispose() {
    this.disposed = true
    this.paused = true
    clearTimeout(this.wakeTimer)
    this.retalk.dispose()
    for (const ac of this.abortByTaskId.values()) ac.abort()
  }

  setPaused(paused: boolean) {
    this.paused = paused
    if (!paused) this.kick()
  }

  kick() {
    if (this.disposed) return
    void this.lockedProcess().catch((e) => { if (!this.disposed) toastError(apiErrorMessage(e)) })
  }

  private async lockedProcess() {
    if (this.processing || this.paused || this.disposed) return
    try { requireTaskLocks() } catch (e) { this.paused = true; throw e }
    this.processing = true
    try {
      await tryTaskLock(`queue:${this.options.ownerUserId}`, async () => {
        if (this.disposed || this.paused) return
        if (!this.bootstrapped) {
          await this.repo.resetStaleRunning(0, this.options.ownerUserId)
          this.bootstrapped = true
        }
        await this.processLoop()
      })
    } finally {
      this.processing = false
      if (!this.disposed && !this.paused) {
        clearTimeout(this.wakeTimer)
        this.wakeTimer = setTimeout(() => this.kick(), 2000)
      }
    }
  }

  async cancelTask(taskId: string) {
    const current = await this.repo.getJob(taskId)
    if (!current || current.ownerUserId !== this.options.ownerUserId || this.disposed) return
    if (current.kind === 'digital_human_retalk') return this.retalk.cancel(taskId)
    // Abort this tab's active executor before waiting for its queue lock.
    this.abortByTaskId.get(taskId)?.abort()
    return withTaskLock(`queue:${this.options.ownerUserId}`, () => this.cancelLocalTask(taskId))
  }

  private async cancelLocalTask(taskId: string) {
    const job = await this.repo.getJob(taskId)
    if (!job) return
    if (job.status === 'queued') {
      await this.repo.patchJob(taskId, { status: 'cancelled', finishedAt: Date.now() })
      this.options.onJobsChanged()
      return
    }
    if (job.status === 'running') {
      this.abortByTaskId.get(taskId)?.abort()
      await this.repo.patchJob(taskId, { status: 'cancelled', finishedAt: Date.now() })
      this.options.onJobsChanged()
    }
  }

  private taskSuccessMessage(job: WorkbenchTaskRecord): string {
    if (job.kind === 'voice_tts' && this.options.getPathname().includes('/voice')) {
      return '配音已完成'
    }
    if (job.kind === 'voice_dub_advanced' && this.options.getPathname().includes('/voice')) {
      return job.meta?.awaiting_confirm === '1' ? '分段方案已就绪，请确认' : '高阶配音已完成'
    }
    if (job.kind === 'voice_clone' && this.options.getPathname().includes('/voice')) {
      return taskSuccessToast(job.kind, job.title, job.meta)
    }
    return taskSuccessToast(job.kind, job.title, job.meta)
  }

  private async processLoop() {
    if (this.paused || this.disposed || !this.options.getIsAuthenticated()) return
    while (!this.paused && !this.disposed && this.options.getIsAuthenticated()) {
        const job = await this.repo.pickNextQueued(this.options.ownerUserId)
        if (!job || this.disposed || this.paused) break
        if (job.kind === 'digital_human_retalk') {
          if (typeof document !== 'undefined' && document.hidden) break
          await this.retalk.submit(job.id)
          this.retalk.start()
          continue // Accepted remote work never occupies the local serial execution slot.
        }

        await this.repo.patchJob(job.id, { status: 'running', startedAt: Date.now() })
        this.options.onJobsChanged()

        const ac = new AbortController()
        this.abortByTaskId.set(job.id, ac)

        try {
          if (this.disposed || !this.options.getIsAuthenticated()) throw new DOMException('执行器已暂停', 'AbortError')
          if (job.kind === 'voice_tts' || job.kind === 'ip_video_audio') {
            await executeVoiceTts(this.repo, job, this.options.onVoiceListStale, ac.signal)
          } else if (job.kind === 'voice_clone') {
            await executeVoiceClone(this.repo, job, this.options.onVoiceListStale, ac.signal)
          } else if (job.kind === 'voice_dub_advanced') {
            await executeVoiceDubAdvanced(this.repo, job, ac.signal, this.options.onVoiceListStale)
          } else if (job.kind === 'persona_generate') {
            await executePersonaGenerate(this.repo, job, ac.signal)
          } else if (job.kind === 'product_positioning') {
            await executeProductPositioning(this.repo, job, ac.signal)
          } else if (job.kind === 'source_create') {
            await executeSourceCreate(this.repo, job, ac.signal)
          } else if (job.kind === 'social_compose') {
            await executeSocialCompose(this.repo, job, ac.signal)
          } else if (job.kind === 'script_generate') {
            await executeScriptGenerate(this.repo, job, ac.signal)
          } else if (job.kind === 'ip_video_create') {
            await executeIPVideoCreate(this.repo, job, ac.signal, () => !this.disposed && !this.paused && this.options.getIsAuthenticated())
          } else if (job.kind === 'titles_generate') {
            await executeTitlesGenerate(this.repo, job, ac.signal)
          } else if (job.kind === 'moments_plan') {
            await executeMomentsPlan(this.repo, job, ac.signal)
          } else if (job.kind === 'moments_copy') {
            await executeMomentsCopy(this.repo, job, ac.signal)
          } else if (job.kind === 'video_factory_export') {
            await executeVideoFactoryExport(this.repo, job, ac.signal, () => {
              if (!this.disposed) this.options.onJobsChanged()
            })
          } else {
            throw new Error(`未知任务类型：${job.kind}`)
          }
          if (!this.disposed) toastSuccess(this.taskSuccessMessage(job))
        } catch (e) {
          if (this.disposed || !this.options.getIsAuthenticated()) {
            if (job.kind === 'video_factory_export') {
              await this.repo.patchJob(job.id, {
                status: 'failed',
                finishedAt: Date.now(),
                errorMessage: '页面已刷新或关闭，浏览器合成已中断，请重新导出',
              })
            } else if (job.kind === 'voice_tts' || job.kind === 'ip_video_audio') {
              await this.repo.patchJob(job.id, {
                status: 'failed',
                finishedAt: Date.now(),
                errorMessage: '页面或连接中断，配音提交结果未知。为防止重复计费，已停止自动重试，请手动核对后重试。',
              })
            } else {
              // Pausing for logout is not a user cancellation. The next owner-scoped bootstrap resumes local work.
              await this.repo.patchJob(job.id, { status: 'queued', startedAt: undefined })
            }
          } else if (e instanceof DOMException && e.name === 'AbortError') {
            await this.repo.patchJob(job.id, {
              status: 'cancelled',
              finishedAt: Date.now(),
            })
          } else {
            const raw = apiErrorMessage(e)
            const msg =
              job.kind === 'voice_clone' ? humanizeVoiceCloneError(raw) : raw
            await this.repo.patchJob(job.id, {
              status: 'failed',
              finishedAt: Date.now(),
              errorMessage: msg,
            })
            toastError(msg)
          }
        } finally {
          this.abortByTaskId.delete(job.id)
        }
        if (!this.disposed) this.options.onJobsChanged()
      }
  }

  async bootstrap() {
    await this.repo.ensureMigrated()
    if (this.disposed) return
    requireTaskLocks()
    this.retalk.start()
    this.kick()
    await this.retalk.recover()
  }
}
