import { LayoutGrid, List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@no996/ui/utils'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import type { WorkbenchTaskRecordLayout } from '../features/tasks/WorkbenchTaskRecords'

type Props = {
  layout: WorkbenchTaskRecordLayout
  onLayoutChange: (layout: WorkbenchTaskRecordLayout) => void
  className?: string
}

/** 历史页「卡片 / 列表」切换，放在顶栏 actions 或 titleExtra 旁。 */
export function WorkbenchPageHistoryLayoutTabs({ layout, onLayoutChange, className }: Props) {
  const { t } = useTranslation('workbench')
  return (
    <Tabs value={layout} onValueChange={(next) => {
      if (next === 'cards' || next === 'list') onLayoutChange(next)
    }}>
      <TabsList variant="toolbar" className={cn('wb-page-history-layout-tabs', className)} aria-label={t('pageHistoryLayoutAria')}>
        <TabsTrigger value="cards" id="wb-page-history-layout-cards">
          <LayoutGrid size={15} aria-hidden="true" />
          {t('pageHistoryLayoutCards')}
        </TabsTrigger>
        <TabsTrigger value="list" id="wb-page-history-layout-list">
          <List size={15} aria-hidden="true" />
          {t('pageHistoryLayoutList')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
