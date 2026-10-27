import test from 'node:test'
import assert from 'node:assert/strict'
import { concatVideoBlobs } from './video-concat.ts'

test('concatVideoBlobs rejects empty input array', async () => {
  await assert.rejects(
    () => concatVideoBlobs([]),
    /没有可合并的成片段落/
  )
})

test('concatVideoBlobs returns the single blob directly without invoking canvas or media recorder', async () => {
  const single = new Blob(['sample-video'], { type: 'video/mp4' })
  const result = await concatVideoBlobs([
    { id: '1', blob: single, duration: 5, width: 720, height: 1280 },
  ])
  assert.equal(result, single)
})
