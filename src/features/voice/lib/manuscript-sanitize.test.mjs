import assert from 'node:assert/strict'
import test from 'node:test'
import { sanitizeManuscriptForVoice } from './manuscript-sanitize.ts'

test('removes ATX markdown headings', () => {
  const input = '# 标题一\n## 引言：时代\n正文。'
  const out = sanitizeManuscriptForVoice(input)
  assert.ok(!out.includes('#'))
  assert.match(out, /标题一/)
  assert.match(out, /引言：时代/)
})

test('strips list and link markdown', () => {
  const input = '- 第一点\n[链接](https://x.com)\n**加粗**'
  const out = sanitizeManuscriptForVoice(input)
  assert.match(out, /第一点/)
  assert.match(out, /链接/)
  assert.match(out, /加粗/)
  assert.ok(!out.includes('](https'))
  assert.ok(!out.includes('**'))
})
