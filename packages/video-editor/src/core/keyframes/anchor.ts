/**
 * 关键帧锚点调整规则纯函数（裁切、移动、复制时关键帧时域更新）
 */

import type { KeyframePoint, AnimationChannel, ElementAnimations } from '../project.ts'
import type { TimeUs } from '../time.ts'

/**
 * 当片段左端被裁切（源起点前移 trimLeftUs），调整关键帧局部微秒时间
 */
export function adjustKeyframesOnTrimLeft<T = number | string>(
  channel: AnimationChannel<T>,
  trimLeftUs: TimeUs
): AnimationChannel<T> {
  if (trimLeftUs === 0 || channel.keyframes.length === 0) return channel

  const newKeyframes: Array<KeyframePoint<T>> = []

  for (const kf of channel.keyframes) {
    const shiftedTimeUs = kf.timeUs - trimLeftUs
    if (shiftedTimeUs >= 0) {
      newKeyframes.push({
        ...kf,
        timeUs: shiftedTimeUs,
      })
    }
  }

  // 如果原本在左侧有关键帧被完全裁掉，确保在 0 时刻有一个起点帧（取最接近左侧的值）
  if (newKeyframes.length > 0 && newKeyframes[0].timeUs > 0) {
    const leftOrphans = channel.keyframes.filter((k) => k.timeUs < trimLeftUs)
    if (leftOrphans.length > 0) {
      const lastOrphan = leftOrphans[leftOrphans.length - 1]
      newKeyframes.unshift({
        id: `kf-anchor-${crypto.randomUUID()}`,
        timeUs: 0,
        value: lastOrphan.value,
        easing: 'linear',
      })
    }
  }

  return {
    ...channel,
    keyframes: newKeyframes,
  }
}

/**
 * 当片段右端被裁切（新时长为 newDurationUs），丢弃超出新时长的关键帧
 */
export function adjustKeyframesOnTrimRight<T = number | string>(
  channel: AnimationChannel<T>,
  newDurationUs: TimeUs
): AnimationChannel<T> {
  const filtered = channel.keyframes.filter((kf) => kf.timeUs <= newDurationUs)
  return {
    ...channel,
    keyframes: filtered,
  }
}

/**
 * 深度复制关键帧动画通道
 */
export function cloneElementAnimations(
  animations?: ElementAnimations
): ElementAnimations | undefined {
  if (!animations) return undefined
  return JSON.parse(JSON.stringify(animations))
}
