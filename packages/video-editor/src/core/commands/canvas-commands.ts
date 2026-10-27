/**
 * 工程画布（画幅 / 分辨率）命令
 */

import type { Command, CommandResult } from './base.ts'
import {
  cloneDocument,
} from '../serialization.ts'
import {
  createDefaultCanvasSettings,
  type CanvasRatio,
  type EditorDocument,
  type TransformBox,
  type TrackElement,
} from '../project.ts'

function scaleTransform(transform: TransformBox, sx: number, sy: number): TransformBox {
  return {
    ...transform,
    x: transform.x * sx,
    y: transform.y * sy,
    width: transform.width * sx,
    height: transform.height * sy,
  }
}

function scaleElementTransforms(element: TrackElement, sx: number, sy: number): TrackElement {
  if (!('transform' in element) || !element.transform) return element
  return {
    ...element,
    transform: scaleTransform(element.transform, sx, sy),
  }
}

export class SetCanvasRatioCommand implements Command {
  readonly id: string
  readonly type = 'SetCanvasRatio'
  readonly nextRatio: CanvasRatio
  private beforeDocument: EditorDocument | null = null

  constructor(nextRatio: CanvasRatio, id?: string) {
    this.nextRatio = nextRatio
    this.id = id ?? `cmd-set-canvas-ratio-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    this.beforeDocument = cloneDocument(document)
    const doc = cloneDocument(document)
    const oldCanvas = doc.canvas

    const nextCanvas = createDefaultCanvasSettings(this.nextRatio)
    const sx = nextCanvas.width / oldCanvas.width
    const sy = nextCanvas.height / oldCanvas.height

    doc.canvas = {
      ...nextCanvas,
      backgroundColor: oldCanvas.backgroundColor,
      fps: oldCanvas.fps,
    }

    for (const track of doc.tracks) {
      track.elements = track.elements.map((element) => scaleElementTransforms(element, sx, sy))
    }

    return { document: doc }
  }

  undo(_document: EditorDocument): CommandResult {
    if (!this.beforeDocument) {
      throw new Error('无法撤销：未记录先前画幅')
    }
    return { document: cloneDocument(this.beforeDocument) }
  }
}
