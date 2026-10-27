import { listContents, listItems, listWeeks } from '../../../services/moments/idb-repository'
import type { MomentsContent, MomentsGenerationStatus, MomentsScheduleItem, MomentsWeekRecord } from '../domain/moments'
import { weekRange } from './week-range'

export type DayGoalStatus = 'empty' | 'planned' | 'generating' | 'ready' | 'failed'

export interface DayRollup {
  date: string
  weekId: string | null
  hasPlan: boolean
  hasContent: boolean
  status: DayGoalStatus
}

export interface WeekRollup {
  weekStart: string
  weekEnd: string
  status: MomentsWeekRecord['status'] | 'none'
  scheduledDays: number
  generatedDays: number
  confirmed: boolean
}

export interface MomentsCalendarIndex {
  byWeekStart: Map<string, WeekRollup>
  byDate: Map<string, DayRollup>
}

function resolveDayStatus(items: MomentsScheduleItem[], contents: MomentsContent[]): DayGoalStatus {
  if (items.length === 0) return 'empty'
  if (items.some((item) => item.generationStatus === 'generating')) return 'generating'
  if (items.some((item) => item.generationStatus === 'failed')) return 'failed'
  const ready =
    contents.length > 0 &&
    items.every((item) => {
      const row = contents.find((c) => c.scheduleItemId === item.id)
      return row && row.versions.length >= 3
    })
  if (ready) return 'ready'
  if (contents.length > 0) return 'ready'
  return 'planned'
}

export async function buildMomentsCalendarIndex(): Promise<MomentsCalendarIndex> {
  const [weeks, items, contents] = await Promise.all([listWeeks(), listItems(), listContents()])

  const itemsByDate = new Map<string, MomentsScheduleItem[]>()
  for (const item of items) {
    const list = itemsByDate.get(item.date) ?? []
    list.push(item)
    itemsByDate.set(item.date, list)
  }

  const contentsByDate = new Map<string, MomentsContent[]>()
  for (const row of contents) {
    const list = contentsByDate.get(row.date) ?? []
    list.push(row)
    contentsByDate.set(row.date, list)
  }

  const byDate = new Map<string, DayRollup>()
  for (const [date, dayItems] of itemsByDate) {
    const dayContents = contentsByDate.get(date) ?? []
    const weekId = dayItems[0]?.weekId ?? null
    byDate.set(date, {
      date,
      weekId,
      hasPlan: true,
      hasContent: dayContents.length > 0,
      status: resolveDayStatus(dayItems, dayContents),
    })
  }

  const byWeekStart = new Map<string, WeekRollup>()
  for (const week of weeks) {
    const weekItems = items.filter((item) => item.weekId === week.id)
    const scheduledDates = [...new Set(weekItems.map((item) => item.date))]
    const generatedDays = scheduledDates.filter((date) => {
      const dayItems = weekItems.filter((item) => item.date === date)
      const dayContents = contents.filter((row) => row.date === date && row.weekId === week.id)
      return resolveDayStatus(dayItems, dayContents) === 'ready'
    }).length
    byWeekStart.set(week.weekStart, {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      status: week.status,
      scheduledDays: scheduledDates.length,
      generatedDays,
      confirmed: week.status === 'confirmed',
    })
  }

  return { byWeekStart, byDate }
}

export function getDayRollup(index: MomentsCalendarIndex | null, date: string): DayRollup {
  return (
    index?.byDate.get(date) ?? {
      date,
      weekId: null,
      hasPlan: false,
      hasContent: false,
      status: 'empty',
    }
  )
}

export function getWeekRollup(index: MomentsCalendarIndex | null, weekStart: string): WeekRollup {
  return (
    index?.byWeekStart.get(weekStart) ?? {
      weekStart,
      weekEnd: weekRange(weekStart).weekEnd,
      status: 'none',
      scheduledDays: 0,
      generatedDays: 0,
      confirmed: false,
    }
  )
}

export function dayStatusFromWeekView(
  items: MomentsScheduleItem[],
  contents: MomentsContent[],
): DayGoalStatus {
  return resolveDayStatus(items, contents)
}

export function isGenerationStatus(status: DayGoalStatus): MomentsGenerationStatus | null {
  if (status === 'generating') return 'generating'
  if (status === 'ready') return 'ready'
  if (status === 'failed') return 'failed'
  if (status === 'planned') return 'pending'
  return null
}
