import type { ApiEnvelope } from './client';
import { v1Api } from './client';
import { throwApiError } from './errors';

export type WebSearchSource = {
  url: string;
  title: string;
  snippet?: string;
};

export type WebSearchResult = {
  sources: WebSearchSource[];
  truncated?: boolean;
  content?: string;
};

export type WebFetchBody = {
  kind: 'html' | 'text';
  content: string;
};

export type WebFetchResult = {
  url: string;
  status_code: number;
  body: WebFetchBody;
  truncated?: boolean;
};

export async function webSearch(
  params: {
    queries: string[];
    max_results?: number;
    timeout_seconds?: number;
  },
  signal?: AbortSignal,
): Promise<WebSearchResult> {
  try {
    const res = await v1Api.post<ApiEnvelope<WebSearchResult>>('/tools/web_search', params, { signal });
    if (!res.data.data) throw new Error('搜索失败：响应缺少 data');
    return res.data.data;
  } catch (err) {
    throwApiError(err);
  }
}

export async function webFetch(
  params: { url: string; timeout_seconds?: number },
  signal?: AbortSignal,
): Promise<WebFetchResult> {
  try {
    const res = await v1Api.post<ApiEnvelope<WebFetchResult>>('/tools/web_fetch', params, { signal });
    if (!res.data.data) throw new Error('抓取失败：响应缺少 data');
    return res.data.data;
  } catch (err) {
    throwApiError(err);
  }
}

/** 微信公众号专用抽取（图文 / 图片消息）；含按序原图 `images[]`。 */
export type WeChatFetchKind = 'article' | 'image_post';

export type WeChatFetchResult = {
  kind: WeChatFetchKind;
  title?: string;
  account?: string;
  published_at?: string;
  content?: string;
  images?: string[];
  image_count?: number;
  truncated?: boolean;
};

export async function wechatFetch(
  params: { url: string; timeout_seconds?: number },
  signal?: AbortSignal,
): Promise<WeChatFetchResult> {
  try {
    const res = await v1Api.post<ApiEnvelope<WeChatFetchResult>>('/tools/wechat_fetch', params, { signal });
    if (!res.data.data) throw new Error('公众号抓取失败：响应缺少 data');
    return res.data.data;
  } catch (err) {
    throwApiError(err);
  }
}
