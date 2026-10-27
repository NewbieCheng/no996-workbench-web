import { getTimelineFrameState, type AlignedSentence } from './timeline-engine.ts'
import { OUTPUT_WIDTH, OUTPUT_HEIGHT, projectTimeline, templateDesign, templatePalette, type TemplateProject, type TextLayer } from './template-project.ts'

export type TemplateContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type TextLayout = { lines: string[]; widths: number[]; lineHeight: number; height: number; overflow: boolean }
const CLOSE = /^[，。！？、；：,.!?;:）】》」』〕〉”’％%]/u
const OPEN = /[（【《「『〔〈“‘]$/u
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
function graphemes(text: string): string[] { return Array.from(segmenter.segment(text), item => item.segment) }
function setFont(context: TemplateContext, layer: TextLayer): void {
  context.font = `${layer.weight} ${layer.size}px ${layer.font}`
  context.textBaseline = 'top'
  context.textAlign = 'left'
  ;(context as TemplateContext & { letterSpacing: string }).letterSpacing = `${layer.letterSpacing}px`
}
/** Keeps every grapheme, including manual newlines; no truncation or hidden font shrink. */
export function layoutText(context: Pick<TemplateContext, 'measureText'>, text: string, width: number, size: number, lineHeight: number, height: number): TextLayout {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const char of graphemes(paragraph)) {
      if (line && context.measureText(line + char).width > width) {
        let carry = ''
        if (OPEN.test(line)) { const units = graphemes(line); carry = units.pop() ?? ''; line = units.join('') }
        if (CLOSE.test(char)) { const units = graphemes(line); carry = (units.pop() ?? '') + carry; line = units.join('') }
        // Prefer a word boundary when a Latin word continues across the edge.
        if (!carry && /[\p{L}\p{N}]$/u.test(line) && /^[a-zA-Z0-9]/.test(char)) {
          const space = line.lastIndexOf(' ')
          if (space > 0) { carry = line.slice(space + 1); line = line.slice(0, space + 1) }
        }
        if (line) lines.push(line)
        line = carry + char
      } else line += char
    }
    lines.push(line)
  }
  const widths = lines.map(line => context.measureText(line).width)
  const actualLineHeight = size * lineHeight
  const totalHeight = lines.length * actualLineHeight
  return { lines, widths, lineHeight: actualLineHeight, height: totalHeight, overflow: totalHeight > height + .01 || widths.some(value => value > width + .01) }
}
function roundRect(context: TemplateContext, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath(); context.roundRect(x, y, width, height, radius)
}
function imageSize(image: CanvasImageSource): [number, number] {
  if ('naturalWidth' in image) return [image.naturalWidth, image.naturalHeight]
  if ('videoWidth' in image) return [image.videoWidth, image.videoHeight]
  if ('displayWidth' in image) return [image.displayWidth, image.displayHeight]
  return [Number(image.width), Number(image.height)]
}
function newCanvas(width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT): HTMLCanvasElement | OffscreenCanvas | undefined {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document !== 'undefined') { const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; return canvas }
  return undefined
}
export function activeWordRange(sentence: AlignedSentence, wordIndex: number): { start: number; end: number } | undefined {
  let cursor = 0
  for (const word of sentence.words) {
    const start = sentence.text.indexOf(word.text, cursor)
    if (start < 0) continue
    const end = start + word.text.length
    if (word.index === wordIndex) return { start, end }
    cursor = end
  }
  return undefined
}
export class TemplatePainter {
  private timeline
  private cache = new Map<string, TextLayout>()
  private background?: HTMLCanvasElement | OffscreenCanvas
  overflow = false
  private project: TemplateProject
  private image?: CanvasImageSource
  private photoCrop: 'cover' | 'contain' = 'cover'
  /** 由 ShotBackdropRenderer 异步准备好、由 draw() 同步铺到背景的镜头帧 */
  private backdrop?: CanvasImageSource | null
  private backdropOpacity = 1
  constructor(project: TemplateProject, image?: CanvasImageSource, photoCrop: 'cover' | 'contain' = 'cover') {
    this.project = project; this.image = image; this.photoCrop = photoCrop; this.timeline = projectTimeline(project)
  }
  /**
   * 注入当前时刻的动效背景帧。调用方必须在 draw 之前 await 出帧。
   * 传 null 表示这一刻没有动效，退回模板底色。
   */
  setBackdrop(frame: CanvasImageSource | null, opacity = 1): void {
    // 背景层是缓存的（background canvas），换帧必须让缓存失效，
    // 否则会一直画第一帧的镜头。只在帧对象真的变了时失效，避免无谓重绘。
    if (this.backdrop !== frame) this.background = undefined
    this.backdrop = frame
    this.backdropOpacity = Math.max(0, Math.min(1, opacity))
  }

