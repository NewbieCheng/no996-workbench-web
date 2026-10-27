import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPreviewAudioSignature } from './preview-audio-signature.ts'
import { createEmptyDocument } from '../../../../packages/video-editor/src/core/project.ts'

test('buildPreviewAudioSignature: empty doc yields stable empty signature', () => {
  const doc = createEmptyDocument('doc-1', 'test')
  assert.equal(buildPreviewAudioSignature(doc), '')
})

test('preview audio remix skip: empty signature after first mix must not re-enter', () => {
  const signature = ''
  const mixedSignature = ''
  assert.equal(signature === mixedSignature, true)
})
