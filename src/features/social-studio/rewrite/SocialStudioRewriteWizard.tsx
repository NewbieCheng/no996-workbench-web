import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@no996/ui/textarea'
import { Input } from '@no996/ui/input'
import { Switch } from '@no996/ui/switch'
import { CheckIcon, LightbulbIcon, LinkIcon, MessageSquareQuoteIcon, PenLineIcon, SlidersHorizontalIcon } from 'lucide-react'
import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'
import { buildRewriteSettingsSummaryLines } from './build-social-rewrite-prompt'
import { listRewriteStyles } from './rewrite-style-catalog'
import { readRewriteRequirementHistory } from './rewrite-requirement-history'
import type { RewriteLengthPreset, SocialStudioRewriteSettings } from './social-studio-rewrite-types'

const STYLE_ICONS: Record<string, typeof LightbulbIcon> = {
  pain_leads: LightbulbIcon,
  contrarian_traffic: MessageSquareQuoteIcon,
  pitfall_persona: SlidersHorizontalIcon,
  trust_persona: PenLineIcon,
  tutorial_growth: LinkIcon,
  custom: LinkIcon,
}

type SocialStudioRewriteWizardProps = {
  platform: SocialStudioPlatform
  settings: SocialStudioRewriteSettings
  onChange: (patch: Partial<SocialStudioRewriteSettings>) => void
  disabled?: boolean
}

