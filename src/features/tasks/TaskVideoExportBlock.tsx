import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'

type Props = {
  task: WorkbenchTaskRecord
  layout?: 'compact' | 'full'
}

export function TaskVideoExportBlock({ task, layout = 'full' }: Props) {
  const { t } = useTranslation('workbench')
  const { getVideoExportDownloadUrl, getVideoExportFileName } = useWorkbenchTaskActions()
  const [downloadUrl, setDownloadUrl] = useState('')
  const [fileName, setFileName] = useState('video.mp4')

  useEffect(() => {
    if (task.kind !== 'video_factory_export' || task.status !== 'succeeded') {
      setDownloadUrl('')
      return
    }
    let revoked: string | null = null
    void Promise.all([getVideoExportDownloadUrl(task), getVideoExportFileName(task)]).then(
      ([url, name]) => {
        if (!url) return
        revoked = url
        setDownloadUrl(url)
        setFileName(name)
      },
    )
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [task, getVideoExportDownloadUrl, getVideoExportFileName])

  if (!downloadUrl) return null

  return (
    <div className="wb-task-drawer-preview__video-export" data-layout={layout}>
      <a className="wb-task-drawer-preview__download" href={downloadUrl} download={fileName}>
        {t('taskVideoExportDownload')}
      </a>
    </div>
  )
}
