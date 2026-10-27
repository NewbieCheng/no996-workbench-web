import { toDateKey, weekRange } from '../service/week-range'

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const

export function monthLabel(year: number, month: number): string {
  return `${year}年${month}月`
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export interface MonthCell {
  date: string | null
  day: number | null
  inMonth: boolean
  weekStart: string | null
}

/** Monday-first month grid (6 rows × 7 cols max). */
export function buildMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const startPad = (first.getDay() + 6) % 7
  const cells: MonthCell[] = []

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, day: null, inMonth: false, weekStart: null })
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = toDateKey(new Date(year, month - 1, day))
    cells.push({
      date,
      day,
      inMonth: true,
      weekStart: weekRange(date).weekStart,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, inMonth: false, weekStart: null })
  }

  return cells
}

export function weekRows(cells: MonthCell[]): MonthCell[][] {
  const rows: MonthCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7))
  }
  return rows
}

export { WEEKDAY_HEADERS }
