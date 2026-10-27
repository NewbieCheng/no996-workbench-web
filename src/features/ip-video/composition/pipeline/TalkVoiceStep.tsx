import { useState } from 'react'
import type { TFunction } from 'i18next'
import { AudioLines, Mic, Upload } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { TalkDubSettings } from '../TalkDubSettings'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'
import type { DigitalHumanDubSourceMode } from '../../../digital-human/DigitalHumanDubSettingsControls'

export function TalkVoiceStep({
  tDh,
  voices,
  voiceId,
  speed,
  voiceError,
  hasAudio,
  audioMismatch,
  busy,
  pending,
  demo,
  showRetryBinding,
  onModeChange,
  onVoiceIdChange,
  onSpeedChange,
  onGenerateDub,
  onReloadVoices,
  onUseExisting,
  onUploadAudio,
  onRetryBinding,
  onNext,
  onBack,
  onOpenAdvanced,
}: {
  tDh: TFunction<'digitalHuman'>
  voices: Array<{ id: string; label: string }>
  voiceId: string
  speed: number
  voiceError?: string
  hasAudio: boolean
  audioMismatch: boolean
  busy: boolean
  pending: boolean
  demo: boolean
  showRetryBinding?: boolean
  onModeChange: (mode: DigitalHumanDubSourceMode) => void
  onVoiceIdChange: (id: string) => void
  onSpeedChange: (speed: number) => void
  onGenerateDub: () => void
  onReloadVoices: () => void
  onUseExisting: () => void
  onUploadAudio: () => void
  onRetryBinding?: () => void
  onNext: () => void
  onBack: () => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  const [mode, setMode] = useState<DigitalHumanDubSourceMode>('ai')
  const changeMode = (next: DigitalHumanDubSourceMode) => { setMode(next); onModeChange(next) }
  return <TalkStepShell
    stage="voice"
    title={t('stepVoice')}
    hint={t('stepVoiceHint')}
    primary={{ label: t('nextGenerate'), onClick: onNext, disabled: busy, icon: 'next', testId: 'ipt-next-generate' }}
    secondary={{ label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: busy }}
    onBack={onBack}
  >
    <div className="ipt-voice-status" data-ready={hasAudio || !!voiceId}>
      <span className="ipt-voice-status__icon" aria-hidden><AudioLines size={16} /></span>
      <div>
        <strong>{hasAudio ? t('voiceReady') : voiceId ? t('voiceSelected') : t('voiceMissing')}</strong>
        <small>{audioMismatch ? t('voiceMismatch') : hasAudio ? t('voiceKeepHint') : t('voiceOptionalHint')}</small>
      </div>
      {hasAudio && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUseExisting}>{t('changeVoice')}</Button>}
    </div>
    <div className="ipt-seg ipt-voice-modes" role="radiogroup" aria-label={t('voiceSource')}>
      <button type="button" role="radio" aria-checked={mode === 'ai'} className={mode === 'ai' ? 'on' : undefined} disabled={busy} onClick={() => changeMode('ai')}><Mic size={14} />{t('voiceSourceAi')}</button>
      <button type="button" role="radio" aria-checked={mode === 'import'} className={mode === 'import' ? 'on' : undefined} disabled={busy} onClick={() => changeMode('import')}><Upload size={14} />{t('voiceSourceImport')}</button>
    </div>
    {!voices.length && mode === 'ai' && <div className="ipt-empty">
      <strong>{t('voiceEmptyTitle')}</strong>
      <p>{voiceError || t('voiceEmptyHint')}</p>
      <div className="ipt-inline-actions">
        <Button type="button" variant="toolbar" size="sm" disabled={busy || demo} onClick={onReloadVoices}>{t('reloadVoices')}</Button>
        <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onUseExisting}>{t('useExistingAudio')}</Button>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUploadAudio}>{t('uploadAudio')}</Button>
      </div>
    </div>}
    <TalkDubSettings
      t={tDh}
      variant="compact"
      busy={busy}
      pending={pending}
      demo={demo}
      dubSourceMode={mode}
      onDubSourceModeChange={changeMode}
      voices={voices}
      voiceId={voiceId}
      onVoiceIdChange={onVoiceIdChange}
      speed={speed}
      onSpeedChange={onSpeedChange}
      hasAudio={hasAudio}
      audioMismatch={audioMismatch}
      voiceError={voiceError}
      onGenerateDub={onGenerateDub}
      onReloadVoices={onReloadVoices}
      onOpenWorkshop={onUseExisting}
      onUploadAudio={onUploadAudio}
      showRetryBinding={showRetryBinding}
      onRetryBinding={onRetryBinding}
    />
    <p className="ipt-help">{t('voiceNextHint')}</p>
  </TalkStepShell>
}
