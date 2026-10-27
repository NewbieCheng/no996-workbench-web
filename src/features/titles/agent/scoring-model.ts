/**
 * 爆款标题 · 打分与选优
 *
 * 评分来自模型的独立评审（见 prompts.ts 的 REVIEWER_PROMPT），
 * 本文件只做「确定性的换算与裁决」——不再内置任何基准分/预设轨迹。
 * 原先 computeAdjustedCtr / computeAdjustedCredibility 用硬编码基准分反推分数，
 * 会让每条标题都拿到看似可信的数字，已删除。
 */
import type { TargetPlatform, TitleCandidate } from './types'

export const PLATFORM_SPECS: Record<TargetPlatform, { maxChars: number }> = {
  抖音: { maxChars: 30 },
  小红书: { maxChars: 20 },
  公众号: { maxChars: 32 },
  B站: { maxChars: 40 },
  视频号: { maxChars: 30 },
  知乎: { maxChars: 40 },
}

export const SCORING_PARAMS = {
  /** 预估点击率的满分基准（%），用于把百分比折算成 0-100 分 */
  ctrMaxBase: 12,
  ctrWeight: 0.5,
  credibilityWeight: 0.5,
  /** 综合分停止阈值 */
  scoreThreshold: 85,
  /** 连续一轮提升不足该值即停 */
  minImprovement: 2,
} as const

export function maxCharsOf(platform: TargetPlatform): number {
  return (PLATFORM_SPECS[platform] ?? PLATFORM_SPECS['小红书']).maxChars
}

/**
 * 智能调整语气强度（根据用户补充说明中的关键词微调）
 */
export function resolveEffectiveTone(baseTone: number, supplement?: string): number {
  if (!supplement) return baseTone
  const text = supplement.toLowerCase()
  const calmKeywords = ['别太夸张', '不要太夸张', '克制', '稳重', '不要夸张', '勿夸张', '收敛', '保守']
  if (calmKeywords.some((k) => text.includes(k))) {
    return Math.max(15, baseTone - 15)
  }
  return baseTone
}

/** 把模型给的预估点击率（%）夹到合理区间，避免出现 87% 这类不可能值 */
export function normalizeCtr(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(Math.min(20, n) * 10) / 10
}

/** 可信度夹到 0-100 整数 */
export function normalizeCredibility(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** 综合分：点击率与可信度各占一半，确定性可复现 */
export function computeCompositeScore(ctr: number, credibility: number): number {
  const ctrScore = (ctr / SCORING_PARAMS.ctrMaxBase) * 100 * SCORING_PARAMS.ctrWeight
  const credScore = credibility * SCORING_PARAMS.credibilityWeight
  return Math.max(0, Math.min(100, Math.round(ctrScore + credScore)))
}

/**
 * Pareto 最优前沿（在两个目标上没有被其它任何一个完全支配的点）
 */
export function computeParetoOptimality<T extends { ctr: number; credibility: number }>(items: T[]): boolean[] {
  return items.map((current, i) => {
    const isDominated = items.some((other, j) => {
      if (i === j) return false
      const nonInferior = other.ctr >= current.ctr && other.credibility >= current.credibility
      const strictlyBetter = other.ctr > current.ctr || other.credibility > current.credibility
      return nonInferior && strictlyBetter
    })
    return !isDominated
  })
}

/** 排序与标记推荐 */
export function rankAndRecommendCandidates(
  candidates: Omit<TitleCandidate, 'rank' | 'isParetoOptimal' | 'isRecommended'>[],
): TitleCandidate[] {
  const paretoFlags = computeParetoOptimality(candidates)

  let maxParetoScore = -1
  let recommendedIdx = -1
  candidates.forEach((c, idx) => {
    if (!paretoFlags[idx]) return
    if (c.score > maxParetoScore) {
      maxParetoScore = c.score
      recommendedIdx = idx
    } else if (c.score === maxParetoScore && recommendedIdx >= 0 && c.ctr > candidates[recommendedIdx].ctr) {
      recommendedIdx = idx
    }
  })

  // 极端情况下没有 Pareto 点，降级取全局最高分
  if (recommendedIdx === -1) {
    candidates.forEach((c, idx) => {
      if (c.score > maxParetoScore) {
        maxParetoScore = c.score
        recommendedIdx = idx
      }
    })
  }

  const withMeta = candidates.map((c, idx) => ({
    ...c,
    isParetoOptimal: paretoFlags[idx],
    isRecommended: idx === recommendedIdx,
  }))

  const sorted = [...withMeta].sort((a, b) => {
    if (b.isRecommended !== a.isRecommended) return b.isRecommended ? 1 : -1
    if (b.score !== a.score) return b.score - a.score
    return b.ctr - a.ctr
  })

  return sorted.map((item, index) => ({ ...item, rank: index + 1 }))
}

/** 一轮的平均指标（用于收敛判断与曲线） */
export function summarizeCandidates(candidates: Array<{ ctr: number; credibility: number; score: number }>): {
  averageScore: number
  averageCtr: number
  averageCredibility: number
} {
  if (!candidates.length) return { averageScore: 0, averageCtr: 0, averageCredibility: 0 }
  const sum = candidates.reduce(
    (acc, c) => ({
      score: acc.score + c.score,
      ctr: acc.ctr + c.ctr,
      cred: acc.cred + c.credibility,
    }),
    { score: 0, ctr: 0, cred: 0 },
  )
  const n = candidates.length
  return {
    averageScore: Math.round((sum.score / n) * 10) / 10,
    averageCtr: Math.round((sum.ctr / n) * 10) / 10,
    averageCredibility: Math.round(sum.cred / n),
  }
}
