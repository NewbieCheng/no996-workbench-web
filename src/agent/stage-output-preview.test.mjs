import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatStageOutputPreview,
  resolveStageDisplayText,
  resolveStageOutputLayers,
} from './stage-output-preview.ts'

test('formatStageOutputPreview 格式化对象并剔除 prompt 字段', () => {
  const text = formatStageOutputPreview({
    actualPrompt: 'secret',
    title: '早八穿搭',
    points: ['通勤', '显瘦'],
  })
  assert.ok(!text.includes('secret'))
  assert.ok(text.includes('早八穿搭'))
  assert.ok(text.includes('points'))
})

test('resolveStageDisplayText 优先流式正文', () => {
  const text = resolveStageDisplayText(
    { output: { x: 1 }, streamingContent: '流式片段' },
    { isRunning: true, stream: '实时增量' },
  )
  assert.equal(text, '流式片段')
})

test('resolveStageOutputLayers 优先 streamingReasoningContent', () => {
  const { thinking } = resolveStageOutputLayers(
    { streamingReasoningContent: '推理流', output: { 假设: '旧' } },
    { kind: 'model' },
  )
  assert.equal(thinking, '推理流')
})

test('resolveStageOutputLayers 保留多轮工具调用的思考历史并附加当前轮', () => {
  const { thinking } = resolveStageOutputLayers(
    {
      reasoningHistory: [
        { turn: 1, text: '第一次检索太宽泛' },
        { turn: 2, text: '第二次改为具体行业词' },
      ],
      streamingReasoningContent: '第三次正在判断结果',
    },
    { kind: 'model', isRunning: true },
  )
  assert.ok(thinking.includes('第一次检索太宽泛'))
  assert.ok(thinking.includes('第二次改为具体行业词'))
  assert.ok(thinking.includes('第三次正在判断结果'))
  assert.ok(thinking.indexOf('第一次检索太宽泛') < thinking.indexOf('第二次改为具体行业词'))
})

test('resolveStageOutputLayers 拆分假设到思考区', () => {
  const { product, thinking } = resolveStageOutputLayers(
    {
      output: { 主题: '穿搭', 假设: '用户要点击率' },
    },
    { kind: 'model' },
  )
  assert.ok(product.includes('穿搭'))
  assert.ok(!product.includes('点击率'))
  assert.equal(thinking, '用户要点击率')
})
