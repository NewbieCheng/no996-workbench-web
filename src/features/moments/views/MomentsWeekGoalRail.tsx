import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { DayGoalStatus } from '../service/moments-calendar-index'
import { formatDayLabel, weekdayKey, type WeekRange } from '../service/week-range'
import { MomentsGoalCheck } from './MomentsGoalCheck'

interface MomentsWeekGoalRailProps {
  range: WeekRange
  activeDate: string
  onActiveDateChange: (date: string) => void
  statusForDate: (date: string) => DayGoalStatus
  celebrateDates?: ReadonlySet<string>
}

function weekdayShortLabel(weekdayFull: string): string {
  return weekdayFull.replace(/^周/, '')
}

export function MomentsWeekGoalRail({
  range,
  activeDate,
  onActiveDateChange,
  statusForDate,
  celebrateDates,
}: MomentsWeekGoalRailProps) {
  const { t } = useTranslation('workbench')
  const dates = range.dates
  const completedCount = dates.filter((d) => statusForDate(d) === 'ready').length

  const goOffset = useCallback(
    (delta: number) => {
      const idx = dates.indexOf(activeDate)
      const base = idx < 0 ? 0 : idx
      const next = (base + delta + dates.length) % dates.length
      onActiveDateChange(dates[next]!)
    },
    [activeDate, dates, onActiveDateChange],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goOffset(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goOffset(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goOffset])

  const progressPct = dates.length > 0 ? (completedCount / dates.length) * 100 : 0

  return (
    <div className="moments-goal-rail">
      <div className="moments-goal-rail__track" aria-hidden>
        <span className="moments-goal-rail__track-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="moments-goal-rail__nodes" role="tablist" aria-label={t('momentsWeekGoalRailAria')}>
        {dates.map((date) => {
          const status = statusForDate(date)
          const selected = date === activeDate
          const celebrate = celebrateDates?.has(date) && status === 'ready'
          return (
            <button
              key={date}
              type="button"
              role="tab"
              aria-selected={selected}
              className={[
                'moments-goal-rail__node',
                selected ? 'moments-goal-rail__node--active' : '',
                status !== 'empty' ? `moments-goal-rail__node--${status}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onActiveDateChange(date)}
            >
              <span className="moments-goal-rail__node-weekday">{weekdayShortLabel(t(weekdayKey(date)))}</span>
              <span className="moments-goal-rail__node-date">{formatDayLabel(date)}</span>
              <span className="moments-goal-rail__node-mark" aria-hidden>
                {status === 'ready' ? (
                  <MomentsGoalCheck size={12} animate={celebrate} />
                ) : status === 'planned' || status === 'generating' || status === 'failed' ? (
                  <span className="moments-goal-rail__dot" />
                ) : null}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
