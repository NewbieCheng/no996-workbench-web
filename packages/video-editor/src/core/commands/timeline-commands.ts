/**
 * 核心时间轴与元素剪辑命令集
 * 包含：插入、移动、裁切、分割、删除（留隙/波纹）、变换与字幕更新
 */

import type { Command, CommandResult } from './base.ts'
import type {
  EditorDocument,
  TimelineTrack,
  TrackElement,
  VideoClipElement,
  AudioClipElement,
  TransformBox,
  CaptionCue,
  CaptionStyle,
  TextClipElement,
  TextStyle,
} from '../project.ts'
import type { TimeUs } from '../time.ts'
import { cloneDocument } from '../serialization.ts'
import { isMagneticShotStorylineTrack, resolveNoOverlapStart } from '../timeline/no-overlap.ts'
import { captionStyleToTransform } from '../../panels/captions/caption-geometry.ts'

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
 * 插入元素命令
 */
export class InsertElementCommand implements Command {
  readonly id: string
  readonly type = 'InsertElement'
  readonly trackId: string
  readonly element: TrackElement

  constructor(
    trackId: string,
    element: TrackElement,
    id?: string
  ) {
    this.trackId = trackId
    this.element = element
    this.id = id ?? `cmd-insert-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const track = doc.tracks.find((t) => t.id === this.trackId)
    if (!track) throw new Error(`未找到目标轨道: ${this.trackId}`)
    if (track.locked) throw new Error(`轨道已锁定，无法添加元素: ${this.trackId}`)

    // 检查元素是否已在轨道中
    if (track.elements.some((e) => e.id === this.element.id)) {
      throw new Error(`轨道中已存在相同 ID 元素: ${this.element.id}`)
    }

    track.elements.push(this.element)
    // 按时间顺序排列
    track.elements.sort((a, b) => a.startUs - b.startUs)
    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [this.element.id],
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    const track = doc.tracks.find((t) => t.id === this.trackId)
    if (track) {
      track.elements = track.elements.filter((e) => e.id !== this.element.id)
      doc.durationUs = recalculateDocumentDuration(doc)
    }
    return {
      document: doc,
      selectionOverride: [],
    }
  }
}

/**
 * 批量移动元素命令
 */
export class MoveElementsCommand implements Command {
  readonly id: string
  readonly type = 'MoveElements'
  readonly moves: Array<{ elementId: string; newStartUs: TimeUs }>
  private previousStarts = new Map<string, TimeUs>()

  constructor(
    moves: Array<{ elementId: string; newStartUs: TimeUs }>,
    id?: string
  ) {
    this.moves = moves
    this.id = id ?? `cmd-move-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousStarts.clear()

    const moveMap = new Map(this.moves.map((m) => [m.elementId, m.newStartUs]))

    for (const track of doc.tracks) {
      const skipOverlap = isMagneticShotStorylineTrack(track)
      for (const elem of track.elements) {
        if (moveMap.has(elem.id)) {
          if (track.locked) throw new Error(`轨道已锁定，禁止移动元素: ${elem.id}`)
          this.previousStarts.set(elem.id, elem.startUs)
          let nextStart = Math.max(0, moveMap.get(elem.id)!)
          if (!skipOverlap) {
            nextStart = resolveNoOverlapStart(track.elements, elem.id, nextStart, elem.durationUs)
          }
          elem.startUs = nextStart
        }
      }
      track.elements.sort((a, b) => a.startUs - b.startUs)
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: this.moves.map((m) => m.elementId),
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (this.previousStarts.has(elem.id)) {
          elem.startUs = this.previousStarts.get(elem.id)!
        }
      }
      track.elements.sort((a, b) => a.startUs - b.startUs)
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [...this.previousStarts.keys()],
    }
  }
}

/** 元素类型与目标轨道类型是否允许跨轨移动 */
export function canMoveElementToTrack(
  elementType: TrackElement['type'],
  targetTrackType: TimelineTrack['type'],
  shotId?: string,
): boolean {
  if (elementType === 'shot') {
    if (!shotId) return false
    // 故事线 / 图层镜头均可在 shot | video | overlay 间移动（与 canLandShotOnTrack 一致）
    return (
      targetTrackType === 'shot' ||
      targetTrackType === 'video' ||
      targetTrackType === 'overlay'
    )
  }
  if (elementType === 'text') return targetTrackType === 'text'
  if (elementType === 'audio') return targetTrackType === 'audio'
  if (elementType === 'video') return targetTrackType === 'video' || targetTrackType === 'overlay'
  if (elementType === 'image') return targetTrackType === 'video' || targetTrackType === 'overlay'
  return false
}

