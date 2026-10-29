import { taskModuleLabel } from '../../services/workbench-tasks/task-display'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'

export type TaskCenterStatusFilter = 'all' | 'active' | 'done' | 'failed'

export type TaskCenterKindFilter =
  | 'all'
  | 'voice'
  | 'ip_video'
  | 'script'
  | 'titles'
  | 'persona'
  | 'other'

export function taskMatchesStatusFilter(
  task: WorkbenchTaskRecord,
  status: TaskCenterStatusFilter,
): boolean {
  if (status === 'all') return true
  if (status === 'active') return task.status === 'queued' || task.status === 'running'
  if (status === 'done') return task.status === 'succeeded'
  return task.status === 'failed' || task.status === 'cancelled'
}

export function taskMatchesKindFilter(task: WorkbenchTaskRecord, kind: TaskCenterKindFilter): boolean {
  if (kind === 'all') return true
  if (kind === 'voice') {
    return (
      task.kind === 'voice_tts' ||
      task.kind === 'voice_clone' ||
      task.kind === 'voice_dub_advanced'
    )
  }
  if (kind === 'ip_video') return task.kind === 'ip_video_create' || task.kind === 'ip_video_audio' || task.kind === 'video_factory_export'
  if (kind === 'script') return task.kind === 'script_generate'
  if (kind === 'titles') return task.kind === 'titles_generate'
  if (kind === 'persona') return task.kind === 'persona_generate'
  return (
    task.kind === 'text_sections' ||
    task.kind === 'social_compose' ||
    task.kind === 'source_create' ||
    task.kind === 'moments_plan' ||
    task.kind === 'moments_copy'
  )
}

export function taskMatchesQuery(task: WorkbenchTaskRecord, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [
    task.title,
    task.subtitle ?? '',
    taskModuleLabel(task),
    task.errorMessage ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}

export function filterTaskCenterTasks(
  tasks: WorkbenchTaskRecord[],
  status: TaskCenterStatusFilter,
  kind: TaskCenterKindFilter,
  query: string,
): WorkbenchTaskRecord[] {
  return tasks.filter(
    (task) =>
      taskMatchesStatusFilter(task, status) &&
      taskMatchesKindFilter(task, kind) &&
      taskMatchesQuery(task, query),
  )
}

export function countTasksByStatus(tasks: WorkbenchTaskRecord[]): Record<TaskCenterStatusFilter, number> {
  return {
    all: tasks.length,
    active: tasks.filter((t) => taskMatchesStatusFilter(t, 'active')).length,
    done: tasks.filter((t) => taskMatchesStatusFilter(t, 'done')).length,
    failed: tasks.filter((t) => taskMatchesStatusFilter(t, 'failed')).length,
  }
}
