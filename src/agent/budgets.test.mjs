import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveBudgets, retryMaxTokens } from './budgets.ts'

test('远端预算显著宽于演示预算（真机慢不能变成失败）', () => {
  const demo = resolveBudgets(true)
  const remote = resolveBudgets(false)
  assert.ok(remote.stepMs > demo.stepMs)
  assert.ok(remote.flowMs > demo.flowMs)
  assert.ok(remote.autofillMs > demo.autofillMs)
  assert.ok(remote.reviewerMaxTokens >= demo.reviewerMaxTokens)
})

test('流程预算必须大于单步预算，否则单步还没跑完流程就断了', () => {
  for (const isMock of [true, false]) {
    const b = resolveBudgets(isMock)
    assert.ok(b.flowMs > b.stepMs, `flowMs=${b.flowMs} stepMs=${b.stepMs}`)
    assert.ok(b.reviewerMs >= b.stepMs || b.reviewerMs > b.autofillMs)
  }
})

test('演示预算保持短：超时就说明真出问题了，不该拖', () => {
  const demo = resolveBudgets(true)
  assert.ok(demo.autofillMs <= 5_000)
  assert.ok(demo.flowMs <= 30_000)
})

test('远端预填预算足够覆盖实测延迟（6635ms / 8203ms / 5472ms）', () => {
  // 旧值 3000ms 对三次实测全部超时，这是「AI 已补全」假成功的根因
  const remote = resolveBudgets(false)
  assert.ok(remote.autofillMs >= 8_203 * 2, `autofillMs=${remote.autofillMs}`)
})

test('retryMaxTokens 逐次翻倍且不超过上限', () => {
  assert.equal(retryMaxTokens(4096, 0, 16384), 4096)
  assert.equal(retryMaxTokens(4096, 1, 16384), 8192)
  assert.equal(retryMaxTokens(4096, 2, 16384), 16384)
  // 第三次仍被上限压住，不会无限放大
  assert.equal(retryMaxTokens(4096, 3, 16384), 16384)
})

test('retryMaxTokens 对已是上限的值保持不动', () => {
  assert.equal(retryMaxTokens(16384, 3, 16384), 16384)
})
