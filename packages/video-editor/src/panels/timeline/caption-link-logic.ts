/**
 * 字幕联动与转场边界纯函数
 * 规则脱离 UI 回调，可独立进行单测断言
 */

import type { CaptionCue, TrackElement } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'
import { captionClipIdForCue } from '../captions/sync-text-track.ts'

export type ClipShift = {
  clipId: string
  deltaUs: TimeUs
}

/**
 * 当绑定的主视频/音频片段发生平移时，联动更新字幕 Cue 的时间
 */
export function updateLinkedCaptions(
  captions: CaptionCue[],
  shifts: ClipShift[]
): CaptionCue[] {
  if (captions.length === 0 || shifts.length === 0) return captions

  const shiftMap = new Map(shifts.map((s) => [s.clipId, s.deltaUs]))

  return captions.map((cue) => {
    if (cue.boundClipId && shiftMap.has(cue.boundClipId)) {
      const delta = shiftMap.get(cue.boundClipId)!
      const newStartUs = Math.max(0, cue.startUs + delta)
      return {
        ...cue,
        startUs: newStartUs,
      }
    }
    return cue
  })
}

/**
 * 配音/主片段平移后，字幕文字轨上对应 clip 的 Move 列表（与 updateLinkedCaptions 同步）。
 */
export function linkedCaptionTextClipMoves(
  captions: CaptionCue[],
  shifts: ClipShift[],
): Array<{ elementId: string; newStartUs: TimeUs }> {
  const next = updateLinkedCaptions(captions, shifts)
  const prevById = new Map(captions.map((c) => [c.id, c]))
  const moves: Array<{ elementId: string; newStartUs: TimeUs }> = []
  for (const cue of next) {
    const prev = prevById.get(cue.id)
    if (!prev || prev.startUs === cue.startUs) continue
    moves.push({ elementId: captionClipIdForCue(cue.id), newStartUs: cue.startUs })
  }
  return moves
}

/**
 * 当主片段在 splitUs 处被分割时，拆分与其关联的跨越分割点的字幕 Cue
 */
export function splitLinkedCaptions(
  captions: CaptionCue[],
  splitClipId: string,
  splitUs: TimeUs,
  newRightClipId: string
): CaptionCue[] {
  const result: CaptionCue[] = []

  for (const cue of captions) {
    if (cue.boundClipId === splitClipId) {
      const cueEndUs = cue.startUs + cue.durationUs
      if (splitUs > cue.startUs && splitUs < cueEndUs) {
        // 拆分为两个 Cue
        const leftDuration = splitUs - cue.startUs
        const rightDuration = cueEndUs - splitUs

        result.push({
          ...cue,
          durationUs: leftDuration,
        })
        result.push({
          ...cue,
          id: `cue-split-${crypto.randomUUID()}`,
          startUs: splitUs,
          durationUs: rightDuration,
          boundClipId: newRightClipId,
        })
      } else if (cue.startUs >= splitUs) {
        // 在分割点之后，重新绑定到右侧新 clip
        result.push({
          ...cue,
          boundClipId: newRightClipId,
        })
      } else {
        result.push(cue)
      }
    } else {
      result.push(cue)
    }
  }

  return result
}

export type TransitionCandidate = {
  id: string
  durationUs: TimeUs
  leftClipId: string
  rightClipId: string
}

/**
 * 校验转场边界与相邻约束
 */
export function validateTransitionBoundaries(
  transition: TransitionCandidate,
  leftClip?: TrackElement,
  rightClip?: TrackElement
): { valid: boolean; reason?: string } {
  if (!leftClip || !rightClip) {
    return { valid: false, reason: '转场缺少相邻片段' }
  }

  const leftEndUs = leftClip.startUs + leftClip.durationUs
  // 必须相邻（相差不超过 1 帧 33ms）
  if (Math.abs(leftEndUs - rightClip.startUs) > 33_333) {
    return { valid: false, reason: '转场关联的两个片段未在时间轴紧邻' }
  }

  // 转场时长不能大于任意一边片段的总时长
  if (transition.durationUs > leftClip.durationUs || transition.durationUs > rightClip.durationUs) {
    return { valid: false, reason: '转场时长超过相连片段的自身时长上限' }
  }

  return { valid: true }
}
