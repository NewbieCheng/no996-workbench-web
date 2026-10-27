import { test } from 'node:test'
import assert from 'node:assert/strict'
import { canReorderTrackPair } from '../src/panels/timeline/track-reorder-policy.ts'

const track = (type, locked = false) => ({
  id: `t-${type}`,
  type,
  name: type,
  muted: false,
  hidden: false,
  locked,
  elements: [],
})

test('canReorderTrackPair: shot and video may swap', () => {
  assert.equal(canReorderTrackPair(track('shot'), track('video')), true)
  assert.equal(canReorderTrackPair(track('video'), track('shot')), true)
})

test('canReorderTrackPair: shot cannot swap into audio group', () => {
  assert.equal(canReorderTrackPair(track('shot'), track('audio')), false)
  assert.equal(canReorderTrackPair(track('video'), track('text')), true)
})

test('canReorderTrackPair: locked track blocks reorder', () => {
  assert.equal(canReorderTrackPair(track('video', true), track('shot')), false)
})
