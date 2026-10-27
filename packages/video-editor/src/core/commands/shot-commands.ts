/**
 * 动效镜头命令集
 *
 * 三个命令：
 *   InsertShotCommand   —— 在指定轨道插入一个镜头片段
 *   TrimShotCommand     —— 裁剪（同时改时长与源内偏移）
 *   SetShotRateCommand  —— 变速
 *
 * 关键不变量：`durationUs` 与 `sourceDurationFrames / rate` 必须保持一致。
 * 时间轴显示的宽度、预览取帧、导出取帧三者都依赖它，任何一处漂移都会导致音画错位。
 */

import type { Command, CommandResult } from './base.ts'
import type { EditorDocument, ShotClipElement } from '../project.ts'
import { cloneDocument } from '../serialization.ts'

function recalculateDuration(doc: EditorDocument): number {
  let maxUs = 0
  for (const track of doc.tracks) {
    for (const elem of track.elements) {
      maxUs = Math.max(maxUs, elem.startUs + elem.durationUs)
    }
  }
  return maxUs
}

/** 按帧长与速率算出时间轴上的真实时长。 */
export function shotDurationUs(sourceDurationFrames: number, rate: number, fps: number): number {
  const safeRate = Math.max(0.25, Math.min(4, Number.isFinite(rate) ? rate : 1))
  return Math.round((sourceDurationFrames / safeRate / fps) * 1_000_000)
}

export type InsertShotInput = {
  trackId: string
  shotId: string
  presentation?: 'content'
  sourceDurationFrames: number
  /** 时间轴起点（微秒） */
  startUs: number
  rate?: number
  /** 画布尺寸，用于撑满元素框 */
  canvasWidth: number
  canvasHeight: number
  name?: string
  slots?: Record<string, string>
  overrides?: Record<string, string>
}

export class InsertShotCommand implements Command {
  readonly id: string
  readonly type = 'InsertShot'
  private readonly input: InsertShotInput
  private readonly fps: number
  private readonly elementId: string
  private inserted = false

  constructor(input: InsertShotInput, fps: number, id?: string) {
    this.input = input
    this.fps = fps
    this.elementId = `shot-${crypto.randomUUID()}`
    this.id = id ?? `cmd-insert-shot-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const track = doc.tracks.find((item) => item.id === this.input.trackId)
    if (!track) throw new Error(`未找到目标轨道: ${this.input.trackId}`)
    if (track.locked) throw new Error(`轨道已锁定，无法添加镜头: ${this.input.trackId}`)

    const rate = this.input.rate ?? 1
    const element: ShotClipElement = {
      id: this.elementId,
      trackId: track.id,
      type: 'shot',
      shotId: this.input.shotId,
      presentation: this.input.presentation,
      sourceDurationFrames: this.input.sourceDurationFrames,
      rate,
      startUs: Math.max(0, Math.round(this.input.startUs)),
      durationUs: shotDurationUs(this.input.sourceDurationFrames, rate, this.fps),
      slots: this.input.slots,
      overrides: this.input.overrides,
      transform: {
        x: 0,
        y: 0,
        width: this.input.canvasWidth,
        height: this.input.canvasHeight,
        rotationDeg: 0,
        opacity: 1,
        cropMode: 'cover',
        round: 0,
      },
    }

    track.elements.push(element)
    track.elements.sort((a, b) => a.startUs - b.startUs)
    doc.durationUs = Math.max(doc.durationUs, element.startUs + element.durationUs)
    this.inserted = true

    return { document: doc, selectionOverride: [element.id] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    for (const track of doc.tracks) {
      track.elements = track.elements.filter((elem) => elem.id !== this.elementId)
    }
    doc.durationUs = recalculateDuration(doc)
    this.inserted = false
    return { document: doc, selectionOverride: [] }
  }

  get element(): string {
    return this.inserted ? this.elementId : ''
  }
}

export type TrimShotInput = {
  startUs?: number
  durationUs?: number
}

export class TrimShotCommand implements Command {
  readonly id: string
  readonly type = 'TrimShot'
  private readonly elementId: string
  private readonly patch: TrimShotInput
  private previous?: { startUs: number; durationUs: number; sourceDurationFrames: number }
  private readonly fps: number

  constructor(elementId: string, patch: TrimShotInput, fps: number, id?: string) {
    this.elementId = elementId
    this.patch = patch
    this.fps = fps
    this.id = id ?? `cmd-trim-shot-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (!found) throw new Error(`未找到镜头元素: ${this.elementId}`)

    this.previous = {
      startUs: found.element.startUs,
      durationUs: found.element.durationUs,
      sourceDurationFrames: found.element.sourceDurationFrames,
    }

    if (typeof this.patch.startUs === 'number') {
      found.element.startUs = Math.max(0, Math.round(this.patch.startUs))
    }
    if (typeof this.patch.durationUs === 'number') {
      const nextDuration = Math.max(33_333, Math.round(this.patch.durationUs))
      found.element.durationUs = nextDuration
      // 时长变化反推源帧数，保持 rate 不变
      const frames = Math.max(1, Math.round((nextDuration / 1_000_000) * this.fps * found.element.rate))
      found.element.sourceDurationFrames = frames
    }

    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (found && this.previous) {
      found.element.startUs = this.previous.startUs
      found.element.durationUs = this.previous.durationUs
      found.element.sourceDurationFrames = this.previous.sourceDurationFrames
    }
    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }
}

