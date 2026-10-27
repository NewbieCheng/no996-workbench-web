import assert from 'node:assert/strict'
import test from 'node:test'
import {
  httpStatusOf,
  isAbortError,
  isRetryableError,
  sleep,
  withRetry,
  withStreamingStepTimeout,
} from './runtime.ts'

function httpError(status) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data: {} } })
}

test('httpStatusOf 同时认扁平 status 与 axios 的 response.status', () => {
  assert.equal(httpStatusOf({ status: 500 }), 500)
  assert.equal(httpStatusOf({ response: { status: 400 } }), 400)
  assert.equal(httpStatusOf(new Error('boom')), undefined)
  assert.equal(httpStatusOf(undefined), undefined)
})

test('5xx 与网络错误可重试，4xx 不可重试', () => {
  assert.equal(isRetryableError(httpError(500)), true)
  assert.equal(isRetryableError(httpError(503)), true)
  assert.equal(isRetryableError(httpError(429)), true)
  assert.equal(isRetryableError(httpError(408)), true)
  // 确定性拒绝：重试只会白等一轮并再扣一次积分
  assert.equal(isRetryableError(httpError(400)), false)
  assert.equal(isRetryableError(httpError(401)), false)
  assert.equal(isRetryableError(httpError(402)), false)
  assert.equal(isRetryableError(httpError(404)), false)
  // 无状态码 ⇒ 网络层错误，多半瞬时
  assert.equal(isRetryableError(new Error('Failed to fetch')), true)
})

test('取消永不重试', () => {
  const abort = new DOMException('Aborted', 'AbortError')
  assert.equal(isAbortError(abort), true)
  assert.equal(isRetryableError(abort), false)
})

test('withRetry 对空的 500 重试后成功', async () => {
  let attempts = 0
  const value = await withRetry(async () => {
    attempts += 1
    if (attempts < 3) throw httpError(500)
    return 'ok'
  }, 3)
  assert.equal(value, 'ok')
  assert.equal(attempts, 3)
})

test('withRetry 对 400 立即失败，不浪费重试', async () => {
  let attempts = 0
  await assert.rejects(
    withRetry(async () => {
      attempts += 1
      throw httpError(400)
    }, 3),
    /HTTP 400/,
  )
  assert.equal(attempts, 1)
})

test('withRetry 重试前调用 onRetry，便于清缓冲与抬上限', async () => {
  const seen = []
  let attempts = 0
  await withRetry(
    async () => {
      attempts += 1
      if (attempts < 2) throw httpError(500)
      return 'done'
    },
    2,
    undefined,
    undefined,
    (_e, attempt) => {
      seen.push(attempt)
    },
  )
  assert.deepEqual(seen, [0])
})

test('withRetry 耗尽重试后抛出最后一个错误', async () => {
  let attempts = 0
  await assert.rejects(
    withRetry(async () => {
      attempts += 1
      throw httpError(500)
    }, 1),
    /HTTP 500/,
  )
  assert.equal(attempts, 2)
})

test('withRetry 的 shouldRetry 可覆盖默认策略', async () => {
  let attempts = 0
  // 默认 400 不重试；这里强制重试以验证策略可插拔
  const value = await withRetry(
    async () => {
      attempts += 1
      if (attempts < 2) throw httpError(400)
      return 'ok'
    },
    2,
    undefined,
    () => true,
  )
  assert.equal(value, 'ok')
  assert.equal(attempts, 2)
})

test('withStreamingStepTimeout 有 chunk 活动时不因短墙钟误杀', async () => {
  const value = await withStreamingStepTimeout(
    async (signal, bump) => {
      for (let i = 0; i < 3; i++) {
        await sleep(30, signal)
        bump()
      }
      return 'ok'
    },
    { idleMs: 200, maxMs: 5000 },
  )
  assert.equal(value, 'ok')
})

test('withStreamingStepTimeout 长时间无活动则中断', async () => {
  await assert.rejects(
    withStreamingStepTimeout(
      async (signal) => sleep(300, signal),
      { idleMs: 80, maxMs: 10_000 },
    ),
    /无新输出/,
  )
})

test('withRetry 在 signal 已取消时不发起调用', async () => {
  const ac = new AbortController()
  ac.abort()
  let attempts = 0
  await assert.rejects(
    withRetry(
      async () => {
        attempts += 1
        return 'ok'
      },
      2,
      ac.signal,
    ),
    (e) => isAbortError(e),
  )
  assert.equal(attempts, 0)
})
