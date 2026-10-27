import { cn } from '@no996/ui/utils'
import { Tabs, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { useTranslation } from 'react-i18next'

export type VoicePageView = 'work' | 'history' | 'voices'

type Props = {
  value: VoicePageView
  onChange: (value: VoicePageView) => void
  historyBadge?: number
  className?: string
}

export function VoicePageViewTabs({ value, onChange, historyBadge, className }: Props) {
  const { t } = useTranslation('voice')
  return (
    <Tabs value={value} onValueChange={(next) => {
      if (next === 'work' || next === 'history' || next === 'voices') onChange(next)
    }}>
      <TabsList variant="toolbar" className={cn('wb-page-view-tabs', className)} aria-label={t('page.viewTabsAria')}>
        <TabsTrigger value="work" id="wb-page-tab-work" aria-controls="wb-page-panel-work">
          {t('page.views.work')}
        </TabsTrigger>
        <TabsTrigger value="history" id="wb-page-tab-history" aria-controls="wb-page-panel-history">
          {t('page.views.history')}
          {historyBadge != null && historyBadge > 0 ? (
            <span className="wb-page-view-tabs__badge" aria-hidden="true">{historyBadge}</span>
          ) : null}
        </TabsTrigger>
        <TabsTrigger value="voices" id="wb-page-tab-voices" aria-controls="wb-page-panel-voices">
          {t('page.views.voices')}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
