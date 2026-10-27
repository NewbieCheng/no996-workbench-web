/**
 * 关键帧编辑命令
 */

import type { Command, CommandResult } from '../commands/base.ts'
import type { EditorDocument, KeyframePoint, ElementAnimations } from '../project.ts'
import { cloneDocument } from '../serialization.ts'

/**
 * 设置/添加关键帧命令
 */
export class SetKeyframeCommand implements Command {
  readonly id: string
  readonly type = 'SetKeyframe'
  readonly elementId: string
  readonly propertyPath: string
  readonly point: KeyframePoint<number | string>
  private previousAnimations?: ElementAnimations

  constructor(
    elementId: string,
    propertyPath: string,
    point: KeyframePoint<number | string>,
    id?: string
  ) {
    this.elementId = elementId
    this.propertyPath = propertyPath
    this.point = point
    this.id = id ?? `cmd-kf-set-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem) {
        this.previousAnimations = elem.animations ? JSON.parse(JSON.stringify(elem.animations)) : undefined

        if (!elem.animations) {
          elem.animations = { channels: {} }
        }
        if (!elem.animations.channels[this.propertyPath]) {
          elem.animations.channels[this.propertyPath] = {
            propertyPath: this.propertyPath,
            keyframes: [],
          }
        }

        const channel = elem.animations.channels[this.propertyPath]
        // 查找是否有相同局部时间的已有帧，若有则更新，否则插入
        const existingIdx = channel.keyframes.findIndex((k) => k.timeUs === this.point.timeUs)
        if (existingIdx !== -1) {
          channel.keyframes[existingIdx] = { ...this.point }
        } else {
          channel.keyframes.push({ ...this.point })
        }
        channel.keyframes.sort((a, b) => a.timeUs - b.timeUs)
        break
      }
    }

    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem) {
        elem.animations = this.previousAnimations ? JSON.parse(JSON.stringify(this.previousAnimations)) : undefined
        break
      }
    }

    return { document: doc }
  }
}

/**
 * 移除关键帧命令
 */
export class RemoveKeyframeCommand implements Command {
  readonly id: string
  readonly type = 'RemoveKeyframe'
  readonly elementId: string
  readonly propertyPath: string
  readonly keyframeId: string
  private previousKeyframe?: KeyframePoint<number | string>

  constructor(
    elementId: string,
    propertyPath: string,
    keyframeId: string,
    id?: string
  ) {
    this.elementId = elementId
    this.propertyPath = propertyPath
    this.keyframeId = keyframeId
    this.id = id ?? `cmd-kf-remove-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem?.animations?.channels?.[this.propertyPath]) {
        const channel = elem.animations.channels[this.propertyPath]
        const idx = channel.keyframes.findIndex((k) => k.id === this.keyframeId)
        if (idx !== -1) {
          this.previousKeyframe = { ...channel.keyframes[idx] }
          channel.keyframes.splice(idx, 1)
        }
        break
      }
    }

    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousKeyframe) return { document }
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem) {
        if (!elem.animations) elem.animations = { channels: {} }
        if (!elem.animations.channels[this.propertyPath]) {
          elem.animations.channels[this.propertyPath] = {
            propertyPath: this.propertyPath,
            keyframes: [],
          }
        }
        const channel = elem.animations.channels[this.propertyPath]
        channel.keyframes.push(this.previousKeyframe)
        channel.keyframes.sort((a, b) => a.timeUs - b.timeUs)
        break
      }
    }

    return { document: doc }
  }
}
