import { useRef, useState, type ReactNode } from 'react'
import { Lightbulb, Sparkles } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Textarea } from '@no996/ui/textarea'
import { HoverTip } from '@no996/ui/tooltip'
import type { TalkDirection } from '../../agent/types'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'

export function TalkContentStep({
  brief,
  onBriefChange,
  onRemember,
  hasResult,
  hasScript,
  busy,
  demo,
  directions,
  canSuggest,
  canNext,
  blocker,
  contentConfirmed,
  selectedDirectionTitle,
  assetStrip,
  onAddFiles,
  onDirections,
  onUseDirection,
  onOpenAdvanced,
  onNext,
}: {
  brief: string
  onBriefChange: (value: string) => void
  onRemember: () => void
  hasResult: boolean
  hasScript: boolean
  busy: boolean
  demo: boolean
  directions: TalkDirection[] | null
  canSuggest: boolean
  canNext: boolean
  blocker?: string
  contentConfirmed?: boolean
  selectedDirectionTitle?: string
  assetStrip: ReactNode
  onAddFiles: (files: File[]) => void
  onDirections: () => void
  onUseDirection: (direction: TalkDirection) => void
  onOpenAdvanced: () => void
  onNext: () => void
}) {
  const { t } = useTalkV2Copy()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [needContext, setNeedContext] = useState(false)
  const requestDirections = () => {
    if (!canSuggest) { setNeedContext(true); inputRef.current?.focus(); return }
    setNeedContext(false)
    onDirections()
  }
  return <TalkStepShell
    stage="content"
    title={t(hasResult ? 'adjustTitle' : 'briefTitle')}
    hint={t(hasResult ? 'adjustHint' : 'briefHint')}
    primary={{
      label: contentConfirmed && !hasResult ? t('continueWithDirection') : t('nextVisual'),
      onClick: onNext,
      disabled: busy || !canNext,
      icon: 'next',
      testId: 'ipt-next-visual',
    }}
    secondary={{ label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: busy }}
    blocker={blocker}
  >
    <div
      className="ipt-brief-surface"
      onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }}
      onDrop={event => {
        if (!event.dataTransfer.files.length) return
        event.preventDefault()
        event.stopPropagation()
        onAddFiles(Array.from(event.dataTransfer.files))
      }}
    >
      <label className="sr-only" htmlFor="ip-talk-brief">{t(hasResult ? 'adjustLabel' : 'inputLabel')}</label>
      <Textarea
        id="ip-talk-brief"
        ref={inputRef}
        value={brief}
        disabled={busy}
        maxLength={hasResult ? 2000 : 12000}
        placeholder={t(needContext ? 'contextPlaceholder' : hasResult ? 'adjustPlaceholder' : 'inputPlaceholder')}
        onChange={event => { onBriefChange(event.target.value); setNeedContext(false) }}
        onBlur={onRemember}
      />
      {assetStrip}
      <div className="ipt-brief-tools">
        <span className="ipt-brief-tools__spacer" />
        {!hasResult && <HoverTip label={t('inspirationHint')} enabled={!canSuggest && !busy}>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground" disabled={busy || !canSuggest} onClick={requestDirections}>
            <Lightbulb className="size-3.5 mr-1" />{t('inspiration')}
          </Button>
        </HoverTip>}
      </div>
    </div>
    {needContext && <p className="ipt-context-question" role="status">{t('contextHint')}</p>}
    {selectedDirectionTitle ? <p className="ipt-direction-chip" role="status">{t('directionSelected', { title: selectedDirectionTitle })}</p> : null}
    <p className="ipt-help ipt-brief-cost">{t(demo ? 'demoHint' : 'paidHint')}</p>
    {!hasScript && !hasResult && <p className="ipt-help">{t('scriptLaterHint')}</p>}
    {directions && <section className="ipt-directions" aria-label={t('directions')}>
      <div className="ipt-section-heading"><h3>{t('directions')}</h3><span className="ipt-help">{t(demo ? 'demoDirections' : 'preparedDirections')}</span></div>
      {directions.map((direction, index) => <article key={`${index}:${direction.title}`} className="ipt-direction">
        <div><h4>{direction.title}{index === 0 && <span>{t('recommended')}</span>}</h4><p>{direction.opening}</p><small>{direction.reason}</small></div>
        <Button type="button" variant={index === 0 ? 'generate' : 'toolbar'} size="sm" disabled={busy} onClick={() => onUseDirection(direction)}>
          <Sparkles size={14} />
          {t('useDirectionFill')}
        </Button>
      </article>)}
    </section>}
  </TalkStepShell>
}
