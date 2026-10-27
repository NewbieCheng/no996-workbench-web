import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type DataColumn } from '@no996/ui/data-table'
import { IconActionButton } from '@no996/ui/IconActionButton'
import { EyeIcon, History, Trash2 } from 'lucide-react'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { orderTaskRecordFields, type WorkbenchTaskRecordField } from './task-record-fields'

const SORT_DATA_INDEX: Partial<Record<string, string>> = {
  title: 'title',
  time: 'createdAt',
  status: 'status',
}

type Props = {
  items: WorkbenchTaskRecord[]
  fields: WorkbenchTaskRecordField[]
  fieldOrder?: readonly string[]
  maxItems?: number
  onRemove: (id: string) => void
  onSelect?: (task: WorkbenchTaskRecord) => void
  openLabel?: string
  emptyHint?: string
  emptyTitle?: string
}

export function WorkbenchTaskHistoryDataTable({
  items,
  fields,
  fieldOrder,
  maxItems,
  onRemove,
  onSelect,
  openLabel,
  emptyHint,
  emptyTitle = '暂无记录',
}: Props) {
  const { t } = useTranslation('workbench')
  const list = maxItems != null ? items.slice(0, maxItems) : items
  const orderedFields = orderTaskRecordFields(
    fields,
    fieldOrder ?? fields.map((field) => field.id),
  )
  const resolvedOpenLabel = openLabel ?? t('pageHistoryOpen')

  const columns = useMemo((): DataColumn<WorkbenchTaskRecord>[] => {
    const dataColumns: DataColumn<WorkbenchTaskRecord>[] = orderedFields.map((field) => ({
      title: field.label,
      key: field.id,
      dataIndex: SORT_DATA_INDEX[field.id],
      width: field.id === 'time' ? 132 : field.id === 'status' ? 100 : undefined,
      ellipsis: field.id === 'title' || field.id === 'context',
      sortable: Boolean(SORT_DATA_INDEX[field.id]),
      render: (_, task) => {
        if (field.when && !field.when(task)) return '—'
        return field.render(task)
      },
    }))

    dataColumns.push({
      title: t('pageHistoryActions'),
      key: 'actions',
      isActions: true,
      width: 88,
      render: (_, task) => (
        <div className="flex gap-1">
          {onSelect ? (
            <IconActionButton
              icon={<EyeIcon className="size-3.5" />}
              label={resolvedOpenLabel}
              onClick={() => onSelect(task)}
            />
          ) : null}
          <IconActionButton
            icon={<Trash2 className="size-3.5" />}
            label={t('taskDrawerDelete')}
            variant="danger"
            onClick={() => void onRemove(task.id)}
          />
        </div>
      ),
    })

    return dataColumns
  }, [onRemove, onSelect, orderedFields, resolvedOpenLabel, t])

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
    <DataTable
      rowKey="id"
      columns={columns}
      dataSource={list}
      emptyText={emptyHint ?? emptyTitle}
      resizable
      reorderable
      defaultSort={{ key: 'time', direction: 'desc' }}
    />
  )
}
