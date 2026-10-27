import { taskModuleLabel } from '../../services/workbench-tasks/task-display'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskDrawerContext, taskDrawerSubject } from './task-drawer-label-core'

export { TASK_DRAWER_SUBJECT_MAX, taskDrawerContext, taskDrawerSubject, truncateTaskDrawerText } from './task-drawer-label-core'

/** 板块：属于哪一功能 */
export function taskDrawerModule(task: WorkbenchTaskRecord): string {
  return taskModuleLabel(task)
}

/** @deprecated 使用 taskDrawerSubject */
export function taskDrawerPrimaryLabel(task: WorkbenchTaskRecord): string {
  return taskDrawerSubject(task)
}

export function taskDrawerRowTitle(task: WorkbenchTaskRecord): string {
  const module = taskDrawerModule(task)
  const subject = taskDrawerSubject(task)
  const context = taskDrawerContext(task)
  if (context && context !== subject) return `${module} · ${subject} · ${context}`
  return `${module} · ${subject}`
}
