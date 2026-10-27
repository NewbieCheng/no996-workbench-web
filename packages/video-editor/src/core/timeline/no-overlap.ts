/**
 * 同轨禁止时间重叠：落点解析为就近空档（贴边），不做推挤波纹。
 * 镜头故事线轨由磁性布局单独处理，调用方应跳过。
 */

export type NoOverlapElement = {
  id: string
  startUs: number
  durationUs: number
}

export function rangesOverlap(
  aStart: number,
  aDuration: number,
  bStart: number,
  bDuration: number,
): boolean {
  return aStart < bStart + bDuration && bStart < aStart + aDuration
}

function fitsGap(
  others: ReadonlyArray<{ startUs: number; durationUs: number }>,
  startUs: number,
  durationUs: number,
): boolean {
  return !others.some((o) => rangesOverlap(startUs, durationUs, o.startUs, o.durationUs))
}

/**
 * 将 startUs 调整到同轨不与其它片段重叠的最近合法起点。
 */
export function resolveNoOverlapStart(
  elements: readonly NoOverlapElement[],
  elementId: string,
  startUs: number,
  durationUs: number,
): number {
  const dur = Math.max(0, Math.round(durationUs))
  if (dur <= 0) return Math.max(0, Math.round(startUs))

  const others = elements
    .filter((e) => e.id !== elementId && e.durationUs > 0)
    .map((e) => ({
      id: e.id,
      startUs: e.startUs,
      durationUs: e.durationUs,
      endUs: e.startUs + e.durationUs,
    }))
    .sort((a, b) => a.startUs - b.startUs)

  let candidate = Math.max(0, Math.round(startUs))
  const preferred = candidate

  if (fitsGap(others, candidate, dur)) return candidate

  for (let guard = 0; guard < others.length + 3; guard++) {
    const conflict = others.find((o) => rangesOverlap(candidate, dur, o.startUs, o.durationUs))
    if (!conflict) return candidate

    const after = conflict.endUs
    const before = Math.max(0, conflict.startUs - dur)
    const beforeOk = fitsGap(others, before, dur)
    const afterOk = fitsGap(others, after, dur)

    if (beforeOk && afterOk) {
      candidate =
        Math.abs(after - preferred) < Math.abs(before - preferred) ? after : before
    } else if (afterOk) {
      candidate = after
    } else if (beforeOk) {
      candidate = before
    } else {
      // 两侧都塞不下：继续向后顶，最终落到轨道末尾
      candidate = after
    }
  }

  return candidate
}

/** 纯 shot 故事线轨：由 magnetic layout 负责，跳过通用无重叠 */
export function isMagneticShotStorylineTrack(track: {
  type: string
  elements: readonly { type: string }[]
}): boolean {
  return (
    track.type === 'shot' &&
    track.elements.length > 0 &&
    track.elements.every((e) => e.type === 'shot')
  )
}
