import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateEasingCurve,
  interpolateColorHex,
  interpolateKeyframes,
} from '../src/core/keyframes/registry.ts'
import {
  adjustKeyframesOnTrimLeft,
  adjustKeyframesOnTrimRight,
} from '../src/core/keyframes/anchor.ts'
import {
  SetKeyframeCommand,
  RemoveKeyframeCommand,
} from '../src/core/keyframes/commands.ts'
import {
  mapPlaybackToSourceTimeUs,
  computeDurationFromRate,
} from '../src/core/speed/mapping.ts'
import {
  SetClipSpeedCommand,
  SetClipReverseCommand,
  FreezeFrameCommand,
} from '../src/core/speed/commands.ts'
import {
  evaluateTransitionProgress,
} from '../src/core/transitions/transition-evaluator.ts'
import {
  AddTransitionCommand,
  RemoveTransitionCommand,
} from '../src/core/transitions/commands.ts'
import {
  buildCanvasFilterString,
  applyBrightnessContrast,
} from '../src/core/effects/effects-evaluator.ts'
import {
  UpdateElementEffectsCommand,
} from '../src/core/effects/commands.ts'
import {
  softClipLimiter,
  isTrackAudible,
  mixAudioTracksAtTime,
} from '../src/core/audio/mixer.ts'
import {
  UpdateAudioEnvelopeCommand,
} from '../src/core/audio/commands.ts'
import { createEmptyDocument } from '../src/core/project.ts'

// ---------------- S6-01 关键帧测试 ----------------
test('s6-01: keyframe evaluation, color lerp, trim anchoring and command undo/redo', () => {
  // 1. 数字插值
  const keyframesNum = [
    { id: 'k1', timeUs: 1_000_000, value: 100, easing: 'linear' },
    { id: 'k2', timeUs: 3_000_000, value: 300, easing: 'linear' },
  ]
  // 关键帧前：返回第一帧值
  assert.equal(interpolateKeyframes(keyframesNum, 500_000, 'number', 0), 100)
  // 关键帧中：线性插值 50% 位置 (2_000_000us)
  assert.equal(interpolateKeyframes(keyframesNum, 2_000_000, 'number', 0), 200)
  // 关键帧后：返回最后一帧值
  assert.equal(interpolateKeyframes(keyframesNum, 4_000_000, 'number', 0), 300)

  // 2. 颜色插值 (#000000 -> #ffffff)
  const keyframesColor = [
    { id: 'kc1', timeUs: 0, value: '#000000', easing: 'linear' },
    { id: 'kc2', timeUs: 2_000_000, value: '#ffffff', easing: 'linear' },
  ]
  const midColor = interpolateKeyframes(keyframesColor, 1_000_000, 'color', '#000000')
  assert.equal(midColor, '#808080')

  // 3. 裁切时锚点调整：左端裁掉 1_500_000us
  const channel = { propertyPath: 'transform.x', keyframes: keyframesNum }
  const trimmed = adjustKeyframesOnTrimLeft(channel, 1_500_000)
  // 原在 3_000_000us 的帧应平移到 1_500_000us，并在 0us 处自动补齐平移锚点
  assert.equal(trimmed.keyframes.length, 2)
  assert.equal(trimmed.keyframes[0].timeUs, 0)
  assert.equal(trimmed.keyframes[1].timeUs, 1_500_000)

  // 4. 命令 execute / undo
  const doc = createEmptyDocument('doc-kf', '测试')
  const v = {
    id: 'v-clip',
    trackId: doc.tracks[0].id,
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 5_000_000,
    sourceInUs: 0,
    sourceOutUs: 5_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }
  doc.tracks[0].elements = [v]

  const setKfCmd = new SetKeyframeCommand('v-clip', 'transform.opacity', {
    id: 'kf-op-1',
    timeUs: 1_000_000,
    value: 0.5,
    easing: 'easeIn',
  })
  const resSet = setKfCmd.execute(doc)
  const channels = resSet.document.tracks[0].elements[0].animations?.channels
  assert.ok(channels?.['transform.opacity'])
  assert.equal(channels['transform.opacity'].keyframes[0].value, 0.5)

  // 撤销命令
  const undone = setKfCmd.undo(resSet.document)
  assert.equal(undone.document.tracks[0].elements[0].animations, undefined)
})

// ---------------- S6-02 速度、反放与冻结测试 ----------------
test('s6-02: speed rate mapping, reverse playback, freeze frame and commands', () => {
  const clip = {
    id: 'v1',
    trackId: 't1',
    type: 'video',
    assetId: 'a1',
    startUs: 0,
    durationUs: 4_000_000,
    sourceInUs: 1_000_000,
    sourceOutUs: 5_000_000,
    rate: 2.0, // 2倍速
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  }

  // 2倍速下播放 1s (1_000_000us)，消耗 2s 源素材: 1_000_000 + 2_000_000 = 3_000_000us
  const srcUs = mapPlaybackToSourceTimeUs(clip, 1_000_000)
  assert.equal(srcUs, 3_000_000)

  // 开启反放：从 sourceOutUs (5_000_000us) 开始倒退
  clip.reverse = true
  const revUs = mapPlaybackToSourceTimeUs(clip, 1_000_000)
  assert.equal(revUs, 3_000_000) // 5_000_000 - 2_000_000 = 3_000_000

  // 冻结帧：锁定在 2_500_000us
  clip.freeze = { sourceTimeUs: 2_500_000 }
  assert.equal(mapPlaybackToSourceTimeUs(clip, 500_000), 2_500_000)
  assert.equal(mapPlaybackToSourceTimeUs(clip, 3_000_000), 2_500_000)

  // 命令测试：变速命令使得工程时长更新
  const doc = createEmptyDocument('doc-speed', '测试')
  doc.tracks[0].elements = [{ ...clip, freeze: undefined, reverse: false, rate: 1.0, durationUs: 4_000_000 }]
  doc.durationUs = 4_000_000

  const speedCmd = new SetClipSpeedCommand('v1', 2.0)
  const speedRes = speedCmd.execute(doc)
  // 4s 源素材在 2 倍速下变为 2s 时长
  assert.equal(speedRes.document.tracks[0].elements[0].durationUs, 2_000_000)
  assert.equal(speedRes.document.durationUs, 2_000_000)

  const undone = speedCmd.undo(speedRes.document)
  assert.equal(undone.document.tracks[0].elements[0].durationUs, 4_000_000)
})

