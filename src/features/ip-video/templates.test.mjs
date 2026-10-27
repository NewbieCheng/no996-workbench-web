import test from 'node:test'
import assert from 'node:assert/strict'
import { IP_VIDEO_RULES, IP_VIDEO_TEMPLATES, COVER_STYLES, templatePreviewUrl } from './templates.ts'

test('eight complete, uniquely identified built-in video templates', () => {
  assert.equal(IP_VIDEO_TEMPLATES.length, 8)
  assert.equal(new Set(IP_VIDEO_TEMPLATES.map(item => item.id)).size, 8)
  for (const item of IP_VIDEO_TEMPLATES) {
    assert.ok(Array.from(item.sampleScript).length >= IP_VIDEO_RULES.minScriptChars)
    assert.ok(item.materials.length >= 2)
    assert.ok(item.stars >= 1 && item.stars <= 5)
    assert.ok(item.cases.length > 0)
    assert.ok(item.cases.every(example => /演示/.test(example.views)))
    assert.match(decodeURIComponent(templatePreviewUrl(item).split(',').slice(1).join(',')), /width="540" height="960"/)
  }
})

test('template preview escapes user text as SVG text, never as executable markup', () => {
  const payload = '<script>alert(1)</script><image href="https://evil.test/x"/>'
  const svg = decodeURIComponent(templatePreviewUrl(IP_VIDEO_TEMPLATES[0], payload).split(',').slice(1).join(','))
  assert.ok(!svg.includes('<script'))
  assert.ok(!svg.includes('<image'))
  assert.ok(svg.includes('&lt;'))
})

test('rules and cover styles are stable', () => {
  assert.equal(IP_VIDEO_RULES.maxDuration, 300)
  assert.equal(COVER_STYLES.length, 4)
})
