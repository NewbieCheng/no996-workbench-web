/**
 * 浏览器合成录制器：把已画好的 canvas 按时长编码成 MP4。
 * 供视频工厂、IP 编排与后续页面合成复用；不含工程光栅化。
 */
import {
  AudioSample,
  AudioSampleSource,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  canEncodeAudio,
  canEncodeVideo,
  type StreamTargetChunk,
} from 'mediabunny'
import { VideoExportDiagnosticError } from './export-diagnostics.ts'
import { AUDIO_BITRATE, abortable, throwIfAborted, yieldTask, type PCM } from '../../media/pcm.ts'
import { BoundedByteStore } from '../../media/byte-store.ts'

export const FAST_EXPORT_VIDEO_BITRATE = 4_000_000

export type CompositionPaintFn = (timeUs: number, frameIndex: number) => void | Promise<void>

export type RecordCompositionInput = {
  canvas: HTMLCanvasElement
  durationMs: number
  fps: number
  pcm?: PCM
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  /** 每帧编码前绘制；时间戳按内容时钟，出帧快则可快于片长。 */
  onPaint: CompositionPaintFn
}

export type RecordCompositionResult = {
  blob: Blob
  mime: string
}

class CompositionPaintError extends Error {
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause), { cause })
    this.name = 'CompositionPaintError'
  }
}

function encodingConfig(codec: 'avc', hardwareAcceleration: 'prefer-hardware' | 'no-preference' = 'no-preference') {
  return {
    codec,
    quality: new Quality({ bitrate: FAST_EXPORT_VIDEO_BITRATE }),
    latencyMode: 'realtime' as const,
    hardwareAcceleration,
    keyFrameInterval: 2,
  }
}

export async function canRecordComposition(width: number, height: number, fps: number, pcm?: PCM): Promise<'webcodecs' | 'mediarecorder'> {
  const attempts: Array<{ strategy: string; result: 'supported' | 'unsupported' | 'failed'; error?: string }> = []
  if (typeof globalThis.VideoEncoder === 'function' && typeof globalThis.VideoFrame === 'function') {
    const audioSupported = !pcm || (typeof globalThis.AudioEncoder === 'function' && await canEncodeAudio('aac', {
      sampleRate: pcm.sampleRate,
      numberOfChannels: pcm.channels.length,
      quality: new Quality({ bitrate: AUDIO_BITRATE }),
    }))
    if (audioSupported) {
      const supported = await canEncodeVideo('avc', {
        width, height, frameRate: fps, ...encodingConfig('avc', 'no-preference'),
      })
      attempts.push({ strategy: 'WebCodecs H.264/AAC，no-preference', result: supported ? 'supported' : 'unsupported' })
      if (supported) return 'webcodecs'
    } else {
      attempts.push({ strategy: 'WebCodecs AAC', result: 'unsupported' })
    }
  } else {
    attempts.push({ strategy: 'WebCodecs API', result: 'unsupported' })
  }
  const mp4RecorderAvailable = typeof HTMLCanvasElement !== 'undefined'
    && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    && Boolean(pickRecorderMime(Boolean(pcm)))
  attempts.push({ strategy: `MediaRecorder MP4${pcm ? ' H.264/AAC' : ' H.264'}`, result: mp4RecorderAvailable ? 'supported' : 'unsupported' })
  if (mp4RecorderAvailable) return 'mediarecorder'
  throw new VideoExportDiagnosticError(
    '当前浏览器没有可用的 MP4/H.264 编码配置；请尝试较低分辨率或更新浏览器后重试',
    { module: '视频导出', composition: 'browser', width, height, fps, videoBitrate: FAST_EXPORT_VIDEO_BITRATE, audioBitrate: AUDIO_BITRATE, hasAudio: Boolean(pcm), attempts },
  )
}

