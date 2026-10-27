import { AUDIO_SAMPLE_RATE, MAX_BYTES, MAX_DURATION, MAX_PCM_BYTES, abortable, rmsEnvelope, throwIfAborted, yieldTask, type PCM } from './policy.ts'

/** Main-thread decode only; workers receive owned planar PCM buffers, never AudioContext. */
export async function decodeAudioPCM(blob: Blob, signal?: AbortSignal): Promise<PCM> {
  throwIfAborted(signal)
  if (!blob.size || blob.size > MAX_BYTES) throw new Error('invalidAudio')
  const Offline = globalThis.OfflineAudioContext
  const Realtime = globalThis.AudioContext
  if (!Offline && !Realtime) throw new Error('audioDecodeUnsupported')
  const context = Offline ? new Offline(2, 1, AUDIO_SAMPLE_RATE) : new Realtime({ sampleRate: AUDIO_SAMPLE_RATE })
  const close = () => {
    if ('close' in context && context.state !== 'closed') void context.close().catch(() => {})
  }
  signal?.addEventListener('abort', close, { once: true })
  try {
    const bytes = await abortable(blob.arrayBuffer(), signal)
    throwIfAborted(signal)
    // decodeAudioData itself has no browser cancellation API. Discard its late result on abort.
    const buffer = await abortable(context.decodeAudioData(bytes), signal)
    throwIfAborted(signal)
    if (!buffer.length || buffer.duration > MAX_DURATION || buffer.numberOfChannels < 1 || buffer.numberOfChannels > 2 || buffer.length * buffer.numberOfChannels * 4 > MAX_PCM_BYTES) throw new Error('invalidAudio')
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

export async function envelopeFromPCM(pcm: PCM, signal?: AbortSignal): Promise<number[]> {
  const result: number[] = []
  // One second at a time keeps UI tasks and cancellation responsive during analysis.
  for (let offset = 0; offset < pcm.length; offset += pcm.sampleRate) {
    await yieldTask(signal)
    result.push(...rmsEnvelope(pcm.channels.map(channel => channel.subarray(offset, Math.min(pcm.length, offset + pcm.sampleRate))), pcm.sampleRate))
  }
  return result
}

/** Same 30 Hz RMS envelope used by preview and offline export. No upload or API call. */
export async function analyzeAudioEnvelope(blob: Blob, signal?: AbortSignal): Promise<number[]> {
  return envelopeFromPCM(await decodeAudioPCM(blob, signal), signal)
}
