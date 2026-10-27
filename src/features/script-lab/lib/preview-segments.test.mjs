import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePreviewSegments } from './preview-segments.ts'

test('live 15min segments use share weights and sum to duration', () => {
  const segments = resolvePreviewSegments({
    mode: 'live',
    product: '演示产品',
    durationSec: 900,
    goal: '获客',
    structure: { kind: 'auto' },
    strength: 50,
    platform: '抖音',
  })
  assert.equal(segments.length, 5)
  const sum = segments.reduce((a, s) => a + s.seconds, 0)
  assert.ok(Math.abs(sum - 900) <= 5, `expected ~900s, got ${sum}`)
  const secondsSet = new Set(segments.map((s) => s.seconds))
  assert.ok(secondsSet.size > 1, 'segments should not all have equal duration')
  const promo = segments.find((s) => s.name === '促单环节')
  const open = segments.find((s) => s.name === '开场暖场')
  assert.ok(promo && open)
  assert.ok(promo.seconds > open.seconds, '促单环节应长于开场暖场')
})

test('custom live segments follow the configured chapter order and duration', () => {
  const segments = resolvePreviewSegments({
    mode: 'live',
    product: '演示产品',
    durationSec: 1800,
    goal: '成交',
    structure: { kind: 'custom', text: '开场暖场 + 产品演示 + 互动问答 + 复盘收尾' },
    strength: 50,
    platform: '抖音',
  })
  assert.deepEqual(segments.map((segment) => segment.name), ['开场暖场', '产品演示', '互动问答', '复盘收尾'])
  const sum = segments.reduce((total, segment) => total + segment.seconds, 0)
  assert.ok(Math.abs(sum - 1800) <= 5, `expected ~1800s, got ${sum}`)
})
test('video segments still resolve with goal formula', () => {
  const segments = resolvePreviewSegments({
    mode: 'video',
    product: '演示',
    durationSec: 60,
    goal: '获客',
    structure: { kind: 'auto' },
    strength: 50,
    platform: '抖音',
  })
  assert.ok(segments.length >= 3)
  const sum = segments.reduce((a, s) => a + s.seconds, 0)
  assert.ok(Math.abs(sum - 60) <= 3)
})
