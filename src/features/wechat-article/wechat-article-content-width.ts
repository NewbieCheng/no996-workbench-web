import {
  CONTENT_WIDTH_EDGE_BUDGET,
  TOOL_CONTENT_DEFAULT_WIDTH,
  TOOL_CONTENT_MIN_WIDTH,
} from '../../components/WorkbenchUI'

const WIDTH_STORAGE_KEY = 'no996.wechat-article.contentWidth'
const WIDTH_ROOT_SELECTOR = '.wechat-article-layout__width-root'

export function resolveMaxWechatArticleContentWidth(columnWidth: number): number {
  return Math.max(TOOL_CONTENT_MIN_WIDTH, columnWidth - CONTENT_WIDTH_EDGE_BUDGET)
}

export function applyWechatArticleContentWidth(width: number): void {
  const clamped = Math.max(TOOL_CONTENT_MIN_WIDTH, Math.round(width))
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped))
  } catch {
    // ignore
  }
  const root = document.querySelector(WIDTH_ROOT_SELECTOR)
  if (root instanceof HTMLElement) {
    root.style.setProperty('--wechat-article-user-width', `${clamped}px`)
    root.style.setProperty('--wechat-article-content-width', `${clamped}px`)
  }
}

export function syncWechatArticleContentWidthForWorkMode(mode: 'wizard' | 'advanced'): void {
  const root = document.querySelector(WIDTH_ROOT_SELECTOR)
  if (!(root instanceof HTMLElement)) return

  if (mode === 'wizard') {
    applyWechatArticleContentWidth(TOOL_CONTENT_MIN_WIDTH)
    return
  }

  const column = root.offsetWidth
  if (column > 0) {
    applyWechatArticleContentWidth(resolveMaxWechatArticleContentWidth(column))
  } else {
    applyWechatArticleContentWidth(TOOL_CONTENT_DEFAULT_WIDTH)
  }
}