/**
 * 将元素从当前轨道移动到另一轨道（保持元素 id，更新 trackId 与 startUs）
 */
export class MoveElementToTrackCommand implements Command {
  readonly id: string
  readonly type = 'MoveElementToTrack'
  readonly elementId: string
  readonly targetTrackId: string
  readonly newStartUs: TimeUs
  private previous?: { trackId: string; startUs: TimeUs; index: number }

  constructor(elementId: string, targetTrackId: string, newStartUs: TimeUs, id?: string) {
    this.elementId = elementId
    this.targetTrackId = targetTrackId
    this.newStartUs = Math.max(0, Math.round(newStartUs))
    this.id = id ?? `cmd-move-track-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    let element: TrackElement | undefined
    let sourceTrack: TimelineTrack | undefined
    let sourceIndex = -1

    for (const track of doc.tracks) {
      const idx = track.elements.findIndex((e) => e.id === this.elementId)
      if (idx >= 0) {
        element = track.elements[idx]
        sourceTrack = track
        sourceIndex = idx
        break
      }
    }

    if (!element || !sourceTrack) throw new Error(`未找到元素: ${this.elementId}`)

    const targetTrack = doc.tracks.find((t) => t.id === this.targetTrackId)
    if (!targetTrack) throw new Error(`未找到目标轨道: ${this.targetTrackId}`)
    if (targetTrack.locked) throw new Error(`目标轨道已锁定: ${this.targetTrackId}`)
    if (sourceTrack.locked) throw new Error(`源轨道已锁定，禁止移动元素: ${this.elementId}`)
    const shotId = element.type === 'shot' ? element.shotId : undefined
    if (!canMoveElementToTrack(element.type, targetTrack.type, shotId)) {
      throw new Error(`不允许将 ${element.type} 移动到 ${targetTrack.type} 轨道`)
    }

    this.previous = {
      trackId: sourceTrack.id,
      startUs: element.startUs,
      index: sourceIndex,
    }

    sourceTrack.elements.splice(sourceIndex, 1)
    let landStart = this.newStartUs
    if (!isMagneticShotStorylineTrack(targetTrack)) {
      landStart = resolveNoOverlapStart(
        targetTrack.elements,
        this.elementId,
        this.newStartUs,
        element.durationUs,
      )
    }
    const moved = { ...element, trackId: targetTrack.id, startUs: landStart }
    targetTrack.elements.push(moved)
    targetTrack.elements.sort((a, b) => a.startUs - b.startUs)

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previous) return { document }
    const doc = cloneDocument(document)

    let element: TrackElement | undefined
    let currentTrack: TimelineTrack | undefined
    let currentIndex = -1

    for (const track of doc.tracks) {
      const idx = track.elements.findIndex((e) => e.id === this.elementId)
      if (idx >= 0) {
        element = track.elements[idx]
        currentTrack = track
        currentIndex = idx
        break
      }
    }

    if (!element || !currentTrack) return { document }

    currentTrack.elements.splice(currentIndex, 1)
    const restored = {
      ...element,
      trackId: this.previous.trackId,
      startUs: this.previous.startUs,
    }
    const sourceTrack = doc.tracks.find((t) => t.id === this.previous!.trackId)
    if (!sourceTrack) return { document }

    sourceTrack.elements.splice(this.previous.index, 0, restored)
    sourceTrack.elements.sort((a, b) => a.startUs - b.startUs)

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }
}

/**
 * 裁切元素命令
 */
export class TrimElementCommand implements Command {
  readonly id: string
  readonly type = 'TrimElement'
  readonly elementId: string
  readonly patch: {
    startUs?: TimeUs
    durationUs?: TimeUs
    sourceInUs?: TimeUs
    sourceOutUs?: TimeUs
  }
  private previousState?: {
    startUs: TimeUs
    durationUs: TimeUs
    sourceInUs?: TimeUs
    sourceOutUs?: TimeUs
  }

  constructor(
    elementId: string,
    patch: {
      startUs?: TimeUs
      durationUs?: TimeUs
      sourceInUs?: TimeUs
      sourceOutUs?: TimeUs
    },
    id?: string
  ) {
    this.elementId = elementId
    this.patch = patch
    this.id = id ?? `cmd-trim-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    let foundElem: TrackElement | undefined

    for (const track of doc.tracks) {
      const el = track.elements.find((e) => e.id === this.elementId)
      if (el) {
        if (track.locked) throw new Error(`轨道已锁定，无法裁切元素: ${this.elementId}`)
        foundElem = el
        break
      }
    }

    if (!foundElem) throw new Error(`未找到元素: ${this.elementId}`)

    this.previousState = {
      startUs: foundElem.startUs,
      durationUs: foundElem.durationUs,
      sourceInUs: 'sourceInUs' in foundElem ? foundElem.sourceInUs : undefined,
      sourceOutUs: 'sourceOutUs' in foundElem ? foundElem.sourceOutUs : undefined,
    }

    if (this.patch.startUs !== undefined) {
      foundElem.startUs = Math.max(0, this.patch.startUs)
    }
    if (this.patch.durationUs !== undefined) {
      foundElem.durationUs = Math.max(33333, this.patch.durationUs)
    }

    if ('sourceInUs' in foundElem && this.patch.sourceInUs !== undefined) {
      foundElem.sourceInUs = Math.max(0, this.patch.sourceInUs)
    }
    if ('sourceOutUs' in foundElem && this.patch.sourceOutUs !== undefined) {
      foundElem.sourceOutUs = Math.max(foundElem.sourceInUs + 1, this.patch.sourceOutUs)
    }

    for (const track of doc.tracks) {
      if (!track.elements.some((e) => e.id === this.elementId)) continue
      if (isMagneticShotStorylineTrack(track)) break
      const resolvedStart = resolveNoOverlapStart(
        track.elements,
        foundElem.id,
        foundElem.startUs,
        foundElem.durationUs,
      )
      if (resolvedStart !== foundElem.startUs) {
        // 起点被挤开时同步缩短时长，避免裁切把手越界叠片
        const delta = resolvedStart - foundElem.startUs
        if (delta > 0 && this.patch.startUs !== undefined) {
          foundElem.durationUs = Math.max(33333, foundElem.durationUs - delta)
        }
        foundElem.startUs = resolvedStart
      }
      // 若仍与右侧重叠，钳制 duration
      const endUs = foundElem.startUs + foundElem.durationUs
      for (const other of track.elements) {
        if (other.id === foundElem.id) continue
        if (other.startUs >= foundElem.startUs && other.startUs < endUs) {
          foundElem.durationUs = Math.max(33333, other.startUs - foundElem.startUs)
        }
      }
      break
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousState) return { document }
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const el = track.elements.find((e) => e.id === this.elementId)
      if (el) {
        el.startUs = this.previousState.startUs
        el.durationUs = this.previousState.durationUs
        if ('sourceInUs' in el && this.previousState.sourceInUs !== undefined) {
          el.sourceInUs = this.previousState.sourceInUs
        }
        if ('sourceOutUs' in el && this.previousState.sourceOutUs !== undefined) {
          el.sourceOutUs = this.previousState.sourceOutUs
        }
        break
      }
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }
}

