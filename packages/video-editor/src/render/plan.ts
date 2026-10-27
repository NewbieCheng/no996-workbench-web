/**
 * 统一渲染计划与场景时空切片（RenderPlan & SceneSnapshot）
 */

import type { EditorDocument, TrackElement, CaptionCue, CaptionStyle } from '../core/project.ts'
import type { TimeUs } from '../core/time.ts'
import { timeSpanContains } from '../core/time.ts'

export type RenderableVisualItem = {
  element: TrackElement
  localTimeUs: TimeUs // 元素内部局部时间
  zIndex: number
}

export type SceneSnapshot = {
  timeUs: TimeUs
  canvasWidth: number
  canvasHeight: number
  backgroundColor: string
  items: RenderableVisualItem[]
  activeCaption?: CaptionCue
  /** 可选以兼容手工构造的历史 Scene；供滚动窗口读取相邻字幕。 */
  captions?: CaptionCue[]
  captionStyle: CaptionStyle
}

export type AudioRenderItem = {
  element: TrackElement
  localTimeUs: TimeUs
  volume: number
  muted: boolean
}

export type AudioSnapshot = {
  timeUs: TimeUs
  activeAudioItems: AudioRenderItem[]
}

export type RenderPlan = {
  documentId: string
  durationUs: TimeUs
  canvasWidth: number
  canvasHeight: number
  backgroundColor: string
  tracks: EditorDocument['tracks']
  captions: CaptionCue[]
  captionStyle: CaptionStyle
}

export function buildRenderPlan(doc: EditorDocument): RenderPlan {
  return {
    documentId: doc.id,
    durationUs: doc.durationUs,
    canvasWidth: doc.canvas.width,
    canvasHeight: doc.canvas.height,
    backgroundColor: doc.canvas.backgroundColor,
    tracks: doc.tracks,
    captions: doc.captions,
    captionStyle: doc.captionStyle,
  }
}

/**
 * 确定性地求出任意时间点的画面场景快照
 */
export function sceneAtTime(plan: RenderPlan, timeUs: TimeUs): SceneSnapshot {
  const items: RenderableVisualItem[] = []
  let zIndex = 0

  // 严格自底向上遍历非静音、非隐藏轨道
  for (const track of plan.tracks) {
    if (track.hidden) continue

    for (const elem of track.elements) {
      if (elem.type === 'audio') continue // 纯音频不参与画面合成

      const span = { startUs: elem.startUs, durationUs: elem.durationUs }
      if (timeSpanContains(span, timeUs)) {
        const localTimeUs = timeUs - elem.startUs
        items.push({
          element: elem,
          localTimeUs,
          zIndex: zIndex++,
        })
      }
    }
  }

  // 查找当前时刻命中的字幕
  const activeCaption = plan.captions.find((cue) =>
    timeSpanContains({ startUs: cue.startUs, durationUs: cue.durationUs }, timeUs)
  )

  return {
    timeUs,
    canvasWidth: plan.canvasWidth,
    canvasHeight: plan.canvasHeight,
    backgroundColor: plan.backgroundColor,
    items,
    activeCaption,
    captions: plan.captions,
    captionStyle: plan.captionStyle,
  }
}

/**
 * 确定性地求出任意时间点的音频混音快照
 */
export function audioAtTime(plan: RenderPlan, timeUs: TimeUs): AudioSnapshot {
  const activeAudioItems: AudioRenderItem[] = []

  for (const track of plan.tracks) {
    for (const elem of track.elements) {
      if (elem.type !== 'audio' && elem.type !== 'video') continue

      const span = { startUs: elem.startUs, durationUs: elem.durationUs }
      if (timeSpanContains(span, timeUs)) {
        const localTimeUs = timeUs - elem.startUs
        let volume = elem.volume
        if (track.muted) {
          volume = 0
        }
        activeAudioItems.push({
          element: elem,
          localTimeUs,
          volume,
          muted: track.muted,
        })
      }
    }
  }

  return {
    timeUs,
    activeAudioItems,
  }
}
