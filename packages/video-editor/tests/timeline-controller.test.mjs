import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  timeUsToPixels,
  pixelsToTimeUs,
  computeRulerTicks,
} from '../src/panels/timeline/zoom-scale.ts'
import {
  resolveSnapping,
  collectSnapReferencePoints,
} from '../src/panels/timeline/snapping.ts'
import {
  computeBoxSelection,
  filterUnlockedSelection,
} from '../src/panels/timeline/selection-box.ts'
import { computeNudgeMoves } from '../src/panels/timeline/nudge-logic.ts'
import {
  computeRippleShifts,
  validateElementMoves,
} from '../src/panels/timeline/ripple-logic.ts'
import { computeTrimFromOrigin, createTrimOrigin } from '../src/panels/timeline/trim-session.ts'
import {
  applyStorylineOriginStarts,
  computeStorylineLayout,
  storylineProbeUs,
} from '../src/panels/timeline/storyline-layout.ts'
import { canMoveElementToTrack } from '../src/core/commands/timeline-commands.ts'
import {
  updateLinkedCaptions,
  splitLinkedCaptions,
  validateTransitionBoundaries,
} from '../src/panels/timeline/caption-link-logic.ts'

test('timeline-controller: zoom-scale converts reversibly and ticks scale with zoom', () => {
  const timeUs = 2_500_000 // 2.5s
  const zoom = 1.5

  const px = timeUsToPixels(timeUs, zoom)
  const convertedUs = pixelsToTimeUs(px, zoom)
  assert.equal(convertedUs, timeUs)
  assert.equal(pixelsToTimeUs(-100, 1.0), -1_000_000)

  // 不同的缩放级别下，主刻度间隔按阶梯自动缩放
  const ticks1x = computeRulerTicks(10_000_000, 1.0)
  const ticks4x = computeRulerTicks(10_000_000, 4.0)
  assert.ok(ticks1x.length > 0)
  assert.ok(ticks4x.length >= ticks1x.length)
})

test('timeline-controller: snapping threshold adapts to zoom and snaps to nearest point', () => {
  const references = [0, 1_000_000, 2_000_000, 5_000_000]

  // 在 zoom=1.0 时，8px 大约对应 80_000 us (因为 100px = 1_000_000us)
  // 当 targetTimeUs 为 950_000 us 时，距离 1_000_000 是 50_000 us，在 80_000 us 内，应该吸附
  const resSnap = resolveSnapping(950_000, references, 1.0, 8)
  assert.equal(resSnap.hasSnapped, true)
  assert.equal(resSnap.snappedTimeUs, 1_000_000)

  // 超过阈值则不吸附
  const resNoSnap = resolveSnapping(800_000, references, 1.0, 8)
  assert.equal(resNoSnap.hasSnapped, false)
  assert.equal(resNoSnap.snappedTimeUs, 800_000)
})

test('timeline-controller: box selection NEVER selects elements on locked tracks', () => {
  const tracks = [
    {
      id: 'track-1',
      name: '正常轨',
      locked: false,
      muted: false,
      hidden: false,
      type: 'video',
      elements: [
        { id: 'el-1', trackId: 'track-1', startUs: 1_000_000, durationUs: 2_000_000 },
      ],
    },
    {
      id: 'track-locked',
      name: '锁定轨',
      locked: true,
      muted: false,
      hidden: false,
      type: 'video',
      elements: [
        { id: 'el-locked', trackId: 'track-locked', startUs: 1_500_000, durationUs: 2_000_000 },
      ],
    },
  ]

  // 框选范围 1.0s ~ 3.0s，两者均在范围内
  const selected = computeBoxSelection(
    { startUs: 1_000_000, endUs: 3_000_000 },
    tracks,
    [],
    false
  )

  assert.ok(selected.includes('el-1'))
  assert.ok(!selected.includes('el-locked'), '锁定轨上的元素绝不能被框选')
})

