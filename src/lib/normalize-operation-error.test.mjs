import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeOperationErrorMessage } from './normalize-operation-error.ts'

test('normalizeOperationErrorMessage maps unavailable model', () => {
  const out = normalizeOperationErrorMessage('model "mimo-v2.6-flash" does not exist or is not available')
  assert.match(out, /mimo-v2\.6-flash/)
  assert.match(out, /文本对话链/)
})

test('normalizeOperationErrorMessage passes through Chinese', () => {
  const msg = '请先填写灵感主题'
  assert.equal(normalizeOperationErrorMessage(msg), msg)
})
