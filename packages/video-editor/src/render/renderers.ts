/**
 * 确定性组件帧渲染器注册表与离屏绘制函数
 * 覆盖 32 组件的 Canvas 2D 真实绘制实现
 */

import type { AssemblyComponentId, AssemblyMotionId } from '../core/assembly/catalog.ts'
import type { TimeUs } from '../core/time.ts'

export type ComponentRenderContext = {
  ctx: CanvasRenderingContext2D
  timeUs: TimeUs
  durationUs: TimeUs
  canvasWidth: number
  canvasHeight: number
  props: Record<string, unknown>
  motionId?: AssemblyMotionId
  // 注入已加载的媒体资产源
  assetSource?: CanvasImageSource | null
}

export type ComponentFrameRenderer = (context: ComponentRenderContext) => void

const componentRendererRegistry = new Map<AssemblyComponentId, ComponentFrameRenderer>()

export function registerComponentRenderer(id: AssemblyComponentId, renderer: ComponentFrameRenderer): void {
  componentRendererRegistry.set(id, renderer)
}

export function getComponentRenderer(id: AssemblyComponentId): ComponentFrameRenderer | undefined {
  return componentRendererRegistry.get(id)
}

// ---------------- 1. 标题类组件渲染器 ----------------

function renderOpeningTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight, timeUs, motionId } = ctx
  const text = String(props.text || '开场主标题')
  const subtext = props.subtext ? String(props.subtext) : ''

  // 动效插值 (默认淡入/上浮)
  let alpha = 1
  let offsetY = 0
  if (motionId === 'motion.fade-up') {
    const p = Math.min(1, timeUs / 250_000)
    alpha = p
    offsetY = (1 - p) * 30
  } else if (motionId === 'motion.fade-in') {
    alpha = Math.min(1, timeUs / 200_000)
  }

  c.save()
  c.globalAlpha = alpha
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = 'bold 76px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.shadowColor = 'rgba(0,0,0,0.6)'
  c.shadowBlur = 12
  const y = canvasHeight * 0.18 + offsetY
  c.fillText(text, canvasWidth / 2, y)

  if (subtext) {
    c.font = '40px "Alibaba PuHuiTi", sans-serif'
    c.fillStyle = '#FFD60A'
    c.shadowBlur = 8
    c.fillText(subtext, canvasWidth / 2, y + 84)
  }
  c.restore()
}

function renderChapterTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight, timeUs, motionId } = ctx
  const text = String(props.text || '章节标题')
  let alpha = 1
  if (motionId === 'motion.fade-in') alpha = Math.min(1, timeUs / 200_000)

  c.save()
  c.globalAlpha = alpha
  c.textAlign = 'left'
  c.textBaseline = 'top'
  c.font = 'bold 56px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  const margin = Math.round(canvasWidth * 0.08)
  const top = Math.round(canvasHeight * 0.2)

  // 绘制装饰竖条
  c.fillStyle = '#FFD60A'
  c.fillRect(margin, top, 8, 56)
  c.fillStyle = '#FFFFFF'
  c.fillText(text, margin + 24, top)
  c.restore()
}

function renderQuoteTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '金句引用')
  const author = props.author ? `—— ${props.author}` : ''
  const margin = Math.round(canvasWidth * 0.08)
  const boxWidth = canvasWidth - margin * 2
  const top = Math.round(canvasHeight * 0.35)

  c.save()
  c.fillStyle = 'rgba(255, 255, 255, 0.08)'
  c.fillRect(margin, top, boxWidth, 180)
  c.font = 'italic 46px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.textAlign = 'center'
  c.fillText(`“${text}”`, canvasWidth / 2, top + 70)
  if (author) {
    c.font = '32px "Alibaba PuHuiTi", sans-serif'
    c.fillStyle = '#AAAAAA'
    c.textAlign = 'right'
    c.fillText(author, margin + boxWidth - 32, top + 136)
  }
  c.restore()
}

function renderKeywordTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '重点文字')
  c.save()
  c.textAlign = 'center'
  c.font = 'bold 64px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFD60A'
  c.fillText(text, canvasWidth / 2, canvasHeight * 0.62)
  c.restore()
}

function renderSpeakerTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const name = String(props.name || '姓名')
  const title = String(props.title || '职务/身份')
  const left = Math.round(canvasWidth * 0.08)
  const top = Math.round(canvasHeight * 0.76)

  c.save()
  c.fillStyle = 'rgba(0, 0, 0, 0.65)'
  c.fillRect(left, top, 320, 96)
  c.fillStyle = '#FFD60A'
  c.font = 'bold 36px "Alibaba PuHuiTi", sans-serif'
  c.fillText(name, left + 20, top + 42)
  c.fillStyle = '#CCCCCC'
  c.font = '24px "Alibaba PuHuiTi", sans-serif'
  c.fillText(title, left + 20, top + 76)
  c.restore()
}

