/** 公共 Canvas 字幕。显示行的时间来自 cue 时长估算，不是 ASR 逐字时间。 */
import type { CaptionCue, CaptionStyle, EditorDocument } from '../core/project.ts'
import type { SceneSnapshot } from './plan.ts'

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
const finite = (value: number | undefined, fallback: number) => Number.isFinite(value) ? value! : fallback

/** undefined 也表示继承，避免稀疏覆盖意外擦掉全片值。 */
export function resolveCaptionStyle(base: CaptionStyle, override?: Partial<CaptionStyle>): CaptionStyle {
  const defined = Object.fromEntries(Object.entries(override ?? {}).filter(([, value]) => value !== undefined))
  return { ...base, ...defined }
}

export function captionFont(style: CaptionStyle, size = style.size): string {
  return `${clamp(finite(style.weight, 700), 1, 1000)} ${Math.max(1, finite(size, 58))}px ${style.font || 'sans-serif'}`
}

export type CaptionFontOptions = {
  timeoutMs?: number
  /** 离屏导出可传入其实际绘图环境的 FontFaceSet。 */
  fontSet?: FontFaceSet
}

/**
 * 预览/导出启动前 await；按实际 cue 覆盖、字重和正文加载字体（包括 unicode 子集）。
 * 允许系统字体；FontFaceSet 对未安装的本地字体仍可能返回系统 fallback，浏览器无法鉴别。
 * 此函数不会注册字体，也不会下载任意自定义 URL；宿主负责已有 @font-face 注册。
 */
export async function ensureCaptionFonts(doc: EditorDocument, options: CaptionFontOptions = {}): Promise<void> {
  const used = doc.captions.map((cue) => ({ cue, style: resolveCaptionStyle(doc.captionStyle, cue.styleOverride) }))
    .filter(({ cue, style }) => style.burn && cue.text.trim())
  if (!used.length) return
  const fonts = options.fontSet ?? (typeof document !== 'undefined' ? document.fonts : undefined)
  if (!fonts) throw new Error('字幕字体加载失败：当前绘图环境未提供 FontFaceSet。')
  const requests = new Map<string, Set<string>>()
  // rolling 的上下文也用当前 cue 字体绘制，需提前覆盖相邻正文的 unicode 子集。
  const rollingText = used.some(({ style }) => style.mode === 'rolling') ? used.map(({ cue }) => cue.text).join('') : ''
  for (const { cue, style } of used) {
    const font = captionFont(style)
    const chars = requests.get(font) ?? new Set<string>()
    for (const char of style.mode === 'rolling' ? rollingText : cue.text) chars.add(char)
    requests.set(font, chars)
  }
  const timeoutMs = Math.max(1, finite(options.timeoutMs, 15000))
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.all([...requests].map(async ([font, chars]) => {
        const sample = [...chars].join('')
        try {
          await fonts.load(font, sample)
          if (!fonts.check(font, sample)) throw new Error('字体尚未就绪')
        } catch (error) {
          throw new Error(`字幕字体加载失败（${font}）：${error instanceof Error ? error.message : String(error)}`)
        }
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`字幕字体加载超时（${timeoutMs}ms）：${[...requests.keys()].join('；')}`)), timeoutMs)
      }),
    ])
    // 字体就绪后丢弃此前可能用 fallback 字体测得的换行缓存。
    for (const { cue } of used) lineCache.delete(cue)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((part) => part.segment)
  }
  return Array.from(text)
}

function measure(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  if (!spacing) return ctx.measureText(text).width
  const chars = graphemes(text)
  return chars.reduce((width, char) => width + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * spacing
}

/** 中文/英文均按实际 Canvas 测宽；保留全部正文，不按字符上限截断。 */
export function wrapCaptionText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, letterSpacing = 0): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r\n|\r|\n/)) {
    let line = ''
    for (const char of graphemes(paragraph)) {
      if (line && measure(ctx, line + char, letterSpacing) > maxWidth) {
        lines.push(line)
        line = ''
      }
      line += char
    }
    lines.push(line)
  }
  return lines.length ? lines : ['']
}

type TimedLine = { text: string; start: number; end: number }
const lineCache = new WeakMap<CaptionCue, { key: string; lines: string[] }>()

function linesFor(ctx: CanvasRenderingContext2D, cue: CaptionCue, width: number, spacing: number, kinetic: boolean): string[] {
  const key = `${ctx.font}|${width}|${spacing}|${kinetic}|${cue.text}`
  const cached = lineCache.get(cue)
  if (cached?.key === key) return cached.lines
  // 标点保留在短句里；所有短句仍会进入时间序列。
  const paragraphs = kinetic ? cue.text.match(/[^，。！？；、,.!?;\n]+[，。！？；、,.!?;\n]*|[，。！？；、,.!?;\n]+/gu) ?? [cue.text] : [cue.text]
  const lines = paragraphs.flatMap((text) => wrapCaptionText(ctx, text, width, spacing))
  lineCache.set(cue, { key, lines })
  return lines
}

