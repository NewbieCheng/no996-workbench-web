/**
 * 磁吸对齐纯算法计算器
 * 将屏幕像素阈值（如 8 像素）精确转换为微秒阈值，计算最近吸附点。
 */

import type { TimeUs } from '../../core/time.ts'
import type { TimelineTrack } from '../../core/project.ts'
import { pixelsToTimeUs } from './zoom-scale.ts'

export type SnapResult = {
  snappedTimeUs: TimeUs
  hasSnapped: boolean
  snapPointUs?: TimeUs
}

/**
 * 收集时间轴上可作为吸附对齐参考的时间点（片段首尾边界与当前播放头）
 */
export function collectSnapReferencePoints(
  tracks: TimelineTrack[],
  playheadUs?: TimeUs,
  excludeElementIds: string[] = []
): TimeUs[] {
  const points = new Set<TimeUs>()
  if (playheadUs !== undefined && playheadUs >= 0) {
    points.add(playheadUs)
  }
  points.add(0)

  const excludeSet = new Set(excludeElementIds)

  for (const track of tracks) {
    for (const elem of track.elements) {
      if (excludeSet.has(elem.id)) continue
      points.add(elem.startUs)
      points.add(elem.startUs + elem.durationUs)
    }
  }

  return Array.from(points).sort((a, b) => a - b)
}

/**
 * 解析吸附结果
 */
export function resolveSnapping(
  targetTimeUs: TimeUs,
  referencePoints: TimeUs[],
  zoom = 1.0,
  thresholdPixels = 8
): SnapResult {
  const thresholdUs = pixelsToTimeUs(thresholdPixels, zoom)
  let closestDistance = thresholdUs + 1
  let closestPoint: TimeUs | undefined

  for (const ref of referencePoints) {
    const dist = Math.abs(ref - targetTimeUs)
    if (dist <= thresholdUs && dist < closestDistance) {
      closestDistance = dist
      closestPoint = ref
    }
  }

  if (closestPoint !== undefined) {
    return {
      snappedTimeUs: closestPoint,
      hasSnapped: true,
      snapPointUs: closestPoint,
    }
  }

  return {
    snappedTimeUs: targetTimeUs,
    hasSnapped: false,
  }
}

/**
 * 把外部提供的吸附点（例如音乐节拍网格）并入参考点。
 *
 * 单独抽出来而不是让面板 import 宿主的 beat-detect：
 * 编辑器包不该反向依赖业务代码。宿主算出节拍后把数组传进来即可。
 *
 * 抽稀理由：一首 3 分钟 120BPM 的歌有 360 个拍点，长片里还会更多；
 * 吸附要对每个候选点求距离，点太多会拖慢拖动。
 */
export function mergeExternalSnapPoints(
  referencePoints: TimeUs[],
  extraPoints: TimeUs[] | undefined,
  maxPoints = 4000,
): TimeUs[] {
  if (!extraPoints?.length) return referencePoints
  const step = Math.max(1, Math.ceil(extraPoints.length / maxPoints))
  const merged = new Set<TimeUs>(referencePoints)
  for (let i = 0; i < extraPoints.length; i += step) merged.add(extraPoints[i])
  return Array.from(merged).sort((a, b) => a - b)
}
