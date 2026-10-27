/** 采集成功 Toast 用：清洗后截断标题，默认最多 6 字 + 省略号 */
export function formatCollectShortTitle(raw: string | undefined, maxChars = 6): string {
  const cleaned = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return ''
  if (cleaned.length <= maxChars) return cleaned
  return `${cleaned.slice(0, maxChars)}…`
}

export function resolveCollectToastTitle(item: { title?: string; url: string }): string {
  const fromTitle = formatCollectShortTitle(item.title)
  if (fromTitle) return fromTitle
  try {
    const host = new URL(item.url).hostname.replace(/^www\./, '')
    return formatCollectShortTitle(host) || host.slice(0, 6)
  } catch {
    return formatCollectShortTitle(item.url.slice(0, 40)) || '…'
  }
}
