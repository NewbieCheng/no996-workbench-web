import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MomentsContent, MomentsScheduleItem, MomentsWeekView } from '../domain/moments'
import { Button } from '@no996/ui/button'
import { Badge } from '@no996/ui/badge'
import { Skeleton } from '@no996/ui/skeleton'
import {
  SparklesIcon,
  CalendarDaysIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
} from 'lucide-react'
import { formatDayLabel, weekdayKey, type WeekRange } from '../service/week-range'
import type { DayGoalStatus, MomentsCalendarIndex } from '../service/moments-calendar-index'
import { dayStatusFromWeekView } from '../service/moments-calendar-index'
import { readCelebrateDates } from '../lib/goal-celebrate'
import { MomentsGoalWeekShell } from './MomentsGoalWeekShell'

interface WeekOverviewViewProps {
  range: WeekRange
  week: MomentsWeekView | null
  loading: boolean
  calendarIndex: MomentsCalendarIndex | null
  activeDate: string
  onActiveDateChange: (date: string) => void
  onShiftWeek: (delta: number) => void
  onPickDate: (dateKey: string) => void
  onStartConfig: () => void
  onOpenDay: (date: string) => void
  onOpenPlan: () => void
  onRegenerateDay: (date: string) => void
}

export function WeekOverviewView({
  range,
  week,
  loading,
  calendarIndex,
  activeDate,
  onActiveDateChange,
  onShiftWeek,
  onPickDate,
  onStartConfig,
  onOpenDay,
  onOpenPlan,
  onRegenerateDay,
}: WeekOverviewViewProps) {
  const { t } = useTranslation('workbench')
  const [celebrateDates, setCelebrateDates] = useState<Set<string>>(() => readCelebrateDates())
  const [showLoading, setShowLoading] = useState(loading)
  const loadingStartedAt = useRef(Date.now())

  useEffect(() => {
    if (loading) {
      loadingStartedAt.current = Date.now()
      setShowLoading(true)
      return
    }
    const remaining = Math.max(0, 300 - (Date.now() - loadingStartedAt.current))
    const timer = window.setTimeout(() => setShowLoading(false), remaining)
    return () => window.clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    setCelebrateDates(readCelebrateDates())
  }, [week?.contents.length, week?.items.length])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, MomentsScheduleItem[]>()
    for (const item of week?.items ?? []) {
      const list = map.get(item.date) ?? []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [week?.items])

  const contentsByDate = useMemo(() => {
    const map = new Map<string, MomentsContent[]>()
    for (const row of week?.contents ?? []) {
      const list = map.get(row.date) ?? []
      list.push(row)
      map.set(row.date, list)
    }
    return map
  }, [week?.contents])

  const statusForDate = (date: string): DayGoalStatus => {
    const items = (itemsByDate.get(date) ?? []).sort((a, b) => a.publishOrder - b.publishOrder)
    const contents = contentsByDate.get(date) ?? []
    return dayStatusFromWeekView(items, contents)
  }

  const confirmed = week?.week.status === 'confirmed'
  const hasSchedule = (week?.items.length ?? 0) > 0
  const scheduledDates = range.dates.filter((date) => (itemsByDate.get(date)?.length ?? 0) > 0)
  const generatedCount = scheduledDates.filter((date) => statusForDate(date) === 'ready').length
  const scheduledDays = week?.scheduledDays ?? scheduledDates.length

  const focusDate = range.dates.includes(activeDate) ? activeDate : range.dates[0]!
  const focusItems = (itemsByDate.get(focusDate) ?? []).sort((a, b) => a.publishOrder - b.publishOrder)
  const focusStatus = statusForDate(focusDate)

  if (loading || showLoading) {
    return (
      <div className="moments-overview moments-overview--loading" aria-busy="true" aria-label={t('momentsLoadingWeek')}>
        <div className="moments-week-skeleton" aria-hidden="true">
          <div className="moments-week-skeleton__header"><Skeleton className="moments-week-skeleton__date" /><Skeleton className="moments-week-skeleton__progress" /></div>
          <div className="moments-week-skeleton__days">{range.dates.map((date) => <Skeleton key={date} className="moments-week-skeleton__day" />)}</div>
          <div className="moments-week-skeleton__card">
            <Skeleton className="moments-week-skeleton__title" />
            <Skeleton className="moments-week-skeleton__subtitle" />
            <Skeleton className="moments-week-skeleton__line" />
            <Skeleton className="moments-week-skeleton__button" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="moments-overview moments-overview--ready">
      <div className="moments-week-shell moments-week-shell--goal">
        <MomentsGoalWeekShell
          mode="execute"
          range={range}
          calendarIndex={calendarIndex}
          activeDate={focusDate}
          onActiveDateChange={onActiveDateChange}
          onShiftWeek={onShiftWeek}
          onPickDate={onPickDate}
          statusForDate={statusForDate}
          generatedDays={generatedCount}
          scheduledDays={scheduledDays}
          celebrateDates={celebrateDates}
          toolbar={
            <>
              {week ? (
                confirmed ? (
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <CheckCircle2Icon className="h-3 w-3" />
                    {t('momentsWeekConfirmedBadge')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">{t('momentsWeekDraftBadge')}</Badge>
                )
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="gap-1 shrink-0"
                disabled={!hasSchedule}
                onClick={onOpenPlan}
              >
                <CalendarDaysIcon className="h-3.5 w-3.5" />
                {t('momentsViewPlan')}
              </Button>
            </>
          }
        >
          <section className="moments-goal-focus">
            <header className="moments-goal-focus__head">
              <div>
                <h3 className="moments-goal-focus__title">
                  {t(weekdayKey(focusDate))} {formatDayLabel(focusDate)}
                </h3>
                <p className="moments-goal-focus__subtitle">{t('momentsDayGoalSubtitle')}</p>
              </div>
              {focusItems.length > 0 && (
                <span className={`moments-goal-focus__status moments-goal-focus__status--${focusStatus}`}>
                  {focusStatus === 'ready'
                    ? t('momentsDayStatusReady')
                    : focusStatus === 'generating'
                      ? t('momentsDayStatusGenerating')
                      : focusStatus === 'failed'
                        ? t('momentsDayStatusFailed')
                        : t('momentsDayStatusPending')}
                </span>
              )}
            </header>

            {focusItems.length === 0 ? (
              <p className="moments-goal-focus__empty">{t('momentsDayGoalEmpty')}</p>
            ) : (
              <ul className="moments-item-list moments-item-list--deck">
                {focusItems.map((item) => (
                  <li key={item.id} className="moments-item moments-item--deck-row">
                    <div className="moments-item__meta">
                      <span className="moments-item__order">
                        {t('momentsPublishOrder')} {String(item.publishOrder).padStart(2, '0')}
                      </span>
                      <span className="moments-item__direction">{item.contentDirection}</span>
                    </div>
                    <p className="moments-item__topic moments-item__topic--deck">{item.topic}</p>
                    {item.captureSuggestion?.trim() ? (
                      <p className="moments-item__capture">
                        {t('momentsCaptureSuggestion')}：{item.captureSuggestion}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            <div className="moments-goal-focus__actions">
              {focusItems.length === 0 ? (
                <Button className="moments-generate-week-button gap-1.5" onClick={onStartConfig}>
                  <SparklesIcon className="h-4 w-4" />
                  {t('momentsGenerateWeek')}
                </Button>
              ) : focusStatus === 'ready' ? (
                <Button variant="outline" onClick={() => onOpenDay(focusDate)}>{t('momentsView')}</Button>
              ) : focusStatus === 'generating' ? (
                <Button variant="outline" disabled>{t('momentsDayStatusGenerating')}</Button>
              ) : focusStatus === 'failed' ? (
                <Button variant="outline" className="gap-1" onClick={() => onRegenerateDay(focusDate)}>
                  <RefreshCwIcon className="h-3.5 w-3.5" />
                  {t('momentsRegenerate')}
                </Button>
              ) : (
                <Button onClick={() => onOpenDay(focusDate)}>{t('momentsGenerateDay')}</Button>
              )}
            </div>
          </section>
        </MomentsGoalWeekShell>
      </div>
    </div>
  )
}
