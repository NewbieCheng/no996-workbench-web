import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeCompositeScore,
  computeParetoOptimality,
  maxCharsOf,
  normalizeCredibility,
  normalizeCtr,
  rankAndRecommendCandidates,
  resolveEffectiveTone,
  summarizeCandidates,
} from './scoring-model.ts'

function candidate(id, ctr, credibility, title = `t${id}`) {
  return {
    id,
    formulaName: `f${id}`,
    sourceTag: `#${id}`,
    title,
    charCount: title.length,
    maxCharCount: 20,
    ctr,
    credibility,
    score: computeCompositeScore(ctr, credibility),
    rounds: [],
  }
}

test('normalizeCtr clamps impossible click-through rates', () => {
  assert.equal(normalizeCtr(7.53), 7.5)
  assert.equal(normalizeCtr(87), 20) // 87% 不可能，夹到上限
  assert.equal(normalizeCtr(0), 0)
  assert.equal(normalizeCtr(-3), 0)
  assert.equal(normalizeCtr('abc'), 0)
})

test('normalizeCredibility clamps to 0-100 integers', () => {
  assert.equal(normalizeCredibility(82.4), 82)
  assert.equal(normalizeCredibility(-10), 0)
  assert.equal(normalizeCredibility(180), 100)
  assert.equal(normalizeCredibility(undefined), 0)
})

test('computeCompositeScore is deterministic and bounded 0-100', () => {
  assert.equal(computeCompositeScore(0, 0), 0)
  assert.equal(computeCompositeScore(12, 100), 100)
  // 超过 ctrMaxBase 也不该超过 100
  assert.equal(computeCompositeScore(20, 100), 100)
  assert.equal(computeCompositeScore(6, 80), 65)
})

test('Pareto frontier excludes dominated candidates only', () => {
  // b 在两项上都不差于 a，且至少一项更好 → a 被支配
  const flags = computeParetoOptimality([
    { ctr: 5, credibility: 50 },
    { ctr: 6, credibility: 60 },
    { ctr: 8, credibility: 40 },
  ])
  assert.deepEqual(flags, [false, true, true])
})

test('rankAndRecommendCandidates picks a Pareto point and ranks continuously', () => {
  const ranked = rankAndRecommendCandidates([
    candidate(1, 5, 50),
    candidate(2, 9, 75),
    candidate(3, 7, 90),
  ])
  assert.deepEqual(
    ranked.map((c) => c.rank),
    [1, 2, 3],
  )
  const recommended = ranked.filter((c) => c.isRecommended)
  assert.equal(recommended.length, 1)
  // 推荐项必须落在 Pareto 前沿上（不能推荐被支配的点）
  assert.equal(recommended[0].isParetoOptimal, true)
})

test('rankAndRecommendCandidates still recommends when no Pareto point exists', () => {
  // 全部同分同项时 computeParetoOptimality 视为互不支配；这里构造极端退化输入
  const ranked = rankAndRecommendCandidates([candidate(1, 0, 0), candidate(2, 0, 0)])
  assert.equal(ranked.filter((c) => c.isRecommended).length, 1)
})

test('maxCharsOf follows platform caps', () => {
  assert.equal(maxCharsOf('小红书'), 20)
  assert.equal(maxCharsOf('抖音'), 30)
  assert.equal(maxCharsOf('公众号'), 32)
  assert.equal(maxCharsOf('B站'), 40)
})

test('resolveEffectiveTone only lowers tone on explicit calm requests', () => {
  assert.equal(resolveEffectiveTone(50, undefined), 50)
  assert.equal(resolveEffectiveTone(50, '希望不要太夸张'), 35)
  // 下限保护：不能降到 15 以下
  assert.equal(resolveEffectiveTone(20, '克制一点'), 15)
  assert.equal(resolveEffectiveTone(50, '再抓人一点'), 50)
})

test('summarizeCandidates averages with one decimal for score/ctr', () => {
  const summary = summarizeCandidates([
    { ctr: 6.7, credibility: 80, score: 68 },
    { ctr: 7.3, credibility: 70, score: 65 },
  ])
  assert.equal(summary.averageScore, 66.5)
  assert.equal(summary.averageCtr, 7)
  assert.equal(summary.averageCredibility, 75)
  assert.deepEqual(summarizeCandidates([]), {
    averageScore: 0,
    averageCtr: 0,
    averageCredibility: 0,
  })
})
