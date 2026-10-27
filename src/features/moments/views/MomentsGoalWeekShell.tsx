import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type { MomentsCalendarIndex, DayGoalStatus } from '../service/moments-calendar-index'
import { type WeekRange } from '../service/week-range'
import { MomentsWeekCalendarTrigger } from './MomentsWeekCalendarTrigger'
import { MomentsWeekGoalRail } from './MomentsWeekGoalRail'
import { MomentsWeekProgressRing } from './MomentsWeekProgressRing'

export type MomentsGoalShellMode = 'execute' | 'edit'

interface MomentsGoalWeekShellProps {
  mode: MomentsGoalShellMode
  range: WeekRange
  calendarIndex: MomentsCalendarIndex | null
  activeDate: string
  onActiveDateChange: (date: string) => void
  onShiftWeek: (delta: number) => void
  onPickDate: (dateKey: string) => void
  statusForDate: (date: string) => DayGoalStatus
  generatedDays: number
  scheduledDays: number
  celebrateDates?: ReadonlySet<string>
  toolbar?: ReactNode
  /** 计划确认页等场景不展示周切换与出稿进度顶栏 */
  showChrome?: boolean
  children: ReactNode
}

export function MomentsGoalWeekShell({
  mode,
  range,
  calendarIndex,
  activeDate,
  onActiveDateChange,
  onShiftWeek,
  onPickDate,
  statusForDate,
  generatedDays,
  scheduledDays,
  celebrateDates,
  toolbar,
  showChrome = true,
  children,
}: MomentsGoalWeekShellProps) {
  const { t } = useTranslation('workbench')
  const progressLabel = t('momentsWeekGoalProgress', { generated: generatedDays, total: scheduledDays })

  return (
    <div className="moments-goal-shell">
      {showChrome ? (
        <header className="moments-goal-shell__chrome">
          <div className="moments-goal-shell__chrome-left">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onShiftWeek(-1)}
              aria-label={t('momentsPrevWeek')}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <MomentsWeekCalendarTrigger
              weekStart={range.weekStart}
              weekEnd={range.weekEnd}
              index={calendarIndex}
              onPickDate={onPickDate}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onShiftWeek(1)}
              aria-label={t('momentsNextWeek')}
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className="moments-goal-shell__chrome-right">
            <MomentsWeekProgressRing generated={generatedDays} total={scheduledDays} label={progressLabel} />
            <span className="moments-goal-shell__progress-text">{progressLabel}</span>
            {toolbar}
          </div>
        </header>
      ) : null}

      <MomentsWeekGoalRail
        range={range}
        activeDate={activeDate}
        onActiveDateChange={onActiveDateChange}
        statusForDate={statusForDate}
        celebrateDates={celebrateDates}
      />

      <div className="moments-goal-shell__focus" data-mode={mode}>
        {children}
      </div>
    </div>
  )
}