/**
 * 分割元素命令（在指定 splitUs 点分为左、右两段连续片段）
 */
export class SplitElementCommand implements Command {
  readonly id: string
  readonly type = 'SplitElement'
  readonly rightElementId: string
  readonly elementId: string
  readonly splitUs: TimeUs

  constructor(
    elementId: string,
    splitUs: TimeUs, // 绝对工程时间
    rightId?: string,
    id?: string
  ) {
    this.elementId = elementId
    this.splitUs = splitUs
    this.id = id ?? `cmd-split-${crypto.randomUUID()}`
    this.rightElementId = rightId ?? `elem-split-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    let targetTrack = null
    let targetIndex = -1

    for (const track of doc.tracks) {
      const idx = track.elements.findIndex((e) => e.id === this.elementId)
      if (idx !== -1) {
        if (track.locked) throw new Error(`轨道已锁定，无法分割: ${this.elementId}`)
        targetTrack = track
        targetIndex = idx
        break
      }
    }

    if (!targetTrack || targetIndex === -1) {
      throw new Error(`未找到待分割元素: ${this.elementId}`)
    }

    const leftElem = targetTrack.elements[targetIndex]
    const leftEndUs = leftElem.startUs + leftElem.durationUs

    // 分割点必须严格在元素内部（两端至少预留 1 帧）
    const minFrameUs = 33333
    if (this.splitUs <= leftElem.startUs + minFrameUs || this.splitUs >= leftEndUs - minFrameUs) {
      throw new Error('分割点超出元素有效区间或导致产生零长度片段')
    }

    const leftDurationUs = this.splitUs - leftElem.startUs
    const rightDurationUs = leftElem.durationUs - leftDurationUs

    // 深克隆生成右片段
    const rightElem = JSON.parse(JSON.stringify(leftElem)) as TrackElement
    rightElem.id = this.rightElementId
    rightElem.startUs = this.splitUs
    rightElem.durationUs = rightDurationUs

    // 如果是音视频媒体，计算媒体源区间切分
    if (leftElem.type === 'video' || leftElem.type === 'audio') {
      const leftMedia = leftElem as VideoClipElement | AudioClipElement
      const rightMedia = rightElem as VideoClipElement | AudioClipElement
      const rate = leftMedia.rate || 1.0

      const leftSourceSpanUs = Math.round(leftDurationUs * rate)
      const oldSourceOutUs = leftMedia.sourceOutUs

      leftMedia.sourceOutUs = leftMedia.sourceInUs + leftSourceSpanUs
      rightMedia.sourceInUs = leftMedia.sourceOutUs
      rightMedia.sourceOutUs = oldSourceOutUs
    }

    leftElem.durationUs = leftDurationUs

    targetTrack.elements.splice(targetIndex + 1, 0, rightElem)

    return {
      document: doc,
      selectionOverride: [rightElem.id],
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const leftIdx = track.elements.findIndex((e) => e.id === this.elementId)
      const rightIdx = track.elements.findIndex((e) => e.id === this.rightElementId)

      if (leftIdx !== -1 && rightIdx !== -1) {
        const leftElem = track.elements[leftIdx]
        const rightElem = track.elements[rightIdx]

        // 恢复左元素完整时长与源范围
        leftElem.durationUs = leftElem.durationUs + rightElem.durationUs
        if ('sourceOutUs' in leftElem && 'sourceOutUs' in rightElem) {
          ;(leftElem as VideoClipElement).sourceOutUs = (rightElem as VideoClipElement).sourceOutUs
        }

        track.elements.splice(rightIdx, 1)
        break
      }
    }

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }
}

/**
 * 删除元素命令（支持 ripple 波纹前移）
 */
export class DeleteElementsCommand implements Command {
  readonly id: string
  readonly type = 'DeleteElements'
  readonly elementIds: string[]
  readonly ripple: boolean
  private deletedElements: Array<{ trackId: string; element: TrackElement; index: number }> = []
  private rippleShifts = new Map<string, TimeUs>()

  constructor(
    elementIds: string[],
    ripple = false,
    id?: string
  ) {
    this.elementIds = elementIds
    this.ripple = ripple
    this.id = id ?? `cmd-delete-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.deletedElements = []
    this.rippleShifts.clear()

    const targetSet = new Set(this.elementIds)

    for (const track of doc.tracks) {
      const toRemove: Array<{ elem: TrackElement; index: number }> = []

      track.elements.forEach((elem, index) => {
        if (targetSet.has(elem.id)) {
          if (track.locked) throw new Error(`轨道已锁定，无法删除元素: ${elem.id}`)
          toRemove.push({ elem, index })
        }
      })

      if (toRemove.length > 0) {
        // 记录删除的元素用于撤销
        for (const item of toRemove) {
          this.deletedElements.push({ trackId: track.id, element: item.elem, index: item.index })
        }

        // 剔除元素
        track.elements = track.elements.filter((e) => !targetSet.has(e.id))

        // 波纹删除：同轨道内位于被删除片段之后的元素向前靠拢
        if (this.ripple) {
          // 计算各区间平移量
          toRemove.sort((a, b) => b.elem.startUs - a.elem.startUs) // 从后往前计算
          for (const removed of toRemove) {
            const shiftUs = removed.elem.durationUs
            for (const elem of track.elements) {
              if (elem.startUs >= removed.elem.startUs) {
                const oldStart = elem.startUs
                elem.startUs = Math.max(0, elem.startUs - shiftUs)
                this.rippleShifts.set(elem.id, (this.rippleShifts.get(elem.id) ?? 0) + (oldStart - elem.startUs))
              }
            }
          }
        }
      }
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: [],
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)

    // 1. 恢复波纹平移
    if (this.ripple) {
      for (const track of doc.tracks) {
        for (const elem of track.elements) {
          if (this.rippleShifts.has(elem.id)) {
            elem.startUs += this.rippleShifts.get(elem.id)!
          }
        }
      }
    }

    // 2. 放回被删除元素
    for (const item of this.deletedElements) {
      const track = doc.tracks.find((t) => t.id === item.trackId)
      if (track) {
        track.elements.push(item.element)
        track.elements.sort((a, b) => a.startUs - b.startUs)
      }
    }

    doc.durationUs = recalculateDocumentDuration(doc)

    return {
      document: doc,
      selectionOverride: this.deletedElements.map((item) => item.element.id),
    }
  }
}

