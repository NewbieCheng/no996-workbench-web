import { useCallback, useEffect, useRef, useState } from 'react'
import {
  countUnreadActive,
  loadActiveAnnouncements,
  type AnnouncementActiveItem,
} from '@/api/announcements'

const STALE_MS = 5 * 60 * 1000

export function useWorkbenchAnnouncements() {
  const [items, setItems] = useState<AnnouncementActiveItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const lastFetchRef = useRef(0)

  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const feed = await loadActiveAnnouncements('workbench', { force })
      setItems(feed.items ?? [])
      setUnreadCount(countUnreadActive(feed.items ?? []))
      lastFetchRef.current = Date.now()
    } catch {
      setItems([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(false)
  }, [refresh])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastFetchRef.current < STALE_MS) return
      void refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const onRead = useCallback(() => {
    setUnreadCount(countUnreadActive(items))
  }, [items])

  return { items, unreadCount, loading, refresh, onRead }
}
