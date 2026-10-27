import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveTrackDropDocIndexFromDelta } from '../src/panels/timeline/track-reorder-motion.ts'

test('resolveTrackDropDocIndexFromDelta: move shot row down onto video row', () => {
  const heights = [44, 44, 34, 28]
  assert.equal(resolveTrackDropDocIndexFromDelta(0, 50, heights), 1)
})

test('resolveTrackDropDocIndexFromDelta: move video row up onto shot row', () => {
  const heights = [44, 44, 34, 28]
  assert.equal(resolveTrackDropDocIndexFromDelta(1, -50, heights), 0)
})

test('resolveTrackDropDocIndexFromDelta: small delta stays on same row', () => {
  const heights = [44, 44]
  assert.equal(resolveTrackDropDocIndexFromDelta(0, 4, heights), 0)
})
