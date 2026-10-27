/**
 * 键盘/数值微调纯函数
 * 替代拖拽进行精准微秒级移动，确保无负时间、无锁定轨位移
 */

import type { TimelineTrack, TrackElement } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

export type ElementNudgeMove = {
  elementId: string
  oldStartUs: TimeUs
  newStartUs: TimeUs
}

/**
 * 计算选定元素的微调移动
 */
export function computeNudgeMoves(
  elementIds: string[],
  deltaUs: TimeUs,
  tracks: TimelineTrack[]
): ElementNudgeMove[] {
  if (elementIds.length === 0 || deltaUs === 0) return []

  const targetSet = new Set(elementIds)
  const movableElements: TrackElement[] = []

  // 1. 筛选出不在锁定轨上的目标元素
  for (const track of tracks) {
    if (track.locked) continue
    for (const elem of track.elements) {
      if (targetSet.has(elem.id)) {
        movableElements.push(elem)
      }
    }
  }

  if (movableElements.length === 0) return []

  // 2. 检查负时间边界：如果向左移动，不能让任何元素的新 startUs < 0
  let effectiveDeltaUs = deltaUs
  if (deltaUs < 0) {
    const minStartUs = Math.min(...movableElements.map((e) => e.startUs))
    if (minStartUs + deltaUs < 0) {
      // 截断到允许移动的最大负位移
      effectiveDeltaUs = -minStartUs
    }
  }

  // 3. 产出位移映射
  return movableElements.map((elem) => ({
    elementId: elem.id,
    oldStartUs: elem.startUs,
    newStartUs: Math.max(0, elem.startUs + effectiveDeltaUs),
  }))
}
