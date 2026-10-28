import { AudioLines } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { TalkVoiceMiniPanel } from '../TalkVoiceMiniPanel'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'

export function TalkVoiceStep({
  voices,
  voiceId,
  speed,
  voiceError,
  hasAudio,
  audioMismatch,
  busy,
  pending,
  demo,
  canNext,
  blocker,
  voiceSkipped,
  showRetryBinding,
  onVoiceIdChange,
  onSpeedChange,
  onGenerateDub,
  onReloadVoices,
  onUseExisting,
  onUploadAudio,
  onSkipVoice,
  onRetryBinding,
  onNext,
  onBack,
  onOpenAdvanced,
}: {
  voices: Array<{ id: string; label: string }>
  voiceId: string
  speed: number
  voiceError?: string
  hasAudio: boolean
  audioMismatch: boolean
  busy: boolean
  pending: boolean
  demo: boolean
  canNext: boolean
  blocker?: string
  voiceSkipped?: boolean
  showRetryBinding?: boolean
  onVoiceIdChange: (id: string) => void
  onSpeedChange: (speed: number) => void
  onGenerateDub: () => void
  onReloadVoices: () => void
  onUseExisting: () => void
  onUploadAudio: () => void
  onSkipVoice: () => void
  onRetryBinding?: () => void
  onNext: () => void
  onBack: () => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  return <TalkStepShell
    stage="voice"
    title={t('stepVoice')}
    hint={t('stepVoiceHint')}
    primary={{ label: t('nextGenerate'), onClick: onNext, disabled: busy || !canNext, icon: 'next', testId: 'ipt-next-generate' }}
    secondary={{ label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: busy }}
    blocker={blocker}
    onBack={onBack}
  >
    <div className="ipt-voice-status" data-ready={hasAudio || !!voiceId || voiceSkipped}>
      <span className="ipt-voice-status__icon" aria-hidden><AudioLines size={16} /></span>
      <div>
        <strong>{hasAudio ? t('voiceReady') : voiceId ? t('voiceSelected') : voiceSkipped ? t('voiceSkipped') : t('voiceMissing')}</strong>
        <small>{audioMismatch ? t('voiceMismatch') : hasAudio ? t('voiceKeepHint') : voiceSkipped ? t('voiceSkipHint') : t('voiceChooseHint')}</small>
      </div>
      {hasAudio && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onUseExisting}>{t('changeVoice')}</Button>}
    </div>
    <TalkVoiceMiniPanel
      voices={voices}
      voiceId={voiceId}
      speed={speed}
      busy={busy}
      pending={pending}
      demo={demo}
      voiceError={voiceError}
      onVoiceIdChange={onVoiceIdChange}
      onSpeedChange={onSpeedChange}
      onGenerateDub={onGenerateDub}
      onReloadVoices={onReloadVoices}
      onUseExisting={onUseExisting}
      onUploadAudio={onUploadAudio}
    />
    <div className="ipt-inline-actions">
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onSkipVoice}>{t('skipVoice')}</Button>
      {showRetryBinding && onRetryBinding ? <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onRetryBinding}>{t('retryBinding')}</Button> : null}
    </div>
  </TalkStepShell>
}
