import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUserChatMessage } from './build-message.ts'

test('buildUserChatMessage orders images before text', () => {
  const msg = buildUserChatMessage('你好', [
    { kind: 'image', name: 'a.png', mimeType: 'image/png', dataUri: 'data:image/png;base64,AA==' },
    { kind: 'document', name: 'note.md', text: '正文' },
  ])
  assert.equal(msg.role, 'user')
  assert.ok(Array.isArray(msg.content))
  assert.equal(msg.content[0].type, 'image_url')
  assert.equal(msg.content[1].type, 'text')
  assert.match(msg.content[1].text ?? '', /【附件：note\.md】/)
  assert.match(msg.content[1].text ?? '', /正文/)
})

test('buildUserChatMessage keeps plain string when only text', () => {
  const msg = buildUserChatMessage('仅文本', [])
  assert.equal(msg.content, '仅文本')
})
