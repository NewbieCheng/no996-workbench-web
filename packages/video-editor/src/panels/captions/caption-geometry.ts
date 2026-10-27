/**
 * 字幕烧录几何：与 Canvas 烧录共用的包围盒 / 铬框 transform，供舞台命中与 marker 同步。
 * 铬框尽量贴正文；换行上限仍由 widthRatio 控制（烧录侧独立使用）。
 */

import type { CaptionStyle, EditorDocument, TransformBox } from '../../core/project.ts'

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))

const CHROME_PAD_X = 12
const CHROME_PAD_Y = 8

let measureCtx: CanvasRenderingContext2D | null = null

function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx) return measureCtx
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  measureCtx = canvas.getContext('2d')
  return measureCtx
}

function estimateFallbackLines(style: CaptionStyle): number {
  if (style.pageLines === 1) return 1
  if (style.mode === 'rolling') return 3
  return Math.max(1, style.pageLines ?? 2)
}

/** 按当前句正文测宽/分行；无文本时退回紧凑估高（不再用 size*0.5 垫高） */
function measureCaptionChrome(
  style: CaptionStyle,
  canvasWidth: number,
  text?: string,
): { boxW: number; boxH: number } {
  const size = Math.max(1, style.size ?? 58)
  const widthRatio = clamp(style.widthRatio ?? 0.82, 0.05, 1)
  const maxW = Math.max(48, Math.round(canvasWidth * widthRatio))
  const lineHeight = clamp(style.lineHeight ?? 1.4, 1, 3)
  const weight = style.weight ?? 700
  const font = style.font || 'sans-serif'
  const spacing = style.letterSpacing ?? 0

  const trimmed = text?.trim()
  const ctx = getMeasureCtx()
  if (trimmed && ctx) {
    ctx.font = `${weight} ${size}px "${font}", sans-serif`
    const paragraphs = trimmed.split(/\r\n|\r|\n/)
    const lines: string[] = []
    for (const paragraph of paragraphs) {
      let line = ''
      for (const char of Array.from(paragraph)) {
        const next = line + char
        const w =
          spacing > 0
            ? Array.from(next).reduce((sum, c, i) => sum + ctx.measureText(c).width + (i > 0 ? spacing : 0), 0)
            : ctx.measureText(next).width
        if (line && w > maxW) {
          lines.push(line)
          line = char
        } else {
          line = next
        }
      }
      lines.push(line || '')
    }
    const usable = lines.filter((l) => l.length > 0)
    const lineCount = Math.max(1, usable.length || 1)
    let contentW = 0
    for (const l of usable.length ? usable : ['']) {
      const w =
        spacing > 0
          ? Array.from(l).reduce((sum, c, i) => sum + ctx.measureText(c).width + (i > 0 ? spacing : 0), 0)
          : ctx.measureText(l).width
      contentW = Math.max(contentW, w)
    }
    const boxW = Math.max(48, Math.min(maxW, Math.round(contentW + CHROME_PAD_X)))
    const boxH = Math.max(24, Math.round(size * lineHeight * lineCount + CHROME_PAD_Y))
    return { boxW, boxH }
  }

  const lines = estimateFallbackLines(style)
  const boxW = maxW
  const boxH = Math.max(24, Math.round(size * lineHeight * lines + CHROME_PAD_Y))
  return { boxW, boxH }
}

/** 由 captionStyle 推算舞台/时间线铬框（有 text 时贴正文） */
export function captionStyleToTransform(
  doc: EditorDocument,
  style: CaptionStyle = doc.captionStyle,
  text?: string,
): TransformBox {
  const { width, height } = doc.canvas
  const xRatio = clamp(style.xRatio ?? 0.5, 0.05, 0.95)
  const fallbackY = style.mode === 'clean' ? 0.87 : style.mode === 'editorial' ? 0.7 : 0.72
  const yRatio = clamp(style.yRatio ?? fallbackY, 0.05, 0.95)
  const { boxW, boxH } = measureCaptionChrome(style, width, text)
  return {
    x: Math.round(width * xRatio - boxW / 2),
    y: Math.round(height * yRatio - boxH / 2),
    width: boxW,
    height: boxH,
    rotationDeg: 0,
    opacity: 1,
    cropMode: 'contain',
    round: 0,
  }
}

/** 舞台命中用 AABB（与 captionStyleToTransform 一致） */
export function burnAlignedCaptionBox(
  doc: EditorDocument,
  style: CaptionStyle = doc.captionStyle,
  text?: string,
): { x: number; y: number; width: number; height: number } {
  const t = captionStyleToTransform(doc, style, text)
  return { x: t.x, y: t.y, width: t.width, height: t.height }
}

/** 拖拽后的比例写回 captionStyle */
export function ratiosFromDragDelta(
  style: CaptionStyle,
  dxRatio: number,
  dyRatio: number,
): { xRatio: number; yRatio: number } {
  const x0 = style.xRatio ?? 0.5
  const y0 = style.yRatio ?? 0.72
  let xRatio = clamp(x0 + dxRatio, 0.1, 0.9)
  if (Math.abs(xRatio - 0.5) < 0.025) xRatio = 0.5
  const yRatio = clamp(y0 + dyRatio, 0.18, 0.92)
  return { xRatio, yRatio }
}
