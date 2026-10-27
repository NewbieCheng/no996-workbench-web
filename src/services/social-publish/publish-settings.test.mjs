import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveWeixinPublishMode, resolveXhsMaterialType } from './publish-settings.ts'

test('resolveWeixinPublishMode auto uses material type', () => {
  assert.equal(resolveWeixinPublishMode('auto', 'article'), 'article')
  assert.equal(resolveWeixinPublishMode('auto', 'image_text'), 'image_draft')
})

test('resolveXhsMaterialType auto prefers images when present', () => {
  assert.equal(resolveXhsMaterialType('auto', 0), 'article')
  assert.equal(resolveXhsMaterialType('auto', 2), 'image_text')
  assert.equal(resolveXhsMaterialType('article', 2), 'article')
})
