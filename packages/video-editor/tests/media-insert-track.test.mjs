import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import { InsertElementCommand } from '../src/core/commands/timeline-commands.ts'
import {
  findUnlockedTrackByType,
  mediaAssetTargetTrackType,
  resolveInsertTrack,
} from '../src/panels/media/resolve-insert-track.ts'

function shotOnlyDocument() {
  const doc = createEmptyDocument('doc-shot-only', '仅镜头轨')
  doc.tracks = [
    {
      id: 'track-shot',
      type: 'shot',
      name: '镜头轨',
      muted: false,
      hidden: false,
      locked: false,
      elements: [],
    },
  ]
  return doc
}

test('media insert: audio on shot-only doc creates audio track', () => {
  const doc = shotOnlyDocument()
  const editor = createEditor({ document: doc })

  const resolved = resolveInsertTrack(editor, 'audio')
  assert.equal(resolved.ok, true)
  assert.equal(resolved.createdTrack, true)
  assert.equal(resolved.track.type, 'audio')

  const elem = {
    id: 'elem-a-1',
    trackId: resolved.track.id,
    type: 'audio',
    assetId: 'asset-bgm',
    startUs: 0,
    durationUs: 2_000_000,
    sourceInUs: 0,
    sourceOutUs: 2_000_000,
    rate: 1,
    volume: 1,
  }
  editor.executeCommand(new InsertElementCommand(resolved.track.id, elem))

  const next = editor.getDocument()
  assert.equal(next.tracks.length, 2)
  const shotTrack = next.tracks.find((t) => t.type === 'shot')
  const audioTrack = next.tracks.find((t) => t.type === 'audio')
  assert.equal(shotTrack?.elements.length, 0)
  assert.equal(audioTrack?.elements.length, 1)
  assert.equal(audioTrack?.elements[0].type, 'audio')
})

test('media insert: image on shot-only doc creates overlay track', () => {
  const doc = shotOnlyDocument()
  const editor = createEditor({ document: doc })

  const resolved = resolveInsertTrack(editor, 'overlay')
  assert.equal(resolved.ok, true)
  assert.equal(resolved.createdTrack, true)
  assert.equal(resolved.track.type, 'overlay')
})

test('media insert: reuses existing audio track without creating another', () => {
  const doc = createEmptyDocument('doc-full', '完整轨')
  const editor = createEditor({ document: doc })
  const beforeCount = editor.getDocument().tracks.filter((t) => t.type === 'audio').length

  const first = resolveInsertTrack(editor, 'audio')
  const second = resolveInsertTrack(editor, 'audio')

  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  assert.equal(first.createdTrack, false)
  assert.equal(second.createdTrack, false)
  assert.equal(first.track.id, second.track.id)
  assert.equal(
    editor.getDocument().tracks.filter((t) => t.type === 'audio').length,
    beforeCount,
  )
})

test('mediaAssetTargetTrackType maps mime types', () => {
  assert.equal(mediaAssetTargetTrackType({ mimeType: 'audio/mpeg' }), 'audio')
  assert.equal(mediaAssetTargetTrackType({ mimeType: 'video/mp4' }), 'video')
  assert.equal(mediaAssetTargetTrackType({ mimeType: 'image/png' }), 'overlay')
})

test('findUnlockedTrackByType skips locked tracks', () => {
  const doc = shotOnlyDocument()
  doc.tracks.push({
    id: 'track-audio-locked',
    type: 'audio',
    name: '配音轨',
    muted: false,
    hidden: false,
    locked: true,
    elements: [],
  })
  assert.equal(findUnlockedTrackByType(doc, 'audio'), undefined)
})
