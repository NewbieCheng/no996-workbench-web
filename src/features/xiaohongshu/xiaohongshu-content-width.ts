import {
  CONTENT_WIDTH_EDGE_BUDGET,
  TOOL_CONTENT_DEFAULT_WIDTH,
  TOOL_CONTENT_MIN_WIDTH,
} from '../../components/WorkbenchUI'

const WIDTH_STORAGE_KEY = 'no996.xiaohongshu.contentWidth'

export function resolveMaxXContentWidth(columnWidth: number): number {
  return Math.max(TOOL_CONTENT_MIN_WIDTH, columnWidth - CONTENT_WIDTH_EDGE_BUDGET)
}

export function applyXiaohongshuContentWidth(width: number): void {
  const clamped = Math.max(TOOL_CONTENT_MIN_WIDTH, Math.round(width))
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(clamped))
  } catch {
    // ignore
  }
  const root = document.querySelector('.xiaohongshu-layout__width-root')
  if (root instanceof HTMLElement) {
    root.style.setProperty('--xiaohongshu-user-width', `${clamped}px`)
    root.style.setProperty('--xiaohongshu-content-width', `${clamped}px`)
  }
}

export function syncXiaohongshuContentWidthForWorkMode(mode: 'wizard' | 'advanced'): void {
  const root = document.querySelector('.xiaohongshu-layout__width-root')
  if (!(root instanceof HTMLElement)) return

  if (mode === 'wizard') {
    applyXiaohongshuContentWidth(TOOL_CONTENT_MIN_WIDTH)
    return
  }

  const column = root.offsetWidth
  if (column > 0) {
    applyXiaohongshuContentWidth(resolveMaxXContentWidth(column))
  } else {
    applyXiaohongshuContentWidth(TOOL_CONTENT_DEFAULT_WIDTH)
  }
}
