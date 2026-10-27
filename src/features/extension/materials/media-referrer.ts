export function isBilibiliCdnMediaUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.endsWith('hdslb.com') || host.includes('bilivideo') || host.endsWith('bilibili.com')
  } catch {
    return false
  }
}

/** B站 CDN 需要站点 Referer；其他平台用 no-referrer。 */
export function workbenchMediaReferrerPolicy(url: string | undefined): 'no-referrer' | undefined {
  if (url && isBilibiliCdnMediaUrl(url)) return undefined
  return 'no-referrer'
}
