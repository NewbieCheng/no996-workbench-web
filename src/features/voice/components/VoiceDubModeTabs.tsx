import { useTranslation } from 'react-i18next'

type DubMode = 'direct' | 'advanced'

type Props = {
  value: DubMode
  onChange: (mode: DubMode) => void
  disabled?: boolean
}

/** 右侧坞顶栏：初级配音 / 高级配音 */
export function VoiceDubModeTabs({ value, onChange, disabled }: Props) {
  const { t } = useTranslation('voice')
  return (
    <div className="voice-dock-tabs voice-dock-tabs--mode" role="tablist" aria-label={t('dubMode.tabsAria')}>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'direct'}
        disabled={disabled}
        className={`voice-dock-tab${value === 'direct' ? ' is-active' : ''}`}
        onClick={() => onChange('direct')}
      >
        {t('dubMode.direct')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'advanced'}
        disabled={disabled}
        className={`voice-dock-tab${value === 'advanced' ? ' is-active' : ''}`}
        onClick={() => onChange('advanced')}
      >
        {t('dubMode.advanced')}
      </button>
    </div>
  )
}
