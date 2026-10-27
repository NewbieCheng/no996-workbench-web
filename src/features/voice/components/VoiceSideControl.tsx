import { Volume2, Play, Loader2 } from 'lucide-react'
import type { VoiceCloneRecord } from '../../../api/voice-clone'
import {
  platformVoiceItems,
  TTS_RATE,
  TTS_VOLUME,
  TTS_PITCH,
} from '../voice-constants'
import { TONE_PRESET_CUSTOM, TONE_PRESETS, type TonePreset } from '../voice-tone-presets'
import { voiceRangeFillStyle } from '../lib/voice-range-fill'
import { Card } from '@no996/ui/card'
import { VoiceCapsuleToggle } from './VoiceCapsuleToggle'
import { VoiceTonePresetSelect } from './VoiceTonePresetSelect'

export type { TonePreset } from '../voice-tone-presets'
export { TONE_PRESETS } from '../voice-tone-presets'

export type VoiceControlParams = {
  rate: number
  volume: number
  pitch: number
  instruction?: string
}

type Props = {
  mode: 'direct' | 'advanced'
  clones: VoiceCloneRecord[]
  selectedVoiceId: string
  onSelectVoice: (id: string) => void
  onPreviewVoice?: (id: string) => void
  previewBusy?: boolean
  previewVoiceId?: string | null
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

export function VoiceSideControl({
  mode,
  clones,
  selectedVoiceId,
  onSelectVoice,
  onPreviewVoice,
  previewBusy = false,
  previewVoiceId = null,
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
  // Build voice items: clones first, then platform voices
  const cloneItems = clones
    .filter((c) => c.ready_for_synthesis)
    .map((c) => ({
      id: c.voice_id,
      label: c.display_name,
      tag: '我的音色',
      kind: 'clone' as const,
    }))
  const platform = platformVoiceItems()
  const allVoices = [...cloneItems, ...platform]

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

  const defaultCta = mode === 'advanced' ? '开始拆段' : '开始配音'
  const buttonText = ctaLabel ?? (ctaBusy ? '处理中…' : defaultCta)

  const rateSlider = Math.round(params.rate * 10)
  const rateMin = TTS_RATE.min * 10
  const rateMax = TTS_RATE.max * 10
  const pitchSlider = Math.round(params.pitch * 10)
  const pitchMin = TTS_PITCH.min * 10
  const pitchMax = TTS_PITCH.max * 10

  return (
    <Card className="voice-panel-card voice-side-card">
      {/* 1. 音色选择 */}
      <div className="voice-side-block">
        <div className="voice-side-title-row">
          <h3>{mode === 'advanced' ? '全局音色' : '音色选择'}</h3>
          {onPreviewVoice ? (
            <button
              type="button"
              className="voice-preview-btn"
              disabled={previewBusy}
              onClick={() => onPreviewVoice(selectedVoiceId)}
              title="试听当前音色"
            >
              {previewBusy && previewVoiceId === selectedVoiceId ? (
                <Loader2 size={13} className="voice-spin" />
              ) : (
                <Volume2 size={13} />
              )}
              <span>试听</span>
            </button>
          ) : null}
        </div>
        <div className="voice-list-picker" role="radiogroup" aria-label="音色列表">
          {allVoices.map((v) => {
            const isSelected = v.id === selectedVoiceId
            return (
              <div
                key={v.id}
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                className={`voice-picker-item ${isSelected ? 'is-selected' : ''}`}
                onClick={() => onSelectVoice(v.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectVoice(v.id)
                  }
                }}
              >
                <span className="voice-mw" aria-hidden>
                  {[40, 80, 55, 100, 60, 35, 70].map((h, k) => (
                    <i
                      key={k}
                      style={
                        {
                          '--h': `${h}%`,
                          animationPlayState: isSelected ? 'running' : 'paused',
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </span>
                <span className="voice-picker-info">
                  <b>{v.label}</b>
                  <small>{v.tag}</small>
                </span>
                {onPreviewVoice ? (
                  <button
                    type="button"
                    className="voice-mini-play"
                    aria-label={`试听 ${v.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPreviewVoice(v.id)
                    }}
                  >
                    {previewBusy && previewVoiceId === v.id ? (
                      <Loader2 size={11} className="voice-spin" />
                    ) : (
                      <Play size={11} />
                    )}
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. 语气底色 */}
      <div className="voice-side-block">
        <h3>语气底色</h3>
        <VoiceTonePresetSelect
          value={activeTone}
          onChange={handleToneSelect}
          allowCustom={mode === 'direct'}
          customInstruction={params.instruction ?? ''}
          onCustomInstructionChange={mode === 'direct' ? handleCustomInstructionChange : undefined}
        />
      </div>

      {/* 3. 滑块控制 */}
      <div className="voice-side-block voice-sliders-block">
        <div className="voice-slider-item">
          <label>语速</label>
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
          <label>音量</label>
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
          <label>音调</label>
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

      {/* 4. 高阶专享：跳过确认开关 */}
      {mode === 'advanced' && onSkipConfirmChange ? (
        <VoiceCapsuleToggle
          label="拆段后自动合成"
          checked={skipConfirm}
          onCheckedChange={onSkipConfirmChange}
        />
      ) : null}

      {/* 5. 核心 CTA 按钮 */}
      <button
        type="button"
        className="voice-cta-btn"
        disabled={ctaDisabled || ctaBusy}
        onClick={onCtaClick}
      >
        {ctaBusy ? <Loader2 size={16} className="voice-spin" /> : null}
        <span>{buttonText}</span>
      </button>
    </Card>
  )
}