export async function recordComposition(input: RecordCompositionInput): Promise<RecordCompositionResult> {
  const { canvas, durationMs, fps, pcm, signal } = input
  throwIfAborted(signal)
  if (!canvas.width || !canvas.height) throw new Error('录制画布尺寸无效')
  if (!(durationMs > 0) || !(fps > 0)) throw new Error('录制时长或帧率无效')
  const mode = await canRecordComposition(canvas.width, canvas.height, fps, pcm)
  if (mode === 'mediarecorder') {
    try {
      return await recordWithMediaRecorder(input)
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
      throw new VideoExportDiagnosticError(
        'MediaRecorder MP4/H.264 编码失败，请复制错误详情反馈。',
        { module: '视频导出', composition: 'MediaRecorder', width: canvas.width, height: canvas.height, fps, videoBitrate: FAST_EXPORT_VIDEO_BITRATE, audioBitrate: AUDIO_BITRATE, hasAudio: Boolean(pcm), stage: 'MediaRecorder 编码', attempts: [{ strategy: `MediaRecorder ${pickRecorderMime(Boolean(pcm))}`, result: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : '未知错误' }] },
        error,
      )
    }
  }
  try {
    return await recordWithWebCodecs(input)
  } catch (error) {
    if (error instanceof CompositionPaintError) throw error.cause
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) throw error
    const mime = pickRecorderMime(Boolean(pcm))
    if (!mime) throw new VideoExportDiagnosticError(
      'MP4/H.264 编码器启动或运行失败，且当前浏览器没有可用的 MP4 MediaRecorder 回退。',
      { module: '视频导出', composition: 'WebCodecs', width: canvas.width, height: canvas.height, fps, videoBitrate: FAST_EXPORT_VIDEO_BITRATE, audioBitrate: AUDIO_BITRATE, hasAudio: Boolean(pcm), stage: 'WebCodecs 编码', attempts: [{ strategy: 'WebCodecs H.264/AAC，no-preference', result: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : '未知错误' }, { strategy: 'MediaRecorder MP4', result: 'unsupported' }] },
      error,
    )
    try {
      const result = await recordWithMediaRecorder(input)
      return result
    } catch (fallbackError) {
      if (signal?.aborted || (fallbackError instanceof DOMException && fallbackError.name === 'AbortError')) throw fallbackError
      throw new VideoExportDiagnosticError(
        'WebCodecs 与 MediaRecorder 均未能导出 MP4，请复制错误详情反馈。',
        { module: '视频导出', composition: '编码器回退', width: canvas.width, height: canvas.height, fps, videoBitrate: FAST_EXPORT_VIDEO_BITRATE, audioBitrate: AUDIO_BITRATE, hasAudio: Boolean(pcm), stage: 'MediaRecorder MP4', attempts: [{ strategy: 'WebCodecs H.264/AAC，no-preference', result: 'failed', error: error instanceof Error ? error.message.slice(0, 300) : '未知错误' }, { strategy: `MediaRecorder ${mime}`, result: 'failed', error: fallbackError instanceof Error ? fallbackError.message.slice(0, 300) : '未知错误' }] },
        fallbackError,
      )
    }
  }
}

async function recordWithWebCodecs(input: RecordCompositionInput): Promise<RecordCompositionResult> {
  const { canvas, durationMs, fps, pcm, signal, onProgress, onPaint } = input
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps))
  const store = new BoundedByteStore()
  const output = new Output({
    target: new StreamTarget(
      new WritableStream<StreamTargetChunk>({
        write(chunk) {
          if (signal?.aborted) throw new DOMException('编码已取消', 'AbortError')
          store.write(chunk.position, chunk.data)
        },
      }),
      { chunked: true, chunkSize: 1024 * 1024 },
    ),
    format: new Mp4OutputFormat({ fastStart: false }),
  })
  const videoSource = new CanvasSource(canvas, encodingConfig('avc'))
  const audioSource = pcm
    ? new AudioSampleSource({ codec: 'aac', quality: new Quality({ bitrate: AUDIO_BITRATE }) })
    : undefined
  output.addVideoTrack(videoSource)
  if (audioSource) output.addAudioTrack(audioSource)

  let cancelTask: Promise<void> | undefined
  const cancelOnAbort = () => { cancelTask ??= output.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancelOnAbort, { once: true })

  try {
    await abortable(output.start(), signal)
    let audioOffset = 0
    const started = performance.now()
    onProgress?.(0.02, '正在快速合成（预览直录）')
    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfAborted(signal)
      const timeUs = Math.round((frame * 1_000_000) / fps)
      try {
        await onPaint(timeUs, frame)
      } catch (error) {
        throw new CompositionPaintError(error)
      }
      const timestampSec = frame / fps
      const durationSec = 1 / fps
      await videoSource.add(timestampSec, durationSec)
      if (audioSource && pcm) {
        const end = frame === totalFrames - 1
          ? pcm.length
          : Math.min(pcm.length, Math.round((timestampSec + durationSec) * pcm.sampleRate))
        const length = end - audioOffset
        if (length > 0) {
          const data = new Float32Array(length * pcm.channels.length)
          for (let channel = 0; channel < pcm.channels.length; channel++) {
            data.set(pcm.channels[channel].subarray(audioOffset, end), channel * length)
          }
          const audioSample = new AudioSample({
            data,
            format: 'f32-planar',
            sampleRate: pcm.sampleRate,
            numberOfChannels: pcm.channels.length,
            timestamp: audioOffset / pcm.sampleRate,
          })
          try { await audioSource.add(audioSample) } finally { audioSample.close() }
          audioOffset = end
        }
      }
      if (frame % 2 === 0) await yieldTask(signal)
      if (frame % 5 === 0 || frame === totalFrames - 1) {
        const processed = frame + 1
        const elapsedMs = performance.now() - started
        const stage = elapsedMs >= 1000 && processed >= fps
          ? `正在快速合成 · 约剩余 ${Math.ceil((elapsedMs / processed * (totalFrames - processed)) / 1000)} 秒`
          : '正在快速合成'
        onProgress?.(Math.min(0.92, processed / totalFrames * 0.9), stage)
      }
    }
    videoSource.close()
    audioSource?.close()
    onProgress?.(0.95, '正在封装成片')
    await output.finalize()
    throwIfAborted(signal)
    const blob = store.toBlob('video/mp4')
    if (!blob.size) throw new Error('视频封装结果为空')
    onProgress?.(1, '导出完成')
    return { blob, mime: 'video/mp4' }
  } catch (error) {
    await (cancelTask ?? output.cancel().catch(() => {}))
    throw error
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort)
    store.clear()
  }
}

