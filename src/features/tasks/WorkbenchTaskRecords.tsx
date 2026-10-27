import { useState, type ReactNode } from 'react'
import { GripVertical, History } from 'lucide-react'
import { cn } from '@no996/ui/utils'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskModuleLabel } from '../../services/workbench-tasks/task-display'
import { taskStatusLabel } from './task-labels'
import { formatTaskTimeShort } from './task-time'
import { TaskRecordLayoutContext, useTaskRecordLayout } from './task-record-layout-context'
import { usePageHistoryFieldOrderActions } from '../../components/page-history-layout'
import {
  buildDefaultTaskRecordFields,
  orderTaskRecordFields,
  type WorkbenchTaskRecordField,
} from './task-record-fields'

export type WorkbenchTaskRecordLayout = 'list' | 'cards'

export type WorkbenchTaskRecordItemProps = {
  task: WorkbenchTaskRecord
  selected?: boolean
  showStatus?: boolean
  onActivate?: () => void
  extra?: ReactNode
  actions: ReactNode
  actionsStacked?: boolean
  /** 列表模式表格列；不传则使用默认列。 */
  fields?: WorkbenchTaskRecordField[]
  /** 与 fields 联用，按用户调整后的顺序展示。 */
  fieldOrder?: readonly string[]
}

export function WorkbenchTaskRecordItem({
  task,
  selected = false,
  showStatus = true,
  onActivate,
  extra,
  actions,
  actionsStacked = false,
  fields,
  fieldOrder,
}: WorkbenchTaskRecordItemProps) {
  const layout = useTaskRecordLayout()
  const resolvedFields = orderTaskRecordFields(
    fields ?? buildDefaultTaskRecordFields({ showStatus }),
    fieldOrder ?? fields?.map((field) => field.id) ?? [],
  )

  if (layout === 'list') {
    return (
      <>
        <tr className="wb-task-table__row" data-selected={selected ? 'true' : undefined}>
          {resolvedFields.map((field) => {
            const visible = !field.when || field.when(task)
            const value = visible ? field.render(task) : '—'
            return (
              <td key={field.id} data-field={field.id}>
                {field.id === 'title' && onActivate ? (
                  <button
                    type="button"
                    className="wb-task-table__open"
                    onClick={onActivate}
                    aria-current={selected ? 'true' : undefined}
                  >
                    {value}
                  </button>
                ) : value}
              </td>
            )
          })}
          <td className="wb-task-table__actions-cell">
            <div className={cn('wb-task-records__actions', actionsStacked && 'wb-task-records__actions--stack')}>
              {actions}
            </div>
          </td>
        </tr>
        {task.errorMessage || extra ? (
          <tr className="wb-task-table__detail-row">
            <td colSpan={resolvedFields.length + 1}>
              {task.errorMessage ? <p className="wb-task-records__error">{task.errorMessage}</p> : null}
              {extra}
            </td>
          </tr>
        ) : null}
      </>
    )
  }

  const cardContent = (
    <>
      <WorkbenchTaskRecordCardContent task={task} showStatus={showStatus} />
      {extra}
    </>
  )

  return (
    <li
      className="wb-task-records__item"
      data-selected={selected ? 'true' : undefined}
      data-interactive={onActivate ? 'true' : undefined}
      data-density="card"
    >
      <div className="wb-task-records__body">
        {onActivate ? (
          <button
            type="button"
            className="wb-task-records__hit"
            onClick={onActivate}
            aria-current={selected ? 'true' : undefined}
          >
            {cardContent}
          </button>
        ) : (
          cardContent
        )}
      </div>
      <div
        className={cn('wb-task-records__actions', actionsStacked && 'wb-task-records__actions--stack')}
      >
        {actions}
      </div>
    </li>
  )
}

