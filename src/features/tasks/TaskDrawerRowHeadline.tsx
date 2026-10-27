import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import {
  taskDrawerContext,
  taskDrawerModule,
  taskDrawerRowTitle,
  taskDrawerSubject,
} from './task-drawer-label'

type Props = {
  task: WorkbenchTaskRecord
  className?: string
}

export function TaskDrawerRowHeadline({ task, className }: Props) {
  const module = taskDrawerModule(task)
  const subject = taskDrawerSubject(task)
  const context = taskDrawerContext(task)
  const showContext = Boolean(context && context !== subject)

  return (
    <div className={className ?? 'wb-task-drawer-row__headline'} title={taskDrawerRowTitle(task)}>
      <span className="wb-task-drawer-row__module">{module}</span>
      <span className="wb-task-drawer-row__sep" aria-hidden>·</span>
      <span className="wb-task-drawer-row__subject">{subject}</span>
      {showContext ? (
        <>
          <span className="wb-task-drawer-row__sep wb-task-drawer-row__sep--context" aria-hidden>·</span>
          <span className="wb-task-drawer-row__context">{context}</span>
        </>
      ) : null}
    </div>
  )
}
