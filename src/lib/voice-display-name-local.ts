import { parseApiError } from '../api/errors'

const STORAGE_KEY = 'no996-workbench-voice-display-names'

function readMap(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, string>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function writeLocalVoiceDisplayName(voiceId: string, displayName: string) {
  const map = readMap()
  map[voiceId] = displayName
  writeMap(map)
}

export function mergeLocalVoiceDisplayNames<T extends { voice_id: string; display_name: string }>(
  records: T[],
): T[] {
  const map = readMap()
  if (!Object.keys(map).length) return records
  return records.map(record => {
    const local = map[record.voice_id]
    return local ? { ...record, display_name: local } : record
  })
}

/** 后端尚未发布 PATCH 重命名路由时（常见 404 + endpoint does not exist） */
export function isVoiceRenameEndpointMissing(err: unknown): boolean {
  const parsed = parseApiError(err)
  if (!parsed) return false
  if (parsed.status === 404) return true
  return /endpoint does not exist|route not found|not found/i.test(parsed.message)
}
