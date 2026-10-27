import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskDrawerDetailDuration } from './TaskDrawerDetailDuration'
import { TaskDrawerKindPreview } from './TaskDrawerKindPreview'
import { TaskRetalkDetailAside } from './TaskRetalkDetailAside'
import {
  taskDrawerDetailBodyVariant,
  taskDrawerDetailFootNotes,
  taskDrawerDetailPrimaryDisplay,
} from './task-drawer-detail'
import { taskStatusLabel } from './task-labels'
import { formatTaskTimeShort } from './task-time'

type Props = {
  task: WorkbenchTaskRecord
  showStatus?: boolean
}

/** 任务卡片展开区：正文 + 底栏状态/时间（与列表行信息层级一致） */
export function TaskDrawerCardDetail({ task, showStatus = true }: Props) {
  const failed = task.status === 'failed' || task.status === 'cancelled'
  const voiceDone =
    task.status === 'succeeded' && (task.kind === 'voice_tts' || task.kind === 'ip_video_audio')
  const { full: primaryFull, display: primaryDisplay } = taskDrawerDetailPrimaryDisplay(task)
  const footNotes = taskDrawerDetailFootNotes(task)
  const bodyVariant = taskDrawerDetailBodyVariant(task)
  const isRetalk = task.kind === 'digital_human_retalk'

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
        {voiceDone ? <TaskDrawerDetailDuration task={task} /> : null}
      </div>
      {(failed && task.kind !== 'digital_human_retalk') || voiceDone ? null : <TaskDrawerKindPreview task={task} suppressVoicePlayer={false} />}
    </div>
  )
}
