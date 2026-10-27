export type XhsWorkMode = 'wizard' | 'advanced'

const STORAGE_KEY = 'no996.xiaohongshu.workMode'

export function readXhsWorkMode(): XhsWorkMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'wizard' || raw === 'advanced') return raw
  } catch {
    // ignore
  }
  return 'wizard'
}

export function writeXhsWorkMode(mode: XhsWorkMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}
