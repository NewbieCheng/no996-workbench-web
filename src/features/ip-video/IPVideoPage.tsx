import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toastError, notifyOperationWarning } from '../../lib/toast'
import {
  Page,
  WorkbenchPageChromeActions,
  WorkbenchToolPageHeaderTools,
} from '../../components/WorkbenchUI'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import { WorkbenchTaskHistory } from '../tasks/WorkbenchTaskHistory'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import { useAuth } from '../../auth/AuthContext'
import { apiErrorMessage } from '../../api/client'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../services/workbench-tasks'
import { TalkWorkspace } from './composition/TalkWorkspace'
import { useCompositionCopy } from './composition/copy'

export default function IPVideoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const creationTaskId = params.get('taskId') ?? undefined
  const { userId } = useAuth()
  const { t } = useTranslation('ipVideo')
  const { copy } = useCompositionCopy()
  const actions = useWorkbenchTaskActions()
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [chromeTarget, setChromeTarget] = useState<HTMLDivElement | null>(null)
  const ownerWarningShown = useRef(false)
  useEffect(() => {
    if (creationTaskId) setPageView('work')
  }, [creationTaskId])
  useEffect(() => {
    if (userId == null || userId <= 0) {
      if (!ownerWarningShown.current) {
        notifyOperationWarning(copy('ownerRequired'), { id: 'ip-video-owner-required', raw: true })
        ownerWarningShown.current = true
      }
    } else ownerWarningShown.current = false
  }, [userId, copy])
  const tasks = useWorkbenchTasks()
  const ipTasks = useMemo(
    () => tasks.filter(item => item.kind === 'ip_video_create' || item.kind === 'ip_video_audio' || (item.kind === 'video_factory_export' && item.meta?.source === 'ip-composition')),
    [tasks],
  )
  const pendingCount = ipTasks.filter(item => item.status === 'queued' || item.status === 'running').length

  return (
    <Page
      title={t('title')}
      description={t('subtitle')}
      moduleId="ip-video"
      defaultWidth={1240}
      minWidth={320}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchToolPageHeaderTools>
          <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyBadge={pendingCount} />
        </WorkbenchToolPageHeaderTools>
      }
      actions={pageView === 'history' ? (
        <WorkbenchPageChromeActions>
          <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
        </WorkbenchPageChromeActions>
      ) : userId != null && userId > 0 ? (
        <WorkbenchPageChromeActions>
          <div ref={setChromeTarget} className="ipt-chrome-slot" />
        </WorkbenchPageChromeActions>
      ) : undefined}
    >
      {pageView === 'history' ? (
        <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
          <WorkbenchTaskHistory
            items={ipTasks}
            onRemove={id => {
              void actions.removeTask(id).catch(error => toastError(apiErrorMessage(error)))
            }}
            onSelect={task => {
              navigate(task.route)
              setPageView('work')
            }}
            emptyHint="暂无 IP 视频创作、配音与导出任务"
          />
        </WorkbenchPageHistoryPanel>
      ) : userId != null && userId > 0 ? (
        <TalkWorkspace
          key={userId}
          owner={userId}
          toolbarTargets={{ chrome: chromeTarget }}
          creationTaskId={creationTaskId}
          sourceProjectId={params.get('digitalHumanProject') ?? undefined}
        />
      ) : null}
    </Page>
  )
}
