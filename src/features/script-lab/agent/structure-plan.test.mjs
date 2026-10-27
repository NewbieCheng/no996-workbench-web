import assert from 'node:assert/strict'
import test from 'node:test'
import { assertExpectedSegmentIds, buildStructurePlan, formatStructureForWriter, liveTargetChars, normalizeStructureShares, shouldGenerateLiveByChapter } from './structure-plan.ts'

const videoHit = { id: 'video-acquisition', formulaName: '痛点共情解法引导', source: 'test', segments: [
  { name: '痛点场景', purpose: '生活痛点切入', share: 0.2 },
  { name: '身份共情', purpose: '建立同理心', share: 0.2 },
  { name: '干货解法', purpose: '给出步骤', share: 0.4 },
  { name: '留资引导', purpose: '轻量行动', share: 0.2 },
] }
const liveHit = { id: 'live-five-chapter', formulaName: '固定五章', source: 'test', segments: [
  { name: '开场暖场', purpose: '开场', share: 0.1 },
  { name: '产品介绍', purpose: '介绍', share: 0.25 },
  { name: '痛点共鸣', purpose: '共鸣', share: 0.2 },
  { name: '促单环节', purpose: '促单', share: 0.3 },
  { name: '复盘收尾', purpose: '收尾', share: 0.15 },
] }

test('shares normalize to one', () => {
  const shares = normalizeStructureShares([2, 2, 0, Number.NaN])
  assert.equal(shares.reduce((sum, value) => sum + value, 0), 1)
  assert.equal(shares[2], 0)
})

test('video locks candidate names/order and host ids', () => {
  const result = buildStructurePlan({ mode: 'video', hits: [videoHit], raw: { formulaId: 'video-acquisition', segments: [
    { name: '改名', purpose: '模型目的一', share: 0.3 },
    { name: '改名二', purpose: '模型目的二', share: 0.3 },
    { name: '改名三', purpose: '模型目的三', share: 0.2 },
    { name: '改名四', purpose: '模型目的四', share: 0.2 },
  ] }, durationSec: 60 })
  assert.deepEqual(result.plan.map((segment) => segment.name), videoHit.segments.map((segment) => segment.name))
  assert.deepEqual(result.plan.map((segment) => segment.id), ['seg-1', 'seg-2', 'seg-3', 'seg-4'])
  assert.equal(result.plan[0].purpose, '模型目的一')
  assert.ok(Math.abs(result.plan.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-12)
})

test('live always emits fixed five chapter names in order', () => {
  const result = buildStructurePlan({ mode: 'live', hits: [liveHit], raw: { formulaId: 'invented-id', segments: [{ name: '乱写一章', purpose: '模型目的', share: 3 }] }, durationSec: 900 })
  assert.equal(result.formulaId, 'live-five-chapter')
  assert.deepEqual(result.plan.map((segment) => segment.name), ['开场暖场', '产品介绍', '痛点共鸣', '促单环节', '复盘收尾'])
  assert.deepEqual(result.plan.map((segment) => segment.id), ['seg-1', 'seg-2', 'seg-3', 'seg-4', 'seg-5'])
  assert.ok(Math.abs(result.plan.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-12)
})

test('custom live structure preserves host-selected names and order', () => {
  const customLiveHit = { id: 'custom-structure', formulaName: '开场暖场 + 产品演示 + 互动问答 + 复盘收尾', source: 'test', segments: [
    { name: '开场暖场', purpose: '开场', share: 0.2 },
    { name: '产品演示', purpose: '演示', share: 0.3 },
    { name: '互动问答', purpose: '答疑', share: 0.3 },
    { name: '复盘收尾', purpose: '收尾', share: 0.2 },
  ] }
  const result = buildStructurePlan({ mode: 'live', hits: [customLiveHit], raw: { formulaId: 'custom-structure', segments: [
    { name: '模型改名', purpose: '模型目的', share: 2 },
  ] }, durationSec: 1800 })
  assert.equal(result.formulaId, 'custom-structure')
  assert.deepEqual(result.plan.map((segment) => segment.name), ['开场暖场', '产品演示', '互动问答', '复盘收尾'])
  assert.deepEqual(result.plan.map((segment) => segment.id), ['seg-1', 'seg-2', 'seg-3', 'seg-4'])
  assert.ok(Math.abs(result.plan.reduce((sum, segment) => sum + segment.share, 0) - 1) < 1e-12)
})

test('live structure rejects duplicate chapter names', () => {
  const duplicateLiveHit = { id: 'custom-structure', formulaName: '重复结构', source: 'test', segments: [
    { name: '开场暖场', purpose: '开场', share: 0.5 },
    { name: '开场暖场', purpose: '重复', share: 0.5 },
  ] }
  assert.throws(() => buildStructurePlan({ mode: 'live', hits: [duplicateLiveHit], raw: {}, durationSec: 1800 }))
})
test('writer gets stable ids and budgets', () => {
  const text = formatStructureForWriter([{ id: 'seg-1', name: '开场暖场', purpose: '开场', share: 0.1 }, { id: 'seg-2', name: '产品介绍', purpose: '介绍', share: 0.9 }], 1000)
  assert.match(text, /id: seg-1/)
  assert.match(text, /口播预算约 100 字/)
  assert.match(text, /口播预算约 900 字/)
})

test('model ids must match exactly', () => {
  assert.doesNotThrow(() => assertExpectedSegmentIds([{ id: 'seg-1' }, { id: 'seg-2' }], ['seg-1', 'seg-2']))
  assert.throws(() => assertExpectedSegmentIds([{ id: 'seg-2' }, { id: 'seg-1' }], ['seg-1', 'seg-2']))
  assert.throws(() => assertExpectedSegmentIds([{ id: 'seg-1' }], ['seg-1', 'seg-2']))
})

test('long live switches to chapter generation', () => {
  assert.equal(liveTargetChars(900), 3600)
  assert.equal(shouldGenerateLiveByChapter(900), false)
  assert.equal(shouldGenerateLiveByChapter(1800), true)
  assert.equal(shouldGenerateLiveByChapter(7200), true)
})