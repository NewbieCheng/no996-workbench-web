import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveXhsPublishSummary } from './resolve-xhs-summary.ts'

test('resolveXhsPublishSummary prefers brief summary', () => {
  assert.equal(resolveXhsPublishSummary('  自定义摘要  ', '# 标题\n正文', '标题'), '自定义摘要')
})

test('resolveXhsPublishSummary falls back to plain content', () => {
  const md = '## 小节\n\n这是**正文**第一段。'
  const out = resolveXhsPublishSummary('', md, '备用标题')
  assert.ok(out.includes('正文'))
  assert.ok(!out.includes('**'))
})

test('resolveXhsPublishSummary uses title when content empty', () => {
  assert.equal(resolveXhsPublishSummary('', '   ', '发布标题'), '发布标题')
})
