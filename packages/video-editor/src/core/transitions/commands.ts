/**
 * 转场添加与移除命令
 */

import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorDocument, TransitionElement } from '../project.ts'
import { cloneDocument } from '../serialization.ts'
import { validateTransitionBoundaries } from '../../panels/timeline/caption-link-logic.ts'

/**
 * 添加转场命令
 */
export class AddTransitionCommand implements Command {
  readonly id: string
  readonly type = 'AddTransition'
  readonly transition: TransitionElement

  constructor(transition: TransitionElement, id?: string) {
    this.transition = transition
    this.id = id ?? `cmd-add-trans-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    // 查找相连的两个元素进行边界校验
    let fromElem = undefined
    let toElem = undefined

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (elem.id === this.transition.fromElementId) fromElem = elem
        if (elem.id === this.transition.toElementId) toElem = elem
      }
    }

    const validation = validateTransitionBoundaries(
      {
        id: this.transition.id,
        durationUs: this.transition.durationUs,
        leftClipId: this.transition.fromElementId,
        rightClipId: this.transition.toElementId,
      },
      fromElem,
      toElem
    )

    if (!validation.valid) {
      throw new Error(`无法添加转场: ${validation.reason}`)
    }

    if (!doc.transitions) {
      doc.transitions = {}
    }

    doc.transitions[this.transition.id] = { ...this.transition }
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    if (doc.transitions) {
      delete doc.transitions[this.transition.id]
    }
    return { document: doc }
  }
}

/**
 * 移除转场命令
 */
export class RemoveTransitionCommand implements Command {
  readonly id: string
  readonly type = 'RemoveTransition'
  readonly transitionId: string
  private previousTransition?: TransitionElement

  constructor(transitionId: string, id?: string) {
    this.transitionId = transitionId
    this.id = id ?? `cmd-remove-trans-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    if (doc.transitions && doc.transitions[this.transitionId]) {
      this.previousTransition = { ...doc.transitions[this.transitionId] }
      delete doc.transitions[this.transitionId]
    }
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousTransition) return { document }
    const doc = cloneDocument(document)
    if (!doc.transitions) doc.transitions = {}
    doc.transitions[this.transitionId] = { ...this.previousTransition }
    return { document: doc }
  }
}
