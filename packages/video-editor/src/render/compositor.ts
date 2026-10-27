/**
 * 纯 Canvas 2D 离屏画面合成器（预览与离线编码 100% 共享）
 */

import type { SceneSnapshot, RenderableVisualItem } from './plan.ts'
import type { ShotClipElement, TextClipElement } from '../core/project.ts'
import { evaluateElementOpacity, evaluateElementTransform } from './evaluator.ts'
import { renderCaptions, resolveCaptionStyle } from './captions.ts'
// 可供宿主在首次预览与导出前显式 await，不让同步合成器隐式等待字体。
export { ensureCaptionFonts } from './captions.ts'

export type CanvasAssetSource = CanvasImageSource | null

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

/**
 * 镜头元素的外观解算器。
 *
 * 合成器本身必须保持同步（预览每帧都会调用），但镜头帧是异步光栅化出来的。
 * 因此把「取镜头帧」抽成外部注入：调用方在渲染前把当前帧需要的镜头画面准备好，
 * 这里只做同步取用。这样预览与导出走的是同一段绘制代码。
 */
export type ShotFrameResolver = (input: {
  elementId: string
  shotId: string
  localTimeUs: number
  durationUs: number
}) => CanvasImageSource | null

export type RenderSceneOptions = {
  assetSourceResolver?: (elementId: string) => CanvasAssetSource
  shotFrameResolver?: ShotFrameResolver
}

export function renderSceneToCanvas(
  ctx: CanvasRenderingContext2D,
  scene: SceneSnapshot,
  assetSourceResolver: (elementId: string) => CanvasAssetSource,
  shotFrameResolver?: ShotFrameResolver
): void {
  const { canvasWidth, canvasHeight, backgroundColor, items, activeCaption, captionStyle } = scene

  // 1. 清空并绘制画布底色
  ctx.save()
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  ctx.fillStyle = backgroundColor || '#000000'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.restore()

  // 2. 依次绘制视觉图层
  for (const item of items) {
    renderVisualItem(ctx, item, assetSourceResolver(item.element.id), shotFrameResolver)
  }

  // 3. 绘制烧录字幕（如果开启）
  if (activeCaption && activeCaption.text.trim()) {
    const style = resolveCaptionStyle(captionStyle, activeCaption.styleOverride)
    if (style.burn) {
      if (style.mode) renderCaptions(ctx, scene)
      else renderCaptionOverlay(ctx, activeCaption.text, style, canvasWidth, canvasHeight)
    }
  }
}

function renderVisualItem(
  ctx: CanvasRenderingContext2D,
  item: RenderableVisualItem,
  source: CanvasAssetSource,
  shotFrameResolver?: ShotFrameResolver
): void {
  const { element, localTimeUs } = item

  if (element.type === 'shot') {
    renderShotElement(ctx, element, localTimeUs, shotFrameResolver)
    return
  }

  if (element.type === 'text') {
    // 口播字幕双写到文字轨的片段仅作时间线编辑；烧录走 CaptionCue，避免叠字
    if (isCaptionTrackMarker(element)) return
    renderTextElement(ctx, element, localTimeUs)
    return
  }

  if (!source || !('transform' in element)) return

  const transform = evaluateElementTransform(element.transform, element.animations, localTimeUs)
  const dynamicOpacity = transform.opacity

  if (dynamicOpacity <= 0.001 || transform.width <= 0 || transform.height <= 0) return

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, dynamicOpacity))

  // 中心点变换与旋转
  const cx = transform.x + transform.width / 2
  const cy = transform.y + transform.height / 2
  ctx.translate(cx, cy)

  if (transform.rotationDeg) {
    ctx.rotate((transform.rotationDeg * Math.PI) / 180)
  }
  if (transform.flipX) {
    ctx.scale(-1, 1)
  }

  // 绘制矩形（包含圆角裁切）
  const rx = -transform.width / 2
  const ry = -transform.height / 2

  if (transform.round && transform.round > 0 && typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(rx, ry, transform.width, transform.height, transform.round)
    ctx.clip()
  }

  try {
    const cropMode = transform.cropMode || 'none'
    const srcW =
      (source as any).videoWidth ||
      (source as any).naturalWidth ||
      (source as any).width ||
      transform.width
    const srcH =
      (source as any).videoHeight ||
      (source as any).naturalHeight ||
      (source as any).height ||
      transform.height

    const focusX = clamp01(transform.contentFocusX ?? 0.5)
    const focusY = clamp01(transform.contentFocusY ?? 0.5)

    if (cropMode === 'contain' && srcW > 0 && srcH > 0) {
      // 完整自适应：保持长宽比，完整包含在目标框内，无失真且不裁切
      const scale = Math.min(transform.width / srcW, transform.height / srcH)
      const dw = srcW * scale
      const dh = srcH * scale
      const dx = -dw / 2 + (transform.width - dw) * (focusX - 0.5)
      const dy = -dh / 2 + (transform.height - dh) * (focusY - 0.5)
      ctx.drawImage(source, 0, 0, srcW, srcH, dx, dy, dw, dh)
    } else if (cropMode === 'cover' && srcW > 0 && srcH > 0) {
      // 覆盖铺满：保持长宽比，按锚点裁剪填满目标框
      const scale = Math.max(transform.width / srcW, transform.height / srcH)
      const sw = Math.min(srcW, transform.width / scale)
      const sh = Math.min(srcH, transform.height / scale)
      const sx = Math.max(0, (srcW - sw) * focusX)
      const sy = Math.max(0, (srcH - sh) * focusY)
      ctx.drawImage(source, sx, sy, sw, sh, rx, ry, transform.width, transform.height)
    } else {
      ctx.drawImage(source, rx, ry, transform.width, transform.height)
    }
  } catch {
    // 忽略特定未就绪帧的绘制错误
  }

  ctx.restore()
}

