/**
 * 变速、反放与冻结帧源时域映射纯函数
 */

import type { TimeUs } from '../time.ts'
import type { VideoClipElement, AudioClipElement } from '../project.ts'

export type PlayableMediaClip = VideoClipElement | AudioClipElement

/**
 * 将局部播放微秒时间映射为实际源素材微秒时间戳
 */
export function mapPlaybackToSourceTimeUs(
  clip: PlayableMediaClip,
  localTimeUs: TimeUs
): TimeUs {
  // 1. 冻结帧：锁定在固定源时间
  if (clip.freeze) {
    return clip.freeze.sourceTimeUs
  }

  const rate = Math.max(0.1, Math.min(10.0, clip.rate || 1.0))

  // 2. 反放（逆序播放）：从 sourceOutUs 向 sourceInUs 倒退
  if (clip.reverse) {
    const elapsedSourceUs = Math.round(localTimeUs * rate)
    const targetSourceUs = clip.sourceOutUs - elapsedSourceUs
    return Math.max(clip.sourceInUs, Math.min(clip.sourceOutUs, targetSourceUs))
  }

  // 3. 正向恒定倍率播放
  const elapsedSourceUs = Math.round(localTimeUs * rate)
  const targetSourceUs = clip.sourceInUs + elapsedSourceUs
  return Math.max(clip.sourceInUs, Math.min(clip.sourceOutUs, targetSourceUs))
}

/**
 * 根据源素材区间与速率计算工程轨道上的实际占用时长
 */
export function computeDurationFromRate(
  sourceInUs: TimeUs,
  sourceOutUs: TimeUs,
  rate: number
): TimeUs {
  const span = Math.max(0, sourceOutUs - sourceInUs)
  const safeRate = Math.max(0.1, Math.min(10.0, rate))
  return Math.max(33333, Math.round(span / safeRate))
}
