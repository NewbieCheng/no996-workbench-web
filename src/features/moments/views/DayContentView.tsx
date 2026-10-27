import { useTranslation } from 'react-i18next'
import type { MomentsContent } from '../domain/moments'
import { resolveMomentsBody } from '../domain/moments'
import { Button } from '@no996/ui/button'
import { CopyIcon, ArrowLeftIcon } from 'lucide-react'
import { formatDayLabel, weekdayKey } from '../service/week-range'

interface DayContentViewProps {
  date: string
  contents: MomentsContent[]
  onBack: () => void
  onOpenDetail: (contentId: string) => void
  onCopy: (text: string) => void
}

const VERSION_LABELS = ['一', '二', '三'] as const

function deriveDayTheme(contents: MomentsContent[]): string {
  const first = [...contents].sort((a, b) => a.publishOrder - b.publishOrder)[0]
  return first?.topic ?? ''
}

export function DayContentView({ date, contents, onBack, onOpenDetail, onCopy }: DayContentViewProps) {
  const { t } = useTranslation('workbench')
  const ordered = [...contents].sort((a, b) => a.publishOrder - b.publishOrder)
  const theme = deriveDayTheme(ordered)

  return (
    <div className="moments-day-content">
      <div className="moments-subhead">
        <div>
          <h2>{t('momentsDayContentTitle')}</h2>
          {theme ? <p>{t('momentsDayTheme', { theme })}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="moments-day-content__count">{t('momentsTodayCount', { count: ordered.length })}</span>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            {t('momentsBackToOverview')}
          </Button>
        </div>
      </div>

      <div className="moments-day-content__banner">
        <span className="moments-material__weekday">{t(weekdayKey(date))}</span>
        <span className="moments-material__date">{formatDayLabel(date)}</span>
      </div>
      <p className="moments-day-content__hint">{t('momentsDayContentHint')}</p>

      <div className="moments-day-content__list moments-form-stack">
        {ordered.map((content) => {
          const body = resolveMomentsBody(content)
          const meta = content.versionMeta.find((row) => row.version === content.currentVersion)
          return (
            <article key={content.id} className="moments-content-card">
              <header className="moments-content-card__head">
                <span className="moments-content-card__order">
                  {String(content.publishOrder).padStart(2, '0')} · {content.topic}
                </span>
                {content.usedMock ? <span className="moments-demo-chip">{t('momentsDemoLabel')}</span> : null}
              </header>
              <p className="moments-content-card__body">{body}</p>
              <footer className="moments-content-card__foot">
                <span className="moments-content-card__current">
                  {t('momentsCurrentVersion')}
                  {t('momentsVersionLabel', { label: VERSION_LABELS[content.currentVersion] ?? '一' })}
                  {meta?.angleTitle ? ` · ${meta.angleTitle}` : ''}
                  {content.manuallyEdited ? ` · ${t('momentsManuallyEdited')}` : ''}
                </span>
                <div className="moments-content-card__actions">
                  <Button variant="outline" size="sm" onClick={() => onOpenDetail(content.id)}>
                    {t('momentsViewDetail')}
                  </Button>
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => onCopy(body)}>
                    <CopyIcon className="h-3.5 w-3.5" />
                    {t('momentsCopy')}
                  </Button>
                </div>
              </footer>
            </article>
          )
        })}
      </div>
    </div>
  )
}
