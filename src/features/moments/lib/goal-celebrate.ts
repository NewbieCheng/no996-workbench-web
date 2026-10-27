const STORAGE_KEY = 'moments-goal-celebrate'

export function readCelebrateDates(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const list = JSON.parse(raw) as string[]
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

export function markDateCelebrated(date: string): void {
  const next = readCelebrateDates()
  next.add(date)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
}

export function clearDateCelebrated(date: string): void {
  const next = readCelebrateDates()
  next.delete(date)
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
}
