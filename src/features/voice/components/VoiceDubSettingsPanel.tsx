import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { TTS_RATE, TTS_VOLUME, TTS_PITCH } from '../voice-constants'
import { TONE_PRESET_CUSTOM, TONE_PRESETS, type TonePreset } from '../voice-tone-presets'
import type { VoiceControlParams } from './VoiceSideControl'
import { voiceRangeFillStyle } from '../lib/voice-range-fill'
import { VoiceCapsuleToggle } from './VoiceCapsuleToggle'
import { VoiceTonePresetSelect } from './VoiceTonePresetSelect'

type Props = {
  mode: 'direct' | 'advanced'
  activeTone?: TonePreset
  onToneChange?: (tone: TonePreset) => void
  params: VoiceControlParams
  onParamsChange: (patch: Partial<VoiceControlParams>) => void
  skipConfirm?: boolean
  onSkipConfirmChange?: (skip: boolean) => void
  onCtaClick: () => void
  ctaDisabled?: boolean
  ctaBusy?: boolean
  ctaLabel?: string
}

export function VoiceDubSettingsPanel({
  mode,
  activeTone = '自然',
  onToneChange,
  params,
  onParamsChange,
  skipConfirm = false,
  onSkipConfirmChange,
  onCtaClick,
  ctaDisabled = false,
  ctaBusy = false,
  ctaLabel,
}: Props) {
  const { t } = useTranslation('voice')
  const handleToneSelect = (tone: TonePreset) => {
    onToneChange?.(tone)
    if (tone === TONE_PRESET_CUSTOM) return
    const match = TONE_PRESETS.find((p) => p.label === tone)
    if (match) onParamsChange({ instruction: match.instruction })
  }

  const handleCustomInstructionChange = (text: string) => {
    onToneChange?.(TONE_PRESET_CUSTOM)
    onParamsChange({ instruction: text })
  }

  const defaultCta = mode === 'advanced' ? t('settings.ctaAdvanced') : t('settings.ctaDirect')
  const buttonText = ctaLabel ?? (ctaBusy ? t('settings.ctaBusy') : defaultCta)

  const rateSlider = Math.round(params.rate * 10)
  const rateMin = TTS_RATE.min * 10
  const rateMax = TTS_RATE.max * 10
  const pitchSlider = Math.round(params.pitch * 10)
  const pitchMin = TTS_PITCH.min * 10
  const pitchMax = TTS_PITCH.max * 10
  const [settingsCollapsed, setSettingsCollapsed] = useState(false)

  return (
    <div className="voice-dub-settings">
      <section
        className={`voice-dub-advanced-panel${settingsCollapsed ? ' is-collapsed' : ''}`}
        aria-label={t('settings.advancedAria')}
      >
        <div className="voice-dub-advanced-panel__head">
          <h3 className="voice-dub-advanced-panel__title">{t('settings.advancedTitle')}</h3>
          <button
            type="button"
            className="voice-dub-advanced-panel__collapse"
            aria-expanded={!settingsCollapsed}
            aria-controls="voice-dub-advanced-panel-body"
            title={settingsCollapsed ? t('settings.expand') : t('settings.collapse')}
            onClick={() => setSettingsCollapsed((prev) => !prev)}
          >
            {settingsCollapsed ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
            <span className="sr-only">{settingsCollapsed ? t('settings.expandShort') : t('settings.collapseShort')}</span>
          </button>
        </div>

        <div id="voice-dub-advanced-panel-body" className="voice-dub-advanced-panel__body">
        <div className="voice-dub-advanced-panel__sliders voice-sliders-block">
          {mode === 'direct' ? (
            <div className="voice-slider-item voice-slider-item--tone">
              <label>{t('settings.toneBase')}</label>
              <div className="voice-slider-item__tone-control">
                <VoiceTonePresetSelect
                  value={activeTone}
                  onChange={handleToneSelect}
                  allowCustom
                  customInstruction={params.instruction ?? ''}
                  onCustomInstructionChange={handleCustomInstructionChange}
                />
              </div>
            </div>
          ) : null}
          <div className="voice-slider-item">
            <label>{t('settings.rate')}</label>
            <input
              type="range"
              className="voice-range"
              min={rateMin}
              max={rateMax}
              step={TTS_RATE.step * 10}
              value={rateSlider}
              style={voiceRangeFillStyle(rateSlider, rateMin, rateMax)}
              onChange={(e) => onParamsChange({ rate: Number(e.target.value) / 10 })}
            />
            <output>{params.rate.toFixed(1)}×</output>
          </div>
          <div className="voice-slider-item">
            <label>{t('settings.volume')}</label>
            <input
              type="range"
              className="voice-range"
              min={TTS_VOLUME.min}
              max={TTS_VOLUME.max}
              step={TTS_VOLUME.step}
              value={params.volume}
              style={voiceRangeFillStyle(params.volume, TTS_VOLUME.min, TTS_VOLUME.max)}
              onChange={(e) => onParamsChange({ volume: Number(e.target.value) })}
            />
            <output>{params.volume}</output>
          </div>
          <div className="voice-slider-item">
            <label>{t('settings.pitch')}</label>
            <input
              type="range"
              className="voice-range"
              min={pitchMin}
              max={pitchMax}
              step={TTS_PITCH.step * 10}
              value={pitchSlider}
              style={voiceRangeFillStyle(pitchSlider, pitchMin, pitchMax)}
              onChange={(e) => onParamsChange({ pitch: Number(e.target.value) / 10 })}
            />
            <output>{params.pitch.toFixed(1)}×</output>
          </div>
        </div>

        {mode === 'advanced' && onSkipConfirmChange ? (
          <VoiceCapsuleToggle
            className="voice-dub-advanced-panel__skip-confirm"
            labelClassName="voice-dub-advanced-panel__title"
            label={t('settings.autoSynthesizeAfterPlan')}
            checked={skipConfirm}
            onCheckedChange={onSkipConfirmChange}
          />
        ) : null}
        </div>
      </section>

      <div className="voice-dock-footer">
        <button
          type="button"
          className="voice-cta-btn"
          disabled={ctaDisabled || ctaBusy}
          onClick={onCtaClick}
        >
          {ctaBusy ? <Loader2 size={16} className="voice-spin" /> : null}
          <span>{buttonText}</span>
        </button>
      </div>
    </div>
  )
}
