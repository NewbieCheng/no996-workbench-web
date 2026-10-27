import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Loader2Icon } from 'lucide-react'
import i18n from '@/i18n'

type SocialStudioGenerateZoneProps = {
  generating: boolean
  stageLabel?: string
  disabled?: boolean
  onGenerate: () => void
  onCancel?: () => void
  generateLabel: string
}

export function SocialStudioGenerateZone({
  generating,
  stageLabel,
  disabled,
  onGenerate,
  onCancel,
  generateLabel,
}: SocialStudioGenerateZoneProps) {
  const { t } = useTranslation(['socialPublish', 'common'])

  return (
    <div className="ssc-generate-zone">
      {generating ? (
        <div className="ssc-generate-zone__progress" role="status">
          <Loader2Icon className="ssc-generate-zone__spinner" aria-hidden />
          <div>
            <p className="ssc-generate-zone__status">{t('briefGenerating')}</p>
            {stageLabel ? <p className="ssc-generate-zone__step">{stageLabel}</p> : null}
          </div>
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {t('common:cancelGeneration', { defaultValue: i18n.t("common:cancel") })}
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        className="ssc-generate-zone__cta"
        disabled={disabled || generating}
        onClick={onGenerate}
      >
        {generateLabel}
      </Button>
    </div>
  )
}
