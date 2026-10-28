import { ImagePlus, Sparkles } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'
import { TalkFormatPicker } from '../TalkFormatPicker'
import { TalkLookStrip } from '../TalkLookStrip'
import { talkAspectCss, type TalkFormatRatio } from '../talk-format'
import { TalkStepShell } from './TalkStepShell'

export function TalkVisualStep({
  ratio,
  lookId,
  busy,
  canNext = true,
  blocker,
  onFormat,
  onLook,
  onBrowse,
  onAiImage,
  onNext,
  onBack,
  onOpenAdvanced,
}: {
  ratio: string
  lookId?: string
  busy: boolean
  canNext?: boolean
  blocker?: string
  onFormat: (ratio: TalkFormatRatio) => void
  onLook: (lookId: string) => void
  onBrowse: () => void
  onAiImage?: () => void
  onNext: () => void
  onBack: () => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  return <TalkStepShell
    stage="visual"
    title={t('stepVisual')}
    hint={t('stepVisualHint')}
    primary={{ label: t('nextVoice'), onClick: onNext, disabled: busy || !canNext, icon: 'next', testId: 'ipt-next-voice' }}
    secondary={{ label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: busy }}
    blocker={blocker}
    onBack={onBack}
  >
    <section className="ipt-step-section" aria-labelledby="ipt-format-title">
      <div className="ipt-section-heading"><h3 id="ipt-format-title">{t('formatPicker')}</h3><span className="ipt-help">{t('formatHint')}</span></div>
      <TalkFormatPicker value={ratio} busy={busy} onSelect={onFormat} />
      {ratio === '3:4' && <div className="ipt-legacy-notice" role="status">
        <span>{t('legacyCoverNotice')}</span>
        <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={() => onFormat('1:1')}>{t('legacyCoverAction')}</Button>
      </div>}
    </section>
    <section className="ipt-step-section" aria-labelledby="ipt-look-title">
      <div className="ipt-section-heading"><h3 id="ipt-look-title">{t('lookStrip')}</h3><Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onBrowse}>{t('browseLooks')}</Button></div>
      <p className="ipt-help">{t('lookStripHint')}</p>
      <TalkLookStrip selectedId={lookId} aspect={talkAspectCss(ratio)} busy={busy} compact onSelect={onLook} onBrowse={onBrowse} />
      <p className="ipt-help">{t('lookLocksHint')}</p>
    </section>
    {onAiImage && <section className="ipt-step-section">
      <div className="ipt-section-heading"><h3>{t('aiImageTitle')}</h3><span className="ipt-help">{t('aiImageHint')}</span></div>
      <Button type="button" variant="toolbar" size="sm" disabled={busy} onClick={onAiImage}>
        <ImagePlus size={15} />
        <Sparkles size={13} />
        {t('aiImageOpen')}
      </Button>
    </section>}
  </TalkStepShell>
}
