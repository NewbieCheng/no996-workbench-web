/**
 * 预览实时混音播放
 *
 * IP 口播链路用单个 <audio> 元素；视频工厂要混多条音轨并与 playheadUs 同步。
 * 这里用 AudioContext + AudioBufferSourceNode：
 *  - 播放时按当前播放头 offset 启动；
 *  - 暂停时停止节点；
 *  - seek 时重建节点（只在 seek/播放状态切换时重建，绝不在每帧重建 —— 否则会爆音）。
 */

import type { PCM } from '../media/pcm.ts'

export type AudioMixPlaybackOptions = {
  /** 每帧可变的播放头；读取当前值用 */
  sampleRate?: number
}

export class AudioMixPlayback {
  private context: AudioContext | null = null
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private startedAt = 0
  private startedOffset = 0

  /** 载入混音结果。重复调用会替换当前音频并停止播放。 */
  async load(pcm: PCM | null): Promise<void> {
    this.stopSource()
    if (!pcm) {
      this.buffer = null
      return
    }
    const context = this.ensureContext()
    if (!context) return
    const buffer = context.createBuffer(pcm.channels.length, pcm.length, pcm.sampleRate)
    for (let i = 0; i < pcm.channels.length; i++) {
      buffer.copyToChannel(pcm.channels[i], i)
    }
    this.buffer = buffer
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context
    const Ctor = globalThis.AudioContext
    if (!Ctor) return null
    try {
      this.context = new Ctor()
      return this.context
    } catch {
      return null
    }
  }

  /** 从指定播放头（微秒）开始播放。 */
  play(playheadUs: number): void {
    const context = this.ensureContext()
    if (!context || !this.buffer) return
    void context.resume().catch(() => undefined)
    this.stopSource()

    const offsetSec = Math.max(0, playheadUs / 1_000_000)
    if (offsetSec >= this.buffer.duration) return

    const source = context.createBufferSource()
    source.buffer = this.buffer
    source.connect(context.destination)
    source.start(0, offsetSec)

    this.source = source
    this.startedAt = context.currentTime
    this.startedOffset = offsetSec
  }

  pause(): void {
    this.stopSource()
  }

  /** seek 后若正在播放，需要用新位置重启节点。 */
  seek(playheadUs: number, isPlaying: boolean): void {
    if (!isPlaying) return
    this.play(playheadUs)
  }

  /** 当前音频时间轴位置（微秒），用于与画面校正。 */
  currentUs(): number {
    if (!this.context || !this.source) return 0
    return Math.round((this.startedOffset + (this.context.currentTime - this.startedAt)) * 1_000_000)
  }

  private stopSource(): void {
    if (!this.source) return
    try {
      this.source.stop()
    } catch {
      // 已停止的节点再次 stop 会抛错，忽略
    }
    try {
      this.source.disconnect()
    } catch {
      // 同上
    }
    this.source = null
  }

  dispose(): void {
    this.stopSource()
    this.buffer = null
    if (this.context) {
      void this.context.close().catch(() => undefined)
      this.context = null
    }
  }
}