/**
 * 更新元素空间变换命令
 */
export class UpdateElementTransformCommand implements Command {
  readonly id: string
  readonly type = 'UpdateElementTransform'
  readonly elementId: string
  readonly patch: Partial<TransformBox>
  private previousTransform?: TransformBox

  constructor(
    elementId: string,
    patch: Partial<TransformBox>,
    id?: string
  ) {
    this.elementId = elementId
    this.patch = patch
    this.id = id ?? `cmd-transform-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    let targetElem = null

    for (const track of doc.tracks) {
      const el = track.elements.find((e) => e.id === this.elementId)
      if (el && 'transform' in el) {
        targetElem = el as VideoClipElement
        break
      }
    }

    if (!targetElem) throw new Error(`未找到支持空间变换的元素: ${this.elementId}`)

    this.previousTransform = { ...targetElem.transform }
    targetElem.transform = { ...targetElem.transform, ...this.patch }

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }

  undo(document: EditorDocument): CommandResult {
    if (!this.previousTransform) return { document }
    const doc = cloneDocument(document)

    for (const track of doc.tracks) {
      const el = track.elements.find((e) => e.id === this.elementId)
      if (el && 'transform' in el) {
        ;(el as VideoClipElement).transform = this.previousTransform
        break
      }
    }

    return {
      document: doc,
      selectionOverride: [this.elementId],
    }
  }
}

/**
 * 批量更新字幕序列与全局字幕样式命令
 */
export class UpdateCaptionsCommand implements Command {
  readonly id: string
  readonly type = 'UpdateCaptions'
  readonly newCaptions: CaptionCue[]
  readonly newStyle?: Partial<CaptionStyle>
  private previousCaptions: CaptionCue[] = []
  private previousStyle?: CaptionStyle

  constructor(
    newCaptions: CaptionCue[],
    newStyle?: Partial<CaptionStyle>,
    id?: string
  ) {
    this.newCaptions = newCaptions
    this.newStyle = newStyle
    this.id = id ?? `cmd-captions-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousCaptions = doc.captions ? [...doc.captions] : []
    this.previousStyle = doc.captionStyle ? { ...doc.captionStyle } : undefined

    doc.captions = [...this.newCaptions]
    if (this.newStyle && doc.captionStyle) {
      Object.assign(doc.captionStyle, this.newStyle)
      syncCaptionMarkerChrome(doc)
    }

    return {
      document: doc,
    }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    doc.captions = [...this.previousCaptions]
    if (this.previousStyle) {
      doc.captionStyle = { ...this.previousStyle }
      syncCaptionMarkerChrome(doc)
    }

    return {
      document: doc,
    }
  }
}

