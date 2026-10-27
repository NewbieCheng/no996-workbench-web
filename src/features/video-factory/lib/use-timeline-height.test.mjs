import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VF_TIMELINE_HEIGHT_MIN,
  clampTimelineHeight,
} from './use-timeline-height.ts'

test('clampTimelineHeight: respects min and 50% of body', () => {
  assert.equal(clampTimelineHeight(100, 800), VF_TIMELINE_HEIGHT_MIN)
  assert.equal(clampTimelineHeight(500, 800), 400)
  assert.equal(clampTimelineHeight(900, 800), 400)
})

test('clampTimelineHeight: small body still has min max', () => {
  assert.equal(clampTimelineHeight(300, 300), 200)
})
