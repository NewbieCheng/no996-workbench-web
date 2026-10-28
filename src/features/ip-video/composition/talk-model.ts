import { createEmptyDocument, createDefaultCanvasSettings, type CanvasRatio, type EditorDocument, type CaptionCue, type CaptionStyle, type ProjectAsset, type ImageClipElement, type TrackElement } from '../../../../packages/video-editor/src/core/project.ts'
import type { EditorInstance } from '../../../../packages/video-editor/src/core/instance.ts'
import type { TalkDirectorMetadata } from '../agent/types'
import type { Command } from '../../../../packages/video-editor/src/core/commands/base.ts'
import { mirrorCaptionsOntoTextTrack } from '../../../../packages/video-editor/src/panels/captions/sync-text-track.ts'
import { buildAlignedTimeline } from '../lib/timeline-engine.ts'

import { TALK_CAPTION_PRESETS } from './talk-caption-presets.ts'
export { TALK_CAPTION_PRESETS, matchingTalkPreset } from './talk-caption-presets.ts'
export type { TalkCaptionPreset } from './talk-caption-presets.ts'

export type TalkSettings = {
  script: string
  audioScript?: string
  voiceId?: string
  speed?: number
  taskId?: string
  appliedTaskId?: string
  photoMotion?: boolean
  /** Local style selection; the template contains no media or spoken content. */
  styleTemplate?: { id: string; name: string }
  /** Finished-video look from the start strip; not a caption-only chip. */
  lookId?: string
  captionPresetId?: string
  coverTitle?: string
  coverPhotoAssetId?: string
  coverCropMode?: 'cover' | 'contain'
  /** Cover output ratio for the independent cover PNG (not the video canvas). */
  coverRatio?: '1:1' | '3:4' | '9:16'
  /** Generated cover image; stored as a project asset, not placed on the video track. */
  coverAssetId?: string
  /** Explicit acceptance when manuscript and manually timed captions intentionally differ. */
  captionReviewScript?: string
  /** Trusted director plan and cue anchors retained across edits and audio binding. */
  director?: TalkDirectorMetadata
  /** Local creation request/result binding; never a cloud account record. */
  creation?: {
    brief: string
    appliedTaskIds?: string[]
    dismissedTaskIds?: string[]
    summary?: string
    usedMock?: boolean
  }
  /** Manual property groups remain protected when the director runs again. */
  aiProtected?: { captions?: boolean; composition?: boolean; shots?: boolean }
}
export type TalkDocument = EditorDocument & { ipVideo?: TalkSettings }
export const talkSettings = (doc: EditorDocument): TalkSettings => (doc as TalkDocument).ipVideo ?? { script: doc.captions.map(cue => cue.text).join('\n') }
export const secondsLabel = (us: number) => `${Math.floor(us / 60_000_000)}:${String(Math.floor(us / 1_000_000) % 60).padStart(2, '0')}`

/** Default talk caption font — 马善政楷书 (loaded via caption-fonts / @fontsource/ma-shan-zheng). */
export const TALK_DEFAULT_CAPTION_FONT = 'Ma Shan Zheng'
export const TALK_DEFAULT_CAPTION_PRESET_ID = 'ink'

export function createTalkDocument(scope: string): TalkDocument {
  const doc: TalkDocument = createEmptyDocument(`proj-ip-${crypto.randomUUID()}`, '未命名口播视频', scope, '9:16')
  doc.templateMeta = { templateId: 'ip-composition', presetName: '口播视频', category: 'ip-speaker' }
  const preset = TALK_CAPTION_PRESETS.find(item => item.id === TALK_DEFAULT_CAPTION_PRESET_ID) ?? TALK_CAPTION_PRESETS[0]
  doc.ipVideo = { script: '', photoMotion: true, speed: 1, captionPresetId: preset.id, lookId: 'scroll' }
  doc.canvas.backgroundColor = '#172128'
  doc.captionStyle = {
    ...doc.captionStyle,
    ...preset.style,
    font: TALK_DEFAULT_CAPTION_FONT,
    weight: 400,
    burn: true,
  }
  return doc
}