const CAPTION_SENTENCE_COMPONENT_ID = 'caption.sentence'

function isCaptionMarkerElement(elem: { type: string; id: string; component?: { componentId?: string } }): boolean {
  if (elem.type !== 'text') return false
  if (elem.id.startsWith('caption-clip:')) return true
  return elem.component?.componentId === CAPTION_SENTENCE_COMPONENT_ID
}

/** 将 marker 铬框对齐到 captionStyle（不参与烧录绘制） */
function syncCaptionMarkerChrome(doc: EditorDocument): void {
  const style = doc.captionStyle
  if (!style) return
  const transform = captionStyleToTransform(doc, style)
  for (const track of doc.tracks) {
    for (const elem of track.elements) {
      if (!isCaptionMarkerElement(elem)) continue
      const textElem = elem as TextClipElement
      textElem.transform = { ...textElem.transform, ...transform }
      textElem.style = {
        ...textElem.style,
        font: style.font ?? textElem.style.font,
        size: Math.min(28, style.size ?? 28),
        weight: style.weight ?? textElem.style.weight,
        color: style.color ?? textElem.style.color,
        backgroundColor: style.backgroundColor || 'transparent',
        outlineColor: style.outlineColor ?? textElem.style.outlineColor,
        outlineWidth: style.outlineWidth ?? 0,
        align: style.align ?? textElem.style.align,
        lineHeight: style.lineHeight ?? textElem.style.lineHeight,
        letterSpacing: style.letterSpacing ?? textElem.style.letterSpacing,
      }
    }
  }
}

