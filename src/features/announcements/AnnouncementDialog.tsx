import { Megaphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import {
  fetchAnnouncementDetail,
  fetchAnnouncementHistory,
  formatAnnouncementBadgeCount,
  isAnnouncementUnread,
  markAnnouncementRead,
  type AnnouncementActiveItem,
  type AnnouncementDetail,
} from '@/api/announcements'
import { renderAnnouncementBodyHtml } from '@/features/announcements/render-announcement-body'

type Tab = 'current' | 'history'

function formatListDate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDetailDate(value?: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function AnnouncementDialog({
  open,
  onOpenChange,
  activeItems,
  unreadCount,
  onRead,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activeItems: AnnouncementActiveItem[]
  unreadCount: number
  onRead: () => void
}) {
  const { t } = useTranslation('workbench')
  const [tab, setTab] = useState<Tab>('current')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AnnouncementDetail | null>(null)
  const [history, setHistory] = useState<AnnouncementDetail[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    if (!open) return
    const firstUnread = activeItems.find((item) => isAnnouncementUnread(item.announcement_id))
    setSelectedId(firstUnread?.announcement_id ?? activeItems[0]?.announcement_id ?? null)
    setTab('current')
  }, [open, activeItems])

  useEffect(() => {
    if (!open || tab !== 'history' || history.length === 0) return
    const inList = history.some((row) => row.announcement_id === selectedId)
    if (!inList) {
      setSelectedId(history[0]?.announcement_id ?? null)
    }
  }, [open, tab, history, selectedId])

  useEffect(() => {
    if (!open || selectedId == null) {
      setDetail(null)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    void fetchAnnouncementDetail(selectedId)
      .then((row) => {
        if (cancelled) return
        setDetail(row)
        markAnnouncementRead(row.announcement_id)
        onRead()
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, selectedId, onRead])

  useEffect(() => {
    if (!open || tab !== 'history') return
    let cancelled = false
    setLoadingHistory(true)
    void fetchAnnouncementHistory('workbench', 1, 30)
      .then((page) => {
        if (!cancelled) setHistory(page.items ?? [])
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, tab])

  const html = useMemo(() => renderAnnouncementBodyHtml(detail?.body_md ?? ''), [detail?.body_md])

  const list = tab === 'current' ? activeItems : history
  const listLoading = tab === 'history' && loadingHistory && history.length === 0
  const badgeLabel = formatAnnouncementBadgeCount(unreadCount)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="wb-announcement-dialog data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-200"
        overlayClassName="duration-200"
        showCloseButton
      >
        <DialogHeader className="wb-announcement-header">
          <div className="wb-announcement-header__lead">
            <span className="wb-announcement-header__icon" aria-hidden>
              <Megaphone size={18} strokeWidth={1.75} />
            </span>
            <div className="wb-announcement-header__text">
              <DialogTitle>{t('announcementDialogTitle')}</DialogTitle>
              <DialogDescription>{t('announcementDialogDesc')}</DialogDescription>
            </div>
          </div>
          <div className="wb-announcement-header__aside">
            <div className="wb-announcement-tabs" role="tablist" aria-label={t('announcementDialogTitle')}>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'current'}
                className={tab === 'current' ? 'is-active' : undefined}
                onClick={() => setTab('current')}
              >
                {t('announcementTabCurrent')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'history'}
                className={tab === 'history' ? 'is-active' : undefined}
                onClick={() => setTab('history')}
              >
                {t('announcementTabHistory')}
              </button>
            </div>
            {badgeLabel ? (
              <span
                className="wb-announcement-header__count"
                aria-label={t('announcementUnreadCount', { count: unreadCount })}
              >
                {badgeLabel}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="wb-announcement-body">
          <ul className="wb-announcement-list" aria-busy={listLoading}>
            {listLoading ? (
              <li className="wb-announcement-empty">{t('announcementLoading')}</li>
            ) : list.length === 0 ? (
              <li className="wb-announcement-empty">
                <p>{t('announcementEmpty')}</p>
                <p className="wb-announcement-empty__hint">{t('announcementEmptyHint')}</p>
              </li>
            ) : (
              list.map((item) => {
                const id = item.announcement_id
                const title = item.title
                const summary = 'summary' in item ? item.summary : undefined
                const publishedAt =
                  'published_at' in item ? item.published_at : (item as AnnouncementDetail).published_at
                const active = selectedId === id
                const unread = isAnnouncementUnread(id)
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={['wb-announcement-list__item', active ? 'is-active' : '', unread ? 'is-unread' : '']
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setSelectedId(id)}
                      aria-current={active ? 'true' : undefined}
                    >
                      <span className="wb-announcement-list__title-row">
                        {unread ? <span className="wb-announcement-list__dot" aria-hidden /> : null}
                        <span className="wb-announcement-list__title">{title}</span>
                      </span>
                      {summary ? (
                        <span className="wb-announcement-list__summary">{summary}</span>
                      ) : null}
                      {publishedAt ? (
                        <time className="wb-announcement-list__date" dateTime={publishedAt}>
                          {formatListDate(publishedAt)}
                        </time>
                      ) : null}
                    </button>
                  </li>
                )
              })
            )}
          </ul>
          <div
            className={['wb-announcement-detail', loadingDetail ? 'is-loading' : ''].filter(Boolean).join(' ')}
            aria-live="polite"
          >
            {loadingDetail ? (
              <div className="wb-announcement-detail__placeholder">
                <span className="wb-announcement-detail__shimmer" aria-hidden />
                <p className="wb-announcement-muted">{t('announcementLoading')}</p>
              </div>
            ) : detail ? (
              <article className="wb-announcement-article">
                <header className="wb-announcement-detail__head">
                  <h2 className="wb-announcement-detail__title">{detail.title}</h2>
                  {detail.published_at ? (
                    <time className="wb-announcement-detail__meta" dateTime={detail.published_at}>
                      {formatDetailDate(detail.published_at)}
                    </time>
                  ) : null}
                  {detail.summary ? (
                    <p className="wb-announcement-detail__lede">{detail.summary}</p>
                  ) : null}
                </header>
                {html ? (
                  <div
                    className="wb-announcement-markdown"
                    dangerouslySetInnerHTML={{ __html: html }}
                  />
                ) : null}
                {detail.link_url ? (
                  <footer className="wb-announcement-detail__foot">
                    <a className="wb-announcement-link" href={detail.link_url} target="_blank" rel="noreferrer">
                      {t('announcementLearnMore')}
                    </a>
                  </footer>
                ) : null}
              </article>
            ) : (
              <div className="wb-announcement-detail__placeholder">
                <p className="wb-announcement-muted">{t('announcementSelectHint')}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
