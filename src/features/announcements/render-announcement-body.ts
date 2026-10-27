import DOMPurify from 'isomorphic-dompurify'
import { marked } from 'marked'

/** 运营可控 class 前缀（与后端 bluemonday 策略一致） */
const ANN_CLASS = /^wb-ann-[a-z0-9-]+$/

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'a',
  'ul',
  'ol',
  'li',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'code',
  'pre',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'div',
  'span',
]

const ALLOWED_ATTR = ['href', 'target', 'rel', 'class', 'colspan', 'rowspan']

let purifyHooksReady = false

function ensurePurifyHooks() {
  if (purifyHooksReady) return
  purifyHooksReady = true
  DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName !== 'class') return
    const kept = data.attrValue
      .split(/\s+/)
      .map((c) => c.trim())
      .filter((c) => c && ANN_CLASS.test(c))
    data.attrValue = kept.join(' ')
  })
}

function hardenLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (_match, attrs: string) => {
    let next = attrs
    if (!/\btarget\s*=/i.test(next)) next += ' target="_blank"'
    if (!/\brel\s*=/i.test(next)) next += ' rel="noopener noreferrer"'
    return `<a${next}>`
  })
}

/**
 * 公告正文：Markdown（GFM）+ 受控 wb-ann-* HTML → 安全 HTML。
 */
export function renderAnnouncementBodyHtml(source: string): string {
  const trimmed = source?.trim()
  if (!trimmed) return ''

  ensurePurifyHooks()

  const raw = marked.parse(trimmed, { async: false, breaks: true, gfm: true }) as string
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  })

  return hardenLinks(clean)
}
