import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskDrawerContext, taskDrawerSubject, truncateTaskDrawerText } from './task-drawer-label'

/** 展开正文展示上限（完整文案在 title 属性） */
export const TASK_DRAWER_DETAIL_BODY_MAX = 96
export const TASK_DRAWER_DETAIL_SCRIPT_MAX = 120

function isFailed(task: WorkbenchTaskRecord): boolean {
  return task.status === 'failed' || task.status === 'cancelled'
}

/** 展开区主文案（上） */
export function taskDrawerDetailPrimary(task: WorkbenchTaskRecord): string {
  if (isFailed(task)) {
    const err = task.errorMessage?.trim()
    if (err) return err
    return taskDrawerSubject(task)
  }

  switch (task.kind) {
    case 'voice_tts':
    case 'ip_video_audio':
      return task.title.trim()
    case 'voice_clone':
      return (
        task.meta?.display_name?.trim() ||
        task.title.replace(/^声音克隆 ·\s*/, '').trim() ||
        task.title.trim()
      )
    default:
      break
  }

  const title = task.title.trim()
  const subject = taskDrawerSubject(task)
  if (title) return title
  return subject
}

export function taskDrawerDetailPrimaryDisplay(task: WorkbenchTaskRecord): {
  full: string
  display: string
} {
  const full = taskDrawerDetailPrimary(task)
  const max =
    task.kind === 'voice_tts' || task.kind === 'ip_video_audio'
      ? TASK_DRAWER_DETAIL_SCRIPT_MAX
      : TASK_DRAWER_DETAIL_BODY_MAX
  const display = truncateTaskDrawerText(full, max)
  return { full, display }
}

export function taskDrawerDetailBodyVariant(task: WorkbenchTaskRecord): 'error' | 'script' | 'hint' {
  if (taskDrawerDetailPrimaryIsError(task)) return 'error'
  if (task.kind === 'voice_tts' || task.kind === 'ip_video_audio') return 'script'
  return 'hint'
}

/** 展开区底栏附加说明（音色名、首次生成等） */
export function taskDrawerDetailFootNotes(task: WorkbenchTaskRecord): string[] {
  const notes: string[] = []
  const subject = taskDrawerSubject(task)
  const context = taskDrawerContext(task)

  if (task.kind === 'voice_tts' || task.kind === 'ip_video_audio') {
    if (subject) notes.push(subject)
    return notes
  }

  if (task.kind === 'video_factory_export') {
    const res = task.meta?.resolution === '1080p' ? '1080P' : task.meta?.resolution === '720p' ? '720P' : ''
    if (res) notes.push(res)
    if (task.status === 'running' || task.status === 'queued') {
      const stage = task.meta?.stage?.trim()
      if (stage) notes.push(stage)
      const pct = task.meta?.progress
      if (pct) notes.push(`${pct}%`)
    }
    return notes
  }

  if (task.kind === 'voice_clone') {
    const status = task.subtitle?.trim()
    if (status) notes.push(status)
    if (task.meta?.points_charged && task.meta.points_charged !== '0') {
      notes.push(`已扣 ${Number(task.meta.points_charged).toLocaleString('zh-CN')} 积分`)
    }
    return notes
  }

  if (task.kind === 'digital_human_retalk') {
    return []
  }

  const failed = isFailed(task)
  if (subject && (!failed || task.kind === 'persona_generate')) notes.push(subject)
  if (context && context !== subject) notes.push(context)

  return notes
}

export function taskDrawerDetailPrimaryIsError(task: WorkbenchTaskRecord): boolean {
  return isFailed(task) && Boolean(task.errorMessage?.trim())
}
