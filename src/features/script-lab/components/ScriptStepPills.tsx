import { RotateCcw } from 'lucide-react'
import type { InputWizardStep } from '../../../components/agent/InputWizard'
import i18n from '@/i18n'

export type ScriptStepPillsProps = {
  steps: InputWizardStep[]
  active: number
  onStepChange: (index: number) => void
  onReset?: () => void
}

export function ScriptStepPills({ steps, active, onStepChange, onReset }: ScriptStepPillsProps) {
  const resetLabel = i18n.t('common:reset')
  return (
    <div className="sl-wiz-steps-row">
    <nav className="sl-wiz-steps" aria-label={i18n.t("uiCopy:向导步骤", { keySeparator: false })}>
      {steps.map((s, i) => {
        const done = i < active
        const cur = i === active
        const label = i === steps.length - 1 ? `${s.label} · 可跳过` : s.label
        return (
          <button
            key={s.id}
            type="button"
            className={`sl-wiz-stp${cur ? ' sl-wiz-stp--cur' : ''}${done ? ' sl-wiz-stp--ok' : ''}`}
            onClick={() => onStepChange(i)}
            aria-current={cur ? 'step' : undefined}
          >
            <span className="sl-wiz-stp__dot" aria-hidden="true">{done ? '✓' : i + 1}</span>
            {label}
          </button>
        )
      })}
    </nav>
    {onReset ? (
      <button
        type="button"
        className="sl-wiz-reset-btn"
        onClick={onReset}
        aria-label={resetLabel}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      </button>
    ) : null}
    </div>
  )
}

export default ScriptStepPills