export class SetShotRateCommand implements Command {
  readonly id: string
  readonly type = 'SetShotRate'
  private readonly elementId: string
  private readonly rate: number
  private previous?: { rate: number; durationUs: number }
  private readonly fps: number

  constructor(elementId: string, rate: number, fps: number, id?: string) {
    this.elementId = elementId
    this.rate = Math.max(0.25, Math.min(4, rate))
    this.fps = fps
    this.id = id ?? `cmd-shot-rate-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (!found) throw new Error(`未找到镜头元素: ${this.elementId}`)

    this.previous = { rate: found.element.rate, durationUs: found.element.durationUs }
    found.element.rate = this.rate
    found.element.durationUs = shotDurationUs(found.element.sourceDurationFrames, this.rate, this.fps)

    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (found && this.previous) {
      found.element.rate = this.previous.rate
      found.element.durationUs = this.previous.durationUs
    }
    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }
}

export type UpdateShotClipInput = {
  overrides?: Record<string, string>
  slots?: Record<string, string>
  rate?: number
  name?: string
  shotId?: string
  sourceDurationFrames?: number
}

export class UpdateShotClipCommand implements Command {
  readonly id: string
  readonly type = 'UpdateShotClip'
  private readonly elementId: string
  private readonly patch: UpdateShotClipInput
  private readonly fps: number
  private previous?: {
    overrides?: Record<string, string>
    slots?: Record<string, string>
    rate: number
    name?: string
    shotId: string
    sourceDurationFrames: number
    durationUs: number
  }

  constructor(elementId: string, patch: UpdateShotClipInput, fps: number, id?: string) {
    this.elementId = elementId
    this.patch = patch
    this.fps = fps
    this.id = id ?? `cmd-update-shot-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (!found) throw new Error(`未找到镜头元素: ${this.elementId}`)

    this.previous = {
      overrides: found.element.overrides ? { ...found.element.overrides } : undefined,
      slots: found.element.slots ? { ...found.element.slots } : undefined,
      rate: found.element.rate,
      name: (found.element as any).name,
      shotId: found.element.shotId,
      sourceDurationFrames: found.element.sourceDurationFrames,
      durationUs: found.element.durationUs,
    }

    if (this.patch.name !== undefined) {
      ;(found.element as any).name = this.patch.name
    }
    if (this.patch.shotId !== undefined) {
      found.element.shotId = this.patch.shotId
    }
    if (typeof this.patch.sourceDurationFrames === 'number') {
      found.element.sourceDurationFrames = Math.max(1, Math.round(this.patch.sourceDurationFrames))
    }
    if (typeof this.patch.rate === 'number') {
      found.element.rate = Math.max(0.25, Math.min(4, this.patch.rate))
      found.element.durationUs = shotDurationUs(found.element.sourceDurationFrames, found.element.rate, this.fps)
    }
    if (this.patch.overrides !== undefined) {
      found.element.overrides = {
        ...(found.element.overrides || {}),
        ...this.patch.overrides,
      }
    }
    if (this.patch.slots !== undefined) {
      found.element.slots = {
        ...(found.element.slots || {}),
        ...this.patch.slots,
      }
    }

    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const found = findShot(doc, this.elementId)
    if (found && this.previous) {
      found.element.overrides = this.previous.overrides ? { ...this.previous.overrides } : undefined
      found.element.slots = this.previous.slots ? { ...this.previous.slots } : undefined
      found.element.rate = this.previous.rate
      ;(found.element as any).name = this.previous.name
      found.element.shotId = this.previous.shotId
      found.element.sourceDurationFrames = this.previous.sourceDurationFrames
      found.element.durationUs = this.previous.durationUs
    }
    doc.durationUs = recalculateDuration(doc)
    return { document: doc, selectionOverride: [this.elementId] }
  }
}

function findShot(doc: EditorDocument, elementId: string) {
  for (const track of doc.tracks) {
    const element = track.elements.find((elem) => elem.id === elementId)
    if (element && element.type === 'shot') return { track, element }
  }
  return null
}
