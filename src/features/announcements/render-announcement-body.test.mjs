import assert from 'node:assert/strict'
import test from 'node:test'

import { renderAnnouncementBodyHtml } from './render-announcement-body.ts'

test('renders markdown headings and strips script', () => {
  const html = renderAnnouncementBodyHtml('## Hello\n\n<script>alert(1)</script>\n\n**bold**')
  assert.match(html, /<h2[^>]*>Hello<\/h2>/)
  assert.doesNotMatch(html, /script/i)
  assert.match(html, /<strong>bold<\/strong>/)
})

test('allows wb-ann callout and drops foreign class', () => {
  const html = renderAnnouncementBodyHtml(
    '<div class="wb-ann-callout wb-ann-callout--tip evil">Tip</div><span class="hack">x</span>',
  )
  assert.match(html, /wb-ann-callout/)
  assert.match(html, /wb-ann-callout--tip/)
  assert.doesNotMatch(html, /\bevil\b/)
  assert.doesNotMatch(html, /\bhack\b/)
})

test('gfm table survives sanitize', () => {
  const md = '| A | B |\n| --- | --- |\n| 1 | 2 |'
  const html = renderAnnouncementBodyHtml(md)
  assert.match(html, /<table/)
  assert.match(html, /<td[^>]*>2<\/td>/)
})

test('external links get target blank', () => {
  const html = renderAnnouncementBodyHtml('[docs](https://example.com)')
  assert.match(html, /target="_blank"/)
  assert.match(html, /rel="noopener noreferrer"/)
})
