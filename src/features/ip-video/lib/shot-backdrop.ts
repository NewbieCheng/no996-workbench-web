/**
 * IP 口播视频的动效背景层
 *
 * 让 IP 口播模板能直接复用视频工厂的 151 个动效镜头 —— 这不是复制一套动效，
 * 而是把同一个 `createDomFrameRenderer` 出的帧画进模板的背景位置。
 *
 * 关键约束：`TemplatePainter.draw()` 是同步的（预览每帧都调），而镜头光栅化是异步的。
 * 因此这里做「先异步准备、再同步绘制」：
 *   prepareShotBackdrop(project, time) → 异步出帧并缓存
 *   painter.setBackdrop(canvas)        → 同步铺图
 * 两条编码链路（离线 worker 与实时录制）都在 draw 前 await prepare。
 */

import { findShot } from '@no996/video-editor'
import { createDomFrameRenderer, type DomFrameRenderer } from '@no996/video-editor/demos/pipeline/dom-frame-renderer.ts'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT, type TemplateProject, type TemplateShot } from './template-project.ts'

export type ShotBackdropOptions = {
  /** 渲染分辨率；比输出小一档可大幅提速，视觉上通常看不出来 */
  width?: number
  height?: number
  fps?: number
}

/** 按时间找出当前生效的动效镜头（后加入者优先，便于叠加）。 */
export function activeShot(project: TemplateProject, time: number): TemplateShot | undefined {
  if (!project.shots?.length) return undefined
  let hit: TemplateShot | undefined
  for (const shot of project.shots) {
    if (time >= shot.start && time < shot.end) hit = shot
  }
  return hit
}

/**
 * 镜头背景渲染器集合。
 *
 * 每个 shotId 一个 renderer：复用 React 容器，比每帧重建快一个数量级。
 * 缓存上限按数量而不是字节数控制 —— 这里的画布是低分辨率背景，
 * 单个约 0.5MB（540×960），留 12 个足够覆盖一个工程常用的镜头数。
 */
export class ShotBackdropRenderer {
  private renderers = new Map<string, DomFrameRenderer>()
  private lastKey = ''
  private lastCanvas: HTMLCanvasElement | null = null
  private options: Required<ShotBackdropOptions>

  constructor(options: ShotBackdropOptions = {}) {
    this.options = {
      width: options.width ?? Math.round(OUTPUT_WIDTH * 0.5),
      height: options.height ?? Math.round(OUTPUT_HEIGHT * 0.5),
      fps: options.fps ?? 30,
    }
  }

  private rendererFor(shotId: string): DomFrameRenderer | null {
    const existing = this.renderers.get(shotId)
    if (existing) return existing
    const definition = findShot(shotId)
    if (!definition) return null
    // LRU 上限：超出时释放最早的
    if (this.renderers.size >= 12) {
      const oldest = this.renderers.keys().next().value
      if (oldest) {
        this.renderers.get(oldest)?.dispose()
        this.renderers.delete(oldest)
      }
    }
    const renderer = createDomFrameRenderer({
      load: definition.load,
      width: this.options.width,
      height: this.options.height,
      fps: this.options.fps,
      durationInFrames: definition.durationInFrames,
    })
    this.renderers.set(shotId, renderer)
    return renderer
  }

  /**
   * 出当前时刻的背景帧。同一 (镜头, 帧号) 只渲染一次 —— 预览会以 30fps 反复问同一帧。
   * 返回 null 表示这一刻没有动效背景，调用方应退回模板底色。
   */
  async frameAt(project: TemplateProject, time: number): Promise<HTMLCanvasElement | null> {
    const shot = activeShot(project, time)
    if (!shot) {
      this.lastKey = ''
      this.lastCanvas = null
      return null
    }
    const definition = findShot(shot.shotId)
    if (!definition) return null

    const rate = Math.max(0.25, Math.min(4, shot.rate ?? 1))
    const localSeconds = Math.max(0, time - shot.start) * rate
    const frame = Math.max(
      0,
      Math.min(definition.durationInFrames - 1, Math.floor(localSeconds * this.options.fps)),
    )
    const key = `${shot.shotId}@${frame}`
    if (key === this.lastKey) return this.lastCanvas

    const renderer = this.rendererFor(shot.shotId)
    if (!renderer) return null
    try {
      const canvas = await renderer.renderFrame(frame)
      this.lastKey = key
      this.lastCanvas = canvas
      return canvas
    } catch (error) {
      console.warn(`IP 动效背景渲染失败 ${shot.shotId}@${frame}:`, error)
      return null
    }
  }

  dispose(): void {
    for (const renderer of this.renderers.values()) renderer.dispose()
    this.renderers.clear()
    this.lastKey = ''
    this.lastCanvas = null
  }
}

/** 供调用方快速判断「这个工程要不要走异步背景路径」。 */
export function templateHasShots(project: TemplateProject): boolean {
  return Boolean(project.shots?.some((shot) => shot.end > shot.start))
}
