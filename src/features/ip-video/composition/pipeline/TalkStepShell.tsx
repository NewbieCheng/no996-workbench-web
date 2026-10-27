import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, LoaderCircle, Sparkles } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { useTalkV2Copy } from '../v2-copy'
import { talkStageNumber, type TalkStageId } from '../talk-pipeline'

export type TalkStepAction = {
  label: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  icon?: 'next' | 'sparkles'
  testId?: string
}

export function TalkStepShell({
  stage,
  title,
  hint,
  children,
  primary,
  secondary,
  onBack,
  backLabel,
  className,
  bodyClassName,
}: {
  stage: TalkStageId
  title: string
  hint: string
  children: ReactNode
  primary?: TalkStepAction
  secondary?: TalkStepAction
  onBack?: () => void
  backLabel?: string
  className?: string
  bodyClassName?: string
}) {
  const { t } = useTalkV2Copy()
  const Icon = primary?.icon === 'sparkles' ? Sparkles : ArrowRight
  return <section className={`ipt-step${className ? ` ${className}` : ''}`} data-stage={stage}>
    <header className="ipt-step__head">
      <p className="ipt-step__eyebrow">{t('stepOf', { current: talkStageNumber(stage), total: 6 })}</p>
      <h2 className="ipt-step__title">{title}</h2>
      <p className="ipt-step__hint">{hint}</p>
    </header>
    <div className={`ipt-step__body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>
    {(primary || secondary || onBack) && <footer className="ipt-step__footer">
      <div className="ipt-step__back">
        {onBack && <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={primary?.busy}>
          <ArrowLeft size={15} />
          {backLabel ?? t('previousStep')}
        </Button>}
      </div>
      <div className="ipt-step__actions">
        {secondary && <Button type="button" variant="toolbar" size="sm" disabled={secondary.disabled || secondary.busy} onClick={secondary.onClick}>
          {secondary.busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
          {secondary.label}
        </Button>}
        {primary && <Button type="button" variant="generate" size="sm" disabled={primary.disabled || primary.busy} onClick={primary.onClick} data-testid={primary.testId}>
          {primary.busy ? <LoaderCircle size={15} className="animate-spin" /> : <Icon size={15} />}
          {primary.label}
        </Button>}
      </div>
    </footer>}
  </section>
}