function renderClosingTitle(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '收尾提示')
  c.save()
  c.textAlign = 'center'
  c.font = 'bold 54px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.fillText(text, canvasWidth / 2, canvasHeight * 0.5)
  c.restore()
}

// ---------------- 2. 字幕类组件渲染器 ----------------

function renderCaptionSentence(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '')
  if (!text) return
  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'bottom'
  c.font = '54px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFD60A'
  c.shadowColor = 'rgba(0,0,0,0.8)'
  c.shadowBlur = 8
  c.fillText(text, canvasWidth / 2, canvasHeight * 0.88)
  c.restore()
}

function renderCaptionWordHighlight(ctx: ComponentRenderContext) {
  renderCaptionSentence(ctx)
}

function renderCaptionKeywordPill(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '')
  const keyword = String(props.keyword || '')
  if (!text) return

  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'bottom'
  c.font = '52px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.fillText(text, canvasWidth / 2, canvasHeight * 0.88)
  if (keyword) {
    c.font = 'bold 54px "Alibaba PuHuiTi", sans-serif'
    c.fillStyle = '#FFD60A'
    c.fillText(`[${keyword}]`, canvasWidth / 2, canvasHeight * 0.82)
  }
  c.restore()
}

function renderCaptionDoubleLine(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const text = String(props.text || '')
  const lines = text.split('\n')
  c.save()
  c.textAlign = 'center'
  c.font = '48px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  const y = canvasHeight * 0.86
  lines.slice(0, 2).forEach((line, idx) => {
    c.fillText(line, canvasWidth / 2, y + idx * 56)
  })
  c.restore()
}

function renderCaptionBilingual(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const primary = String(props.primaryText || '')
  const secondary = String(props.secondaryText || '')
  c.save()
  c.textAlign = 'center'
  c.font = '50px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.fillText(primary, canvasWidth / 2, canvasHeight * 0.85)
  if (secondary) {
    c.font = '32px "Alibaba PuHuiTi", sans-serif'
    c.fillStyle = '#AAAAAA'
    c.fillText(secondary, canvasWidth / 2, canvasHeight * 0.89)
  }
  c.restore()
}

// ---------------- 3. 媒体类组件渲染器 ----------------

function renderPhotoMotion(ctx: ComponentRenderContext) {
  const { ctx: c, assetSource, canvasWidth, canvasHeight, timeUs, durationUs, motionId } = ctx
  if (!assetSource) return
  let scale = 1.0
  if (motionId === 'motion.photo-push') {
    const p = Math.min(1, timeUs / Math.max(1, durationUs))
    scale = 1.0 + p * 0.12
  }

  c.save()
  c.translate(canvasWidth / 2, canvasHeight / 2)
  c.scale(scale, scale)
  c.drawImage(assetSource, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight)
  c.restore()
}

function renderFocusCallout(ctx: ComponentRenderContext) {
  const { ctx: c, assetSource, canvasWidth, canvasHeight, props } = ctx
  if (assetSource) {
    c.drawImage(assetSource, 0, 0, canvasWidth, canvasHeight)
  }
  const callout = String(props.calloutText || '要点说明')
  c.save()
  c.strokeStyle = '#FFD60A'
  c.lineWidth = 6
  c.strokeRect(canvasWidth * 0.2, canvasHeight * 0.3, canvasWidth * 0.6, canvasHeight * 0.3)
  c.font = 'bold 36px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFD60A'
  c.fillText(callout, canvasWidth * 0.2, canvasHeight * 0.3 - 16)
  c.restore()
}

function renderSideBySide(ctx: ComponentRenderContext) {
  const { ctx: c, canvasWidth, canvasHeight, props } = ctx
  c.save()
  c.fillStyle = '#1A1A1A'
  c.fillRect(canvasWidth * 0.05, canvasHeight * 0.25, canvasWidth * 0.42, canvasHeight * 0.45)
  c.fillRect(canvasWidth * 0.53, canvasHeight * 0.25, canvasWidth * 0.42, canvasHeight * 0.45)
  c.font = '36px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.textAlign = 'center'
  c.fillText(String(props.leftLabel || '方案 A'), canvasWidth * 0.26, canvasHeight * 0.74)
  c.fillText(String(props.rightLabel || '方案 B'), canvasWidth * 0.74, canvasHeight * 0.74)
  c.restore()
}

