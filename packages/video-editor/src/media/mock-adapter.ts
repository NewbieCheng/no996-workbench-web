/**
 * 模拟媒体引擎适配器（用于 Node 自动化测试、轻量宿主与无 GPU 验证）
 */

import type {
  MediaEngineAdapter,
  MediaProbeResult,
  WaveformSummary,
  VideoEncodingOptions,
} from './types.ts'
import { ONE_SECOND_US, secondsToTimeUs } from '../core/time.ts'

export class MockMediaEngineAdapter implements MediaEngineAdapter {
  private disposed = false

  async probe(blob: Blob): Promise<MediaProbeResult> {
    if (this.disposed) throw new Error('适配器已释放')
    const type = blob.type || 'video/mp4'

    if (type.startsWith('audio/')) {
      return {
        kind: 'audio',
        durationUs: 5 * ONE_SECOND_US,
        hasAudio: true,
        sampleRate: 48000,
        numberOfChannels: 2,
        mimeType: type,
      }
    }

    if (type.startsWith('image/')) {
      return {
        kind: 'image',
        durationUs: 0,
        width: 1080,
        height: 1920,
        hasAudio: false,
        mimeType: type,
      }
    }

    return {
      kind: 'video',
      durationUs: 10 * ONE_SECOND_US,
      width: 1080,
      height: 1920,
      hasAudio: true,
      sampleRate: 48000,
      numberOfChannels: 2,
      mimeType: type,
    }
  }

  async extractWaveform(_blob: Blob, binsPerSecond = 30): Promise<WaveformSummary> {
    if (this.disposed) throw new Error('适配器已释放')
    const durationSeconds = 5
    const totalBins = durationSeconds * binsPerSecond
    const bins: number[] = []

    for (let i = 0; i < totalBins; i++) {
      // 确定性的合成能量包络
      bins.push(Math.abs(Math.sin(i / 5)) * 0.8)
    }

    return {
      bins,
      durationUs: secondsToTimeUs(durationSeconds),
    }
  }

  async decodeFrame(_blob: Blob, _timeUs: number): Promise<ImageBitmap | null> {
    if (this.disposed) throw new Error('适配器已释放')
    return null
  }

  async encodeVideo(options: VideoEncodingOptions): Promise<Blob> {
    if (this.disposed) throw new Error('适配器已释放')

    const { totalFrames, renderFrame, signal, onProgress, format } = options

    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        throw new DOMException('编码已取消', 'AbortError')
      }

      await renderFrame(frame, Math.round((frame * ONE_SECOND_US) / 30))
      onProgress?.(frame / totalFrames, '正在逐帧渲染')
    }

    onProgress?.(1.0, '编码完成')
    const mime = format === 'mp4' ? 'video/mp4' : 'video/webm'
    return new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])], { type: mime })
  }

  dispose(): void {
    this.disposed = true
  }
}
