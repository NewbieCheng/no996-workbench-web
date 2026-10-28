/** Shared DOM-frame cache. Requests are isolated by content, canvas, frame rate and source duration. */
import { createDomFrameRenderer, type DomFrameRenderer } from '../demos/pipeline/dom-frame-renderer.ts'
import { findShot } from '../demos/registry.generated.ts'
import { contentShotTextError, ensureContentShotFonts, findContentShot } from '../demos/content-variants.tsx'

export type ShotFrameRequest = {
  shotId: string
  presentation?: 'content'
  instanceId?: string
  sourceDurationFrames?: number
  frame: number
  width: number
  height: number
  fps: number
  props?: Record<string, unknown>
}

type CacheEntry = { canvas: HTMLCanvasElement; bytes: number; lastUsed: number }
type RendererEntry = { renderer: DomFrameRenderer; lastUsed: number; active: number }
const PREVIEW_WIDTH = 360
const PREVIEW_BUDGET_BYTES = 32 * 1024 * 1024
const RENDERER_LIMIT = 12

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

export class ShotFrameCache {
  private preview = new Map<string, CacheEntry>()
  private pending = new Map<string, Promise<HTMLCanvasElement | null>>()
  private previewBytes = 0
  private renderers = new Map<string, RendererEntry>()
  private exportRenderers = new Map<string, RendererEntry>()
  private clock = 0
  private generation = 0

  private identity(request: ShotFrameRequest): string {
    return stable([request.shotId, request.presentation ?? 'demo', request.instanceId ?? '', request.width, request.height, request.fps, request.sourceDurationFrames ?? findShot(request.shotId)?.durationInFrames, request.props ?? {}])
  }

  async getPreview(request: ShotFrameRequest): Promise<HTMLCanvasElement | null> {
    const width = Math.min(PREVIEW_WIDTH, request.width)
    const height = Math.round(width / request.width * request.height)
    const key = `${this.identity(request)}@${width}x${height}:${request.frame}`
    const hit = this.preview.get(key)
    if (hit) { hit.lastUsed = ++this.clock; return hit.canvas }
    const pending = this.pending.get(key)
    if (pending) return pending
    const generation = this.generation
    const work = this.render(request, false).then(original => {
      if (generation !== this.generation) return null
      // Always render in project coordinates; thumbnails downsample the result rather than reflowing a shot.
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('无法创建镜头缩略图画布。')
      ctx.drawImage(original, 0, 0, width, height)
      const bytes = width * height * 4
      this.preview.set(key, { canvas, bytes, lastUsed: ++this.clock })
      this.previewBytes += bytes
      this.evictFrames()
      return canvas
    }).catch(error => { console.warn(`镜头缩略图失败 ${request.shotId}:`, error); return null }).finally(() => { if (this.pending.get(key) === work) this.pending.delete(key) })
    this.pending.set(key, work)
    return work
  }

  /** Full resolution frames are not retained; failures propagate to the export task. */
  async getFullRes(request: ShotFrameRequest): Promise<HTMLCanvasElement | null> {
    return this.render(request, true)
  }

  private async render(request: ShotFrameRequest, forExport: boolean): Promise<HTMLCanvasElement> {
    const generation = this.generation
    const original = findShot(request.shotId)
    const definition = request.presentation === 'content' ? findContentShot(request.shotId) : original
    if (!definition || !original) throw new Error(`镜头未登记或没有对应的内容适配：${request.shotId}`)
    if (request.presentation === 'content') {
      if (!Number.isInteger(request.sourceDurationFrames) || (request.sourceDurationFrames ?? 0) < 1) throw new Error('内容镜头必须提供有效源帧长，不回退演示时长。')
      const error = contentShotTextError(request.props ?? {})
      if (error) throw new Error(`内容镜头参数无效（${request.shotId}）：${error}`)
      await ensureContentShotFonts()
    }
    if (generation !== this.generation) throw new Error('镜头缓存已释放。')
    const key = this.identity(request)
    const cache = forExport ? this.exportRenderers : this.renderers
    let entry = cache.get(key)
    if (!entry) {
      // 竖屏画布：按镜头的 vertical 预设把 1920×1080 内容装进 9:16（reflow 变体自带重排）
      const verticalPreset = request.height > request.width ? original.vertical : undefined
      entry = { renderer: createDomFrameRenderer({ load: definition.load, width: request.width, height: request.height, fps: request.fps, durationInFrames: request.sourceDurationFrames ?? original.durationInFrames, props: request.props ?? {}, vertical: verticalPreset }), lastUsed: ++this.clock, active: 0 }
      cache.set(key, entry)
    }
    entry.lastUsed = ++this.clock
    entry.active++
    this.evictRenderers(cache)
    try { return await entry.renderer.renderFrame(request.frame) }
    catch (error) { throw new Error(`镜头渲染失败（${request.shotId}，第 ${request.frame} 帧）：${error instanceof Error ? error.message : String(error)}`) }
    finally {
      entry.active--
      if (generation !== this.generation && entry.active === 0) entry.renderer.dispose()
      this.evictRenderers(cache)
    }
  }

  private evictRenderers(cache: Map<string, RendererEntry>) {
    for (const [key, entry] of [...cache.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)) {
      if (cache.size <= RENDERER_LIMIT) break
      if (entry.active) continue
      entry.renderer.dispose()
      cache.delete(key)
    }
  }
  private evictFrames() {
    for (const [key, entry] of [...this.preview.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)) {
      if (this.previewBytes <= PREVIEW_BUDGET_BYTES) break
      this.preview.delete(key)
      this.previewBytes -= entry.bytes
    }
  }
  dispose() {
    this.generation++
    for (const entry of this.renderers.values()) if (!entry.active) entry.renderer.dispose()
    for (const entry of this.exportRenderers.values()) if (!entry.active) entry.renderer.dispose()
    this.renderers.clear(); this.exportRenderers.clear(); this.pending.clear(); this.clearFrames()
  }
  clearFrames() { this.preview.clear(); this.previewBytes = 0 }
}

let sharedCache: ShotFrameCache | null = null
export function getShotFrameCache(): ShotFrameCache { return sharedCache ??= new ShotFrameCache() }

/** Resolve timeline time into source frames; the same duration is also passed to FrameProvider. */
export function resolveShotFrame(input: { playheadUs: number; startUs: number; rate: number; fps: number; sourceDurationFrames: number }): number {
  const { playheadUs, startUs, rate, fps, sourceDurationFrames } = input
  const rateSafe = Math.max(.25, Math.min(4, Number.isFinite(rate) ? rate : 1))
  return Math.max(0, Math.min(sourceDurationFrames - 1, Math.floor(Math.max(0, playheadUs - startUs) / 1_000_000 * fps * rateSafe)))
}
