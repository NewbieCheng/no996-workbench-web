import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { MomentsCalendarIndex } from '../service/moments-calendar-index'
import { getDayRollup, getWeekRollup } from '../service/moments-calendar-index'
import { parseDateKey, startOfWeek, toDateKey, weekRange } from '../service/week-range'
import { MomentsGoalCheck } from './MomentsGoalCheck'

interface MomentsMonthCalendarProps {
  index: MomentsCalendarIndex | null
  anchorWeekStart: string
  onPickDate: (dateKey: string) => void
}

function monthMatrix(year: number, month: number): Array<{ date: Date; inMonth: boolean }> {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first)
  const cells: Array<{ date: Date; inMonth: boolean }> = []
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    cells.push({ date: d, inMonth: d.getMonth() === month })
  }
  return cells
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

export function MomentsMonthCalendar({ index, anchorWeekStart, onPickDate }: MomentsMonthCalendarProps) {
  const { t } = useTranslation('workbench')
  const anchor = parseDateKey(anchorWeekStart)
  const [viewYear, setViewYear] = useState(anchor.getFullYear())
  const [viewMonth, setViewMonth] = useState(anchor.getMonth())

  const cells = useMemo(() => monthMatrix(viewYear, viewMonth), [viewYear, viewMonth])

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  const title = t('momentsCalendarMonthTitle', { year: viewYear, month: viewMonth + 1 })

  return (
    <div className="moments-month-cal">
      <div className="moments-month-cal__head">
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label={t('momentsCalendarPrevMonth')}>
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <span className="moments-month-cal__title">{title}</span>
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(1)} aria-label={t('momentsCalendarNextMonth')}>
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="moments-month-cal__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="moments-month-cal__weekday">{label}</span>
        ))}
      </div>
      <div className="moments-month-cal__grid">
        {cells.map(({ date, inMonth }) => {
          const key = toDateKey(date)
          const rollup = getDayRollup(index, key)
          const weekStart = weekRange(key).weekStart
          const weekRollup = getWeekRollup(index, weekStart)
          const inAnchorWeek = weekStart === anchorWeekStart
          const isToday = key === toDateKey(new Date())
          return (
            <button
              key={key}
              type="button"
              className={[
                'moments-month-cal__cell',
                !inMonth ? 'moments-month-cal__cell--muted' : '',
                inAnchorWeek ? 'moments-month-cal__cell--week' : '',
                isToday ? 'moments-month-cal__cell--today' : '',
                rollup.status !== 'empty' ? `moments-month-cal__cell--${rollup.status}` : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onPickDate(key)}
            >
              <span className="moments-month-cal__day">{date.getDate()}</span>
              <span className="moments-month-cal__mark">
                {rollup.status === 'ready' ? <MomentsGoalCheck size={10} /> : rollup.hasPlan ? <span className="moments-month-cal__dot" /> : null}
              </span>
              {weekRollup.confirmed && date.getDay() === 1 ? (
                <span className="moments-month-cal__week-badge" title={t('momentsWeekConfirmedBadge')}>
                  <MomentsGoalCheck size={8} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
