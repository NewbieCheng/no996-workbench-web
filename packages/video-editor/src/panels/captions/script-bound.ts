/**
 * 文稿绑定字幕：按镜头落点或外部对齐结果生成 CaptionCue（非 ASR）。
 */

import type { CaptionCue, CaptionTimingSource } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

export type ScriptBoundSegment = {
  text: string
  startUs: TimeUs
  durationUs: TimeUs
  boundClipId?: string
}

const MIN_CUE_DURATION_US = 33_333

export function buildCaptionCuesFromSegments(
  segments: ScriptBoundSegment[],
  timingSource: CaptionTimingSource = 'estimated',
): CaptionCue[] {
  const cues: CaptionCue[] = []
  for (const seg of segments) {
    const text = seg.text.trim()
    if (!text) continue
    cues.push({
      id: `cue-${crypto.randomUUID()}`,
      startUs: Math.max(0, Math.round(seg.startUs)),
      durationUs: Math.max(MIN_CUE_DURATION_US, Math.round(seg.durationUs)),
      text,
      timingSource,
      boundClipId: seg.boundClipId,
    })
  }
  return cues
}

export type BeatCaptionInput = {
  segment: { text: string }
}

export type ShotTimelineSlice = {
  id: string
  startUs: TimeUs
  durationUs: TimeUs
}

/**
 * 与一键出片插入顺序一致：每个 beat 占一个镜头片段；无文案的转场 beat 只推进镜头索引。
 */
export function buildCaptionCuesFromBeats(
  beats: BeatCaptionInput[],
  shotElements: ShotTimelineSlice[],
): CaptionCue[] {
  const segments: ScriptBoundSegment[] = []
  let shotIdx = 0
  for (const beat of beats) {
    const element = shotElements[shotIdx]
    if (!element) break
    shotIdx += 1
    const text = beat.segment.text.trim()
    if (!text) continue
    segments.push({
      text,
      startUs: element.startUs,
      durationUs: element.durationUs,
      boundClipId: element.id,
    })
  }
  return buildCaptionCuesFromSegments(segments)
}
