import type {
  WorkbenchBridgeCollectedItem,
  WorkbenchBridgeKeywordCaptureFilters,
} from '../../../services/extension/workbench-bridge-contract'

const STORAGE_KEY = 'no996-material-capture-session'

export type MaterialCaptureMode = 'link' | 'keyword'

export type MaterialCaptureSession = {
  id: string
  platform: 'xiaohongshu'
  mode: MaterialCaptureMode
  query?: string
  filters?: WorkbenchBridgeKeywordCaptureFilters
  status: 'idle' | 'running' | 'done' | 'error'
  progress: { done: number; total: number }
  items: WorkbenchBridgeCollectedItem[]
  error?: string
  updatedAt: number
}

export function createEmptySession(mode: MaterialCaptureMode): MaterialCaptureSession {
  return {
    id: crypto.randomUUID(),
    platform: 'xiaohongshu',
    mode,
    status: 'idle',
    progress: { done: 0, total: 0 },
    items: [],
    updatedAt: Date.now(),
  }
}

export function readMaterialCaptureSession(): MaterialCaptureSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MaterialCaptureSession
    if (!parsed?.id || !Array.isArray(parsed.items)) return null
    return parsed
  } catch {
    return null
  }
}

/** 每次新抓取整包替换，仅保留最近一次会话 */
export function writeMaterialCaptureSession(session: MaterialCaptureSession): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...session, updatedAt: Date.now() }))
}

export function clearMaterialCaptureSession(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function mergeItemIntoSession(
  session: MaterialCaptureSession,
  item: WorkbenchBridgeCollectedItem,
): MaterialCaptureSession {
  const exists = session.items.some((row) => row.url === item.url)
  const items = exists
    ? session.items.map((row) => (row.url === item.url ? item : row))
    : [...session.items, item]
  return {
    ...session,
    items,
    progress: { done: items.length, total: Math.max(session.progress.total, items.length) },
    status: 'done',
    updatedAt: Date.now(),
  }
}
