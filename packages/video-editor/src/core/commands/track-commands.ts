/**
 * 轨道管理与元素分组/复制命令集
 * 包含：增删排轨、轨道状态、复制粘贴、就地复制、成组解组
 */

import type { Command, CommandResult } from './base.ts'
import type { EditorDocument, TimelineTrack, TrackElement } from '../project.ts'
import type { TimeUs } from '../time.ts'
import { cloneDocument } from '../serialization.ts'
import { reassignInsertDefaultAfterTrackDelete } from './insert-track-defaults.ts'

function recalculateDocumentDuration(doc: EditorDocument): TimeUs {
  let maxUs: TimeUs = 0
  for (const track of doc.tracks) {
    for (const elem of track.elements) {
      const endUs = elem.startUs + elem.durationUs
      if (endUs > maxUs) {
        maxUs = endUs
      }
    }
  }
  return maxUs
}

/**
 * 添加轨道命令
 */
export class AddTrackCommand implements Command {
  readonly id: string
  readonly type = 'AddTrack'
  readonly track: TimelineTrack
  readonly insertIndex?: number

  constructor(track: TimelineTrack, insertIndex?: number, id?: string) {
    this.track = track
    this.insertIndex = insertIndex
    this.id = id ?? `cmd-add-track-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    if (doc.tracks.some((t) => t.id === this.track.id)) {
      throw new Error(`轨道已存在: ${this.track.id}`)
    }

    const index =
      typeof this.insertIndex === 'number' && this.insertIndex >= 0 && this.insertIndex <= doc.tracks.length
        ? this.insertIndex
        : doc.tracks.length

    doc.tracks.splice(index, 0, this.track)
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    doc.tracks = doc.tracks.filter((t) => t.id !== this.track.id)
    doc.durationUs = recalculateDocumentDuration(doc)
    return { document: doc }
  }
}

/**
 * 删除轨道命令
 */
export class DeleteTrackCommand implements Command {
  readonly id: string
  readonly type = 'DeleteTrack'
  readonly trackId: string
  private deletedTrack?: TimelineTrack
  private deletedIndex = -1

  constructor(trackId: string, id?: string) {
    this.trackId = trackId
    this.id = id ?? `cmd-del-track-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const index = doc.tracks.findIndex((t) => t.id === this.trackId)
    if (index === -1) {
      throw new Error(`未找到轨道: ${this.trackId}`)
    }

    const track = doc.tracks[index]
    if (track.locked) {
      throw new Error(`轨道已锁定，无法删除: ${this.trackId}`)
    }

    this.deletedTrack = JSON.parse(JSON.stringify(track))
    this.deletedIndex = index

    doc.tracks.splice(index, 1)
    reassignInsertDefaultAfterTrackDelete(doc, this.trackId)
    doc.durationUs = recalculateDocumentDuration(doc)
    return { document: doc, selectionOverride: [] }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.deletedTrack || this.deletedIndex === -1) return { document }
    const doc = cloneDocument(document)
    doc.tracks.splice(this.deletedIndex, 0, this.deletedTrack)
    doc.durationUs = recalculateDocumentDuration(doc)
    return { document: doc }
  }
}

/**
 * 轨道重新排序命令
 */
export class ReorderTracksCommand implements Command {
  readonly id: string
  readonly type = 'ReorderTracks'
  readonly newTrackIds: string[]
  private previousTrackIds: string[] = []

