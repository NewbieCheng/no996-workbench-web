/**
 * 空间变换、对齐分布与蒙版命令
 */

import type { Command, CommandResult } from './base.ts'
import type { EditorDocument, ElementMask, TransformBox, VideoClipElement, ImageClipElement } from '../project.ts'
import { cloneDocument } from '../serialization.ts'
import { alignElements, distributeElements, type AlignmentMode, type DistributionAxis } from '../../panels/inspector/transform-math.ts'

/**
 * 多选元素对齐命令
 */
export class AlignElementsCommand implements Command {
  readonly id: string
  readonly type = 'AlignElements'
  readonly elementIds: string[]
  readonly alignment: AlignmentMode
  private previousTransforms = new Map<string, TransformBox>()

  constructor(elementIds: string[], alignment: AlignmentMode, id?: string) {
    this.elementIds = elementIds
    this.alignment = alignment
    this.id = id ?? `cmd-align-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousTransforms.clear()
    const targetSet = new Set(this.elementIds)

    const items: Array<{ id: string; transform: TransformBox }> = []

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (targetSet.has(elem.id) && 'transform' in elem && elem.transform) {
          items.push({ id: elem.id, transform: elem.transform })
          this.previousTransforms.set(elem.id, { ...elem.transform })
        }
      }
    }

    if (items.length === 0) return { document }

    const updates = alignElements(items, this.alignment, doc.canvas.width, doc.canvas.height)
    const updateMap = new Map(updates.map((u) => [u.id, u.transform]))

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (updateMap.has(elem.id) && 'transform' in elem && elem.transform) {
          Object.assign(elem.transform, updateMap.get(elem.id)!)
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
        if (this.previousTransforms.has(elem.id) && 'transform' in elem && elem.transform) {
          elem.transform = { ...this.previousTransforms.get(elem.id)! }
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
 * 多选元素均匀分布命令
 */
export class DistributeElementsCommand implements Command {
  readonly id: string
  readonly type = 'DistributeElements'
  readonly elementIds: string[]
  readonly axis: DistributionAxis
  private previousTransforms = new Map<string, TransformBox>()

  constructor(elementIds: string[], axis: DistributionAxis, id?: string) {
    this.elementIds = elementIds
    this.axis = axis
    this.id = id ?? `cmd-distribute-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousTransforms.clear()
    const targetSet = new Set(this.elementIds)

    const items: Array<{ id: string; transform: TransformBox }> = []

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (targetSet.has(elem.id) && 'transform' in elem && elem.transform) {
          items.push({ id: elem.id, transform: elem.transform })
          this.previousTransforms.set(elem.id, { ...elem.transform })
        }
      }
    }

    if (items.length < 3) return { document }

    const updates = distributeElements(items, this.axis)
    const updateMap = new Map(updates.map((u) => [u.id, u.transform]))

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (updateMap.has(elem.id) && 'transform' in elem && elem.transform) {
          Object.assign(elem.transform, updateMap.get(elem.id)!)
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
        if (this.previousTransforms.has(elem.id) && 'transform' in elem && elem.transform) {
          elem.transform = { ...this.previousTransforms.get(elem.id)! }
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
 * 更新元素蒙版命令
 */
export class UpdateElementMaskCommand implements Command {
  readonly id: string
  readonly type = 'UpdateElementMask'
  readonly elementId: string
  readonly mask: ElementMask
  private previousMask?: ElementMask

  constructor(elementId: string, mask: ElementMask, id?: string) {
    this.elementId = elementId
    this.mask = mask
    this.id = id ?? `cmd-mask-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'image')) {
        const mediaElem = elem as VideoClipElement | ImageClipElement
        this.previousMask = mediaElem.mask ? { ...mediaElem.mask } : undefined
        mediaElem.mask = { ...this.mask }
        break
      }
    }

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && (elem.type === 'video' || elem.type === 'image')) {
        const mediaElem = elem as VideoClipElement | ImageClipElement
        mediaElem.mask = this.previousMask ? { ...this.previousMask } : undefined
        break
      }
    }

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }
}
