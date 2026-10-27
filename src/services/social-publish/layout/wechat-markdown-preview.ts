export const WECHAT_THEMES = {
  green: { name: '清新绿', color: '#2e7d32' },
  default: { name: '商务蓝', color: '#1a73e8' },
  red: { name: '热情红', color: '#d32f2f' },
  purple: { name: '优雅紫', color: '#7b1fa2' },
  dark: { name: '极客黑', color: '#1e293b' },
} as const

export type WechatThemeKey = keyof typeof WECHAT_THEMES

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Preview supports headings, lists, quotes and emphasis; raw HTML stays text. */
export function parseMarkdownToHtml(markdown: string): string {
  const blocks: string[] = []
  let paragraph: string[] = []
  let list: 'ul' | 'ol' | null = null
  let code: string[] | null = null
  const inline = (value: string) => escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  const flush = () => {
    if (paragraph.length) { blocks.push(`<p>${paragraph.map(inline).join('<br />')}</p>`); paragraph = [] }
    if (list) { blocks.push(`</${list}>`); list = null }
  }
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) { blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null }
      else { flush(); code = [] }
      continue
    }
    if (code) { code.push(line); continue }
    if (!line.trim()) { flush(); continue }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) { flush(); blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { flush(); blocks.push('<hr />'); continue }
    const quote = /^>\s?(.*)$/.exec(line)
    if (quote) { flush(); blocks.push(`<blockquote><p>${inline(quote[1])}</p></blockquote>`); continue }
    const item = /^\s*(?:([-*+])\s+|\d+[.)]\s+)(.+)$/.exec(line)
    if (item) {
      const kind = item[1] ? 'ul' : 'ol'
      if (list !== kind || paragraph.length) { flush(); blocks.push(`<${kind}>`); list = kind }
      blocks.push(`<li>${inline(item[2])}</li>`)
      continue
    }
    if (list) flush()
    paragraph.push(line)
  }
  if (code) blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
  flush()
  return blocks.join('\n')
}

export function buildWechatStyles(themeColor: string): Record<string, string> {
  return {
    h1: `font-size:24px;line-height:1.5;margin:24px 0;font-weight:600;color:${themeColor};`,
    h2: `font-size:18px;line-height:1.7;margin:28px 0 14px;font-weight:600;color:${themeColor};`,
    h3: `font-size:17px;line-height:1.7;margin:24px 0 12px;font-weight:600;color:${themeColor};`,
    h4: `font-size:16px;line-height:1.7;margin:20px 0 12px;font-weight:600;color:${themeColor};`,
    h5: `font-size:15px;line-height:1.7;margin:20px 0 12px;font-weight:600;color:${themeColor};`,
    h6: 'font-size:14px;line-height:1.7;margin:20px 0 12px;color:#63666e;',
    p: 'font-size:15px;line-height:1.85;margin:16px 0;color:#334155;white-space:normal;',
    ul: 'margin:16px 0;padding-left:24px;list-style-type:disc;',
    ol: 'margin:16px 0;padding-left:24px;list-style-type:decimal;',
    li: 'font-size:15px;line-height:1.85;margin:8px 0;color:#334155;',
    blockquote: 'margin:20px 0;padding:12px 16px;background:#f4f6f8;border-radius:8px;',
    strong: `font-weight:700;color:${themeColor};`,
    '.editor-title': `color:${themeColor};`,
    pre: 'padding:16px;margin:20px 0;background:#f4f6f8;overflow:auto;white-space:pre-wrap;',
    code: 'font-family:monospace;font-size:13px;background:#f4f6f8;color:#334155;',
    hr: 'border:0;border-top:1px solid #dce1e7;margin:28px 0;',
  }
}

export function applyWechatInlineStyles(root: HTMLElement, themeKey: WechatThemeKey): void {
  const themeColor = WECHAT_THEMES[themeKey].color
  const styles = buildWechatStyles(themeColor)
  root.style.color = '#334155'
  root.style.setProperty('--wechat-theme-color', themeColor)
  for (const [tag, style] of Object.entries(styles)) {
    root.querySelectorAll<HTMLElement>(tag).forEach((element) => { element.style.cssText = style })
  }
}
