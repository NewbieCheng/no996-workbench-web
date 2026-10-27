import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../src/core/project.ts'
import { serializeDocument, deserializeDocument, cloneDocument } from '../src/core/serialization.ts'
import { validateEditorDocument, DocumentValidationError } from '../src/core/schema.ts'

test('project: createEmptyDocument generates valid schema', () => {
  const doc = createEmptyDocument('proj-123', '测试口播工程', 'user-456', '9:16')
  assert.equal(doc.schemaVersion, 1)
  assert.equal(doc.id, 'proj-123')
  assert.equal(doc.name, '测试口播工程')
  assert.equal(doc.scope, 'user-456')
  assert.equal(doc.canvas.width, 1080)
  assert.equal(doc.canvas.height, 1920)
  assert.equal(doc.tracks.length, 4)
  assert.doesNotThrow(() => validateEditorDocument(doc))
})

test('project: serialize and deserialize roundtrip fidelity', () => {
  const doc = createEmptyDocument('proj-1', '测试工程', 'user-1', '16:9')

  // 加入带关键帧与效果的高级节点（模拟未来或者完整面板产生的数据）
  doc.tracks[0].elements.push({
    id: 'clip-video-1',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-video-1',
    startUs: 0,
    durationUs: 3_000_000,
    sourceInUs: 0,
    sourceOutUs: 3_000_000,
    rate: 1.0,
    volume: 1.0,
    transform: {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      rotationDeg: 0,
      opacity: 1.0,
      cropMode: 'cover',
      round: 0,
    },
    animations: {
      channels: {
        opacity: {
          propertyPath: 'transform.opacity',
          keyframes: [
            { id: 'kf-1', timeUs: 0, value: 0, easing: 'linear' },
            { id: 'kf-2', timeUs: 1_000_000, value: 1, easing: 'easeOut' },
          ],
        },
      },
    },
    effects: [
      { id: 'fx-1', kind: 'brightness', enabled: true, intensity: 1.2 },
    ],
  })

  doc.captions.push({
    id: 'cue-1',
    startUs: 0,
    durationUs: 2_000_000,
    text: '第一句口播字幕',
    timingSource: 'srt',
  })

  const json = serializeDocument(doc)
  const restored = deserializeDocument(json)

  assert.equal(restored.id, doc.id)
  assert.equal(restored.tracks[0].elements.length, 1)
  const restoredElem = restored.tracks[0].elements[0]
  assert.equal(restoredElem.animations?.channels.opacity.keyframes.length, 2)
  assert.equal(restoredElem.effects?.[0].intensity, 1.2)
  assert.equal(restored.captions[0].text, '第一句口播字幕')
})

test('project: deep clone breaks reference sharing', () => {
  const doc = createEmptyDocument('proj-1', '原始工程')
  const cloned = cloneDocument(doc)

  cloned.name = '修改后的名称'
  assert.equal(doc.name, '原始工程')
  assert.equal(cloned.name, '修改后的名称')
})

test('project: validation rejects invalid duration or duplicate element IDs', () => {
  const doc = createEmptyDocument('proj-bad', '非法工程')

  // 重复 ID
  doc.tracks[0].elements.push({
    id: 'dup-id',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-1',
    startUs: 0,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  })

  doc.tracks[0].elements.push({
    id: 'dup-id',
    trackId: 'track-main-video',
    type: 'video',
    assetId: 'asset-2',
    startUs: 1_000_000,
    durationUs: 1_000_000,
    sourceInUs: 0,
    sourceOutUs: 1_000_000,
    rate: 1,
    volume: 1,
    transform: { x: 0, y: 0, width: 100, height: 100, rotationDeg: 0, opacity: 1, cropMode: 'cover', round: 0 },
  })

  assert.throws(() => validateEditorDocument(doc), DocumentValidationError)
})
