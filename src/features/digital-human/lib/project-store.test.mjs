import test from 'node:test'
import assert from 'node:assert/strict'
import {
  activeDigitalHumanVersion,
  applyImportedAudioToSegment,
  clearSegmentImportedAudio,
  createDigitalHumanProject,
  digitalHumanProjectBytes,
  isDigitalHumanProjectShell,
  nextDigitalHumanProjectName,
  splitDigitalHumanScript,
} from './project-store.ts'
import { validateDigitalHumanDuration, validateDigitalHumanFile, validatePublicMediaUrl } from './media.ts'

test('editing a script preserves old versions without reusing stale audio', () => {
  const segment = { id: 'one', text: 'new text', versions: [{ id: 'old', createdAt: 1, text: 'old text', audio: new Blob(['audio']) }] }
  assert.equal(activeDigitalHumanVersion(segment), undefined)
  assert.equal(segment.versions.length, 1)
  assert.equal(activeDigitalHumanVersion({ ...segment, activeVersionId: 'old' })?.id, 'old')
})
test('paragraph splitting preserves every non-empty paragraph', () => {
  const segments = splitDigitalHumanScript('First sentence.\nContinued.\n\nSecond paragraph.\n\n\nThird.')
  assert.equal(segments.length, 3)
  assert.equal(segments[0].text, 'First sentence.\nContinued.')
  assert.equal(new Set(segments.map(item => item.id)).size, 3)
})
test('long scripts split at punctuation and hard limits without losing characters', () => {
  const text = `${'甲'.repeat(200)}。${'😀'.repeat(400)}！尾声`
  const segments = splitDigitalHumanScript(text)
  assert.equal(segments.map(segment => segment.text).join(''), text)
  assert.ok(segments.every(segment => Array.from(segment.text).length <= 350))
  assert.equal(segments[0].text, `${'甲'.repeat(200)}。`)
})

test('default project names increment as 口播项目N', () => {
  assert.equal(nextDigitalHumanProjectName([]), '口播项目1')
  assert.equal(nextDigitalHumanProjectName([{ name: '' }]), '口播项目2')
  assert.equal(nextDigitalHumanProjectName([{ name: '口播项目1' }, { name: '口播项目3' }]), '口播项目4')
  assert.equal(nextDigitalHumanProjectName([{ name: '未命名口播项目' }]), '口播项目2')
})

test('empty shell projects are detectable for safe delete', () => {
  const shell = createDigitalHumanProject(1, '')
  assert.equal(isDigitalHumanProjectShell(shell), true)
  shell.segments[0].versions.push({ id: 'v', createdAt: 1, text: '', status: 'audio_queued' })
  assert.equal(isDigitalHumanProjectShell(shell), true)
  shell.segments[0].text = 'hello'
  assert.equal(isDigitalHumanProjectShell(shell), false)
})

test('projects have separate ids, owner and actual blob quota accounting', () => {
  const project = createDigitalHumanProject(11, 'Project')
  const another = createDigitalHumanProject(12, 'Other')
  assert.notEqual(project.id, another.id)
  project.source = { file: new Blob(['12345']), name: 'source.mp4', duration: 4, width: 720, height: 1280 }
  project.segments[0].versions.push({ id: 'v', text: '', createdAt: 1, audio: new Blob(['123']), videoBlob: new Blob(['1234567']) })
  assert.equal(digitalHumanProjectBytes(project), 15)
  assert.equal(project.ownerUserId, 11)
})
test('duration checks use real bounded seconds rather than text estimates', () => {
  for (const seconds of [2, 7.5, 120]) assert.doesNotThrow(() => validateDigitalHumanDuration(seconds, 'audio'))
  for (const seconds of [0, 1.9, 120.1, Infinity, NaN]) assert.throws(() => validateDigitalHumanDuration(seconds, 'audio'))
  for (const seconds of [10, 15, 20]) assert.doesNotThrow(() => validateDigitalHumanDuration(seconds, 'video'))
  for (const seconds of [0, 9.9, 20.1, Infinity, NaN]) assert.throws(() => validateDigitalHumanDuration(seconds, 'video'))
})
test('local blobs and private URLs cannot be passed as public media', () => {
  for (const url of ['blob:https://example.com/id', '/media/audio/file.wav', 'http://localhost:8897/a.mp4', 'http://127.0.0.1/file', 'http://10.1.2.3/a', 'http://172.31.0.1/a', 'http://192.168.1.1/a', 'https://user:password@example.com/a']) assert.throws(() => validatePublicMediaUrl(url))
  assert.equal(validatePublicMediaUrl('https://media.example.com/a.mp4'), 'https://media.example.com/a.mp4')
})
test('imported audio replaces the current audio-only version instead of stacking duplicates', () => {
  const first = new Blob(['a'])
  const second = new Blob(['bb'])
  let segment = {
    id: 'one',
    text: 'line',
    versions: [{ id: 'v1', createdAt: 1, text: 'line', audio: first, audioDuration: 3, status: 'audio_ready' }],
    activeVersionId: 'v1',
  }
  segment = applyImportedAudioToSegment(segment, {
    audio: second,
    audioDuration: 5,
    voiceLabel: 'take-2.wav',
  })
  assert.equal(segment.versions.length, 1)
  assert.equal(segment.versions[0].id, 'v1')
  assert.equal(segment.versions[0].audioDuration, 5)
  assert.equal(segment.versions[0].voiceLabel, 'take-2.wav')
})

test('clearing imported audio removes the audio-only version from the segment', () => {
  const segment = {
    id: 'one',
    text: 'line',
    versions: [{ id: 'v1', createdAt: 1, text: 'line', audio: new Blob(['a']), status: 'audio_ready' }],
    activeVersionId: 'v1',
  }
  const cleared = clearSegmentImportedAudio(segment)
  assert.equal(cleared.versions.length, 0)
  assert.equal(cleared.activeVersionId, undefined)
})

test('unsupported upload format and zero-byte samples fail before upload', () => {
  assert.throws(() => validateDigitalHumanFile(new File(['video'], 'source.webm'), 'video'))
  assert.throws(() => validateDigitalHumanFile(new File([], 'source.mp4'), 'video'))
  assert.doesNotThrow(() => validateDigitalHumanFile(new File(['audio'], 'speech.wav'), 'audio'))
})
