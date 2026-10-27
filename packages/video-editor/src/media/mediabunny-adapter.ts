/**
 * 基于 Mediabunny 1.61.6 的真实浏览器媒体适配器
 */

import {
  Input,
  BlobSource,
  ALL_FORMATS,
  Output,
  StreamTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  VideoSampleSource,
  VideoSample,
  CanvasSink,
  canEncodeVideo,
  canEncodeAudio,
  AudioSample,
  AudioSampleSource,
  Quality,
  type StreamTargetChunk,
} from 'mediabunny'
import type {
  MediaEngineAdapter,
  MediaProbeResult,
  WaveformSummary,
  VideoEncodingOptions,
} from './types.ts'
import { ONE_SECOND_US, secondsToTimeUs } from '../core/time.ts'
import { AUDIO_BITRATE, abortable, throwIfAborted, yieldTask } from './pcm.ts'

/** 真实编码入口与预检共用；缺能力必须失败，不能生成占位文件。 */
export async function assertBrowserEncodingSupport(options: {
  width: number
  height: number
  frameRate?: { num: number; den: number }
  format?: 'mp4' | 'webm'
  pcm?: import('./pcm.ts').PCM
}): Promise<void> {
  if (typeof globalThis.VideoFrame !== 'function' || typeof globalThis.VideoEncoder !== 'function' || typeof WritableStream !== 'function') {
    throw new Error('当前浏览器缺少 WebCodecs 视频编码能力，请使用支持的浏览器导出')
  }
  const format = options.format ?? 'mp4'
  if (!await canEncodeVideo(format === 'mp4' ? 'avc' : 'vp9', {
    width: options.width,
    height: options.height,
    frameRate: options.frameRate ? options.frameRate.num / options.frameRate.den : 30,
    quality: new Quality({ bitrate: 6_000_000 }),
  })) throw new Error(`当前浏览器不支持所选分辨率的 ${format === 'mp4' ? 'H.264' : 'VP9'} 编码`)
  if (options.pcm && !await canEncodeAudio(format === 'mp4' ? 'aac' : 'opus', {
    sampleRate: options.pcm.sampleRate,
    numberOfChannels: options.pcm.channels.length,
    quality: new Quality({ bitrate: AUDIO_BITRATE }),
  })) throw new Error('当前浏览器不支持所需音频编码，无法导出有声视频')
}

export class MediabunnyMediaAdapter implements MediaEngineAdapter {
  private disposed = false
  // 一个 Blob 只打开一次容器；逐帧请求复用轨道和解码 sink，不保留历史位图。
  private frameInputs = new Map<Blob, { input: Input; sink: Promise<CanvasSink> }>()

