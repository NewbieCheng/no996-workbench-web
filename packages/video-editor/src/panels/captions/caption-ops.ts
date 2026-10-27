/**
 * 字幕编辑操作纯函数（预设已迁至 caption-presets.ts）
 * 涵盖：批量平移、拆合、校时、源映射与估算标志守卫
 */

import type { CaptionCue } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

export {
  CAPTION_PRESETS,
  TALK_CAPTION_PRESETS,
  matchingCaptionPreset,
  matchingTalkPreset,
  type CaptionPreset,
  type TalkCaptionPreset,
} from './caption-presets.ts'

/**
 * 批量平移字幕微秒时间（保证不产生负时间）
 */
export function shiftCaptions(cues: CaptionCue[], deltaUs: TimeUs): CaptionCue[] {
  if (deltaUs === 0) return cues

  // 计算最大允许负平移
  let effectiveDelta = deltaUs
  if (deltaUs < 0) {
    const minStart = Math.min(...cues.map((c) => c.startUs))
    if (minStart + deltaUs < 0) {
      effectiveDelta = -minStart
    }
  }

  return cues.map((cue) => ({
    ...cue,
    startUs: Math.max(0, cue.startUs + effectiveDelta),
  }))
}

/**
 * 拆分指定字幕
 * 严格断言：若原字幕是 estimated，拆分产生的新字幕必须保留 estimated 标志！
 */
export function splitCaptionAt(
  cues: CaptionCue[],
  cueId: string,
  splitUs: TimeUs,
  splitCharIndex?: number
): CaptionCue[] {
  const targetIdx = cues.findIndex((c) => c.id === cueId)
  if (targetIdx === -1) return cues

  const cue = cues[targetIdx]
  const cueEndUs = cue.startUs + cue.durationUs

  // 必须在有效范围内
  if (splitUs <= cue.startUs || splitUs >= cueEndUs) return cues

  const leftDuration = splitUs - cue.startUs
  const rightDuration = cueEndUs - splitUs

  let leftText = cue.text
  let rightText = ''

  if (typeof splitCharIndex === 'number' && splitCharIndex > 0 && splitCharIndex < cue.text.length) {
    leftText = cue.text.slice(0, splitCharIndex).trim()
    rightText = cue.text.slice(splitCharIndex).trim()
  } else {
    // 默认按时间比例切分字符
    const ratio = leftDuration / cue.durationUs
    const splitIndex = Math.max(1, Math.min(cue.text.length - 1, Math.round(cue.text.length * ratio)))
    leftText = cue.text.slice(0, splitIndex).trim()
    rightText = cue.text.slice(splitIndex).trim()
  }

  const leftCue: CaptionCue = {
    ...cue,
    durationUs: leftDuration,
    text: leftText,
    timingSource: cue.timingSource, // 显式继承原始来源
  }

  const rightCue: CaptionCue = {
    ...cue,
    id: `cue-${crypto.randomUUID()}`,
    startUs: splitUs,
    durationUs: rightDuration,
    text: rightText,
    timingSource: cue.timingSource, // 显式继承原始来源，不得擦除 estimated
  }

  const newCues = [...cues]
  newCues.splice(targetIdx, 1, leftCue, rightCue)
  return newCues
}

/**
 * 合并两句相邻字幕
 */
export function mergeCaptions(
  cues: CaptionCue[],
  firstCueId: string,
  secondCueId: string
): CaptionCue[] {
  const firstIdx = cues.findIndex((c) => c.id === firstCueId)
  const secondIdx = cues.findIndex((c) => c.id === secondCueId)
  if (firstIdx === -1 || secondIdx === -1) return cues

  const c1 = cues[firstIdx]
  const c2 = cues[secondIdx]

  const newStartUs = Math.min(c1.startUs, c2.startUs)
  const newEndUs = Math.max(c1.startUs + c1.durationUs, c2.startUs + c2.durationUs)
  const mergedText = `${c1.text} ${c2.text}`.trim()

  // 若其中任一是 estimated，合并后仍标记为 estimated
  const timingSource = c1.timingSource === 'estimated' || c2.timingSource === 'estimated' ? 'estimated' : c1.timingSource

  const mergedCue: CaptionCue = {
    ...c1,
    startUs: newStartUs,
    durationUs: newEndUs - newStartUs,
    text: mergedText,
    timingSource,
  }

  return cues.filter((c) => c.id !== firstCueId && c.id !== secondCueId).concat(mergedCue).sort((a, b) => a.startUs - b.startUs)
}

/**
 * 片段裁切后的字幕源映射更新
 */
export function remapCaptionsAfterClipTrim(
  cues: CaptionCue[],
  clipId: string,
  trimDeltaUs: TimeUs
): CaptionCue[] {
  return cues.map((cue) => {
    if (cue.boundClipId === clipId) {
      return {
        ...cue,
        startUs: Math.max(0, cue.startUs - trimDeltaUs),
      }
    }
    return cue
  })
}
