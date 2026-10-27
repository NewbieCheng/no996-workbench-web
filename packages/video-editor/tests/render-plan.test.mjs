import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { buildRenderPlan, sceneAtTime, audioAtTime } from '../src/render/plan.ts'
import { evaluateChannelValue, evaluateAudioGain } from '../src/render/evaluator.ts'

test('render-plan: sceneAtTime correctly selects active elements and captions', () => {
  const doc = createEmptyDocument('doc-render', '渲染测试')
  doc.durationUs = 5_000_000

  // 轨道 1：主视频 [0, 3s)
  doc.tracks[0].elements.push({
    id: 'clip-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 3_000_000,
    sourceInUs: 0,
    sourceOutUs: 3_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 1080, height: 1920, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  })

  // 字幕 [1s, 2.5s)
  doc.captions.push({
    id: 'cue-1',
    startUs: 1_000_000,
    durationUs: 1_500_000,
    text: '渲染口播字幕',
    timingSource: 'srt',
  })

  const plan = buildRenderPlan(doc)

  // 0.5s 时：命中 clip-1，localTimeUs=500_000，无字幕
  const sceneAt05 = sceneAtTime(plan, 500_000)
  assert.equal(sceneAt05.items.length, 1)
  assert.equal(sceneAt05.items[0].element.id, 'clip-1')
  assert.equal(sceneAt05.items[0].localTimeUs, 500_000)
  assert.equal(sceneAt05.activeCaption, undefined)

  // 1.5s 时：命中 clip-1 与字幕 cue-1
  const sceneAt15 = sceneAtTime(plan, 1_500_000)
  assert.equal(sceneAt15.items.length, 1)
  assert.equal(sceneAt15.activeCaption?.text, '渲染口播字幕')

  // 4s 时：超出 clip-1 范围，无元素
  const sceneAt40 = sceneAtTime(plan, 4_000_000)
  assert.equal(sceneAt40.items.length, 0)
  assert.equal(sceneAt40.activeCaption, undefined)
})

test('render-plan: audioAtTime captures audio elements and handles muted track', () => {
  const doc = createEmptyDocument('doc-audio', '音频测试')

  doc.tracks[1].elements.push({
    id: 'audio-1',
    trackId: 'track-voice-audio',
    type: 'audio',
    assetId: 'voice-1',
    startUs: 0,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 0.8,
  })

  const plan = buildRenderPlan(doc)
  const audioSnap = audioAtTime(plan, 1_000_000)
  assert.equal(audioSnap.activeAudioItems.length, 1)
  assert.equal(audioSnap.activeAudioItems[0].volume, 0.8)

  // 静音轨道
  doc.tracks[1].muted = true
  const planMuted = buildRenderPlan(doc)
  const audioSnapMuted = audioAtTime(planMuted, 1_000_000)
  assert.equal(audioSnapMuted.activeAudioItems[0].volume, 0)
})

test('evaluator: keyframe linear and bezier interpolation', () => {
  const channel = {
    propertyPath: 'transform.opacity',
    keyframes: [
      { id: 'k1', timeUs: 0, value: 0, easing: 'linear' },
      { id: 'k2', timeUs: 1_000_000, value: 100, easing: 'linear' },
    ],
  }

  // 中间点 500ms
  assert.equal(evaluateChannelValue(channel, 500_000, 0), 50)
  // 左端点
  assert.equal(evaluateChannelValue(channel, 0, 0), 0)
  // 右端点
  assert.equal(evaluateChannelValue(channel, 1_000_000, 0), 100)
  // 超界保护
  assert.equal(evaluateChannelValue(channel, 2_000_000, 0), 100)
  assert.equal(evaluateChannelValue(channel, -100, 0), 0)
})

test('evaluator: audio fadeIn and fadeOut gain curves', () => {
  const audioClip = {
    id: 'clip-a',
    trackId: 'track-a',
    type: 'audio',
    assetId: 'a1',
    startUs: 0,
    durationUs: 4_000_000,
    sourceInUs: 0,
    sourceOutUs: 4_000_000,
    rate: 1,
    volume: 1.0,
    fadeInUs: 1_000_000, // 前 1 秒淡入
    fadeOutUs: 1_000_000, // 后 1 秒淡出
  }

  // 0s 时：淡入起点为 0
  assert.equal(evaluateAudioGain(audioClip, 0), 0)
  // 0.5s 时：淡入中点为 0.5
  assert.equal(evaluateAudioGain(audioClip, 500_000), 0.5)
  // 2.0s 时：全开为 1.0
  assert.equal(evaluateAudioGain(audioClip, 2_000_000), 1.0)
  // 3.5s 时：淡出中点为 0.5
  assert.equal(evaluateAudioGain(audioClip, 3_500_000), 0.5)
  // 4.0s 时：淡出末尾为 0
  assert.equal(evaluateAudioGain(audioClip, 4_000_000), 0)
})
