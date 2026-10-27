/**
 * 自 FlowX 插件 workspace utils 迁入（MD/HTML/图文 HTML 片段）。
 * 来源：my-new-plugin/src/editor/components/workspace/utils/utils.ts
 */
import TurndownService from 'turndown'
import { marked } from 'marked'

export type PreviewImageItem = {
  src: string
}

const turndownService = new TurndownService({
  codeBlockStyle: 'fenced',
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
})

turndownService.addRule('image', {
  filter: 'img',
  replacement: (_content, node) => {
    const element = node as HTMLImageElement
    const src = element.getAttribute('src') || ''
    if (!src) return ''
    const alt = element.getAttribute('alt') || ''
    return `![${alt}](${src})`
  },
})

function decodeHtmlText(input: string) {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

function textFromHtmlFragment(html: string) {
  return decodeHtmlText(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|h[1-6]|ul|ol)>/gi, '\n\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function escapeHtml(input: string) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function normalizeMarkdownOutput(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

function normalizeHtmlOutput(value: string) {
  return value.replace(/\n{3,}/g, '\n\n').trim()
}

function buildWxTopicTag(topic: string) {
  return `<a class="wx_topic_link" href="topic://tag/${encodeURIComponent(topic)}" style="color: #576B95 !important;" data-topic="1">#${escapeHtml(topic)}</a>`
}

function replaceTopicsOutsideTags(html: string) {
  const tagRegex = /<[^>]*>/g
  const topicRegex = /\[\[topic:([\u4e00-\u9fa5A-Za-z0-9_]{1,50})\]\]/g
  let output = ''
  let index = 0
  let match = tagRegex.exec(html)
  while (match) {
    const start = match.index
    if (start > index) {
      const segment = html.slice(index, start)
      output += segment.replace(topicRegex, (_matched, topic) => buildWxTopicTag(topic))
    }
    output += match[0]
    index = start + match[0].length
    match = tagRegex.exec(html)
  }
  if (index < html.length) {
    const tail = html.slice(index)
    output += tail.replace(topicRegex, (_matched, topic) => buildWxTopicTag(topic))
  }
  return output
}

function enhanceMarkdownHtml(html: string) {
  const linkEnhanced = html.replace(/<a\s+href=/gi, '<a target="_blank" rel="noreferrer" href=')
  return replaceTopicsOutsideTags(linkEnhanced)
}

export function extractPreviewImageItems(source: string): PreviewImageItem[] {
  const html = source || ''
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi
  const matches = Array.from(html.matchAll(imgRegex))
  if (matches.length === 0) return []
  return matches.map((match) => ({
    src: decodeHtmlText(match[1] || ''),
  }))
}

export function extractImageTextBodyHtml(source: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<body>${source || ''}</body>`, 'text/html')
  Array.from(doc.body.querySelectorAll('img')).forEach((item) => {
    const parent = item.parentElement
    item.remove()
    if (!parent) return
    if (parent.childElementCount > 0) return
    const text = (parent.textContent || '').trim()
    if (!text && /^(P|DIV|FIGURE)$/.test(parent.tagName)) {
      parent.remove()
    }
  })
  let tail = doc.body.lastElementChild
  const isEmptyTailBlock = (element: Element) => {
    const hasMedia = element.querySelector('img,video,iframe,canvas,svg')
    if (hasMedia) return false
    const text = (element.textContent || '').replace(/\u00a0/g, ' ').trim()
    return !text
  }
  while (tail && isEmptyTailBlock(tail)) {
    const prev = tail.previousElementSibling
    tail.remove()
    tail = prev
  }
  return doc.body.innerHTML.trim()
}

export function buildImageTextHtmlFromBody(bodyHtml: string, items: PreviewImageItem[]) {
  const body = (bodyHtml || '').trim()
  const images = items
    .map((item, index) => {
      const safeSrc = item.src.replace(/"/g, '&quot;')
      return `<p><img src="${safeSrc}" alt="image-${index + 1}" /></p>`
    })
    .join('\n')
  return [body, images].filter(Boolean).join('\n\n')
}

export function htmlToMarkdownLoose(html: string) {
  const source = html || ''
  if (!source.trim()) return ''
  try {
    const converted = turndownService.turndown(source)
    return normalizeMarkdownOutput(converted)
  } catch {
    return normalizeMarkdownOutput(textFromHtmlFragment(source))
  }
}

export function markdownToHtmlLoose(markdown: string) {
  const source = markdown || ''
  if (!source.trim()) return ''
  try {
    const converted = marked.parse(source, {
      async: false,
      breaks: true,
      gfm: true,
    })
    const html = typeof converted === 'string' ? converted : ''
    return normalizeHtmlOutput(enhanceMarkdownHtml(html))
  } catch {
    const blocks = source
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean)
    const fallback = blocks
      .map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br/>')}</p>`)
      .join('\n\n')
    return normalizeHtmlOutput(fallback)
  }
}
