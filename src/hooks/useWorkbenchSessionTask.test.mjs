import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldApplySessionSuccess } from './useWorkbenchSessionTask.ts'

test('shouldApplySessionSuccess: no task', () => {
  assert.equal(shouldApplySessionSuccess(undefined, 0), false)
})

test('shouldApplySessionSuccess: not succeeded', () => {
  assert.equal(
    shouldApplySessionSuccess({ id: 'a', status: 'running', finishedAt: 100 }, 0),
    false,
  )
})

test('shouldApplySessionSuccess: applies once per finishedAt', () => {
  const task = { id: 'a', status: 'succeeded', finishedAt: 1000 }
  assert.equal(shouldApplySessionSuccess(task, 0), true)
  assert.equal(shouldApplySessionSuccess(task, 1000), false)
  assert.equal(shouldApplySessionSuccess(task, 999), true)
})
