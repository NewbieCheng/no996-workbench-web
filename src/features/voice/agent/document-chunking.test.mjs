import assert from 'node:assert/strict'
import test from 'node:test'
import {
  enforceAdvancedSegmentTextLimits,
  mergePlannerSegments,
  packDocumentIntoPlannerChunks,
  packSentencesIntoChunks,
  splitIntoSentences,
} from './document-chunking.ts'

test('splitIntoSentences keeps punctuation at sentence end', () => {
  const parts = splitIntoSentences('你好。世界！对吗？')
  assert.deepEqual(parts, ['你好。', '世界！', '对吗？'])
})

test('packSentencesIntoChunks does not split inside a sentence', () => {
  const sentences = ['第一句。', '第二句。', '第三句。']
  const chunks = packSentencesIntoChunks(sentences, 10)
  assert.equal(chunks.length, 2)
  assert.equal(chunks[0], '第一句。第二句。')
  assert.equal(chunks[1], '第三句。')
})

test('packDocumentIntoPlannerChunks respects max size', () => {
  const doc = '甲。'.repeat(4000)
  const chunks = packDocumentIntoPlannerChunks(doc, 100)
  assert.ok(chunks.length > 1)
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 100 || chunk === '甲。'.repeat(50), `chunk too long: ${chunk.length}`)
  }
})

test('mergePlannerSegments renumbers ids in order', () => {
  const merged = mergePlannerSegments([
    { title: '短标题', segments: [{ id: 'a', title: 'A', text: '1', instruction: '' }] },
    { segments: [{ id: 'b', title: 'B', text: '2', instruction: '' }] },
  ])
  assert.equal(merged.title, '短标题')
  assert.deepEqual(merged.segments.map((s) => s.id), ['seg_1', 'seg_2'])
})

test('enforceAdvancedSegmentTextLimits splits on sentence boundary', () => {
  const long = '段。'.repeat(2000)
  const { segments, hadSplit } = enforceAdvancedSegmentTextLimits(
    [{ id: 'seg_1', title: '长段', text: long, instruction: '自然' }],
    3500,
    10000,
  )
  assert.equal(hadSplit, true)
  assert.ok(segments.length >= 2)
  for (const seg of segments) {
    assert.ok(seg.text.length <= 10000)
  }
})
