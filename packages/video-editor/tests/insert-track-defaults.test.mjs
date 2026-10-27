import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import {
  SetDefaultInsertTrackCommand,
  isDefaultInsertTrack,
  resolveDefaultInsertTrack,
} from '../src/core/commands/insert-track-defaults.ts'
import { DeleteTrackCommand } from '../src/core/commands/track-commands.ts'
import { findUnlockedTrackByType } from '../src/panels/media/resolve-insert-track.ts'

test('SetDefaultInsertTrackCommand marks only one visual default', () => {
  const doc = createEmptyDocument('doc-d', 'test')
  const editor = createEditor({ document: doc })
  const newId = 'track-video-user-1'
  doc.tracks.push({
    id: newId,
    type: 'video',
    name: '视频轨 1',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  editor.setDocument(doc)
  editor.executeCommand(new SetDefaultInsertTrackCommand(newId))

  const next = editor.getDocument()
  assert.equal(isDefaultInsertTrack(next, newId), true)
  assert.equal(isDefaultInsertTrack(next, 'track-shot'), false)
  assert.equal(isDefaultInsertTrack(next, 'track-main-video'), false)
  assert.equal(resolveDefaultInsertTrack(next, 'video')?.id, newId)
})

test('fresh doc: only shot is visual default star among shot and main video', () => {
  const doc = createEmptyDocument('doc-star', 'test')
  assert.equal(isDefaultInsertTrack(doc, 'track-shot'), true)
  assert.equal(isDefaultInsertTrack(doc, 'track-main-video'), false)
  assert.equal(isDefaultInsertTrack(doc, 'track-title-text'), true)
})

test('deleting default track reassigns category fallback', () => {
  const doc = createEmptyDocument('doc-e', 'test')
  const editor = createEditor({ document: doc })
  const userTrackId = 'track-video-user-2'
  doc.tracks.push({
    id: userTrackId,
    type: 'video',
    name: '视频轨 2',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  editor.setDocument(doc)
  editor.executeCommand(new SetDefaultInsertTrackCommand(userTrackId))
  editor.executeCommand(new DeleteTrackCommand(userTrackId))

  const next = editor.getDocument()
  const visualDefault = resolveDefaultInsertTrack(next, 'video')
  assert.ok(visualDefault)
  assert.equal(visualDefault.id, 'track-main-video')
})

test('SetDefaultInsertTrackCommand undo restores previous category defaults', () => {
  const doc = createEmptyDocument('doc-f', 'test')
  const userTrackId = 'track-video-user-3'
  doc.tracks.push({
    id: userTrackId,
    type: 'video',
    name: '视频轨 3',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  const editor = createEditor({ document: doc })
  editor.executeCommand(new SetDefaultInsertTrackCommand(userTrackId))
  assert.equal(resolveDefaultInsertTrack(editor.getDocument(), 'video')?.id, userTrackId)
  editor.undo()
  assert.equal(resolveDefaultInsertTrack(editor.getDocument(), 'video')?.id, 'track-main-video')
})

test('storyline shot insert follows visual star when default is video', () => {
  const doc = createEmptyDocument('doc-g', 'test')
  const editor = createEditor({ document: doc })
  const userTrackId = 'track-video-user-4'
  doc.tracks.push({
    id: userTrackId,
    type: 'video',
    name: '视频轨 4',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  editor.setDocument(doc)
  editor.executeCommand(new SetDefaultInsertTrackCommand(userTrackId))
  const next = editor.getDocument()
  assert.equal(resolveDefaultInsertTrack(next, 'shot')?.id, userTrackId)
  assert.equal(resolveDefaultInsertTrack(next, 'video')?.id, userTrackId)
})

test('single track in category shows as default', () => {
  const doc = createEmptyDocument('doc-h', 'test')
  doc.tracks = doc.tracks.filter((track) => track.type !== 'video' && track.type !== 'overlay')
  assert.equal(isDefaultInsertTrack(doc, 'track-shot'), true)
})