/** All edits use the public command history; switching projects creates a fresh instance. */
export function editTalk(editor: EditorInstance, label: string, update: (doc: TalkDocument) => TalkDocument): void {
  let before: EditorDocument
  let after: EditorDocument
  const command: Command = {
    id: crypto.randomUUID(), type: `ip-video:${label}`,
    execute(doc) {
      before ??= doc
      if (!after) {
        const next = update(doc as TalkDocument)
        const protectCaptions = /^(caption-|import-srt|retime-captions|sync-caption-text|accept-caption-text)/.test(label) || label === 'move'
        const protectComposition = ['composition', 'visual-transform', 'photo-motion', 'background', 'canvas-ratio', 'move', 'reorder-photo', 'remove-visual'].includes(label)
        after = protectCaptions || protectComposition ? { ...next, ipVideo: { ...talkSettings(next), aiProtected: { ...talkSettings(next).aiProtected, ...(protectCaptions ? { captions: true } : {}), ...(protectComposition ? { composition: true } : {}) } } } : next
      }
      return { document: after }
    },
    undo() { return { document: before } },
  }
  editor.executeCommand(command)
}

export function estimateCues(script: string, durationUs: number, offsetUs = 0): CaptionCue[] {
  if (!script.trim() || durationUs <= 0) return []
  return buildAlignedTimeline(script, durationUs / 1_000_000).sentences.map(line => {
    const startUs = Math.min(durationUs - 1, Math.max(0, Math.round(line.start * 1_000_000)))
    const endUs = Math.min(durationUs, Math.max(startUs + 1, Math.round(line.end * 1_000_000)))
    return { id: `cue-${crypto.randomUUID()}`, text: line.text, startUs: offsetUs + startUs, durationUs: endUs - startUs, timingSource: 'estimated' }
  })
}

export function voiceDuration(doc: EditorDocument): number {
  const audio = doc.tracks.flatMap(t => t.muted ? [] : t.elements.filter(e => e.type === 'audio'))
  if (audio.length) return Math.max(...audio.map(e => e.startUs + e.durationUs))
  const video = doc.tracks.flatMap(t => t.elements.filter(e => e.type === 'video'))
  return video.length ? Math.max(...video.map(e => e.startUs + e.durationUs)) : 0
}

export function hasTalkAudio(doc: EditorDocument): boolean {
  return doc.tracks.some(track => !track.muted && track.elements.some(element => element.type === 'audio' ? element.volume > 0 : element.type === 'video' && element.volume > 0 && doc.assets[element.assetId]?.hasAudio === true))
}

const normalizedScript = (text: string) => text.replace(/\s/gu, '')

export function captionTextNeedsReview(doc: EditorDocument): boolean {
  const state = talkSettings(doc)
  return doc.captions.length > 0 && state.captionReviewScript !== state.script
    && normalizedScript(doc.captions.map(cue => cue.text).join('')) !== normalizedScript(state.script)
}

/** Preserve calibrated timing only when the user explicitly resolves changed manuscript text. */
export function syncCaptionText(doc: TalkDocument): TalkDocument {
  const state = talkSettings(doc)
  const sentences = estimateCues(state.script, doc.durationUs)
  if (sentences.length !== doc.captions.length) throw new Error(`文稿分成 ${sentences.length} 句，现有字幕为 ${doc.captions.length} 句。请逐句修改，或明确选择重新估时。`)
  return { ...doc, captions: doc.captions.map((cue, index) => ({ ...cue, text: sentences[index].text })), ipVideo: { ...state, captionReviewScript: undefined } }
}

export function updateScript(doc: TalkDocument, script: string): TalkDocument {
  const settings = talkSettings(doc)
  const measured = voiceDuration(doc)
  const shotEnd = Math.max(0, ...doc.tracks.flatMap(t => t.elements.filter(e => e.type === 'shot').map(e => e.startUs + e.durationUs)))
  const durationUs = Math.max(shotEnd, measured || Math.min(300_000_000, Math.max(1_000_000, Math.round(Array.from(script.replace(/\s/g, '')).length / (2.8 * (settings.speed ?? 1)) * 1_000_000))))
  const protectedTiming = doc.captions.some(cue => cue.timingSource !== 'estimated')
  const sameText = normalizedScript(doc.captions.map(cue => cue.text).join('')) === normalizedScript(script)
  return retimePhotos({ ...doc, durationUs: script.trim() || measured || shotEnd ? durationUs : 0, ipVideo: { ...settings, script, captionReviewScript: script === settings.script ? settings.captionReviewScript : undefined }, captions: protectedTiming || sameText ? doc.captions : estimateCues(script, measured || durationUs) })
}

