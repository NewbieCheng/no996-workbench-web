import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../../../../../packages/video-editor/src/core/project.ts'
import { applyTalkTemplate, assertTemplateRevision, BUILTIN_TALK_TEMPLATES, captureTemplateComposition, createTalkTemplate, RECOMMENDED_TALK_TEMPLATE_IDS, templateName, templateProtectionRequired, templateScope, validateTalkTemplate } from './model.ts'
import { deleteTalkTemplate, getTalkTemplate, listTalkTemplates, renameTalkTemplate, saveTalkTemplate, TALK_TEMPLATES_DB_NAME } from './repository.ts'

// Targeted, offline Node tests. Deliberately not added to any package script.
const id = 'talk-style-00000000-0000-4000-8000-000000000001'
const options = { frame: false, composition: false, confirmProtected: false }
const code = expected => failure => failure?.code === expected
function fixture(owner = 8) {
  const doc = createEmptyDocument('talk-1', 'Private project name', String(owner))
  doc.captionStyle = { ...BUILTIN_TALK_TEMPLATES[0].captionStyle }
  doc.canvas.backgroundColor = '#172128'
  doc.durationUs = 12_000_000
  doc.captions = [{ id: 'caption-1', text: 'Private calibrated caption', startUs: 300_000, durationUs: 2_000_000, timingSource: 'manual', styleOverride: { color: '#ff0000', entrance: 'none' } }]
  doc.assets = { media: { id: 'media', name: 'Private material', kind: 'video', mimeType: 'video/mp4', sizeBytes: 100, blobId: 'private-blob', remoteUrl: 'https://private.invalid', createdAt: 1 } }
  doc.ipVideo = { script: 'Private manuscript', audioScript: 'Private spoken text', voiceId: 'private-voice', speed: .9, photoMotion: false, taskId: 'private-task', creation: { brief: 'private brief' }, aiProtected: { shots: true }, reference: { private: 'must never escape' } }
  const transform = { x: 108, y: 192, width: 540, height: 960, rotationDeg: 0, opacity: .9, cropMode: 'cover', round: 20, contentFocusX: .4, contentFocusY: .6 }
  doc.tracks.find(track => track.id === 'track-main-video').elements = [{ id: 'ip-photo-one', type: 'image', trackId: 'track-main-video', assetId: 'media', startUs: 2_000_000, durationUs: 4_000_000, transform }]
  doc.tracks.find(track => track.id === 'track-voice-audio').elements = [{ id: 'voice', type: 'audio', trackId: 'track-voice-audio', assetId: 'media', startUs: 0, durationUs: 12_000_000, sourceInUs: 0, sourceOutUs: 12_000_000, volume: .8, rate: 1 }]
  doc.tracks.find(track => track.id === 'track-shot').elements = [{ id: 'shot-1', type: 'shot', trackId: 'track-shot', shotId: 'content', sourceDurationFrames: 30, rate: 1, startUs: 7_000_000, durationUs: 1_000_000, transform: { ...transform } }]
  return doc
}
const save = (doc = fixture(), include = { frame: false, composition: false }) => createTalkTemplate(doc, 8, 'My actual style', include, id, 100)

