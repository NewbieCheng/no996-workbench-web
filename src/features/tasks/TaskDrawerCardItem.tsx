import { apiErrorMessage } from '../../api/client'
import { toastError } from '../../lib/toast'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, ChevronUp, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskDrawerRowTitle } from './task-drawer-label'
import { TaskDrawerCardDetail } from './TaskDrawerCardDetail'
import { TaskDrawerRowBody } from './TaskDrawerRowBody'
import { TaskVoiceCopyUpstreamButton, useTaskVoicePlayback } from './TaskVoicePlaybackBlock'

type Props = {
  task: WorkbenchTaskRecord
  onClose: () => void
  showStatus?: boolean
}

export function TaskDrawerCardItem({ task, onClose, showStatus = true }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation('workbench')
  const { removeTask, cancelTask } = useWorkbenchTaskActions()
  const running = task.status === 'queued' || task.status === 'running'
  const canCancel = running && (task.kind !== 'digital_human_retalk' || task.meta?.remote_status === 'QUEUED' || task.status === 'queued')
  const { showCopyUpstream, upstreamUrl } = useTaskVoicePlayback(task)
  const [expanded, setExpanded] = useState(false)

  return (
    <li
      className={`wb-task-drawer-card wb-task-drawer-card--row${expanded ? ' is-expanded' : ''}`}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div className="wb-task-drawer-card__compact">
        <div className="wb-task-drawer-card__main" title={taskDrawerRowTitle(task)}>
          <TaskDrawerRowBody task={task} detailExpanded={expanded} />
        </div>
        <div className="wb-task-drawer-card__actions">
          <HoverTip label={expanded ? t('taskCenterCollapseDetail') : t('taskCenterExpandDetail')}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="wb-task-drawer-card__expand"
              aria-expanded={expanded}
              aria-label={expanded ? t('taskCenterCollapseDetail') : t('taskCenterExpandDetail')}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
            </Button>
          </HoverTip>
          {showCopyUpstream ? (
            <TaskVoiceCopyUpstreamButton upstreamUrl={upstreamUrl} iconOnly />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="wb-task-drawer-card__goto"
            aria-label={t('taskGoToPage')}
            onClick={() => {
              navigate(task.route)
              onClose()
            }}
          >
            <ArrowRight size={16} aria-hidden />
          </Button>
          {canCancel ? (
            <HoverTip label={t('taskCancel')}>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t('taskCancel')}
                onClick={() => void cancelTask(task.id).catch((e) => toastError(apiErrorMessage(e)))}
              >
                <X size={16} aria-hidden />
              </Button>
            </HoverTip>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t('taskDrawerDelete')}
            disabled={task.kind === 'digital_human_retalk' && running}
            onClick={() => void removeTask(task.id).catch((e) => toastError(apiErrorMessage(e)))}
          >
            <Trash2 size={16} aria-hidden />
          </Button>
        </div>
      </div>
      {expanded ? <TaskDrawerCardDetail task={task} showStatus={showStatus} /> : null}
    </li>
  )
}

/** @deprecated 使用 TaskDrawerCardItem */
export const TaskDrawerCompactItem = TaskDrawerCardItem