async function recordWithMediaRecorder(input: RecordCompositionInput): Promise<RecordCompositionResult> {
  const { canvas, durationMs, fps, pcm, signal, onProgress, onPaint } = input
  const mime = pickRecorderMime(Boolean(pcm))
  if (!mime) throw new Error('当前浏览器不支持 MediaRecorder 导出')
  const totalFrames = Math.max(1, Math.round((durationMs / 1000) * fps))
  const stream = canvas.captureStream(0)
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined
  let audioContext: AudioContext | undefined
  let audioStream: MediaStream | undefined
  let source: AudioBufferSourceNode | undefined
  if (pcm) {
    audioContext = new AudioContext({ sampleRate: pcm.sampleRate })
    await audioContext.resume()
    const buffer = audioContext.createBuffer(pcm.channels.length, pcm.length, pcm.sampleRate)
    for (let i = 0; i < pcm.channels.length; i++) buffer.copyToChannel(pcm.channels[i], i)
    const dest = audioContext.createMediaStreamDestination()
    source = audioContext.createBufferSource()
    source.buffer = buffer
    source.connect(dest)
    audioStream = dest.stream
  }
  const combined = new MediaStream([
    ...stream.getVideoTracks(),
    ...(audioStream?.getAudioTracks() ?? []),
  ])
  const recorder = new MediaRecorder(combined, {
    mimeType: mime,
    videoBitsPerSecond: FAST_EXPORT_VIDEO_BITRATE,
    audioBitsPerSecond: pcm ? 128_000 : undefined,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }

  const abort = () => {
    if (recorder.state !== 'inactive') recorder.stop()
  }
  signal?.addEventListener('abort', abort, { once: true })

  try {
    throwIfAborted(signal)
    onProgress?.(0.02, '正在快速合成（实时录制）')
    await onPaint(0, 0)
    track?.requestFrame?.()
    recorder.start(1000)
    source?.start()
    const frameMs = 1000 / fps
    const started = performance.now()
    for (let frame = 0; frame < totalFrames; frame++) {
      throwIfAborted(signal)
      const timeUs = Math.round((frame * 1_000_000) / fps)
      await onPaint(timeUs, frame)
      track?.requestFrame?.()
      const target = started + (frame + 1) * frameMs
      const wait = target - performance.now()
      if (wait > 4) await sleep(wait, signal)
      else await yieldTask(signal)
      if (frame % 5 === 0 || frame === totalFrames - 1) {
        const processed = frame + 1
        const elapsedMs = performance.now() - started
        const stage = elapsedMs >= 1000 && processed >= fps
          ? `正在快速合成 · 约剩余 ${Math.ceil((elapsedMs / processed * (totalFrames - processed)) / 1000)} 秒`
          : '正在快速合成'
        onProgress?.(Math.min(0.92, processed / totalFrames * 0.9), stage)
      }
    }
    await new Promise<void>((resolve, reject) => {
      recorder.onerror = () => reject(new Error('实时录制编码失败'))
      recorder.onstop = () => resolve()
      if (recorder.state !== 'inactive') recorder.stop()
      else resolve()
    })
    if (!chunks.length) throw new Error('实时录制未产生有效视频')
    onProgress?.(1, '导出完成')
    const type = recorder.mimeType || mime
    return { blob: new Blob(chunks, { type }), mime: type }
  } finally {
    signal?.removeEventListener('abort', abort)
    stream.getTracks().forEach((item) => item.stop())
    audioStream?.getTracks().forEach((item) => item.stop())
    try { source?.stop() } catch { /* finished */ }
    await audioContext?.close().catch(() => {})
  }
}

function pickRecorderMime(withAudio: boolean): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = withAudio
    ? ['video/mp4;codecs=avc1.424028,mp4a.40.2']
    : ['video/mp4;codecs=avc1.424028']
  return candidates.find((item) => MediaRecorder.isTypeSupported(item)) ?? ''
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('编码已取消', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (signal?.aborted) onAbort()
  })
}
