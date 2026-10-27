/**
 * 自 FlowX 插件 conversion-service 迁入。
 * 来源：my-new-plugin/src/editor/core/conversion-service.ts
 */
import TurndownService from 'turndown'
import { marked } from 'marked'
import { htmlToMarkdownLoose, markdownToHtmlLoose } from './editor-utils'

const turndown = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
})

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeTopicValue(value: string) {
  return (value || '').replace(/^#+/, '').replace(/[^\u4e00-\u9fa5A-Za-z0-9_]/g, '').slice(0, 50)
}

function toTopicToken(value: string) {
  const topic = normalizeTopicValue(value)
  return topic ? `[[topic:${topic}]]` : ''
}

function buildWxTopicTag(topic: string) {
  return `<a class="wx_topic_link" href="topic://tag/${encodeURIComponent(topic)}" style="color: #576B95 !important;" data-topic="1">#${escapeHtml(topic)}</a>`
}

function normalizeTopicTokenSource(value: string) {
  return (value || '')
    .replace(/\[(#[\u4e00-\u9fa5A-Za-z0-9_]{1,50})\]\(topic:\/\/[^)\s]+\)/gi, (_match, content) => toTopicToken(content))
    .replace(/<a[^>]*href=["']topic:\/\/([^"']+)["'][^>]*>(.*?)<\/a>(?:&nbsp;|&#160;|\u00a0)?/gi, (_match, hrefTopic, content) => {
      return toTopicToken(String(content || hrefTopic).replace(/<[^>]*>/g, ''))
    })
    .replace(/<a[^>]*class=["'][^"']*\bwx_topic_link\b[^"']*["'][^>]*>(.*?)<\/a>(?:&nbsp;|&#160;|\u00a0)?/gi, (_match, content) => {
      return toTopicToken(String(content || '').replace(/<[^>]*>/g, ''))
    })
}

function replaceTopicsOutsideTags(value: string) {
  const tagRegex = /<[^>]*>/g
  const topicRegex = /\[\[topic:([\u4e00-\u9fa5A-Za-z0-9_]{1,50})\]\]/g
  let output = ''
  let index = 0
  let match = tagRegex.exec(value)
  while (match) {
    const start = match.index
    if (start > index) {
      const segment = value.slice(index, start)
      output += segment.replace(topicRegex, (_matched, topic) => buildWxTopicTag(topic))
    }
    output += match[0]
    index = start + match[0].length
    match = tagRegex.exec(value)
  }
  if (index < value.length) {
    const tail = value.slice(index)
    output += tail.replace(topicRegex, (_matched, topic) => buildWxTopicTag(topic))
  }
  return output
}

function enhanceHtmlWithTopicTags(value: string) {
  return replaceTopicsOutsideTags(value)
}

turndown.addRule('wxTopicLink', {
  filter: (node) => {
    if (node.nodeName !== 'A') return false
    const element = node as HTMLElement
    return element.classList.contains('wx_topic_link')
  },
  replacement: (_content, node) => {
    const text = (node.textContent || '').trim()
    return toTopicToken(text)
  },
})

function normalizeHtmlOutput(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeMarkdownOutput(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

export function htmlToMarkdownSmart(html: string) {
  const source = html || ''
  if (!source.trim()) return ''
  try {
    const normalizedSource = normalizeTopicTokenSource(source)
    const converted = turndown.turndown(normalizedSource)
    const normalized = normalizeMarkdownOutput(converted)
    if (normalized) return normalized
  } catch {
    /* fall through */
  }
  return normalizeMarkdownOutput(htmlToMarkdownLoose(source))
}

export function markdownToHtmlSmart(markdown: string) {
  const source = markdown || ''
  if (!source.trim()) return ''
  try {
    const parsed = marked.parse(normalizeTopicTokenSource(source), { async: false })
    const html = typeof parsed === 'string' ? parsed : ''
    const normalized = normalizeHtmlOutput(enhanceHtmlWithTopicTags(html))
    if (normalized) return normalized
  } catch {
    /* fall through */
  }
  return normalizeHtmlOutput(markdownToHtmlLoose(source))
}
