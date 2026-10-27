/**
 * [只读回滚边界] 旧版 IP 视频渲染器
 * 仅用于旧版本数据只读兼容与回滚查看，新业务新建与二次调整已统一转入 @no996/video-editor 公共实例。
 */
export const IS_LEGACY_FALLBACK_RENDERER = true

import { buildAlignedTimeline, type AlignedTimeline } from './timeline-engine.ts'
import { createTemplateProject, validateTemplateProject, type SubtitleStyle, type TemplateProject } from './template-project.ts'
import { TemplatePainter, loadTemplateFonts, loadTemplateImage } from './template-renderer.ts'
import type { ShotBackdropRenderer } from './shot-backdrop.ts'
import type { SubtitleSegment } from './subtitles.ts'
export type { SubtitleStyle } from './template-project.ts'
export type { SubtitleSegment } from './subtitles.ts'
export type VideoRenderInput = {
  cover: Blob; audio?: Blob; script: string; duration: number; subtitleStyle: SubtitleStyle
  templateId?: string; project?: TemplateProject; signal?: AbortSignal
  onProgress?: (progress: number, stage: string) => void
  onMode?: (mode: 'worker' | 'offline' | 'realtime', mime: string) => void
}
export function estimateSpeechDuration(text: string, speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) throw new Error('语速必须大于零')
  return Array.from(text.replace(/\s/g, '')).length / (2.8 * speed)
}
export function formatVideoTime(seconds: number): string {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}
/** Legacy composition estimator; template projects store their single authoritative caption timeline. */
export function splitSubtitleTimeline(script: string, duration: number): SubtitleSegment[] {
  if (!Number.isFinite(duration) || duration <= 0) return []
  const sentences = (script.match(/[^。！？!?]+[。！？!?]*/gu) ?? []).map(text => text.trim()).filter(Boolean)
  const weights = sentences.map(text => Array.from(text.replace(/\s/g, '')).length)
  const total = weights.reduce((sum, n) => sum + n, 0)
  if (!total) return []
  let end = 0
  return sentences.map((text, i) => { const start = end; end = i === sentences.length - 1 ? duration : end + duration * weights[i] / total; return { text, start, end } })
}
export function subtitleIndexAt(timeline: SubtitleSegment[], time: number): number {
  if (!timeline.length) return -1
  const index = timeline.findIndex(segment => time < segment.end)
  return index < 0 ? timeline.length - 1 : index
}
export function supportedRealtimeMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return ['video/mp4;codecs=avc1.424028,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(mime => MediaRecorder.isTypeSupported(mime)) ?? ''
}
export function canRenderIPVideo(): boolean {
  return typeof VideoEncoder !== 'undefined' || (typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && Boolean(supportedRealtimeMime()))
}
/** Compatibility drawing entry point; preview and both exporters use TemplatePainter. */
export function drawFrame(context: CanvasRenderingContext2D, image: HTMLImageElement, timelineInput: SubtitleSegment[] | AlignedTimeline, time: number, style: SubtitleStyle, templateId = 'scroll'): void {
  const captions = 'sentences' in timelineInput ? timelineInput.sentences : timelineInput
  const duration = captions.at(-1)?.end ?? 10
  const project = createTemplateProject({ templateId, script: captions.map(item => item.text).join(''), duration, style })
  project.captions = captions.map(({ text, start, end }) => ({ text, start, end }))
  new TemplatePainter(project, image).draw(context, time)
}
export async function renderIPVideo(input: VideoRenderInput): Promise<Blob> {
  const project = input.project ?? createTemplateProject({ templateId: input.templateId ?? 'scroll', script: input.script, duration: input.duration, style: input.subtitleStyle })
  validateTemplateProject(project)
  if (!project.script.trim()) throw new Error('口播文案不能为空')
  if (input.signal?.aborted) throw new DOMException('cancelled', 'AbortError')
  const { encodeTemplate } = await import('./encoding/index')
  const encoded = await encodeTemplate({ project, cover: input.cover, audio: input.audio, signal: input.signal, onProgress: input.onProgress, onMode: input.onMode })
  if (encoded) return encoded
  const mime = supportedRealtimeMime()
  if (!mime || typeof HTMLCanvasElement.prototype.captureStream !== 'function') throw new Error('renderUnsupported')
  input.onMode?.('realtime', mime)
  return renderRealtime(input, project, mime)
}
async function renderRealtime(input: VideoRenderInput, project: TemplateProject, mime: string): Promise<Blob> {
  const check = () => { if (input.signal?.aborted) throw new DOMException('cancelled', 'AbortError') }
  check()
  const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920
  const context = canvas.getContext('2d'); if (!context) throw new Error('canvasFailed')
  let audioContext: AudioContext | undefined; let source: AudioBufferSourceNode | undefined
  let videoStream: MediaStream | undefined; let audioStream: MediaStream | undefined; let image: ImageBitmap | undefined
  let recorder: MediaRecorder | undefined; let interval: ReturnType<typeof setInterval> | undefined; let timeout: ReturnType<typeof setTimeout> | undefined
  // 动效背景渲染器：必须在 finally 里按需释放，故声明在 try 之外
  let backdrop: ShotBackdropRenderer | null = null
  let removeListeners = () => {}
  try {
    input.onProgress?.(0, 'prepareStage')
    // Reserve the audio context before awaiting material preparation.
    if (input.audio) { audioContext = new AudioContext(); await audioContext.resume(); if (audioContext.state !== 'running') throw new Error('audioBlocked') }
    await loadTemplateFonts(project); image = await loadTemplateImage(input.cover, input.signal); check()
    if (audioContext && input.audio) {
      const buffer = await audioContext.decodeAudioData(await input.audio.arrayBuffer()); check()
      const destination = audioContext.createMediaStreamDestination(); source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(destination); audioStream = destination.stream
    }
    const painter = new TemplatePainter(project, image)
    // 有动效背景时先异步出首帧再同步绘制；无镜头时这条路径与原来完全一致
    const { ShotBackdropRenderer: BackdropRenderer, templateHasShots } = await import('./shot-backdrop.ts')
    const hasShots = templateHasShots(project)
    backdrop = hasShots ? new BackdropRenderer() : null
    if (backdrop) painter.setBackdrop(await backdrop.frameAt(project, 0))
    painter.draw(context, 0)
    videoStream = canvas.captureStream(30)
    const combined = new MediaStream([...videoStream.getVideoTracks(), ...(audioStream?.getAudioTracks() ?? [])])
    recorder = new MediaRecorder(combined, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 })
    const activeRecorder = recorder
    const video = await new Promise<Blob>((resolve, reject) => {
      const chunks: Blob[] = []; let settled = false; let bytes = 0
      const fail = (error: Error) => { if (settled) return; settled = true; if (activeRecorder.state !== 'inactive') activeRecorder.stop(); reject(error) }
      const abort = () => fail(new DOMException('cancelled', 'AbortError'))
      const visibility = () => { if (document.visibilityState === 'hidden') fail(new Error('foregroundRequired')) }
      input.signal?.addEventListener('abort', abort, { once: true }); document.addEventListener('visibilitychange', visibility)
      removeListeners = () => { input.signal?.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', visibility) }
      activeRecorder.ondataavailable = event => { if (event.data.size) { bytes += event.data.size; if (bytes > 250 * 1024 * 1024) { fail(new Error('capacityLimit')); return }; chunks.push(event.data) } }
      activeRecorder.onerror = () => fail(new Error('encodingFailed'))
      activeRecorder.onstop = () => { if (settled) return; settled = true; chunks.length ? resolve(new Blob(chunks, { type: activeRecorder.mimeType || mime })) : reject(new Error('encodingFailed')) }
      if (input.signal?.aborted) { abort(); return }
      if (document.hidden) { visibility(); return }
      activeRecorder.start(1000); source?.start()
      const start = audioContext?.currentTime ?? performance.now() / 1000
      let ticking = false
      interval = setInterval(() => {
        // 出帧是异步的：上一帧没画完就跳过这一拍，避免叠加与内存堆积
        if (ticking) return
        ticking = true
        void (async () => {
          try {
            check()
            const elapsed = (audioContext?.currentTime ?? performance.now() / 1000) - start
            const at = Math.min(elapsed, project.duration)
            // 动效背景先异步出帧，再同步绘制（draw 本身不能 await）
            if (backdrop) painter.setBackdrop(await backdrop.frameAt(project, at))
            painter.draw(context, at)
            input.onProgress?.(15 + Math.min(1, elapsed / project.duration) * 80, 'subtitleStage')
            if (elapsed >= project.duration) {
              clearInterval(interval); interval = undefined
              source?.stop(); input.onProgress?.(96, 'encodeStage'); activeRecorder.stop()
            }
          } catch (error) {
            fail(error instanceof Error ? error : new Error(String(error)))
          } finally {
            ticking = false
          }
        })()
      }, 1000 / 30)
      timeout = setTimeout(() => fail(new Error('mediaTimeout')), (project.duration + 30) * 1000)
    })
    check(); input.onProgress?.(100, 'completed'); return video
  } finally {
    removeListeners(); if (interval) clearInterval(interval); if (timeout) clearTimeout(timeout)
    if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; if (recorder.state !== 'inactive') recorder.stop() }
    try { source?.stop() } catch { /* A finished source cannot be stopped twice in some browsers. */ }
    source?.disconnect(); videoStream?.getTracks().forEach(track => track.stop()); audioStream?.getTracks().forEach(track => track.stop()); backdrop?.dispose(); image?.close()
    await audioContext?.close()
  }
}
export { buildAlignedTimeline }
