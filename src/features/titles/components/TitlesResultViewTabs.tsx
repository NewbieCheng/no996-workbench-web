import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'

export type TitlesResultView = 'list' | 'chart'

type Props = {
  value: TitlesResultView
  onChange: (value: TitlesResultView) => void
  className?: string
}

export function TitlesResultViewTabs({ value, onChange, className }: Props) {
  const { t } = useTranslation('workbench')

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        if (next === 'list' || next === 'chart') onChange(next)
      }}
      className={className}
    >
      <TabsList className="wb-page-view-tabs" aria-label={t('titlesResultTabsAria')}>
        <TabsTrigger value="list" id="tl-result-tab-list" aria-controls="tl-result-panel-list">
          {t('titlesResultListTitle')}
        </TabsTrigger>
        <TabsTrigger value="chart" id="tl-result-tab-chart" aria-controls="tl-result-panel-chart">
          {t('titlesResultTabChart')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
