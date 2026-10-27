import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyDocument } from '../../../../packages/video-editor/src/core/project.ts'
import { contentShotLineBudget } from '../../../../packages/video-editor/src/demos/content-shot-layout.ts'
import { coverOutputSize } from '../lib/cover-size.ts'
import { setTalkRatio } from './talk-model.ts'

test('legacy 3:4 documents still open with their stored canvas', () => {
  const doc = createEmptyDocument('talk-ratio-1', '口播', '8', '9:16')
  const next = setTalkRatio(doc, '3:4')
  assert.equal(next.canvas.ratio, '3:4')
  assert.equal(next.canvas.width, 1080)
  assert.equal(next.canvas.height, 1440)
})

test('new 1:1 documents use the square canvas', () => {
  const doc = createEmptyDocument('talk-ratio-sq', '口播', '8', '9:16')
  const next = setTalkRatio(doc, '1:1')
  assert.equal(next.canvas.ratio, '1:1')
  assert.equal(next.canvas.width, 1080)
  assert.equal(next.canvas.height, 1080)
})

test('cover output size follows the canvas', () => {
  assert.deepEqual(coverOutputSize(1080, 1440), { width: 1080, height: 1440 })
  assert.deepEqual(coverOutputSize(1920, 1080), { width: 1920, height: 1080 })
  assert.throws(() => coverOutputSize(0, 1440), /封面画布尺寸无效/)
})

test('content shots use a 7-character cover line between portrait and landscape', () => {
  assert.deepEqual(contentShotLineBudget(1080, 1920), { titleCols: 6, subCols: 12 })
  assert.deepEqual(contentShotLineBudget(1080, 1440), { titleCols: 7, subCols: 14 })
  assert.deepEqual(contentShotLineBudget(1920, 1080), { titleCols: 9, subCols: 18 })
})
