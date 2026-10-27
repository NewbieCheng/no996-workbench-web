import test from 'node:test'
import assert from 'node:assert/strict'
import { createTemplateProject, validateTemplateProject } from '../lib/template-project.ts'
import { exportSrt, parseSrt } from '../lib/subtitles.ts'
import { applyLayout, captionDrafts, captionsFromDrafts, commitHistory, createHistory, extractLayout, HISTORY_LIMIT, nudgeLayer, redoHistory, resetLayout, sameProject, snapBox, undoHistory, validLayout } from './model.ts'
import { applyPreset, PRESET_LIMIT } from './presets.ts'

function fixture() {
  return createTemplateProject({ templateId: 'scroll', script: '第一句话。第二句话。', duration: 12, title: '完整标题', demo: true })
}
test('one gesture commits a single undo entry and undo/redo preserve all content', () => {
  const initial = fixture()
  let history = createHistory(initial)
  let projection = initial
  for (let index = 0; index < 20; index++) projection = nudgeLayer(projection, 'title', 1, 2)
  history = commitHistory(history, projection)
  assert.equal(history.past.length, 1)
  assert.deepEqual(undoHistory(history).present, initial)
  assert.deepEqual(redoHistory(undoHistory(history)).present, projection)
  assert.equal(commitHistory(history, structuredClone(projection)), history)
  assert.equal(sameProject(projection, structuredClone(projection)), true)
})
test('undo is bounded, a fresh commit clears redo, and external reset starts clean', () => {
  let history = createHistory(fixture())
  for (let index = 0; index < HISTORY_LIMIT + 20; index++) history = commitHistory(history, { ...history.present, title: { ...history.present.title, text: String(index) } })
  assert.equal(history.past.length, HISTORY_LIMIT)
  history = undoHistory(history)
  assert.equal(history.future.length, 1)
  history = commitHistory(history, { ...history.present, title: { ...history.present.title, text: 'new edit' } })
  assert.equal(history.future.length, 0)
  const external = createHistory(fixture())
  assert.equal(external.past.length, 0)
  assert.equal(external.future.length, 0)
})
test('reset and presets retain script, title, captions, timing and audio data', () => {
  const project = fixture()
  project.title = { ...project.title, x: 100, text: '不可截断的用户标题' }
  project.subtitle = { ...project.subtitle, text: '内部保留文字', size: 42 }
  project.captions = [{ start: 1, end: 4, text: '用户修改的字幕\n第二行' }]
  project.timingSource = 'manual'
  project.audioEnvelope = [.2, .8]
  const defaults = resetLayout(project)
  const changed = applyLayout(project, extractLayout(fixture()))
  for (const result of [defaults, changed]) {
    assert.equal(result.script, project.script)
    assert.equal(result.title.text, project.title.text)
    assert.equal(result.subtitle.text, project.subtitle.text)
    assert.equal(result.captions, project.captions)
    assert.equal(result.timingSource, 'manual')
    assert.equal(result.audioEnvelope, project.audioEnvelope)
    validateTemplateProject(result)
  }
})
test('persisted layout is an explicit allowlist with no content, blobs or envelopes', () => {
  const project = fixture()
  project.title.injectedSecret = 'must not persist'
  project.photo.blob = new Blob(['private'])
  project.photo.script = 'private text'
  const layout = extractLayout(project)
  assert.equal(validLayout(layout), true)
  const serialized = JSON.stringify(layout)
  for (const word of ['text', 'script', 'captions', 'blob', 'audioEnvelope', 'injectedSecret']) assert.equal(serialized.includes(`"${word}"`), false)
  const preset = { id: 'local-one', owner: 8, name: 'My layout', templateId: 'scroll', createdAt: 1, layout }
  assert.throws(() => applyPreset(project, preset, 9), /invalidLayout/)
  assert.throws(() => applyPreset(project, preset, 0), /invalidOwner/)
  assert.equal(applyPreset(project, preset, 8).title.text, project.title.text)
  assert.equal(PRESET_LIMIT, 20)
  assert.equal(validLayout({ ...layout, photo: { ...layout.photo, focalX: Infinity } }), false)
  assert.equal(validLayout({ ...layout, title: { ...layout.title, size: 0 } }), false)
})
test('caption drafts retain invalid input and SRT round-trips multiline text', () => {
  const captions = [{ start: 0, end: 2.125, text: '字幕第一行\nsecond line' }, { start: 3, end: 6, text: '最后一段，完整保留。' }]
  assert.deepEqual(parseSrt(exportSrt(captions)), captions)
  const drafts = captionDrafts(captions)
  drafts[0].end = '4'
  drafts[1].text = '编辑中的文字不应丢失'
  const snapshot = structuredClone(drafts)
  assert.throws(() => captionsFromDrafts(drafts, 12), /invalidSubtitle/)
  assert.deepEqual(drafts, snapshot)
  drafts[0].end = ''
  assert.throws(() => captionsFromDrafts(drafts, 12), /invalidSubtitle/)
  drafts[0].end = '2.125'
  const valid = captionsFromDrafts(drafts, 12)
  assert.equal(valid[1].text, '编辑中的文字不应丢失')
  drafts[1].end = '13'
  assert.throws(() => captionsFromDrafts(drafts, 12), /invalidSubtitle/)
})
test('keyboard movement is clamped and drag snapping covers center and safe edges', () => {
  const project = fixture()
  const moved = nudgeLayer(project, 'photo', -1000, 4000)
  assert.equal(moved.photo.x, 0)
  assert.equal(moved.photo.y, 0)
  const centered = snapBox({ x: 340, y: 900, width: 390, height: 120 }, 12)
  assert.equal(centered.x + centered.width / 2, 540)
  assert.equal(centered.y + centered.height / 2, 960)
  assert.equal(snapBox({ x: 68, y: 74, width: 200, height: 200 }).x, 72)
  assert.equal(snapBox({ x: 68, y: 74, width: 200, height: 200 }).y, 72)
})