// ---------------- S6-03 转场系统测试 ----------------
test('s6-03: transition progress, dual-frame opacity and wipe rect', () => {
  const transCrossfade = {
    id: 'tr-1',
    kind: 'crossfade',
    durationUs: 2_000_000,
    fromElementId: 'c1',
    toElementId: 'c2',
  }

  // progress 0: A 全显，B 全隐
  const p0 = evaluateTransitionProgress(transCrossfade, 0)
  assert.equal(p0.progress, 0)
  assert.equal(p0.opacityA, 1)
  assert.equal(p0.opacityB, 0)

  // progress 0.5: 各 50%
  const pMid = evaluateTransitionProgress(transCrossfade, 1_000_000)
  assert.equal(pMid.progress, 0.5)
  assert.equal(pMid.opacityA, 0.5)
  assert.equal(pMid.opacityB, 0.5)

  // progress 1: A 全隐，B 全显
  const p1 = evaluateTransitionProgress(transCrossfade, 2_000_000)
  assert.equal(p1.progress, 1)
  assert.equal(p1.opacityA, 0)
  assert.equal(p1.opacityB, 1)

  // wipe (方向擦除) 在 50% 处的剪裁矩形
  const transWipe = { ...transCrossfade, kind: 'wipe' }
  const pWipe = evaluateTransitionProgress(transWipe, 1_000_000, 1920, 1080)
  assert.equal(pWipe.wipeClipRectB?.width, 960)
  assert.equal(pWipe.wipeClipRectB?.height, 1080)
})

// ---------------- S6-04 视觉效果与滤镜测试 ----------------
test('s6-04: canvas filter string generation and pixel adjustment', () => {
  const effects = [
    { id: 'e1', kind: 'brightness', enabled: true, intensity: 1.2 },
    { id: 'e2', kind: 'contrast', enabled: true, intensity: 1.1 },
    { id: 'e3', kind: 'grayscale', enabled: false, intensity: 0.8 }, // 禁用状态不应进 filter 串
    { id: 'e4', kind: 'blur', enabled: true, intensity: 5 },
  ]

  const filterStr = buildCanvasFilterString(effects)
  assert.equal(filterStr, 'brightness(1.2) contrast(1.1) blur(5px)')

  // 纯数学像素调整测试
  const [r, g, b] = applyBrightnessContrast(100, 100, 100, 1.2, 1.0)
  assert.equal(r, 120)
  assert.equal(g, 120)
  assert.equal(b, 120)
})

// ---------------- S6-05 多轨混音与软限幅测试 ----------------
test('s6-05: audio mixing, solo/mute resolution and soft-clipping limiter', () => {
  // 1. 软限幅器断言：任何极大值输入均平滑映射至 [-1.0, 1.0]
  assert.ok(softClipLimiter(0.5) === 0.5)
  assert.ok(softClipLimiter(2.0) <= 1.0 && softClipLimiter(2.0) > 0.8)
  assert.ok(softClipLimiter(-5.0) >= -1.0 && softClipLimiter(-5.0) < -0.8)

  // 2. Solo 优先级测试
  const tracks = [
    { id: 't1', type: 'audio', name: '配音', muted: false, solo: true, locked: false, hidden: false, elements: [] },
    { id: 't2', type: 'audio', name: 'BGM', muted: false, solo: false, locked: false, hidden: false, elements: [] },
  ]
  // 只要有任意轨 solo=true，非 solo 轨即便 muted=false 也是不可出声
  assert.equal(isTrackAudible(tracks[0], tracks), true)
  assert.equal(isTrackAudible(tracks[1], tracks), false)

  // 3. 多源可预测混音
  const audioElem1 = {
    id: 'a1',
    trackId: 't1',
    type: 'audio',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 0.8,
  }
  const audioElem2 = {
    id: 'a2',
    trackId: 't2',
    type: 'audio',
    assetId: 'asset-2',
    startUs: 0,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 0.5,
  }
  tracks[0].solo = false
  tracks[0].elements = [audioElem1]
  tracks[1].elements = [audioElem2]

  // 指定采样发生器恒为 1.0
  const mixRes = mixAudioTracksAtTime(tracks, 500_000, () => 1.0)
  assert.equal(mixRes.activeSources.length, 2)
  // rawSum = 1.0 * 0.8 + 1.0 * 0.5 = 1.3
  assert.equal(Math.round(mixRes.rawSum * 10) / 10, 1.3)
  // 软限幅后必须严格 <= 1.0 且大于 0.6
  assert.ok(mixRes.limitedOutput <= 1.0)
  assert.ok(mixRes.limitedOutput > 0.6)
})
