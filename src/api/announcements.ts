import { api, type ApiEnvelope, type PageResult } from './client'

export type AnnouncementChannel = 'workbench' | 'desktop' | 'all'

export interface AnnouncementActiveItem {
  announcement_id: number
  channel: AnnouncementChannel
  title: string
  summary?: string
  link_url?: string
  priority: number
  published_at?: string
  content_revision: number
}

export interface AnnouncementActiveFeed {
  items: AnnouncementActiveItem[]
  channel: string
  feed_revision: number
}

export interface AnnouncementDetail {
  announcement_id: number
  channel: AnnouncementChannel
  title: string
  summary?: string
  body_md: string
  link_url?: string
  status: number
  priority: number
  publish_at?: string
  expire_at?: string
  published_at?: string
  content_revision: number
  created_at: string
  updated_at: string
}

export interface FeedVersion {
  channel: string
  feed_revision: number
}

const CACHE_KEY = 'no996_wb_ann_active_v1'

type ActiveCache = {
  channel: string
  feedRevision: number
  items: AnnouncementActiveItem[]
  etag?: string
  fetchedAt: number
}

function readCache(channel: string): ActiveCache | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveCache
    if (parsed.channel !== channel) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(payload: ActiveCache) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload))
}

async function getWithEtag<T>(path: string, etag?: string): Promise<{ status: number; data?: T; etag?: string }> {
  const res = await api.get<ApiEnvelope<T>>(path, {
    headers: etag ? { 'If-None-Match': etag } : undefined,
    validateStatus: (status) => status === 200 || status === 304,
  })
  const nextEtag = res.headers?.etag as string | undefined
  if (res.status === 304) {
    return { status: 304, etag: nextEtag ?? etag }
  }
  return { status: 200, data: res.data.data as T, etag: nextEtag }
}

export async function loadActiveAnnouncements(
  channel: AnnouncementChannel = 'workbench',
  options?: { force?: boolean },
): Promise<AnnouncementActiveFeed> {
  const cached = !options?.force ? readCache(channel) : null

  const versionRes = await getWithEtag<FeedVersion>(
    `/announcements/feed-version?channel=${encodeURIComponent(channel)}`,
    cached?.etag,
  )
  if (versionRes.status === 304 && cached) {
    return { items: cached.items, channel, feed_revision: cached.feedRevision }
  }
  const revision = versionRes.data?.feed_revision ?? cached?.feedRevision ?? 0
  if (cached && cached.feedRevision === revision && !options?.force) {
    return { items: cached.items, channel, feed_revision: revision }
  }

  const activeRes = await getWithEtag<AnnouncementActiveFeed>(
    `/announcements/active?channel=${encodeURIComponent(channel)}`,
    cached?.etag,
  )
  if (activeRes.status === 304 && cached) {
    return { items: cached.items, channel, feed_revision: cached.feedRevision }
  }
  const feed = activeRes.data ?? { items: [], channel, feed_revision: revision }
  writeCache({
    channel,
    feedRevision: feed.feed_revision,
    items: feed.items ?? [],
    etag: activeRes.etag,
    fetchedAt: Date.now(),
  })
  return feed
}

export async function fetchAnnouncementDetail(id: number): Promise<AnnouncementDetail> {
  const res = await api.get<ApiEnvelope<AnnouncementDetail>>(`/announcements/${id}`)
  if (!res.data.data) throw new Error('announcement missing')
  return res.data.data
}

export async function fetchAnnouncementHistory(
  channel: AnnouncementChannel = 'workbench',
  page = 1,
  pageSize = 20,
): Promise<PageResult<AnnouncementDetail>> {
  const res = await api.get<ApiEnvelope<PageResult<AnnouncementDetail>>>('/announcements', {
    params: { channel, page, page_size: pageSize },
  })
  return (
    res.data.data ?? {
      items: [],
      page,
      page_size: pageSize,
      total: 0,
    }
  )
}

const DISMISS_PREFIX = 'no996_wb_ann_seen:'

export function isAnnouncementUnread(id: number): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(`${DISMISS_PREFIX}${id}`) !== '1'
}

export function markAnnouncementRead(id: number) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(`${DISMISS_PREFIX}${id}`, '1')
}

export function hasUnreadActive(items: AnnouncementActiveItem[]): boolean {
  return countUnreadActive(items) > 0
}

export function countUnreadActive(items: AnnouncementActiveItem[]): number {
  return items.filter((item) => isAnnouncementUnread(item.announcement_id)).length
}

export function formatAnnouncementBadgeCount(count: number): string {
  if (count <= 0) return ''
  return count > 9 ? '9+' : String(count)
}
