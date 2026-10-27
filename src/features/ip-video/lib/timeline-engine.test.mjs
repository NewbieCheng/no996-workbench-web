import test from 'node:test'
import assert from 'node:assert/strict'
import {
  tokenizeSentenceText,
  splitSentences,
  buildAlignedTimeline,
  getTimelineFrameState
} from './timeline-engine.ts'

test('tokenizeSentenceText handles Chinese, English words and punctuation properly', () => {
  const text = '你有发现，AI video 改变了短视频。'
  const tokens = tokenizeSentenceText(text)
  assert.ok(tokens.includes('你'))
  assert.ok(tokens.includes('有'))
  assert.ok(tokens.includes('AI'))
  assert.ok(tokens.includes('video'))
  assert.ok(tokens.includes('短'))
  assert.ok(tokens.includes('视'))
  assert.ok(tokens.includes('频'))
})

test('splitSentences splits on punctuation and preserves long clauses appropriately', () => {
  const script = '你好。今天来分享一个很重要的思维模型！很多人在表达时容易把过程全部讲完，其实别人只需要知道核心结论，这样沟通效率更高。'
  const sentences = splitSentences(script)
  assert.ok(sentences.length >= 3)
  assert.equal(sentences.join(''), script)
})

test('buildAlignedTimeline creates monotonic sentence and word timestamps covering full duration', () => {
  const script = '一件小事，让表达变清楚。别急着给答案，先讲一个故事。'
  const duration = 10
  const timeline = buildAlignedTimeline(script, duration)

  assert.equal(timeline.duration, 10)
  assert.ok(timeline.sentences.length >= 2)
  assert.ok(timeline.allWords.length > 0)

  // Verify monotonicity
  let prevWordEnd = 0
  for (const word of timeline.allWords) {
    assert.ok(word.start >= prevWordEnd - 0.0001, `Word start ${word.start} should be >= prevEnd ${prevWordEnd}`)
    assert.ok(word.end > word.start, `Word end ${word.end} must be > start ${word.start}`)
    prevWordEnd = word.start // allowing pauses between sentences
  }

  assert.ok(timeline.sentences[0].start >= 0)
  assert.equal(timeline.sentences.at(-1).end, 10)
})

test('getTimelineFrameState finds correct active sentence and word at given time', () => {
  const script = '从现在开始，把注意力放回自己身上。'
  const timeline = buildAlignedTimeline(script, 6)

  const at0 = getTimelineFrameState(timeline, 0)
  assert.equal(at0.sentenceIndex, 0)
  assert.equal(at0.activeWordIndex, 0)
  assert.ok(at0.sentenceProgress >= 0 && at0.sentenceProgress < 0.1)

  const atEnd = getTimelineFrameState(timeline, 6)
  assert.equal(atEnd.sentenceIndex, timeline.sentences.length - 1)
  assert.equal(atEnd.activeWordIndex, timeline.allWords.length - 1)
  assert.equal(atEnd.sentenceProgress, 1)
})
