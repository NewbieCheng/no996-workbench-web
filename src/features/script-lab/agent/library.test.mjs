import assert from 'node:assert/strict'
import test from 'node:test'
import { builtinLibraryProvider, LIVE_CHAPTER_PURPOSES, LIVE_STRUCTURE_PRESETS, VIDEO_STRUCTURE_DESC } from './library.ts'
import { SCRIPT_GOALS } from './types.ts'

const DEFAULT_QUERY = { mode: 'video', goal: '获客', durationSec: 60 }

test('builtin search always returns a complete structure', () => {
  for (const mode of ['video', 'live']) {
    for (const goal of SCRIPT_GOALS) {
      const hits = builtinLibraryProvider.search({ ...DEFAULT_QUERY, mode, goal })
      assert.ok(hits.length > 0, `${mode}/${goal} 应返回结构`)
      for (const hit of hits) {
        assert.ok(hit && typeof hit === 'object', `${mode}/${goal} 命中项不得为 undefined`)
        assert.ok(hit.id, 'hit.id 必填')
        assert.ok(hit.segments.length > 0, `${mode}/${goal} 结构不得为空`)
      }
    }
  }
})

test('unknown goal falls back instead of returning undefined', () => {
  // goal 来自后台任务载荷（IndexedDB，未做类型校验）：未知值不得让整轮生成崩掉
  const hits = builtinLibraryProvider.search({
    mode: 'video',
    goal: '不存在的目标',
    durationSec: 60,
  })
  assert.equal(hits.length, 1)
  assert.ok(hits[0], '未知目标必须回退到内置公式，而不是 [undefined]')
  assert.equal(Array.isArray(hits[0].segments), true)
  assert.ok(hits[0].segments.length > 0)
})

test('video formulas have shares summing to roughly 1', () => {
  for (const goal of SCRIPT_GOALS) {
    const hit = builtinLibraryProvider.search({ mode: 'video', goal, durationSec: 60 })[0]
    const sum = hit.segments.reduce((a, s) => a + s.share, 0)
    assert.ok(Math.abs(sum - 1) < 0.01, `${goal} 占比之和应约为 1，实际 ${sum}`)
  }
})

test('live formula is the fixed five chapters', () => {
  const hit = builtinLibraryProvider.search({ mode: 'live', goal: '获客', durationSec: 1800 })[0]
  assert.equal(hit.segments.length, 5)
  assert.equal(LIVE_CHAPTER_PURPOSES.length, 5)
  const sum = hit.segments.reduce((a, s) => a + s.share, 0)
  assert.ok(Math.abs(sum - 1) < 0.01)
})

test('live structure presets include the default five chapters and custom alternatives', () => {
  assert.ok(LIVE_STRUCTURE_PRESETS.length >= 4)
  const defaultPreset = LIVE_STRUCTURE_PRESETS.find((preset) => preset.id === 'live-five-chapter')
  assert.ok(defaultPreset)
  assert.deepEqual(defaultPreset.segmentLabels, ['开场暖场', '产品介绍', '痛点共鸣', '促单环节', '复盘收尾'])
})

test('custom live structure keeps user chapter order and uses live purposes', () => {
  const hit = builtinLibraryProvider.search({
    mode: 'live',
    goal: '成交',
    durationSec: 1800,
    customStructure: '开场暖场 + 产品演示 + 互动问答 + 复盘收尾',
  })[0]
  assert.equal(hit.id, 'custom-structure')
  assert.deepEqual(hit.segments.map((segment) => segment.name), ['开场暖场', '产品演示', '互动问答', '复盘收尾'])
  assert.match(hit.segments[0].purpose, /留住|开场/)
  assert.match(hit.segments[1].purpose, /展示|演示/)
  assert.match(hit.segments[2].purpose, /问题|答疑/)
  const sum = hit.segments.reduce((total, segment) => total + segment.share, 0)
  assert.ok(Math.abs(sum - 1) < 0.01)
})
test('custom structure takes priority and splits on separators', () => {
  const hit = builtinLibraryProvider.search({
    mode: 'video',
    goal: '获客',
    durationSec: 60,
    customStructure: '开场钩子 + 干货 + 结尾引导',
  })[0]
  assert.equal(hit.id, 'custom-structure')
  assert.equal(hit.segments.length, 3)
  assert.equal(hit.segments[0].name, '开场钩子')
})

test('food vlog and tutorial structures derive meaningful semantic purpose', () => {
  const hit = builtinLibraryProvider.search({
    mode: 'video',
    goal: '成交',
    durationSec: 60,
    customStructure: '人物对话 + 烹饪过程 + 产品植入 + 互动收尾',
  })[0]
  assert.equal(hit.segments.length, 4)
  assert.equal(hit.segments[0].purpose, '生活互动，自然引入')
  assert.equal(hit.segments[1].purpose, '烹饪过程与操作演示')
  assert.equal(hit.segments[2].purpose, '自然融入，展现帮手价值')
  assert.equal(hit.segments[3].purpose, '成果展示与满足感')
  // 不得再暴力硬编码「前3秒下钩子」与「促成行动」
  assert.notEqual(hit.segments[0].purpose, '前3秒下钩子')
})

test('a single-token custom structure is ignored in favour of the builtin', () => {
  // 只有一段无法构成结构，应回退到内置公式而不是产出单段脚本
  const hit = builtinLibraryProvider.search({
    mode: 'video',
    goal: '获客',
    durationSec: 60,
    customStructure: '随便写写',
  })[0]
  assert.notEqual(hit.id, 'custom-structure')
})

test('every goal has a structure description', () => {
  for (const goal of SCRIPT_GOALS) {
    assert.ok(VIDEO_STRUCTURE_DESC[goal]?.trim(), `${goal} 缺少结构说明`)
  }
})
