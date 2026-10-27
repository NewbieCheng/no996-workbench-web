/**
 * 默认上轴轨道：按画面 / 音频 / 文字分类（画面类含镜头轨与视频轨，每类仅一颗星）。
 */

import type { Command, CommandResult } from './base.ts'
import type {
  EditorDocument,
  InsertDefaultCategory,
  InsertTrackDefaults,
  InsertTrackDefaultsByCategory,
  TimelineTrack,
  TrackType,
} from '../project.ts'
import { cloneDocument } from '../serialization.ts'

/** 旧版内置默认（仅用于迁移读取） */
export const BUILTIN_INSERT_TRACK_DEFAULTS: InsertTrackDefaults = {
  shot: 'track-shot',
  video: 'track-main-video',
  audio: 'track-voice-audio',
  overlay: 'track-overlay',
  text: 'track-title-text',
}

export const BUILTIN_INSERT_TRACK_DEFAULTS_BY_CATEGORY: InsertTrackDefaultsByCategory = {
  visual: 'track-shot',
  audio: 'track-voice-audio',
  text: 'track-title-text',
}

export function insertCategoryForTrackType(type: TrackType): InsertDefaultCategory | null {
  if (type === 'shot' || type === 'video' || type === 'overlay') return 'visual'
  if (type === 'audio') return 'audio'
  if (type === 'text') return 'text'
  return null
}

export function trackMatchesCategory(track: TimelineTrack, category: InsertDefaultCategory): boolean {
  return insertCategoryForTrackType(track.type) === category
}

function trackIdExistsInDoc(doc: EditorDocument, trackId: string): boolean {
  const track = doc.tracks.find((item) => item.id === trackId && !item.locked)
  return Boolean(track)
}

function pickLegacyVisualId(doc: EditorDocument, legacy: InsertTrackDefaults): string | undefined {
  const order: TrackType[] = ['video', 'shot', 'overlay']
  for (const type of order) {
    const id = legacy[type]
    if (id && trackIdExistsInDoc(doc, id)) {
      const track = doc.tracks.find((item) => item.id === id)
      if (track && trackMatchesCategory(track, 'visual')) return id
    }
  }
  return undefined
}

/** 合并新字段 + 旧字段迁移，得到分类默认表 */
export function ensureCategoryInsertDefaults(doc: EditorDocument): InsertTrackDefaultsByCategory {
  if (doc.insertTrackDefaultsByCategory) {
    return { ...BUILTIN_INSERT_TRACK_DEFAULTS_BY_CATEGORY, ...doc.insertTrackDefaultsByCategory }
  }

  const next: InsertTrackDefaultsByCategory = { ...BUILTIN_INSERT_TRACK_DEFAULTS_BY_CATEGORY }

  if (doc.insertTrackDefaults) {
    const legacy = { ...BUILTIN_INSERT_TRACK_DEFAULTS, ...doc.insertTrackDefaults }
    const visual = pickLegacyVisualId(doc, legacy)
    if (visual) next.visual = visual
    if (legacy.audio && trackIdExistsInDoc(doc, legacy.audio)) next.audio = legacy.audio
    if (legacy.text && trackIdExistsInDoc(doc, legacy.text)) next.text = legacy.text
  }

  return next
}

/** @deprecated 仅供旧测试/迁移引用 */
export function ensureInsertTrackDefaults(doc: EditorDocument): InsertTrackDefaults {
  return { ...BUILTIN_INSERT_TRACK_DEFAULTS, ...doc.insertTrackDefaults }
}

export function listUnlockedTracksInCategory(
  doc: EditorDocument,
  category: InsertDefaultCategory,
): TimelineTrack[] {
  return doc.tracks.filter((track) => !track.locked && trackMatchesCategory(track, category))
}

export function findFirstUnlockedTrackByType(
  doc: EditorDocument,
  trackType: TrackType,
): TimelineTrack | undefined {
  return doc.tracks.find((track) => track.type === trackType && !track.locked)
}

export function resolveDefaultTrackForCategory(
  doc: EditorDocument,
  category: InsertDefaultCategory,
): TimelineTrack | undefined {
  const defaults = ensureCategoryInsertDefaults(doc)
  const preferredId = defaults[category]
  if (preferredId) {
    const preferred = doc.tracks.find((item) => item.id === preferredId && !item.locked)
    if (preferred && trackMatchesCategory(preferred, category)) {
      return preferred
    }
  }
  return listUnlockedTracksInCategory(doc, category)[0]
}

