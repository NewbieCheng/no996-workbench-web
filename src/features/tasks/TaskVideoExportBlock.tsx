import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RotateCcw } from 'lucide-react'
import { Button, buttonVariants } from '@no996/ui/button'
import { cn } from '@no996/ui/utils'
import { manageDownloadUrl } from '../../services/workbench-tasks/managed-download-url'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'

type Props = {
  task: WorkbenchTaskRecord
  layout?: 'compact' | 'full'
  className?: string
}

export function TaskVideoExportBlock({ task, layout = 'full', className }: Props) {
  const { t } = useTranslation('workbench')
  const { getVideoExportDownloadUrl, getVideoExportFileName, retryVideoFactoryExport } =
    useWorkbenchTaskActions()
  const [download, setDownload] = useState<{ key: string; url: string; name: string } | null>(null)
  const key = `${task.id}:${task.blobId ?? ''}:${task.status}`

  useEffect(() => {
    if (task.kind !== 'video_factory_export' || task.status !== 'succeeded') return
    let name = 'video.mp4'
    return manageDownloadUrl(async () => {
      name = await getVideoExportFileName(task)
      return getVideoExportDownloadUrl(task)
    }, (url) => setDownload({ key, url, name }))
  }, [task.id, task.kind, task.status, task.blobId, task.payloadId, task.meta?.fileName, task.title, getVideoExportDownloadUrl, getVideoExportFileName])

  if (task.kind !== 'video_factory_export') return null

  if (task.status === 'failed') {
    return (
      <div className={cn('wb-task-drawer-preview__video-export', className)} data-layout={layout}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="wb-task-drawer-preview__download"
          onClick={() => void retryVideoFactoryExport(task.id)}
        >
          <RotateCcw size={14} aria-hidden />
          {t('taskVideoExportRetry')}
        </Button>
      </div>
    )
  }

  if (task.status !== 'succeeded' || download?.key !== key || !download.url) return null

  return (
    <div
      className={cn('wb-task-drawer-preview__video-export', className)}
      data-layout={layout}
    >
      <a
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'wb-task-drawer-preview__download',
        )}
        href={download.url}
        download={download.name}
      >
        <Download size={14} aria-hidden />
        {t('taskVideoExportDownload')}
      </a>
    </div>
  )
}
