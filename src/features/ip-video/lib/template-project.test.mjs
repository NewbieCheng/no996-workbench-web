import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTemplateProject, restoreTemplateProject, updateLayerBox, projectTimeline, validateTemplateProject, projectSubtitleStyle } from './template-project.ts'
import { parseSrt, exportSrt, validateCaptions } from './subtitles.ts'
import { getTimelineFrameState } from './timeline-engine.ts'

const create = () => createTemplateProject({ templateId: 'scroll', script: '你好世界。今天分享一个方法。', duration: 10 })
test('legacy records become editable projects without deleting their text or baking a second title', () => {
  const legacy = { templateId: 'life', script: '既有的文稿。', duration: 8, subtitleStyle: { size: 64, color: '#ffffff', font: 'serif', y: 70 }, demo: false }
  const project = restoreTemplateProject(legacy)
  assert.equal(project.version, 1)
  assert.equal(project.title.enabled, false)
  assert.equal(project.script, legacy.script)
  assert.deepEqual(projectSubtitleStyle(project), legacy.subtitleStyle)
  assert.doesNotThrow(() => validateTemplateProject(project))
  assert.equal(restoreTemplateProject({ ...legacy, templateProject: project }), project)
})
test('output coordinate layout is finite, clamped, and leaves unrelated layers unchanged', () => {
  const project = create()
  const changed = updateLayerBox(project, 'title', { x: -100, y: 8000, width: 1600, height: 600 })
  assert.deepEqual({ x: changed.title.x, y: changed.title.y, width: changed.title.width, height: changed.title.height }, { x: 0, y: 1320, width: 1080, height: 600 })
  assert.equal(changed.subtitle, project.subtitle)
  assert.doesNotThrow(() => validateTemplateProject(changed))
  assert.throws(() => validateTemplateProject({ ...project, title: { ...project.title, size: NaN } }), /invalidLayout/)
})
test('stored captions are the only timing source for both burned frames and SRT', () => {
  const project = create()
  assert.equal(project.captions.map(item => item.text).join(''), project.script)
  const imported = parseSrt(exportSrt(project.captions))
  imported.forEach((caption, i) => {
    assert.ok(Math.abs(caption.start - project.captions[i].start) <= .00051)
    assert.ok(Math.abs(caption.end - project.captions[i].end) <= .00051)
  })
  project.captions = [{ text: '第一段', start: 2, end: 4 }, { text: '第二段', start: 6, end: 8 }]
  project.timingSource = 'srt'
  const timeline = projectTimeline(project)
  assert.equal(getTimelineFrameState(timeline, 1).currentSentence, undefined)
  assert.equal(getTimelineFrameState(timeline, 2).currentSentence.text, '第一段')
  assert.equal(getTimelineFrameState(timeline, 5).currentSentence, undefined)
  assert.equal(getTimelineFrameState(timeline, 6).currentSentence.text, '第二段')
  assert.equal(timeline.allWords[0].start, 2)
  assert.equal(timeline.allWords.at(-1).end, 8)
})
test('caption validation rejects overlap, reversed ranges and end times after the audio', () => {
  assert.doesNotThrow(() => validateCaptions([{ start: 0, end: 2, text: '甲' }, { start: 2, end: 3, text: '乙' }], 3))
  assert.throws(() => validateCaptions([{ start: 1, end: 3, text: '甲' }, { start: 2, end: 4, text: '乙' }], 5))
  assert.throws(() => validateCaptions([{ start: 0, end: 4, text: '甲' }], 3))
  assert.throws(() => parseSrt('1\n00:00:03,000 --> 00:00:02,000\n倒序'))
})
test('IP video page keeps the specialized audio task path behind the workspace', () => {
  const page = readFileSync(new URL('../IPVideoPage.tsx', import.meta.url), 'utf8')
  const workspace = readFileSync(new URL('../composition/TalkWorkspace.tsx', import.meta.url), 'utf8')
  const inputs = readFileSync(new URL('../composition/use-talk-inputs.ts', import.meta.url), 'utf8')
  assert.match(page, /TalkWorkspace/)
  assert.match(workspace, /useWorkbenchTasks\(\{ kind: 'ip_video_create' \}\)/)
  assert.match(inputs, /actions\.enqueueIPVideoAudio\(/)
  assert.doesNotMatch(inputs, /actions\.enqueueVoiceTts\(/)
})
