import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  secondsToTimeUs,
  timeUsToSeconds,
  frameIndexToTimeUs,
  timeUsToFrameIndex,
  durationToTotalFrames,
  formatTimeCode,
  timeSpanContains,
  mapSourceTimeUs,
  ONE_SECOND_US,
} from '../src/core/time.ts'

test('time: secondsToTimeUs and timeUsToSeconds roundtrip', () => {
  assert.equal(secondsToTimeUs(1.5), 1_500_000)
  assert.equal(secondsToTimeUs(0), 0)
  assert.equal(timeUsToSeconds(1_500_000), 1.5)
  assert.equal(timeUsToSeconds(0), 0)
})

test('time: frameIndex and timeUs conversion at 30 fps', () => {
  const fps = { num: 30, den: 1 }
  // 30 fps: 每帧恰好 33333 微秒 (1/30 = 0.0333333...)
  assert.equal(frameIndexToTimeUs(0, fps), 0)
  assert.equal(frameIndexToTimeUs(30, fps), ONE_SECOND_US)
  assert.equal(timeUsToFrameIndex(ONE_SECOND_US, fps), 30)
  assert.equal(timeUsToFrameIndex(500_000, fps), 15)
})

test('time: durationToTotalFrames calculation', () => {
  const fps = { num: 30, den: 1 }
  assert.equal(durationToTotalFrames(1_000_000, fps), 30)
  assert.equal(durationToTotalFrames(100_000, fps), 3) // 0.1s -> 3 frames
  assert.equal(durationToTotalFrames(0, fps), 0)
})

test('time: formatTimeCode formatting', () => {
  const fps = { num: 30, den: 1 }
  // 1小时 2分 3秒 15帧
  const timeUs = (3600 + 120 + 3) * ONE_SECOND_US + 500_000
  assert.equal(formatTimeCode(timeUs, fps), '01:02:03:15')
  assert.equal(formatTimeCode(0, fps), '00:00:00:00')
})

test('time: timeSpanContains half-open range', () => {
  const span = { startUs: 1000, durationUs: 2000 } // [1000, 3000)
  assert.equal(timeSpanContains(span, 1000), true)
  assert.equal(timeSpanContains(span, 2999), true)
  assert.equal(timeSpanContains(span, 3000), false) // 排除端点
  assert.equal(timeSpanContains(span, 999), false)
})

test('time: mapSourceTimeUs supports rate and in point', () => {
  // 2倍速播放，源入点为 500_000
  const mapped = mapSourceTimeUs(200_000, 500_000, 2.0)
  assert.equal(mapped, 900_000)
})
