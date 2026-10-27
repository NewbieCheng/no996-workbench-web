import assert from 'node:assert/strict'
import test from 'node:test'
import { lengthInstruction, buildRewritePass1 } from './build-social-rewrite-prompt.ts'
import { parseRewritePass2Raw } from './parse-rewrite-pass2.ts'
import { createDefaultRewriteSettings } from './social-studio-rewrite-types.ts'

test('lengthInstruction custom word count', () => {
  const settings = createDefaultRewriteSettings('wechat')
  settings.lengthPreset = 'custom'
  settings.customWordCount = 2000
  assert.match(lengthInstruction(settings, 1000), /2000/)
})

test('buildRewritePass1 includes source body', () => {
  const settings = createDefaultRewriteSettings('wechat')
  const { user } = buildRewritePass1({
    platform: 'wechat',
    settings,
    sourceTitle: '原标题',
    sourceBody: '正文内容',
  })
  assert.ok(user.includes('正文内容'))
  assert.ok(user.includes('原标题'))
})

test('parseRewritePass2Raw parses json', () => {
  const raw = '{"titles":["A","B","C"],"body":"正文"}'
  const out = parseRewritePass2Raw(raw, '默认')
  assert.equal(out.body, '正文')
  assert.deepEqual(out.titles, ['A', 'B', 'C'])
})
