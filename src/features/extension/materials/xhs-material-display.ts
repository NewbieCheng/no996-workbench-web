import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'

const XHS_DISPLAY_TITLE_MAX_LEN = 60

export function normalizeXiaohongshuComparableText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function truncateXiaohongshuTitleLine(line: string, maxLen = XHS_DISPLAY_TITLE_MAX_LEN): string {
  const trimmed = normalizeXiaohongshuComparableText(line)
  if (!trimmed) return ''
  if (trimmed.length <= maxLen) return trimmed
  return `${trimmed.slice(0, maxLen)}…`
}

function firstLineOfXiaohongshuText(body: string): string {
  const line = body.split(/\r?\n/).map((row) => row.trim()).find(Boolean)
  return line ?? ''
}

/** Mirrors extension `projectXiaohongshuDisplayTitle` for saved/display fields. */
export function resolveXiaohongshuDisplayTitle(title?: string, content?: string): string {
  const body = (content ?? '').trim()
  const candidate = (title ?? '').trim()

  if (candidate) {
    const normCandidate = normalizeXiaohongshuComparableText(candidate)
    const normBody = body ? normalizeXiaohongshuComparableText(body) : ''
    const distinct = !normBody || normCandidate !== normBody
    if (distinct && normCandidate.length <= XHS_DISPLAY_TITLE_MAX_LEN) {
      return normCandidate
    }
  }

  if (body) {
    const fromFirstLine = truncateXiaohongshuTitleLine(firstLineOfXiaohongshuText(body))
    if (fromFirstLine) return fromFirstLine
  }

  if (candidate) {
    return truncateXiaohongshuTitleLine(candidate)
  }

  return ''
}

export function resolveXiaohongshuDisplayAuthor(author?: string): string | undefined {
  const trimmed = (author ?? '').trim()
  return trimmed || undefined
}

export function normalizeXiaohongshuCollectedItem(
  item: WorkbenchBridgeCollectedItem,
): WorkbenchBridgeCollectedItem {
  if (item.platformId !== 'xiaohongshu') return item

  const rawContent = (item.content ?? '').trim()
  const rawTitle = (item.title ?? '').trim()
  const content = rawContent || rawTitle
  const title = resolveXiaohongshuDisplayTitle(rawTitle, content)
  const author = resolveXiaohongshuDisplayAuthor(item.author)

  return {
    ...item,
    ...(content ? { content } : {}),
    ...(title ? { title } : {}),
    ...(author ? { author } : {}),
  }
}
