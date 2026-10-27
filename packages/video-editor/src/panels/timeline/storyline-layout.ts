/**
 * 镜头主轨磁吸故事线：拖动换位后保持首尾相接
 */

import type { ShotClipElement } from '../../core/project.ts'
import type { TimeUs } from '../../core/time.ts'

export type StorylineMove = { elementId: string; newStartUs: TimeUs }

export type StorylineGhost = {
  startUs: TimeUs
  durationUs: TimeUs
}

function shotCenterUs(shot: ShotClipElement): number {
  return shot.startUs + shot.durationUs / 2
}

export function applyStorylineOriginStarts(
  shots: ShotClipElement[],
  originStarts: Map<string, TimeUs> | undefined,
): ShotClipElement[] {
  if (!originStarts) return shots
  return shots.map((shot) => {
    const startUs = originStarts.get(shot.id)
    return startUs == null ? shot : { ...shot, startUs }
  })
}

/** 跟手视觉中心：按按下时的起点 + 像素位移，允许落到 0 之前以便往前换位 */
export function storylineProbeUs(
  originStartUs: TimeUs,
  durationUs: TimeUs,
  deltaUs: TimeUs,
): number {
  return originStartUs + durationUs / 2 + deltaUs
}

/**
 * 按拖动片段的视觉中心（probeUs）重排镜头，并从 0 首尾相接铺平。
 * 必须喂按下瞬间的 startUs，不能用拖动中已被预览改写的邻块位置。
 */
/** 按当前顺序从 0 首尾相接铺平镜头轨（复制 / 跨轨进轨后使用） */
export function reflowStorylineMoves(shots: ShotClipElement[]): StorylineMove[] {
  if (shots.length === 0) return []
  const sorted = [...shots].sort((a, b) => a.startUs - b.startUs)
  let cursor = 0
  return sorted.map((shot) => {
    const move = { elementId: shot.id, newStartUs: cursor }
    cursor += shot.durationUs
    return move
  })
}

export function computeStorylineLayout(
  shots: ShotClipElement[],
  draggedId: string,
  probeUs: number,
): StorylineMove[] {
  if (shots.length === 0) return []

  const sorted = [...shots].sort((a, b) => a.startUs - b.startUs)
  const dragged = sorted.find((s) => s.id === draggedId)
  if (!dragged) {
    return sorted.map((s, i) => {
      const prior = sorted.slice(0, i)
      const newStart = prior.reduce((acc, p) => acc + p.durationUs, 0)
      return { elementId: s.id, newStartUs: newStart }
    })
  }

  const others = sorted.filter((s) => s.id !== draggedId)

  let insertIndex = others.length
  for (let i = 0; i < others.length; i++) {
    if (probeUs < shotCenterUs(others[i])) {
      insertIndex = i
      break
    }
  }

  const reordered = [...others.slice(0, insertIndex), dragged, ...others.slice(insertIndex)]

  let cursor = 0
  return reordered.map((shot) => {
    const move = { elementId: shot.id, newStartUs: cursor }
    cursor += shot.durationUs
    return move
  })
}
