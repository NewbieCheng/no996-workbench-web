import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ScriptMode } from '../agent/types'

export type ScriptStepHeaderProps = {
  mode: ScriptMode
  step: number
}

export function ScriptStepHeader({ mode, step }: ScriptStepHeaderProps) {
  const { t } = useTranslation('scriptLab')
  const key = mode === 'video'
    ? ['productTitle', 'videoSpecTitle', 'detailsTitle'][step]
    : ['liveProductTitle', 'liveSpecTitle', 'detailsTitle'][step]
  const leadKey = mode === 'video'
    ? ['productLead', 'videoSpecLead', 'detailsLead'][step]
    : ['liveProductLead', 'liveSpecLead', 'detailsLead'][step]
  if (!key || !leadKey) return null
  return (
    <header className="sl-wiz-head">
      <details key={`${mode}-${step}`} className="sl-wiz-head__details">
        <summary className="sl-wiz-head__summary">
          <span>{t('steps.help')}</span>
          <ChevronDown className="sl-wiz-head__chevron" aria-hidden="true" />
        </summary>
        <div className="sl-wiz-head__content">
          <h2 className="sl-wiz-head__title">{t(`steps.${key}`)}</h2>
          <p className="sl-wiz-head__lead">{t(`steps.${leadKey}`)}</p>
        </div>
      </details>
    </header>
  )
}

export default ScriptStepHeader
