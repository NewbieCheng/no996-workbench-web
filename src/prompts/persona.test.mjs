import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPersonaResearchPrompt, buildPersonaUserPrompt, getPersonaFence, getPersonaSystemPrompt } from './persona.ts'
import { createPersonaMockResponder } from '../features/persona/agent/demo-responder.ts'
import { assertValidProfileMarkdown, extractFencedMarkdown } from '../features/persona/lib/profile-markdown.ts'
import { EMPTY_QUESTIONNAIRE } from '../services/persona/types.ts'

const formData = {
  ...EMPTY_QUESTIONNAIRE,
  publicName: '阿宁',
  occupation: '内容顾问 · 企业服务 · 8 年',
  products: '短视频陪跑',
  audiences: '本地商家',
  clientSituations: '线上内容不稳定',
  industry: '企业服务',
  role: '内容顾问',
  primaryBusiness: '短视频陪跑',
}

test('persona prompt uses questionnaire labels and account-card template', () => {
  const { userPrompt, fence } = buildPersonaUserPrompt({ kind: 'user', formData })
  assert.equal(fence, 'ipprofile')
  assert.equal(getPersonaFence('user'), 'ipprofile')
  assert.match(userPrompt, /公开姓名或昵称：阿宁/)
  assert.match(userPrompt, /产品或服务：短视频陪跑/)
  assert.match(userPrompt, /定位方案 A：专业权威型/)
  assert.match(userPrompt, /亲和型/)
})

test('persona generation no longer advertises ad-hoc web_search', () => {
  assert.doesNotMatch(getPersonaSystemPrompt('user'), /可以使用\\s*web_search|web_search\\s*工具/)
  assert.match(getPersonaSystemPrompt('user'), /只消费前置调研/)
})

test('research prompt contains only real anchors', () => {
  const prompt = buildPersonaResearchPrompt({ kind: 'user', formData })
  assert.match(prompt, /企业服务/)
  assert.match(prompt, /短视频陪跑/)
  assert.doesNotMatch(prompt, /web_search/)
})

test('demo persona responder satisfies account-card validation', () => {
  const { userPrompt } = buildPersonaUserPrompt({ kind: 'user', formData })
  const responder = createPersonaMockResponder('user')
  const raw = responder({ messages: [{ role: 'user', content: userPrompt }] })
  const markdown = extractFencedMarkdown(String(raw), 'ipprofile')
  assert.doesNotThrow(() => assertValidProfileMarkdown(markdown, 'user'))
  assert.match(markdown, /本地商家/)
})
