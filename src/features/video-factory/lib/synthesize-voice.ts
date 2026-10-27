/**
 * 一键出片的 TTS 配音
 *
 * 复用 IP 口播视频那条**已经上线**的 TTS 链路：入队 `ip_video_audio` → 后台执行 →
 * 完成后用 `getVoicePlaybackUrl` 取回 Blob。不新建接口、不另起计费路径。
 *
 * 为什么不在向导里直接 fetch：
 *  - 正式 TTS 可能耗时数十秒，必须走后台任务队列（`AGENTS.md` 的「只入队不阻塞」约定）；
 *  - 排队/失败/取消的状态由任务中心统一展示，用户切页也不会丢；
 *  - 计费在服务端裁决，浏览器不参与。
 */

import type { WorkbenchTaskRecord } from '../../../services/workbench-tasks'

export type VoiceOption = { id: string; label: string }

export type SynthesizeVoiceInput = {
  text: string
  voiceId: string
  voiceLabel: string
  /** 语速倍率，1 = 原速 */
  speed: number
  templateId?: string
}

export type VoiceSynthesisActions = {
  enqueueIPVideoAudio: (input: {
    text: string
    voiceId: string
    voiceLabel: string
    speed: number
    templateId: string
  }) => Promise<string>
  getVoicePlaybackUrl: (task: WorkbenchTaskRecord) => Promise<string>
  cancelTask: (taskId: string) => Promise<void>
}

export type SynthesisProgress = {
  taskId: string
  status: WorkbenchTaskRecord['status']
}

/**
 * 入队并等到任务结束，返回音频 Blob。
 *
 * 轮询而不是订阅：`useWorkbenchTasks` 是 React hook，在纯函数里拿不到；
 * 这里用 1.2s 轮询，对 30 秒级任务足够，且不会给 IndexedDB 造成压力。
 */
export async function synthesizeVoice(
  input: SynthesizeVoiceInput,
  actions: VoiceSynthesisActions,
  options: {
    signal?: AbortSignal
    onProgress?: (progress: SynthesisProgress) => void
    /** 注入取任务的函数，便于测试；默认从仓储读 */
    getTask?: (taskId: string) => Promise<WorkbenchTaskRecord | null>
    pollIntervalMs?: number
    timeoutMs?: number
  } = {},
): Promise<Blob> {
  const { signal, onProgress, getTask, pollIntervalMs = 1200, timeoutMs = 300_000 } = options
  if (!input.text.trim()) throw new Error('文案为空，无法生成配音')
  if (!input.voiceId) throw new Error('请先选择音色')
  if (!getTask) throw new Error('缺少任务读取器，无法等待配音结果')

  const taskId = await actions.enqueueIPVideoAudio({
    text: input.text,
    voiceId: input.voiceId,
    voiceLabel: input.voiceLabel,
    speed: Math.max(0.5, Math.min(2, input.speed)),
    templateId: input.templateId ?? 'video-factory',
  })
  onProgress?.({ taskId, status: 'queued' })

  const startedAt = Date.now()
  let task: WorkbenchTaskRecord | null = null

  /**
   * 取消时必须把后台任务也停掉。
   * 之前的写法只在循环开头检查 abort，导致「正在等待轮询时取消」会漏掉 cancelTask ——
   * 任务继续在后台跑，用户以为停了其实还在计费。这里统一到一个入口，两条路径都覆盖。
   */
  const cancelAndThrow = async (): Promise<never> => {
    await actions.cancelTask(taskId).catch(() => undefined)
    throw new DOMException('已取消配音生成', 'AbortError')
  }

  try {
    while (Date.now() - startedAt < timeoutMs) {
      if (signal?.aborted) await cancelAndThrow()

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal?.removeEventListener('abort', onAbort)
          resolve()
        }, pollIntervalMs)
        const onAbort = () => {
          clearTimeout(timer)
          reject(new DOMException('已取消配音生成', 'AbortError'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })
      }).catch(async (error) => {
        // 等待中被取消：同样要停掉后台任务
        if (error instanceof DOMException && error.name === 'AbortError') await cancelAndThrow()
        throw error
      })

      task = await getTask(taskId)
      if (!task) continue
      onProgress?.({ taskId, status: task.status })

      if (task.status === 'failed') {
        throw new Error(task.errorMessage?.trim() || '配音生成失败')
      }
      if (task.status === 'cancelled') {
        throw new DOMException('配音生成已取消', 'AbortError')
      }
      if (task.status === 'succeeded') break
    }
  } catch (error) {
    // 兜底：任何以 AbortError 结束的路径都确保后台任务已停
    if (error instanceof DOMException && error.name === 'AbortError') {
      await actions.cancelTask(taskId).catch(() => undefined)
    }
    throw error
  }

  if (!task || task.status !== 'succeeded') {
    throw new Error('配音生成超时，请到后台任务中心查看进度')
  }

  // 取回音频本体：优先本机 Blob，其次同源 / 上游地址
  const url = await actions.getVoicePlaybackUrl(task)
  if (!url) throw new Error('配音已完成，但取不到音频文件')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`音频下载失败（HTTP ${response.status}）`)
  const blob = await response.blob()
  if (!blob.size) throw new Error('配音音频为空')

  // 用完即释放 blob URL，避免泄漏
  if (url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // 已经释放过
    }
  }
  return blob
}

/** 估算配音时长（秒），用于在向导里提示用户「大概多长」。 */
export function estimateSpeechSeconds(text: string, speed = 1): number {
  const chars = Array.from(text.replace(/\s/g, '')).length
  // 中文播报约每秒 5 字，与 segment-script 的估算保持一致
  return Math.max(1, chars / 5 / Math.max(0.5, speed))
}
