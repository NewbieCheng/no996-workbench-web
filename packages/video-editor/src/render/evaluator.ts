/**
 * 关键帧属性插值与音频包络求值器
 */

import type { TimeUs } from '../core/time.ts'
import type {
  KeyframePoint,
  AnimationChannel,
  ElementAnimations,
  AudioClipElement,
  TransformBox,
} from '../core/project.ts'

export function evaluateEasing(progress: number, easing: KeyframePoint['easing']): number {
  const p = Math.max(0, Math.min(1, progress))
  switch (easing) {
    case 'linear':
      return p
    case 'easeIn':
      return p * p
    case 'easeOut':
      return p * (2 - p)
    case 'easeInOut':
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p
    case 'hold':
      return 0
    default:
      return p
  }
}

/**
 * 在局部时间求出指定通道插值后的数值
 */
export function evaluateChannelValue(
  channel: AnimationChannel<number> | undefined,
  localTimeUs: TimeUs,
  fallbackValue: number
): number {
  if (!channel || !channel.keyframes || channel.keyframes.length === 0) {
    return fallbackValue
  }

  const kfs = channel.keyframes

  // 若只有一个关键帧
  if (kfs.length === 1) {
    return Number(kfs[0].value)
  }

  // 早于首个关键帧
  if (localTimeUs <= kfs[0].timeUs) {
    return Number(kfs[0].value)
  }

  // 晚于末尾关键帧
  const lastKf = kfs[kfs.length - 1]
  if (localTimeUs >= lastKf.timeUs) {
    return Number(lastKf.value)
  }

  // 寻找所属区间
  for (let i = 0; i < kfs.length - 1; i++) {
    const kfA = kfs[i]
    const kfB = kfs[i + 1]

    if (localTimeUs >= kfA.timeUs && localTimeUs <= kfB.timeUs) {
      const spanUs = kfB.timeUs - kfA.timeUs
      if (spanUs === 0) return Number(kfB.value)

      const rawProgress = (localTimeUs - kfA.timeUs) / spanUs
      const curvedProgress = evaluateEasing(rawProgress, kfA.easing)
      const valA = Number(kfA.value)
      const valB = Number(kfB.value)

      return valA + (valB - valA) * curvedProgress
    }
  }

  return fallbackValue
}

/** 仅求值已有 transform.* 通道，不解释任意属性路径或执行表达式。 */
export function evaluateElementTransform(
  transform: TransformBox,
  animations: ElementAnimations | undefined,
  localTimeUs: TimeUs
): TransformBox {
  const result = { ...transform }
  const properties = ['x', 'y', 'width', 'height', 'rotationDeg', 'opacity'] as const
  for (const property of properties) {
    const channel = animations?.channels?.[`transform.${property}`] as AnimationChannel<number> | undefined
    const value = evaluateChannelValue(channel, localTimeUs, transform[property])
    if (Number.isFinite(value)) result[property] = value
  }
  result.width = Math.max(0, result.width)
  result.height = Math.max(0, result.height)
  result.opacity = Math.max(0, Math.min(1, result.opacity))
  return result
}

/**
 * 快速求出元素的动态透明度
 */
export function evaluateElementOpacity(
  animations: ElementAnimations | undefined,
  localTimeUs: TimeUs,
  staticOpacity: number
): number {
  const channel = animations?.channels?.['transform.opacity'] as AnimationChannel<number> | undefined
  return evaluateChannelValue(channel, localTimeUs, staticOpacity)
}

/**
 * 计算音频片段在 localTimeUs 下叠加 fade-in / fade-out 后的最终有效音量
 */
export function evaluateAudioGain(
  element: AudioClipElement,
  localTimeUs: TimeUs
): number {
  let baseVolume = element.volume ?? 1.0

  // 叠加关键帧音量（如果有）
  const volumeChannel = element.animations?.channels?.['volume'] as AnimationChannel<number> | undefined
  if (volumeChannel) {
    baseVolume = evaluateChannelValue(volumeChannel, localTimeUs, baseVolume)
  }

  // 淡入淡出计算
  let fadeGain = 1.0

  if (element.fadeInUs && element.fadeInUs > 0 && localTimeUs < element.fadeInUs) {
    fadeGain *= localTimeUs / element.fadeInUs
  }

  if (element.fadeOutUs && element.fadeOutUs > 0) {
    const remainingUs = element.durationUs - localTimeUs
    if (remainingUs < element.fadeOutUs && remainingUs > 0) {
      fadeGain *= remainingUs / element.fadeOutUs
    } else if (remainingUs <= 0) {
      fadeGain = 0
    }
  }

  return Math.max(0, Math.min(2.0, baseVolume * fadeGain))
}
