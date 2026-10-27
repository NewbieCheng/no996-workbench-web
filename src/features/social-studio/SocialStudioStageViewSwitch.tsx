import { useTranslation } from 'react-i18next'
import type { StudioStageView } from './studio-types'

type Props = {
  value: StudioStageView
  onChange: (view: StudioStageView) => void
  editDisabled?: boolean
}

export function SocialStudioStageViewSwitch({ value, onChange, editDisabled }: Props) {
  const { t } = useTranslation('socialPublish')
  return (
    <div
      className="social-studio-stage-view-switch"
      role="group"
      aria-label={t('studioViewSwitch')}
    >
      <button
        type="button"
        className={value === 'preview' ? 'is-active' : ''}
        aria-pressed={value === 'preview'}
        onClick={() => onChange('preview')}
      >
        {t('studioViewPreview')}
      </button>
      <button
        type="button"
        className={value === 'edit' ? 'is-active' : ''}
        aria-pressed={value === 'edit'}
        disabled={editDisabled}
        onClick={() => onChange('edit')}
      >
        {t('studioViewEdit')}
      </button>
    </div>
  )
}
