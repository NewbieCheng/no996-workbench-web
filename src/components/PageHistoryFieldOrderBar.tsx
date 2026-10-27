import { useMemo, useState } from 'react'
import { GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { buildDefaultTaskRecordFields } from '../features/tasks/task-record-fields'

const LABEL_BY_ID = new Map(
  buildDefaultTaskRecordFields().map((f) => [f.id, f.label] as const),
)

type Props = {
  order: readonly string[]
  onMove: (fromId: string, toId: string) => void
  onReset: () => void
}

export function PageHistoryFieldOrderBar({ order, onMove, onReset }: Props) {
  const { t } = useTranslation('workbench')
  const [dragId, setDragId] = useState<string | null>(null)
  const labels = useMemo(() => order.map((id) => ({ id, label: LABEL_BY_ID.get(id) ?? id })), [order])

  return (
    <div className="wb-page-history-field-order" aria-label={t('pageHistoryFieldOrderAria')}>
      <span className="wb-page-history-field-order__label">{t('pageHistoryFieldOrderLabel')}</span>
      <ul className="wb-page-history-field-order__list">
        {labels.map(({ id, label }) => (
          <li key={id}>
            <button
              type="button"
              className="wb-page-history-field-order__chip"
              draggable
              onDragStart={() => setDragId(id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId && dragId !== id) onMove(dragId, id)
                setDragId(null)
              }}
            >
              <GripVertical size={12} aria-hidden="true" />
              {label}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="wb-page-history-field-order__reset" onClick={onReset}>
        {t('pageHistoryFieldOrderReset')}
      </button>
    </div>
  )
}
