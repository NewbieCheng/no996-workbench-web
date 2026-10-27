import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OPEN_TASK_CENTER_EVENT } from '../../lib/toast-task-enqueued'
import { Filter, History, ListTodo, Search, X } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@no996/ui/dialog'
import { Input } from '@no996/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { useWorkbenchTaskActiveCount, useWorkbenchTasks } from '../../services/workbench-tasks'
import { QUEUED_FEATURE_HINT } from '../../services/workbench-tasks/task-display'
import { TaskDrawerSection } from './TaskDrawerSection'
import {
  countTasksByStatus,
  filterTaskCenterTasks,
  type TaskCenterKindFilter,
  type TaskCenterStatusFilter,
} from './task-center-filters'

export function TaskCenterTrigger() {
  const { t } = useTranslation('workbench')
  const [open, setOpen] = useState(false)
  const active = useWorkbenchTaskActiveCount()

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_TASK_CENTER_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_TASK_CENTER_EVENT, onOpen)
  }, [])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="wb-topbar-icon-btn wb-task-trigger"
        aria-label={t('taskCenterTitle')}
        onClick={() => setOpen(true)}
      >
        <ListTodo size={18} />
        {active > 0 ? (
          <span className="wb-task-trigger__badge" aria-hidden>
            {active > 9 ? '9+' : active}
          </span>
        ) : null}
      </Button>
      <TaskCenterDrawer open={open} onOpenChange={setOpen} />
    </>
  )
}

function statusShowStatus(status: TaskCenterStatusFilter): boolean {
  if (status === 'done') return false
  return true
}

