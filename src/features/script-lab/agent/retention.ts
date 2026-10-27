/**
 * 留存与转化力计算（纯函数）。
 *
 * 关键约束（参考规格 5.4）：曲线必须诚实——起点恒为 100，且单调不增。
 * 参考原型用写死数组 + 线性公式伪造曲线，这里改为由评审的真实逐段留存点驱动，
 * 并由本模块强制修正为单调不增，避免出现「越讲人越多」的假曲线。
 */
import type { ScriptReview, ScriptReviewItem, ScriptRound, ScriptSegment } from './types'

export const RETENTION_TARGET = 70
export const MAX_ROUNDS = 3
/** 第 2 轮起提升不足该值即停止 */
export const MIN_IMPROVEMENT = 2

/** 把评审给的留存点修正为「起点 100 且单调不增」的序列 */
export function normalizeRetentionPoints(points: number[]): number[] {
  if (!points.length) return []
  const out: number[] = []
  let prev = 100
  for (const raw of points) {
    const value = Math.max(0, Math.min(100, Math.round(Number.isFinite(raw) ? raw : prev)))
    // 不得高于上一点（起点视为 100）
    const clamped = Math.min(prev, value)
    out.push(clamped)
    prev = clamped
  }
  return out
}

export function averageRetention(points: number[]): number {
  if (!points.length) return 0
  return Math.round(points.reduce((a, b) => a + b, 0) / points.length)
}

/** 综合分 = round(0.5 × 平均留存 + 0.5 × 转化力) */
export function compositeScore(retentionAvg: number, conversion: number): number {
  return Math.round(0.5 * retentionAvg + 0.5 * conversion)
}

export function roundFromReview(
  round: number,
  review: ScriptReview,
  segmentIds: string[],
): ScriptRound {
  const byId = new Map(review.items.map((i) => [i.segmentId, i]))
  const points = segmentIds.map((id) => byId.get(id)?.retention ?? 100)
  const normalized = normalizeRetentionPoints(points)
  const avg = averageRetention(normalized)
  return {
    round,
    retentionPoints: normalized,
    averageRetention: avg,
    conversion: Math.max(0, Math.min(100, Math.round(review.conversion))),
    composite: compositeScore(avg, review.conversion),
  }
}

/** 连续两轮提升不足 2% 即停；第一轮不算 */
export function shouldStop(rounds: ScriptRound[]): { stop: boolean; reason?: string } {
  const last = rounds[rounds.length - 1]
  if (!last) return { stop: false }
  if (last.averageRetention >= RETENTION_TARGET) {
    return { stop: true, reason: `平均留存已达到 ${last.averageRetention}%，停在目标之上。` }
  }
  if (rounds.length >= MAX_ROUNDS) {
    return { stop: true, reason: `已完成 ${MAX_ROUNDS} 轮迭代。` }
  }
  if (rounds.length >= 2) {
    const prev = rounds[rounds.length - 2]
    if (last.averageRetention - prev.averageRetention < MIN_IMPROVEMENT) {
      return { stop: true, reason: '本轮提升不足 2%，继续迭代收益有限。' }
    }
  }
  return { stop: false }
}

/** 找出需要修改的段：评审标记 mustFix，或留存低于上一段明显掉线 */
export function pickTargets(
  review: ScriptReview,
  segments: ScriptSegment[],
): ScriptReviewItem[] {
  const order = new Map(segments.map((s, i) => [s.id, i]))
  const items = [...review.items].sort(
    (a, b) => (order.get(a.segmentId) ?? 0) - (order.get(b.segmentId) ?? 0),
  )
  const mustFix = items.filter((i) => i.mustFix)
  if (mustFix.length) return mustFix
  // 没有显式 mustFix 时，取掉线最严重的一段
  let worst: ScriptReviewItem | undefined
  for (const item of items) {
    if (!worst || item.retention < worst.retention) worst = item
  }
  return worst ? [worst] : []
}
