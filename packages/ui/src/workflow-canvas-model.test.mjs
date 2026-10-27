import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeWorkflowLayout,
  stateAt,
  computeProgress,
  computeTotalDuration,
  normalizeWorkflowEventTimes,
  resolveBranchNodeStatus,
} from './workflow-canvas-model.ts'

test('空节点输入时布局返回空数组和零尺寸', () => {
  const result = computeWorkflowLayout([])
  assert.deepEqual(result.layoutedNodes, [])
  assert.deepEqual(result.edges, [])
  assert.equal(result.bounds.width, 0)
  assert.equal(result.bounds.height, 0)
})

test('线性依赖节点被正确分列，X 轴单调递增，并生成贝塞尔连线', () => {
  const nodes = [
    { id: 'step1', title: '步骤1', type: 'input' },
    { id: 'step2', title: '步骤2', type: 'llm', deps: ['step1'] },
    { id: 'step3', title: '步骤3', type: 'guard', deps: ['step2'] },
  ]
  const { layoutedNodes, edges } = computeWorkflowLayout(nodes)
  assert.equal(layoutedNodes.length, 3)
  assert.equal(edges.length, 2)

  assert.equal(layoutedNodes[0].level, 0)
  assert.equal(layoutedNodes[1].level, 1)
  assert.equal(layoutedNodes[2].level, 2)
  assert.ok(layoutedNodes[0].x < layoutedNodes[1].x)
  assert.ok(layoutedNodes[1].x < layoutedNodes[2].x)

  assert.equal(edges[0].from, 'step1')
  assert.equal(edges[0].to, 'step2')
  assert.ok(edges[0].d.startsWith('M'))
})

test('条件节点的成功与兜底分支预先布局并在下游汇合', () => {
  const nodes = [
    { id: 'root', title: '根输入', type: 'input' },
    { id: 'branchA', title: '分支A', type: 'tool', deps: ['root'] },
    { id: 'branchB', title: '分支B', type: 'tool', deps: ['root'] },
    { id: 'merge', title: '汇总', type: 'llm', deps: ['branchA', 'branchB'] },
  ]
  const { layoutedNodes, edges } = computeWorkflowLayout(nodes)
  assert.equal(layoutedNodes.length, 4)
  assert.equal(edges.length, 4)

  const a = layoutedNodes.find((n) => n.id === 'branchA')
  const b = layoutedNodes.find((n) => n.id === 'branchB')
  assert.equal(a.level, 1)
  assert.equal(b.level, 1)
  assert.equal(a.x, b.x)
  assert.notEqual(a.y, b.y)

  const merge = layoutedNodes.find((n) => n.id === 'merge')
  assert.equal(merge.level, 2)
})

test('stateAt 能够精准还原事件流切片', () => {
  const nodeIds = ['n1', 'n2']
  const log = [
    { t: 100, id: 'n1', kind: 'start' },
    { t: 200, id: 'n1', kind: 'text', v: '你好' },
    { t: 300, id: 'n1', kind: 'text', v: '世界' },
    { t: 400, id: 'n1', kind: 'end', v: 0 },
    { t: 500, id: 'n2', kind: 'start' },
    { t: 600, id: 'n2', kind: 'text', v: '处理中' },
    { t: 700, id: 'n2', kind: 'end', v: '出错了' },
  ]

  // t = 50: 两个节点都待执行
  const s0 = stateAt(nodeIds, log, 50)
  assert.equal(s0.n1.status, 'pending')
  assert.equal(s0.n2.status, 'pending')

  // t = 250: n1 正在运行且文本累积到「你好」
  const s1 = stateAt(nodeIds, log, 250)
  assert.equal(s1.n1.status, 'running')
  assert.equal(s1.n1.text, '你好')
  assert.equal(s1.n2.status, 'pending')

  // t = 450: n1 完成（done），完整文本为「你好世界」
  const s2 = stateAt(nodeIds, log, 450)
  assert.equal(s2.n1.status, 'done')
  assert.equal(s2.n1.text, '你好世界')
  assert.equal(s2.n2.status, 'pending')

  // t = 800: n1 完成，n2 失败（error）
  const s3 = stateAt(nodeIds, log, 800)
  assert.equal(s3.n1.status, 'done')
  assert.equal(s3.n2.status, 'error')
  assert.equal(s3.n2.text, '处理中')

  assert.equal(computeTotalDuration(log), 700)
})

test('normalizeWorkflowEventTimes 将 wall-clock 事件平移到相对回放轴', () => {
  const t0 = 1_791_791_989_000
  const log = [
    { t: t0, id: 'n1', kind: 'start' },
    { t: t0 + 2000, id: 'n1', kind: 'end', v: 0 },
  ]
  const normalized = normalizeWorkflowEventTimes(log)
  assert.equal(normalized[0].t, 0)
  assert.equal(normalized[1].t, 2000)
  assert.equal(computeTotalDuration(log), 2000)
})

test('条件分支在判定前待定，判定后只完成命中路径', () => {
  assert.equal(resolveBranchNodeStatus(undefined, 'success'), 'pending')
  assert.equal(resolveBranchNodeStatus(undefined, 'fallback'), 'pending')
  assert.equal(resolveBranchNodeStatus('success', 'success'), 'done')
  assert.equal(resolveBranchNodeStatus('success', 'fallback'), 'skipped')
  assert.equal(resolveBranchNodeStatus('fallback', 'success'), 'skipped')
  assert.equal(resolveBranchNodeStatus('fallback', 'fallback'), 'done')
})

test('computeProgress 将已跳过的未命中分支计入已处理步骤', () => {
  const state = {
    condition: { status: 'done', text: '', startedAt: 0, finishedAt: 10 },
    selected: { status: 'done', text: '', startedAt: 10, finishedAt: 20 },
    unselected: { status: 'skipped', text: '', startedAt: 0, finishedAt: 20 },
    next: { status: 'running', text: '', startedAt: 20, finishedAt: 0 },
  }
  const progress = computeProgress(4, state)
  assert.equal(progress.doneCount, 3)
  assert.equal(progress.runningNodeId, 'next')
  assert.equal(progress.percent, 75)
})

test('stateAt 在回放事件中保留未命中分支状态', () => {
  const state = stateAt(
    ['condition', 'selected', 'unselected', 'next'],
    [
      { t: 0, id: 'condition', kind: 'start' },
      { t: 10, id: 'condition', kind: 'end', v: 0 },
      { t: 20, id: 'selected', kind: 'start' },
      { t: 30, id: 'selected', kind: 'end', v: 0 },
      { t: 30, id: 'unselected', kind: 'end', v: 'skipped' },
      { t: 40, id: 'next', kind: 'start' },
    ],
    35,
  )
  assert.equal(state.selected.status, 'done')
  assert.equal(state.unselected.status, 'skipped')
  assert.equal(state.next.status, 'pending')
})
