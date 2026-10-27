export type WechatArticleWorkMode = 'wizard' | 'advanced'

const STORAGE_KEY = 'no996.wechat-article.workMode'

export function readWechatArticleWorkMode(): WechatArticleWorkMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'wizard' || raw === 'advanced') return raw
  } catch {
    // ignore
  }
  return 'wizard'
}

export function writeWechatArticleWorkMode(mode: WechatArticleWorkMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}
