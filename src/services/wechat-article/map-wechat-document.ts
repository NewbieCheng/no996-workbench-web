import type { WorkbenchBridgeCollectedItem } from '../extension/workbench-bridge-contract'

export type WeChatDocumentLike = {
  kind?: string
  title?: string
  account?: string
  content?: string
  images?: unknown
}

function normalizeImageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return []
  const urls: string[] = []
  for (const entry of images) {
    if (typeof entry !== 'string') continue
    const url = entry.trim()
    if (!url) continue
    urls.push(url)
  }
  return urls
}

function fallbackTitleFromContent(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line)
    if (h1?.[1]) return h1[1].trim().slice(0, 120)
  }
  const first = lines[0] ?? ''
  if (!first) return ''
  if (first.length <= 80) return first
  return first.slice(0, 40).trim()
}

/** 将 wechat_fetch 文档映射为工作台采集项（首图作封面；不写点赞/收藏）。 */
export function mapWechatDocumentToItem(
  doc: WeChatDocumentLike,
  fallbackUrl: string,
): WorkbenchBridgeCollectedItem {
  const imageUrls = normalizeImageUrls(doc.images)
  const content = typeof doc.content === 'string' ? doc.content.trim() : ''
  const title =
    (typeof doc.title === 'string' && doc.title.trim())
    || fallbackTitleFromContent(content)
    || '微信公众号文章'
  const author =
    (typeof doc.account === 'string' && doc.account.trim())
    || '公众号'

  if (!content && imageUrls.length === 0) {
    throw new Error('未抓取到正文或图片，请确认链接可公开访问或改用自备文稿')
  }

  return {
    url: fallbackUrl,
    platformId: 'weixin',
    title,
    ...(content ? { content } : {}),
    author,
    collectedAt: Date.now(),
    ...(imageUrls.length ? { imageUrls, coverUrl: imageUrls[0] } : {}),
  }
}
