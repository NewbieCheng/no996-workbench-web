import { ApiError } from '@/api/errors'
import { webFetch, wechatFetch } from '@/api/tools'
import type { WorkbenchBridgeCollectedItem } from '../extension/workbench-bridge-contract'
import { mapWechatDocumentToItem } from './map-wechat-document'
import { isWechatArticleUrl, titleFromFetchedMarkdown } from './wechat-article-link-parse'

export { isWechatArticleUrl, titleFromFetchedMarkdown } from './wechat-article-link-parse'
export { mapWechatDocumentToItem } from './map-wechat-document'

function userMessageForFetchError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'WEB_FETCH_BLOCKED_BY_SITE') {
      return '该公众号文章当前无法由服务端抓取（站点验证拦截）。请改用「自备文稿」粘贴正文，或在浏览器打开原文后复制内容。'
    }
    if (err.code === 'WEB_PROVIDER_UNAVAILABLE') {
      return '服务端未开放公众号专用抓取（wechat_fetch）。请联系管理员开启，或改用「自备文稿」粘贴正文。'
    }
    if (err.code === 'WEB_PROVIDER_CREDENTIAL_MISSING' || err.status === 503) {
      return '服务端尚未配置网页抓取能力。请联系管理员检查 wechat_fetch / 抓取源配置；配置完成前请使用「自备文稿」粘贴正文。'
    }
    if (err.code === 'BALANCE_INSUFFICIENT') {
      return err.message
    }
    if (err.code === 'WEB_FETCH_TIMEOUT' || err.status === 504) {
      return '抓取超时，请稍后重试。'
    }
    if (err.message) return err.message
  }
  if (err instanceof Error) {
    const lower = err.message.toLowerCase()
    if (lower.includes('no credential configured') || lower.includes('credential missing')) {
      return '服务端尚未配置网页抓取密钥。请联系管理员配置；配置完成前请使用「自备文稿」粘贴正文。'
    }
    if (err.message) return err.message
  }
  return '链接解析失败'
}

async function resolveViaWebFetchFallback(
  url: string,
  signal?: AbortSignal,
): Promise<WorkbenchBridgeCollectedItem> {
  const result = await webFetch({ url, timeout_seconds: 45 }, signal)
  const status = result.status_code
  if (status < 200 || status >= 300) {
    throw new Error(`文章页面返回 HTTP ${status}，请检查链接是否有效`)
  }
  const content = result.body?.content?.trim() ?? ''
  if (!content) {
    throw new Error('未抓取到正文内容，请确认链接可公开访问或改用自备文稿')
  }
  const title = titleFromFetchedMarkdown(content) || '微信公众号文章'
  return {
    url: result.url || url,
    platformId: 'weixin',
    title,
    content,
    author: '公众号',
    collectedAt: Date.now(),
  }
}

function shouldFallbackToWebFetch(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false
  return (
    err.code === 'WEB_PROVIDER_UNAVAILABLE'
    || err.code === 'WEB_PROVIDER_CREDENTIAL_MISSING'
    || err.status === 503
  )
}

/**
 * 经后端 `POST /v1/tools/wechat_fetch` 抓取公众号图文/贴图（含 `images[]` 首图封面）。
 * 专用接口关闭时回退 `web_fetch`（通常无结构化图片）。
 */
export async function resolveWechatArticleByUrl(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<WorkbenchBridgeCollectedItem> {
  const url = rawUrl.trim()
  if (!isWechatArticleUrl(url)) {
    throw new Error('请输入有效的微信公众号文章链接（mp.weixin.qq.com）')
  }

  try {
    const doc = await wechatFetch({ url, timeout_seconds: 45 }, signal)
    return mapWechatDocumentToItem(doc, url)
  } catch (err) {
    if (shouldFallbackToWebFetch(err)) {
      try {
        return await resolveViaWebFetchFallback(url, signal)
      } catch (fallbackErr) {
        throw new Error(userMessageForFetchError(fallbackErr))
      }
    }
    throw new Error(userMessageForFetchError(err))
  }
}
