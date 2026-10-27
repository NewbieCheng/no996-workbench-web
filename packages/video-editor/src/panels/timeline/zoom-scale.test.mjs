import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRulerTicks, computeTimelineContentWidth } from './zoom-scale.ts'

test('computeTimelineContentWidth: fills viewport when wider than duration', () => {
  const w = computeTimelineContentWidth(0, 1, 1126)
  assert.equal(w, 1126)
})

test('computeTimelineContentWidth: grows past viewport when zoomed in', () => {
  const durationUs = 60_000_000
  const w = computeTimelineContentWidth(durationUs, 5, 800)
  assert.ok(w > 800)
})

test('computeRulerTicks: spans wide viewport when duration is zero', () => {
  const width = 1126
  const ticks = computeRulerTicks(0, 1, width)
  const last = ticks[ticks.length - 1]
  assert.ok(last.pixel >= width - 120, `last tick at ${last.pixel}px for width ${width}`)
})
