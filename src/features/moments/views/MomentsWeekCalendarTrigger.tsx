import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@no996/ui/dialog'
import { CalendarDaysIcon } from 'lucide-react'
import type { MomentsCalendarIndex } from '../service/moments-calendar-index'
import { formatWeekLabel } from '../service/week-range'
import { MomentsMonthCalendar } from './MomentsMonthCalendar'

interface MomentsWeekCalendarTriggerProps {
  weekStart: string
  weekEnd: string
  index: MomentsCalendarIndex | null
  onPickDate: (dateKey: string) => void
}

export function MomentsWeekCalendarTrigger({
  weekStart,
  weekEnd,
  index,
  onPickDate,
}: MomentsWeekCalendarTriggerProps) {
  const { t } = useTranslation('workbench')
  const [open, setOpen] = useState(false)
  const label = formatWeekLabel(weekStart, weekEnd)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="moments-week-cal-trigger"
        aria-label={t('momentsCalendarOpen', { range: label })}
      >
        <CalendarDaysIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span>{label}</span>
      </DialogTrigger>
      <DialogContent className="moments-month-cal-dialog" showCloseButton>
        <DialogHeader>
          <DialogTitle>{t('momentsCalendarTitle')}</DialogTitle>
        </DialogHeader>
        <MomentsMonthCalendar
          index={index}
          anchorWeekStart={weekStart}
          onPickDate={(dateKey) => {
            onPickDate(dateKey)
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
