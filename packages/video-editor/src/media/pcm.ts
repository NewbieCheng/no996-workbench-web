/**
 * 音频 PCM 公共层
 *
 * 从 `src/features/ip-video/lib/encoding/{audio,policy}.ts` 上提到公共包，
 * 让视频工厂与 IP 口播视频共用同一份解码 / 包络 / 中止逻辑，不再各存一份。
 */

export const AUDIO_SAMPLE_RATE = 48_000
export const AUDIO_BITRATE = 128_000
export const MAX_AUDIO_DURATION_SECONDS = 300
/** 单次解码允许的最大 PCM 字节数（约 4 分钟立体声 48kHz f32） */
export const MAX_PCM_BYTES = 128 * 1024 * 1024

export type PCM = {
  channels: Float32Array<ArrayBuffer>[]
  sampleRate: number
  length: number
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('导出已取消', 'AbortError')
}

/** 把 Promise 与中止信号绑定；底层操作失败会如实抛出，不被吞掉。 */
export function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(new DOMException('导出已取消', 'AbortError'))
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel))
  })
}

/** 让出主线程一次任务，保证长循环里 UI 可响应、取消能生效。 */
export function yieldTask(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (signal?.aborted) reject(new DOMException('导出已取消', 'AbortError'))
      else resolve()
    }, 0)
  })
}

/**
 * 任意音频 Blob → planar Float32 PCM。
 * 必须在主线程调用：Worker 无法持有 AudioContext，只能接收已解码的 PCM。
 */
export async function decodeAudioPCM(blob: Blob, signal?: AbortSignal): Promise<PCM> {
  throwIfAborted(signal)
  if (!blob.size) throw new Error('音频文件为空')
  if (blob.size > 250 * 1024 * 1024) throw new Error('音频文件过大')

  const Offline = globalThis.OfflineAudioContext
  const Realtime = globalThis.AudioContext
  if (!Offline && !Realtime) throw new Error('当前浏览器不支持音频解码')

  const context = Offline
    ? new Offline(2, 1, AUDIO_SAMPLE_RATE)
    : new Realtime({ sampleRate: AUDIO_SAMPLE_RATE })
  const close = () => {
    if ('close' in context && context.state !== 'closed') void context.close().catch(() => {})
  }
  signal?.addEventListener('abort', close, { once: true })

  try {
    const bytes = await abortable(blob.arrayBuffer(), signal)
    throwIfAborted(signal)
    // decodeAudioData 本身没有取消 API，中止后丢弃迟到的结果即可
    const buffer = await abortable(context.decodeAudioData(bytes), signal)
    throwIfAborted(signal)

    if (
      !buffer.length ||
      buffer.duration > MAX_AUDIO_DURATION_SECONDS ||
      buffer.numberOfChannels < 1 ||
      buffer.numberOfChannels > 2 ||
      buffer.length * buffer.numberOfChannels * 4 > MAX_PCM_BYTES
    ) {
      throw new Error('音频格式不受支持或时长过长')
    }

    const channels: Float32Array<ArrayBuffer>[] = []
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      await yieldTask(signal)
      channels.push(new Float32Array(buffer.getChannelData(i)))
    }
    return { channels, length: buffer.length, sampleRate: buffer.sampleRate }
  } finally {
    signal?.removeEventListener('abort', close)
    close()
  }
}

/** 30Hz RMS 包络，供声波可视化；预览与导出共用同一算法。 */
export function rmsEnvelope(channels: Float32Array[], sampleRate: number, binsPerSecond = 30): number[] {
  const binSize = Math.max(1, Math.round(sampleRate / binsPerSecond))
  const length = channels[0]?.length ?? 0
  const result: number[] = []
  for (let offset = 0; offset < length; offset += binSize) {
    const end = Math.min(length, offset + binSize)
    let sum = 0
    let count = 0
    for (const channel of channels) {
      for (let i = offset; i < end; i++) {
        const v = channel[i] ?? 0
        sum += v * v
        count++
      }
    }
    result.push(count ? Math.sqrt(sum / count) : 0)
  }
  return result
}

export async function envelopeFromPCM(pcm: PCM, signal?: AbortSignal): Promise<number[]> {
  const result: number[] = []
  for (let offset = 0; offset < pcm.length; offset += pcm.sampleRate) {
    await yieldTask(signal)
    result.push(
      ...rmsEnvelope(
        pcm.channels.map((channel) => channel.subarray(offset, Math.min(pcm.length, offset + pcm.sampleRate))),
        pcm.sampleRate,
      ),
    )
  }
  return result
}

export async function analyzeAudioEnvelope(blob: Blob, signal?: AbortSignal): Promise<number[]> {
  return envelopeFromPCM(await decodeAudioPCM(blob, signal), signal)
}

/** 软限幅：多轨叠加后平滑压回 [-1,1]，避免数字削波成破音。 */
export function softClip(sample: number): number {
  if (sample > 1) return 1 - Math.exp(-sample + 1) * 0.36
  if (sample < -1) return -1 + Math.exp(sample + 1) * 0.36
  return sample
}

/** 组装成一条可交给编码器的 PCM。 */
export function createPCM(channels: Float32Array<ArrayBuffer>[], sampleRate: number): PCM {
  return { channels, length: channels[0]?.length ?? 0, sampleRate }
}
