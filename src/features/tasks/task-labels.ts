import type { WorkbenchTaskRecord, WorkbenchTaskStatus } from '../../services/workbench-tasks'
import { taskModuleLabel } from '../../services/workbench-tasks/task-display'

export function taskKindLabel(task: WorkbenchTaskRecord): string {
  return taskModuleLabel(task)
}

export function taskStatusLabel(status: WorkbenchTaskStatus): string {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '进行中'
    case 'succeeded':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}