function WorkbenchTaskRecordCardContent({
  task,
  showStatus,
}: {
  task: WorkbenchTaskRecord
  showStatus: boolean
}) {
  return (
    <>
      <div className="wb-task-records__head">
        <h4 className="wb-task-records__title">{task.title}</h4>
        <time className="wb-task-records__time" dateTime={new Date(task.createdAt).toISOString()}>
          {formatTaskTimeShort(task.createdAt)}
        </time>
      </div>
      <div className="wb-task-records__meta">
        <span className="wb-task-records__tag" data-variant="module">{taskModuleLabel(task)}</span>
        {task.subtitle ? (
          <span className="wb-task-records__tag" data-variant="context">{task.subtitle}</span>
        ) : null}
        {showStatus ? (
          <span className="wb-task-records__status" data-status={task.status}>
            {taskStatusLabel(task.status)}
          </span>
        ) : null}
      </div>
      {task.errorMessage ? <p className="wb-task-records__error">{task.errorMessage}</p> : null}
    </>
  )
}

export type WorkbenchTaskRecordListProps = {
  items: WorkbenchTaskRecord[]
  layout?: WorkbenchTaskRecordLayout
  className?: string
  emptyHint?: string
  emptyTitle?: string
  actionsLabel?: string
  tableAriaLabel?: string
  maxItems?: number
  showStatus?: boolean
  fields?: WorkbenchTaskRecordField[]
  fieldOrder?: readonly string[]
  renderItem: (task: WorkbenchTaskRecord) => ReactNode
}

export function WorkbenchTaskRecordList({
  items,
  layout = 'cards',
  className,
  emptyHint,
  emptyTitle = '暂无记录',
  actionsLabel = '操作',
  tableAriaLabel = '任务历史表格',
  maxItems,
  showStatus = true,
  fields,
  fieldOrder,
  renderItem,
}: WorkbenchTaskRecordListProps) {
  const list = maxItems != null ? items.slice(0, maxItems) : items
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const fieldOrderActions = usePageHistoryFieldOrderActions()
  const resolvedFields = orderTaskRecordFields(
    fields ?? buildDefaultTaskRecordFields({ showStatus }),
    fieldOrder ?? fields?.map((field) => field.id) ?? [],
  )

  if (!list.length) {
    return (
      <div className="wb-task-records__empty-state" role="status">
        <span className="wb-task-records__empty-icon" aria-hidden="true"><History size={19} /></span>
        <h3>{emptyTitle}</h3>
        {emptyHint ? <p>{emptyHint}</p> : null}
      </div>
    )
  }

  return (
    <TaskRecordLayoutContext.Provider value={layout}>
      {layout === 'list' ? (
        <div className="wb-task-table-scroll" tabIndex={0} aria-label={tableAriaLabel}>
          <table className={cn('wb-task-records wb-task-records--table', className)} data-layout="list">
            <thead>
              <tr>
                {resolvedFields.map((field) => (
                  <th key={field.id} scope="col">
                    <div className="wb-task-table__heading">
                      <button
                        type="button"
                        className="wb-task-table__reorder"
                        draggable
                        aria-label={`调整“${field.label}”列顺序，可拖动或使用方向键`}
                        onDragStart={(event) => {
                          setDraggedField(field.id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', field.id)
                        }}
                        onDragEnd={() => setDraggedField(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault()
                          const fromId = draggedField ?? event.dataTransfer.getData('text/plain')
                          if (fromId && fromId !== field.id) fieldOrderActions?.moveField(fromId, field.id)
                          setDraggedField(null)
                        }}
                        onKeyDown={(event) => {
                          const index = resolvedFields.findIndex((item) => item.id === field.id)
                          if (event.key === 'ArrowLeft' && index > 0) {
                            event.preventDefault()
                            fieldOrderActions?.moveField(field.id, resolvedFields[index - 1].id)
                          } else if (event.key === 'ArrowRight' && index < resolvedFields.length - 1) {
                            event.preventDefault()
                            fieldOrderActions?.moveField(resolvedFields[index + 1].id, field.id)
                          }
                        }}
                      >
                        <GripVertical size={13} aria-hidden="true" />
                      </button>
                      <span>{field.label}</span>
                    </div>
                  </th>
                ))}
                <th scope="col" className="wb-task-table__actions-heading">{actionsLabel}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((task) => renderItem(task))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={cn('wb-task-records', className)} data-layout="cards">
          {list.map((task) => renderItem(task))}
        </ul>
      )}
    </TaskRecordLayoutContext.Provider>
  )
}
