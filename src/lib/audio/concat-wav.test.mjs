import assert from 'node:assert/strict'
import test from 'node:test'
import { concatWavBuffers } from './concat-wav.ts'

function createDummyWav(samplesCount, sampleRate = 24000) {
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samplesCount * 2
  const totalSize = 44 + dataSize
  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // RIFF
  view.setUint8(0, 'R'.charCodeAt(0))
  view.setUint8(1, 'I'.charCodeAt(0))
  view.setUint8(2, 'F'.charCodeAt(0))
  view.setUint8(3, 'F'.charCodeAt(0))
  view.setUint32(4, totalSize - 8, true)
  view.setUint8(8, 'W'.charCodeAt(0))
  view.setUint8(9, 'A'.charCodeAt(0))
  view.setUint8(10, 'V'.charCodeAt(0))
  view.setUint8(11, 'E'.charCodeAt(0))

  // fmt
  view.setUint8(12, 'f'.charCodeAt(0))
  view.setUint8(13, 'm'.charCodeAt(0))
  view.setUint8(14, 't'.charCodeAt(0))
  view.setUint8(15, ' '.charCodeAt(0))
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data
  view.setUint8(36, 'd'.charCodeAt(0))
  view.setUint8(37, 'a'.charCodeAt(0))
  view.setUint8(38, 't'.charCodeAt(0))
  view.setUint8(39, 'a'.charCodeAt(0))
  view.setUint32(40, dataSize, true)

  for (let i = 0; i < samplesCount; i++) {
    view.setInt16(44 + i * 2, (i * 100) % 32767, true)
  }

  return buffer
}

test('concatWavBuffers returns empty buffer when empty input', () => {
  const result = concatWavBuffers([])
  assert.equal(result.byteLength, 0)
})

test('concatWavBuffers returns single buffer as is', () => {
  const w1 = createDummyWav(100)
  const result = concatWavBuffers([w1])
  assert.equal(result.byteLength, w1.byteLength)
})

test('concatWavBuffers concatenates multiple WAV buffers correctly', () => {
  const w1 = createDummyWav(100) // 200 bytes PCM + 44
  const w2 = createDummyWav(150) // 300 bytes PCM + 44
  const result = concatWavBuffers([w1, w2])
  assert.equal(result.byteLength, 44 + 200 + 300)

  const view = new DataView(result)
  assert.equal(view.getUint32(40, true), 500) // data length
  assert.equal(view.getUint32(24, true), 24000) // sample rate
})