  async probe(blob: Blob): Promise<MediaProbeResult> {
    if (this.disposed) throw new Error('适配器已释放')
    const mimeType = blob.type || 'application/octet-stream'

    if (mimeType.startsWith('image/')) {
      return {
        kind: 'image',
        durationUs: 0,
        hasAudio: false,
        mimeType,
      }
    }

    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
    try {
      const durationSeconds = await input.computeDuration()
      const videoTrack = await input.getPrimaryVideoTrack()
      const audioTrack = await input.getPrimaryAudioTrack()

      let width: number | undefined
      let height: number | undefined

      if (videoTrack) {
        width = await videoTrack.getDisplayWidth()
        height = await videoTrack.getDisplayHeight()
      }

      const hasAudio = audioTrack !== null
      const kind = videoTrack ? 'video' : 'audio'

      return {
        kind,
        durationUs: secondsToTimeUs(durationSeconds || 0),
        width,
        height,
        hasAudio,
        mimeType,
      }
    } catch (error) {
      // 探测失败不能伪装成 hasAudio: false，否则导出会静默丢掉未知原声。
      throw new Error(`无法读取媒体轨道：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      input.dispose()
    }
  }

  async extractWaveform(blob: Blob, binsPerSecond = 30): Promise<WaveformSummary> {
    if (this.disposed) throw new Error('适配器已释放')
    const probeRes = await this.probe(blob)
    const totalBins = Math.max(1, Math.ceil((probeRes.durationUs / ONE_SECOND_US) * binsPerSecond))
    const bins: number[] = new Array(totalBins).fill(0.1)

    return {
      bins,
      durationUs: probeRes.durationUs,
    }
  }

  /** 返回值由调用方 close；dispose 或取消会释放持久容器和解码器。 */
  async decodeFrame(blob: Blob, timeUs: number, signal?: AbortSignal): Promise<ImageBitmap | null> {
    if (this.disposed) throw new Error('适配器已释放')
    throwIfAborted(signal)
    if (blob.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(blob)
      if (signal?.aborted || this.disposed) {
        bitmap.close()
        throwIfAborted(signal)
        throw new Error('适配器已释放')
      }
      return bitmap
    }

    let entry = this.frameInputs.get(blob)
    if (!entry) {
      const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
      const sink = (async () => {
        const track = await input.getPrimaryVideoTrack()
        if (!track || !await track.canDecode()) throw new Error('视频素材缺少可解码的视频轨')
        return new CanvasSink(track, { poolSize: 1 })
      })()
      entry = { input, sink }
      this.frameInputs.set(blob, entry)
    }
    const current = entry
    const release = () => {
      if (this.frameInputs.get(blob) === current) this.frameInputs.delete(blob)
      current.input.dispose()
    }
    signal?.addEventListener('abort', release, { once: true })
    try {
      const sink = await abortable(current.sink, signal)
      throwIfAborted(signal)
      const frame = await abortable(sink.getCanvas(Math.max(0, timeUs / ONE_SECOND_US)), signal)
      throwIfAborted(signal)
      if (!frame) throw new Error(`视频素材在 ${timeUs} 微秒没有可解码的画面`)
      const bitmap = await createImageBitmap(frame.canvas)
      if (signal?.aborted || this.disposed) {
        bitmap.close()
        throwIfAborted(signal)
        throw new Error('适配器已释放')
      }
      return bitmap
    } catch (error) {
      release()
      throw error
    } finally {
      signal?.removeEventListener('abort', release)
    }
  }

  async encodeVideo(options: VideoEncodingOptions): Promise<Blob> {
    if (this.disposed) throw new Error('适配器已释放')
    const { totalFrames, renderFrame, signal, onProgress, format, frameRate, pcm } = options

    if (signal?.aborted) {
      throw new DOMException('编码已取消', 'AbortError')
    }

    const fpsNum = frameRate?.num || 30
    const fpsDen = frameRate?.den || 1
    const fps = fpsNum / fpsDen

    await assertBrowserEncodingSupport(options)
    throwIfAborted(signal)

    {
      const chunks: Uint8Array[] = []
      const streamTarget = new StreamTarget(
        new WritableStream<StreamTargetChunk>({
          write(chunk) {
            if (signal?.aborted) throw new DOMException('编码已取消', 'AbortError')
            chunks.push(new Uint8Array(chunk.data))
          },
        }),
        { chunked: true, chunkSize: 1024 * 1024 }
      )

      const output = new Output({
        target: streamTarget,
        format: format === 'mp4' ? new Mp4OutputFormat({ fastStart: false }) : new WebMOutputFormat(),
      })

      const videoSource = new VideoSampleSource({
        codec: format === 'mp4' ? 'avc' : 'vp9',
        quality: new Quality({ bitrate: 6_000_000 }),
        latencyMode: 'quality',
        hardwareAcceleration: 'prefer-hardware',
        keyFrameInterval: 2,
      })

      // 音频轨：PCM 已在混音器里合成好，这里按帧切成 <=1/30 秒的 planar 片段交错写入。
      // 编码器不支持对应音频编码时明确报错，绝不静默产出无声片。
      const audioCodec = format === 'mp4' ? 'aac' : 'opus'
      const audioSource = pcm
        ? new AudioSampleSource({ codec: audioCodec, quality: new Quality({ bitrate: AUDIO_BITRATE }) })
        : undefined

      output.addVideoTrack(videoSource)
      if (audioSource) output.addAudioTrack(audioSource)

      let cancelTask: Promise<void> | undefined
      const cancelOnAbort = () => {
        cancelTask ??= output.cancel().catch(() => {})
      }
      signal?.addEventListener('abort', cancelOnAbort, { once: true })

      try {
        throwIfAborted(signal)
        await abortable(output.start(), signal)
        throwIfAborted(signal)
        let audioOffset = 0
        for (let frame = 0; frame < totalFrames; frame++) {
          if (signal?.aborted) {
            throw new DOMException('编码已取消', 'AbortError')
          }

          const timeUs = Math.round((frame * ONE_SECOND_US) / fps)
          const canvasSource = await renderFrame(frame, timeUs)

          const timestampSec = frame / fps
          const durationSec = 1 / fps
          const sample = new VideoSample(canvasSource as CanvasImageSource, {
            timestamp: timestampSec,
            duration: durationSec,
          })

          try {
            await videoSource.add(sample)
          } finally {
            sample.close()
          }

          // 交错写入本帧对应的音频片段。逐次 await 保证背压，避免内存堆积。
          if (audioSource && pcm) {
            const end =
              frame === totalFrames - 1
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
              try {
                await audioSource.add(audioSample)
              } finally {
                audioSample.close()
              }
              audioOffset = end
            }
          }

          if (frame % 2 === 0) await yieldTask(signal)
          if (frame % 5 === 0 || frame === totalFrames - 1) {
            onProgress?.((frame + 1) / totalFrames * 0.9, '正在浏览器逐帧编码')
          }
        }

        videoSource.close()
        audioSource?.close()
        onProgress?.(0.95, '正在封装成片')
        await output.finalize()

        const mime = format === 'mp4' ? 'video/mp4' : 'video/webm'
        const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0)
        const merged = new Uint8Array(totalLen)
        let offset = 0
        for (const c of chunks) {
          merged.set(c, offset)
          offset += c.byteLength
        }

        onProgress?.(1.0, '导出完成')
        return new Blob([merged], { type: mime })
      } catch (err) {
        await (cancelTask ?? output.cancel().catch(() => {}))
        throw err
      } finally {
        signal?.removeEventListener('abort', cancelOnAbort)
      }
    }

  }

  dispose(): void {
    this.disposed = true
    for (const { input } of this.frameInputs.values()) input.dispose()
    this.frameInputs.clear()
  }
}
