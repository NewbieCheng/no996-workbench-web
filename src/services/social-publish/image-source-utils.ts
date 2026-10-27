type CollectPublishImageSourcesInput = {
  html: string
  markdown: string
  directImages?: unknown[]
  includeDataUrl?: boolean
  rewriteContent?: boolean
  baseUrl?: string
  resolveUrl?: (src: string, baseUrl?: string) => string
}

type CollectPublishImageSourcesResult = {
  orderedUrls: string[]
  html: string
  markdown: string
}

const compactBase64TokenRegex = /__BASE64_IMAGE_TOKEN_\d+(?:_\d+)?__/i
const compactLegacyBase64Regex = /^\[Base64图片(?:#\d+)?\s*(?:已省略显示|已折叠)(?:\s+\d+\s*字符)?\]$/i

export function normalizePublishImageSource(src: string): string {
  const value = (src || "").trim().replace(/^<|>$/g, "")
  if (!value) return ""
  if (compactBase64TokenRegex.test(value)) return ""
  if (compactLegacyBase64Regex.test(value)) return ""
  return value
}

export function collectPublishImageSources(input: CollectPublishImageSourcesInput): CollectPublishImageSourcesResult {
  const orderedUrls: string[] = []
  const urlSet = new Set<string>()
  const includeDataUrl = input.includeDataUrl !== false

  const addUrl = (src: string) => {
    const normalized = normalizePublishImageSource(src)
    if (!normalized) return ""
    if (!includeDataUrl && normalized.startsWith("data:")) return ""
    const finalUrl = normalized.startsWith("data:")
      ? normalized
      : input.resolveUrl
        ? input.resolveUrl(normalized, input.baseUrl)
        : normalized
    if (!finalUrl) return ""
    if (!urlSet.has(finalUrl)) {
      urlSet.add(finalUrl)
      orderedUrls.push(finalUrl)
    }
    return finalUrl
  }

  const directImages = input.directImages || []
  if (Array.isArray(directImages) && directImages.length > 0) {
    for (const item of directImages) {
      const raw = typeof item === "string" ? item : (item as any)?.url || (item as any)?.src || String(item || "")
      addUrl(raw)
    }
  }

  let html = input.html || ""
  if (orderedUrls.length === 0 && html.trim()) {
    const htmlImgRegex = /<img[^>]+src\s*=\s*["']?([^"'\s>]+)["']?/gi
    let htmlMatch: RegExpExecArray | null
    while ((htmlMatch = htmlImgRegex.exec(html)) !== null) {
      addUrl(htmlMatch[1] || "")
    }
  }

  let markdown = input.markdown || ""
  if (orderedUrls.length === 0 && markdown.trim()) {
    const markdownImgRegex = /!\[[^\]]*]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/gi
    let markdownMatch: RegExpExecArray | null
    while ((markdownMatch = markdownImgRegex.exec(markdown)) !== null) {
      const raw = markdownMatch[1] || markdownMatch[2] || ""
      addUrl(raw)
    }
  }

  if (input.rewriteContent) {
    if (html.trim()) {
      html = html.replace(/(<img[^>]+src=["'])([^"']*)(["'])/gi, (match, prefix, src, suffix) => {
        const finalUrl = addUrl(src)
        return finalUrl ? `${prefix}${finalUrl}${suffix}` : match
      })
    }
    if (markdown.trim()) {
      markdown = markdown.replace(/!\[[^\]]*]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+["'][^"']*["'])?\s*\)/g, (match, srcInAngle, srcPlain) => {
        const src = srcInAngle || srcPlain || ""
        const finalUrl = addUrl(src)
        return finalUrl ? match.replace(src, finalUrl) : match
      })
    }
  }

  return { orderedUrls, html, markdown }
}
