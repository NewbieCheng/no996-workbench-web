import { useEffect, useMemo, useState } from 'react'
import type { ExportTaskSnapshot } from '@no996/video-editor/panels/export/ExportPanel.tsx'
import { createIndexedDbWorkbenchTaskRepository } from '../../../services/workbench-tasks/idb-repository'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../../services/workbench-tasks'
import type { WorkbenchTaskRecord } from '../../../services/workbench-tasks/types'

function mapTaskToSnapshot(
  task: WorkbenchTaskRecord | undefined,
  downloadUrl: string | null,
  onCancel: () => void,
  onRetry: () => void,
): ExportTaskSnapshot | null {
  if (!task) return null
  const progress = task.meta?.progress ? Number(task.meta.progress) : undefined
  return {
    status: task.status,
    progress: Number.isFinite(progress) ? progress : undefined,
    stage: task.meta?.stage,
    downloadUrl: task.status === 'succeeded' ? downloadUrl ?? undefined : undefined,
    fileName: task.meta?.fileName,
    errorMessage: task.errorMessage,
    onCancel: task.status === 'queued' || task.status === 'running' ? onCancel : undefined,
    onRetry: task.status === 'failed' ? onRetry : undefined,
  }
}

export function useVideoExportTaskSnapshot(
  activeTaskId: string | null,
  onActiveTaskIdChange?: (id: string) => void,
) {
  const exportTasks = useWorkbenchTasks({ kind: 'video_factory_export' })
  const { cancelTask, retryVideoFactoryExport } = useWorkbenchTaskActions()
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)

  const task = useMemo(
    () => (activeTaskId ? exportTasks.find((t) => t.id === activeTaskId) : undefined),
    [exportTasks, activeTaskId],
  )

  useEffect(() => {
    let revokedUrl: string | null = null
    if (!task || task.status !== 'succeeded' || !task.blobId) {
      setDownloadUrl(null)
      return
    }
    const repo = createIndexedDbWorkbenchTaskRepository()
    void repo.getBlob(task.blobId).then((rec) => {
      if (!rec) return
      const url = URL.createObjectURL(new Blob([rec.data], { type: rec.mime || 'video/mp4' }))
      revokedUrl = url
      setDownloadUrl(url)
    })
    return () => {
      if (revokedUrl) URL.revokeObjectURL(revokedUrl)
    }
  }, [task?.id, task?.status, task?.blobId])

  const snapshot = useMemo(
    () =>
      mapTaskToSnapshot(
        task,
        downloadUrl,
        () => {
          if (activeTaskId) void cancelTask(activeTaskId)
        },
        () => {
          if (!activeTaskId) return
          void retryVideoFactoryExport(activeTaskId).then((nextId) => onActiveTaskIdChange?.(nextId))
        },
      ),
    [task, downloadUrl, activeTaskId, cancelTask, retryVideoFactoryExport, onActiveTaskIdChange],
  )

  return { task, snapshot }
}
