import type { TFunction } from 'i18next'
import { RotateCcw } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { VOICE_SPEED_MAX, VOICE_SPEED_MIN } from '../../../lib/voice-speed'
import {
  DigitalHumanDubModeMenu,
  DigitalHumanImportDubPanel,
  DigitalHumanVoiceFooterMenu,
  type DigitalHumanDubSourceMode,
} from '../../digital-human/DigitalHumanDubSettingsControls'
import '../../digital-human/digital-human.css'

export type TalkDubSettingsProps = {
  t: TFunction<'digitalHuman'>
  variant?: 'panel' | 'compact'
  busy: boolean
  pending: boolean
  demo: boolean
  dubSourceMode: DigitalHumanDubSourceMode
  onDubSourceModeChange: (mode: DigitalHumanDubSourceMode) => void
  voices: Array<{ id: string; label: string }>
  voiceId: string
  onVoiceIdChange: (id: string) => void
  speed: number
  onSpeedChange: (speed: number) => void
  hasAudio: boolean
  audioMismatch: boolean
  voiceError?: string
  onGenerateDub: () => void
  onReloadVoices: () => void
  onOpenWorkshop: () => void
  onUploadAudio: () => void
  /** Not supported by IP talking video; omit to hide the row. */
  onOpenAudioUrl?: () => void
  onImportDemo?: () => void
  onRetryBinding?: () => void
  showRetryBinding?: boolean
}

export function TalkDubSettings({
  t,
  variant = 'panel',
  busy,
  pending,
  demo,
  dubSourceMode,
  onDubSourceModeChange,
  voices,
  voiceId,
  onVoiceIdChange,
  speed,
  onSpeedChange,
  hasAudio,
  audioMismatch,
  voiceError,
  onGenerateDub,
  onReloadVoices,
  onOpenWorkshop,
  onUploadAudio,
  onOpenAudioUrl,
  onImportDemo,
  onRetryBinding,
  showRetryBinding,
}: TalkDubSettingsProps) {
  const isDubbingActive = pending
  const currentVoiceLabel = voices.find(v => v.id === voiceId)?.label || voiceId || t('dubMenuVoiceHint')
  const showChrome = variant === 'panel'

  return (
    <div className="ipt-panel-body ipt-dub-settings-root">
      {showChrome ? (
        <section className="dh-dub-settings" aria-labelledby="ipt-dub-settings-title">
          <div className="dh-dub-settings__head">
            <div className="dh-dub-settings__shot flex items-center gap-2 min-w-0 flex-1">
              <h3 id="ipt-dub-settings-title" className="truncate min-w-0 flex-1">
                口播配音
              </h3>
              <DigitalHumanDubModeMenu
                t={t}
                busy={busy}
                pending={pending}
                dubSourceMode={dubSourceMode}
                onDubSourceModeChange={onDubSourceModeChange}
              />
            </div>
            <div className="dh-dub-settings__controls">
              {dubSourceMode === 'ai' ? (
                <DigitalHumanVoiceFooterMenu
                  t={t}
                  busy={busy}
                  pending={pending}
                  isDubbingActive={isDubbingActive}
                  hasAudio={hasAudio}
                  voices={voices}
                  voiceId={voiceId}
                  onVoiceIdChange={onVoiceIdChange}
                  currentVoiceLabel={currentVoiceLabel}
                  onGenerateDub={onGenerateDub}
                />
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <div className="dh-dub-settings__controls ipt-dub-settings-compact">
          <DigitalHumanVoiceFooterMenu
            t={t}
            busy={busy}
            pending={pending}
            isDubbingActive={isDubbingActive}
            hasAudio={hasAudio}
            voices={voices}
            voiceId={voiceId}
            onVoiceIdChange={onVoiceIdChange}
            currentVoiceLabel={currentVoiceLabel}
            onGenerateDub={onGenerateDub}
          />
        </div>
      )}

      {dubSourceMode === 'import' ? (
        <DigitalHumanImportDubPanel
          t={t}
          busy={busy}
          pending={pending}
          hasAudio={hasAudio}
          onOpenWorkshop={onOpenWorkshop}
          onUploadClick={onUploadAudio}
          onOpenAudioUrl={onOpenAudioUrl}
          onImportDemo={onImportDemo}
        />
      ) : null}

      {dubSourceMode === 'ai' ? (
        <>
          <label className="ipt-field">
            新配音语速 · {speed}×
            <Input
              type="range"
              min={VOICE_SPEED_MIN}
              max={VOICE_SPEED_MAX}
              step={0.1}
              value={speed}
              disabled={busy}
              onChange={event => onSpeedChange(Number(event.target.value))}
            />
          </label>
          {audioMismatch ? (
            <div className="dh-script-mismatch-banner">
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <RotateCcw size={13} className="flex-shrink-0" aria-hidden />
                <span>文稿已修改，与当前配音不一致。可重新配音或保留原声。</span>
              </div>
            </div>
          ) : null}
          {voiceError ? <p className="ipt-help">{voiceError}</p> : null}
          <p className="ipt-help">
            {demo
              ? '演示模式不提交正式配音，可导入自己的音频。'
              : '只影响下一次生成。修改字体、镜头或画面不会重新配音。费用以服务端结算为准。'}
          </p>
          <div className="ipt-inline-actions">
            <Button type="button" variant="ghost" size="sm" disabled={busy || demo} onClick={onReloadVoices}>
              重新读取音色
            </Button>
          </div>
          {showRetryBinding && onRetryBinding ? (
            <Button type="button" variant="toolbar" disabled={busy} onClick={onRetryBinding}>
              重新读取已完成配音（不重新生成）
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
