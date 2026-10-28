import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutText, TemplatePainter } from './template-renderer.ts'
import { createTemplateProject } from './template-project.ts'
import { createTalkCoverProject } from '../lib/cover.ts'
const measure = { measureText: text => ({ width: Array.from(text).length * 10 }) }

test('wrapping preserves punctuation, explicit breaks, English spaces, and grapheme clusters', () => {
  for (const text of ['你好，世界！这是排版。', '中文（内容）不丢失。', 'hello world editor', '👨‍👩‍👧‍👦家庭👩🏽‍💻', '第一行\n\n第三行']) {
    const layout = layoutText(measure, text, 60, 10, 1.2, 300)
    assert.equal(layout.lines.join(''), text.replace(/\n/g, ''))
    assert.ok(layout.lines.every(line => !/^[，。！？、；：）】》」』]/u.test(line)))
    assert.ok(layout.lines.every(line => !/[（【《「『]$/u.test(line)))
  }
})
test('overflow is reported without silently reducing font size or truncating text', () => {
  const text = '这是一段很长的文字，用于验证完整保留。'
  const layout = layoutText(measure, text, 40, 20, 1.4, 20)
  assert.equal(layout.overflow, true)
  assert.equal(layout.lines.join(''), text)
  assert.equal(layout.lineHeight, 28)
})
function mockContext() {
  const calls = []
  const noop = () => {}
  return { calls, fillRect: noop, clearRect: noop, drawImage: noop, beginPath: noop, roundRect: noop, rect: noop, arc: noop, clip: noop, fill: noop, stroke: noop, moveTo: noop, lineTo: noop, save: noop, restore: noop,
    measureText: text => ({ width: Array.from(text).length * 20 }), strokeText: (text, x, y) => calls.push(['stroke', text, x, y]), fillText: (text, x, y) => calls.push(['fill', text, x, y]), createLinearGradient: () => ({ addColorStop: noop }) }
}
test('all eight templates draw the same deterministic frames through one painter', () => {
  for (const templateId of ['scroll', 'poster', 'call', 'career', 'life', 'lesson', 'audiogram', 'tiktok']) {
    const project = createTemplateProject({ templateId, script: '每一个字都保留。', duration: 5, title: '我的标题' })
    const first = mockContext(); const second = mockContext()
    const painter = new TemplatePainter(project)
    painter.draw(first, 1)
    painter.draw(second, 1)
    assert.deepEqual(first.calls, second.calls)
    assert.ok(first.calls.some(call => call[1] === '我的标题'))
    assert.ok(first.calls.some(call => call[1].includes('每一个字')))
  }
})

test('a 1:1 cover paints the square design instead of a stretched portrait', () => {
  const project = createTalkCoverProject({ lookId: 'scroll', title: '方屏封面', ratio: '1:1' })
  const context = mockContext()
  const rects = []
  context.fillRect = (...args) => rects.push(args)
  new TemplatePainter(project).draw(context, 0)
  assert.ok(rects.some(args => args[2] === 1080 && args[3] === 1080))
  assert.ok(context.calls.some(call => call[1] === '方屏封面'))
})
