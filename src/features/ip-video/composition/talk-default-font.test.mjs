import test from 'node:test'
import assert from 'node:assert/strict'
import { createTalkDocument, TALK_DEFAULT_CAPTION_FONT, TALK_DEFAULT_CAPTION_PRESET_ID } from './talk-model.ts'
import { talkLookById } from './talk-looks.ts'

test('new talk documents default to 马善政楷书 / ink', () => {
  const doc = createTalkDocument('owner-test')
  assert.equal(doc.captionStyle.font, TALK_DEFAULT_CAPTION_FONT)
  assert.equal(doc.captionStyle.font, 'Ma Shan Zheng')
  assert.equal(doc.captionStyle.weight, 400)
  assert.equal(doc.ipVideo.captionPresetId, TALK_DEFAULT_CAPTION_PRESET_ID)
  assert.equal(talkLookById('scroll')?.captionPresetId, 'ink')
})
