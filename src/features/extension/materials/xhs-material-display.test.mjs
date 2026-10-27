import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeXiaohongshuCollectedItem,
  resolveXiaohongshuDisplayTitle,
} from './xhs-material-display.ts'

const longBody =
  '不必羡慕 Grok Bot 了，真正懂你的 personal agent 来了！\n第二段正文不应进标题。'

test('resolveXiaohongshuDisplayTitle uses first line when title equals body', () => {
  const title = resolveXiaohongshuDisplayTitle(longBody, longBody)
  assert.equal(title, '不必羡慕 Grok Bot 了，真正懂你的 personal agent 来了！')
  assert.ok(title.length <= 60)
})

test('normalizeXiaohongshuCollectedItem shortens title and keeps full content', () => {
  const normalized = normalizeXiaohongshuCollectedItem({
    url: 'https://www.xiaohongshu.com/explore/x',
    platformId: 'xiaohongshu',
    title: longBody,
    content: longBody,
    collectedAt: Date.now(),
  })
  assert.equal(normalized.content, longBody)
  assert.notEqual(normalized.title, longBody)
  assert.ok((normalized.title ?? '').length <= 61)
})