test('timeline-controller: nudge calculation prevents negative start time and locked track moves', () => {
  const tracks = [
    {
      id: 'track-1',
      name: '可移动轨',
      locked: false,
      muted: false,
      hidden: false,
      type: 'video',
      elements: [
        { id: 'el-1', trackId: 'track-1', startUs: 500_000, durationUs: 1_000_000 },
      ],
    },
    {
      id: 'track-locked',
      name: '锁死轨',
      locked: true,
      muted: false,
      hidden: false,
      type: 'audio',
      elements: [
        { id: 'el-locked', trackId: 'track-locked', startUs: 500_000, durationUs: 1_000_000 },
      ],
    },
  ]

  // 试图左移 1_000_000 us (超出了 500_000 us)，应自动截断为 0，且 locked 轨元素不产生移动
  const moves = computeNudgeMoves(['el-1', 'el-locked'], -1_000_000, tracks)
  assert.equal(moves.length, 1)
  assert.equal(moves[0].elementId, 'el-1')
  assert.equal(moves[0].newStartUs, 0)
})

test('timeline-controller: ripple shifts trailing elements without negative time', () => {
  const elements = [
    { id: 'el-1', trackId: 't1', startUs: 0, durationUs: 2_000_000 },
    { id: 'el-2', trackId: 't1', startUs: 2_000_000, durationUs: 3_000_000 },
    { id: 'el-3', trackId: 't1', startUs: 6_000_000, durationUs: 1_000_000 },
  ]

  // 删除 el-1 (startUs=0, duration=2_000_000)
  const shifts = computeRippleShifts(elements, 0, 2_000_000)
  assert.equal(shifts.length, 3)

  const shiftMap = new Map(shifts.map((s) => [s.elementId, s.newStartUs]))
  assert.equal(shiftMap.get('el-2'), 0) // 从 2s 移动到 0s
  assert.equal(shiftMap.get('el-3'), 4_000_000) // 从 6s 移动到 4s

  assert.equal(validateElementMoves(elements, shiftMap), true)
})

test('timeline-controller: caption linking and transition boundary validation', () => {
  const captions = [
    { id: 'cue-1', startUs: 1_000_000, durationUs: 2_000_000, text: '第一句', boundClipId: 'clip-A', timingSource: 'manual' },
    { id: 'cue-2', startUs: 4_000_000, durationUs: 2_000_000, text: '第二句', boundClipId: 'clip-B', timingSource: 'manual' },
  ]

  // clip-A 移动了 +500_000 us
  const linked = updateLinkedCaptions(captions, [{ clipId: 'clip-A', deltaUs: 500_000 }])
  assert.equal(linked[0].startUs, 1_500_000)
  assert.equal(linked[1].startUs, 4_000_000) // clip-B 不受影响

  // clip-A 在 2_000_000 处被分割
  const splitCues = splitLinkedCaptions(captions, 'clip-A', 2_000_000, 'clip-A2')
  assert.equal(splitCues.length, 3)
  assert.equal(splitCues[0].durationUs, 1_000_000)
  assert.equal(splitCues[1].startUs, 2_000_000)
  assert.equal(splitCues[1].boundClipId, 'clip-A2')

  // 转场边界校验：相邻元素
  const clip1 = { id: 'c1', startUs: 0, durationUs: 3_000_000 }
  const clip2 = { id: 'c2', startUs: 3_000_000, durationUs: 3_000_000 }
  const validTransition = { id: 't1', durationUs: 1_000_000, leftClipId: 'c1', rightClipId: 'c2' }
  assert.equal(validateTransitionBoundaries(validTransition, clip1, clip2).valid, true)

  // 超长转场应校验失败
  const invalidTransition = { id: 't2', durationUs: 4_000_000, leftClipId: 'c1', rightClipId: 'c2' }
  assert.equal(validateTransitionBoundaries(invalidTransition, clip1, clip2).valid, false)
})

test('timeline-controller: trim session uses origin + cumulative delta (not double accumulation)', () => {
  const origin = {
    elementId: 'el-1',
    edge: 'end',
    originStartUs: 1_000_000,
    originDurationUs: 2_000_000,
  }
  const first = computeTrimFromOrigin(origin, 50, 1.0)
  const second = computeTrimFromOrigin(origin, 100, 1.0)
  assert.equal(first.durationUs, 2_500_000)
  assert.equal(second.durationUs, 3_000_000)
})

test('timeline-controller: trim start edge shrinks duration from origin', () => {
  const shot = {
    id: 's1',
    type: 'shot',
    startUs: 0,
    durationUs: 3_000_000,
    trackId: 't1',
    shotId: 'x/y',
    sourceDurationFrames: 90,
    rate: 1,
    transform: {},
  }
  const origin = createTrimOrigin(shot, 'start')
  const trimmed = computeTrimFromOrigin(origin, 100, 1.0)
  assert.equal(trimmed.startUs, 1_000_000)
  assert.equal(trimmed.durationUs, 2_000_000)
})