/** 优先用户星标（分类内唯一），并按请求的 TrackType 回退到同类轨 */
export function resolveDefaultInsertTrack(
  doc: EditorDocument,
  trackType: TrackType,
): TimelineTrack | undefined {
  const category = insertCategoryForTrackType(trackType)
  if (!category) {
    return findFirstUnlockedTrackByType(doc, trackType)
  }

  const categoryDefault = resolveDefaultTrackForCategory(doc, category)

  if (category === 'visual') {
    // 镜头上轴：优先分类星标（可落 shot/video/overlay），不再无条件退回第一条 shot 轨
    if (trackType === 'shot') {
      if (
        categoryDefault &&
        (categoryDefault.type === 'shot' ||
          categoryDefault.type === 'video' ||
          categoryDefault.type === 'overlay')
      ) {
        return categoryDefault
      }
      return findFirstUnlockedTrackByType(doc, 'shot')
    }
    if (trackType === 'video') {
      if (categoryDefault?.type === 'video') return categoryDefault
      if (categoryDefault?.type === 'overlay') return categoryDefault
      if (categoryDefault?.type === 'shot') {
        const video = findFirstUnlockedTrackByType(doc, 'video')
        if (video) return video
      }
      const video = findFirstUnlockedTrackByType(doc, 'video')
      if (video) return video
      return findFirstUnlockedTrackByType(doc, 'overlay')
    }
    if (trackType === 'overlay') {
      if (categoryDefault?.type === 'overlay') return categoryDefault
      if (categoryDefault?.type === 'video') return categoryDefault
      const overlay = findFirstUnlockedTrackByType(doc, 'overlay')
      if (overlay) return overlay
      return findFirstUnlockedTrackByType(doc, 'video')
    }
  }

  if (categoryDefault?.type === trackType) return categoryDefault
  return categoryDefault ?? findFirstUnlockedTrackByType(doc, trackType)
}

export function isDefaultInsertTrack(doc: EditorDocument, trackId: string): boolean {
  const track = doc.tracks.find((item) => item.id === trackId)
  if (!track) return false

  const category = insertCategoryForTrackType(track.type)
  if (!category) return false

  const inCategory = listUnlockedTracksInCategory(doc, category)
  if (inCategory.length === 1 && inCategory[0].id === trackId) {
    return true
  }

  const defaults = ensureCategoryInsertDefaults(doc)
  return defaults[category] === trackId
}

export function computeTrackEndStartUs(track: TimelineTrack): number {
  if (track.elements.length === 0) return 0
  return Math.max(...track.elements.map((element) => element.startUs + element.durationUs))
}

export function reassignInsertDefaultAfterTrackDelete(doc: EditorDocument, deletedTrackId: string): void {
  const defaults = ensureCategoryInsertDefaults(doc)
  let changed = false
  const next: InsertTrackDefaultsByCategory = { ...defaults }

  for (const category of ['visual', 'audio', 'text'] as InsertDefaultCategory[]) {
    if (defaults[category] !== deletedTrackId) continue
    const fallback = listUnlockedTracksInCategory(doc, category)[0]
    if (fallback) {
      next[category] = fallback.id
    } else {
      delete next[category]
    }
    changed = true
  }

  if (changed) {
    doc.insertTrackDefaultsByCategory = next
    doc.insertTrackDefaults = undefined
  }
}

export class SetDefaultInsertTrackCommand implements Command {
  readonly id: string
  readonly type = 'SetDefaultInsertTrack'
  readonly trackId: string
  private previousByCategory?: InsertTrackDefaultsByCategory
  private previousLegacy?: InsertTrackDefaults

  constructor(trackId: string, id?: string) {
    this.trackId = trackId
    this.id = id ?? `cmd-default-insert-track-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const track = doc.tracks.find((item) => item.id === this.trackId)
    if (!track) {
      throw new Error(`未找到轨道: ${this.trackId}`)
    }
    if (track.locked) {
      throw new Error(`轨道已锁定，无法设为默认上轴轨道: ${this.trackId}`)
    }

    const category = insertCategoryForTrackType(track.type)
    if (!category) {
      throw new Error(`轨道类型不支持设为默认上轴: ${track.type}`)
    }

    this.previousByCategory = doc.insertTrackDefaultsByCategory
      ? { ...doc.insertTrackDefaultsByCategory }
      : { ...ensureCategoryInsertDefaults(doc) }
    this.previousLegacy = doc.insertTrackDefaults ? { ...doc.insertTrackDefaults } : undefined

    const next = ensureCategoryInsertDefaults(doc)
    next[category] = track.id
    doc.insertTrackDefaultsByCategory = next
    doc.insertTrackDefaults = undefined

    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    doc.insertTrackDefaultsByCategory = this.previousByCategory
      ? { ...this.previousByCategory }
      : { ...BUILTIN_INSERT_TRACK_DEFAULTS_BY_CATEGORY }
    doc.insertTrackDefaults = this.previousLegacy ? { ...this.previousLegacy } : undefined
    return { document: doc }
  }
}
