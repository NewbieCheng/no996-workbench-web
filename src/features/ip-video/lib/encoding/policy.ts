export const FRAME_RATE = 30
export const MAX_DURATION = 300
export const MAX_BYTES = 250 * 1024 * 1024
export const MAX_PCM_BYTES = 128 * 1024 * 1024
export const VIDEO_BITRATE = 4_000_000
export const AUDIO_BITRATE = 128_000
export const AUDIO_SAMPLE_RATE = 48_000

export type EncodingChoice = { video: 'avc'; audio: 'aac'; mime: 'video/mp4' } | { video: 'vp9'; audio: 'opus'; mime: 'video/webm' }
export const ENCODING_CHOICES: readonly EncodingChoice[] = [
  { video: 'avc', audio: 'aac', mime: 'video/mp4' },
  { video: 'vp9', audio: 'opus', mime: 'video/webm' }
]
export async function chooseEncoding(
  canVideo: (codec: EncodingChoice['video']) => Promise<boolean>,
  canAudio?: (codec: EncodingChoice['audio']) => Promise<boolean>
): Promise<EncodingChoice | null> {
  for (const choice of ENCODING_CHOICES) {
    if (await canVideo(choice.video) && (!canAudio || await canAudio(choice.audio))) return choice
  }
  return null
}
export type PCM = { channels: Float32Array<ArrayBuffer>[]; sampleRate: number; length: number }

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Export canceled', 'AbortError')
}

/** Does not hide failures of the underlying operation, including after cancellation. */
export function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  return new Promise((resolve, reject) => {
    const cancel = () => reject(new DOMException('Export canceled', 'AbortError'))
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel))
  })
}

export function frameCount(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION) throw new Error('invalidDuration')
  // Suppress only floating point noise at exact frame boundaries.
  return Math.max(1, Math.ceil(duration * FRAME_RATE - 1e-9))
}
export function frameTiming(index: number, duration: number): { timestamp: number; duration: number } {
  if (!Number.isInteger(index) || index < 0 || index >= frameCount(duration)) throw new RangeError('invalidFrame')
  const timestamp = index / FRAME_RATE
  return { timestamp, duration: Math.min(1 / FRAME_RATE, duration - timestamp) }
}
export function resolveDuration(projectDuration: number, audioDuration?: number): number {
  frameCount(projectDuration)
  if (audioDuration === undefined) return projectDuration
  frameCount(audioDuration)
  if (Math.abs(projectDuration - audioDuration) > .1 + 1e-9) throw new Error('audioDurationMismatch')
  return audioDuration
}

/** A system serif/sans stack cannot be reproduced reliably in a dedicated worker. */
export function supportsWorkerFont(font: string, weight: number): boolean {
  const first = font.split(',')[0].trim().replace(/^["']|["']$/g, '')
  return first === 'Alibaba PuHuiTi' && (weight === 400 || weight === 700)
}

/** RMS over all channels, at 30 bins/second. Absolute amplitude, not random/peak-normalized. */
export function rmsEnvelope(channels: readonly Float32Array[], sampleRate: number): number[] {
  if (!channels.length || !Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('invalidAudio')
  const length = channels[0].length
  if (!length || channels.some(channel => channel.length !== length)) throw new Error('invalidAudio')
  const bins = Math.ceil(length / sampleRate * FRAME_RATE)
  const result: number[] = []
  for (let bin = 0; bin < bins; bin++) {
    const start = Math.floor(bin * sampleRate / FRAME_RATE)
    const end = Math.min(length, Math.floor((bin + 1) * sampleRate / FRAME_RATE))
    let squares = 0
    for (const channel of channels) for (let i = start; i < end; i++) squares += channel[i] * channel[i]
    result.push(end > start ? Math.min(1, Math.sqrt(squares / ((end - start) * channels.length))) : 0)
  }
  return result
}

export { BoundedByteStore } from '../../../../../packages/video-editor/src/media/byte-store.ts'

export function yieldTask(signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal)
  return abortable(new Promise(resolve => setTimeout(resolve, 0)), signal)
}
