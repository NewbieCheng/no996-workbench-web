import { buildWeixinArticleHtml } from './formatters/weixin-article-formatter'
import { collectPublishImageSources } from './image-source-utils'
import { appendImagesToHtml, appendImagesToMarkdown, resolveImageUrlsForPublish } from './image-blob'
import { markdownToPublishHtml } from './markdown-to-html'
import { resolveWeixinPublishMode, resolveXhsMaterialType } from './publish-settings'
import type { BuildSyncDraftResult, MaterialType, WeixinPublishMode, XhsPublishMode } from './types'
import { makeSourceArticle } from './compose'
import { resolveXhsPublishSummary } from './resolve-xhs-summary'

export type WechatDraftInput = {
  title: string
  content: string
  imageUrls: string[]
  previewShape: 'article' | 'image_draft'
  weixinPublishMode: WeixinPublishMode
}

export type XhsDraftInput = {
  title: string
  content: string
  summary?: string
  imageUrls: string[]
  xhsPublishMode: XhsPublishMode
}

export async function buildWechatSyncDraft(input: WechatDraftInput): Promise<BuildSyncDraftResult> {
  const materialType: MaterialType = input.previewShape === 'image_draft' ? 'image_text' : 'article'
  const resolved = resolveWeixinPublishMode(input.weixinPublishMode, materialType)
  const dataUrls = await resolveImageUrlsForPublish(input.imageUrls)

  let markdown = input.content
  let html = markdownToPublishHtml(input.content)
  if (resolved === 'image_draft') {
    markdown = appendImagesToMarkdown(input.content, dataUrls)
    html = appendImagesToHtml(html, dataUrls)
  } else {
    const collected = collectPublishImageSources({
      html,
      markdown,
      directImages: [],
      rewriteContent: true,
    })
    markdown = collected.markdown
    html = collected.html
  }

  const article = makeSourceArticle({
    title: input.title,
    content: markdown,
    materialType: resolved === 'image_draft' ? 'image_text' : 'article',
    html,
  })

  if (resolved === 'article') {
    html = buildWeixinArticleHtml({ ...article, html, markdown, materialType: 'article' })
  }

  return {
    channelIds: ['weixin'],
    weixinPublishMode: input.weixinPublishMode,
    draft: {
      title: article.title,
      html,
      markdown,
      summary: article.summary,
      url: article.url,
      materialType: resolved === 'image_draft' ? 'image_text' : 'article',
    },
  }
}

export async function buildXhsSyncDraft(input: XhsDraftInput): Promise<BuildSyncDraftResult> {
  const dataUrls = await resolveImageUrlsForPublish(input.imageUrls)
  const materialType = resolveXhsMaterialType(input.xhsPublishMode, dataUrls.length)

  let markdown: string
  let html: string
  if (materialType === 'article') {
    const collected = collectPublishImageSources({
      html: markdownToPublishHtml(input.content),
      markdown: input.content,
      directImages: [],
      rewriteContent: true,
    })
    markdown = collected.markdown
    html = collected.html
  } else {
    markdown = appendImagesToMarkdown(input.content, dataUrls)
    const collected = collectPublishImageSources({
      html: markdownToPublishHtml(input.content),
      markdown: input.content,
      directImages: dataUrls,
      rewriteContent: true,
    })
    html = collected.html || appendImagesToHtml(markdownToPublishHtml(input.content), dataUrls)
  }

  return {
    channelIds: ['xiaohongshu'],
    draft: {
      title: input.title.trim(),
      html,
      markdown,
      summary: resolveXhsPublishSummary(input.summary, input.content, input.title),
      url: 'https://manual-workbench.local/',
      materialType,
    },
  }
}
