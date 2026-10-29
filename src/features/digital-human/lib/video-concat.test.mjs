import test from 'node:test'
import assert from 'node:assert/strict'
import { concatVideoBlobs } from './video-concat.ts'

test('concatVideoBlobs rejects empty input array', async () => {
  await assert.rejects(
    () => concatVideoBlobs([]),
    /没有可合并的成片段落/
  )
})

test('concatVideoBlobs refuses to label an unverified single source as an MP4 export', async () => {
  await assert.rejects(
    () => concatVideoBlobs([{ id: '1', blob: new Blob(['source'], { type: 'video/webm' }), duration: 5, width: 720, height: 1280 }]),
    /不是可确认的 MP4/
  )
})


  const single = new Blob(['sample-video'], { type: 'video/mp4' })
  const result = await concatVideoBlobs([
    { id: '1', blob: single, duration: 5, width: 720, height: 1280 },
  ])
  assert.equal(result, single)
})
