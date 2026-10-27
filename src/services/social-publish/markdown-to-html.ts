function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 轻量 Markdown → HTML，供小红书长文与发布 HTML 同源。 */
export function markdownToPublishHtml(markdown: string): string {
  const src = (markdown || '').trim()
  if (!src) return ''

  const blocks: string[] = []
  const lines = src.split(/\n/)
  let paragraph: string[] = []

  const inlineFormat = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g)
    return parts
      .map((part) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part)
        if (bold) return `<strong>${escapeHtml(bold[1])}</strong>`
        return escapeHtml(part)
      })
      .join('')
  }

  const flushParagraph = () => {
    if (paragraph.length === 0) return
    blocks.push(`<p>${inlineFormat(paragraph.join('\n'))}</p>`)
    paragraph = []
  }

  for (const line of lines) {
    const img = /^!\[[^\]]*]\(([^)]+)\)\s*$/.exec(line.trim())
    if (img) {
      flushParagraph()
      const url = img[1].trim()
      blocks.push(`<p><img src="${escapeHtml(url)}" alt="" /></p>`)
      continue
    }
    if (!line.trim()) {
      flushParagraph()
      continue
    }
    paragraph.push(line)
  }
  flushParagraph()

  return blocks.join('\n')
}
