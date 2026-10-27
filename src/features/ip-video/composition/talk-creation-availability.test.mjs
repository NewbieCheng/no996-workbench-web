import test from 'node:test'
import assert from 'node:assert/strict'
import { canSubmitTalkCreation, canSuggestTalkDirection } from './talk-creation-availability.ts'

// Offline assertions for the shared direct-form/guide gate; not added to a broad test script.
const empty = { hasResult: false, brief: '', hasScript: false, hasAudio: false }

test('an empty new project needs an idea, manuscript or original sound', () => {
  assert.equal(canSubmitTalkCreation(empty), false)
  assert.equal(canSubmitTalkCreation({ ...empty, brief: ' \n\t ' }), false)
  assert.equal(canSubmitTalkCreation({ ...empty, brief: '分享一次家电维修经验' }), true)
  assert.equal(canSubmitTalkCreation({ ...empty, hasScript: true }), true)
})

test('original sound allows first visual planning without inventing or requiring a transcript', () => {
  assert.equal(canSubmitTalkCreation({ ...empty, hasAudio: true }), true)
  assert.equal(canSubmitTalkCreation({ ...empty, hasAudio: true, brief: ' ' }), true)
})

test('existing work always needs explicit adjustment text, even with manuscript and audio', () => {
  for (const hasScript of [false, true]) {
    for (const hasAudio of [false, true]) {
      assert.equal(canSubmitTalkCreation({ hasResult: true, brief: '', hasScript, hasAudio }), false)
      assert.equal(canSubmitTalkCreation({ hasResult: true, brief: ' \n ', hasScript, hasAudio }), false)
      assert.equal(canSubmitTalkCreation({ hasResult: true, brief: '保留原声，减少字幕动效', hasScript, hasAudio }), true)
    }
  }
})

test('direction suggestions need an idea or manuscript, not a default persona', () => {
  assert.equal(canSuggestTalkDirection({ brief: '', hasScript: false }), false)
  assert.equal(canSuggestTalkDirection({ brief: ' \n\t ', hasScript: false }), false)
  assert.equal(canSuggestTalkDirection({ brief: '分享一次家电维修经验', hasScript: false }), true)
  assert.equal(canSuggestTalkDirection({ brief: '', hasScript: true }), true)
})
