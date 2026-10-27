import type { ReactNode } from 'react'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskModuleLabel } from '../../services/workbench-tasks/task-display'
import { taskStatusLabel } from './task-labels'
import { formatTaskTimeShort } from './task-time'

/** 列表模式下的表格字段（可自定义顺序与增删） */
export type WorkbenchTaskRecordField = {
  id: string
  label: string
  render: (task: WorkbenchTaskRecord) => ReactNode
  /** 为 false 时该条记录不展示此字段 */
  when?: (task: WorkbenchTaskRecord) => boolean
}

export const DEFAULT_TASK_RECORD_FIELD_IDS = [
  'title',
  'module',
  'context',
  'status',
  'time',
] as const

export function buildDefaultTaskRecordFields(options?: { showStatus?: boolean }): WorkbenchTaskRecordField[] {
  const showStatus = options?.showStatus ?? true
  return [
    {
      id: 'title',
      label: '标题',
      render: (task) => task.title,
    },
    {
      id: 'module',
      label: '功能',
      render: (task) => taskModuleLabel(task),
    },
    {
      id: 'context',
      label: '上下文',
      when: (task) => Boolean(task.subtitle?.trim()),
      render: (task) => task.subtitle ?? '—',
    },
    {
      id: 'status',
      label: '状态',
      when: () => showStatus,
      render: (task) => (
        <span className="wb-task-records__status" data-status={task.status}>
          {taskStatusLabel(task.status)}
        </span>
      ),
    },
    {
      id: 'time',
      label: '提交时间',
      render: (task) => (
        <time dateTime={new Date(task.createdAt).toISOString()} className="wb-task-records__field-time">
          {formatTaskTimeShort(task.createdAt)}
        </time>
      ),
    },
  ]
}

export function orderTaskRecordFields(
  fields: WorkbenchTaskRecordField[],
  order: readonly string[],
): WorkbenchTaskRecordField[] {
  const map = new Map(fields.map((f) => [f.id, f]))
  const ordered: WorkbenchTaskRecordField[] = []
  for (const id of order) {
    const field = map.get(id)
    if (field) ordered.push(field)
  }
  for (const field of fields) {
    if (!order.includes(field.id)) ordered.push(field)
  }
  return ordered
}
