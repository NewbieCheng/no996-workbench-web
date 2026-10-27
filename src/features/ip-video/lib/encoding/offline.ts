import { AudioSample, AudioSampleSource, Mp4OutputFormat, Output, Quality, StreamTarget, VideoSample, VideoSampleSource, WebMOutputFormat, type StreamTargetChunk } from 'mediabunny'
import { TemplatePainter, type TemplateContext } from '../template-renderer.ts'
import { ShotBackdropRenderer, templateHasShots } from '../shot-backdrop.ts'
import type { TemplateProject } from '../template-project.ts'
import { AUDIO_BITRATE, BoundedByteStore, VIDEO_BITRATE, abortable, frameCount, frameTiming, throwIfAborted, yieldTask, type EncodingChoice, type PCM } from './policy.ts'

export type EncodeJob = {
  project: TemplateProject
  pcm?: PCM
  image: ImageBitmap
  canvas: HTMLCanvasElement | OffscreenCanvas
  context: TemplateContext
  choice: EncodingChoice
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  mainThread: boolean
}

/** Shared implementation: timestamps are presentation seconds, never wall-clock/rAF time. */
export async function encodeOffline(job: EncodeJob): Promise<Blob> {
  const { project, pcm, canvas, context, choice, signal, onProgress } = job
  throwIfAborted(signal)
  const store = new BoundedByteStore()
  const target = new StreamTarget(new WritableStream<StreamTargetChunk>({
    write(chunk) { throwIfAborted(signal); store.write(chunk.position, chunk.data) }
  }), { chunked: true, chunkSize: 1024 * 1024 })
  // fastStart:false streams ordinary MP4 mdat as it is written; no whole-file packet buffer.
  const output = new Output({ target, format: choice.mime === 'video/mp4' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat() })
  let cancelTask: Promise<void> | undefined
  let finalizeTask: Promise<void> | undefined
  const cancel = () => {
    cancelTask ??= output.cancel().catch(() => {})
    return cancelTask
  }
  const cancelOnAbort = () => { void cancel() }
  signal?.addEventListener('abort', cancelOnAbort, { once: true })
  try {
    const painter = new TemplatePainter(project, job.image)
    // 有动效背景镜头时挂上渲染器；无镜头时这条路径与原来完全一致
    const backdrop = templateHasShots(project) ? new ShotBackdropRenderer() : null
    const video = new VideoSampleSource({ codec: choice.video, quality: new Quality({ bitrate: VIDEO_BITRATE }), latencyMode: 'quality', keyFrameInterval: 2 })
    const audio = pcm ? new AudioSampleSource({ codec: choice.audio, quality: new Quality({ bitrate: AUDIO_BITRATE }) }) : undefined
    // Intentionally omit track frameRate: its timestamp snapping would round the short final frame.
    // Explicit samples below still start exactly at n/30, with only the last duration shortened.
    output.addVideoTrack(video)
    if (audio) output.addAudioTrack(audio)
    throwIfAborted(signal)
    await abortable(output.start(), signal)
    const count = frameCount(project.duration)
    let audioOffset = 0
    for (let frame = 0; frame < count; frame++) {
      throwIfAborted(signal)
      const timing = frameTiming(frame, project.duration)
      // 动效背景先异步出帧，再同步绘制（draw 本身不能 await）
      if (backdrop) painter.setBackdrop(await backdrop.frameAt(project, timing.timestamp))
      painter.draw(context, timing.timestamp)
      if (painter.overflow) throw new Error('subtitleOverflow')
      const sample = new VideoSample(canvas, timing)
      try { await abortable(video.add(sample), signal) } finally { sample.close() }
      // Alternate video and <= 1/30 sec of planar PCM. Await every add for backpressure.
      if (pcm && audio) {
        const end = frame === count - 1 ? pcm.length : Math.min(pcm.length, Math.round((timing.timestamp + timing.duration) * pcm.sampleRate))
        const length = end - audioOffset
        if (length > 0) {
          const data = new Float32Array(length * pcm.channels.length)
          for (let channel = 0; channel < pcm.channels.length; channel++) data.set(pcm.channels[channel].subarray(audioOffset, end), channel * length)
          const audioSample = new AudioSample({ data, format: 'f32-planar', sampleRate: pcm.sampleRate, numberOfChannels: pcm.channels.length, timestamp: audioOffset / pcm.sampleRate })
          try { await abortable(audio.add(audioSample), signal) } finally { audioSample.close() }
          audioOffset = end
        }
      }
      if (frame % 8 === 0 || frame === count - 1) onProgress?.(15 + (frame + 1) / count * 80, 'encodeStage')
      // A task (not merely a microtask) lets main UI paint and workers receive cancellation.
      if (job.mainThread || frame % 8 === 0) await yieldTask(signal)
    }
    video.close()
    audio?.close()
    onProgress?.(96, 'encodeStage')
    finalizeTask = output.finalize()
    await abortable(finalizeTask, signal)
    throwIfAborted(signal)
    const blob = store.toBlob(choice.mime)
    if (!blob.size) throw new Error('encodeFailed')
    onProgress?.(100, 'encodeStage')
    return blob
  } catch (error) {
    await cancel()
    // Mediabunny 1.61 cancel() is a no-op once finalizing. On main-thread fallback,
    // await that already-started flush before releasing resources/rejecting cancellation.
    // The dedicated-worker path also has the caller's bounded terminate on abort.
    if (finalizeTask) await finalizeTask.catch(() => {})
    throw error
  } finally {
    signal?.removeEventListener('abort', cancelOnAbort)
    store.clear()
    canvas.width = 1
    canvas.height = 1
  }
}
