import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { apiErrorMessage } from '../../api/client'
import { toastError } from '../../lib/toast'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { useDigitalHumanRetalkPayload } from './task-retalk-drawer'

export function TaskRetalkPreview({ task }: { task: WorkbenchTaskRecord }) {
  const { t } = useTranslation('workbench')
  const { refreshRetalkTask, retryDigitalHumanRetalk } = useWorkbenchTaskActions()
  const { payload, reload } = useDigitalHumanRetalkPayload(task)
  const [busy, setBusy] = useState(false)
  const status = payload?.status
  const active = task.status === 'queued' || task.status === 'running'
  const isSuccess = status === 'SUCCEEDED' || task.status === 'succeeded'
  const errorText = task.errorMessage || payload?.observationError || payload?.result?.error

  async function refresh() {
    setBusy(true)
    try {
      if (payload?.taskId) await refreshRetalkTask(task.id)
      else await retryDigitalHumanRetalk(task.id)
      reload()
    } catch (e) {
      toastError(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const showError = Boolean(errorText) && (!isSuccess || payload?.observationError)
  const showQueue =
    status === 'QUEUED' && payload?.result?.queue_position != null
  const showRefresh = active && (payload?.taskId || payload?.submissionUncertain)

  if (!showError && !showQueue && !showRefresh) return null

  return (
    <div className="wb-task-drawer-preview">
      {showError ? <p className="wb-task-drawer-preview__error">{errorText}</p> : null}
      {showQueue ? (
        <p className="wb-task-drawer-preview__hint">
          {t('retalkQueuePosition', {
            defaultValue: '排队位置：{{position}}',
            position: payload!.result!.queue_position,
          })}
        </p>
      ) : null}
      {showRefresh ? (
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>
          {payload?.taskId
            ? t('retalkRefresh', { defaultValue: '刷新远端状态' })
            : t('retalkConfirmSubmission', { defaultValue: '使用原提交标识确认' })}
        </Button>
      ) : null}
    </div>
  )
}
