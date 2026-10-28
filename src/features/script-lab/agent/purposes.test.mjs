import assert from 'node:assert/strict'
import test from 'node:test'
import { SCRIPT_PURPOSES, purposeIdFromGoal, purposeById, structureById, goalOfPurpose } from './purposes/index.ts'

test('四类目的各带四套结构，且每套结构占比之和为 1', () => {
  assert.equal(SCRIPT_PURPOSES.length, 4)
  for (const purpose of SCRIPT_PURPOSES) {
    assert.equal(purpose.structures.length, 4, `${purpose.id} 应有 4 套结构`)
    for (const structure of purpose.structures) {
      assert.equal(structure.segments.length, 5, `${structure.id} 应为 5 段`)
      const sum = structure.segments.reduce((acc, segment) => acc + segment.share, 0)
      assert.ok(Math.abs(sum - 1) < 1e-6, `${structure.id} 占比之和应为 1，实际 ${sum}`)
      for (const segment of structure.segments) {
        assert.ok(segment.name.trim(), `${structure.id} 段名不能为空`)
        assert.ok(segment.purpose.trim(), `${structure.id} 段职责不能为空`)
      }
    }
  }
})

test('结构 id 全局唯一，能按目的反查', () => {
  const ids = SCRIPT_PURPOSES.flatMap((purpose) => purpose.structures.map((s) => s.id))
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(structureById('conv-pain-solution')?.name, '痛点解决型（PAS）')
  assert.equal(goalOfPurpose('opinion'), '观点干货')
})

test('旧目标映射：成交 → 转化，流量不暗中归类', () => {
  assert.equal(purposeIdFromGoal('成交'), 'conversion')
  assert.equal(purposeIdFromGoal('获客'), 'acquisition')
  assert.equal(purposeIdFromGoal('流量'), undefined)
  assert.equal(purposeIdFromGoal('人设'), 'persona')
})

test('每个目的都有写作方法与评审口径', () => {
  for (const purpose of SCRIPT_PURPOSES) {
    assert.ok(purpose.method.length > 200, `${purpose.id} 缺少方法块`)
    assert.ok(purpose.reviewFocus.length > 40, `${purpose.id} 缺少评审口径`)
    assert.ok(purpose.materials.some((field) => field.required), `${purpose.id} 至少要有一个必填素材`)
    assert.ok(purposeById(purpose.id))
  }
})
