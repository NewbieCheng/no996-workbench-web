import test from 'node:test'
import assert from 'node:assert/strict'
import { parseMarkdownToHtml, buildWechatStyles } from './wechat-markdown-preview.ts'

test('formats article headings, emphasis, ordered and unordered lists', () => {
  const html = parseMarkdownToHtml('# 标题\n\n正文 **重点**\n\n- 第一项\n- 第二项\n\n1. 有序项')
  assert.match(html, /<h1>标题<\/h1>/)
  assert.match(html, /<strong>重点<\/strong>/)
  assert.match(html, /<ul>\n<li>第一项<\/li>\n<li>第二项<\/li>\n<\/ul>/)
  assert.match(html, /<ol>\n<li>有序项<\/li>\n<\/ol>/)
})

test('raw HTML, event handlers and script links cannot create executable markup', () => {
  const html = parseMarkdownToHtml('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n\n[链接](javascript:alert(1))')
  assert.ok(!html.includes('<script'))
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('<a '))
  assert.match(html, /&lt;script&gt;/)
})

test('code blocks remain escaped, including unfinished streaming blocks', () => {
  assert.match(parseMarkdownToHtml('```html\n<img onerror=x>'), /<pre><code>&lt;img onerror=x&gt;<\/code><\/pre>/)
  assert.equal(parseMarkdownToHtml(''), '')
  assert.match(buildWechatStyles('#2e7d32').h1, /color:#2e7d32/)
})
