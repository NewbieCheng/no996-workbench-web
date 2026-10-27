import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'

export type WorkbenchPageView = 'work' | 'history'

type Props = {
  value: WorkbenchPageView
  onChange: (value: WorkbenchPageView) => void
  /** Shown on history tab when > 0 (e.g. in-progress jobs). */
  historyBadge?: number
  historyLabel?: string
  className?: string
}

/** 工作台文案适配；样式与键盘交互统一由公共 Tabs 提供。 */
export function WorkbenchPageViewTabs({ value, onChange, historyBadge, historyLabel, className }: Props) {
  const { t } = useTranslation('workbench')

  return (
    <Tabs value={value} onValueChange={(next) => {
      if (next === 'work' || next === 'history') onChange(next)
    }} className={className}>
      <TabsList variant="toolbar" className="wb-page-view-tabs" aria-label={t('pageViewTabsAria')}>
        <TabsTrigger value="work" id="wb-page-tab-work" aria-controls="wb-page-panel-work">
          {t('pageTabWork')}
        </TabsTrigger>
        <TabsTrigger value="history" id="wb-page-tab-history" aria-controls="wb-page-panel-history">
          {historyLabel ?? t('pageTabHistory')}
          {historyBadge != null && historyBadge > 0 ? (
            <span className="wb-page-view-tabs__badge" aria-hidden="true">{historyBadge}</span>
          ) : null}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
