/**
 * 工程数据模型运行时校验器与限额规则
 */

import { ONE_SECOND_US } from './time.ts'
import {
  CURRENT_DOCUMENT_SCHEMA_VERSION,
  type EditorDocument,
  type TrackElement,
  type VideoClipElement,
  type AudioClipElement,
} from './project.ts'

export const EDITOR_LIMITS = {
  maxDurationUs: 300 * ONE_SECOND_US, // 最大 5 分钟
  minElementDurationUs: Math.round(ONE_SECOND_US / 30), // 最短 1 帧 (约 33333 微秒)
  maxTracks: 20,
  maxElementsPerTrack: 100,
  maxCaptions: 2000,
  maxAssets: 100,
  maxTransitions: 100,
} as const

export class DocumentValidationError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'DocumentValidationError'
    this.code = code
  }
}

export function validateEditorDocument(doc: unknown): asserts doc is EditorDocument {
  if (!doc || typeof doc !== 'object') {
    throw new DocumentValidationError('INVALID_ROOT', '工程数据必须是一个非空对象')
  }

  const d = doc as Record<string, unknown>

  if (d.schemaVersion !== CURRENT_DOCUMENT_SCHEMA_VERSION) {
    throw new DocumentValidationError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `不支持的工程版本: ${d.schemaVersion}，当前受支持版本为: ${CURRENT_DOCUMENT_SCHEMA_VERSION}`
    )
  }

  if (typeof d.id !== 'string' || !d.id.trim()) {
    throw new DocumentValidationError('INVALID_ID', '工程 ID 不能为空')
  }

  if (typeof d.name !== 'string') {
    throw new DocumentValidationError('INVALID_NAME', '工程名称必须是字符串')
  }

  if (!Number.isSafeInteger(d.revision) || (d.revision as number) < 1) {
    throw new DocumentValidationError('INVALID_REVISION', '工程版本号 revision 必须是大于等于 1 的安全整数')
  }

  if (!d.canvas || typeof d.canvas !== 'object') {
    throw new DocumentValidationError('INVALID_CANVAS', '工程缺少合法的画布设定')
  }

  const canvas = d.canvas as Record<string, unknown>
  if (typeof canvas.width !== 'number' || canvas.width < 100 || typeof canvas.height !== 'number' || canvas.height < 100) {
    throw new DocumentValidationError('INVALID_CANVAS_SIZE', '画布宽高必须大于等于 100 像素')
  }

  if (!Array.isArray(d.tracks)) {
    throw new DocumentValidationError('INVALID_TRACKS', 'tracks 必须是一个数组')
  }

  if (d.tracks.length > EDITOR_LIMITS.maxTracks) {
    throw new DocumentValidationError('TRACKS_OVERFLOW', `轨道总数超限，最多允许 ${EDITOR_LIMITS.maxTracks} 条`)
  }

  // 校验每个轨道及其内部元素
  const elementIdSet = new Set<string>()

  for (const track of d.tracks) {
    if (!track || typeof track !== 'object') {
      throw new DocumentValidationError('INVALID_TRACK', '轨道结构非法')
    }
    const t = track as Record<string, unknown>
    if (!['video', 'audio', 'overlay', 'text', 'shot'].includes(t.type as string)) {
      throw new DocumentValidationError('INVALID_TRACK_TYPE', `未知的轨道类型: ${t.type}`)
    }
    if (!Array.isArray(t.elements)) {
      throw new DocumentValidationError('INVALID_TRACK_ELEMENTS', '轨道中的 elements 必须为数组')
    }
    if (t.elements.length > EDITOR_LIMITS.maxElementsPerTrack) {
      throw new DocumentValidationError('TRACK_ELEMENTS_OVERFLOW', `单轨道元素数超限`)
    }

    for (const elem of t.elements) {
      validateTrackElement(elem as TrackElement, elementIdSet)
    }
  }

  // 校验字幕
  if (!Array.isArray(d.captions)) {
    throw new DocumentValidationError('INVALID_CAPTIONS', 'captions 必须为数组')
  }
  if (d.captions.length > EDITOR_LIMITS.maxCaptions) {
    throw new DocumentValidationError('CAPTIONS_OVERFLOW', `字幕数量超限`)
  }

  for (const cue of d.captions) {
    if (!cue || typeof cue !== 'object') {
      throw new DocumentValidationError('INVALID_CAPTION_CUE', '字幕条目非法')
    }
    const c = cue as Record<string, unknown>
    if (typeof c.text !== 'string') {
      throw new DocumentValidationError('INVALID_CAPTION_TEXT', '字幕文本必须为字符串')
    }
    if (!Number.isSafeInteger(c.startUs) || (c.startUs as number) < 0) {
      throw new DocumentValidationError('INVALID_CAPTION_START', '字幕开始时间 startUs 必须是非负整数微秒')
    }
    if (!Number.isSafeInteger(c.durationUs) || (c.durationUs as number) <= 0) {
      throw new DocumentValidationError('INVALID_CAPTION_DURATION', '字幕持续时间 durationUs 必须大于 0')
    }
  }
}