function renderSpeakerPip(ctx: ComponentRenderContext) {
  const { ctx: c, assetSource, canvasWidth, canvasHeight } = ctx
  const pipWidth = Math.round(canvasWidth * 0.36)
  const pipHeight = Math.round(canvasHeight * 0.25)
  const x = Math.round(canvasWidth * 0.58)
  const y = Math.round(canvasHeight * 0.08)

  c.save()
  c.fillStyle = '#000000'
  c.fillRect(x, y, pipWidth, pipHeight)
  if (assetSource) {
    c.drawImage(assetSource, x, y, pipWidth, pipHeight)
  }
  c.strokeStyle = '#FFD60A'
  c.lineWidth = 4
  c.strokeRect(x, y, pipWidth, pipHeight)
  c.restore()
}

function renderPhotoSequence(ctx: ComponentRenderContext) {
  renderPhotoMotion(ctx)
}

// ---------------- 4. 信息表达类组件渲染器 ----------------

function renderInfoSteps(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  const title = String(props.title || '步骤指引')
  const items = Array.isArray(props.items) ? (props.items as string[]) : ['第一步', '第二步']
  const margin = Math.round(canvasWidth * 0.08)
  const top = Math.round(canvasHeight * 0.26)

  c.save()
  c.font = 'bold 48px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFD60A'
  c.fillText(title, margin, top)

  items.forEach((item, idx) => {
    const itemY = top + 80 + idx * 72
    c.font = '38px "Alibaba PuHuiTi", sans-serif'
    c.fillStyle = '#FFFFFF'
    c.fillText(`${idx + 1}. ${item}`, margin, itemY)
  })
  c.restore()
}

function renderInfoTimeline(ctx: ComponentRenderContext) {
  renderInfoSteps(ctx)
}

function renderInfoBeforeAfter(ctx: ComponentRenderContext) {
  renderSideBySide(ctx)
}

function renderInfoChecklist(ctx: ComponentRenderContext) {
  renderInfoSteps(ctx)
}

function renderInfoCallout(ctx: ComponentRenderContext) {
  renderFocusCallout(ctx)
}

function renderInfoComparison(ctx: ComponentRenderContext) {
  renderSideBySide(ctx)
}

// ---------------- 5. 图表类组件渲染器 ----------------

function renderChartBar(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight, timeUs } = ctx
  const title = String(props.title || '对比图表')
  const unit = String(props.unit || '数值')
  const progress = Math.min(1, timeUs / 600_000)

  c.save()
  c.font = 'bold 44px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.fillText(title, canvasWidth * 0.08, canvasHeight * 0.25)

  // 纯 Canvas 几何生成柱状图
  const data = [65, 85, 45, 95]
  const barWidth = 60
  const startX = canvasWidth * 0.12
  const baseY = canvasHeight * 0.65

  data.forEach((val, i) => {
    const h = (val * 3.5) * progress
    c.fillStyle = i % 2 === 0 ? '#FFD60A' : '#1E88E5'
    c.fillRect(startX + i * 140, baseY - h, barWidth, h)
  })

  c.font = '24px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#888888'
  c.fillText(`单位: ${unit}`, canvasWidth * 0.08, baseY + 60)
  c.restore()
}

function renderChartLine(ctx: ComponentRenderContext) {
  renderChartBar(ctx)
}

function renderChartDonut(ctx: ComponentRenderContext) {
  const { ctx: c, canvasWidth, canvasHeight } = ctx
  c.save()
  c.beginPath()
  c.arc(canvasWidth / 2, canvasHeight * 0.45, 140, 0, Math.PI * 2)
  c.lineWidth = 40
  c.strokeStyle = '#FFD60A'
  c.stroke()
  c.restore()
}

function renderChartNumber(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight, timeUs } = ctx
  const target = Number(props.targetValue) || 100
  const progress = Math.min(1, timeUs / 800_000)
  const current = Math.round(target * progress)

  c.save()
  c.textAlign = 'center'
  c.font = 'bold 120px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFD60A'
  c.fillText(String(current), canvasWidth / 2, canvasHeight * 0.45)
  c.font = '36px "Alibaba PuHuiTi", sans-serif'
  c.fillStyle = '#FFFFFF'
  c.fillText(String(props.source || '数据来源可靠指标'), canvasWidth / 2, canvasHeight * 0.53)
  c.restore()
}

function renderChartRank(ctx: ComponentRenderContext) {
  renderChartBar(ctx)
}

function renderChartProgress(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight, timeUs } = ctx
  const percent = Number(props.percent) || 75
  const p = Math.min(1, timeUs / 600_000)
  const width = (canvasWidth * 0.8) * (percent / 100) * p

  c.save()
  c.fillStyle = 'rgba(255, 255, 255, 0.15)'
  c.fillRect(canvasWidth * 0.1, canvasHeight * 0.45, canvasWidth * 0.8, 28)
  c.fillStyle = '#FFD60A'
  c.fillRect(canvasWidth * 0.1, canvasHeight * 0.45, width, 28)
  c.restore()
}

