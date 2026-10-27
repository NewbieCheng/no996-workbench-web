import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMomentsPlanOutput } from './parser.ts'

const fence = (value) => `\`\`\`json\n${JSON.stringify(value)}\n\`\`\``
const dates = Array.from({ length: 7 }, (_, i) => `2026-10-${26 + i}`)
function fixture(total) {
  const input = { planPeriod: { startDate: dates[0], endDate: '2026-11-01' }, planningMode: 'daily', publishSpec: { kind: 'weekly', perWeek: total } }
  const actualDates = [...dates.slice(0, 6), '2026-11-01']
  const days = actualDates.map((date, i) => ({ date, items: Array.from({ length: Math.floor(total / 7) + (i < total % 7 ? 1 : 0) }, (_, j) => ({ publishOrder: j + 1, contentDirection: '价值', topic: '选题' })) }))
  return { input, payload: { status: 'success', planningMode: 'daily', days } }
}
test('周数量边界和余数均按七天分配', () => {
  for (const n of [1, 6, 7, 8, 27, 28]) {
    const { input, payload } = fixture(n)
    assert.equal(parseMomentsPlanOutput(fence(payload), input).status, 'success')
  }
})
test('拒绝重复日期、数量和模式错误', () => {
  for (const mutation of [p => { p.days[1].date = p.days[0].date }, p => { p.days[0].items = [] }, p => { p.planningMode = 'theme' }, p => { p.days[0].items[0].publishOrder = 2 }]) {
    const { input, payload } = fixture(8)
    mutation(payload)
    assert.equal(parseMomentsPlanOutput(fence(payload), input).status, 'blocked')
  }
})
