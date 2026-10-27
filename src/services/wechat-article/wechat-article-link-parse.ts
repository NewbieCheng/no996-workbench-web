const WECHAT_ARTICLE_HOST = 'mp.weixin.qq.com'

export function isWechatArticleUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return false
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    return parsed.hostname === WECHAT_ARTICLE_HOST || parsed.hostname.endsWith(`.${WECHAT_ARTICLE_HOST}`)
  } catch {
    return false
  }
}

/** 从 DeepSeek fetch 返回的 Markdown 正文提取展示标题 */
export function titleFromFetchedMarkdown(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1?.[1]) return h1[1].trim().slice(0, 120)
  }
  const first = lines[0] ?? ''
  if (first.length <= 80) return first
  return first.slice(0, 40).trim()
}
