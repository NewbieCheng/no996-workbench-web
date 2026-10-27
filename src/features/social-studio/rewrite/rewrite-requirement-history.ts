const STORAGE_KEY = 'no996-rewrite-requirement-history'
const MAX_ITEMS = 12

export function readRewriteRequirementHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : []
  } catch {
    return []
  }
}

export function pushRewriteRequirementHistory(text: string): void {
  const value = text.trim()
  if (!value) return
  const prev = readRewriteRequirementHistory().filter((item) => item !== value)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([value, ...prev].slice(0, MAX_ITEMS)))
}
