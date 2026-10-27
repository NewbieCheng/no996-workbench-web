import type { SocialStudioBrief, SocialStudioPlatform } from './creative/social-studio-brief-types'
import type { SocialContentMode } from './studio-types'

const STORAGE_KEY = 'no996-social-studio-saved'

export type SavedStudioArticle = {
  id: string
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  title: string
  content: string
  summary?: string
  brief: SocialStudioBrief
  savedAt: number
}

function readAll(): SavedStudioArticle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedStudioArticle[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items: SavedStudioArticle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function saveStudioArticle(input: Omit<SavedStudioArticle, 'id' | 'savedAt'>): SavedStudioArticle {
  const record: SavedStudioArticle = {
    ...input,
    id: crypto.randomUUID(),
    savedAt: Date.now(),
  }
  const items = readAll().filter(
    (item) => !(item.platform === record.platform && item.title === record.title && item.savedAt > Date.now() - 2000),
  )
  writeAll([record, ...items].slice(0, 50))
  return record
}