test('timeline-controller: storyline reorder keeps shots contiguous from zero', () => {
  const shots = [
    { id: 'a', type: 'shot', startUs: 0, durationUs: 1_000_000, trackId: 't', shotId: 'a', sourceDurationFrames: 30, rate: 1, transform: {} },
    { id: 'b', type: 'shot', startUs: 1_000_000, durationUs: 2_000_000, trackId: 't', shotId: 'b', sourceDurationFrames: 60, rate: 1, transform: {} },
    { id: 'c', type: 'shot', startUs: 3_000_000, durationUs: 1_000_000, trackId: 't', shotId: 'c', sourceDurationFrames: 30, rate: 1, transform: {} },
  ]
  const moves = computeStorylineLayout(shots, 'c', 0)
  const starts = moves.map((m) => m.newStartUs).sort((a, b) => a - b)
  assert.deepEqual(starts, [0, 1_000_000, 2_000_000])
  assert.equal(moves.find((m) => m.elementId === 'c')?.newStartUs, 0)
  assert.equal(moves.length, 3)
})

test('timeline-controller: storyline can swap a longer clip forward past a shorter neighbor', () => {
  const shots = [
    { id: 'short', type: 'shot', startUs: 0, durationUs: 2_000_000, trackId: 't', shotId: 'short', sourceDurationFrames: 60, rate: 1, transform: {} },
    { id: 'long', type: 'shot', startUs: 2_000_000, durationUs: 5_500_000, trackId: 't', shotId: 'long', sourceDurationFrames: 165, rate: 1, transform: {} },
  ]
  const probeUs = storylineProbeUs(2_000_000, 5_500_000, -4_000_000)
  const moves = computeStorylineLayout(shots, 'long', probeUs)
  assert.ok(probeUs < 1_000_000)
  assert.equal(moves.find((m) => m.elementId === 'long')?.newStartUs, 0)
  assert.equal(moves.find((m) => m.elementId === 'short')?.newStartUs, 5_500_000)
})

test('timeline-controller: storyline insert uses origin starts not live preview positions', () => {
  const origin = [
    { id: 'a', type: 'shot', startUs: 0, durationUs: 1_000_000, trackId: 't', shotId: 'a', sourceDurationFrames: 30, rate: 1, transform: {} },
    { id: 'b', type: 'shot', startUs: 1_000_000, durationUs: 1_000_000, trackId: 't', shotId: 'b', sourceDurationFrames: 30, rate: 1, transform: {} },
  ]
  const liveMutated = applyStorylineOriginStarts(
    [
      { ...origin[0], startUs: 1_000_000 },
      { ...origin[1], startUs: 1_000_000 },
    ],
    new Map(origin.map((s) => [s.id, s.startUs])),
  )
  const probeUs = storylineProbeUs(1_000_000, 1_000_000, -1_200_000)
  const moves = computeStorylineLayout(liveMutated, 'b', probeUs)
  assert.equal(moves.find((m) => m.elementId === 'b')?.newStartUs, 0)
  assert.equal(moves.find((m) => m.elementId === 'a')?.newStartUs, 1_000_000)
})

test('timeline-controller: cross-track compatibility matrix', () => {
  assert.equal(canMoveElementToTrack('shot', 'video'), false)
  assert.equal(canMoveElementToTrack('text', 'text'), true)
  assert.equal(canMoveElementToTrack('text', 'audio'), false)
  assert.equal(canMoveElementToTrack('audio', 'audio'), true)
})

test('timeline-controller: element display name fallback order', () => {
  const assets = {
    'asset-video-1': { name: '数字人成片_片段1.mp4' },
  }

  // 1. 有资产时命中资产名称
  const assetClip = { id: 'clip-1', type: 'video', assetId: 'asset-video-1' }
  const labelWithAsset = assetClip.type === 'text' ? assetClip.text : (assets[assetClip.assetId]?.name || assetClip.id)
  assert.equal(labelWithAsset, '数字人成片_片段1.mp4')

  // 2. 文本片段显示文本正文
  const textClip = { id: 'clip-2', type: 'text', text: '大家好这是大标题' }
  const labelText = textClip.type === 'text' ? textClip.text : textClip.id
  assert.equal(labelText, '大家好这是大标题')
})
