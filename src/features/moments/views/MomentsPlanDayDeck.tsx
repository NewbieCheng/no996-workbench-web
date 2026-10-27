import { useCallback, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { formatDayLabel, weekdayKey } from '../service/week-range'

interface MomentsPlanDayDeckProps {
  weekDates: string[]
  activeDate: string
  onActiveDateChange: (date: string) => void
  hasItemsOnDate: (date: string) => boolean
  /** 排期页已用 GoalRail 时只渲染当日正文区 */
  variant?: 'full' | 'focus'
  /** 日期标题行右侧操作区（如「编辑」） */
  panelHeadActions?: ReactNode
  children: ReactNode
}

function weekdayShortLabel(weekdayFull: string): string {
  return weekdayFull.replace(/^周/, '')
}

export function MomentsPlanDayDeck({
  weekDates,
  activeDate,
  onActiveDateChange,
  hasItemsOnDate,
  variant = 'full',
  panelHeadActions,
  children,
}: MomentsPlanDayDeckProps) {
  const { t } = useTranslation('workbench')
  const activeIndex = Math.max(0, weekDates.indexOf(activeDate))
  const scheduledInWeek = weekDates.filter(hasItemsOnDate)
  const positionInScheduled =
    scheduledInWeek.length > 0 ? Math.max(1, scheduledInWeek.indexOf(activeDate) + 1) : activeIndex + 1
  const totalScheduled = scheduledInWeek.length > 0 ? scheduledInWeek.length : weekDates.length

  const goPrev = useCallback(() => {
    const pool = scheduledInWeek.length > 0 ? scheduledInWeek : weekDates
    const idx = pool.indexOf(activeDate)
    const nextIdx = idx <= 0 ? pool.length - 1 : idx - 1
    onActiveDateChange(pool[nextIdx]!)
  }, [activeDate, onActiveDateChange, scheduledInWeek, weekDates])

  const goNext = useCallback(() => {
    const pool = scheduledInWeek.length > 0 ? scheduledInWeek : weekDates
    const idx = pool.indexOf(activeDate)
    const nextIdx = idx < 0 || idx >= pool.length - 1 ? 0 : idx + 1
    onActiveDateChange(pool[nextIdx]!)
  }, [activeDate, onActiveDateChange, scheduledInWeek, weekDates])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev])

  if (variant === 'focus') {
    return (
      <div className="moments-day-deck moments-day-deck--focus">
        <header className="moments-day-deck__panel-head">
          <div>
            <span className="moments-day-deck__weekday">{t(weekdayKey(activeDate))}</span>
            <span className="moments-day-deck__date">{formatDayLabel(activeDate)}</span>
          </div>
          {panelHeadActions ? (
            <div className="moments-day-deck__panel-head-actions">{panelHeadActions}</div>
          ) : null}
        </header>
        <div className="moments-day-deck__body">{children}</div>
      </div>
    )
  }

  return (
    <div className="moments-day-deck">
      <div className="moments-day-deck__rail" role="tablist" aria-label={t('momentsPlanAgentResult')}>
        {weekDates.map((date) => {
          const selected = date === activeDate
          const hasItems = hasItemsOnDate(date)
          const short = weekdayShortLabel(t(weekdayKey(date)))
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`moments-day-deck__chip${selected ? ' moments-day-deck__chip--active' : ''}${hasItems ? ' moments-day-deck__chip--has-items' : ''}`}
              onClick={() => onActiveDateChange(date)}
            >
              <span className="moments-day-deck__chip-label">{short}</span>
              {hasItems ? <span className="moments-day-deck__chip-dot" aria-hidden /> : null}
            </button>
          )
        })}
      </div>

      <div className="moments-day-deck__panel" role="tabpanel">
        <header className="moments-day-deck__panel-head">
          <div>
            <span className="moments-day-deck__weekday">{t(weekdayKey(activeDate))}</span>
            <span className="moments-day-deck__date">{formatDayLabel(activeDate)}</span>
          </div>
          {panelHeadActions ? (
            <div className="moments-day-deck__panel-head-actions">{panelHeadActions}</div>
          ) : null}
        </header>
        <div className="moments-day-deck__body">{children}</div>
      </div>

      <div className="moments-day-deck__nav">
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={goPrev}>
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          {t('momentsDeckPrevDay')}
        </Button>
        <span className="moments-day-deck__counter" aria-live="polite">
          {t('momentsDeckDayCounter', { current: positionInScheduled, total: totalScheduled })}
        </span>
        <Button type="button" variant="ghost" size="sm" className="gap-1" onClick={goNext}>
          {t('momentsDeckNextDay')}
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  )
}
