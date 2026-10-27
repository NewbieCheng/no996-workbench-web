import { clampBox, createTemplateProject, OUTPUT_HEIGHT, OUTPUT_WIDTH, type EditableLayerId, type LayerBox, type PhotoLayer, type TemplateProject, type TextLayer } from '../lib/template-project.ts'
import { validateCaptions, type SubtitleSegment } from '../lib/subtitles.ts'

export const HISTORY_LIMIT = 50
export const SAFE_INSET = 72
export type ProjectHistory = { past: TemplateProject[]; present: TemplateProject; future: TemplateProject[] }
export const sameProject = (a: TemplateProject, b: TemplateProject) => a === b || JSON.stringify(a) === JSON.stringify(b)
export function createHistory(project: TemplateProject): ProjectHistory { return { past: [], present: project, future: [] } }
export function commitHistory(history: ProjectHistory, next: TemplateProject): ProjectHistory {
  return sameProject(history.present, next) ? history : { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] }
}
export function undoHistory(history: ProjectHistory): ProjectHistory {
  const previous = history.past.at(-1)
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future].slice(0, HISTORY_LIMIT) } : history
}
export function redoHistory(history: ProjectHistory): ProjectHistory {
  const next = history.future[0]
  return next ? { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: history.future.slice(1) } : history
}

/** Persist only explicitly enumerated layout/style fields, never text, audio or captions. */
export type TextLayout = Omit<TextLayer, 'text'>
export type TemplateLayout = { title: TextLayout; subtitle: TextLayout; photo: PhotoLayer }
function textLayout(layer: TextLayout): TextLayout {
  return { x: layer.x, y: layer.y, width: layer.width, height: layer.height, size: layer.size, color: layer.color, font: layer.font, weight: layer.weight, lineHeight: layer.lineHeight, letterSpacing: layer.letterSpacing, align: layer.align, outline: layer.outline, background: layer.background, enabled: layer.enabled }
}
export function extractLayout(project: TemplateProject): TemplateLayout {
  const { x, y, width, height, focalX, focalY } = project.photo
  return { title: textLayout(project.title), subtitle: textLayout(project.subtitle), photo: { x, y, width, height, focalX, focalY } }
}
export function applyLayout(project: TemplateProject, layout: TemplateLayout): TemplateProject {
  const { x, y, width, height, focalX, focalY } = layout.photo
  return { ...project, title: { ...textLayout(layout.title), text: project.title.text }, subtitle: { ...textLayout(layout.subtitle), text: project.subtitle.text }, photo: { x, y, width, height, focalX, focalY } }
}
export function resetLayout(project: TemplateProject): TemplateProject {
  const defaults = createTemplateProject({ templateId: project.templateId, script: project.script, duration: project.duration, title: project.title.text, demo: project.demo })
  return applyLayout(project, extractLayout(defaults))
}
export function nudgeLayer(project: TemplateProject, layer: EditableLayerId, dx: number, dy: number): TemplateProject {
  return { ...project, [layer]: { ...project[layer], ...clampBox({ ...project[layer], x: project[layer].x + dx, y: project[layer].y + dy }) } }
}
export function snapBox(box: LayerBox, threshold = 12): LayerBox {
  const snapAxis = (position: number, size: number, extent: number) => {
    let distance = threshold + 1; let delta = 0
    for (const target of [SAFE_INSET, extent / 2, extent - SAFE_INSET]) {
      for (const anchor of [position, position + size / 2, position + size]) {
        if (Math.abs(target - anchor) < distance) { distance = Math.abs(target - anchor); delta = target - anchor }
      }
    }
    return position + (distance <= threshold ? delta : 0)
  }
  return clampBox({ ...box, x: snapAxis(box.x, box.width, OUTPUT_WIDTH), y: snapAxis(box.y, box.height, OUTPUT_HEIGHT) })
}

export type CaptionDraft = { start: string; end: string; text: string }
export const captionDrafts = (captions: SubtitleSegment[]): CaptionDraft[] => captions.map(line => ({ start: String(line.start), end: String(line.end), text: line.text }))
export function captionsFromDrafts(drafts: CaptionDraft[], duration: number): SubtitleSegment[] {
  const captions = drafts.map(line => {
    if (!line.start.trim() || !line.end.trim()) throw new Error('invalidSubtitle')
    return { start: Number(line.start), end: Number(line.end), text: line.text }
  })
  validateCaptions(captions, duration)
  return captions
}

/** Validate IndexedDB contents before allowing a saved layout to affect a project. */
export function validLayout(value: unknown): value is TemplateLayout {
  if (!value || typeof value !== 'object') return false
  const layout = value as TemplateLayout
  for (const id of ['title', 'subtitle', 'photo'] as const) {
    const box = layout[id]
    if (!box || ![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.x < 0 || box.y < 0 || box.width < 80 || box.height < 60 || box.x + box.width > OUTPUT_WIDTH + .01 || box.y + box.height > OUTPUT_HEIGHT + .01) return false
    if (id !== 'photo') {
      const layer = layout[id]
      if (!Number.isFinite(layer.size) || layer.size < 16 || layer.size > 180 || !Number.isFinite(layer.weight) || layer.weight < 100 || layer.weight > 900 || !Number.isFinite(layer.lineHeight) || layer.lineHeight < 1 || layer.lineHeight > 2.5 || !Number.isFinite(layer.letterSpacing) || Math.abs(layer.letterSpacing) > 20 || !Number.isFinite(layer.outline) || layer.outline < 0 || layer.outline > 16) return false
      if (!['left', 'center', 'right'].includes(layer.align) || typeof layer.enabled !== 'boolean' || typeof layer.font !== 'string' || layer.font.length > 200 || !/^#[0-9a-f]{6}$/i.test(layer.color) || (layer.background !== '' && !/^#[0-9a-f]{6}$/i.test(layer.background))) return false
    }
  }
  return [layout.photo.focalX, layout.photo.focalY].every(value => Number.isFinite(value) && value >= 0 && value <= 1)
}