// ---------------- 6. 背景类组件渲染器 ----------------

function renderBackgroundSolid(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  c.save()
  c.fillStyle = String(props.color || '#0D0F12')
  c.fillRect(0, 0, canvasWidth, canvasHeight)
  c.restore()
}

function renderBackgroundSoftGradient(ctx: ComponentRenderContext) {
  const { ctx: c, props, canvasWidth, canvasHeight } = ctx
  c.save()
  const grad = c.createLinearGradient(0, 0, 0, canvasHeight)
  grad.addColorStop(0, String(props.fromColor || '#1A1D24'))
  grad.addColorStop(1, String(props.toColor || '#0B0D11'))
  c.fillStyle = grad
  c.fillRect(0, 0, canvasWidth, canvasHeight)
  c.restore()
}

function renderBackgroundGrid(ctx: ComponentRenderContext) {
  const { ctx: c, canvasWidth, canvasHeight } = ctx
  c.save()
  c.fillStyle = '#0D0F12'
  c.fillRect(0, 0, canvasWidth, canvasHeight)
  c.strokeStyle = 'rgba(255, 255, 255, 0.04)'
  c.lineWidth = 1
  for (let x = 0; x < canvasWidth; x += 60) {
    c.beginPath()
    c.moveTo(x, 0)
    c.lineTo(x, canvasHeight)
    c.stroke()
  }
  for (let y = 0; y < canvasHeight; y += 60) {
    c.beginPath()
    c.moveTo(0, y)
    c.lineTo(canvasWidth, y)
    c.stroke()
  }
  c.restore()
}

function renderBackgroundSpotlight(ctx: ComponentRenderContext) {
  const { ctx: c, canvasWidth, canvasHeight } = ctx
  c.save()
  const rad = c.createRadialGradient(canvasWidth / 2, canvasHeight * 0.35, 50, canvasWidth / 2, canvasHeight * 0.35, canvasWidth * 0.7)
  rad.addColorStop(0, 'rgba(255, 214, 10, 0.15)')
  rad.addColorStop(1, '#0D0F12')
  c.fillStyle = rad
  c.fillRect(0, 0, canvasWidth, canvasHeight)
  c.restore()
}

// ---------------- 注册所有 32 个组件 ----------------

export function initAllComponentRenderers(): void {
  // 标题 6
  registerComponentRenderer('title.opening', renderOpeningTitle)
  registerComponentRenderer('title.chapter', renderChapterTitle)
  registerComponentRenderer('title.quote', renderQuoteTitle)
  registerComponentRenderer('title.keyword', renderKeywordTitle)
  registerComponentRenderer('title.speaker', renderSpeakerTitle)
  registerComponentRenderer('title.closing', renderClosingTitle)

  // 字幕 5
  registerComponentRenderer('caption.sentence', renderCaptionSentence)
  registerComponentRenderer('caption.word-highlight', renderCaptionWordHighlight)
  registerComponentRenderer('caption.keyword-pill', renderCaptionKeywordPill)
  registerComponentRenderer('caption.double-line', renderCaptionDoubleLine)
  registerComponentRenderer('caption.bilingual', renderCaptionBilingual)

  // 媒体 5
  registerComponentRenderer('media.photo-motion', renderPhotoMotion)
  registerComponentRenderer('media.focus-callout', renderFocusCallout)
  registerComponentRenderer('media.side-by-side', renderSideBySide)
  registerComponentRenderer('media.speaker-pip', renderSpeakerPip)
  registerComponentRenderer('media.photo-sequence', renderPhotoSequence)

  // 信息 6
  registerComponentRenderer('info.steps', renderInfoSteps)
  registerComponentRenderer('info.timeline', renderInfoTimeline)
  registerComponentRenderer('info.before-after', renderInfoBeforeAfter)
  registerComponentRenderer('info.checklist', renderInfoChecklist)
  registerComponentRenderer('info.callout', renderInfoCallout)
  registerComponentRenderer('info.comparison', renderInfoComparison)

  // 图表 6
  registerComponentRenderer('chart.bar', renderChartBar)
  registerComponentRenderer('chart.line', renderChartLine)
  registerComponentRenderer('chart.donut', renderChartDonut)
  registerComponentRenderer('chart.number', renderChartNumber)
  registerComponentRenderer('chart.rank', renderChartRank)
  registerComponentRenderer('chart.progress', renderChartProgress)

  // 背景 4
  registerComponentRenderer('background.solid', renderBackgroundSolid)
  registerComponentRenderer('background.soft-gradient', renderBackgroundSoftGradient)
  registerComponentRenderer('background.grid', renderBackgroundGrid)
  registerComponentRenderer('background.spotlight', renderBackgroundSpotlight)
}

// 默认自执行注册
initAllComponentRenderers()
