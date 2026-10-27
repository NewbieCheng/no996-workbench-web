const TLS_UPGRADE_HOST_SUFFIXES = ['.aliyuncs.com']

function hostAllowsTlsUpgrade(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return TLS_UPGRADE_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
}

/** Best-effort http→https for known public CDNs (e.g. DashScope OSS). */
export function upgradeInsecureMediaUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('http://')) return trimmed
  try {
    const parsed = new URL(trimmed)
    if (!hostAllowsTlsUpgrade(parsed.hostname)) return trimmed
    parsed.protocol = 'https:'
    return parsed.toString()
  } catch {
    return trimmed
  }
}

/** Whether `url` may be used as `<audio src>` on the current page without Mixed Content. */
export function isEmbeddablePlaybackUrl(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return true
  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.href : 'https://localhost/')
    if (parsed.protocol === 'https:') return true
    if (parsed.protocol === 'http:') {
      if (typeof window === 'undefined') return false
      return window.location.protocol !== 'https:'
    }
    return false
  } catch {
    return false
  }
}
