import test from 'node:test'
import assert from 'node:assert/strict'
import { createTalkCoverProject, TALK_COVER_SIZE } from '../lib/cover.ts'
import { createTemplateProject, templateDesign, validateTemplateProject } from '../lib/template-project.ts'

test('video projects keep the legacy portrait design', () => {
  const project = createTemplateProject({ templateId: 'scroll', script: '', duration: 3, title: '标题' })
  assert.deepEqual(templateDesign(project), { width: 1080, height: 1920 })
})

test('cover projects use a real 1:1 design instead of stretching 9:16', () => {
  const project = createTalkCoverProject({ lookId: 'scroll', title: '这是一条封面标题' })
  assert.deepEqual(templateDesign(project), { width: TALK_COVER_SIZE, height: TALK_COVER_SIZE })
  assert.deepEqual(project.photo, { x: 0, y: 0, width: 1080, height: 1080, focalX: .5, focalY: .5 })
  assert.equal(project.title.enabled, true)
  assert.ok(project.title.x + project.title.width <= 1080)
  assert.ok(project.title.y + project.title.height <= 1080)
  assert.equal(project.subtitle.enabled, false)
  assert.doesNotThrow(() => validateTemplateProject(project))
})

test('an empty cover title stays empty and still validates', () => {
  const project = createTalkCoverProject({ lookId: 'life', title: '   ' })
  assert.equal(project.title.enabled, false)
  assert.doesNotThrow(() => validateTemplateProject(project))
})