export function TaskCenterDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('workbench')
  const tasks = useWorkbenchTasks()
  const [statusFilter, setStatusFilter] = useState<TaskCenterStatusFilter>('all')
  const [kindFilter, setKindFilter] = useState<TaskCenterKindFilter>('all')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setSearchOpen(false)
      setFilterOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (searchOpen) {
      const id = requestAnimationFrame(() => searchInputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
    return undefined
  }, [searchOpen])

  const statusCounts = useMemo(() => countTasksByStatus(tasks), [tasks])
  const kindSelectItems = useMemo(
    () =>
      [
        { value: 'all', label: t('taskCenterKindAll') },
        { value: 'voice', label: t('taskCenterKindVoice') },
        { value: 'ip_video', label: t('taskCenterKindIpVideo') },
        { value: 'script', label: t('taskCenterKindScript') },
        { value: 'titles', label: t('taskCenterKindTitles') },
        { value: 'persona', label: t('taskCenterKindPersona') },
        { value: 'other', label: t('taskCenterKindOther') },
      ] as const,
    [t],
  )
  const filtered = useMemo(
    () => filterTaskCenterTasks(tasks, statusFilter, kindFilter, query),
    [tasks, statusFilter, kindFilter, query],
  )

  const close = () => onOpenChange(false)

  const toggleSearch = () => {
    setSearchOpen((on) => {
      if (!on) setFilterOpen(false)
      return !on
    })
  }

  const toggleFilter = () => {
    setFilterOpen((on) => {
      if (!on) setSearchOpen(false)
      return !on
    })
  }

  const tabsHidden = searchOpen || filterOpen

  const listTitle =
    statusFilter === 'all'
      ? t('taskCenterListAll', { count: filtered.length })
      : statusFilter === 'active'
        ? t('taskSectionActive', { count: filtered.length })
        : statusFilter === 'done'
          ? t('taskSectionDone')
          : t('taskSectionFailed')

  const listAria =
    statusFilter === 'active'
      ? t('taskSectionActiveAria', { count: filtered.length })
      : statusFilter === 'failed'
        ? t('taskSectionFailedAria')
        : listTitle

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="wb-task-drawer"
        positionerClassName="wb-task-drawer-positioner"
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">{t('taskCenterHint')}</DialogDescription>
        <div className="wb-task-drawer__head">
          <div className="wb-task-drawer__head-main">
            <DialogTitle className="wb-task-drawer__title">{t('taskCenterTitle')}</DialogTitle>
            {tasks.length > 0 ? (
              <div className="wb-task-drawer__head-toolbar">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="wb-task-drawer__tool-btn"
                  aria-label={t('taskCenterFilterKindAria')}
                  aria-pressed={filterOpen || kindFilter !== 'all'}
                  onClick={toggleFilter}
                >
                  <Filter size={16} aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="wb-task-drawer__tool-btn"
                  aria-label={t('taskCenterSearchToggle')}
                  aria-pressed={searchOpen || query.length > 0}
                  onClick={toggleSearch}
                >
                  <Search size={16} aria-hidden />
                </Button>
                <div className="wb-task-drawer__tabs-slot">
                  {searchOpen ? (
                    <div className="wb-task-drawer__head-overlay wb-task-drawer__head-overlay--search">
                      <Search className="wb-task-drawer__search-icon" size={15} aria-hidden />
                      <Input
                        ref={searchInputRef}
                        type="search"
                        className="wb-task-drawer__search-input"
                        placeholder={t('taskCenterSearchPlaceholder')}
                        aria-label={t('taskCenterSearchAria')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  ) : null}
                  {filterOpen ? (
                    <div className="wb-task-drawer__head-overlay wb-task-drawer__head-overlay--filter">
                      <Select
                        items={[...kindSelectItems]}
                        value={kindFilter}
                        onValueChange={(next) => {
                          if (
                            next === 'all' ||
                            next === 'voice' ||
                            next === 'ip_video' ||
                            next === 'script' ||
                            next === 'titles' ||
                            next === 'persona' ||
                            next === 'other'
                          ) {
                            setKindFilter(next)
                          }
                        }}
                      >
                        <SelectTrigger
                          className="wb-task-drawer__kind-select wb-task-drawer__kind-select--overlay"
                          aria-label={t('taskCenterFilterKindAria')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('taskCenterKindAll')}</SelectItem>
                          <SelectItem value="voice">{t('taskCenterKindVoice')}</SelectItem>
                          <SelectItem value="ip_video">{t('taskCenterKindIpVideo')}</SelectItem>
                          <SelectItem value="script">{t('taskCenterKindScript')}</SelectItem>
                          <SelectItem value="titles">{t('taskCenterKindTitles')}</SelectItem>
                          <SelectItem value="persona">{t('taskCenterKindPersona')}</SelectItem>
                          <SelectItem value="other">{t('taskCenterKindOther')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <Tabs
                    value={statusFilter}
                    onValueChange={(next) => {
                      if (next === 'all' || next === 'active' || next === 'done' || next === 'failed') {
                        setStatusFilter(next)
                      }
                    }}
                    className={
                      tabsHidden
                        ? 'wb-task-drawer__status-tabs wb-task-drawer__status-tabs--hidden'
                        : 'wb-task-drawer__status-tabs'
                    }
                  >
                    <TabsList
                      variant="toolbar"
                      className="wb-task-drawer__status-list"
                      aria-label={t('taskCenterStatusTabsAria')}
                      aria-hidden={tabsHidden}
                    >
                      <TabsTrigger value="all">
                        {t('taskCenterStatusAll')}
                        <span className="wb-task-drawer__tab-count">{statusCounts.all}</span>
                      </TabsTrigger>
                      <TabsTrigger value="active">
                        {t('taskCenterStatusActive')}
                        {statusCounts.active > 0 ? (
                          <span className="wb-task-drawer__tab-count wb-task-drawer__tab-count--accent">
                            {statusCounts.active}
                          </span>
                        ) : (
                          <span className="wb-task-drawer__tab-count">{statusCounts.active}</span>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="done">
                        {t('taskCenterStatusDone')}
                        <span className="wb-task-drawer__tab-count">{statusCounts.done}</span>
                      </TabsTrigger>
                      <TabsTrigger value="failed">
                        {t('taskCenterStatusFailed')}
                        <span className="wb-task-drawer__tab-count">{statusCounts.failed}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label={t('taskCenterClose')} onClick={close}>
            <X size={18} />
          </Button>
        </div>

        <div className="wb-task-drawer__body">
          {tasks.length === 0 ? (
            <div className="wb-task-drawer__empty-state" role="status">
              <span className="wb-task-records__empty-icon" aria-hidden="true">
                <History size={19} />
              </span>
              <p className="wb-task-drawer__empty">
                {t('taskCenterEmpty', { hint: QUEUED_FEATURE_HINT })}
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="wb-task-drawer__empty-state wb-task-drawer__empty-state--compact" role="status">
              <p className="wb-task-drawer__empty">{t('taskCenterNoMatch')}</p>
            </div>
          ) : (
            <div className="wb-task-drawer__sections">
              <TaskDrawerSection
                key={`${statusFilter}-${kindFilter}-${query}`}
                title={listTitle}
                ariaLabel={listAria}
                tasks={filtered}
                onClose={close}
                showStatus={statusShowStatus(statusFilter)}
                hideSectionHead
                paginate
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
