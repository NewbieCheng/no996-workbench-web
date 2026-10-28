import { useTranslation } from 'react-i18next'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskDrawerDetailDuration } from './TaskDrawerDetailDuration'
import { TaskDrawerKindPreview } from './TaskDrawerKindPreview'
import { TaskRetalkDetailAside } from './TaskRetalkDetailAside'
import { TaskVideoExportBlock } from './TaskVideoExportBlock'
import {
  taskDrawerDetailBodyVariant,
  taskDrawerDetailFootNotes,
  taskDrawerDetailPrimaryDisplay,
} from './task-drawer-detail'
import { isVideoExportTask, taskResultSummaryChips } from './task-result-summary'
import { taskStatusLabel } from './task-labels'
import { formatTaskTimeShort } from './task-time'

type Props = {
  task: WorkbenchTaskRecord
  showStatus?: boolean
}

/** 任务卡片展开区：正文 + 底栏状态/时间（与列表行信息层级一致） */
export function TaskDrawerCardDetail({ task, showStatus = true }: Props) {
  const { t } = useTranslation('workbench')
  const failed = task.status === 'failed' || task.status === 'cancelled'
  const voiceDone =
    task.status === 'succeeded' && (task.kind === 'voice_tts' || task.kind === 'ip_video_audio')
  const videoExport = isVideoExportTask(task)
  const videoExportDone = task.status === 'succeeded' && videoExport
  const videoExportFailed = task.status === 'failed' && videoExport
  const { full: primaryFull, display: primaryDisplay } = taskDrawerDetailPrimaryDisplay(task)
  const footNotes = videoExportDone ? [] : taskDrawerDetailFootNotes(task)
  const exportChips = videoExportDone ? taskResultSummaryChips(task) : []
  const bodyVariant = taskDrawerDetailBodyVariant(task)
  const isRetalk = task.kind === 'digital_human_retalk'
  const hideKindPreview = (failed && !isRetalk) || voiceDone || videoExportDone

  return (
    <div className="wb-task-drawer-card__detail wb-task-drawer-card__detail--stacked">
      {primaryDisplay ? (
        isRetalk ? (
          <div className="wb-task-drawer-card__detail-head-row">
            <p
              className={`wb-task-drawer-card__detail-body wb-task-drawer-card__detail-body--${bodyVariant}`}
              title={primaryFull}
            >
              {primaryDisplay}
            </p>
            <TaskRetalkDetailAside task={task} />
          </div>
        ) : (
          <p
            className={`wb-task-drawer-card__detail-body wb-task-drawer-card__detail-body--${bodyVariant}`}
            title={primaryFull}
          >
            {primaryDisplay}
          </p>
        )
      ) : null}
      <div className="wb-task-drawer-card__detail-foot">
        <div className="wb-task-drawer-card__detail-foot-main">
          {showStatus ? (
            <span className="wb-task-records__status" data-status={task.status}>
              {task.meta?.remote_status === 'EXPIRED' ? task.errorMessage : taskStatusLabel(task.status)}
            </span>
          ) : null}
          <time className="wb-task-records__time" dateTime={new Date(task.createdAt).toISOString()}>
            {formatTaskTimeShort(task.createdAt)}
          </time>
          {footNotes.map((note) => (
            <span key={note} className="wb-task-drawer-card__detail-foot-note" title={note}>
              {note}
            </span>
          ))}
          {exportChips.length > 0 ? (
            <ul className="wb-task-drawer-preview__chips wb-task-drawer-preview__chips--inline">
              {exportChips.map((chip) => (
                <li
                  key={chip.id}
                  className="wb-task-drawer-preview__chip"
                  data-tone={chip.tone === 'warn' ? 'warn' : undefined}
                >
                  {t(chip.messageKey, chip.values)}
                </li>
              ))}
            </ul>
          ) : null}
          {voiceDone ? <TaskDrawerDetailDuration task={task} /> : null}
        </div>
        {videoExportDone || videoExportFailed ? (
          <TaskVideoExportBlock task={task} layout="compact" />
        ) : null}
      </div>
      {hideKindPreview ? null : <TaskDrawerKindPreview task={task} suppressVoicePlayer={false} />}
    </div>
  )
}
