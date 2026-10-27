import test from 'node:test'
import assert from 'node:assert/strict'
import { canEnterTalkStage, defaultTalkStage, nextTalkStage, previousTalkStage, TALK_PIPELINE_STEPS, talkStageIndex, talkStageNumber } from './talk-pipeline.ts'

test('the pipeline is one ordered six-step path', () => {
  assert.deepEqual(TALK_PIPELINE_STEPS.map(step => step.id), ['content', 'visual', 'voice', 'generate', 'edit', 'export'])
  assert.deepEqual(TALK_PIPELINE_STEPS.map((_, index) => talkStageNumber(TALK_PIPELINE_STEPS[index].id)), [1, 2, 3, 4, 5, 6])
  assert.equal(talkStageIndex('voice'), 2)
})

test('editing does not open until there is a real duration', () => {
  assert.equal(canEnterTalkStage('edit', { hasResult: false, hasDuration: false, canGenerate: false }).allowed, false)
  assert.equal(canEnterTalkStage('edit', { hasResult: false, hasDuration: false, canGenerate: false }).reasonKey, 'needResult')
  assert.equal(canEnterTalkStage('edit', { hasResult: false, hasDuration: true, canGenerate: false }).allowed, true)
  assert.equal(canEnterTalkStage('export', { hasResult: true, hasDuration: true, canGenerate: true }).allowed, true)
})

test('generate is reachable only with content or an existing result', () => {
  assert.equal(canEnterTalkStage('generate', { hasResult: false, hasDuration: false, canGenerate: false }).reasonKey, 'needContent')
  assert.equal(canEnterTalkStage('generate', { hasResult: false, hasDuration: false, canGenerate: true }).allowed, true)
  assert.equal(canEnterTalkStage('generate', { hasResult: true, hasDuration: true, canGenerate: false }).allowed, true)
})

test('default and neighboring stages follow the same path', () => {
  assert.equal(defaultTalkStage(false), 'content')
  assert.equal(defaultTalkStage(true), 'edit')
  assert.equal(nextTalkStage('content'), 'visual')
  assert.equal(nextTalkStage('voice'), 'generate')
  assert.equal(previousTalkStage('edit'), 'generate')
  assert.equal(previousTalkStage('content'), 'content')
})
