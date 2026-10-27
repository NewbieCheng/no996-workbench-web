import { useTranslation } from 'react-i18next'
import type { VoiceCloneMeta } from '../../../api/voice-clone'
import { resolveClonePricing } from '../voice-clone-pricing'

type Props = {
  meta: VoiceCloneMeta | null
}

export function VoiceCloneDialogPricing({ meta }: Props) {
  const { t, i18n } = useTranslation('voice')
  const locale = i18n.language?.startsWith('en') ? 'en-US' : 'zh-CN'
  const pricing = resolveClonePricing(meta)

  if (!pricing.ready) {
    return (
      <aside className="voice-clone-dialog__pricing voice-clone-dialog__pricing--pending" aria-label={t('clone.dialogPricingAria')}>
        <p className="voice-clone-dialog__pricing-line">{t('clone.pricingLoading')}</p>
      </aside>
    )
  }

  return (
    <aside className="voice-clone-dialog__pricing" aria-label={t('clone.dialogPricingAria')}>
      <p className="voice-clone-dialog__pricing-line">
        <span className="voice-clone-dialog__pricing-label">{t('clone.dialogPricingLabel')}</span>
        {pricing.points != null ? (
          <span className="voice-clone-dialog__pricing-points">
            {pricing.points.toLocaleString(locale)} {t('clone.pointsUnit')}
          </span>
        ) : null}
        {pricing.showListPrice && pricing.listYuan ? (
          <span className="voice-clone-dialog__pricing-list">¥{pricing.listYuan}</span>
        ) : null}
        {pricing.saleYuan ? (
          <span className="voice-clone-dialog__pricing-sale">¥{pricing.saleYuan}</span>
        ) : null}
      </p>
    </aside>
  )
}
