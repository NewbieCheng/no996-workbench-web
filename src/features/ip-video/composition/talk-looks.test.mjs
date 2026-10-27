import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../../../../packages/video-editor/src/core/project.ts'
import { TALK_CAPTION_PRESETS } from './talk-caption-presets.ts'
import { applyTalkLook, hasTalkVisual, TALK_LOOKS, talkLookById } from './talk-looks.ts'

function emptyTalk() {
  const doc = createEmptyDocument('talk-look-1', '口播', '8', '9:16')
  doc.canvas.backgroundColor = '#172128'
  doc.captionStyle = { ...TALK_CAPTION_PRESETS[0].style }
  doc.ipVideo = { script: '保留的口播文稿', audioScript: '保留的配音稿', voiceId: 'voice-a', speed: 1, captionPresetId: 'studio' }
  doc.tracks.find(track => track.id === 'track-voice-audio').elements = [{
    id: 'voice', type: 'audio', trackId: 'track-voice-audio', assetId: 'media', startUs: 0, durationUs: 8_000_000,
    sourceInUs: 0, sourceOutUs: 8_000_000, volume: 1, rate: 1,
  }]
  doc.captions = [{ id: 'cue-1', text: '第一句', startUs: 0, durationUs: 2_000_000, timingSource: 'manual' }]
  doc.durationUs = 8_000_000
  return doc
}

test('eight looks map to registered caption presets and unique canvases', () => {
  assert.equal(TALK_LOOKS.length, 8)
  assert.equal(new Set(TALK_LOOKS.map(item => item.id)).size, 8)
  for (const item of TALK_LOOKS) {
    assert.ok(TALK_CAPTION_PRESETS.some(preset => preset.id === item.captionPresetId))
    assert.ok(!('ratio' in item))
    assert.match(item.backgroundColor, /^#/)
  }
})

test('applyTalkLook on an empty stage changes canvas and captions, not audio or cue timing', () => {
  const doc = emptyTalk()
  const audio = doc.tracks.find(track => track.id === 'track-voice-audio')
  const result = applyTalkLook(doc, 'poster')
  assert.equal(hasTalkVisual(doc), false)
  assert.equal(result.canvas.backgroundColor, talkLookById('poster').backgroundColor)
  assert.equal(result.captionStyle.size, TALK_CAPTION_PRESETS.find(item => item.id === 'bold').style.size)
  assert.equal(result.ipVideo.lookId, 'poster')
  assert.equal(result.ipVideo.captionPresetId, 'bold')
  assert.equal(result.ipVideo.script, '保留的口播文稿')
  assert.equal(result.ipVideo.audioScript, '保留的配音稿')
  assert.equal(result.ipVideo.voiceId, 'voice-a')
  assert.equal(result.tracks.find(track => track.id === 'track-voice-audio').elements, audio.elements)
  assert.equal(result.captions, doc.captions)
  assert.equal(result.durationUs, doc.durationUs)
  assert.equal(result.ipVideo.aiProtected.captions, true)
})

test('applyTalkLook with a main visual updates framing and leaves the audio clip', () => {
  const doc = emptyTalk()
  const transform = { x: 0, y: 0, width: doc.canvas.width, height: doc.canvas.height, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 }
  doc.tracks.find(track => track.id === 'track-main-video').elements = [{
    id: 'ip-photo-one', type: 'image', trackId: 'track-main-video', assetId: 'media', startUs: 0, durationUs: 8_000_000, transform,
  }]
  const audio = doc.tracks.find(track => track.id === 'track-voice-audio').elements[0]
  const result = applyTalkLook(doc, 'call')
  const photo = result.tracks.find(track => track.id === 'track-main-video').elements[0]
  assert.ok(photo.transform.width < doc.canvas.width)
  assert.ok(photo.transform.x > 0)
  assert.equal(result.tracks.find(track => track.id === 'track-voice-audio').elements[0], audio)
  assert.equal(result.captions[0].startUs, 0)
})

test('unknown look ids fail without touching the document', () => {
  const doc = emptyTalk()
  assert.throws(() => applyTalkLook(doc, 'not-a-look'), /未知的成片样式/)
})

test('applyTalkLook keeps a landscape canvas the user already chose', () => {
  const doc = emptyTalk()
  doc.canvas = { ...doc.canvas, width: 1920, height: 1080, ratio: '16:9' }
  const result = applyTalkLook(doc, 'poster')
  assert.equal(result.canvas.ratio, '16:9')
  assert.equal(result.canvas.width, 1920)
  assert.equal(result.canvas.height, 1080)
})
