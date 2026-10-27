import type { RewritePass2Payload } from './social-studio-rewrite-types'

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.startsWith('{')) return trimmed
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)
  if (fence?.[1]) return fence[1].trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)
  return null
}

export function parseRewritePass2Raw(
  raw: string,
  fallbackTitle: string,
): RewritePass2Payload {
  const jsonText = extractJsonObject(raw)
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as { titles?: unknown; body?: unknown }
      const titles = Array.isArray(parsed.titles)
        ? parsed.titles.map((t) => String(t).trim()).filter(Boolean).slice(0, 3)
        : []
      const body = typeof parsed.body === 'string' ? parsed.body.trim() : ''
      if (body && titles.length > 0) {
        while (titles.length < 3) titles.push(titles[0])
        return { titles, body }
      }
      if (body) {
        return {
          titles: [fallbackTitle, `${fallbackTitle}（备选）`, `${fallbackTitle}（备选2）`],
          body,
        }
      }
    } catch {
      // fall through
    }
  }
  const plain = raw.trim()
  const base = fallbackTitle || '改写标题'
  return {
    titles: [base, `${base}·深度版`, `${base}·实操版`],
    body: plain,
  }
}
