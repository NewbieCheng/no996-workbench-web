import { useMemo } from 'react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { FormField } from '@no996/ui/module-form'
import { AIEditPopover } from '@no996/ui/ai-edit-popover'
import type { AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { PersonaPresetPicker } from './PersonaPresetPicker'
import type { UserProfileFormData } from '../../../services/persona'

export type PersonaFieldKey = keyof UserProfileFormData

export type FieldRevision = {
  original: string
  suggestion: string
}

export type PersonaFieldVariant = 'hero' | 'default' | 'compact'

type Props = {
  fieldKey: PersonaFieldKey
  label: string
  placeholder: string
  value: string
  required?: boolean
  multiline?: boolean
  variant?: PersonaFieldVariant
  disabled?: boolean
  invalid?: boolean
  error?: string
  revision?: FieldRevision | null
  streamingSuggestion?: string
  polishing?: boolean
  tuning?: boolean
  polishError?: string
  options?: readonly string[]
  suggestionsLabel?: string
  labels: {
    tuneConcise: string
    tuneSpecific: string
    tuneWarm: string
  }
  popoverLabels: AIEditPopoverLabels
  onChange: (value: string) => void
  onPolish: () => void
  onTune: (instruction: string) => void
  onAdopt: () => void
  onDismissRevision: () => void
}

export function ProfileFormFieldCard({
  fieldKey,
  label,
  placeholder,
  value,
  required,
  multiline,
  variant = 'default',
  disabled,
  invalid,
  error,
  revision,
  streamingSuggestion,
  polishing,
  tuning = false,
  polishError,
  options,
  suggestionsLabel = '匹配选项',
  labels,
  popoverLabels,
  onChange,
  onPolish,
  onTune,
  onAdopt,
  onDismissRevision,
}: Props) {
  const matchingOptions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase()
    if (!query || !options?.length) return []
    return options
      .filter((option) => option !== value && option.toLocaleLowerCase().includes(query))
      .slice(0, 5)
  }, [options, value])
  const showSuggestions = matchingOptions.length > 0
  const inputId = `persona-${fieldKey}`

  return (
    <div
      className="persona-field-row"
      data-variant={variant}
      data-invalid={invalid ? '' : undefined}
    >
      <FormField
        className="persona-field-row__field"
        label={label}
        required={required}
        htmlFor={inputId}
        error={error}
        labelAction={(
          <AIEditPopover
            fieldLabel={label}
            value={value}
            result={revision?.suggestion}
            streamingResult={polishing || tuning ? streamingSuggestion : undefined}
            busy={Boolean(polishing || tuning)}
            error={polishError}
            disabled={disabled}
            quickPrompts={[
              { label: labels.tuneConcise, instruction: labels.tuneConcise },
              { label: labels.tuneSpecific, instruction: labels.tuneSpecific },
              { label: labels.tuneWarm, instruction: labels.tuneWarm },
            ]}
            labels={popoverLabels}
            onGenerate={(instruction) => instruction ? onTune(instruction) : onPolish()}
            onApply={onAdopt}
            onDismiss={onDismissRevision}
          />
        )}
      >
        <div className="persona-field-row__body">
          <div className={`persona-field-input-control${multiline ? ' persona-field-input-control--multiline' : ''}`}>
            {multiline ? (
              <Textarea
                id={inputId}
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                rows={variant === 'hero' ? 4 : 2}
                aria-invalid={invalid}
                onChange={(e) => onChange(e.target.value)}
              />
            ) : (
              <Input
                id={inputId}
                value={value}
                disabled={disabled}
                placeholder={placeholder}
                aria-invalid={invalid}
                onChange={(e) => onChange(e.target.value)}
              />
            )}
            {options?.length ? (
              <PersonaPresetPicker label={label} value={value} options={options} disabled={disabled} onSelect={onChange} />
            ) : null}
          </div>
          {showSuggestions ? (
            <div className="persona-field-suggestions" role="group" aria-label={suggestionsLabel}>
              {matchingOptions.map((option) => (
                <Button key={option} type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(option)}>
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </FormField>
    </div>
  )
}
