import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  rangesOverlap,
  resolveNoOverlapStart,
  isMagneticShotStorylineTrack,
} from '../src/core/timeline/no-overlap.ts'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import { MoveElementsCommand, UpdateElementTransformCommand } from '../src/core/commands/timeline-commands.ts'

test('rangesOverlap detects interval intersection', () => {
  assert.equal(rangesOverlap(0, 10, 5, 10), true)
  assert.equal(rangesOverlap(0, 10, 10, 5), false)
  assert.equal(rangesOverlap(0, 10, 11, 5), false)
})

test('resolveNoOverlapStart snaps to nearest free gap', () => {
  const elements = [
    { id: 'a', startUs: 0, durationUs: 1_000_000 },
    { id: 'b', startUs: 2_000_000, durationUs: 1_000_000 },
    { id: 'moving', startUs: 0, durationUs: 500_000 },
  ]
  // Prefer landing after a when dropping into a
  const afterA = resolveNoOverlapStart(elements, 'moving', 200_000, 500_000)
  assert.equal(afterA, 1_000_000)

  // Prefer landing before b when closer to b's leading edge
  const beforeB = resolveNoOverlapStart(elements, 'moving', 1_800_000, 500_000)
  assert.equal(beforeB, 1_500_000)
})

test('isMagneticShotStorylineTrack only for pure shot tracks', () => {
  assert.equal(
    isMagneticShotStorylineTrack({
      type: 'shot',
      elements: [{ type: 'shot' }, { type: 'shot' }],
    }),
    true,
  )
  assert.equal(
    isMagneticShotStorylineTrack({
      type: 'video',
      elements: [{ type: 'shot' }],
    }),
    false,
  )
})

test('MoveElementsCommand resolves overlap on video track', () => {
  const doc = createEmptyDocument('doc-overlap', 'test')
  const video = doc.tracks.find((t) => t.id === 'track-main-video')
  assert.ok(video)
  video.elements.push(
    {
      id: 'v1',
      type: 'video',
      trackId: video.id,
      startUs: 0,
      durationUs: 2_000_000,
      assetId: 'a1',
      sourceInUs: 0,
      sourceOutUs: 2_000_000,
      rate: 1,
      volume: 1,
      transform: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotationDeg: 0,
        opacity: 1,
        cropMode: 'cover',
        round: 0,
      },
    },
    {
      id: 'v2',
      type: 'video',
      trackId: video.id,
      startUs: 3_000_000,
      durationUs: 1_000_000,
      assetId: 'a2',
      sourceInUs: 0,
      sourceOutUs: 1_000_000,
      rate: 1,
      volume: 1,
      transform: {
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        rotationDeg: 0,
        opacity: 1,
        cropMode: 'cover',
        round: 0,
      },
    },
  )
  const editor = createEditor({ document: doc })
  editor.executeCommand(new MoveElementsCommand([{ elementId: 'v2', newStartUs: 500_000 }]))
  const next = editor.getDocument()
  const moved = next.tracks
    .find((t) => t.id === 'track-main-video')
    ?.elements.find((e) => e.id === 'v2')
  assert.ok(moved)
  assert.equal(moved.startUs, 2_000_000)
})

test('UpdateElementTransformCommand toggles flipX', () => {
  const doc = createEmptyDocument('doc-flip', 'test')
  const video = doc.tracks.find((t) => t.id === 'track-main-video')
  assert.ok(video)
  video.elements.push({
    id: 'v-flip',
    type: 'video',
    trackId: video.id,
    startUs: 0,
    durationUs: 1_000_000,
    assetId: 'a1',
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotationDeg: 0,
      opacity: 1,
      cropMode: 'cover',
      round: 0,
    },
  })
  const editor = createEditor({ document: doc })
  editor.executeCommand(new UpdateElementTransformCommand('v-flip', { flipX: true }))
  let el = editor
    .getDocument()
    .tracks.find((t) => t.id === 'track-main-video')
    ?.elements.find((e) => e.id === 'v-flip')
  assert.equal(el?.transform.flipX, true)
  editor.executeCommand(new UpdateElementTransformCommand('v-flip', { flipX: false }))
  el = editor
    .getDocument()
    .tracks.find((t) => t.id === 'track-main-video')
    ?.elements.find((e) => e.id === 'v-flip')
  assert.equal(el?.transform.flipX, false)
})
