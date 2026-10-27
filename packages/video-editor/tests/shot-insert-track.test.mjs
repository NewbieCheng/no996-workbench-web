import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { createEditor } from '../src/core/instance.ts'
import {
  getShotInsertPolicy,
  canLandShotOnTrack,
} from '../src/panels/shots/shot-insert-policy.ts'
import { resolveShotInsertTrack } from '../src/panels/shots/resolve-shot-insert-track.ts'
import { canMoveElementToTrack } from '../src/core/commands/timeline-commands.ts'
import { SetDefaultInsertTrackCommand } from '../src/core/commands/insert-track-defaults.ts'
import { InsertShotCommand } from '../src/core/commands/shot-commands.ts'

test('shot insert policy: text-as-mask targets video track_end', () => {
  const policy = getShotInsertPolicy('opening/text-as-mask')
  assert.equal(policy.trackType, 'video')
  assert.equal(policy.placement, 'track_end')
})

test('shot insert policy: default storyline shot', () => {
  const policy = getShotInsertPolicy('opening/spotlight-hero-card')
  assert.equal(policy.trackType, 'shot')
})

test('resolveShotInsertTrack uses default video track for text-as-mask', () => {
  const doc = createEmptyDocument('doc-1', 'test')
  const editor = createEditor({ document: doc })
  const customId = 'track-video-custom'
  doc.tracks.push({
    id: customId,
    type: 'video',
    name: '视频轨 1',
    muted: false,
    hidden: false,
    locked: false,
    elements: [],
  })
  editor.setDocument(doc)
  editor.executeCommand(new SetDefaultInsertTrackCommand(customId))

  const resolved = resolveShotInsertTrack(editor, 'opening/text-as-mask')
  assert.equal(resolved.track.id, customId)
  assert.equal(resolved.startUs, 0)
})

test('resolveShotInsertTrack appends at track_end on video track', () => {
  const doc = createEmptyDocument('doc-2', 'test')
  const editor = createEditor({ document: doc })
  const fps = 30
  editor.executeCommand(
    new InsertShotCommand(
      {
        trackId: 'track-main-video',
        shotId: 'opening/text-as-mask',
        sourceDurationFrames: 30,
        startUs: 0,
        canvasWidth: 1920,
        canvasHeight: 1080,
      },
      fps,
    ),
  )

  const resolved = resolveShotInsertTrack(editor, 'opening/text-as-mask')
  assert.equal(resolved.track.id, 'track-main-video')
  assert.equal(resolved.startUs, 1_000_000)
})

test('canMoveElementToTrack allows storyline shots onto video/overlay', () => {
  assert.equal(canMoveElementToTrack('shot', 'video', 'opening/text-as-mask'), true)
  assert.equal(canMoveElementToTrack('shot', 'shot', 'opening/text-as-mask'), true)
  assert.equal(canMoveElementToTrack('shot', 'shot', 'opening/spotlight-hero-card'), true)
  assert.equal(canMoveElementToTrack('shot', 'video', 'opening/spotlight-hero-card'), true)
  assert.equal(canMoveElementToTrack('shot', 'overlay', 'opening/spotlight-hero-card'), true)
  assert.equal(canMoveElementToTrack('shot', 'audio', 'opening/spotlight-hero-card'), false)
})

test('canLandShotOnTrack allows visual tracks for all shots', () => {
  assert.equal(canLandShotOnTrack('opening/text-as-mask', 'video'), true)
  assert.equal(canLandShotOnTrack('opening/text-as-mask', 'shot'), true)
  assert.equal(canLandShotOnTrack('opening/spotlight-hero-card', 'video'), true)
  assert.equal(canLandShotOnTrack('opening/spotlight-hero-card', 'shot'), true)
  assert.equal(canLandShotOnTrack('opening/spotlight-hero-card', 'overlay'), true)
})

test('resolveShotInsertTrack respects visual star on main video for storyline shot', () => {
  const doc = createEmptyDocument('doc-star-video', 'test')
  const editor = createEditor({ document: doc })
  editor.executeCommand(new SetDefaultInsertTrackCommand('track-main-video'))
  const resolved = resolveShotInsertTrack(editor, 'opening/spotlight-hero-card')
  assert.equal(resolved.track.id, 'track-main-video')
})
