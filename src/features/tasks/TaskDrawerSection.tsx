import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@no996/ui/button'
import type { WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { TaskDrawerCardItem } from './TaskDrawerCardItem'

/** 紧凑行高约 50px，单页多展示几条，减少「共 19 条却要翻 5 页」的割裂感 */
const PAGE_SIZE = 10

type Props = {
  title: string
  ariaLabel: string
  tasks: WorkbenchTaskRecord[]
  onClose: () => void
  showStatus?: boolean
  hideSectionHead?: boolean
  /** 进行中通常较少，不分页 */
  paginate?: boolean
}

export function TaskDrawerSection({
  title,
  ariaLabel,
  tasks,
  onClose,
  showStatus = true,
  hideSectionHead = false,
  paginate = true,
}: Props) {
  const [page, setPage] = useState(0)
  const totalPages = useMemo(
    () => (paginate ? Math.max(1, Math.ceil(tasks.length / PAGE_SIZE)) : 1),
    [paginate, tasks.length],
  )

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages - 1))
  }, [totalPages, tasks.length])

  if (!tasks.length) return null

  const slice = paginate
    ? tasks.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    : tasks

  return (
    <section
      className={
        paginate && totalPages > 1
          ? 'wb-task-drawer__section wb-task-drawer__section--paged'
          : 'wb-task-drawer__section'
      }
      aria-label={ariaLabel}
    >
      {hideSectionHead ? null : (
        <div className="wb-task-drawer__section-head">
          <h3 className="wb-task-drawer__section-title">{title}</h3>
          {paginate && tasks.length > PAGE_SIZE ? (
            <span className="wb-task-drawer__section-count">{tasks.length} 条</span>
          ) : null}
        </div>
      )}
      <ul className="wb-task-drawer-cards">
        {slice.map((task) => (
          <TaskDrawerCardItem
            key={task.id}
            task={task}
            onClose={onClose}
            showStatus={showStatus}
          />
        ))}
      </ul>
      {paginate && totalPages > 1 ? (
        <nav className="wb-task-drawer-page" aria-label={`${title}翻页`}>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="wb-task-drawer-page__btn"
            disabled={page <= 0}
            aria-label="上一页"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="wb-task-drawer-page__label">
            {page + 1} / {totalPages}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="wb-task-drawer-page__btn"
            disabled={page >= totalPages - 1}
            aria-label="下一页"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronRight size={16} />
          </Button>
        </nav>
      ) : null}
    </section>
  )
}
