import assert from 'node:assert/strict'
import test from 'node:test'
import { checkScriptReadiness, readinessSummary } from './purpose-readiness.ts'

function videoConfig(overrides = {}) {
  return {
    mode: 'video',
    product: '水煮肉片调料包',
    durationSec: 60,
    goal: '转化',
    purpose: 'conversion',
    structure: { kind: 'preset', presetId: 'conv-pain-solution' },
    materials: {
      delivery: '3 袋装，含腌肉料包与红油酱包',
      fitFor: '下班想快速做川菜的人',
      action: '点购物车选 3 袋装',
    },
    strength: 50,
    platform: '抖音',
    ...overrides,
  }
}

test('活配置：目的、结构与必填素材齐全时不报缺项', () => {
  assert.deepEqual(checkScriptReadiness(videoConfig()), [])
})

test('未选目的必须先选（新视频任务不允许默认目的）', () => {
  const issues = checkScriptReadiness(videoConfig({ purpose: undefined }))
  assert.ok(issues.some((issue) => issue.field === 'purpose'))
  assert.match(readinessSummary(issues), /创作目的/)
})

test('未选结构时报缺，且指向第 1 步', () => {
  const issues = checkScriptReadiness(videoConfig({ structure: { kind: 'auto' } }))
  const hit = issues.find((issue) => issue.field === 'structure')
  assert.ok(hit)
  assert.equal(hit.step, 1)
})

test('缺必填素材时阻止生成，并指出具体字段', () => {
  const issues = checkScriptReadiness(
    videoConfig({ materials: { delivery: '3 袋装', fitFor: '', action: '' } }),
  )
  assert.deepEqual(
    issues.map((issue) => issue.field).sort(),
    ['materials.action', 'materials.fitFor'],
  )
  assert.ok(issues.every((issue) => issue.step === 2))
})

test('直播沿用旧规则：只要有产品名即可', () => {
  const live = {
    mode: 'live',
    product: '全家桶',
    durationSec: 1800,
    goal: '成交',
    structure: { kind: 'auto' },
    strength: 50,
    platform: '抖音',
  }
  assert.deepEqual(checkScriptReadiness(live), [])
})