  constructor(newTrackIds: string[], id?: string) {
    this.newTrackIds = newTrackIds
    this.id = id ?? `cmd-reorder-tracks-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousTrackIds = doc.tracks.map((t) => t.id)

    const trackMap = new Map(doc.tracks.map((t) => [t.id, t]))
    const reordered: TimelineTrack[] = []

    for (const trackId of this.newTrackIds) {
      const track = trackMap.get(trackId)
      if (track) {
        reordered.push(track)
        trackMap.delete(trackId)
      }
    }

    // 将未在 newTrackIds 中的剩余轨道排在末尾
    for (const track of trackMap.values()) {
      reordered.push(track)
    }

    doc.tracks = reordered
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const trackMap = new Map(doc.tracks.map((t) => [t.id, t]))
    const restored: TimelineTrack[] = []

    for (const trackId of this.previousTrackIds) {
      const track = trackMap.get(trackId)
      if (track) restored.push(track)
    }

    doc.tracks = restored
    return { document: doc }
  }
}

/**
 * 修改轨道属性命令（静音、独奏、隐藏、锁定、重命名）
 */
export class SetTrackPropertiesCommand implements Command {
  readonly id: string
  readonly type = 'SetTrackProperties'
  readonly trackId: string
  readonly patch: Partial<Pick<TimelineTrack, 'name' | 'muted' | 'solo' | 'hidden' | 'locked'>>
  private previousProps?: Partial<Pick<TimelineTrack, 'name' | 'muted' | 'solo' | 'hidden' | 'locked'>>

  constructor(
    trackId: string,
    patch: Partial<Pick<TimelineTrack, 'name' | 'muted' | 'solo' | 'hidden' | 'locked'>>,
    id?: string
  ) {
    this.trackId = trackId
    this.patch = patch
    this.id = id ?? `cmd-track-props-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const track = doc.tracks.find((t) => t.id === this.trackId)
    if (!track) {
      throw new Error(`未找到轨道: ${this.trackId}`)
    }

    this.previousProps = {
      name: track.name,
      muted: track.muted,
      solo: track.solo,
      hidden: track.hidden,
      locked: track.locked,
    }

    Object.assign(track, this.patch)
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousProps) return { document }
    const doc = cloneDocument(document)
    const track = doc.tracks.find((t) => t.id === this.trackId)
    if (track) {
      Object.assign(track, this.previousProps)
    }
    return { document: doc }
  }
}

/**
 * 复制粘贴元素命令（支持多选、保留相对间距、生成新 ID 并定位到指定时间点）
 */
export class PasteElementsCommand implements Command {
  readonly id: string
  readonly type = 'PasteElements'
  readonly elementsToPaste: TrackElement[]
  readonly targetStartTimeUs: TimeUs
  readonly targetTrackIdMap?: Record<string, string> // 原 trackId -> 新 trackId 映射，缺省则留在原同类轨道
  private pastedElementIds: string[] = []

