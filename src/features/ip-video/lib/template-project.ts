import { buildAlignedTimeline, type AlignedTimeline } from './timeline-engine.ts'
import { validateCaptions, type SubtitleSegment } from './subtitles.ts'

export const OUTPUT_WIDTH = 1080
export const OUTPUT_HEIGHT = 1920
export const TEMPLATE_FONT = '"Alibaba PuHuiTi", sans-serif'
export type SubtitleStyle = { size: number; color: string; font: string; y: number }
export type LayerBox = { x: number; y: number; width: number; height: number }
export type TextLayer = LayerBox & {
  text: string; size: number; color: string; font: string; weight: number
  lineHeight: number; letterSpacing: number; align: 'left' | 'center' | 'right'
  outline: number; background: string; enabled: boolean
}
export type PhotoLayer = LayerBox & { focalX: number; focalY: number }
/**
 * 动效背景镜头：把视频工厂的镜头挂到 IP 口播模板的背景层。
 * 缺省不存在（旧工程完全不受影响），有值时背景先画镜头再叠标题与字幕。
 */
export type TemplateShot = {
  /** 视频工厂注册表里的 shotId，如 'opening/spotlight-hero-card' */
  shotId: string
  /** 在成片时间轴上的起止秒 */
  start: number
  end: number
  /** 播放速率，1 = 原速 */
  rate?: number
  /** 不透明度，0–1；默认 1 */
  opacity?: number
}
export type TemplateDesign = { width: number; height: number }
export type TemplateProject = {
  version: 1; templateId: string; script: string; duration: number; demo: boolean
  /** Legacy projects use 1080×1920 design coordinates. Square covers declare 1080×1080. */
  design?: TemplateDesign
  title: TextLayer; subtitle: TextLayer; photo: PhotoLayer
  captions: SubtitleSegment[]; timingSource: 'estimated' | 'srt' | 'manual'
  audioEnvelope?: number[]
  /** 动效背景层；可选，缺省即老行为 */
  shots?: TemplateShot[]
}
export type EditableLayerId = 'title' | 'subtitle' | 'photo'
export type TemplatePalette = { background: string; foreground: string; accent: string; panel: string }
const PALETTES: Record<string, TemplatePalette> = {
  scroll: { background: '#172128', foreground: '#FFFFFF', accent: '#FFD60A', panel: '#172128' },
  poster: { background: '#D9EDAD', foreground: '#18291F', accent: '#18291F', panel: '#D9EDAD' },
  call: { background: '#253B58', foreground: '#FFFFFF', accent: '#90DDB0', panel: '#15283F' },
  career: { background: '#30313A', foreground: '#FFFFFF', accent: '#FFD60A', panel: '#202128' },
  life: { background: '#EFE4D2', foreground: '#4D3426', accent: '#8C694A', panel: '#F7EFE2' },
  lesson: { background: '#173D31', foreground: '#F1F8EE', accent: '#CBE7D5', panel: '#102E25' },
  audiogram: { background: '#0D1322', foreground: '#FFFFFF', accent: '#00D9EB', panel: '#101D2D' },
  tiktok: { background: '#111216', foreground: '#FFFFFF', accent: '#B5F267', panel: '#1E2226' }
}
export function templatePalette(id: string): TemplatePalette { return PALETTES[id] ?? PALETTES.scroll }
export function createTemplateProject(input: { templateId: string; script: string; duration: number; style?: SubtitleStyle; title?: string; demo?: boolean }): TemplateProject {
  const palette = templatePalette(input.templateId)
  const size = input.style?.size ?? (input.templateId === 'poster' ? 82 : 58)
  const base: TextLayer = { x: 76, y: 1280, width: 928, height: 540, text: '', size, color: input.style?.color ?? palette.accent, font: input.style?.font ?? TEMPLATE_FONT, weight: 700, lineHeight: 1.35, letterSpacing: 0, align: 'center', outline: ['life', 'poster'].includes(input.templateId) ? 0 : 4, background: '', enabled: true }
  const aligned = buildAlignedTimeline(input.script, input.duration)
  return {
    version: 1, templateId: input.templateId, script: input.script, duration: input.duration, demo: Boolean(input.demo),
    design: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT },
    title: { ...base, x: 76, y: 230, height: 420, text: input.title ?? '', size: 100, color: palette.foreground, align: ['call', 'audiogram'].includes(input.templateId) ? 'center' : 'left', outline: 0, background: ['life', 'poster', 'career'].includes(input.templateId) ? palette.panel : '', enabled: Boolean(input.title) },
    subtitle: { ...base, y: (input.style?.y ?? 72) / 100 * OUTPUT_HEIGHT - base.height / 2 },
    photo: { x: 0, y: 0, width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, focalX: 0.5, focalY: 0.5 },
    captions: aligned.sentences.map(({ text, start, end }) => ({ text, start, end })), timingSource: 'estimated'
  }
}
export function templateDesign(project: TemplateProject): TemplateDesign {
  return project.design ?? { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }
}
export function clampBox(box: LayerBox, design: TemplateDesign = { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }): LayerBox {
  const width = Math.max(80, Math.min(design.width, Number.isFinite(box.width) ? box.width : Math.min(928, design.width)))
  const height = Math.max(60, Math.min(design.height, Number.isFinite(box.height) ? box.height : Math.min(460, design.height)))
  return { x: Math.max(0, Math.min(design.width - width, Number.isFinite(box.x) ? box.x : 0)), y: Math.max(0, Math.min(design.height - height, Number.isFinite(box.y) ? box.y : 0)), width, height }
}
export function updateLayerBox(project: TemplateProject, id: EditableLayerId, box: LayerBox): TemplateProject {
  return { ...project, [id]: { ...project[id], ...clampBox(box, templateDesign(project)) } }
}
export function projectSubtitleStyle(project: TemplateProject): SubtitleStyle {
  const style = project.subtitle
  return { size: style.size, color: style.color, font: style.font, y: (style.y + style.height / 2) / templateDesign(project).height * 100 }
}
export function projectTimeline(project: TemplateProject): AlignedTimeline {
  let index = 0
  const sentences = project.captions.map(caption => {
    const tokens = buildAlignedTimeline(caption.text, caption.end - caption.start).allWords
    return { ...caption, words: tokens.map(token => ({ ...token, start: caption.start + token.start, end: caption.start + token.end, index: index++ })) }
  })
  return { duration: project.duration, sentences, allWords: sentences.flatMap(sentence => sentence.words) }
}
export function validateTemplateProject(project: TemplateProject): void {
  if (project.version !== 1 || !Number.isFinite(project.duration) || project.duration <= 0 || project.duration > 300) throw new Error('invalidDuration')
  const design = templateDesign(project)
  if (![design.width, design.height].every(value => Number.isFinite(value) && value >= 320 && value <= 3840)) throw new Error('invalidLayout')
  validateCaptions(project.captions, project.duration)
  for (const id of ['title', 'subtitle', 'photo'] as const) {
    const layer = project[id]
    if (![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) || layer.width < 80 || layer.height < 60 || layer.x < 0 || layer.y < 0 || layer.x + layer.width > design.width + .01 || layer.y + layer.height > design.height + .01) throw new Error('invalidLayout')
    if (id !== 'photo') {
      const text = project[id]
      if (!Number.isFinite(text.size) || text.size < 16 || text.size > 180 || !Number.isFinite(text.lineHeight) || text.lineHeight < 1 || text.lineHeight > 2.5 || !Number.isFinite(text.letterSpacing) || Math.abs(text.letterSpacing) > 20 || !Number.isFinite(text.outline) || text.outline < 0 || text.outline > 16) throw new Error('invalidLayout')
    }
  }
  if (![project.photo.focalX, project.photo.focalY].every(value => Number.isFinite(value) && value >= 0 && value <= 1)) throw new Error('invalidLayout')
  // 动效背景层可选；有值时逐条校验，旧工程（无 shots）完全不受影响
  if (project.shots) {
    for (const shot of project.shots) {
      if (typeof shot.shotId !== 'string' || !shot.shotId.trim()) throw new Error('invalidShot')
      if (![shot.start, shot.end].every(Number.isFinite) || shot.start < 0 || shot.end <= shot.start || shot.end > project.duration + .01) throw new Error('invalidShot')
      if (shot.rate !== undefined && (!Number.isFinite(shot.rate) || shot.rate < .25 || shot.rate > 4)) throw new Error('invalidShot')
      if (shot.opacity !== undefined && (!Number.isFinite(shot.opacity) || shot.opacity < 0 || shot.opacity > 1)) throw new Error('invalidShot')
    }
  }
}
export function restoreTemplateProject(record: { templateProject?: TemplateProject; templateId: string; script: string; duration: number; subtitleStyle: SubtitleStyle; demo?: boolean }): TemplateProject {
  return record.templateProject ?? createTemplateProject({ templateId: record.templateId, script: record.script, duration: record.duration, style: record.subtitleStyle, demo: record.demo })
}
