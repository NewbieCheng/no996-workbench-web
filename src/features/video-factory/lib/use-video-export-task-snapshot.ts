import { useEffect, useMemo, useState } from 'react'
import type { ExportTaskSnapshot } from '@no996/video-editor/panels/export/ExportPanel.tsx'
import { createIndexedDbWorkbenchTaskRepository } from '../../../services/workbench-tasks/idb-repository'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../../services/workbench-tasks'
import type { WorkbenchTaskRecord } from '../../../services/workbench-tasks/types'
import { resolveVideoExportDownloadUrl } from '../../../services/workbench-tasks/video-export-download-url'
import { manageDownloadUrl } from '../../../services/workbench-tasks/managed-download-url'

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
  const [download, setDownload] = useState<{ key: string; url: string } | null>(null)
  const downloadKey = `${activeTaskId ?? ''}:${exportTasks.find((t) => t.id === activeTaskId)?.blobId ?? ''}:${exportTasks.find((t) => t.id === activeTaskId)?.status ?? ''}`

  const task = useMemo(
    () => (activeTaskId ? exportTasks.find((t) => t.id === activeTaskId) : undefined),
    [exportTasks, activeTaskId],
  )

  useEffect(() => {
    if (!task || task.status !== 'succeeded' || !task.blobId) return
    const repo = createIndexedDbWorkbenchTaskRepository()
    return manageDownloadUrl(
      () => resolveVideoExportDownloadUrl(repo, task),
      (url) => setDownload({ key: downloadKey, url }),
    )
  }, [task?.id, task?.status, task?.blobId])

  const snapshot = useMemo(
    () =>
      mapTaskToSnapshot(
        task,
        download?.key === downloadKey ? download.url : null,
        () => {
          if (activeTaskId) void cancelTask(activeTaskId)
        },
        () => {
          if (!activeTaskId) return
          void retryVideoFactoryExport(activeTaskId).then((nextId) => onActiveTaskIdChange?.(nextId))
        },
      ),
    [task, download, downloadKey, activeTaskId, cancelTask, retryVideoFactoryExport, onActiveTaskIdChange],
  )

  return { task, snapshot }
}