  constructor(
    elementsToPaste: TrackElement[],
    targetStartTimeUs: TimeUs,
    targetTrackIdMap?: Record<string, string>,
    id?: string
  ) {
    this.elementsToPaste = elementsToPaste
    this.targetStartTimeUs = targetStartTimeUs
    this.targetTrackIdMap = targetTrackIdMap
    this.id = id ?? `cmd-paste-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    if (this.elementsToPaste.length === 0) return { document }
    const doc = cloneDocument(document)
    this.pastedElementIds = []

    // 找到所有被复制元素的最小 startUs 作为原点基准
    const minStartUs = Math.min(...this.elementsToPaste.map((e) => e.startUs))

    for (const sourceElem of this.elementsToPaste) {
      const targetTrackId = this.targetTrackIdMap?.[sourceElem.trackId] || sourceElem.trackId
      const track = doc.tracks.find((t) => t.id === targetTrackId)
      if (!track) {
        throw new Error(`目标轨道不存在: ${targetTrackId}`)
      }
      if (track.locked) {
        throw new Error(`目标轨道已锁定，无法粘贴: ${targetTrackId}`)
      }

      const relativeOffsetUs = sourceElem.startUs - minStartUs
      const newElem = JSON.parse(JSON.stringify(sourceElem)) as TrackElement
      const newId = `elem-copy-${crypto.randomUUID()}`
      newElem.id = newId
      newElem.trackId = targetTrackId
      newElem.startUs = this.targetStartTimeUs + relativeOffsetUs

      track.elements.push(newElem)
      track.elements.sort((a, b) => a.startUs - b.startUs)
      this.pastedElementIds.push(newId)
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return {
      document: doc,
      selectionOverride: this.pastedElementIds,
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const idSet = new Set(this.pastedElementIds)

    for (const track of doc.tracks) {
      track.elements = track.elements.filter((e) => !idSet.has(e.id))
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return {
      document: doc,
      selectionOverride: [],
    }
  }
}

/**
 * 就地复制/副本生成命令（将选中元素复制并放置紧随其后）
 */
export class DuplicateElementsCommand implements Command {
  readonly id: string
  readonly type = 'DuplicateElements'
  readonly elementIds: string[]
  private createdIds: string[] = []

  constructor(elementIds: string[], id?: string) {
    this.elementIds = elementIds
    this.id = id ?? `cmd-duplicate-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.createdIds = []
    const idSet = new Set(this.elementIds)

    for (const track of doc.tracks) {
      if (track.locked) {
        const hasLockedElem = track.elements.some((e) => idSet.has(e.id))
        if (hasLockedElem) {
          throw new Error(`轨道已锁定，无法复制其中的元素: ${track.id}`)
        }
      }

      const matchingElems = track.elements.filter((e) => idSet.has(e.id))
      for (const elem of matchingElems) {
        const copy = JSON.parse(JSON.stringify(elem)) as TrackElement
        const newId = `elem-dup-${crypto.randomUUID()}`
        copy.id = newId
        // 就地放在原片段紧随其后
        copy.startUs = elem.startUs + elem.durationUs
        track.elements.push(copy)
        this.createdIds.push(newId)
      }
      track.elements.sort((a, b) => a.startUs - b.startUs)
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return {
      document: doc,
      selectionOverride: this.createdIds,
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const idSet = new Set(this.createdIds)

    for (const track of doc.tracks) {
      track.elements = track.elements.filter((e) => !idSet.has(e.id))
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return {
      document: doc,
      selectionOverride: this.elementIds,
    }
  }
}

/**
 * 元素成组命令
 */
export class GroupElementsCommand implements Command {
  readonly id: string
  readonly type = 'GroupElements'
  readonly elementIds: string[]
  readonly groupId: string
  private previousGroupMap = new Map<string, string | undefined>()

  constructor(elementIds: string[], groupId?: string, id?: string) {
    this.elementIds = elementIds
    this.groupId = groupId ?? `group-${crypto.randomUUID()}`
    this.id = id ?? `cmd-group-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousGroupMap.clear()
    const idSet = new Set(this.elementIds)

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (idSet.has(elem.id)) {
          this.previousGroupMap.set(elem.id, elem.groupId)
          elem.groupId = this.groupId
        }
      }
    }

    return {
      document: doc,
      selectionOverride: this.elementIds,
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (this.previousGroupMap.has(elem.id)) {
          elem.groupId = this.previousGroupMap.get(elem.id)
        }
      }
    }

    return {
      document: doc,
      selectionOverride: this.elementIds,
    }
  }
}

/**
 * 元素解组命令
 */
export class UngroupElementsCommand implements Command {
  readonly id: string
  readonly type = 'UngroupElements'
  readonly elementIds: string[]
  private previousGroupMap = new Map<string, string | undefined>()

  constructor(elementIds: string[], id?: string) {
    this.elementIds = elementIds
    this.id = id ?? `cmd-ungroup-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousGroupMap.clear()
    const idSet = new Set(this.elementIds)

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (idSet.has(elem.id)) {
          this.previousGroupMap.set(elem.id, elem.groupId)
          elem.groupId = undefined
        }
      }
    }

    return {
      document: doc,
      selectionOverride: this.elementIds,
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (this.previousGroupMap.has(elem.id)) {
          elem.groupId = this.previousGroupMap.get(elem.id)
        }
      }
    }

    return {
      document: doc,
      selectionOverride: this.elementIds,
    }
  }
}
