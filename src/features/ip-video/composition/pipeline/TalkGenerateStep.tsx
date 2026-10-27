import type { ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'
import { TalkStepShell } from './TalkStepShell'

export type TalkGenerateSummary = {
  label: string
  value: string
  hint?: string
  onEdit?: () => void
}

export function TalkGenerateStep({
  summaries,
  canGenerate,
  canDirectEdit,
  busy,
  demo,
  hasResult,
  notices,
  processPanel,
  onGenerate,
  onDirectEdit,
  onBack,
  onOpenAdvanced,
}: {
  summaries: TalkGenerateSummary[]
  canGenerate: boolean
  canDirectEdit: boolean
  busy: boolean
  demo: boolean
  hasResult: boolean
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
    onBack={onBack}
  >
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
