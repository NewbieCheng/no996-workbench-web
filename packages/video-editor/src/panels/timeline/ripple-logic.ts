/**
 * 波纹删除与多轨联动计算纯函数
 */

import type { TimeUs } from '../../core/time.ts'
import type { TimelineTrack, TrackElement } from '../../core/project.ts'

export type ElementShift = {
  elementId: string
  oldStartUs: TimeUs
  newStartUs: TimeUs
}

/**
 * 计算一组元素在发生波纹删除时的前移计划
 */
export function computeRippleShifts(
  elements: TrackElement[],
  deletedStartUs: TimeUs,
  deletedDurationUs: TimeUs
): ElementShift[] {
  if (deletedDurationUs <= 0) return []

  const shifts: ElementShift[] = []

  for (const elem of elements) {
    if (elem.startUs >= deletedStartUs) {
      const newStartUs = Math.max(0, elem.startUs - deletedDurationUs)
      shifts.push({
        elementId: elem.id,
        oldStartUs: elem.startUs,
        newStartUs,
      })
    }
  }

  return shifts
}

/**
 * 计算单个轨道在发生波纹删除时的元素前移计划
 */
export function computeTrackRippleShifts(
  track: TimelineTrack,
  deletedStartUs: TimeUs,
  deletedDurationUs: TimeUs
): ElementShift[] {
  if (track.locked) return []
  return computeRippleShifts(track.elements, deletedStartUs, deletedDurationUs)
}

/**
 * 校验多元素平移是否越界或发生负时间
 */
export function validateElementMoves(
  elements: TrackElement[],
  shifts: Map<string, TimeUs>
): boolean {
  for (const elem of elements) {
    if (shifts.has(elem.id)) {
      const targetStart = shifts.get(elem.id)!
      if (!Number.isSafeInteger(targetStart) || targetStart < 0) {
        return false
      }
    }
  }
  return true
}
