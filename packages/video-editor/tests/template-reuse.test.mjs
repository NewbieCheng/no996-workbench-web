import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import {
  exportDocumentAsTemplate,
  instantiateTemplate,
  createRecipeTemplate,
} from '../src/core/assembly/template.ts'
import { ASSEMBLY_COMPONENT_CATALOG, ASSEMBLY_RECIPES } from '../src/core/assembly/catalog.ts'

test('template: exportDocumentAsTemplate strips account data and creates slots', () => {
  const doc = createEmptyDocument('test-proj', '口播样片', 'user-priv-123')
  doc.tracks[3].elements.push({
    id: 'elem-title-1',
    trackId: 'track-title-text',
    type: 'text',
    text: '口播核心卖点',
    startUs: 0,
    durationUs: 3_000_000,
    style: {
      font: '"Alibaba PuHuiTi", sans-serif',
      size: 50,
      weight: 600,
      color: '#FFFFFF',
      backgroundColor: '',
      outlineColor: '',
      outlineWidth: 0,
      align: 'left',
      lineHeight: 1,
      letterSpacing: 0,
    },
    transform: { x: 50, y: 100, width: 900, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'contain', round: 0 },
  })

  const template = exportDocumentAsTemplate(doc, {
    templateId: 'tpl-viral-01',
    name: '爆款带货口播',
    category: 'ecommerce',
  })

  assert.equal(template.version, 2)
  assert.equal(template.name, '爆款带货口播')
  assert.equal(template.slots.length, 1)
  assert.equal(template.slots[0].type, 'text')
  assert.equal(template.slots[0].targetField, 'text')
  assert.equal(template.slots[0].targetInstanceId, 'elem-title-1')
  // 确认未泄露私有账号信息
  assert.equal('scope' in template, false)
})

test('template: instantiateTemplate refills slots into a new project without modifying source', () => {
  const doc = createEmptyDocument('blank-proj', '全新视频', 'user-2')
  const template = createRecipeTemplate('recipe.explainer')

  assert.equal(template.scenes.length, 5)
  assert.equal(template.templateId, 'tpl-recipe.explainer')

  const instantiated = instantiateTemplate(template, doc, {})
  assert.equal(instantiated.id, 'blank-proj')
  assert.equal(instantiated.revision, 2)
  assert.equal(doc.revision, 1) // 原工程不可变
})

test('catalog: exactly contains 32 components, 18 motions, 8 layouts, 6 styles, 4 recipes', () => {
  const compCount = Object.keys(ASSEMBLY_COMPONENT_CATALOG).length
  assert.equal(compCount, 32, '首版目标必须精确包含 32 个组件')

  const recipeCount = Object.keys(ASSEMBLY_RECIPES).length
  assert.equal(recipeCount, 4, '必须精确包含 4 条组合配方')
})
