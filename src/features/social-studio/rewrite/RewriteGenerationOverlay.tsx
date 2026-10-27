import { useTranslation } from 'react-i18next'
import { findRewriteStyle } from './rewrite-style-catalog'
import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'
import type { SocialStudioRewriteSettings } from './social-studio-rewrite-types'

type RewriteGenerationOverlayProps = {
  platform: SocialStudioPlatform
  settings: SocialStudioRewriteSettings
  progress: number
  stageLabel: string
}

export function RewriteGenerationOverlay({
  platform,
  settings,
  progress,
  stageLabel,
}: RewriteGenerationOverlayProps) {
  const { t } = useTranslation('socialPublish')
  const style = findRewriteStyle(platform, settings.styleId)
  const styleLabel = style ? t(style.i18nKey) : ''

  return (
    <div className="rewrite-gen-overlay" role="status" aria-live="polite">
      <div className="rewrite-gen-overlay__head">
        <h3 className="rewrite-gen-overlay__title">{t('rewriteOverlayTitle')}</h3>
        <p className="rewrite-gen-overlay__subtitle">{stageLabel || t('rewriteOverlaySubtitle')}</p>
      </div>
      <div className="rewrite-gen-overlay__bar-wrap">
        <div className="rewrite-gen-overlay__bar">
          <div className="rewrite-gen-overlay__bar-fill" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
        <span className="rewrite-gen-overlay__pct">{Math.round(progress)}%</span>
      </div>
      <div className="rewrite-gen-overlay__strategy-card">
        <span className="rewrite-gen-overlay__strategy-label">
          {styleLabel}
          {settings.secondPassEnabled ? ` · ${t('rewriteSecondPassOn')}` : ` · ${t('rewriteSecondPassOff')}`}
        </span>
        <span className="rewrite-gen-overlay__strategy-status">{t('rewriteOverlayRunning')}</span>
      </div>
      <p className="rewrite-gen-overlay__foot">{t('rewriteOverlayFoot')}</p>
    </div>
  )
}
