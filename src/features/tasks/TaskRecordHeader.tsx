import { taskModuleLabel } from '../../services/workbench-tasks/task-display'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { taskDrawerContext, taskDrawerSubject } from './task-drawer-label'
import { taskStatusLabel } from './task-labels'
import { formatTaskTimeShort } from './task-time'

type Props = {
  task: WorkbenchTaskRecord
  showStatus?: boolean
  titleClamp?: boolean
  /** 与 titleClamp 联用：详情区长文稿最多展示行数 */
  titleClampLines?: 1 | 2
  /** 任务中心展开区：不重复板块标签，subject/context 分层 */
  variant?: 'default' | 'detail'
}

export function TaskRecordHeader({
  task,
  showStatus = true,
  titleClamp = false,
  titleClampLines = 1,
  variant = 'default',
}: Props) {
  const subject = taskDrawerSubject(task)
  const context = taskDrawerContext(task)
  const showContextChip = Boolean(context && context !== subject)

  const titleClass = titleClamp
    ? `wb-task-drawer-card__title wb-task-drawer-card__title--clamp wb-task-drawer-card__title--clamp-${titleClampLines}`
    : 'wb-task-drawer-card__title'

  const fullTitle = task.title.trim()

  return (
    <>
      <div className="wb-task-drawer-card__head">
        {variant === 'detail' ? (
          <div className="wb-task-drawer-card__tags">
            {showStatus ? (
              <span className="wb-task-records__status" data-status={task.status}>
                {taskStatusLabel(task.status)}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="wb-task-drawer-card__tags">
            <span className="wb-task-records__tag" data-variant="module">{taskModuleLabel(task)}</span>
            {showStatus ? (
              <span className="wb-task-records__status" data-status={task.status}>
                {taskStatusLabel(task.status)}
              </span>
            ) : null}
          </div>
        )}
        <time className="wb-task-records__time" dateTime={new Date(task.createdAt).toISOString()}>
          {formatTaskTimeShort(task.createdAt)}
        </time>
      </div>
      <h4 className={titleClass} title={fullTitle || subject}>
        {subject}
      </h4>
      {variant === 'detail' && showContextChip ? (
        <span className="wb-task-drawer-card__context-chip" title={context}>
          {context}
        </span>
      ) : null}
      {variant === 'default' && task.subtitle?.trim() ? (
        <p
          className={
            titleClamp
              ? 'wb-task-drawer-card__subtitle wb-task-drawer-card__subtitle--compact'
              : 'wb-task-drawer-card__subtitle'
          }
          title={task.subtitle}
        >
          {task.subtitle.trim()}
        </p>
      ) : null}
    </>
  )
}