function validateTrackElement(elem: TrackElement, seenIds: Set<string>): void {
  if (!elem || typeof elem !== 'object') {
    throw new DocumentValidationError('INVALID_ELEMENT', '元素必须是非空对象')
  }

  if (typeof elem.id !== 'string' || !elem.id.trim()) {
    throw new DocumentValidationError('INVALID_ELEMENT_ID', '元素缺少唯一 ID')
  }

  if (seenIds.has(elem.id)) {
    throw new DocumentValidationError('DUPLICATE_ELEMENT_ID', `检测到重复的元素 ID: ${elem.id}`)
  }
  seenIds.add(elem.id)

  if (!Number.isSafeInteger(elem.startUs) || elem.startUs < 0) {
    throw new DocumentValidationError('INVALID_START_US', `元素 ${elem.id} 的 startUs 必须是非负整数微秒`)
  }

  if (!Number.isSafeInteger(elem.durationUs) || elem.durationUs < EDITOR_LIMITS.minElementDurationUs) {
    throw new DocumentValidationError(
      'INVALID_DURATION_US',
      `元素 ${elem.id} 持续时间过短，至少为 ${EDITOR_LIMITS.minElementDurationUs} 微秒`
    )
  }

  if (elem.type === 'video' || elem.type === 'audio') {
    const mediaElem = elem as VideoClipElement | AudioClipElement
    if (!mediaElem.assetId) {
      throw new DocumentValidationError('MISSING_ASSET_ID', `音视频元素 ${elem.id} 缺少 assetId 引用`)
    }
    if (mediaElem.sourceOutUs <= mediaElem.sourceInUs) {
      throw new DocumentValidationError('INVALID_SOURCE_RANGE', `元素 ${elem.id} 媒体源截取区间非法`)
    }
  }

  if (elem.type === 'shot') {
    const shot = elem as { shotId?: unknown; sourceDurationFrames?: unknown; rate?: unknown }
    if (typeof shot.shotId !== 'string' || !shot.shotId.trim()) {
      throw new DocumentValidationError('MISSING_SHOT_ID', `镜头元素 ${elem.id} 缺少 shotId`)
    }
    if (typeof shot.sourceDurationFrames !== 'number' || shot.sourceDurationFrames <= 0) {
      throw new DocumentValidationError(
        'INVALID_SHOT_DURATION',
        `镜头元素 ${elem.id} 的 sourceDurationFrames 必须是正数`,
      )
    }
    const rate = shot.rate
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0.25 || rate > 4) {
      throw new DocumentValidationError('INVALID_SHOT_RATE', `镜头元素 ${elem.id} 的 rate 必须在 0.25–4 之间`)
    }
  }
}