/**
 * 绘制动效镜头帧。
 * 画面由 `shotFrameResolver` 提前准备好（异步光栅化的结果），这里只做同步铺图。
 */
function renderShotElement(
  ctx: CanvasRenderingContext2D,
  element: ShotClipElement,
  localTimeUs: number,
  shotFrameResolver?: ShotFrameResolver
): void {
  if (!shotFrameResolver) return
  const frame = shotFrameResolver({
    elementId: element.id,
    shotId: element.shotId,
    localTimeUs,
    durationUs: element.durationUs,
  })
  if (!frame) return

  const transform = evaluateElementTransform(element.transform, element.animations, localTimeUs)
  const dynamicOpacity = transform.opacity
  if (dynamicOpacity <= 0.001 || transform.width <= 0 || transform.height <= 0) return

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, dynamicOpacity))

  const cx = transform.x + transform.width / 2
  const cy = transform.y + transform.height / 2
  ctx.translate(cx, cy)
  if (transform.rotationDeg) ctx.rotate((transform.rotationDeg * Math.PI) / 180)
  if (transform.flipX) ctx.scale(-1, 1)

  const rx = -transform.width / 2
  const ry = -transform.height / 2

  if (transform.round && transform.round > 0 && typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(rx, ry, transform.width, transform.height, transform.round)
    ctx.clip()
  }

  try {
    // 镜头按工程画布尺寸渲染，这里等比铺进元素框；cover 语义避免变形留黑边
    const srcW = (frame as { width?: number }).width ?? transform.width
    const srcH = (frame as { height?: number }).height ?? transform.height
    if (srcW > 0 && srcH > 0) {
      const scale = Math.max(transform.width / srcW, transform.height / srcH)
      const dw = srcW * scale
      const dh = srcH * scale
      ctx.drawImage(frame, rx + (transform.width - dw) / 2, ry + (transform.height - dh) / 2, dw, dh)
    }
  } catch {
    // 未就绪的帧直接跳过，避免中断整帧合成
  }

  ctx.restore()
}
/** 字幕轨上的 TextClip 标记（id 前缀或 component 标记）；不参与画面绘制 */
function isCaptionTrackMarker(element: TextClipElement): boolean {
  if (element.id.startsWith('caption-clip:')) return true
  if (element.component?.componentId === 'caption.sentence' && element.component.props?.burnPreview === false) {
    return true
  }
  return false
}

function renderTextElement(
  ctx: CanvasRenderingContext2D,
  element: TextClipElement,
  localTimeUs: number
): void {
  const { text, style, transform, animations } = element
  const dynamicOpacity = evaluateElementOpacity(animations, localTimeUs, transform.opacity ?? 1.0)

  if (dynamicOpacity <= 0.001 || !text) return

  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, dynamicOpacity))

  const cx = transform.x + transform.width / 2
  const cy = transform.y + transform.height / 2
  ctx.translate(cx, cy)

  if (transform.rotationDeg) {
    ctx.rotate((transform.rotationDeg * Math.PI) / 180)
  }
  if (transform.flipX) {
    ctx.scale(-1, 1)
  }

  const rx = -transform.width / 2
  const ry = -transform.height / 2

  // 绘制背景框
  if (style.backgroundColor) {
    ctx.fillStyle = style.backgroundColor
    if (transform.round && transform.round > 0 && typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(rx, ry, transform.width, transform.height, transform.round)
      ctx.fill()
    } else {
      ctx.fillRect(rx, ry, transform.width, transform.height)
    }
  }

  // 文字排版与居中对齐
  ctx.font = `${style.weight || 700} ${style.size || 58}px ${style.font || 'sans-serif'}`
  ctx.textAlign = style.align || 'center'
  ctx.textBaseline = 'middle'

  const textX = style.align === 'left' ? rx + 20 : style.align === 'right' ? rx + transform.width - 20 : 0
  const textY = 0

  if (style.outlineWidth && style.outlineWidth > 0) {
    ctx.strokeStyle = style.outlineColor || '#000000'
    ctx.lineWidth = style.outlineWidth
    ctx.strokeText(text, textX, textY)
  }

  ctx.fillStyle = style.color || '#ffffff'
  ctx.fillText(text, textX, textY)

  ctx.restore()
}

function renderCaptionOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SceneSnapshot['captionStyle'],
  canvasWidth: number,
  canvasHeight: number
): void {
  ctx.save()

  const fontSize = style.size || 58
  ctx.font = `700 ${fontSize}px ${style.font || 'sans-serif'}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const centerY = Math.max(fontSize, Math.min(canvasHeight - fontSize, canvasHeight * (style.yRatio || 0.72)))
  const centerX = canvasWidth / 2

  // 绘制背景胶囊框（如果开启）
  if (style.backgroundColor) {
    const textMetrics = ctx.measureText(text)
    const paddingX = fontSize * 0.6
    const paddingY = fontSize * 0.3
    const boxW = textMetrics.width + paddingX * 2
    const boxH = fontSize * 1.3 + paddingY * 2

    ctx.fillStyle = style.backgroundColor
    if (typeof ctx.roundRect === 'function') {
      ctx.beginPath()
      ctx.roundRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH, fontSize * 0.25)
      ctx.fill()
    } else {
      ctx.fillRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH)
    }
  }

  // 描边
  if (style.outlineWidth && style.outlineWidth > 0) {
    ctx.strokeStyle = style.outlineColor || '#000000'
    ctx.lineWidth = style.outlineWidth
    ctx.strokeText(text, centerX, centerY)
  }

  // 正文字
  ctx.fillStyle = style.color || '#FFD60A'
  ctx.fillText(text, centerX, centerY)

  ctx.restore()
}
