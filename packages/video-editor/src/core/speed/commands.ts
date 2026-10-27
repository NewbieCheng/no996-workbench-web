/**
 * 变速、反放与冻结命令
 */

import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorDocument, VideoClipElement, AudioClipElement } from '../project.ts'
import type { TimeUs } from '../time.ts'
import { cloneDocument } from '../serialization.ts'
import { computeDurationFromRate } from './mapping.ts'

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
 * 调整片段播放速率命令
 */
export class SetClipSpeedCommand implements Command {
  readonly id: string
  readonly type = 'SetClipSpeed'
  readonly elementId: string
  readonly newRate: number
  private previousRate?: number
  private previousDurationUs?: TimeUs

  constructor(elementId: string, newRate: number, id?: string) {
    this.elementId = elementId
    this.newRate = Math.max(0.1, Math.min(10.0, newRate))
    this.id = id ?? `cmd-speed-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'audio')) {
        const media = elem as VideoClipElement | AudioClipElement
        this.previousRate = media.rate
        this.previousDurationUs = media.durationUs

        media.rate = this.newRate
        media.durationUs = computeDurationFromRate(media.sourceInUs, media.sourceOutUs, this.newRate)
        break
      }
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    if (this.previousRate === undefined || this.previousDurationUs === undefined) return { document }
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'audio')) {
        const media = elem as VideoClipElement | AudioClipElement
        media.rate = this.previousRate
        media.durationUs = this.previousDurationUs
        break
      }
    }

    doc.durationUs = recalculateDocumentDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }
}

/**
 * 切换片段反放（逆序播放）命令
 */
export class SetClipReverseCommand implements Command {
  readonly id: string
  readonly type = 'SetClipReverse'
  readonly elementId: string
  readonly reverse: boolean
  private previousReverse?: boolean
  private previousVolume?: number

  constructor(elementId: string, reverse: boolean, id?: string) {
    this.elementId = elementId
    this.reverse = reverse
    this.id = id ?? `cmd-reverse-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'audio')) {
        const media = elem as VideoClipElement | AudioClipElement
        this.previousReverse = media.reverse
        this.previousVolume = media.volume

        media.reverse = this.reverse
        // 声音策略：反放时如果无专用算法，默认静音避免倒放噪音
        if (this.reverse) {
          media.volume = 0
        } else if (this.previousVolume !== undefined) {
          media.volume = this.previousVolume
        }
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'audio')) {
        const media = elem as VideoClipElement | AudioClipElement
        media.reverse = this.previousReverse
        if (this.previousVolume !== undefined) {
          media.volume = this.previousVolume
        }
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }
}

/**
 * 设置冻结帧命令
 */
export class FreezeFrameCommand implements Command {
  readonly id: string
  readonly type = 'FreezeFrame'
  readonly elementId: string
  readonly freezeSourceTimeUs: TimeUs
  private previousFreeze?: { sourceTimeUs: TimeUs }

  constructor(elementId: string, freezeSourceTimeUs: TimeUs, id?: string) {
    this.elementId = elementId
    this.freezeSourceTimeUs = freezeSourceTimeUs
    this.id = id ?? `cmd-freeze-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'video') {
        const video = elem as VideoClipElement
        this.previousFreeze = video.freeze ? { ...video.freeze } : undefined
        video.freeze = { sourceTimeUs: this.freezeSourceTimeUs }
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'video') {
        const video = elem as VideoClipElement
        video.freeze = this.previousFreeze ? { ...this.previousFreeze } : undefined
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }
}