/** Caption style never changes media transforms. Composition has its own explicit controls. */
export function patchGlobalStyle(doc: TalkDocument, patch: Partial<CaptionStyle>): TalkDocument {
  return { ...doc, captionStyle: { ...doc.captionStyle, ...patch } }
}

export type TalkComposition = 'full' | 'side' | 'top' | 'pip'
export function applyTalkComposition(doc: TalkDocument, layout: TalkComposition): TalkDocument {
  const { width: w, height: h } = doc.canvas
  const box = layout === 'side' ? { x: 0, y: 0, width: w * .48, height: h }
    : layout === 'top' ? { x: 0, y: 0, width: w, height: h * .62 }
    : layout === 'pip' ? { x: w * .66, y: h * .06, width: w * .28, height: h * .28 }
    : { x: 0, y: 0, width: w, height: h }
  return retimePhotos({ ...doc, tracks: doc.tracks.map(track => ({ ...track, elements: track.elements.map(e => e.type === 'video' || e.type === 'image' ? { ...e, transform: { ...e.transform, ...box, rotationDeg: 0, cropMode: 'cover' as const } } : e) })) })
}

export function resolveTalkCoverTitle(doc: TalkDocument, fallback: string): string {
  const stored = talkSettings(doc).coverTitle?.trim()
  if (stored) return stored
  const firstCue = doc.captions[0]?.text.trim()
  if (firstCue) return Array.from(firstCue).slice(0, 36).join('')
  const firstLine = talkSettings(doc).script.split(/[\r\n]/u).map(line => line.trim()).find(Boolean)
  if (firstLine) return Array.from(firstLine).slice(0, 36).join('')
  return fallback
}

export function setTalkRatio(doc: TalkDocument, ratio: CanvasRatio): TalkDocument {
  const canvas = { ...createDefaultCanvasSettings(ratio), backgroundColor: doc.canvas.backgroundColor, fps: doc.canvas.fps }
  const sx = canvas.width / doc.canvas.width
  const sy = canvas.height / doc.canvas.height
  const tracks = doc.tracks.map(track => ({ ...track, elements: track.elements.map(e => {
    if (!('transform' in e)) return e
    const animations = e.animations && { channels: Object.fromEntries(Object.entries(e.animations.channels).map(([path, channel]) => {
      const factor = ['transform.x', 'transform.width'].includes(path) ? sx : ['transform.y', 'transform.height'].includes(path) ? sy : 1
      return [path, { ...channel, keyframes: channel.keyframes.map(k => ({ ...k, value: typeof k.value === 'number' ? k.value * factor : k.value })) }]
    })) }
    return { ...e, transform: { ...e.transform, x: e.transform.x * sx, y: e.transform.y * sy, width: e.transform.width * sx, height: e.transform.height * sy }, animations }
  }) }))
  return retimePhotos({ ...doc, canvas, tracks })
}

export function retimePhotos(doc: TalkDocument): TalkDocument {
  const photos = doc.tracks.flatMap(t => t.elements.filter((e): e is ImageClipElement => e.type === 'image' && e.id.startsWith('ip-photo-')))
  if (!photos.length) return doc
  const duration = doc.durationUs || 5_000_000
  return { ...doc, tracks: doc.tracks.map(track => ({ ...track, elements: track.elements.map(element => {
    const index = photos.findIndex(photo => photo.id === element.id)
    if (index < 0 || element.type !== 'image') return element
    const startUs = Math.round(index * duration / photos.length)
    const durationUs = Math.round((index + 1) * duration / photos.length) - startUs
    const t = element.transform
    const moving = talkSettings(doc).photoMotion !== false
    const key = (propertyPath: string, a: number, b: number) => ({ propertyPath, keyframes: [{ id: crypto.randomUUID(), timeUs: 0, value: a, easing: 'linear' as const }, { id: crypto.randomUUID(), timeUs: durationUs, value: b, easing: 'easeInOut' as const }] })
    return { ...element, startUs, durationUs, animations: moving ? { channels: { 'transform.x': key('transform.x', t.x, t.x - t.width * 0.025), 'transform.y': key('transform.y', t.y, t.y - t.height * 0.025), 'transform.width': key('transform.width', t.width, t.width * 1.05), 'transform.height': key('transform.height', t.height, t.height * 1.05), 'transform.opacity': { propertyPath: 'transform.opacity', keyframes: [{ id: crypto.randomUUID(), timeUs: 0, value: 0, easing: 'linear' as const }, { id: crypto.randomUUID(), timeUs: Math.min(220_000, Math.floor(durationUs / 4)), value: 1, easing: 'easeOut' as const }] } } } : undefined }
  }) })) }
}

