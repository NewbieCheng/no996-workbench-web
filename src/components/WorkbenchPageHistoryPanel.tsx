import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@no996/ui/utils'
import type { WorkbenchTaskRecordLayout } from '../features/tasks/WorkbenchTaskRecords'
import { useTaskRecordFieldOrder } from '../features/tasks/use-task-record-field-order'
import { PageHistoryFieldOrderActionsContext, PageHistoryFieldOrderContext, PageHistoryLayoutContext } from './page-history-layout'

type Props = {
  children: ReactNode
  className?: string
  'aria-label'?: string
  /** 卡片 / 列表切换，默认开启（配音页等自定义列表可关闭） */
  showLayoutToggle?: boolean
  defaultLayout?: WorkbenchTaskRecordLayout
  /** 由顶栏托管切换时传入，面板内不再渲染 tabs */
  layout?: WorkbenchTaskRecordLayout
  onLayoutChange?: (layout: WorkbenchTaskRecordLayout) => void
}

export function WorkbenchPageHistoryPanel({
  children,
  className,
  'aria-label': ariaLabel,
  showLayoutToggle = true,
  defaultLayout = 'cards',
  layout: layoutProp,
  onLayoutChange,
}: Props) {
  const { t } = useTranslation('workbench')
  const [internalLayout] = useState<WorkbenchTaskRecordLayout>(defaultLayout)
  const layoutControlled = layoutProp !== undefined && onLayoutChange !== undefined
  const layout = layoutControlled ? layoutProp : internalLayout
  const { fieldOrder, moveField } = useTaskRecordFieldOrder()

  return (
    <section
      className={cn('wb-page-history-panel', className)}
      aria-label={ariaLabel ?? t('pageHistoryAria')}
      role="tabpanel"
      id="wb-page-panel-history"
      aria-labelledby="wb-page-tab-history"
    >
      <PageHistoryLayoutContext.Provider value={showLayoutToggle ? layout : null}>
        <PageHistoryFieldOrderContext.Provider value={showLayoutToggle ? fieldOrder : null}>
          <PageHistoryFieldOrderActionsContext.Provider value={showLayoutToggle ? { moveField } : null}>
            {children}
          </PageHistoryFieldOrderActionsContext.Provider>
        </PageHistoryFieldOrderContext.Provider>
      </PageHistoryLayoutContext.Provider>
    </section>
  )
}
