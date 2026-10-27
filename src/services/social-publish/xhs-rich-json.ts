import type { UploadedImage } from './types'
import { decodeHtmlEntities, toAbsoluteUrl } from './formatters/xhs-formatter'

/** 与插件 xiaohongshu-channel generateRichJsonInTab 内逻辑同源（浏览器 DOM）。 */
export function htmlToXhsRichJson(html: string, uploadedImages: UploadedImage[] = []): { type: string; content: unknown[] } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html || '', 'text/html')

  const isBlockElement = (tagName: string) =>
    ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'ul', 'ol', 'img'].includes(tagName)

  const processInline = (node: Node, marks: { type: string }[] = []): unknown[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      if (!text.trim()) return []
      return [{ type: 'text', text, marks: marks.length > 0 ? [...marks] : undefined }]
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return []
    const el = node as HTMLElement
    const tagName = el.tagName.toLowerCase()
    const newMarks = [...marks]
    if (tagName === 'strong' || tagName === 'b') newMarks.push({ type: 'highlight' })
    if (tagName === 'br') return [{ type: 'hardBreak' }]
    const results: unknown[] = []
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && isBlockElement((child as HTMLElement).tagName.toLowerCase())) continue
      results.push(...processInline(child, newMarks))
    }
    return results
  }

  const walkBlocks = (node: Node): unknown[] => {
    if (node.nodeType !== Node.ELEMENT_NODE) {
      if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        return [{ type: 'paragraph', content: processInline(node) }]
      }
      return []
    }
    const el = node as HTMLElement
    const tagName = el.tagName.toLowerCase()

    if (/^h[1-6]$/.test(tagName)) {
      return [{ type: 'heading', attrs: { level: parseInt(tagName[1], 10) }, content: processInline(el) }]
    }
    if (tagName === 'blockquote') {
      const content: unknown[] = []
      for (const child of Array.from(el.childNodes)) content.push(...walkBlocks(child))
      return [{ type: 'blockquote', content }]
    }
    if (tagName === 'ul' || tagName === 'ol') {
      const type = tagName === 'ul' ? 'bulletList' : 'orderedList'
      const content: unknown[] = []
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
          const liContent: unknown[] = []
          for (const liChild of Array.from(child.childNodes)) liContent.push(...walkBlocks(liChild))
          content.push({ type: 'listItem', content: liContent })
        }
      }
      return [{ type, attrs: tagName === 'ol' ? { start: 1, type: null } : undefined, content }]
    }
    if (tagName === 'img') {
      const src = el.getAttribute('src') || ''
      const absolute = toAbsoluteUrl(decodeHtmlEntities(src))
      const uploaded = uploadedImages.find(
        (img) =>
          img.originalUrl === absolute ||
          img.url.includes(absolute) ||
          (img.fileId && absolute.includes(img.fileId)),
      )
      const displaySrc = uploaded?.url || (absolute.startsWith('data:') ? absolute : '')
      if (!displaySrc) return []
      return [
        {
          type: 'image',
          attrs: {
            imgs: [
              {
                src: displaySrc,
                desc: '',
                percent: '80',
                width: uploaded?.width || 410,
                height: uploaded?.height || 410,
              },
            ],
          },
        },
      ]
    }

    const children = Array.from(el.childNodes)
    const hasBlockChild = children.some(
      (child) => child.nodeType === Node.ELEMENT_NODE && isBlockElement((child as HTMLElement).tagName.toLowerCase()),
    )
    if (hasBlockChild) {
      const results: unknown[] = []
      for (const child of children) results.push(...walkBlocks(child))
      return results
    }
    const inlineContent = processInline(el)
    if (inlineContent.length > 0) return [{ type: 'paragraph', content: inlineContent }]
    return []
  }

  const nodes: unknown[] = []
  for (const child of Array.from(doc.body.childNodes)) nodes.push(...walkBlocks(child))
  return { type: 'doc', content: nodes }
}
