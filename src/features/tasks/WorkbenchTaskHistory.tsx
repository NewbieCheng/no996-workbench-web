import { useTranslation } from 'react-i18next'
import { IconActionButton } from '@no996/ui/IconActionButton'
import { EyeIcon, Trash2 } from 'lucide-react'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { usePageHistoryFieldOrder, usePageHistoryLayout } from '../../components/page-history-layout'
import { buildDefaultTaskRecordFields, type WorkbenchTaskRecordField } from './task-record-fields'
import {
  WorkbenchTaskRecordItem,
  WorkbenchTaskRecordList,
  type WorkbenchTaskRecordLayout,
} from './WorkbenchTaskRecords'
import { WorkbenchTaskHistoryDataTable } from './WorkbenchTaskHistoryDataTable'

const HISTORY_COLUMN_LABEL_KEYS: Partial<Record<string,
  | 'pageHistoryColumnTitle'
  | 'pageHistoryColumnModule'
  | 'pageHistoryColumnContext'
  | 'pageHistoryColumnStatus'
  | 'pageHistoryColumnTime'
>> = {
  title: 'pageHistoryColumnTitle',
  module: 'pageHistoryColumnModule',
  context: 'pageHistoryColumnContext',
  status: 'pageHistoryColumnStatus',
  time: 'pageHistoryColumnTime',
}

type Props = {
  items: WorkbenchTaskRecord[]
  onRemove: (id: string) => void
  onSelect?: (task: WorkbenchTaskRecord) => void
  selectedId?: string | null
  openLabel?: string
  emptyHint?: string
  maxItems?: number
  /** 页内历史默认卡片网格；窄容器可传 list */
  layout?: WorkbenchTaskRecordLayout
  /** 列表模式表格列定义（可自定义顺序，配合 fieldOrder / 拖拽持久化） */
  fields?: WorkbenchTaskRecordField[]
  fieldOrder?: readonly string[]
}

export function WorkbenchTaskHistory({
  items,
  onRemove,
  onSelect,
  selectedId,
  openLabel,
  emptyHint,
  maxItems = 12,
  layout: layoutProp = 'cards',
  fields,
  fieldOrder,
}: Props) {
  const { t } = useTranslation('workbench')
  const layoutFromPanel = usePageHistoryLayout()
  const fieldOrderFromPanel = usePageHistoryFieldOrder()
  const layout = layoutFromPanel ?? layoutProp
  const resolvedFieldOrder = fieldOrder ?? fieldOrderFromPanel ?? undefined
  const resolvedFields = (fields ?? buildDefaultTaskRecordFields()).map((field) => {
    const labelKey = HISTORY_COLUMN_LABEL_KEYS[field.id]
    return labelKey ? { ...field, label: t(labelKey) } : field
  })
  const resolvedOpenLabel = openLabel ?? t('pageHistoryOpen')

  const renderActions = (task: WorkbenchTaskRecord) => (
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
  )

  if (layout === 'list') {
    return (
      <WorkbenchTaskHistoryDataTable
        items={items}
        fields={resolvedFields}
        fieldOrder={resolvedFieldOrder}
        maxItems={maxItems}
        onRemove={onRemove}
        onSelect={onSelect}
        openLabel={resolvedOpenLabel}
        emptyHint={emptyHint}
        emptyTitle={t('pageHistoryNoRecords')}
      />
    )
  }

  return (
    <WorkbenchTaskRecordList
      items={items}
      layout="cards"
      emptyHint={emptyHint}
      emptyTitle={t('pageHistoryNoRecords')}
      actionsLabel={t('pageHistoryActions')}
      tableAriaLabel={t('pageHistoryTableAria')}
      fields={resolvedFields}
      fieldOrder={resolvedFieldOrder}
      maxItems={maxItems}
      renderItem={(task) => (
        <WorkbenchTaskRecordItem
          key={task.id}
          task={task}
          selected={selectedId === task.id}
          showStatus
          onActivate={onSelect ? () => onSelect(task) : undefined}
          fields={resolvedFields}
          fieldOrder={resolvedFieldOrder}
          actions={renderActions(task)}
        />
      )}
    />
  )
}
