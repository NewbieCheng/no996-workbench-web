import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FLOW_EXPLAIN_COPY,
  flowKindCounts,
  flowKindSummaryText,
  flowKindTag,
  flowLeadText,
  orderedFlowSteps,
} from './flow-explain-model.ts'

const stage = (id, order, kind) => ({ id, order, label: id, kind, tag: kind })

test('按真实来源归类：model 才算 AI 专家，tool / algo 都不算', () => {
  const counts = flowKindCounts([
    stage('a', 1, 'model'),
    stage('b', 2, 'algo'),
    stage('c', 3, 'tool'),
    stage('d', 4, 'model'),
  ])
  assert.deepEqual(counts, { total: 4, expert: 2, search: 1, local: 1 })
})

test('未知 kind 不归到任何一类 —— 宁可合计对不上，也不把不知道的说成 AI', () => {
  const counts = flowKindCounts([stage('a', 1, 'model'), stage('b', 2, undefined), stage('c', 3, '黑魔法')])
  assert.equal(counts.total, 3)
  assert.equal(counts.expert, 1)
  assert.equal(counts.search, 0)
  assert.equal(counts.local, 0)
})

test('空列表不报数字（返回空串，调用方因此不渲染摘要）', () => {
  assert.equal(flowKindSummaryText([]), '')
  assert.deepEqual(flowKindCounts([]), { total: 0, expert: 0, search: 0, local: 0 })
})

test('摘要只说真实存在的环节：没有检索步骤就不提检索', () => {
  const withSearch = [
    stage('a', 1, 'model'),
    stage('b', 2, 'tool'),
    stage('c', 3, 'algo'),
    stage('d', 4, 'model'),
  ]
  assert.equal(
    flowKindSummaryText(withSearch),
    '共 4 个处理阶段：2 处模型推理 · 1 次联网检索 · 1 项本机算法',
  )
  assert.equal(
    flowKindSummaryText([stage('a', 1, 'model'), stage('b', 2, 'algo')]),
    '共 2 个处理阶段：1 处模型推理 · 1 项本机算法',
  )
})

test('英文摘要与中文摘要讲的是同一件事（数字必须一致）', () => {
  const steps = [stage('a', 1, 'model'), stage('b', 2, 'tool'), stage('c', 3, 'algo')]
  assert.equal(flowKindSummaryText(steps, 'en'), '3 stages: 1 AI specialists · 1 web search · 1 local algorithms')
  const zh = flowKindSummaryText(steps, 'zh')
  for (const n of ['3', '1']) {
    assert.ok(zh.includes(n), `${zh} 缺少数字 ${n}`)
  }
})

test('排序按 order 升序，且不动原数组（面板顺序 = 真实执行顺序）', () => {
  const input = [stage('c', 3, 'model'), stage('a', 1, 'model'), stage('b', 2, 'model')]
  assert.deepEqual(orderedFlowSteps(input).map((s) => s.id), ['a', 'b', 'c'])
  assert.deepEqual(input.map((s) => s.id), ['c', 'a', 'b'])
})

test('面板默认文案两种语言都在，且不是占位符（渲染出来不会是 undefined）', () => {
  for (const lang of ['zh', 'en']) {
    assert.ok(FLOW_EXPLAIN_COPY[lang].title.length > 0)
    assert.ok(FLOW_EXPLAIN_COPY[lang].hint.length > 0)
  }
})

test('主打文案说的是「几位专家协同」，不是调用次数 / 轮次上限', () => {
  const steps = [
    stage('a', 1, 'model'),
    stage('b', 2, 'model'),
    stage('c', 3, 'tool'),
    stage('d', 4, 'algo'),
  ]
  assert.equal(flowLeadText(steps), '2 位 AI 专家协同参与，4 个处理阶段依序执行')
  // 技术腔的措辞一个都不能出现
  for (const jargon of ['调用', '轮', '次数', '上限', 'temperature']) {
    assert.ok(!flowLeadText(steps).includes(jargon), `主打文案不该出现「${jargon}」`)
    assert.ok(!FLOW_EXPLAIN_COPY.zh.hint.includes(jargon), `提示文案不该出现「${jargon}」`)
  }
})

test('没有模型步骤时不硬吹「N 位专家」（说什么都不如不说）', () => {
  assert.equal(flowLeadText([stage('a', 1, 'algo'), stage('b', 2, 'algo')]), '共 2 个处理阶段依序执行')
  assert.equal(flowLeadText([]), '')
})

test('kind 标签兜底：algo 绝不说成 AI', () => {
  assert.equal(flowKindTag('model'), 'AI')
  assert.equal(flowKindTag('algo'), '本机算法')
  assert.equal(flowKindTag('tool'), '联网检索')
  assert.equal(flowKindTag(undefined), '')
  assert.equal(flowKindTag('model', 'en'), 'AI')
  assert.equal(flowKindTag('algo', 'en'), 'Local rule')
})
