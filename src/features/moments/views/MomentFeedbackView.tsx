import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { AlertTriangleIcon, ArrowLeftIcon, RefreshCwIcon, UserRoundIcon } from 'lucide-react'

interface MomentFeedbackViewProps {
  code: 'USER_PROFILE_REQUIRED' | 'INVALID_INPUT' | 'QC_FAILED' | 'ERROR'
  message: string
  details?: string[]
  recoveryAction?: string
  onBack: () => void
  onGoProfile: () => void
  onRetry: () => void
}

export function MomentFeedbackView({
  code,
  message,
  details,
  recoveryAction,
  onBack,
  onGoProfile,
  onRetry,
}: MomentFeedbackViewProps) {
  const { t } = useTranslation('workbench')
  const isProfile = code === 'USER_PROFILE_REQUIRED'
  const isInvalidInput = code === 'INVALID_INPUT'
  const title = isProfile
    ? t('momentsProfileRequiredTitle')
    : isInvalidInput
      ? t('momentsInvalidInputTitle')
      : t('momentsFailedTitle')
  const description = isProfile
    ? message || t('momentsProfileRequiredMessage')
    : isInvalidInput
      ? message
      : t('momentsFailedDesc', { message })

  return (
    <div className="moments-feedback">
      <div className={`moments-feedback__card ${isProfile ? 'moments-feedback__card--blocked' : ''}`}>
        <div className="moments-feedback__icon" aria-hidden>
          {isProfile ? (
            <UserRoundIcon className="h-6 w-6 text-primary" />
          ) : (
            <AlertTriangleIcon className="h-6 w-6 text-destructive" />
          )}
        </div>
        <h2 className="moments-feedback__title">{title}</h2>
        <p className="moments-feedback__message">{description}</p>
        {recoveryAction ? <p className="moments-feedback__recovery">{recoveryAction}</p> : null}
        {details && details.length > 0 && (
          <ul className="moments-feedback__details">
            {details.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        )}
        <div className="moments-feedback__actions">
          <Button variant="outline" className="gap-1.5" onClick={onBack}>
            <ArrowLeftIcon className="h-4 w-4" />
            {isProfile ? t('momentsBackToPlan') : t('momentsBackToInput')}
          </Button>
          {isProfile ? (
            <Button className="gap-1.5" onClick={onGoProfile}>
              <UserRoundIcon className="h-4 w-4" />
              {t('momentsGoProfile')}
            </Button>
          ) : !isInvalidInput ? (
            <Button className="gap-1.5" onClick={onRetry}>
              <RefreshCwIcon className="h-4 w-4" />
              {t('momentsRetry')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
