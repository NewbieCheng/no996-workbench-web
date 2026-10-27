import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'

export function TalkEditStep({
  rail,
  stage,
  inspector,
  divider,
  timeline,
  timelineOpen,
  onToggleTimeline,
  onBack,
  onNext,
}: {
  rail: ReactNode
  stage: ReactNode
  inspector: ReactNode
  divider?: ReactNode
  timeline?: ReactNode
  timelineOpen: boolean
  onToggleTimeline: () => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useTalkV2Copy()
  return <section className="ipt-edit-step" data-stage="edit">
    <header className="ipt-edit-step__head">
      <div>
        <p className="ipt-step__eyebrow">{t('stepOf', { current: 5, total: 6 })}</p>
        <h2 className="ipt-step__title">{t('stepEdit')}</h2>
        <p className="ipt-step__hint">{t('stepEditHint')}</p>
      </div>
      <div className="ipt-edit-step__actions">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={15} />{t('previousStep')}</Button>
        {timeline ? <Button type="button" variant="toolbar" size="sm" aria-pressed={timelineOpen} onClick={onToggleTimeline}><Clock3 size={15} />{t('timeline')}</Button> : null}
        <Button type="button" variant="generate" size="sm" onClick={onNext}>{t('nextExport')}<ArrowRight size={15} /></Button>
      </div>
    </header>
    <div className="ipt-edit-grid">
      {rail}
      <div className="ipt-edit-center">
        {stage}
        {timelineOpen && timeline ? <div className="ipt-edit-timeline">{timeline}</div> : null}
      </div>
      {divider}
      {inspector}
    </div>
  </section>
}
