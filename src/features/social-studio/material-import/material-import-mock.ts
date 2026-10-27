import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'

function mockItem(seed: number, keyword: string): WorkbenchBridgeCollectedItem {
  const title = `${keyword}参考笔记 ${seed}`
  return {
    url: `https://www.xiaohongshu.com/explore/mock-${seed}`,
    platformId: 'xiaohongshu',
    workId: `mock-${seed}`,
    title,
    content: `这是演示模式下的示例正文 ${seed}。\n\n可用于预览导入流程，不会请求真实平台。`,
    author: '演示作者',
    coverUrl: `https://picsum.photos/seed/xhs-mock-${seed}/400/520`,
    imageUrls: [
      `https://picsum.photos/seed/xhs-mock-${seed}/400/520`,
      `https://picsum.photos/seed/xhs-mock-b-${seed}/400/520`,
    ],
    likes: 1200 + seed * 47,
    comments: 18 + seed * 3,
    collects: 90 + seed * 5,
    collectedAt: Date.now(),
  }
}

export async function mockResolveWork(url: string): Promise<WorkbenchBridgeCollectedItem> {
  await delay(600)
  return {
    ...mockItem(1, '链接'),
    url: url.trim() || 'https://www.xiaohongshu.com/explore/mock-link',
    title: '演示：链接解析结果',
  }
}

export async function mockResolveWechatWork(url: string): Promise<WorkbenchBridgeCollectedItem> {
  await delay(600)
  const normalized = url.trim() || 'https://mp.weixin.qq.com/s/dev-mock-wechat-sample'
  return {
    url: normalized,
    platformId: 'weixin',
    title: '演示：公众号文章抓取',
    content:
      '# 演示公众号正文\n\n这是演示模式下的示例 Markdown 正文，不会请求后端 web_fetch。\n\n可用于预览导入与排版流程。',
    author: '演示公众号',
    collectedAt: Date.now(),
  }
}

export async function mockSearchWorks(
  keyword: string,
  limitOrFilters?: number | Record<string, unknown>,
  limitOrOnProgress?: number | ((done: number, total: number) => void),
  onProgress?: (done: number, total: number) => void,
): Promise<WorkbenchBridgeCollectedItem[]> {
  const limit =
    typeof limitOrFilters === 'number'
      ? limitOrFilters
      : typeof limitOrOnProgress === 'number'
        ? limitOrOnProgress
        : 5
  const progressCb = typeof limitOrOnProgress === 'function' ? limitOrOnProgress : onProgress
  const total = Math.min(Math.max(limit, 1), 5)
  const items: WorkbenchBridgeCollectedItem[] = []
  for (let i = 1; i <= total; i++) {
    await delay(400)
    items.push(mockItem(i, keyword.trim() || '关键词'))
    progressCb?.(i, total)
  }
  return items
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