/**
 * 仅更新全局 captionStyle（可撤销），并同步字幕 marker 铬框。
 * 不改写 CaptionCue 数组，避免「只调外观」污染文案撤销栈。
 */
export class UpdateCaptionStyleCommand implements Command {
  readonly id: string
  readonly type = 'UpdateCaptionStyle'
  readonly newStyle: Partial<CaptionStyle>
  private previousStyle?: CaptionStyle
  private previousChrome: Array<{ elementId: string; transform: TextClipElement['transform']; style: TextClipElement['style'] }> = []

  constructor(newStyle: Partial<CaptionStyle>, id?: string) {
    this.newStyle = newStyle
    this.id = id ?? `cmd-caption-style-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    this.previousStyle = doc.captionStyle ? { ...doc.captionStyle } : undefined
    this.previousChrome = []
    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        if (!isCaptionMarkerElement(elem)) continue
        const textElem = elem as TextClipElement
        this.previousChrome.push({
          elementId: textElem.id,
          transform: { ...textElem.transform },
          style: { ...textElem.style },
        })
      }
    }
    if (!doc.captionStyle) {
      doc.captionStyle = { ...this.newStyle } as CaptionStyle
    } else {
      Object.assign(doc.captionStyle, this.newStyle)
    }
    syncCaptionMarkerChrome(doc)
    return { document: doc }
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    if (this.previousStyle) {
      doc.captionStyle = { ...this.previousStyle }
    }
    const chromeMap = new Map(this.previousChrome.map((item) => [item.elementId, item]))
    for (const track of doc.tracks) {
      for (const elem of track.elements) {
        const prev = chromeMap.get(elem.id)
        if (!prev || elem.type !== 'text') continue
        const textElem = elem as TextClipElement
        textElem.transform = { ...prev.transform }
        textElem.style = { ...prev.style }
      }
    }
    return { document: doc }
  }
}

/**
 * 更新文本元素内容与排版样式命令
 */
export class UpdateTextClipCommand implements Command {
  readonly id: string
  readonly type = 'UpdateTextClip'
  readonly elementId: string
  readonly patch: { text?: string; style?: Partial<TextStyle> }
  private previousText?: string
  private previousStyle?: TextStyle

  constructor(
    elementId: string,
    patch: { text?: string; style?: Partial<TextStyle> },
    id?: string
  ) {
    this.elementId = elementId
    this.patch = patch
    this.id = id ?? `cmd-text-${crypto.randomUUID()}`
  }

  execute(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'text') {
        const textElem = elem as TextClipElement
        this.previousText = textElem.text
        this.previousStyle = { ...textElem.style }
        if (this.patch.text !== undefined) {
          textElem.text = this.patch.text
        }
        if (this.patch.style) {
          textElem.style = { ...textElem.style, ...this.patch.style }
        }
        return { document: doc }
      }
    }
    throw new Error(`未找到目标文本元素: ${this.elementId}`)
  }

  undo(document: EditorDocument): CommandResult {
    const doc = cloneDocument(document)
    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === this.elementId)
      if (elem && elem.type === 'text') {
        const textElem = elem as TextClipElement
        if (this.previousText !== undefined) {
          textElem.text = this.previousText
        }
        if (this.previousStyle !== undefined) {
          textElem.style = this.previousStyle
        }
        return { document: doc }
      }
    }
    return { document: doc }
  }
}