test('12 built-ins have unique ids; recommendations are a subset, not invented styles', () => {
  assert.equal(BUILTIN_TALK_TEMPLATES.length, 12)
  assert.equal(new Set(BUILTIN_TALK_TEMPLATES.map(item => item.id)).size, 12)
  assert.ok(RECOMMENDED_TALK_TEMPLATE_IDS.every(id => BUILTIN_TALK_TEMPLATES.some(item => item.id === id)))
})
test('save persists the real caption style and background, with optional parts absent by default', () => {
  const doc = fixture(); doc.captionStyle.size = 73; doc.captionStyle.motion = .17
  const template = save(doc)
  assert.deepEqual(template.captionStyle, doc.captionStyle)
  assert.equal(template.backgroundColor, doc.canvas.backgroundColor)
  assert.equal(template.schemaVersion, 1); assert.equal(template.revision, 1)
  assert.equal(template.owner, 8); assert.equal(template.scope, '8')
  assert.equal('frame' in template, false); assert.equal('composition' in template, false)
  const serialized = JSON.stringify(template)
  for (const privateValue of ['Private', 'private-task', 'private-blob', 'private brief', 'must never escape']) assert.equal(serialized.includes(privateValue), false)
  for (const field of ['script', 'assets', 'audio', 'tracks', 'captions', 'taskId', 'reference', 'credentials']) assert.equal(Object.hasOwn(template, field), false)
})
test('schema whitelist rejects corruption, foreign scope, future versions, nonfinite values and executable strings', () => {
  const template = save()
  assert.throws(() => validateTalkTemplate(template, 9), code('ownerMismatch'))
  assert.throws(() => validateTalkTemplate({ ...template, scope: '9' }, 8), code('ownerMismatch'))
  assert.throws(() => validateTalkTemplate({ ...template, owner: 9 }, 8), code('ownerMismatch'))
  assert.throws(() => createTalkTemplate(fixture(9), 8, 'Foreign project', { frame: false, composition: false }, id, 100), code('ownerMismatch'))
  assert.throws(() => validateTalkTemplate({ ...template, schemaVersion: 2 }, 8), code('unsupportedVersion'))
  assert.throws(() => validateTalkTemplate({ ...template, reference: { private: true } }, 8), code('invalidData'))
  assert.throws(() => validateTalkTemplate({ ...template, captionStyle: { ...template.captionStyle, size: Infinity } }, 8), code('invalidData'))
  assert.throws(() => validateTalkTemplate({ ...template, captionStyle: { ...template.captionStyle, unknown: 'secret' } }, 8), code('invalidData'))
  assert.throws(() => validateTalkTemplate({ ...template, backgroundColor: 'url(https://evil.invalid)' }, 8), code('invalidData'))
  assert.throws(() => validateTalkTemplate({ ...template, captionStyle: { ...template.captionStyle, font: 'Unknown' } }, 8), code('unsupportedFont'))
})
test('names normalize to a collision key; control characters and empty names fail', () => {
  assert.deepEqual(templateName('  Ｍy   Style  '), { name: 'My Style', nameKey: 'my style' })
  assert.equal(templateName('MY STYLE').nameKey, templateName('my style').nameKey)
  for (const value of ['', ' ', 'x'.repeat(61), 'bad\nname']) assert.throws(() => templateName(value), code('invalidName'))
})
test('default apply changes only global caption style/background and records protected metadata', () => {
  const doc = fixture(), original = structuredClone(doc)
  const result = applyTalkTemplate(doc, 8, BUILTIN_TALK_TEMPLATES[2], options)
  assert.equal(result.captions, doc.captions)
  assert.equal(result.tracks, doc.tracks)
  assert.equal(result.assets, doc.assets)
  assert.equal(result.transitions, doc.transitions)
  assert.equal(result.groups, doc.groups)
  assert.equal(result.durationUs, doc.durationUs)
  assert.equal(result.ipVideo.script, doc.ipVideo.script)
  assert.equal(result.ipVideo.audioScript, doc.ipVideo.audioScript)
  assert.equal(result.ipVideo.voiceId, doc.ipVideo.voiceId)
  assert.equal(result.ipVideo.speed, doc.ipVideo.speed)
  assert.equal(result.ipVideo.photoMotion, doc.ipVideo.photoMotion)
  assert.equal(result.ipVideo.taskId, doc.ipVideo.taskId)
  assert.equal(result.ipVideo.director, doc.ipVideo.director)
  assert.equal(result.ipVideo.aiProtected.captions, true)
  assert.equal(result.ipVideo.aiProtected.composition, true)
  assert.equal(result.ipVideo.aiProtected.shots, true)
  assert.equal(result.ipVideo.styleTemplate.id, 'bold')
  assert.deepEqual(doc, original)
})
test('protected captions or background/composition require explicit confirmation and remain protected', () => {
  for (const group of ['captions', 'composition']) {
    const doc = fixture(); doc.ipVideo.aiProtected[group] = true
    assert.equal(templateProtectionRequired(doc), true)
    assert.throws(() => applyTalkTemplate(doc, 8, BUILTIN_TALK_TEMPLATES[0], options), code('protectedConfirm'))
    assert.equal(applyTalkTemplate(doc, 8, BUILTIN_TALK_TEMPLATES[0], { ...options, confirmProtected: true }).ipVideo.aiProtected[group], true)
  }
})
test('composition capture normalizes geometry and refuses different layouts, animation, overlays, masks and locks', () => {
  const doc = fixture(), composition = captureTemplateComposition(doc)
  assert.equal(composition.x, .1); assert.equal(composition.width, .5)
  const track = doc.tracks.find(track => track.id === 'track-main-video'), first = track.elements[0]
  track.elements.push({ ...first, id: 'photo-2', startUs: first.startUs + first.durationUs, transform: { ...first.transform, x: 200 } })
  assert.throws(() => captureTemplateComposition(doc), code('mixedComposition'))
  track.elements.pop()
  first.animations = { channels: { 'transform.x': { propertyPath: 'transform.x', keyframes: [{ id: 'user-key', timeUs: 2_000, value: 50, easing: 'linear' }] } } }
  assert.throws(() => captureTemplateComposition(doc), code('animatedComposition'))
  // Caption/background-only capture and apply are still safe with animated media.
  assert.doesNotThrow(() => save(doc))
  assert.equal(applyTalkTemplate(doc, 8, BUILTIN_TALK_TEMPLATES[0], options).tracks, doc.tracks)
  delete first.animations
  first.mask = { kind: 'circle', x: 0, y: 0, width: 1, height: 1, inverted: false, feather: 0 }
  assert.throws(() => captureTemplateComposition(doc), code('animatedComposition'))
  delete first.mask
  doc.tracks.find(track => track.id === 'track-overlay').elements.push({ ...first, id: 'overlay-1' })
  assert.throws(() => captureTemplateComposition(doc), code('compositionUnavailable'))
  doc.tracks.find(track => track.id === 'track-overlay').elements = []; track.locked = true
  assert.throws(() => captureTemplateComposition(doc), code('compositionUnavailable'))
})
test('composition refuses ambiguous main tracks and overlapping or invalid clip timing without mutating the timeline', () => {
  const source = fixture(), template = save(source, { frame: false, composition: true })
  const reject = target => {
    const before = structuredClone(target)
    assert.throws(() => captureTemplateComposition(target), code('compositionUnavailable'))
    assert.throws(() => applyTalkTemplate(target, 8, template, { ...options, composition: true }), code('compositionUnavailable'))
    // The optional composition must not prevent caption/background-only reuse.
    assert.doesNotThrow(() => save(target))
    assert.equal(applyTalkTemplate(target, 8, BUILTIN_TALK_TEMPLATES[0], options).tracks, target.tracks)
    assert.deepEqual(target, before)
  }
  const duplicate = fixture()
  duplicate.tracks.push(structuredClone(duplicate.tracks.find(track => track.id === 'track-main-video')))
  reject(duplicate)
  const overlap = fixture(), overlappingTrack = overlap.tracks.find(track => track.id === 'track-main-video')
  overlappingTrack.elements.push({ ...overlappingTrack.elements[0], id: 'overlapping-person', startUs: 3_000_000 })
  reject(overlap)
  for (const patch of [{ startUs: -1 }, { startUs: NaN }, { startUs: .5 }, { durationUs: 0 }, { durationUs: -1 }, { durationUs: Infinity }, { durationUs: Number.MAX_SAFE_INTEGER }]) {
    const invalid = fixture()
    Object.assign(invalid.tracks.find(track => track.id === 'track-main-video').elements[0], patch)
    reject(invalid)
  }
  const adjacent = fixture(), track = adjacent.tracks.find(track => track.id === 'track-main-video')
  const first = track.elements[0]
  // Unsorted but non-overlapping clips with the same static layout are reliable.
  track.elements.unshift({ ...first, id: 'later-person', startUs: first.startUs + first.durationUs })
  const before = structuredClone(adjacent)
  assert.deepEqual(captureTemplateComposition(adjacent), template.composition)
  assert.doesNotThrow(() => applyTalkTemplate(adjacent, 8, template, { ...options, composition: true }))
  assert.deepEqual(adjacent, before)
})
test('opt-in composition refuses to flatten different target layouts into one template box', () => {
  const template = save(fixture(), { frame: false, composition: true })
  const target = fixture(), track = target.tracks.find(track => track.id === 'track-main-video')
  const first = track.elements[0]
  track.elements.push({ ...first, id: 'different-layout', startUs: first.startUs + first.durationUs, transform: { ...first.transform, x: 200 } })
  const before = structuredClone(target)
  assert.throws(() => applyTalkTemplate(target, 8, template, { ...options, composition: true }), code('mixedComposition'))
  assert.deepEqual(target, before)
  assert.equal(applyTalkTemplate(target, 8, template, options).tracks, target.tracks)
})
test('opt-in composition changes only static main visual transforms, never times/audio/shots/keys', () => {
  const template = save(fixture(), { frame: false, composition: true })
  const target = fixture(); target.canvas.width = 1920; target.canvas.height = 1080
  const result = applyTalkTemplate(target, 8, template, { ...options, composition: true })
  const main = result.tracks.find(track => track.id === 'track-main-video').elements[0]
  assert.equal(main.transform.x, 192); assert.equal(main.transform.width, 960)
  const original = target.tracks.find(track => track.id === 'track-main-video').elements[0]
  assert.equal(main.startUs, original.startUs); assert.equal(main.durationUs, original.durationUs)
  for (const trackId of ['track-voice-audio', 'track-shot']) assert.equal(result.tracks.find(track => track.id === trackId), target.tracks.find(track => track.id === trackId))
  assert.equal(result.captions, target.captions)
  original.animations = { channels: { 'transform.width': { propertyPath: 'transform.width', keyframes: [{ id: 'manual', value: 10, timeUs: 0, easing: 'linear' }] } } }
  assert.throws(() => applyTalkTemplate(target, 8, template, { ...options, composition: true }), code('animatedComposition'))
})
test('frame is explicit and changes only canvas dimensions: all existing keyframes/element timing remain byte-identical', () => {
  const source = fixture(); source.canvas = { ...source.canvas, width: 1920, height: 1080, ratio: '16:9' }
  const template = save(source, { frame: true, composition: false })
  const target = fixture()
  target.tracks.find(track => track.id === 'track-main-video').elements[0].animations = { channels: { 'transform.x': { propertyPath: 'transform.x', keyframes: [{ id: 'real-user-key', value: 100, timeUs: 20_000, easing: 'easeOut' }] } } }
  target.tracks.find(track => track.id === 'track-shot').elements[0].animations = { channels: { 'transform.opacity': { propertyPath: 'transform.opacity', keyframes: [{ id: 'shot-key', value: .5, timeUs: 30_000, easing: 'linear' }] } } }
  const beforeTracks = JSON.stringify(target.tracks)
  assert.equal(applyTalkTemplate(target, 8, template, options).canvas.ratio, '9:16')
  const result = applyTalkTemplate(target, 8, template, { ...options, frame: true })
  assert.equal(result.canvas.ratio, '16:9'); assert.equal(result.canvas.width, 1920)
  assert.equal(result.canvas.fps, target.canvas.fps)
  assert.equal(JSON.stringify(result.tracks), beforeTracks)
  assert.throws(() => applyTalkTemplate(target, 8, BUILTIN_TALK_TEMPLATES[0], { ...options, frame: true }), code('invalidData'))
})
test('post-font revision/document and owner checks stop stale or cross-account application', () => {
  const doc = fixture(), expected = { id: doc.id, revision: doc.revision }
  assert.doesNotThrow(() => assertTemplateRevision(doc, expected, 8))
  assert.throws(() => assertTemplateRevision({ ...doc, revision: doc.revision + 1 }, expected, 8), code('staleProject'))
  assert.throws(() => assertTemplateRevision({ ...doc, id: 'other' }, expected, 8), code('staleProject'))
  assert.throws(() => assertTemplateRevision(doc, expected, 9), code('ownerMismatch'))
  assert.throws(() => applyTalkTemplate(doc, 9, save(), options), code('ownerMismatch'))
})
test('all repository entrypoints reject invalid owners before touching IndexedDB; database is independent', async () => {
  assert.equal(TALK_TEMPLATES_DB_NAME, 'no996-ip-talk-style-templates')
  for (const owner of [0, -1, NaN, Infinity, 1.5]) {
    assert.throws(() => templateScope(owner), code('invalidOwner'))
    await assert.rejects(listTalkTemplates(owner), code('invalidOwner'))
    await assert.rejects(getTalkTemplate(owner, id), code('invalidOwner'))
    await assert.rejects(saveTalkTemplate(owner, save()), code('invalidOwner'))
    await assert.rejects(renameTalkTemplate(owner, id, 1, 'New'), code('invalidOwner'))
    await assert.rejects(deleteTalkTemplate(owner, id, 1), code('invalidOwner'))
  }
})
