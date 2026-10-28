import test from 'node:test'
import assert from 'node:assert/strict'
import { canEnterTalkStage, defaultTalkStage, nextTalkStage, previousTalkStage, TALK_PIPELINE_STEPS, talkStageIndex, talkStageNumber } from './talk-pipeline.ts'
import { canLeaveTalkContentStep, canLeaveTalkVoiceStep, canSubmitTalkCreation } from './talk-creation-availability.ts'
import { humanizeTalkCreationError } from './talk-creation-errors.ts'

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

test('later steps stay locked without content readiness', () => {
  assert.equal(canEnterTalkStage('visual', { hasResult: false, hasDuration: false, canGenerate: false, contentReady: false }).reasonKey, 'needContent')
  assert.equal(canEnterTalkStage('voice', { hasResult: false, hasDuration: false, canGenerate: true, contentReady: true }).allowed, true)
  assert.equal(canEnterTalkStage('generate', { hasResult: false, hasDuration: false, canGenerate: true, contentReady: true, voiceReady: false }).reasonKey, 'needVoiceChoice')
  assert.equal(canEnterTalkStage('generate', { hasResult: false, hasDuration: false, canGenerate: true, contentReady: true, voiceReady: true }).allowed, true)
})

test('content and voice leave gates match the wizard', () => {
  assert.equal(canLeaveTalkContentStep({ brief: '', hasScript: false, hasAudio: false }), false)
  assert.equal(canLeaveTalkContentStep({ brief: 'ai的发展', hasScript: false, hasAudio: false }), false)
  assert.equal(canLeaveTalkContentStep({ brief: '今天聊聊AI发展的几个趋势', hasScript: false, hasAudio: false }), true)
  assert.equal(canLeaveTalkContentStep({ brief: '短', hasScript: false, hasAudio: false, contentConfirmed: true }), false)
  assert.equal(canLeaveTalkContentStep({ brief: '', hasScript: true, hasAudio: false }), true)
  assert.equal(canLeaveTalkVoiceStep({ hasAudio: false, voiceId: '' }), false)
  assert.equal(canLeaveTalkVoiceStep({ hasAudio: false, voiceId: '', voiceSkipped: true }), true)
  assert.equal(canSubmitTalkCreation({ hasResult: false, brief: 'x', hasScript: false, hasAudio: false }), false)
  assert.equal(canSubmitTalkCreation({ hasResult: false, brief: '今天聊聊AI发展的几个趋势', hasScript: false, hasAudio: false }), true)
})

test('schema jargon becomes actionable copy', () => {
  assert.equal(humanizeTalkCreationError('文稿结果包含缺失或未授权字段。'), 'AI 返回格式异常，请重试一次。')
  assert.equal(humanizeTalkCreationError('请先输入创作想法或完整文稿。'), '请先输入创作想法或完整文稿。')
})

test('default and neighboring stages follow the same path', () => {
  assert.equal(defaultTalkStage(false), 'content')
  assert.equal(defaultTalkStage(true), 'edit')
  assert.equal(nextTalkStage('content'), 'visual')
  assert.equal(nextTalkStage('voice'), 'generate')
  assert.equal(previousTalkStage('edit'), 'generate')
  assert.equal(previousTalkStage('content'), 'content')
})
