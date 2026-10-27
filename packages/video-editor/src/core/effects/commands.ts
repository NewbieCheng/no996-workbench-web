/**
 * 视觉效果与滤镜命令
 */

import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorDocument, EffectParam, VideoClipElement } from '../project.ts'
import { cloneDocument } from '../serialization.ts'

/**
 * 更新元素视觉效果命令
 */
export class UpdateElementEffectsCommand implements Command {
  readonly id: string
  readonly type = 'UpdateElementEffects'
  readonly elementId: string
  readonly effects: EffectParam[]
  private previousEffects?: EffectParam[]

  constructor(elementId: string, effects: EffectParam[], id?: string) {
    this.elementId = elementId
    this.effects = effects
    this.id = id ?? `cmd-effects-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'video') {
        const video = elem as VideoClipElement
        this.previousEffects = video.effects ? JSON.parse(JSON.stringify(video.effects)) : undefined
        video.effects = JSON.parse(JSON.stringify(this.effects))
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
        video.effects = this.previousEffects ? JSON.parse(JSON.stringify(this.previousEffects)) : undefined
        break
      }
    }

    return { document: doc, selectionOverride: [this.elementId] }
  }
}
