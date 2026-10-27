export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
}

export function startOfWeek(date: Date): Date {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  result.setDate(result.getDate() + diff)
  return result
}

export interface WeekRange {
  weekStart: string
  weekEnd: string
  dates: string[]
}

export function weekRange(anchor: Date | string): WeekRange {
  const base = typeof anchor === 'string' ? parseDateKey(anchor) : anchor
  const monday = startOfWeek(base)
  const dates: string[] = []
  for (let index = 0; index < 7; index += 1) {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
    dates.push(toDateKey(day))
  }
  return { weekStart: dates[0]!, weekEnd: dates[6]!, dates }
}

export function shiftWeek(weekStart: string, deltaWeeks: number): WeekRange {
  const base = parseDateKey(weekStart)
  return weekRange(new Date(base.getFullYear(), base.getMonth(), base.getDate() + deltaWeeks * 7))
}

export function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const [sy, sm, sd] = weekStart.split('-').map(Number)
  const [ey, em, ed] = weekEnd.split('-').map(Number)
  if (sy === ey) return `${sm}月${sd}日 - ${em}月${ed}日`
  return `${sy}年${sm}月${sd}日 - ${ey}年${em}月${ed}日`
}

const WEEKDAY_KEYS = [
  'momentsWeekdayMonday',
  'momentsWeekdayTuesday',
  'momentsWeekdayWednesday',
  'momentsWeekdayThursday',
  'momentsWeekdayFriday',
  'momentsWeekdaySaturday',
  'momentsWeekdaySunday',
] as const

export function weekdayKey(dateKey: string): string {
  const day = parseDateKey(dateKey).getDay()
  const index = day === 0 ? 6 : day - 1
  return WEEKDAY_KEYS[index]!
}

export function formatDayLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-')
  return `${month}-${day}`
}