  updateProject(project: TemplateProject): void {
    if (project.templateId !== this.project.templateId || project.demo !== this.project.demo || project.subtitle.font !== this.project.subtitle.font || JSON.stringify(project.photo) !== JSON.stringify(this.project.photo) || JSON.stringify(project.design) !== JSON.stringify(this.project.design)) this.background = undefined
    if (project.captions !== this.project.captions || project.duration !== this.project.duration) this.timeline = projectTimeline(project)
    this.project = project
  }
  private text(context: TemplateContext, text: string, layer: TextLayer, opacity = 1, activeRange?: { start: number; end: number }): TextLayout {
    setFont(context, layer)
    const key = JSON.stringify([text, layer.width, layer.height, layer.font, layer.size, layer.weight, layer.lineHeight, layer.letterSpacing])
    let layout = this.cache.get(key)
    if (!layout) { layout = layoutText(context, text, layer.width, layer.size, layer.lineHeight, layer.height); if (this.cache.size >= 128) this.cache.clear(); this.cache.set(key, layout) }
    this.overflow ||= layout.overflow
    context.save(); context.globalAlpha = opacity; context.lineJoin = 'round'
    context.fillStyle = layer.color; context.strokeStyle = '#10151A'; context.lineWidth = layer.outline * 2
    let textOffset = 0
    layout.lines.forEach((line, index) => {
      const lineStart = text.indexOf(line, textOffset)
      textOffset = lineStart + line.length
      if (text[textOffset] === '\n') textOffset++
      const x = layer.x + (layer.align === 'center' ? (layer.width - layout.widths[index]) / 2 : layer.align === 'right' ? layer.width - layout.widths[index] : 0)
      const y = layer.y + index * layout.lineHeight
      if (layer.outline) context.strokeText(line, x, y)
      context.fillText(line, x, y)
      if (activeRange && activeRange.start < lineStart + line.length && activeRange.end > lineStart) {
        const at = Math.max(0, activeRange.start - lineStart)
        const end = Math.min(line.length, activeRange.end - lineStart)
        const left = context.measureText(line.slice(0, at)).width
        const right = context.measureText(line.slice(0, end)).width
        context.save(); context.beginPath(); context.rect(x + left, y - 2, right - left + 2, layout.lineHeight); context.clip(); context.fillStyle = templatePalette(this.project.templateId).accent; context.fillText(line, x, y); context.restore()
      }
    })
    context.restore()
    return layout
  }
  private base(context: TemplateContext) {
    const palette = templatePalette(this.project.templateId)
    const design = templateDesign(this.project)
    context.fillStyle = palette.background; context.fillRect(0, 0, design.width, design.height)
    // 动效背景：铺在底色之上、照片与文字之下，按 cover 铺满
    if (this.backdrop) {
      const source = this.backdrop as { width?: number; height?: number }
      const sw = source.width ?? design.width
      const sh = source.height ?? design.height
      if (sw > 0 && sh > 0) {
        const scale = Math.max(design.width / sw, design.height / sh)
        const dw = sw * scale
        const dh = sh * scale
        context.save()
        context.globalAlpha = this.backdropOpacity
        try {
          context.drawImage(this.backdrop, (design.width - dw) / 2, (design.height - dh) / 2, dw, dh)
        } catch {
          // 未就绪的帧直接跳过，退回底色
        }
        context.restore()
      }
    }
    if (this.image) {
      const photo = this.project.photo
      const [width, height] = imageSize(this.image)
      if (width && height) {
        const scale = this.photoCrop === 'contain'
          ? Math.min(photo.width / width, photo.height / height)
          : Math.max(photo.width / width, photo.height / height)
        context.save(); context.beginPath(); context.rect(photo.x, photo.y, photo.width, photo.height); context.clip()
        context.drawImage(this.image, photo.x - (width * scale - photo.width) * photo.focalX, photo.y - (height * scale - photo.height) * photo.focalY, width * scale, height * scale)
        context.restore()
      }
      const shade = context.createLinearGradient(0, this.project.photo.y + this.project.photo.height * .28, 0, this.project.photo.y + this.project.photo.height)
      shade.addColorStop(0, 'rgba(8,12,18,0)'); shade.addColorStop(1, 'rgba(8,12,18,0.78)')
      context.fillStyle = shade; context.fillRect(this.project.photo.x, this.project.photo.y, this.project.photo.width, this.project.photo.height)
    }
    context.save(); context.strokeStyle = palette.foreground; context.globalAlpha = .3; context.lineWidth = 2
    context.beginPath(); context.moveTo(76, 160); context.lineTo(1004, 160); context.stroke(); context.restore()
    if (this.project.demo) {
      context.fillStyle = '#172128'; roundRect(context, 870, 72, 130, 56, 12); context.fill()
      context.font = `700 27px ${this.project.subtitle.font}`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#FFFFFF'; context.fillText('DEMO', 935, 100)
    }
  }
  draw(context: TemplateContext, time: number): void {
    this.overflow = false
    const design = templateDesign(this.project)
    context.save(); context.clearRect(0, 0, design.width, design.height)
    if (!this.background) {
      this.background = newCanvas(design.width, design.height)
      const cached = this.background?.getContext('2d') as TemplateContext | null | undefined
      if (cached) this.base(cached)
    }
    if (this.background) context.drawImage(this.background, 0, 0)
    else this.base(context)
    const { templateId, title, subtitle } = this.project
    const palette = templatePalette(templateId)
    if (title.enabled && title.text) {
      if (title.background) { context.fillStyle = title.background; roundRect(context, title.x - 24, title.y - 24, title.width + 48, title.height + 48, 20); context.fill() }
      this.text(context, title.text, title)
    }
    const state = getTimelineFrameState(this.timeline, time)
    const sentence = state.currentSentence
    if (templateId === 'call') {
      context.fillStyle = '#15283F'; roundRect(context, 300, 68, 480, 70, 35); context.fill()
      context.font = `700 27px ${subtitle.font}`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = '#FFFFFF'; context.fillText(`${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time) % 60).padStart(2, '0')}`, 540, 104)
      context.fillStyle = '#90DDB0'; context.beginPath(); context.arc(344, 104, 7, 0, Math.PI * 2); context.fill()
    }
    if (templateId === 'lesson') {
      context.fillStyle = palette.accent; roundRect(context, 76, 72, 210, 64, 12); context.fill()
      context.font = `700 28px ${subtitle.font}`; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillStyle = palette.background; context.fillText(`POINT ${String(state.sentenceIndex + 1).padStart(2, '0')}`, 181, 104)
    }
    if (templateId === 'audiogram') {
      const envelope = this.project.audioEnvelope
      const value = envelope?.length ? envelope[Math.min(envelope.length - 1, Math.floor(time / this.project.duration * envelope.length))] : this.project.demo ? (Math.sin(time * 4) + 1) * .22 + .1 : 0
      context.fillStyle = palette.accent
      for (let i = 0; i < 24; i++) { const h = 12 + Math.min(1, value * (1 + Math.sin(i * 1.8) * .45)) * 180; roundRect(context, 252 + i * 24, 940 - h / 2, 10, h, 5); context.fill() }
    }
    if (!subtitle.enabled || !sentence) { context.restore(); return }
    const panel = subtitle.background || (['life', 'career', 'poster'].includes(templateId) ? palette.panel : '')
    if (panel) { context.fillStyle = panel; roundRect(context, subtitle.x - 24, subtitle.y - 24, subtitle.width + 48, subtitle.height + 48, 20); context.fill() }
    if (templateId === 'career') {
      context.fillStyle = palette.accent; context.fillRect(subtitle.x, subtitle.y - 26, 90, 5)
      this.text(context, sentence.text, { ...subtitle, align: 'left' })
    } else if (templateId === 'scroll' || templateId === 'call') {
      // Previous/next captions share the same measured layout and never use CSS clipping.
      const center = { ...subtitle, y: subtitle.y + subtitle.height / 3, height: subtitle.height / 3 }
      const smaller = { ...subtitle, size: subtitle.size * .72, color: '#FFFFFF', outline: subtitle.outline * .5, height: subtitle.height / 3 }
      if (state.prevSentence) this.text(context, state.prevSentence.text, smaller, .45)
      this.text(context, sentence.text, center)
      if (state.nextSentence) this.text(context, state.nextSentence.text, { ...smaller, y: subtitle.y + subtitle.height * 2 / 3 }, .45)
    } else if (templateId === 'tiktok') {
      // Overlay the active token onto the same full-line glyph drawing, preserving kerning.
      this.text(context, sentence.text, { ...subtitle, color: '#FFFFFF' }, 1, activeWordRange(sentence, state.activeWordIndex))
    } else {
      this.text(context, sentence.text, { ...subtitle, color: ['life', 'poster'].includes(templateId) && subtitle.color === '#FFD60A' ? palette.foreground : subtitle.color })
    }
    context.restore()
  }
}
export async function loadTemplateFonts(project: TemplateProject): Promise<void> {
  if (typeof document === 'undefined') return
  const layers = [project.title, project.subtitle]
  try {
    const timeout = new Promise<void>(resolve => setTimeout(resolve, 3000))
    const loader = Promise.all(
      layers.map(layer =>
        document.fonts
          .load(`${layer.weight} ${layer.size}px ${layer.font}`, layer.text || project.script || '口播视频')
          .catch(() => [])
      )
    ).then(async () => {
      try {
        await document.fonts.ready
      } catch {
        // ignore font readiness errors, fallback to system fonts
      }
    })
    await Promise.race([loader, timeout])
  } catch {
    // Graceful fallback to default system fonts without crashing canvas
  }
}
export async function loadTemplateImage(blob: Blob, signal?: AbortSignal): Promise<ImageBitmap> {
  if (signal?.aborted) throw new DOMException('cancelled', 'AbortError')
  const bitmap = await createImageBitmap(blob)
  if (signal?.aborted) { bitmap.close(); throw new DOMException('cancelled', 'AbortError') }
  return bitmap
}
