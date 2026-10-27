/**
 * 音频音量与包络命令
 */

import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorDocument, AudioClipElement } from '../project.ts'
import type { TimeUs } from '../time.ts'
import { cloneDocument } from '../serialization.ts'

export type AudioEnvelopePatch = {
  volume?: number
  fadeInUs?: TimeUs
  fadeOutUs?: TimeUs
}

/**
 * 更新音频包络命令
 */
export class UpdateAudioEnvelopeCommand implements Command {
  readonly id: string
  readonly type = 'UpdateAudioEnvelope'
  readonly elementId: string
  readonly patch: AudioEnvelopePatch
  private previousEnvelope?: AudioEnvelopePatch

  constructor(elementId: string, patch: AudioEnvelopePatch, id?: string) {
    this.elementId = elementId
    this.patch = patch
    this.id = id ?? `cmd-audio-env-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'audio') {
        const audio = elem as AudioClipElement
        this.previousEnvelope = {
          volume: audio.volume,
          fadeInUs: audio.fadeInUs,
          fadeOutUs: audio.fadeOutUs,
        }

        if (this.patch.volume !== undefined) audio.volume = this.patch.volume
        if (this.patch.fadeInUs !== undefined) audio.fadeInUs = this.patch.fadeInUs
        if (this.patch.fadeOutUs !== undefined) audio.fadeOutUs = this.patch.fadeOutUs
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousEnvelope) return { document }
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'audio') {
        const audio = elem as AudioClipElement
        if (this.previousEnvelope.volume !== undefined) audio.volume = this.previousEnvelope.volume
        if (this.previousEnvelope.fadeInUs !== undefined) audio.fadeInUs = this.previousEnvelope.fadeInUs
        if (this.previousEnvelope.fadeOutUs !== undefined) audio.fadeOutUs = this.previousEnvelope.fadeOutUs
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }
}
