import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildVoiceWorkflowNodes,
  resolvePlannerBatchTotal,
  parsePlanBatchCurrent,
} from './voice-workflow-nodes.ts'

describe('buildVoiceWorkflowNodes', () => {
  it('builds fan-out batch nodes and merge for total=3', () => {
    const nodes = buildVoiceWorkflowNodes(3)
    const batch = nodes.filter((n) => n.id.startsWith('segment_planner_batch_'))
    assert.equal(batch.length, 3)
    assert.ok(nodes.find((n) => n.id === 'segment_planner_merge'))
    assert.deepEqual(batch[0].deps, ['ingest'])
    const merge = nodes.find((n) => n.id === 'segment_planner_merge')
    assert.deepEqual(merge?.deps, [
      'segment_planner_batch_1',
      'segment_planner_batch_2',
      'segment_planner_batch_3',
    ])
    const review = nodes.find((n) => n.id === 'plan_review')
    assert.deepEqual(review?.deps, ['segment_planner_merge'])
  })

  it('single batch still has merge node', () => {
    const nodes = buildVoiceWorkflowNodes(1)
    assert.equal(nodes.filter((n) => n.id.startsWith('segment_planner_batch_')).length, 1)
    assert.ok(nodes.some((n) => n.id === 'segment_planner_merge'))
  })
})

describe('resolvePlannerBatchTotal', () => {
  it('prefers meta total', () => {
    assert.equal(resolvePlannerBatchTotal({ planner_batches_total: '4' }, null), 4)
    assert.equal(resolvePlannerBatchTotal({}, { planner_batches_total: 2 }), 2)
    assert.equal(resolvePlannerBatchTotal({}, null), 1)
  })
})

describe('parsePlanBatchCurrent', () => {
  it('parses current index', () => {
    assert.equal(parsePlanBatchCurrent('2/5'), 2)
    assert.equal(parsePlanBatchCurrent(''), null)
  })
})
