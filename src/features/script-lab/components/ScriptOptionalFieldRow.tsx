import type { ReactNode } from 'react'
import { AIEditPopover } from '@no996/ui/ai-edit-popover'
import type { AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { FieldPresetPicker } from '../../../components/agent/FieldPresetPicker'
import type { ScriptOptionalFieldId } from '../agent/form-assist'

export type ScriptFieldRevision = {
  original: string
  suggestion: string
}

type Props = {
  fieldId: ScriptOptionalFieldId
  label: string
  placeholder: string
  value: string
  maxLength: number
  multiline?: boolean
  rows?: number
  filledBadge: ReactNode
  presetOptions: readonly string[]
  disabled?: boolean
  revision?: ScriptFieldRevision | null
  streamingSuggestion?: string
  polishing?: boolean
  tuning?: boolean
  polishError?: string
  onChange: (value: string) => void
  onPolish: () => void
  onTune: (instruction: string) => void
  onAdopt: () => void
  onDismissRevision: () => void
}

const POPOVER_LABELS: AIEditPopoverLabels = {
  trigger: 'AI 优化',
  context: '根据产品与已填信息润色本字段',
  promptPlaceholder: '例如：更口语、更短一点',
  apply: '采纳',
  dismiss: '保留原文',
  loading: '生成中…',
  send: '发送',
  focusHint: 'Enter 发送',
  result: '建议文案',
}

const TUNE_PROMPTS = [
  { label: '更简洁', instruction: '更简洁' },
  { label: '更具体', instruction: '更具体' },
  { label: '更口语', instruction: '更口语' },
]

function fieldLayoutClass(fieldId: ScriptOptionalFieldId): string {
  if (fieldId === 'intro' || fieldId === 'pain') return ' sl-wiz-fld--full'
  return ''
}

export function ScriptOptionalFieldRow({
  fieldId,
  label,
  placeholder,
  value,
  maxLength,
  multiline,
  rows = 2,
  filledBadge,
  presetOptions,
  disabled,
  revision,
  streamingSuggestion,
  polishing,
  tuning,
  polishError,
  onChange,
  onPolish,
  onTune,
  onAdopt,
  onDismissRevision,
}: Props) {
  const inputId = `sl-opt-${fieldId}`

  return (
    <label className={`sl-wiz-fld${fieldLayoutClass(fieldId)}`}>
      <span className="sl-wiz-fld__label sl-wiz-fld__label--actions">
        <span className="sl-wiz-fld__label-text">
          {label}
          {filledBadge}
        </span>
        <span className="sl-wiz-fld__label-actions">
          <AIEditPopover
            fieldLabel={label}
            value={value}
            result={revision?.suggestion}
            streamingResult={polishing || tuning ? streamingSuggestion : undefined}
            busy={Boolean(polishing || tuning)}
            error={polishError}
            disabled={disabled}
            quickPrompts={TUNE_PROMPTS}
            labels={POPOVER_LABELS}
            triggerClassName="ai-edit-popover--profile"
            className="ai-edit-popover--profile"
            onGenerate={(instruction) => (instruction ? onTune(instruction) : onPolish())}
            onApply={onAdopt}
            onDismiss={onDismissRevision}
          />
        </span>
      </span>
      <div className={`sl-wiz-field-control${multiline ? ' sl-wiz-field-control--multiline' : ''}`}>
        {multiline ? (
          <textarea
            id={inputId}
            className="sl-wiz-txt"
            maxLength={maxLength}
            rows={rows}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            id={inputId}
            className="sl-wiz-txt"
            maxLength={maxLength}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
        <FieldPresetPicker
          label={label}
          value={value}
          options={presetOptions}
          disabled={disabled}
          onSelect={onChange}
        />
      </div>
    </label>
  )
}
