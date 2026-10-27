import type { CaptionStyle, CanvasRatio, EditorDocument, TransformBox } from '@no996/video-editor'
import type { TalkDocument, TalkSettings } from '../talk-model'
import { TALK_CAPTION_PRESETS } from '../talk-caption-presets.ts'
import { captionFontByFamily } from '../../editor/caption-fonts.ts'

export const TALK_TEMPLATE_SCHEMA_VERSION = 1 as const
export type TemplateFrame = { ratio: CanvasRatio; width: number; height: number }
/** Ratios, never source pixels or asset/element identifiers. Animation is deliberately not a template field. */
export type TemplateComposition = Omit<TransformBox, 'x' | 'y' | 'width' | 'height' | 'round'> & { x: number; y: number; width: number; height: number; round: number }
export type TalkStyleTemplate = {
  schemaVersion: 1; revision: number; id: string; scope: string; owner: number
  name: string; nameKey: string; createdAt: number; updatedAt: number
  captionStyle: CaptionStyle; backgroundColor: string
  frame?: TemplateFrame; composition?: TemplateComposition
}
export type BuiltinTalkTemplate = { id: string; name: string; captionStyle: CaptionStyle; backgroundColor: string }
export type ApplicableTalkTemplate = BuiltinTalkTemplate | TalkStyleTemplate
export type TemplateApplyOptions = { frame: boolean; composition: boolean; confirmProtected: boolean }
export class TalkTemplateError extends Error {
  readonly code: string
  constructor(code: string) { super(code); this.name = 'TalkTemplateError'; this.code = code }
}
const fail = (code = 'invalidData'): never => { throw new TalkTemplateError(code) }
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail()
const exact = (value: Record<string, unknown>, keys: readonly string[]) => { if (Object.keys(value).some(key => !keys.includes(key))) fail() }
const finite = (value: unknown, low: number, high: number): number => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high ? value : fail()
const text = (value: unknown, max: number): string => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value) ? value : fail()
const color = (value: unknown, empty = false): string => (empty && value === '') || (typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/iu.test(value)) ? value as string : fail()
const choice = <T extends string | number>(value: unknown, options: readonly T[]): T => options.includes(value as T) ? value as T : fail()
export function templateScope(owner: number): string {
  if (!Number.isSafeInteger(owner) || owner <= 0) fail('invalidOwner')
  return String(owner)
}
export function templateName(value: string): { name: string; nameKey: string } {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/u.test(value)) fail('invalidName')
  const name = value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/u.test(name)) fail('invalidName')
  return { name, nameKey: name.toLocaleLowerCase('en-US') }
}

