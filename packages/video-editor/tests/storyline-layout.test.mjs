import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { DuplicateElementsCommand } from '../src/core/commands/track-commands.ts'
import { MoveElementsCommand } from '../src/core/commands/timeline-commands.ts'
import { reflowStorylineMoves } from '../src/panels/timeline/storyline-layout.ts'

test('reflowStorylineMoves packs shots from zero without gaps', () => {
  const shots = [
    { id: 'a', type: 'shot', shotId: 's1', startUs: 0, durationUs: 2_000_000 },
    { id: 'b', type: 'shot', shotId: 's2', startUs: 9_000_000, durationUs: 1_500_000 },
  ]
  const moves = reflowStorylineMoves(shots)
  assert.deepEqual(moves, [
    { elementId: 'a', newStartUs: 0 },
    { elementId: 'b', newStartUs: 2_000_000 },
  ])
})

test('storyline duplicate then reflow removes overlap', () => {
  const doc = createEmptyDocument('doc-storyline-dup', 'test')
  const shotTrack = doc.tracks.find((t) => t.type === 'shot')
  assert.ok(shotTrack)

  shotTrack.elements = [
    {
      id: 'shot-a',
      type: 'shot',
      trackId: shotTrack.id,
      shotId: 'opening/a',
      startUs: 0,
      durationUs: 2_000_000,
      sourceDurationFrames: 60,
      rate: 1,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    },
    {
      id: 'shot-b',
      type: 'shot',
      trackId: shotTrack.id,
      shotId: 'opening/b',
      startUs: 2_000_000,
      durationUs: 3_000_000,
      sourceDurationFrames: 90,
      rate: 1,
      transform: { x: 0, y: 0, width: 1920, height: 1080, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
    },
  ]

  const dupRes = new DuplicateElementsCommand(['shot-a']).execute(doc)
  const afterDup = dupRes.document
  const dupTrack = afterDup.tracks.find((t) => t.id === shotTrack.id)
  assert.equal(dupTrack.elements.length, 3)

  const shots = dupTrack.elements.filter((e) => e.type === 'shot')
  const moves = reflowStorylineMoves(shots)
  const reflowRes = new MoveElementsCommand(moves).execute(afterDup)
  const packed = reflowRes.document.tracks.find((t) => t.id === shotTrack.id).elements
  const sorted = [...packed].sort((a, b) => a.startUs - b.startUs)
  let cursor = 0
  for (const shot of sorted) {
    assert.equal(shot.startUs, cursor)
    cursor += shot.durationUs
  }
  assert.equal(cursor, 7_000_000)
})
