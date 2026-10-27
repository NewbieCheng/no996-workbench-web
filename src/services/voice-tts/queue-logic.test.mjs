import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canTransition,
  countActiveJobs,
  pickNextQueuedJob,
  planPruneForUser,
} from './queue-logic.ts'

function job(overrides) {
  return {
    id: overrides.id ?? 'j1',
    ownerUserId: overrides.ownerUserId ?? 1,
    status: overrides.status ?? 'queued',
    createdAt: overrides.createdAt ?? 1000,
    text: 'hello',
    textPreview: 'hello',
    voiceId: 'v',
    voiceLabel: 'V',
    rate: 1,
    volume: 50,
    pitch: 1,
    audioMime: 'audio/wav',
    ...overrides,
  }
}

test('pickNextQueuedJob respects FIFO and blocks when running', () => {
  const jobs = [
    job({ id: 'a', createdAt: 2000 }),
    job({ id: 'b', createdAt: 1000 }),
    job({ id: 'c', status: 'running', createdAt: 3000 }),
  ]
  assert.equal(pickNextQueuedJob(jobs), null)
  const jobs2 = [job({ id: 'a', createdAt: 2000 }), job({ id: 'b', createdAt: 1000 })]
  assert.equal(pickNextQueuedJob(jobs2)?.id, 'b')
})

test('countActiveJobs', () => {
  const jobs = [
    job({ status: 'queued' }),
    job({ id: '2', status: 'running' }),
    job({ id: '3', status: 'succeeded' }),
  ]
  assert.equal(countActiveJobs(jobs), 2)
})

test('canTransition rejects terminal mutations', () => {
  assert.equal(canTransition('succeeded', 'queued'), false)
  assert.equal(canTransition('queued', 'running'), true)
})

test('planPruneForUser drops oldest succeeded over limit', () => {
  const jobs = []
  for (let i = 0; i < 85; i++) {
    jobs.push(
      job({
        id: `s${i}`,
        status: 'succeeded',
        createdAt: i * 1000,
        blobId: `s${i}`,
        audioByteLength: 1000,
      }),
    )
  }
  const plan = planPruneForUser({
    jobs,
    blobBytes: new Map(jobs.map((j) => [j.blobId, 1000])),
    ownerUserId: 1,
    now: Date.now(),
  })
  assert.equal(plan.deleteJobIds.length, 5)
})
