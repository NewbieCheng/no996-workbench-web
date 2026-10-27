import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pricing, type PricingPlan } from '../../components/blocks/pricing'
import { Notice } from '../../components/WorkbenchUI'

export default function MembershipPage() {
  const { t } = useTranslation('membership')
  const [notice, setNotice] = useState('')

  const plans = useMemo<PricingPlan[]>(
    () => [
      {
        name: t('trial.name'),
        price: '0',
        yearlyPrice: '0',
        period: '',
        features: t('trial.features', { returnObjects: true }) as string[],
        description: t('trial.description'),
        buttonText: t('trial.buttonText'),
        href: '#',
        isPopular: false,
      },
      {
        name: t('pro.name'),
        price: '29',
        yearlyPrice: '23',
        period: t('periodMonth'),
        features: t('pro.features', { returnObjects: true }) as string[],
        description: t('pro.description'),
        buttonText: t('pro.buttonText'),
        href: '#',
        isPopular: true,
      },
      {
        name: t('enterprise.name'),
        price: '299',
        yearlyPrice: '239',
        period: t('periodYear'),
        features: t('enterprise.features', { returnObjects: true }) as string[],
        description: t('enterprise.description'),
        buttonText: t('enterprise.buttonText'),
        href: '#',
        isPopular: false,
      },
    ],
    [t],
  )

  const preview = true

  return (
    <>
      <div className="mb-4 max-w-3xl mx-auto">
        <Notice tone="info">{t('previewNotice')}</Notice>
      </div>
      <Pricing
        preview={preview}
        plans={plans}
        title={t('previewTitle')}
        description={t('previewDescription')}
        labels={{
          annualBilling: t('annualBilling'),
          savePercent: t('savePercent'),
          billedMonthly: t('billedMonthly'),
          billedAnnually: t('billedAnnually'),
          popular: t('popular'),
          free: t('free'),
        }}
        onPlanClick={(plan) => {
          if (preview) {
            setNotice(t('previewNotice'))
            return
          }
          setNotice(t('consultNotice', { name: plan.name }))
        }}
      />
      {notice && !preview ? <Notice>{notice}</Notice> : null}
    </>
  )
}