export function SocialStudioRewriteWizard({
  platform,
  settings,
  onChange,
  disabled,
}: SocialStudioRewriteWizardProps) {
  const { t } = useTranslation(['socialPublish', 'common'])
  const [historyOpen, setHistoryOpen] = useState(false)
  const styles = listRewriteStyles(platform)
  const page = settings.wizardPage

  const summaryLines = useMemo(
    () => buildRewriteSettingsSummaryLines(platform, settings, (key) => t(key)),
    [platform, settings, t],
  )

  const lengthPresets: { value: RewriteLengthPreset; titleKey: string; descKey: string }[] = [
    { value: 'refined', titleKey: 'rewriteLengthRefined', descKey: 'rewriteLengthRefinedDesc' },
    { value: 'balanced', titleKey: 'rewriteLengthBalanced', descKey: 'rewriteLengthBalancedDesc' },
    { value: 'original', titleKey: 'rewriteLengthOriginal', descKey: 'rewriteLengthOriginalDesc' },
    { value: 'expanded', titleKey: 'rewriteLengthExpanded', descKey: 'rewriteLengthExpandedDesc' },
  ]

  const requirementHistory = readRewriteRequirementHistory()

  return (
    <div className="ssc-rewrite-wizard">
      <div className="ssc-rewrite-wizard__steps" role="tablist" aria-label={t('rewriteWizardSteps')}>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            role="tab"
            aria-selected={page === n}
            className={`ssc-rewrite-wizard__step${page === n ? ' is-active' : ''}`}
            disabled={disabled}
            onClick={() => onChange({ wizardPage: n as 1 | 2 | 3 })}
          >
            {n}
          </button>
        ))}
      </div>

      {page === 1 ? (
        <section className="ssc-card">
          <header className="ssc-card__head">
            <span className="ssc-badge">03</span>
            <h3 className="ssc-card__title">{t('rewriteWizardStyleTitle')}</h3>
          </header>
          <p className="ssc-hint">{t('rewriteWizardStyleHint')}</p>
          <div className="ssc-rewrite-style-list">
            {styles.map((style) => {
              const Icon = STYLE_ICONS[style.id] || LightbulbIcon
              const selected = settings.styleId === style.id
              return (
                <button
                  key={style.id}
                  type="button"
                  className={`ssc-rewrite-style-card${selected ? ' is-selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange({ styleId: style.id })}
                >
                  <span className="ssc-rewrite-style-card__icon" aria-hidden>
                    <Icon />
                  </span>
                  <span className="ssc-rewrite-style-card__text">
                    <strong>{t(style.i18nKey)}</strong>
                    <span className="ssc-hint">{t(`${style.i18nKey}Desc`)}</span>
                  </span>
                  {selected ? <CheckIcon className="ssc-rewrite-style-card__check" aria-hidden /> : null}
                </button>
              )
            })}
          </div>
          {settings.styleId === 'custom' ? (
            <div className="ssc-rewrite-custom-url">
              <Input
                value={settings.customStyleUrl}
                disabled={disabled}
                placeholder={platform === 'xhs' ? t('rewriteCustomUrlXhs') : t('rewriteCustomUrlWechat')}
                onChange={(e) => onChange({ customStyleUrl: e.target.value })}
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {page === 2 ? (
        <section className="ssc-card">
          <header className="ssc-card__head">
            <span className="ssc-badge">04</span>
            <h3 className="ssc-card__title">{t('rewriteWizardRequirementTitle')}</h3>
          </header>
          <p className="ssc-hint">{t('rewriteWizardRequirementHint')}</p>
          <div className="ssc-rewrite-requirement-wrap">
            <Textarea
              rows={5}
              maxLength={3000}
              disabled={disabled}
              value={settings.rewriteRequirement}
              placeholder={t('rewriteWizardRequirementPlaceholder')}
              onChange={(e) => onChange({ rewriteRequirement: e.target.value })}
            />
            <button
              type="button"
              className="ssc-text-btn ssc-rewrite-history-btn"
              disabled={disabled}
              onClick={() => setHistoryOpen((v) => !v)}
            >
              {t('rewriteRequirementHistory')}
            </button>
          </div>
          {historyOpen && requirementHistory.length > 0 ? (
            <ul className="ssc-rewrite-history-list">
              {requirementHistory.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    className="ssc-rewrite-history-item"
                    disabled={disabled}
                    onClick={() => {
                      onChange({ rewriteRequirement: item })
                      setHistoryOpen(false)
                    }}
                  >
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {page === 3 ? (
        <>
          <section className="ssc-card">
            <header className="ssc-card__head">
              <span className="ssc-badge">05</span>
              <h3 className="ssc-card__title">{t('rewriteWizardLengthTitle')}</h3>
            </header>
            <p className="ssc-hint">{t('rewriteWizardLengthHint')}</p>
            <div className="ssc-rewrite-length-grid">
              {lengthPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  className={`ssc-rewrite-length-card${settings.lengthPreset === preset.value ? ' is-selected' : ''}`}
                  disabled={disabled}
                  onClick={() => onChange({ lengthPreset: preset.value })}
                >
                  <strong>{t(preset.titleKey)}</strong>
                  <span>{t(preset.descKey)}</span>
                </button>
              ))}
            </div>
            <div className="ssc-rewrite-custom-length">
              <label className="ssc-rewrite-custom-length__label">
                {t('rewriteLengthCustom')}
                <span className="ssc-rewrite-custom-length__value">{settings.customWordCount} {t('rewriteWordUnit')}</span>
              </label>
              <input
                type="range"
                className="ssc-slider"
                min={500}
                max={5000}
                step={100}
                disabled={disabled}
                value={settings.customWordCount}
                onChange={(e) => onChange({ lengthPreset: 'custom', customWordCount: Number(e.target.value) })}
              />
            </div>
          </section>

          <section className="ssc-card">
            <header className="ssc-card__head">
              <span className="ssc-badge">06</span>
              <h3 className="ssc-card__title">{t('rewriteWizardOptionsTitle')}</h3>
            </header>
            <div className="ssc-rewrite-switch-row">
              <div>
                <p className="ssc-rewrite-switch-row__title">{t('rewriteHumanFeel')}</p>
                <p className="ssc-hint">{t('rewriteHumanFeelHint')}</p>
              </div>
              <Switch
                checked={settings.humanFeelEnhance}
                disabled={disabled}
                onCheckedChange={(v) => onChange({ humanFeelEnhance: v })}
              />
            </div>
            <div className="ssc-rewrite-switch-row">
              <div>
                <p className="ssc-rewrite-switch-row__title">{t('rewriteSecondPass')}</p>
                <p className="ssc-hint">{t('rewriteSecondPassHint')}</p>
              </div>
              <Switch
                checked={settings.secondPassEnabled}
                disabled={disabled}
                onCheckedChange={(v) => onChange({ secondPassEnabled: v })}
              />
            </div>
          </section>

          <section className="ssc-card ssc-rewrite-summary">
            <h4 className="ssc-card__title">{t('rewriteSummaryTitle')}</h4>
            <ul className="ssc-rewrite-summary__list">
              {summaryLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <div className="ssc-rewrite-wizard__nav">
        <button
          type="button"
          className="ssc-text-btn"
          disabled={disabled || page <= 1}
          onClick={() => onChange({ wizardPage: (page - 1) as 1 | 2 | 3 })}
        >
          {t('rewriteWizardPrev')}
        </button>
        <button
          type="button"
          className="ssc-text-btn"
          disabled={disabled || page >= 3}
          onClick={() => onChange({ wizardPage: (page + 1) as 1 | 2 | 3 })}
        >
          {t('rewriteWizardNext')}
        </button>
      </div>
    </div>
  )
}
