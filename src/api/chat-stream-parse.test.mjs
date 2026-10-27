import assert from 'node:assert/strict'
import test from 'node:test'
import { applyChatCompletionStreamPayload } from './chat-stream-parse.ts'

test('applyChatCompletionStreamPayload 分发 content 与 reasoning_content', () => {
  let content = ''
  let reasoning = ''
  applyChatCompletionStreamPayload(
    JSON.stringify({
      choices: [{ delta: { content: '你好', reasoning_content: '想一下' } }],
    }),
    {
      onContent: (c) => {
        content += c
      },
      onReasoning: (r) => {
        reasoning += r
      },
    },
  )
  assert.equal(content, '你好')
  assert.equal(reasoning, '想一下')
})

test('applyChatCompletionStreamPayload 读取 finish_reason', () => {
  const out = applyChatCompletionStreamPayload(
    JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    {},
  )
  assert.equal(out.finishReason, 'stop')
})
