import { useCallback, useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import {
  useWorkbenchTaskActions,
  type DigitalHumanRetalkPayload,
  type WorkbenchTaskRecord,
} from '../../services/workbench-tasks'

const RETALK_STATUS_LABELS: Record<string, string> = {
  QUEUED: '远端排队中',
  SUBMITTED: '已提交，正在启动',
  RUNNING: '正在生成',
  SUCCEEDED: '生成完成',
  FAILED: '生成失败',
  CANCELED: '已取消',
  EXPIRED: '任务不存在或已过期，请重新提交',
}

export function useDigitalHumanRetalkPayload(task: WorkbenchTaskRecord) {
  const { getPayload } = useWorkbenchTaskActions()
  const [payload, setPayload] = useState<DigitalHumanRetalkPayload | null>(null)

  const reload = useCallback(() => {
    if (task.kind !== 'digital_human_retalk') return
    void getPayload(task.payloadId)
      .then(value => setPayload(value as DigitalHumanRetalkPayload | null))
      .catch(() => undefined)
  }, [task, getPayload])

  useEffect(() => {
    if (task.kind !== 'digital_human_retalk') {
      setPayload(null)
      return
    }
    reload()
  }, [task.kind, task.payloadId, task.status, task.finishedAt, reload])

  return { payload, reload }
}

export function retalkDrawerStatusLabel(
  task: WorkbenchTaskRecord,
  payload: DigitalHumanRetalkPayload | null,
  t: TFunction<'workbench'>,
): string | null {
  const status = payload?.status
  if (status) {
    return t(`retalkStatus${status}`, { defaultValue: RETALK_STATUS_LABELS[status] ?? status })
  }
  if (payload?.submissionUncertain) {
    return t('retalkSubmissionUncertain', { defaultValue: '提交结果待确认，请勿重复创建任务。' })
  }
  if (task.status === 'queued') {
    return t('taskQueued', { defaultValue: '等待提交' })
  }
  return null
}

export function retalkDrawerBillingNote(
  task: WorkbenchTaskRecord,
  payload: DigitalHumanRetalkPayload | null,
): string | null {
  const isSuccess = payload?.status === 'SUCCEEDED' || task.status === 'succeeded'
  if (!isSuccess) return null
  if (!(task.errorMessage || payload?.result?.error)) return null
  return '成片已生成完毕；计费结算审核记录中。'
}
