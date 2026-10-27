import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_PRESETS,
  IP_SPEAKER_VERTICAL_PRESET,
  IP_KNOWLEDGE_HORIZONTAL_PRESET,
  IP_FLASH_SALE_PRESET,
  IP_UNBOXING_SQUARE_PRESET,
} from '../src/presets/index.ts'
import { validateEditorDocument } from '../src/core/schema.ts'

test('templates-presets: all 4 IP presets generate valid schema documents', () => {
  assert.equal(ALL_PRESETS.length, 4)

  for (const preset of ALL_PRESETS) {
    const doc = preset.createDocument({ name: `测试-${preset.name}`, scope: 'tenant-test' })

    // 1. 结构与契约校验
    assert.doesNotThrow(() => validateEditorDocument(doc), `预设 ${preset.id} 应当满足 EditorDocument 契约`)

    // 2. 字段与属性断言
    assert.ok(doc.durationUs > 0)
    assert.equal(doc.canvas.ratio, preset.ratio)
    assert.ok(doc.tracks.length >= 4)
    assert.ok(doc.captions.length > 0)
    assert.ok(doc.templateMeta?.templateId === preset.id)
  }
})

test('templates-presets: aspect ratios match preset definitions', () => {
  const speaker = IP_SPEAKER_VERTICAL_PRESET.createDocument()
  assert.equal(speaker.canvas.width, 1080)
  assert.equal(speaker.canvas.height, 1920)

  const knowledge = IP_KNOWLEDGE_HORIZONTAL_PRESET.createDocument()
  assert.equal(knowledge.canvas.width, 1920)
  assert.equal(knowledge.canvas.height, 1080)

  const unbox = IP_UNBOXING_SQUARE_PRESET.createDocument()
  assert.equal(unbox.canvas.width, 1080)
  assert.equal(unbox.canvas.height, 1080)
})

test('templates-presets: cover and brand metadata assignment', () => {
  const doc = IP_SPEAKER_VERTICAL_PRESET.createDocument()

  doc.templateMeta = {
    ...doc.templateMeta,
    cover: {
      title: '大标题：3分钟学会高效时间管理',
      subtitle: '内附打工人必备清单',
      timestampUs: 1_500_000,
    },
    brand: {
      brandColor: '#ff6400',
      logoPosition: 'top-right',
    },
  }

  assert.equal(doc.templateMeta.cover?.title, '大标题：3分钟学会高效时间管理')
  assert.equal(doc.templateMeta.cover?.timestampUs, 1_500_000)
  assert.equal(doc.templateMeta.brand?.brandColor, '#ff6400')
  assert.doesNotThrow(() => validateEditorDocument(doc))
})
