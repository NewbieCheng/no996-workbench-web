/**
 * 时间轴框选与分组选择纯算法
 * 断言守卫：锁定轨上的元素绝不被框选或批量选择
 */

import type { TimelineTrack } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

export type SelectionRange = {
  startUs: TimeUs
  endUs: TimeUs
  trackIds?: string[] // 若为空则匹配所有未锁定轨道
}

/**
 * 计算框选命中的元素 ID 列表
 */
export function computeBoxSelection(
  range: SelectionRange,
  tracks: TimelineTrack[],
  currentSelection: string[] = [],
  isAdditive = false
): string[] {
  const minTime = Math.min(range.startUs, range.endUs)
  const maxTime = Math.max(range.startUs, range.endUs)
  const allowedTrackIds = range.trackIds ? new Set(range.trackIds) : null

  const newlySelected = new Set<string>()

  for (const track of tracks) {
    // 锁定轨上的元素禁止被框选，绝对不被批量拖走
    if (track.locked) continue
    if (allowedTrackIds && !allowedTrackIds.has(track.id)) continue

    for (const elem of track.elements) {
      const elemEndUs = elem.startUs + elem.durationUs
      // 检查区间是否有重叠交集
      const hasOverlap = Math.max(minTime, elem.startUs) < Math.min(maxTime, elemEndUs)
      if (hasOverlap) {
        newlySelected.add(elem.id)
      }
    }
  }

  // 扩展成组元素（同组元素一并选中，但不包含锁定轨上的同组成员）
  const groupsToInclude = new Set<string>()
  for (const track of tracks) {
    if (track.locked) continue
    for (const elem of track.elements) {
      if (elem.groupId && newlySelected.has(elem.id)) {
        groupsToInclude.add(elem.groupId)
      }
    }
  }

  if (groupsToInclude.size > 0) {
    for (const track of tracks) {
      if (track.locked) continue
      for (const elem of track.elements) {
        if (elem.groupId && groupsToInclude.has(elem.groupId)) {
          newlySelected.add(elem.id)
        }
      }
    }
  }

  if (isAdditive) {
    const combined = new Set([...currentSelection, ...newlySelected])
    return Array.from(combined)
  }

  return Array.from(newlySelected)
}

/**
 * 过滤出未锁定轨道上的有效选中元素
 */
export function filterUnlockedSelection(
  selectionIds: string[],
  tracks: TimelineTrack[]
): string[] {
  const lockedElemIds = new Set<string>()
  for (const track of tracks) {
    if (track.locked) {
      for (const elem of track.elements) {
        lockedElemIds.add(elem.id)
      }
    }
  }
  return selectionIds.filter((id) => !lockedElemIds.has(id))
}
