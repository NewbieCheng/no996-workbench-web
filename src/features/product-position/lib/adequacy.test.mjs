import assert from 'node:assert/strict'
import test from 'node:test'
import { checkAdequacy } from './adequacy.ts'

const product = {
  id: 'p1',
  name: '21 天声音训练营',
  type: '线上训练营',
  specs: [{ id: 's1', name: '标准版', price: '2980 元 / 期' }],
  answers: { usage: '', current: '', purchase: '', delivery: '' },
  attachments: [],
  createdAt: '2026-10-27T00:00:00.000Z',
  updatedAt: '2026-10-27T00:00:00.000Z',
}

function snapshot(patch = {}) {
  return {
    product,
    attachments: [],
    ...patch,
  }
}

test('三项必填缺失时拦在模型之前', () => {
  const result = checkAdequacy(snapshot({ product: { ...product, name: '  ' } }))
  assert.equal(result.status, 'insufficient')
  assert.equal(result.code, 'missing-basic')
})

test('规格行全空视为缺少必填', () => {
  const result = checkAdequacy(snapshot({ product: { ...product, specs: [{ id: 's', name: '', price: '' }] } }))
  assert.equal(result.status, 'insufficient')
  assert.equal(result.code, 'missing-basic')
})

test('第一问有内容即可通过', () => {
  const result = checkAdequacy(
    snapshot({ product: { ...product, answers: { ...product.answers, usage: '每天打卡，21 天直播点评' } } }),
  )
  assert.equal(result.status, 'ok')
})

test('可读附件正文可以替代第一问', () => {
  const result = checkAdequacy(
    snapshot({
      attachments: [{ id: 'a1', fileName: '产品说明.md', status: 'parsed', text: '课程包含 21 天任务与 4 次直播。' }],
    }),
  )
  assert.equal(result.status, 'ok')
})

test('只有「不支持解析」的附件不算资料', () => {
  const result = checkAdequacy(
    snapshot({ attachments: [{ id: 'a1', fileName: '介绍.pdf', status: 'unsupported' }] }),
  )
  assert.equal(result.status, 'insufficient')
  assert.equal(result.code, 'missing-substance')
})

test('人设档案里的产品描述可以作为资料', () => {
  const result = checkAdequacy(
    snapshot({
      persona: {
        id: 'u1',
        name: '默认分身',
        updatedAt: '2026-10-27T00:00:00.000Z',
        questionnaire: { products: '线上声音训练营，含 21 天打卡与直播点评' },
        content: '',
      },
    }),
  )
  assert.equal(result.status, 'ok')
})

test('缺失说明指向第一题或附件，而不是泛泛报错', () => {
  const result = checkAdequacy(snapshot())
  assert.equal(result.status, 'insufficient')
  assert.match(result.reason, /第 1 题|产品资料/)
})
