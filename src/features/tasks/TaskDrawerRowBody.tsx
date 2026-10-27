import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useWorkbenchTaskActions, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskDrawerMiniPlayer } from './TaskDrawerMiniPlayer'
import { TaskDrawerRowHeadline } from './TaskDrawerRowHeadline'
import {
  isAgentLikeTask,
  isVoiceSynthesisTask,
  taskProgressPercent,
  taskResultSummaryChips,
} from './task-result-summary'
import { taskStatusLabel } from './task-labels'
import { isVoicePlaybackTask } from './use-task-voice-playback'

type Props = {
  task: WorkbenchTaskRecord
  /** 已展开详情时，摘要行只保留短标签，避免与详情区重复叠字 */
  detailExpanded?: boolean
}

export function TaskDrawerRowBody({ task, detailExpanded = false }: Props) {
  const { t } = useTranslation('workbench')
  const { getPayload } = useWorkbenchTaskActions()
  const [payloadHint, setPayloadHint] = useState('')

  const running = task.status === 'queued' || task.status === 'running'
  const failed = task.status === 'failed' || task.status === 'cancelled'
  const pct = taskProgressPercent(task)

  useEffect(() => {
    if (task.status !== 'succeeded') {
      setPayloadHint('')
      return
    }
    if (task.kind !== 'text_sections' && task.kind !== 'source_create') return
    let cancelled = false
    void getPayload(task.payloadId).then((data) => {
      if (cancelled || !data || typeof data !== 'object') return
      if (task.kind === 'text_sections') {
        const sections = (data as { sections?: unknown[] }).sections
        if (Array.isArray(sections) && sections.length > 0) {
          setPayloadHint(t('taskChipSectionCount', { count: sections.length }))
        }
        return
      }
      const title = (data as { collectedTitle?: string }).collectedTitle?.trim()
      if (title) setPayloadHint(t('taskChipSourceTitle', { title }))
    })
    return () => {
      cancelled = true
    }
  }, [task, getPayload, t])

  if (failed) {
    return (
      <div className="wb-task-drawer-row wb-task-drawer-row--done">
        <TaskDrawerRowHeadline task={task} />
        {!detailExpanded ? (
          <span className="wb-task-drawer-row__meta wb-task-drawer-row__meta--failed">
            {task.meta?.remote_status === 'EXPIRED' ? task.errorMessage : taskStatusLabel(task.status)}
          </span>
        ) : null}
      </div>
    )
  }

  if (running) {
    const label = isVoiceSynthesisTask(task)
      ? t('taskVoiceSynthesizing')
      : isAgentLikeTask(task)
        ? task.meta?.stage?.trim()
          ? t('taskStageRunning', { stage: task.meta.stage.trim() })
          : t('taskGenerating')
        : t('taskGenerating')
    return (
      <div className="wb-task-drawer-row wb-task-drawer-row--progress">
        <Loader2 className="wb-task-drawer-row__spin" size={16} aria-hidden />
        <TaskDrawerRowHeadline task={task} />
        <div className="wb-task-drawer-row__track-wrap" aria-hidden>
          <div className="wb-task-drawer-row__track">
            <div
              className="wb-task-drawer-row__fill"
              style={{ width: pct != null ? `${pct}%` : undefined }}
              data-indeterminate={pct == null ? 'true' : undefined}
            />
          </div>
        </div>
        <span className="wb-task-drawer-row__meta">{pct != null ? `${pct}%` : label}</span>
      </div>
    )
  }

  if (task.status === 'succeeded' && isVoicePlaybackTask(task)) {
    return <TaskDrawerMiniPlayer task={task} />
  }

  if (task.status === 'succeeded') {
    const chips = taskResultSummaryChips(task)
    const hint =
      payloadHint ||
      (task.kind === 'voice_dub_advanced' && task.meta?.awaiting_confirm !== '1'
        ? t('taskDubOpenToReview')
        : '')

    const meta = [
      ...chips.map((chip) => t(chip.messageKey, chip.values)),
      ...(hint ? [hint] : []),
    ].join(' · ')

    return (
      <div className="wb-task-drawer-row wb-task-drawer-row--done">
        <TaskDrawerRowHeadline task={task} />
        {meta ? <span className="wb-task-drawer-row__meta">{meta}</span> : null}
      </div>
    )
  }

  return (
    <div className="wb-task-drawer-row">
      <TaskDrawerRowHeadline task={task} />
    </div>
  )
}
