// Run explicitly with Node >= 22.18: node --test src/features/ip-video/lib/encoding/policy.test.mjs
// Native type stripping only. No bundler, browser, API, model, or vendor encoder is invoked.
import test from 'node:test'
import assert from 'node:assert/strict'
import { FRAME_RATE, MAX_BYTES, BoundedByteStore, abortable, chooseEncoding, frameCount, frameTiming, resolveDuration, rmsEnvelope, supportsWorkerFont, throwIfAborted } from './policy.ts'

test('fixed 30 fps excludes an extra frame at the exact end', () => {
  assert.equal(FRAME_RATE, 30)
  assert.equal(frameCount(1), 30)
  assert.equal(frameCount(300), 9000)
  assert.equal(frameTiming(29, 1).timestamp, 29 / 30)
  assert.throws(() => frameTiming(30, 1), /invalidFrame/)
})

test('last fractional frame ends exactly at duration instead of rounding to frame grid', () => {
  const duration = 1.013
  assert.equal(frameCount(duration), 31)
  const last = frameTiming(30, duration)
  assert.equal(last.timestamp, 1)
  assert.equal(last.timestamp + last.duration, duration)
  assert.ok(last.duration > 0 && last.duration < 1 / 30)
  assert.equal(frameCount(.001), 1)
  assert.equal(frameTiming(0, .001).duration, .001)
})

test('frame schedule is continuous and validates bounds', () => {
  for (const duration of [.01, .5, 1.001, 10 / 30, 299.999]) {
    const count = frameCount(duration)
    for (let i = 0; i < count; i++) {
      const frame = frameTiming(i, duration)
      assert.ok(frame.duration > 0)
      assert.ok(frame.timestamp < duration)
      if (i + 1 < count) assert.ok(Math.abs(frame.timestamp + frame.duration - frameTiming(i + 1, duration).timestamp) < 1e-10)
    }
  }
  for (const duration of [0, -1, 301, NaN, Infinity]) assert.throws(() => frameCount(duration), /invalidDuration/)
})

test('real audio duration wins only inside explicit tolerance; captions are not retimed', () => {
  assert.equal(resolveDuration(10), 10)
  assert.equal(resolveDuration(10, 10.03), 10.03)
  assert.equal(resolveDuration(10, 10.1), 10.1)
  assert.throws(() => resolveDuration(10, 10.101), /audioDurationMismatch/)
  assert.throws(() => resolveDuration(10, 9.89), /audioDurationMismatch/)
})

test('codec strategy tries a complete MP4 pair before WebM and omits audio check for silent output', async () => {
  const calls = []
  const result = await chooseEncoding(async codec => { calls.push(codec); return true }, async codec => { calls.push(codec); return codec === 'opus' })
  assert.equal(result?.mime, 'video/webm')
  assert.deepEqual(calls, ['avc', 'aac', 'vp9', 'opus'])
  assert.equal((await chooseEncoding(async () => true))?.mime, 'video/mp4')
  assert.equal(await chooseEncoding(async () => false), null)
})

test('codec probing errors propagate rather than silently selecting another format', async () => {
  await assert.rejects(chooseEncoding(async () => { throw new Error('probe failed') }), /probe failed/)
})

test('cancellation rejects pending work and already aborted calls', async () => {
  const controller = new AbortController()
  const pending = abortable(new Promise(() => {}), controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.throws(() => throwIfAborted(controller.signal), { name: 'AbortError' })
  await assert.rejects(abortable(Promise.resolve('late'), controller.signal), { name: 'AbortError' })
  assert.equal(await abortable(Promise.resolve('ready')), 'ready')
})

test('post-cancel underlying rejection is consumed; ordinary failures retain their identity', async () => {
  let rejectOperation
  const controller = new AbortController()
  const operation = new Promise((_, reject) => { rejectOperation = reject })
  const canceled = abortable(operation, controller.signal)
  controller.abort()
  await assert.rejects(canceled, { name: 'AbortError' })
  rejectOperation(new Error('late failure'))
  const error = new Error('actual encoding failure')
  await assert.rejects(abortable(Promise.reject(error), new AbortController().signal), candidate => candidate === error)
})

test('worker requires the exact installed family and regular/bold weights', () => {
  assert.equal(supportsWorkerFont('"Alibaba PuHuiTi", sans-serif', 700), true)
  assert.equal(supportsWorkerFont("'Alibaba PuHuiTi', sans-serif", 400), true)
  for (const font of ['serif', 'sans-serif', '"Noto Serif SC", serif', 'Arial, "Alibaba PuHuiTi"']) assert.equal(supportsWorkerFont(font, 700), false)
  assert.equal(supportsWorkerFont('"Alibaba PuHuiTi", sans-serif', 600), false)
})

test('RMS envelope is 30 Hz and preserves silence and absolute signal amplitude', () => {
  assert.deepEqual(rmsEnvelope([new Float32Array(4800)], 48000), [0, 0, 0])
  assert.deepEqual(rmsEnvelope([new Float32Array(1600).fill(.5)], 48000), [.5])
  const stereo = rmsEnvelope([new Float32Array(1600), new Float32Array(1600).fill(1)], 48000)
  assert.ok(Math.abs(stereo[0] - Math.SQRT1_2) < 1e-9)
  assert.throws(() => rmsEnvelope([], 48000), /invalidAudio/)
})

test('random-access writes preserve header rewrites, gaps, and exact output length', async () => {
  const store = new BoundedByteStore(32)
  store.write(0, new Uint8Array([1, 2, 3, 4]))
  store.write(1, new Uint8Array([9, 8]))
  store.write(6, new Uint8Array([7]))
  const blob = store.toBlob('video/mp4')
  assert.equal(blob.type, 'video/mp4')
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 9, 8, 4, 0, 0, 7])
  store.clear()
  assert.equal(store.toBlob('video/mp4').size, 0)
})

test('store rejects overflow before allocation and supports page-boundary rewrites', async () => {
  const store = new BoundedByteStore()
  assert.equal(MAX_BYTES, 250 * 1024 * 1024)
  assert.throws(() => store.write(MAX_BYTES, new Uint8Array([1])), /exportTooLarge/)
  assert.throws(() => store.write(-1, new Uint8Array([1])), /exportTooLarge/)
  store.write(1024 * 1024 - 1, new Uint8Array([5, 6]))
  const bytes = new Uint8Array(await store.toBlob('video/webm').arrayBuffer())
  assert.equal(bytes.length, 1024 * 1024 + 1)
  assert.deepEqual([...bytes.subarray(-2)], [5, 6])
})
