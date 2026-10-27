import assert from 'node:assert/strict'
import test from 'node:test'
import {
  STAGE_STATUS_LABEL,
  stageDurationText,
  stageProgressPercent,
  stageProgressText,
  stageStepText,
  normalizeSteps,
} from './stage-progress-model.ts'

const step = (id, order) => ({ id, order, label: id })
const done = (id) => ({ id, status: 'done' })

test('缺 state 的步骤按「待执行」补齐，不消失也不报错', () => {
  const { ordered, stateOf } = normalizeSteps([step('b', 2), step('a', 1)], [done('a')])
  assert.deepEqual(ordered.map((s) => s.id), ['a', 'b'])
  assert.equal(stateOf('a').status, 'done')
  assert.equal(stateOf('b').status, 'idle')
  assert.equal(stateOf('不存在').status, 'idle')
})

test('进度取「第一个 running」，没有 running 时取「已完成 + 1」', () => {
  const steps = [step('a', 1), step('b', 2), step('c', 3), step('d', 4)]
  assert.equal(stageProgressText(steps, [done('a'), { id: 'b', status: 'running' }]), '第 2 步 / 共 4 步')
  assert.equal(stageProgressText(steps, [done('a'), done('b')]), '第 3 步 / 共 4 步')
})

test('一步都没完成时不报进度（报「第 1 步」是猜的，不是实测值）', () => {
  const steps = [step('a', 1), step('b', 2)]
  assert.equal(stageProgressText(steps, []), undefined)
  assert.equal(stageProgressText(steps, [{ id: 'a', status: 'idle' }]), undefined)
  assert.equal(stageProgressText(steps, [{ id: 'a', status: 'failed' }]), undefined)
})

test('全部跑完不报「第 N+1 步」（越界）', () => {
  const steps = [step('a', 1), step('b', 2)]
  assert.equal(stageProgressText(steps, [done('a'), done('b')]), undefined)
})

test('stageProgressPercent 与步骤完成数一致', () => {
  const steps = [step('a', 1), step('b', 2), step('c', 3), step('d', 4)]
  assert.equal(stageProgressPercent(steps, [done('a'), done('b')]), 50)
  assert.equal(stageProgressPercent(steps, [done('a'), { id: 'b', status: 'running' }]), 38)
  assert.equal(stageProgressPercent(steps, [done('a'), done('b'), done('c'), done('d')]), 100)
})

test('空步骤列表返回 undefined，不抛错', () => {
  assert.equal(stageProgressText([], []), undefined)
})

test('缺计时就返回 undefined —— 不编「完成 1s」这种假耗时', () => {
  assert.equal(stageDurationText({ startedAt: 1000 }), undefined)
  assert.equal(stageDurationText({ finishedAt: 5000 }), undefined)
  assert.equal(stageDurationText({}), undefined)
  assert.equal(stageDurationText(undefined), undefined)
})

test('耗时文案按真实差值算，不足 1s 也不抬成 1s', () => {
  assert.equal(stageDurationText({ startedAt: 0, finishedAt: 300 }), '不到 1s')
  assert.equal(stageDurationText({ startedAt: 0, finishedAt: 4200 }), '4s')
})

test('时间倒流或非有限值不做数（宁可没有，不给负数/NaN）', () => {
  assert.equal(stageDurationText({ startedAt: 5000, finishedAt: 1000 }), undefined)
  assert.equal(stageDurationText({ startedAt: 0, finishedAt: Number.NaN }), undefined)
  assert.equal(stageDurationText({ startedAt: 0, finishedAt: Number.POSITIVE_INFINITY }), undefined)
})

test('headline 只在 running 时展示 —— 跑完还展示会和「已完成」自相矛盾', () => {
  assert.equal(stageStepText({ id: 'a', status: 'running', headline: '正在拆解客群定位…' }), '正在拆解客群定位…')
  assert.equal(stageStepText({ id: 'a', status: 'done', headline: '正在拆解客群定位…' }), '已完成')
  assert.equal(stageStepText({ id: 'a', status: 'failed', headline: '正在拆解客群定位…' }), '失败')
})

test('running 但没给 headline 时退回状态文案，不留空行', () => {
  assert.equal(stageStepText({ id: 'a', status: 'running' }), STAGE_STATUS_LABEL.running)
})

test('五种状态的文案固定（两个面板共用一份，说法必须一致）', () => {
  assert.deepEqual(STAGE_STATUS_LABEL, {
    idle: '待执行',
    running: '进行中',
    done: '已完成',
    failed: '失败',
    skipped: '已跳过',
  })
})
