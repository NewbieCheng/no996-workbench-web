import { createSpeech } from '../../api/tts'
import { resolveMediaUrl } from '../../api/media'
import { ApiError } from '../../api/errors'
import { apiErrorMessage } from '../../api/client'
import { toastError, toastSuccess } from '../../lib/toast'
import type { VoiceTtsRepository } from './repository'
import { TTS_JOB_LIMITS } from './types'

export type TaskRunnerOptions = {
  getIsAuthenticated: () => boolean
  onVoiceListStale?: () => Promise<unknown>
  onJobsChanged: () => void
  getPathname: () => string
}

async function fetchAudioBuffer(absUrl: string): Promise<ArrayBuffer> {
  const res = await fetch(absUrl, { credentials: 'include' })
  if (!res.ok) throw new Error(`音频拉取失败（${res.status}）`)
  return res.arrayBuffer()
}

export class TtsTaskRunner {
  private processing = false
  private paused = false
  private readonly repo: VoiceTtsRepository
  private readonly options: TaskRunnerOptions

  constructor(repo: VoiceTtsRepository, options: TaskRunnerOptions) {
    this.repo = repo
    this.options = options
  }

  setPaused(paused: boolean) {
    this.paused = paused
    if (!paused) this.kick()
  }

  kick() {
    void this.processLoop()
  }

  private async processLoop() {
    if (this.processing || this.paused) return
    if (!this.options.getIsAuthenticated()) return
    this.processing = true
    try {
      while (!this.paused && this.options.getIsAuthenticated()) {
        const job = await this.repo.pickNextQueued()
        if (!job) break

        await this.repo.patchJob(job.id, { status: 'running', startedAt: Date.now() })
        this.options.onJobsChanged()

        try {
          const res = await createSpeech({
            input: job.text,
            voice: job.voiceId,
            rate: job.rate,
            volume: job.volume,
            pitch: job.pitch,
            instruction: job.instruction,
          })
          const mediaPath = res.url
          const buf = await fetchAudioBuffer(resolveMediaUrl(mediaPath))
          await this.repo.putBlob({ id: job.id, mime: 'audio/wav', data: buf })
          await this.repo.patchJob(job.id, {
            status: 'succeeded',
            finishedAt: Date.now(),
            mediaPath,
            blobId: job.id,
            audioByteLength: buf.byteLength,
          })
          try {
            await this.repo.pruneForUser(job.ownerUserId)
          } catch {
            toastError('本机历史空间不足，请删除部分旧记录。')
          }
          const onVoice = this.options.getPathname().includes('/voice')
          toastSuccess(onVoice ? '配音已完成' : '配音已完成，可在声音页查看历史')
        } catch (e) {
          const msg = apiErrorMessage(e)
          if (e instanceof ApiError && e.status === 500 && this.options.onVoiceListStale) {
            await this.options.onVoiceListStale()
          }
          await this.repo.patchJob(job.id, {
            status: 'failed',
            finishedAt: Date.now(),
            errorMessage: msg,
          })
          toastError(msg)
        }
        this.options.onJobsChanged()
      }
    } finally {
      this.processing = false
      if (!this.paused && this.options.getIsAuthenticated()) {
        const more = await this.repo.pickNextQueued()
        if (more) this.kick()
      }
    }
  }

  async bootstrap() {
    await this.repo.resetStaleRunning(TTS_JOB_LIMITS.staleRunningMs)
    this.kick()
  }
}
