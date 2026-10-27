import { Check, Lock, Settings2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { useTalkV2Copy } from '../v2-copy'
import { canEnterTalkStage, TALK_PIPELINE_STEPS, talkStageNumber, type TalkStageId } from '../talk-pipeline'

export function TalkPipelineRail({
  stage,
  hasResult,
  hasDuration,
  canGenerate,
  busy,
  onSelect,
  onOpenAdvanced,
}: {
  stage: TalkStageId
  hasResult: boolean
  hasDuration: boolean
  canGenerate: boolean
  busy: boolean
  onSelect: (stage: TalkStageId) => void
  onOpenAdvanced: () => void
}) {
  const { t } = useTalkV2Copy()
  return <nav className="ipt-pipeline" aria-label={t('pipelineLabel')}>
    <ol className="ipt-pipeline__steps">
      {TALK_PIPELINE_STEPS.map(step => {
        const availability = canEnterTalkStage(step.id, { hasResult, hasDuration, canGenerate })
        const current = step.id === stage
        const done = (step.id === 'edit' || step.id === 'export') && hasResult && !current
        const disabled = busy || !availability.allowed
        const reason = availability.reasonKey ? t(availability.reasonKey) : undefined
        return <li key={step.id} className="ipt-pipeline__item" data-current={current || undefined} data-done={done || undefined} data-disabled={disabled || undefined}>
          <HoverTip label={reason ?? t(step.hintKey)} enabled>
            <button
              type="button"
              className="ipt-pipeline__step"
              aria-current={current ? 'step' : undefined}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onClick={() => onSelect(step.id)}
            >
              <span className="ipt-pipeline__number" aria-hidden="true">
                {done ? <Check size={14} /> : disabled && !current ? <Lock size={12} /> : talkStageNumber(step.id)}
              </span>
              <span className="ipt-pipeline__label">{t(step.labelKey)}</span>
            </button>
          </HoverTip>
        </li>
      })}
    </ol>
    <HoverTip label={t('advancedSettings')} enabled>
      <Button type="button" variant="toolbar" size="sm" className="ipt-pipeline__advanced" onClick={onOpenAdvanced}>
        <Settings2 size={15} />
        <span>{t('advancedSettings')}</span>
      </Button>
    </HoverTip>
  </nav>
}
