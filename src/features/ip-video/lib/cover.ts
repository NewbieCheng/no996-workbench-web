import { IP_VIDEO_TEMPLATES, type CoverStyle, type IPVideoTemplate } from '../templates.ts'
import { createTemplateProject, OUTPUT_HEIGHT, OUTPUT_WIDTH, templateDesign, templatePalette, type TemplateProject } from './template-project.ts'
import { TemplatePainter, loadTemplateFonts, loadTemplateImage } from './template-renderer.ts'
import { coverOutputSize } from './cover-size.ts'
export { coverOutputSize } from './cover-size.ts'

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('封面导出失败')), 'image/png'))
}

async function paintCover(project: TemplateProject, photo: Blob | undefined, width: number, height: number, cropMode: 'cover' | 'contain' = 'cover'): Promise<Blob> {
  const size = coverOutputSize(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvasFailed')
  await loadTemplateFonts(project)
  const image = photo ? await loadTemplateImage(photo) : undefined
  const design = templateDesign(project)
  try {
    context.save()
    context.scale(size.width / design.width, size.height / design.height)
    new TemplatePainter(project, image, cropMode).draw(context, 0)
    context.restore()
    return await canvasBlob(canvas)
  } finally { image?.close() }
}

export async function createProjectCover(project: TemplateProject, photo?: Blob, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT): Promise<Blob> {
  return paintCover(project, photo, width, height)
}
export async function createTemplateBackground(template: IPVideoTemplate, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT): Promise<Blob> {
  const size = coverOutputSize(width, height)
  const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height
  const context = canvas.getContext('2d'); if (!context) throw new Error('canvasFailed')
  context.fillStyle = templatePalette(template.id).background; context.fillRect(0, 0, size.width, size.height)
  return canvasBlob(canvas)
}
export async function createTemplateCover(template: IPVideoTemplate, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT): Promise<Blob> {
  const project = createTemplateProject({ templateId: template.id, script: '', duration: 1, title: template.heading })
  return paintCover(project, undefined, width, height)
}
export function photoCoverProject(style: CoverStyle | string, text: string) {
  const templateId = style === 'pink' ? 'poster' : style
  const project = createTemplateProject({ templateId, script: '', duration: 1, title: text })
  project.subtitle.enabled = false
  return project
}
export async function composePhotoCover(photo: Blob, style: CoverStyle, text: string, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT): Promise<Blob> {
  return paintCover(photoCoverProject(style, text), photo, width, height)
}
export const TALK_COVER_SIZE = 1080
export type TalkCoverRatio = '1:1' | '3:4' | '9:16'

export const TALK_COVER_RATIO_SIZE: Record<TalkCoverRatio, { width: number; height: number; aiSize: string }> = {
  '1:1': { width: 1080, height: 1080, aiSize: '1024x1024' },
  '3:4': { width: 1080, height: 1440, aiSize: '1024x1365' },
  '9:16': { width: 1080, height: 1920, aiSize: '1024x1792' },
}

/** Cover design at the chosen ratio. Never squash a mismatched canvas. */
export function createTalkCoverProject(input: { lookId: string; title: string; ratio?: TalkCoverRatio }): TemplateProject {
  const ratio = input.ratio ?? '3:4'
  const { width, height } = TALK_COVER_RATIO_SIZE[ratio]
  const project = photoCoverProject(input.lookId, input.title)
  const design = { width, height }
  const palette = templatePalette(project.templateId)
  const hasPanel = ['life', 'poster', 'career'].includes(project.templateId)
  const titleTop = Math.round(height * 0.3)
  const titleHeight = Math.round(height * 0.42)
  return {
    ...project,
    design,
    script: '',
    captions: [],
    title: {
      ...project.title,
      x: Math.round(width * 0.083),
      y: titleTop,
      width: Math.round(width * 0.833),
      height: titleHeight,
      size: ratio === '1:1' ? 96 : ratio === '3:4' ? 88 : 80,
      align: 'center',
      background: hasPanel ? palette.panel : '',
      enabled: Boolean(input.title.trim()),
    },
    subtitle: { ...project.subtitle, x: Math.round(width * 0.083), y: Math.round(height * 0.77), width: Math.round(width * 0.833), height: Math.round(height * 0.12), enabled: false },
    photo: { x: 0, y: 0, width, height, focalX: .5, focalY: .5 },
  }
}

export async function composeTalkCover(input: {
  lookId: string
  title: string
  photo?: Blob
  width: number
  height: number
  cropMode?: 'cover' | 'contain'
}): Promise<Blob> {
  return paintCover(photoCoverProject(input.lookId, input.title), input.photo, input.width, input.height, input.cropMode ?? 'cover')
}

export async function composeTalkCoverSquare(input: {
  lookId: string
  title: string
  photo?: Blob
  cropMode?: 'cover' | 'contain'
  ratio?: TalkCoverRatio
}): Promise<Blob> {
  const ratio = input.ratio ?? '3:4'
  const { width, height } = TALK_COVER_RATIO_SIZE[ratio]
  return paintCover(createTalkCoverProject({ ...input, ratio }), input.photo, width, height, input.cropMode ?? 'cover')
}
export function coverTemplateFor(style: CoverStyle): IPVideoTemplate {
  const template = IP_VIDEO_TEMPLATES.find(item => item.id === (style === 'pink' ? 'poster' : style)) ?? IP_VIDEO_TEMPLATES[0]
  return style === 'pink' ? { ...template, color: '#54233B', background: '#F4C4D8', heading: '把生活\n过成喜欢的样子' } : template
}
export async function validateImage(file: File, maxBytes: number): Promise<void> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片。')
  if (file.size > maxBytes) throw new Error('图片不能超过 10 MB。')
  const image = await loadTemplateImage(file)
  try { if (image.width * image.height > 40_000_000) throw new Error('图片像素过大，请压缩至 4000 万像素以内。') } finally { image.close() }
}