function timedLines(lines: string[], cue: CaptionCue, pageSize: number): TimedLine[] {
  const pages: string[] = []
  for (let i = 0; i < lines.length; i += pageSize) pages.push(lines.slice(i, i + pageSize).join('\n'))
  const weights = pages.map((text) => Math.max(1, graphemes(text).length))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let offset = 0
  return pages.map((text, index) => {
    const start = cue.startUs + cue.durationUs * offset / total
    offset += weights[index]
    return { text, start, end: cue.startUs + cue.durationUs * offset / total }
  })
}

function drawText(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  style: CaptionStyle, spacing: number, color: string, align: CanvasTextAlign
): void {
  ctx.textAlign = align
  ctx.fillStyle = color
  ctx.strokeStyle = style.outlineColor || '#000000'
  ctx.lineWidth = Math.max(0, finite(style.outlineWidth, 0))
  ctx.lineJoin = 'round'
  const paint = (value: string, px: number) => {
    if (ctx.lineWidth > 0 && style.outlineWidth > 0) ctx.strokeText(value, px, y)
    ctx.fillText(value, px, y)
  }
  if (!spacing) { paint(text, x); return }
  const width = measure(ctx, text, spacing)
  let cursor = x - (align === 'center' ? width / 2 : align === 'right' ? width : 0)
  ctx.textAlign = 'left'
  for (const char of graphemes(text)) {
    paint(char, cursor)
    cursor += ctx.measureText(char).width + spacing
  }
}

