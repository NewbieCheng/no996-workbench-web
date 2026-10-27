/**
 * 统一播放控制器（处理连续 Seek 竞态取消与时间时钟推进）
 */

import type { TimeUs } from '../time.ts'
import type { EditorInstance } from '../instance.ts'

export type PlaybackControllerOptions = {
  editor: EditorInstance
  onSeekStart?: () => void
  onSeekEnd?: (timeUs: TimeUs) => void
}

export class PlaybackController {
  private editor: EditorInstance
  private currentSeekId = 0
  private options: PlaybackControllerOptions
  private timer: ReturnType<typeof setInterval> | null = null
  private rafId: number | null = null
  private lastTickMs = 0
  private isDisposed = false

  constructor(options: PlaybackControllerOptions) {
    this.editor = options.editor
    this.options = options
  }

  play(): void {
    if (this.isDisposed) return
    const doc = this.editor.getDocument()
    if (doc.durationUs <= 0) return

    // 如果播放头已经在末尾，重置到开头
    if (this.editor.getPlayheadUs() >= doc.durationUs && doc.durationUs > 0) {
      this.editor.setPlayheadUs(0)
    }

    this.editor.setIsPlaying(true)
    this.startClock()
  }

  pause(): void {
    if (this.isDisposed) return
    this.editor.setIsPlaying(false)
    this.stopClock()
  }

  togglePlay(): void {
    if (this.editor.getIsPlaying()) {
      this.pause()
    } else {
      this.play()
    }
  }

  /**
   * 异步 Seek 操作：具备递增 ID 竞态保护，只有最后一次发起的 Seek 能够生效
   */
  async seek(targetTimeUs: TimeUs): Promise<TimeUs> {
    if (this.isDisposed) return targetTimeUs
    const seekId = ++this.currentSeekId
    this.options.onSeekStart?.()

    const doc = this.editor.getDocument()
    const safeUs = Math.max(0, Math.min(targetTimeUs, doc.durationUs || Number.MAX_SAFE_INTEGER))

    // 模拟微任务让位保证并发测试
    await Promise.resolve()

    if (seekId !== this.currentSeekId || this.isDisposed) {
      // 被后续的新 Seek 覆盖，自动作废
      return safeUs
    }

    this.editor.setPlayheadUs(safeUs)
    this.options.onSeekEnd?.(safeUs)
    return safeUs
  }

  /**
   * 物理时钟步进（每帧推进）
   */
  tick(deltaMs: number): void {
    if (this.isDisposed || !this.editor.getIsPlaying()) return

    const deltaUs = Math.round(deltaMs * 1000)
    const currentUs = this.editor.getPlayheadUs()
    const doc = this.editor.getDocument()
    const nextUs = currentUs + deltaUs

    if (nextUs >= doc.durationUs && doc.durationUs > 0) {
      this.editor.setPlayheadUs(doc.durationUs)
      this.pause()
    } else {
      this.editor.setPlayheadUs(nextUs)
    }
  }

  private startClock(): void {
    this.stopClock()
    this.lastTickMs = performance.now()

    // 优先用 rAF：和屏幕刷新同拍，页面卡顿时由浏览器合并帧，
    // 不会像 setInterval 那样把延迟累积成一次大跳。
    if (typeof requestAnimationFrame === 'function') {
      const loop = (now: number) => {
        this.rafId = null
        if (this.isDisposed || !this.editor.getIsPlaying()) return
        const sinceLast = now - this.lastTickMs
        // rAF 是 60Hz，但播放头按 30Hz 推进：省一半 React 重渲染，画面仍是逐帧的
        if (sinceLast >= 1000 / 30) {
          this.lastTickMs = now
          this.tick(Math.min(100, Math.max(0, sinceLast)))
        }
        if (!this.isDisposed && this.editor.getIsPlaying()) {
          this.rafId = requestAnimationFrame(loop)
        }
      }
      this.rafId = requestAnimationFrame(loop)
      return
    }

    // 没有 rAF 的环境（SSR / 单测）退回定时器
    this.timer = setInterval(() => {
      const now = performance.now()
      const delta = Math.min(100, Math.max(0, now - this.lastTickMs))
      this.lastTickMs = now
      this.tick(delta)
    }, 1000 / 30)
  }

  private stopClock(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.rafId != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  dispose(): void {
    this.isDisposed = true
    this.stopClock()
  }
}
