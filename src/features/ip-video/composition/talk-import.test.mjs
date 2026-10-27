import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveTalkCaptionImport } from './talk-model.ts'

const cue = (text, startUs, durationUs) => ({ id: text, text, startUs, durationUs, timingSource: 'srt' })

test('SRT import can establish duration on an empty project', () => {
  const cues = [cue('第一句', 0, 2_000_000), cue('第二句', 2_000_000, 1_500_000)]
  const result = resolveTalkCaptionImport(cues, 0)
  assert.equal(result.durationUs, 3_500_000)
  assert.equal(result.script, '第一句\n第二句')
  assert.deepEqual(result.captions, cues)
})

test('SRT import keeps a real audio duration and rejects overflow', () => {
  const cues = [cue('第一句', 0, 2_000_000)]
  assert.equal(resolveTalkCaptionImport(cues, 5_000_000).durationUs, 5_000_000)
  assert.throws(() => resolveTalkCaptionImport([cue('太长', 0, 6_000_000)], 5_000_000), /字幕.*时间|超出/u)
})

test('empty SRT content fails instead of clearing captions', () => {
  assert.throws(() => resolveTalkCaptionImport([], 5_000_000), /没有有效内容/u)
})