/** 新模式统一绘制入口；旧单句模式由 compositor 保留原行为。 */
export function renderCaptions(ctx: CanvasRenderingContext2D, scene: SceneSnapshot): void {
  const cue = scene.activeCaption
  if (!cue?.text.trim()) return
  const style = resolveCaptionStyle(scene.captionStyle, cue.styleOverride)
  if (!style.burn || !style.mode) return
  const { canvasWidth: width, canvasHeight: height, timeUs } = scene
  const size = Math.max(1, finite(style.size, 58))
  const spacing = finite(style.letterSpacing, 0)
  const lineHeight = size * clamp(finite(style.lineHeight, 1.45), 1, 3)
  // Include background padding in the horizontal safe bounds, including sidebars.
  const padding = size * .3
  const maxWidth = Math.max(1, Math.min(width - padding * 2, width * clamp(finite(style.widthRatio, style.mode === 'kinetic' ? 0.68 : 0.84), 0.05, 1)))
  const x = clamp(width * finite(style.xRatio, 0.5), maxWidth / 2 + padding, width - maxWidth / 2 - padding)
  const motion = clamp(finite(style.motion, 0.75), 0, 1)
  const align = style.align ?? (style.mode === 'editorial' ? 'left' : 'center')
  const anchorX = align === 'left' ? x - maxWidth / 2 : align === 'right' ? x + maxWidth / 2 : x
  const color = style.color || '#ffffff'
  const emphasis = style.emphasisColor || color
  ctx.save()
  ctx.font = captionFont(style)
  ctx.textBaseline = 'middle'
  const textWidth = Math.max(1, maxWidth - (style.mode === 'editorial' ? size * 0.56 : 0))
  const lines = linesFor(ctx, cue, textWidth, spacing, style.mode === 'kinetic')
  const pageSize = style.mode === 'clean' ? (style.pageLines === 1 ? 1 : 2) : style.mode === 'editorial' ? 4 : 1
  const timed = timedLines(lines, cue, pageSize)
  const index = Math.max(0, timed.findIndex((line) => timeUs < line.end))
  const current = timed[index]
  const progress = clamp((timeUs - current.start) / Math.max(1, current.end - current.start), 0, 1)
  const rows = style.mode === 'rolling' ? 3 : current.text.split('\n').length
  const blockHeight = lineHeight * rows
  const fallbackY = style.mode === 'clean' ? 0.87 : style.mode === 'editorial' ? 0.7 : 0.72
  const y = clamp(height * finite(style.yRatio, fallbackY), Math.min(height / 2, blockHeight / 2 + size * 0.3), Math.max(height / 2, height - blockHeight / 2 - size * 0.3))
  const top = y - blockHeight / 2
  const cueProgress = clamp((timeUs - cue.startUs) / Math.max(1, cue.durationUs), 0, 1)
  const transitionUs = Math.min(220_000, Math.max(1, cue.durationUs * 0.22))
  const entranceProgress = clamp((timeUs - cue.startUs) / transitionUs, 0, 1)
  const exitProgress = clamp((timeUs - (cue.startUs + cue.durationUs - transitionUs)) / transitionUs, 0, 1)
  const animate = (kind: CaptionStyle['entrance'], progress: number, leaving = false) => {
    if (!kind || kind === 'none' || motion <= 0) return
    const eased = 1 - Math.pow(1 - progress, 3)
    if (kind === 'fade' || kind === 'fade-up' || kind === 'pop') ctx.globalAlpha *= leaving ? 1 - eased * motion : (1 - motion) + eased * motion
    if (kind === 'fade-up' || kind === 'slide') {
      const distance = size * 0.36 * motion * (leaving ? -1 : 1)
      ctx.translate(0, leaving ? -distance * eased : distance * (1 - eased))
    }
    if (kind === 'slide') ctx.translate((leaving ? 1 : -1) * size * 0.55 * motion * (leaving ? eased : 1 - eased), 0)
    if (kind === 'pop') {
      const scale = leaving ? 1 - 0.08 * motion * eased : 1 - 0.12 * motion * (1 - eased)
      ctx.translate(x, y)
      ctx.scale(scale, scale)
      ctx.translate(-x, -y)
    }
  }
  animate(style.entrance, entranceProgress)
  animate(style.exit, exitProgress, true)
  // The short gap at the edge keeps the next sentence from inheriting a fading cue.
  if (motion > 0 && cueProgress > 0.94 && style.exit && style.exit !== 'none') ctx.globalAlpha *= 1 - motion + motion * clamp((1 - cueProgress) / 0.06, 0, 1)
  if (style.backgroundColor || style.mode === 'editorial') {
    ctx.fillStyle = style.backgroundColor || 'rgba(12, 16, 24, 0.88)'
    ctx.fillRect(x - maxWidth / 2 - size * 0.3, top - size * 0.2, maxWidth + size * 0.6, blockHeight + size * 0.4)
  }
  if (style.mode === 'rolling') {
    // 相邻 cue 仅提供上下文；空隙内不显示字幕，也不伪造逐字时间。
    const ordered = [...(scene.captions ?? [cue])]
      .filter((entry) => entry.text.trim() && resolveCaptionStyle(scene.captionStyle, entry.styleOverride).burn)
      .sort((a, b) => a.startUs - b.startUs)
    const cueIndex = ordered.findIndex((entry) => entry.id === cue.id)
    const previousCue = ordered[cueIndex - 1]
    const nextCue = ordered[cueIndex + 1]
    const previousLines = previousCue ? linesFor(ctx, previousCue, maxWidth, spacing, false) : []
    const nextLines = nextCue ? linesFor(ctx, nextCue, maxWidth, spacing, false) : []
    const surrounding = [previousLines.at(-1), ...lines, ...nextLines.slice(0, 2)]
    // 最后一行无后续时停留；否则在行时段末尾连续滑向下一行。
    const hasNext = index + 1 < lines.length || nextLines.length > 0
    const slideStart = 1 - 0.35 * motion
    const p = motion > 0 && hasNext ? clamp((progress - slideStart) / (1 - slideStart), 0, 1) : 0
    const slide = p * p * (3 - 2 * p)
    ctx.beginPath()
    ctx.rect(x - maxWidth / 2 - size * 0.2, top, maxWidth + size * 0.4, blockHeight)
    ctx.clip()
    const transitionAlpha = ctx.globalAlpha
    for (let offset = -1; offset <= 2; offset++) {
      const text = surrounding[index + 1 + offset]
      if (text === undefined) continue
      const distance = Math.abs(offset - slide)
      ctx.globalAlpha = transitionAlpha * (1 - clamp(distance, 0, 1) * 0.63)
      drawText(ctx, text, anchorX, y + (offset - slide) * lineHeight, style, spacing, distance < 0.5 ? emphasis : color, align)
    }
  } else if (style.mode === 'kinetic') {
    // 短句完整出现，只有入场变换；不是打字机/逐字识别效果。
    const legacyEntrance = style.entrance ? 1 : 1 - Math.pow(1 - clamp((timeUs - current.start) / 220000, 0, 1), 3)
    const scale = 1 - (1 - legacyEntrance) * 0.16 * motion
    ctx.translate(x, y + (1 - legacyEntrance) * size * 0.45 * motion)
    ctx.scale(scale, scale)
    ctx.globalAlpha *= 1 - (1 - legacyEntrance) * motion
    drawText(ctx, current.text, anchorX - x, 0, style, spacing, emphasis, align)
  } else {
    // clean 两行页 / editorial 独立文字区：分页推进，完整保留所有显示行。
    const page = current.text.split('\n')
    if (style.mode === 'editorial') {
      ctx.fillStyle = emphasis
      ctx.fillRect(x - maxWidth / 2, top, Math.max(3, size * 0.07), blockHeight)
    }
    page.forEach((text, row) => {
      const inset = style.mode === 'editorial' ? size * 0.28 : 0
      const px = anchorX + (align === 'left' ? inset : align === 'right' ? -inset : 0)
      drawText(ctx, text, px, top + lineHeight * (row + 0.5), style, spacing, color, align)
    })
  }
  ctx.restore()
}
