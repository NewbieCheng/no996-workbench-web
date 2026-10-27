import { buildWeixinArticleHtml } from './formatters/weixin-article-formatter'
import { buildWeixinImageDraftText } from './formatters/weixin-image-draft'
import { formatXhsNoteDesc, resolveXhsContentLength } from './formatters/xhs-formatter'
import { collectPublishImageSources } from './image-source-utils'
import { markdownToPublishHtml } from './markdown-to-html'
import { resolveWeixinPublishMode, resolveXhsMaterialType } from './publish-settings'
import type { ChannelPayload, MaterialType, SourceArticle, WeixinPublishMode, XhsPublishMode } from './types'

const WORKBENCH_URL = 'https://manual-workbench.local/'

export function makeSourceArticle(input: {
  title: string
  content: string
  summary?: string
  materialType: MaterialType
  html?: string
}): SourceArticle {
  const markdown = input.content || ''
  const html = input.html || markdownToPublishHtml(markdown)
  return {
    title: input.title.trim(),
    html,
    markdown,
    summary: input.summary?.trim() || input.title.trim(),
    url: WORKBENCH_URL,
    capturedAt: Date.now(),
    materialType: input.materialType,
  }
}

export function makePayload(content: string, html?: string): ChannelPayload {
  const markdown = content || ''
  return { markdown, html: html || markdownToPublishHtml(markdown) }
}

export function composeWechatArticlePreview(article: SourceArticle, _payload: ChannelPayload): string {
  return buildWeixinArticleHtml({ ...article, materialType: 'article' })
}

export function composeWechatImageDraftPreview(article: SourceArticle, payload: ChannelPayload) {
  return buildWeixinImageDraftText(article, payload)
}

export function effectiveWechatPreviewMode(
  previewShape: 'article' | 'image_draft',
  weixinPublishMode: WeixinPublishMode,
): 'article' | 'image_draft' {
  const materialType: MaterialType = previewShape === 'image_draft' ? 'image_text' : 'article'
  return resolveWeixinPublishMode(weixinPublishMode, materialType)
}

export function composeXhsNoteDesc(content: string, html?: string) {
  const payload = makePayload(content, html)
  return formatXhsNoteDesc(payload.html, payload.markdown)
}

export function effectiveXhsMaterialType(mode: XhsPublishMode, imageUrls: string[]): MaterialType {
  return resolveXhsMaterialType(mode, imageUrls.length)
}

export function composePublishHtml(content: string, imageUrls: string[]): string {
  const { orderedUrls, html, markdown } = collectPublishImageSources({
    html: markdownToPublishHtml(content),
    markdown: content,
    directImages: imageUrls,
    rewriteContent: true,
  })
  if (orderedUrls.length > 0 && !html.includes('<img')) {
    return html + orderedUrls.map((u) => `<p><img src="${u}" alt="" /></p>`).join('')
  }
  return html || markdownToPublishHtml(markdown)
}

export function xhsContentLengthHint(content: string, summary: string) {
  const html = markdownToPublishHtml(content)
  return resolveXhsContentLength({ html, markdown: content, summary })
}
