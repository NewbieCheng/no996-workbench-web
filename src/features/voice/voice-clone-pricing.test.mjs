import assert from 'node:assert/strict'
import { resolveClonePricing } from './voice-clone-pricing.ts'
const base = {
  enabled: true,
  points_per_clone: 8800,
  max_voices_per_user: 5,
  target_model: 'x',
  total: 0,
}

assert.deepEqual(resolveClonePricing(null).ready, false)

const fromPoints = resolveClonePricing(base)
assert.equal(fromPoints.points, 8800)
assert.equal(fromPoints.saleYuan, '88')

const fromApi = resolveClonePricing({
  ...base,
  points_per_clone: 9900,
  sale_price_yuan: 99,
  list_price_yuan: 199,
})
assert.equal(fromApi.saleYuan, '99')
assert.equal(fromApi.listYuan, '199')
assert.equal(fromApi.showListPrice, true)

console.log('voice-clone-pricing.test.mjs ok')
