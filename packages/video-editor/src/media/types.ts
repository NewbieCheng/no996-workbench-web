/**
 * 媒体引擎适配层接口定义与资源池规范
 */

import type { TimeUs } from '../core/time.ts'

export type MediaProbeResult = {
  kind: 'video' | 'audio' | 'image'
  durationUs: TimeUs
  width?: number
  height?: number
  hasAudio: boolean
  sampleRate?: number
  numberOfChannels?: number
  mimeType: string
}

export type WaveformSummary = {
  bins: number[] // 0.0 - 1.0 的能量振幅摘要
  durationUs: TimeUs
}

export type VideoEncodingFormat = 'mp4' | 'webm'

export type VideoEncodingOptions = {
  width: number
  height: number
  frameRate: { num: number; den: number }
  format: VideoEncodingFormat
  totalFrames: number
  renderFrame: (frameIndex: number, timeUs: TimeUs) => Promise<CanvasImageSource>
  /** 已解码并混音好的 PCM；有值时写入音频轨 */
  pcm?: import('./pcm.ts').PCM
  signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
}

export interface MediaEngineAdapter {
  probe(blob: Blob): Promise<MediaProbeResult>
  extractWaveform(blob: Blob, binsPerSecond?: number): Promise<WaveformSummary>
  decodeFrame(blob: Blob, timeUs: TimeUs, signal?: AbortSignal): Promise<ImageBitmap | null>
  encodeVideo(options: VideoEncodingOptions): Promise<Blob>
  dispose(): void
}

export interface ResourcePool {
  acquireUrl(blobId: string, blob: Blob): string
  releaseUrl(blobId: string): void
  clear(): void
}
