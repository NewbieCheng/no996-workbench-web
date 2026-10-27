import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assignTimecodes,
  buildTeleprompterText,
  findDrops,
  formatTimecode,
  segmentCharBudgets,
  summarizeRound,
} from './finalize.ts'
import {
  MAX_ROUNDS,
  RETENTION_TARGET,
  averageRetention,
  compositeScore,
  normalizeRetentionPoints,
  pickTargets,
  roundFromReview,
  shouldStop,
} from './retention.ts'

test('normalizeRetentionPoints forces a non-increasing series capped at 100', () => {
  // 越讲人越多是假曲线，必须被修正
  assert.deepEqual(normalizeRetentionPoints([80, 120, 90, 95]), [80, 80, 80, 80])
  assert.deepEqual(normalizeRetentionPoints([50, 40, 30]), [50, 40, 30])
  assert.deepEqual(normalizeRetentionPoints([]), [])
  // 非法值退化为上一点，而不是变成 NaN
  assert.deepEqual(normalizeRetentionPoints([90, Number.NaN, 70]), [90, 90, 70])
})

test('averageRetention and compositeScore are rounded integers', () => {
  assert.equal(averageRetention([80, 70, 60]), 70)
  assert.equal(averageRetention([]), 0)
  assert.equal(compositeScore(70, 60), 65)
  assert.equal(compositeScore(70.4, 60.4), 65)
})

test('roundFromReview derives points from review items by segment id', () => {
  const review = {
    items: [
      { segmentId: 's1', retention: 90, primaryIssue: '', improvementDirection: '', mustFix: false },
      { segmentId: 's2', retention: 95, primaryIssue: '', improvementDirection: '', mustFix: false },
    ],
    hookStrength: 70,
    conversion: 60,
  }
  const round = roundFromReview(1, review, ['s1', 's2'])
  // s2 高于 s1 → 被修正为不增
  assert.deepEqual(round.retentionPoints, [90, 90])
  assert.equal(round.averageRetention, 90)
  assert.equal(round.conversion, 60)
  assert.equal(round.composite, 75)
})

test('roundFromReview defaults a missing segment to 100 without fabricating a drop', () => {
  const review = { items: [], hookStrength: 0, conversion: 50 }
  const round = roundFromReview(1, review, ['s1'])
  assert.deepEqual(round.retentionPoints, [100])
})

test('shouldStop covers target, round cap and plateau', () => {
  assert.deepEqual(shouldStop([]).stop, false)
  assert.equal(shouldStop([{ averageRetention: RETENTION_TARGET }]).stop, true)
  assert.equal(
    shouldStop([
      { averageRetention: 60 },
      { averageRetention: 61 },
    ]).stop,
    true,
  )
  assert.equal(
    shouldStop(Array.from({ length: MAX_ROUNDS }, () => ({ averageRetention: 40 }))).stop,
    true,
  )
  assert.equal(
    shouldStop([
      { averageRetention: 40 },
      { averageRetention: 50 },
    ]).stop,
    false,
  )
})

test('pickTargets prefers explicit mustFix, else the worst drop', () => {
  const segments = [
    { id: 's1' },
    { id: 's2' },
    { id: 's3' },
  ]
  const items = [
    { segmentId: 's1', retention: 80, mustFix: false },
    { segmentId: 's2', retention: 40, mustFix: false },
    { segmentId: 's3', retention: 70, mustFix: false },
  ]
  assert.deepEqual(
    pickTargets({ items, hookStrength: 0, conversion: 0 }, segments).map((i) => i.segmentId),
    ['s2'],
  )

  const withMustFix = items.map((i) => (i.segmentId === 's3' ? { ...i, mustFix: true } : i))
  assert.deepEqual(
    pickTargets({ items: withMustFix, hookStrength: 0, conversion: 0 }, segments).map((i) => i.segmentId),
    ['s3'],
  )
})

test('assignTimecodes is contiguous and lands exactly on the total duration', () => {
  const codes = assignTimecodes([{ share: 0.2 }, { share: 0.3 }, { share: 0.5 }], 60)
  assert.deepEqual(
    codes.map((c) => [c.startSec, c.endSec]),
    [
      [0, 12],
      [12, 30],
      [30, 60],
    ],
  )
  // 份额和不等于 1 时也要归一化
  const uneven = assignTimecodes([{ share: 1 }, { share: 3 }], 40)
  assert.equal(uneven[0].startSec, 0)
  assert.equal(uneven.at(-1).endSec, 40)
})

test('formatTimecode pads to mm:ss', () => {
  assert.equal(formatTimecode(0), '00:00')
  assert.equal(formatTimecode(9), '00:09')
  assert.equal(formatTimecode(65), '01:05')
  assert.equal(formatTimecode(-5), '00:00')
})

test('buildTeleprompterText includes timecode, spoken body and aside', () => {
  const segments = [
    { id: 's1', name: '开场', startSec: 0, endSec: 10, spoken: '大家好', visual: '近景' },
  ]
  const text = buildTeleprompterText(segments, (s) => s.spoken, '画面', (s) => s.visual ?? '')
  assert.match(text, /【00:00 开场】/)
  assert.match(text, /大家好/)
  assert.match(text, /（画面：近景）/)
})

test('segmentCharBudgets splits the target by share', () => {
  const budgets = segmentCharBudgets(
    [
      { id: 's1', share: 0.5 },
      { id: 's2', share: 0.5 },
    ],
    100,
  )
  assert.deepEqual(budgets, [
    { id: 's1', budget: 50 },
    { id: 's2', budget: 50 },
  ])
})

test('findDrops only reports drops at or above the threshold', () => {
  assert.deepEqual(findDrops([100, 95, 80, 79]), [{ index: 2, drop: 15 }])
  assert.deepEqual(findDrops([100, 99]), [])
})

test('summarizeRound reports the delta against the first round', () => {
  assert.equal(summarizeRound([]), '暂无留存数据')
  const summary = summarizeRound([
    { round: 1, averageRetention: 60 },
    { round: 2, averageRetention: 72 },
  ])
  assert.match(summary, /72%/)
  assert.match(summary, /\+12/)
})
