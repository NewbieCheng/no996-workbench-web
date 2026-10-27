import test from 'node:test'
import assert from 'node:assert/strict'
import { splitSubtitleTimeline, subtitleIndexAt, estimateSpeechDuration, formatVideoTime, canRenderIPVideo, drawFrame } from './video-renderer.ts'

test('sentences use punctuation and character-weighted durations, without dropping text', () => {
  const script = '你好。今天怎么样！再见?'
  const lines = splitSubtitleTimeline(script, 12)
  assert.equal(lines.length, 3)
  assert.equal(lines.map(line => line.text).join(''), script)
  assert.equal(lines[0].start, 0)
  assert.equal(lines.at(-1).end, 12)
  assert.equal(lines[1].start, lines[0].end)
  assert.ok(lines[1].end - lines[1].start > lines[0].end - lines[0].start)
})
test('empty timelines, exact boundaries and final time have stable indexes', () => {
  assert.deepEqual(splitSubtitleTimeline('', 10), [])
  assert.deepEqual(splitSubtitleTimeline('你好。', NaN), [])
  assert.equal(subtitleIndexAt([], 0), -1)
  const lines = splitSubtitleTimeline('甲。乙。', 10)
  assert.equal(subtitleIndexAt(lines, 0), 0)
  assert.equal(subtitleIndexAt(lines, 5), 1)
  assert.equal(subtitleIndexAt(lines, 10), 1)
})
test('duration excludes whitespace, counts Unicode code points, and respects speed', () => {
  assert.equal(estimateSpeechDuration('你 好\n😊', 1), 3 / 2.8)
  assert.equal(estimateSpeechDuration('你好世界', 1.5), 4 / (2.8 * 1.5))
  assert.throws(() => estimateSpeechDuration('你好', 0))
  assert.equal(formatVideoTime(61.9), '01:01')
  assert.equal(formatVideoTime(NaN), '00:00')
  assert.equal(canRenderIPVideo(), false)
})

test('drawFrame executes cleanly for different templates on mock canvas context', () => {
  const calls = []
  const mockContext = {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    lineWidth: 1,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    clearRect: () => {},
    roundRect: () => {},
    rect: () => {},
    lineTo: () => {},
    drawImage: (...args) => calls.push(['drawImage', ...args]),
    strokeText: (...args) => calls.push(['strokeText', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    measureText: text => ({ width: text.length * 20 }),
    beginPath: () => {},
    moveTo: () => {},
    arcTo: () => {},
    arc: () => {},
    clip: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} })
  }
  const mockImage = { width: 1080, height: 1920 }
  const script = '黄金三秒，抓住全场注意力。'
  const timeline = splitSubtitleTimeline(script, 6)
  const style = { size: 50, color: '#39E508', font: 'sans-serif', y: 70 }

  assert.doesNotThrow(() => {
    drawFrame(mockContext, mockImage, timeline, 1, style, 'tiktok')
    drawFrame(mockContext, mockImage, timeline, 2, style, 'audiogram')
    drawFrame(mockContext, mockImage, timeline, 3, style, 'call')
    drawFrame(mockContext, mockImage, timeline, 4, style, 'scroll')
  })
  assert.ok(calls.length > 0)
})