/** Whitelist the entire current CaptionStyle, rejecting future/unknown fields instead of silently dropping them. */
export function validateTemplateCaption(value: unknown): CaptionStyle {
  const input = object(value)
  exact(input, ['mode', 'pageLines', 'entrance', 'exit', 'weight', 'lineHeight', 'letterSpacing', 'widthRatio', 'xRatio', 'motion', 'emphasisColor', 'font', 'size', 'color', 'outlineColor', 'outlineWidth', 'backgroundColor', 'yRatio', 'burn', 'align'])
  const font = text(input.font, 100)
  if (!captionFontByFamily(font)) fail('unsupportedFont')
  if (typeof input.burn !== 'boolean') fail()
  const result: CaptionStyle = { font, size: finite(input.size, 1, 1000), color: color(input.color), outlineColor: color(input.outlineColor), outlineWidth: finite(input.outlineWidth, 0, 100), backgroundColor: color(input.backgroundColor, true), yRatio: finite(input.yRatio, 0, 1), burn: input.burn as boolean }
  if (input.mode !== undefined) result.mode = choice(input.mode, ['rolling', 'clean', 'kinetic', 'editorial'])
  if (input.pageLines !== undefined) result.pageLines = choice(input.pageLines, [1, 2])
  if (input.align !== undefined) result.align = choice(input.align, ['left', 'center', 'right'])
  for (const key of ['entrance', 'exit'] as const) if (input[key] !== undefined) result[key] = choice(input[key], ['fade-up', 'pop', 'slide', 'fade', 'none'])
  for (const [key, low, high] of [['weight', 1, 1000], ['lineHeight', .5, 5], ['letterSpacing', -100, 200], ['widthRatio', .01, 1], ['xRatio', 0, 1], ['motion', 0, 1]] as const) if (input[key] !== undefined) result[key] = finite(input[key], low, high)
  if (input.emphasisColor !== undefined) result.emphasisColor = color(input.emphasisColor)
  return result
}
function validateFrame(value: unknown): TemplateFrame {
  const v = object(value); exact(v, ['ratio', 'width', 'height'])
  const width = finite(v.width, 100, 8192), height = finite(v.height, 100, 8192)
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) fail()
  return { ratio: choice(v.ratio, ['9:16', '16:9', '1:1', '3:4', '4:3', 'custom']), width, height }
}
function validateComposition(value: unknown): TemplateComposition {
  const v = object(value); exact(v, ['x', 'y', 'width', 'height', 'round', 'rotationDeg', 'opacity', 'cropMode', 'contentFocusX', 'contentFocusY'])
  const result: TemplateComposition = { x: finite(v.x, -10, 10), y: finite(v.y, -10, 10), width: finite(v.width, .001, 20), height: finite(v.height, .001, 20), round: finite(v.round, 0, 10), rotationDeg: finite(v.rotationDeg, -3600, 3600), opacity: finite(v.opacity, 0, 1), cropMode: choice(v.cropMode, ['cover', 'contain', 'none']) }
  if (v.contentFocusX !== undefined) result.contentFocusX = finite(v.contentFocusX, 0, 1)
  if (v.contentFocusY !== undefined) result.contentFocusY = finite(v.contentFocusY, 0, 1)
  return result
}
export function validateTalkTemplate(value: unknown, owner: number): TalkStyleTemplate {
  const v = object(value)
  exact(v, ['schemaVersion', 'revision', 'id', 'scope', 'owner', 'name', 'nameKey', 'createdAt', 'updatedAt', 'captionStyle', 'backgroundColor', 'frame', 'composition'])
  if (v.schemaVersion !== TALK_TEMPLATE_SCHEMA_VERSION) fail('unsupportedVersion')
  const scope = templateScope(owner)
  if (v.scope !== scope || v.owner !== owner) fail('ownerMismatch')
  const id = text(v.id, 100)
  if (!/^talk-style-[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(id)) fail()
  const named = templateName(text(v.name, 60))
  if (v.name !== named.name || v.nameKey !== named.nameKey) fail()
  const revision = finite(v.revision, 1, Number.MAX_SAFE_INTEGER)
  const createdAt = finite(v.createdAt, 0, Number.MAX_SAFE_INTEGER), updatedAt = finite(v.updatedAt, createdAt, Number.MAX_SAFE_INTEGER)
  if (![revision, createdAt, updatedAt].every(Number.isSafeInteger)) fail()
  return { schemaVersion: 1, revision, id, scope, owner, ...named, createdAt, updatedAt, captionStyle: validateTemplateCaption(v.captionStyle), backgroundColor: color(v.backgroundColor), ...(v.frame === undefined ? {} : { frame: validateFrame(v.frame) }), ...(v.composition === undefined ? {} : { composition: validateComposition(v.composition) }) }
}
function settings(doc: EditorDocument): TalkSettings { return (doc as TalkDocument).ipVideo ?? { script: doc.captions.map(cue => cue.text).join('\n') } }
export function assertTemplateDocumentOwner(doc: EditorDocument, owner: number): void {
  if (doc.scope !== templateScope(owner)) fail('ownerMismatch')
}
const visual = (element: EditorDocument['tracks'][number]['elements'][number]) => element.type === 'image' || element.type === 'video'
/** Only the dedicated main visual track is reusable; overlays are never guessed to be the speaker. */
function mainVisuals(doc: EditorDocument) {
  const candidates = doc.tracks.filter(item => item.id === 'track-main-video')
  if (candidates.length !== 1) fail('compositionUnavailable')
  const track = candidates[0]
  if (track.hidden || track.locked) fail('compositionUnavailable')
  const elements = track.elements.filter((item): item is Extract<typeof item, { type: 'image' | 'video' }> => visual(item))
  if (!elements.length || doc.tracks.some(item => item !== track && item.elements.some(visual))) fail('compositionUnavailable')
  // Identical boxes do not prove a single speaker when clips overlap. Fail closed,
  // and sort a copy so extracting a style cannot reorder the source timeline.
  const timeline = [...elements].sort((a, b) => a.startUs - b.startUs)
  let endUs = 0
  for (const element of timeline) {
    if (!Number.isSafeInteger(element.startUs) || !Number.isSafeInteger(element.durationUs) || element.durationUs <= 0 || element.startUs < endUs || !Number.isSafeInteger(element.startUs + element.durationUs)) fail('compositionUnavailable')
    endUs = element.startUs + element.durationUs
  }
  if (elements.some(item => (item.animations && Object.keys(item.animations.channels).length > 0) || (item.mask && item.mask.kind !== 'none'))) fail('animatedComposition')
  return { track, elements }
}
export function captureTemplateComposition(doc: EditorDocument): TemplateComposition {
  const { elements } = mainVisuals(doc)
  const normalize = (t: TransformBox) => validateComposition({ ...t, x: t.x / doc.canvas.width, y: t.y / doc.canvas.height, width: t.width / doc.canvas.width, height: t.height / doc.canvas.height, round: t.round / Math.min(doc.canvas.width, doc.canvas.height) })
  const first = normalize(elements[0].transform)
  if (elements.some(element => JSON.stringify(normalize(element.transform)) !== JSON.stringify(first))) fail('mixedComposition')
  return first
}
export function createTalkTemplate(doc: EditorDocument, owner: number, name: string, include: { frame: boolean; composition: boolean }, id = `talk-style-${crypto.randomUUID()}`, now = Date.now()): TalkStyleTemplate {
  assertTemplateDocumentOwner(doc, owner)
  return validateTalkTemplate({ schemaVersion: 1, revision: 1, id, scope: templateScope(owner), owner, ...templateName(name), createdAt: now, updatedAt: now, captionStyle: validateTemplateCaption(doc.captionStyle), backgroundColor: color(doc.canvas.backgroundColor), ...(include.frame ? { frame: { ratio: doc.canvas.ratio, width: doc.canvas.width, height: doc.canvas.height } } : {}), ...(include.composition ? { composition: captureTemplateComposition(doc) } : {}) }, owner)
}
export const BUILTIN_TALK_TEMPLATES: readonly BuiltinTalkTemplate[] = TALK_CAPTION_PRESETS.map(preset => ({ id: preset.id, name: preset.name, captionStyle: { ...preset.style }, backgroundColor: '#172128' }))
export const RECOMMENDED_TALK_TEMPLATE_IDS = ['studio', 'bold', 'warm', 'minimal'] as const
export function templateProtectionRequired(doc: EditorDocument): boolean {
  // Background belongs to composition; even caption-only templates include it.
  return !!(settings(doc).aiProtected?.captions || settings(doc).aiProtected?.composition)
}
/** No timing helper, no retimePhotos, no copied media, no inferred animation. */
export function applyTalkTemplate(doc: TalkDocument, owner: number, template: ApplicableTalkTemplate, options: TemplateApplyOptions): TalkDocument {
  assertTemplateDocumentOwner(doc, owner)
  const custom = 'schemaVersion' in template ? validateTalkTemplate(template, owner) : undefined
  const builtin = custom ? undefined : BUILTIN_TALK_TEMPLATES.find(item => item.id === template.id)
  if (!custom && !builtin) fail('invalidData')
  const value = custom ?? builtin!
  if (templateProtectionRequired(doc) && !options.confirmProtected) fail('protectedConfirm')
  const frame = options.frame ? custom?.frame : undefined
  const composition = options.composition ? custom?.composition : undefined
  if ((options.frame && !frame) || (options.composition && !composition)) fail('invalidData')
  const canvas = { ...doc.canvas, ...(frame ?? {}), backgroundColor: value.backgroundColor }
  let tracks = doc.tracks
  if (composition) {
    // A template targets the uniform main visual, never several distinct layouts.
    captureTemplateComposition(doc)
    const { track } = mainVisuals(doc)
    tracks = doc.tracks.map(item => item.id !== track.id ? item : { ...item, elements: item.elements.map(element => {
      if (element.type !== 'video' && element.type !== 'image') return element
      return { ...element, transform: { ...composition, x: composition.x * canvas.width, y: composition.y * canvas.height, width: composition.width * canvas.width, height: composition.height * canvas.height, round: composition.round * Math.min(canvas.width, canvas.height) } }
    }) })
  }
  const state = settings(doc)
  const ipVideo: TalkSettings = { ...state, captionPresetId: builtin?.id, styleTemplate: { id: value.id, name: value.name }, aiProtected: { ...state.aiProtected, captions: true, composition: true } }
  return { ...doc, canvas, tracks, captionStyle: { ...value.captionStyle }, ipVideo }
}
export function assertTemplateRevision(current: EditorDocument, expected: { id: string; revision: number }, owner: number): void {
  assertTemplateDocumentOwner(current, owner)
  if (current.id !== expected.id || current.revision !== expected.revision) fail('staleProject')
}
