import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'

export const TASK_DRAWER_SUBJECT_MAX = 48

export function truncateTaskDrawerText(text: string, max = TASK_DRAWER_SUBJECT_MAX): string {
  const t = text.trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** 主体：用户要找回的产物 / 主题 */
export function taskDrawerSubject(task: WorkbenchTaskRecord): string {
  const title = task.title.trim()
  const sub = task.subtitle?.trim() ?? ''

  switch (task.kind) {
    case 'persona_generate':
      return title || '人设生成'
    case 'voice_tts':
    case 'ip_video_audio':
      return sub || truncateTaskDrawerText(title)
    case 'voice_clone': {
      const fromTitle = title.replace(/^声音克隆 ·\s*/, '').trim()
      return fromTitle || task.meta?.display_name?.trim() || truncateTaskDrawerText(title)
    }
    case 'voice_dub_advanced':
    case 'titles_generate':
    case 'moments_plan':
    case 'moments_copy':
    case 'script_generate':
    case 'text_sections':
    case 'source_create':
      return title
    default:
      return title || sub
  }
}

/** 语境：操作类型 / 参数摘要（可选） */
export function taskDrawerContext(task: WorkbenchTaskRecord): string | undefined {
  const title = task.title.trim()
  const sub = task.subtitle?.trim() ?? ''
  const subject = taskDrawerSubject(task)

  switch (task.kind) {
    case 'persona_generate':
      return sub || undefined
    case 'voice_tts':
    case 'ip_video_audio':
    case 'voice_clone': {
      if (task.kind === 'voice_clone' && title.startsWith('声音克隆 ·')) {
        return title.replace(/^声音克隆 ·\s*/, '').trim() || undefined
      }
      if (title && title !== subject) return truncateTaskDrawerText(title)
      return undefined
    }
    case 'voice_dub_advanced':
    case 'titles_generate':
    case 'moments_plan':
    case 'moments_copy':
    case 'script_generate':
    case 'text_sections':
    case 'source_create':
      return sub || undefined
    default:
      if (sub && sub !== subject) return sub
      return undefined
  }
}
