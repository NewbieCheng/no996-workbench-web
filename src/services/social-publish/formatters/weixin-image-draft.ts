import type { ChannelPayload, SourceArticle } from '../types'

type WeixinImageDraftText = {
  content: string
  guideWords: string
}

function stripTags(input: string) {
  return input.replace(/<[^>]+>/g, "")
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
}

function normalizeNewlines(input: string) {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function normalizeBlockBreaks(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n\n")
    .replace(/<\/section>/gi, "\n\n")
    .replace(/<\/article>/gi, "\n\n")
    .replace(/<\/ul>/gi, "\n\n")
    .replace(/<\/ol>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
}

function sanitizePlainDraftText(input: string) {
  const normalizedBreaks = normalizeBlockBreaks(input || "")
  const plain = stripTags(normalizedBreaks)
  const decoded = decodeHtmlEntities(plain)
  const decodedWithBreaks = normalizeBlockBreaks(decoded).replace(/<[^>]+>/g, "")
  return normalizeNewlines(decodedWithBreaks)
}

function htmlToPlainText(html: string) {
  if (!html) return ""
  const withLinks = html.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const cleanHref = decodeHtmlEntities(String(href || "").trim())
    const cleanText = stripTags(String(text || "")).trim()
    if (!cleanHref || !cleanText) return cleanText
    return `[${cleanText}](${cleanHref})`
  })
  return sanitizePlainDraftText(withLinks)
}

function escapeHtmlAttr(input: string) {
  return input.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
}

function isWeixinArticleLink(url: string) {
  return /^https?:\/\/mp\.weixin\.qq\.com\/s\?/i.test(url)
}

function applyWeixinLinkMarkup(input: string) {
  const fromMarkdown = input.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, (_m, text, href) => {
    const label = String(text || "").trim()
    const url = String(href || "").trim()
    if (!label) return ""
    if (!isWeixinArticleLink(url)) return label
    const safeHref = escapeHtmlAttr(url)
    return `<a href="${safeHref}" class="normal_text_link mp_article_text_link" target="_blank" data-itemshowtype="0">${label}</a>`
  })
  return fromMarkdown.replace(/(^|[\s(])(https?:\/\/mp\.weixin\.qq\.com\/s\?[^\s<)]+)/gi, (_m, prefix, href) => {
    const safeHref = escapeHtmlAttr(String(href || ""))
    return `${prefix}<a href="${safeHref}" class="normal_text_link mp_article_text_link" target="_blank" data-itemshowtype="0">${href}</a>`
  })
}

function applyTopicMarkup(input: string) {
  const segments = input.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi)
  const processed = segments
    .map((part) => {
      if (/^<a\b/i.test(part)) return part
      return part.replace(/#([^#@\s<，。！？：；、,.!?;:()（）【】《》"“”'‘’]{1,50})/g, (_m, tag) => {
        // 在话题标签后面加一个空格，确保同步到公众号后不粘连
        return `<a class="wx_topic_link" style="color: #576B95 !important;" data-topic="1">#${tag}</a> `
      })
    })
    .join("")

  // 合并可能产生的多余空格，并去除末尾空白
  return processed.replace(/[ \t]{2,}/g, " ").trim()
}

function isAllowedWeixinAnchor(anchorHtml: string) {
  const classAttr = anchorHtml.match(/\bclass=["']([^"']+)["']/i)?.[1] || ""
  if (/\bwx_topic_link\b/.test(classAttr)) return true
  if (!/\bnormal_text_link\b/.test(classAttr) || !/\bmp_article_text_link\b/.test(classAttr)) return false
  const href = anchorHtml.match(/\bhref=["']([^"']+)["']/i)?.[1] || ""
  return isWeixinArticleLink(decodeHtmlEntities(href))
}

function sanitizeFinalWeixinContent(input: string) {
  const normalized = normalizeBlockBreaks(input || "")
  const segments = normalized.split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi)
  const merged = segments
    .map((segment) => {
      if (!/^<a\b/i.test(segment)) {
        return stripTags(segment)
      }
      if (isAllowedWeixinAnchor(segment)) {
        return segment
      }
      return stripTags(segment)
    })
    .join("")
  return normalizeNewlines(merged)
}

export function buildWeixinImageDraftText(article: SourceArticle, payload: ChannelPayload): WeixinImageDraftText {
  const markdown = (payload.markdown || article.markdown || "").trim()
  const html = (payload.html || article.html || "").trim()
  const base = html ? htmlToPlainText(html) : sanitizePlainDraftText(markdown)
  const noImages = base
    .replace(/!\[[^\]]*]\(([^)\s]+|<[^>]+>)(?:\s+["'][^"']*["'])?\)/gi, "")
    .replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, "")
  const normalized = normalizeNewlines(noImages) || article.title || "无标题"
  const visibleLimited = normalized.slice(0, 1000)
  const withLinks = applyWeixinLinkMarkup(visibleLimited)
  const withTopics = applyTopicMarkup(withLinks)
  const content = sanitizeFinalWeixinContent(withTopics)
  return {
    content,
    guideWords: content
  }
}
