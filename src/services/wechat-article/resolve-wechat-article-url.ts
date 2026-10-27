import { ApiError } from '@/api/errors'
import { webFetch } from '@/api/tools'
import type { WorkbenchBridgeCollectedItem } from '../extension/workbench-bridge-contract'
import { isWechatArticleUrl, titleFromFetchedMarkdown } from './wechat-article-link-parse'

export { isWechatArticleUrl, titleFromFetchedMarkdown } from './wechat-article-link-parse'

function userMessageForFetchError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'WEB_FETCH_BLOCKED_BY_SITE') {
      return '该公众号文章当前无法由服务端抓取（站点验证拦截）。请改用「自备文稿」粘贴正文，或在浏览器打开原文后复制内容。'
    }
    if (err.code === 'WEB_PROVIDER_CREDENTIAL_MISSING' || err.status === 503) {
      return '服务端尚未配置网页抓取密钥（DeepSeek fetch）。请联系管理员在后台为抓取源 deepseek-native 填写 API Key，或本地执行 set-tool-credential（见后端文档 catalog-seed §工具源凭据）。配置完成前请使用「自备文稿」粘贴正文。'
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
      return '服务端尚未配置网页抓取密钥（DeepSeek fetch）。请联系管理员在后台为抓取源 deepseek-native 填写 API Key。配置完成前请使用「自备文稿」粘贴正文。'
    }
    if (err.message) return err.message
  }
  return '链接解析失败'
}

/**
 * 经后端 `POST /v1/tools/web_fetch`（默认 DeepSeek fetch）抓取公众号文章正文。
 */
export async function resolveWechatArticleByUrl(
  rawUrl: string,
  signal?: AbortSignal,
): Promise<WorkbenchBridgeCollectedItem> {
  const url = rawUrl.trim()
  if (!isWechatArticleUrl(url)) {
    throw new Error('请输入有效的微信公众号文章链接（mp.weixin.qq.com）')
  }

  let result: Awaited<ReturnType<typeof webFetch>>
  try {
    result = await webFetch({ url, timeout_seconds: 45 }, signal)
  } catch (err) {
    throw new Error(userMessageForFetchError(err))
  }

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
