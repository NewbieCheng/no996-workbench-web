import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'

export type TalkGenerateSummary = {
  label: string
  value: string
  hint?: string
  onEdit?: () => void
}

export type TalkGenerateChecklistItem = {
  id: string
  label: string
  ready: boolean
  detail: string
  onFix?: () => void
}

export function TalkGenerateStep({
  summaries,
  checklist,
  canGenerate,
  canDirectEdit,
  busy,
  demo,
  hasResult,
  blocker,
  lastFailure,
  onDismissFailure,
  notices,
  processPanel,
  onGenerate,
  onDirectEdit,
  onBack,
  onOpenAdvanced,
}: {
  summaries: TalkGenerateSummary[]
  checklist?: TalkGenerateChecklistItem[]
  canGenerate: boolean
  canDirectEdit: boolean
  busy: boolean
  demo: boolean
  hasResult: boolean
  blocker?: string
  lastFailure?: string | null
  onDismissFailure?: () => void
  notices?: ReactNode
  processPanel?: ReactNode
  onGenerate: () => void
  onDirectEdit: () => void
  onBack: () => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  return <TalkStepShell
    stage="generate"
    title={t(hasResult ? 'stepGenerateAdjust' : 'stepGenerate')}
    hint={t(hasResult ? 'stepGenerateAdjustHint' : 'stepGenerateHint')}
    primary={{
      label: t(hasResult ? 'applyAdjustment' : demo ? 'makeDemo' : 'make'),
      onClick: onGenerate,
      disabled: !canGenerate,
      busy,
      icon: 'sparkles',
      testId: 'ipt-generate',
    }}
    secondary={canDirectEdit ? { label: t('previewMedia'), onClick: onDirectEdit, disabled: busy } : { label: t('advancedSettings'), onClick: onOpenAdvanced, disabled: busy }}
    blocker={blocker}
    onBack={onBack}
  >
    {lastFailure ? <div className="ipt-inline-banner" role="status">
      <AlertCircle size={15} aria-hidden />
      <div>
        <strong>{t('lastFailureTitle')}</strong>
        <p>{lastFailure}</p>
      </div>
      {onDismissFailure ? <Button type="button" variant="ghost" size="sm" onClick={onDismissFailure}>{t('dismissFailure')}</Button> : null}
    </div> : null}
    {checklist && checklist.length > 0 ? <section className="ipt-checklist" aria-label={t('readyChecklist')}>
      <div className="ipt-section-heading"><h3>{t('readyChecklist')}</h3></div>
      <ul>
        {checklist.map(item => <li key={item.id} data-ready={item.ready || undefined}>
          {item.ready ? <CheckCircle2 size={15} aria-hidden /> : <AlertCircle size={15} aria-hidden />}
          <div>
            <strong>{item.label}</strong>
            <small>{item.detail}</small>
          </div>
          {!item.ready && item.onFix ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={item.onFix}>{t('goFix')}</Button> : null}
        </li>)}
      </ul>
    </section> : null}
    {notices}
    <section className="ipt-review" aria-label={t('generateSummary')}>
      <div className="ipt-section-heading"><h3>{t('generateSummary')}</h3><Button type="button" variant="ghost" size="sm" onClick={onOpenAdvanced} disabled={busy}><Pencil size={14} />{t('editPreferences')}</Button></div>
      <dl>
        {summaries.map(item => <div key={item.label} className="ipt-review__row">
          <dt>{item.label}</dt>
          <dd>{item.value}{item.hint ? <small>{item.hint}</small> : null}</dd>
          {item.onEdit ? <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={item.onEdit}>{t('change')}</Button> : null}
        </div>)}
      </dl>
    </section>
    {demo && <p className="ipt-help">{t('demoHint')}</p>}
    <p className="ipt-help">{t('paidHint')}</p>
    {processPanel}
  </TalkStepShell>
}
