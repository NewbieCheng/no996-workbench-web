import { useMemo, useState } from 'react'
import { Mic, Upload } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { VoiceDubSettingsPanel } from '../../voice/components/VoiceDubSettingsPanel'
import type { VoiceControlParams } from '../../voice/components/VoiceSideControl'
import type { TonePreset } from '../../voice/voice-tone-presets'
import { TTS_VOLUME, TTS_PITCH } from '../../voice/voice-constants'
import { useTalkV2Copy } from './v2-copy'
import '../../voice/voice.css'

export function TalkVoiceMiniPanel({
  voices,
  voiceId,
  speed,
  busy,
  pending,
  demo,
  voiceError,
  onVoiceIdChange,
  onSpeedChange,
  onGenerateDub,
  onReloadVoices,
  onUseExisting,
  onUploadAudio,
}: {
  voices: Array<{ id: string; label: string }>
  voiceId: string
  speed: number
  busy: boolean
  pending: boolean
  demo: boolean
  voiceError?: string
  onVoiceIdChange: (id: string) => void
  onSpeedChange: (speed: number) => void
  onGenerateDub: () => void
  onReloadVoices: () => void
  onUseExisting: () => void
  onUploadAudio: () => void
}) {
  const { t } = useTalkV2Copy()
  const [tone, setTone] = useState<TonePreset>('自然')
  const [params, setParams] = useState<VoiceControlParams>(() => ({
    rate: speed || 1,
    volume: TTS_VOLUME.default,
    pitch: TTS_PITCH.default,
  }))

  const syncParams = (patch: Partial<VoiceControlParams>) => {
    setParams(prev => {
      const next = { ...prev, ...patch }
      if (patch.rate != null && patch.rate !== speed) onSpeedChange(patch.rate)
      return next
    })
  }

  const list = useMemo(() => voices, [voices])

  return <div className="ipt-voice-mini">
    {!list.length ? <div className="ipt-empty ipt-empty--flat">
      <strong>{t('voiceEmptyTitle')}</strong>
      <p>{voiceError || t('voiceEmptyHint')}</p>
      <div className="ipt-inline-actions">
        <Button type="button" variant="toolbar" size="sm" disabled={busy || demo} onClick={onReloadVoices}>{t('retryVoices')}</Button>
        <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUseExisting}>{t('useExistingAudio')}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUploadAudio}>{t('uploadAudio')}</Button>
      </div>
    </div> : <>
      <div className="ipt-voice-list" role="radiogroup" aria-label={t('voiceSourceAi')}>
        {list.map(voice => {
          const selected = voice.id === voiceId
          return <button
            key={voice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`ipt-voice-list__item${selected ? ' is-selected' : ''}`}
            disabled={busy}
            onClick={() => onVoiceIdChange(voice.id)}
          >
            <span className="ipt-voice-list__wave" aria-hidden><Mic size={14} /></span>
            <span className="ipt-voice-list__meta"><b>{voice.label}</b></span>
          </button>
        })}
      </div>
      <div className="ipt-voice-mini__settings">
        <VoiceDubSettingsPanel
          mode="direct"
          activeTone={tone}
          onToneChange={setTone}
          params={{ ...params, rate: speed || params.rate }}
          onParamsChange={syncParams}
          onCtaClick={onGenerateDub}
          ctaDisabled={busy || demo || !voiceId}
          ctaBusy={pending}
          ctaLabel={pending ? t('making') : t('voiceSourceAi')}
        />
      </div>
    </>}
    <div className="ipt-inline-actions">
      <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUseExisting}><Upload size={14} />{t('useExistingAudio')}</Button>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUploadAudio}>{t('uploadAudio')}</Button>
    </div>
  </div>
}
