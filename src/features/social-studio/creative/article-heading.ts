export function splitLeadingArticleHeading(markdown: string): { title: string; body: string } {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const firstContentLine = lines.findIndex((line) => line.trim())
  if (firstContentLine < 0) return { title: '', body: markdown }

  const match = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(lines[firstContentLine])
    ?? /^\s{0,3}\*\*(.+?)\*\*\s*$/.exec(lines[firstContentLine])
  if (!match) return { title: '', body: markdown }

  const title = match[1].replace(/(?:\*\*|__|~~|`)/g, '').trim()
  if (!title) return { title: '', body: markdown }
  lines.splice(firstContentLine, 1)
  while (firstContentLine < lines.length && !lines[firstContentLine].trim()) {
    lines.splice(firstContentLine, 1)
  }
  return { title, body: lines.join('\n').trim() }
}
