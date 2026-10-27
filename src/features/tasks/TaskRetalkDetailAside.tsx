import { useTranslation } from 'react-i18next'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import {
  retalkDrawerBillingNote,
  retalkDrawerStatusLabel,
  useDigitalHumanRetalkPayload,
} from './task-retalk-drawer'

export function TaskRetalkDetailAside({ task }: { task: WorkbenchTaskRecord }) {
  const { t } = useTranslation('workbench')
  const { payload } = useDigitalHumanRetalkPayload(task)
  const statusLabel = retalkDrawerStatusLabel(task, payload, t)
  const billingNote = retalkDrawerBillingNote(task, payload)

  if (!statusLabel && !billingNote) return null

  return (
    <div className="wb-task-drawer-card__detail-aside">
      {statusLabel ? <span className="wb-task-drawer-card__detail-aside-status">{statusLabel}</span> : null}
      {billingNote ? <span className="wb-task-drawer-card__detail-aside-note">{billingNote}</span> : null}
    </div>
  )
}
