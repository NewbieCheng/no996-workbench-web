/**
 * 镜头参数契约的真值回归（阶段 0 防线）。
 *
 * 守两件事：
 *  A. 注册表 editableKeys 与组件源码的真实 useShotProp('key') 调用保持同步
 *     （生成脚本与本测试共用 scripts/lib/shot-editable-keys.mjs 唯一口径）。
 *  B. getShotSchema 返回的每个字段都真实存在 → 假控件（填了不生效的输入框）永不回潮。
 *
 * 另有对已适配 6 镜头的正向控制：过滤不能过头，把真字段也滤没了。
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { SHOT_CATALOG } from '../src/demos/registry.generated.ts'
import { getShotSchema } from '../src/demos/shot-schemas.ts'
import { extractEditableKeys } from '../../../scripts/lib/shot-editable-keys.mjs'

const DEMOS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/demos')

function sourceOf(entry) {
  return readFileSync(path.join(DEMOS, `${entry.importPath}.tsx`), 'utf8')
}

test('注册表 editableKeys 与组件源码的 useShotProp 调用一致（151 条全量）', () => {
  assert.equal(SHOT_CATALOG.length, 151, '镜头数变化时同步更新本断言并检查波及面')
  for (const entry of SHOT_CATALOG) {
    const actual = extractEditableKeys(sourceOf(entry))
    assert.deepEqual(
      entry.editableKeys,
      actual,
      `${entry.shotId}: 注册表与源码不同步 —— 请运行 npm run gen:shots 重新生成`,
    )
  }
})

test('getShotSchema 不返回任何假字段：每个字段键都真实被组件消费', () => {
  for (const entry of SHOT_CATALOG) {
    const consumed = new Set(extractEditableKeys(sourceOf(entry)))
    const schema = getShotSchema(entry.shotId)
    for (const field of schema.fields) {
      assert.ok(
        consumed.has(field.key),
        `${entry.shotId}: 字段 "${field.key}" 在检查器可见，但组件不消费 —— 假控件被拦截`,
      )
    }
  }
})

test('已适配镜头仍暴露真实可编辑字段（防过滤过头）', () => {
  const expectations = [
    ['opening/text-as-mask', 30],
    ['opening/spotlight-hero-card', 2],
    ['typography/blur-slide', 2],
    ['typography/lead-word-zoom-assemble', 2],
    ['outro/logo-shrink-wordmark-lockup', 2],
    ['data/chart-live-moves~AxisRescaleShockV2', 2],
  ]
  for (const [shotId, minFields] of expectations) {
    const schema = getShotSchema(shotId)
    assert.ok(
      schema.fields.length >= minFields,
      `${shotId}: 期望至少 ${minFields} 个可编辑字段，实际 ${schema.fields.length}`,
    )
    assert.ok(schema.features.hasText, `${shotId}: 已适配镜头应标记 hasText`)
  }
})

test('未接参且未接配色的镜头返回空字段（诚实提示的触发条件）', () => {
  // 找一个 editableKeys 完全为空的演示固定镜头（分类兜底被 editableKeys 拦截，不产生假字段）
  const fixedShot = SHOT_CATALOG.find((entry) => (entry.editableKeys ?? []).length === 0)
  assert.ok(fixedShot, '应至少存在一个 editableKeys 为空的演示固定镜头')
  const schema = getShotSchema(fixedShot.shotId)
  assert.equal(schema.fields.length, 0, `${fixedShot.shotId} 未接参，不应出现可编辑字段`)
  assert.deepEqual(schema.features, { hasText: false, hasImageSlot: false, hasData: false })
})

test('useLook 镜头自动补标准配色字段（§6 1.6 独立通道）', () => {
  // circle-match-iris 已接入 useLook → editableKeys 含 6 个配色键 → schema 应暴露全部 6 个
  const schema = getShotSchema('transition/circle-match-iris')
  const keys = schema.fields.map((f) => f.key)
  const colorKeys = keys.filter((key) =>
    ['colorTheme', 'customBg', 'customInk', 'customPanel', 'customPrimary', 'customSecondary'].includes(key),
  )
  assert.deepEqual(
    colorKeys,
    ['colorTheme', 'customBg', 'customInk', 'customPanel', 'customPrimary', 'customSecondary'],
    'useLook 镜头应按标准顺序暴露 6 个配色字段',
  )
  for (const field of schema.fields) {
    if (colorKeys.includes(field.key)) {
      assert.equal(field.category, 'style', `${field.key} 应归入 style 分类`)
    }
  }
  // features 只由文案/图片槽驱动：接文案后 hasText 为真，但仍无图片槽/数据看板
  assert.equal(schema.features.hasImageSlot, false)
  assert.equal(schema.features.hasData, false)
})

test('crane-rise-reveal（阶段 2 样板）已接参：暴露文案字段且无假字段', () => {
  const schema = getShotSchema('opening/crane-rise-reveal')
  const keys = new Set(schema.fields.map((f) => f.key))
  for (const expected of ['eyebrow', 'title', 'subline', 'brand', 'showBrandMark']) {
    assert.ok(keys.has(expected), `crane-rise-reveal 缺字段 ${expected}`)
  }
  // 5 个文案字段 + 6 个标准配色字段（§6 1.6：useLook 镜头自动补 style 字段组）
  assert.equal(schema.fields.length, 11, 'crane-rise-reveal 应有 5 个文案字段 + 6 个配色字段')
  for (const expected of ['colorTheme', 'customBg', 'customInk', 'customPanel', 'customPrimary', 'customSecondary']) {
    assert.ok(keys.has(expected), `crane-rise-reveal 缺配色字段 ${expected}`)
  }
  assert.ok(schema.features.hasText, 'crane-rise-reveal 应标记 hasText')
})