export function addAsset(doc: TalkDocument, asset: ProjectAsset, kind: 'video' | 'audio' | 'image'): TalkDocument {
  const durationUs = asset.durationUs ?? (doc.durationUs || 5_000_000)
  const visualTrack = 'track-main-video'
  const trackId = kind === 'audio' ? 'track-voice-audio' : visualTrack
  const transform = { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height, opacity: 1, rotationDeg: 0, round: 0, cropMode: 'cover' as const }
  const element: TrackElement = kind === 'image'
    ? { id: `ip-photo-${crypto.randomUUID()}`, type: 'image', trackId, assetId: asset.id, startUs: 0, durationUs, transform }
    : kind === 'video'
      ? { id: `ip-video-${crypto.randomUUID()}`, type: 'video', trackId, assetId: asset.id, startUs: 0, durationUs, sourceInUs: 0, sourceOutUs: durationUs, rate: 1, volume: 1, transform }
      : { id: `ip-audio-${crypto.randomUUID()}`, type: 'audio', trackId, assetId: asset.id, startUs: 0, durationUs, sourceInUs: 0, sourceOutUs: durationUs, rate: 1, volume: 1 }
  let tracks = doc.tracks.map(track => ({ ...track, elements: track.elements.filter(e => kind === 'image' ? e.type !== 'video' : kind === 'video' ? e.type !== 'video' && e.type !== 'image' && e.type !== 'audio' : e.type !== 'audio').map(e => kind === 'audio' && e.type === 'video' ? { ...e, volume: 0 } : e) }))
  if (!tracks.some(t => t.id === trackId)) tracks = [...tracks, { id: trackId, name: kind === 'audio' ? '配音' : '画面', type: kind === 'audio' ? 'audio' : 'video', muted: false, hidden: false, locked: false, elements: [] }]
  tracks = tracks.map(t => t.id === trackId ? { ...t, elements: [...t.elements, element] } : t)
  const settings = talkSettings(doc)
  const nextDuration = kind === 'image' ? doc.durationUs || durationUs : durationUs
  const captions = kind === 'image' || doc.captions.some(c => c.timingSource !== 'estimated') ? doc.captions : estimateCues(settings.script, nextDuration)
  const nextDoc = retimePhotos({ ...doc, assets: { ...doc.assets, [asset.id]: asset }, tracks, durationUs: nextDuration, captions, ipVideo: { ...settings, ...(kind === 'audio' ? { audioScript: settings.script } : {}) } })
  if (kind === 'audio' || captions !== doc.captions) mirrorCaptionsOntoTextTrack(nextDoc)
  return nextDoc
}

/**
 * SRT import must be able to establish duration on an empty project. When audio or
 * video already exists, the captions may not extend past that real duration.
 */
export function resolveTalkCaptionImport(cues: CaptionCue[], currentDurationUs: number): { captions: CaptionCue[]; durationUs: number; script: string } {
  if (!cues.length) throw new Error('字幕文件中没有有效内容。')
  const endUs = Math.max(...cues.map(cue => cue.startUs + cue.durationUs))
  const durationUs = currentDurationUs > 0 ? currentDurationUs : endUs
  validateTalkCaptions(cues, durationUs)
  return { captions: cues, durationUs, script: cues.map(cue => cue.text).join('\n') }
}

export function validateTalkCaptions(cues: CaptionCue[], durationUs: number): void {
  let end = 0
  for (const cue of cues) {
    if (!cue.text.trim() || !Number.isSafeInteger(cue.startUs) || !Number.isSafeInteger(cue.durationUs) || cue.startUs < end || cue.durationUs <= 0 || cue.startUs + cue.durationUs > durationUs) throw new Error('字幕时间需依次排列、不重叠，且不超过音视频时长。')
    end = cue.startUs + cue.durationUs
  }
}
