import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import type { PersonaQuestionnaire } from '../../../services/persona/types'
import { polishQuestionnaireField } from '../agent/form-assist'
import { QUESTIONNAIRE_PRESETS } from '../lib/questionnaire-presets'
import { PersonaPresetPicker } from './PersonaPresetPicker'

type Props = {
  field: keyof PersonaQuestionnaire
  label: string
  value: string
  form: PersonaQuestionnaire
  multiline?: boolean
  rows?: number
  disabled?: boolean
  inputId?: string
  onChange: (value: string) => void
}

export function PersonaQuestionnaireField({
  field,
  label,
  value,
  form,
  multiline = false,
  rows = 3,
  disabled,
  inputId,
  onChange,
}: Props) {
  const { t } = useTranslation('persona')
  const [polishing, setPolishing] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [revision, setRevision] = useState<string | undefined>()
  const [polishError, setPolishError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const presets = QUESTIONNAIRE_PRESETS[field]
  const matchingOptions = useMemo(() => {
    if (!presets?.length) return []
    const query = value.trim().toLocaleLowerCase()
    if (!query) return []
    return presets.filter((option) => option !== value && option.toLocaleLowerCase().includes(query)).slice(0, 5)
  }, [presets, value])

  const polishLabels = useMemo<AIEditPopoverLabels>(
    () => ({
      trigger: t('form.optimizeField'),
      context: t('form.aiPopoverContext'),
      promptPlaceholder: t('form.aiPopoverPromptPlaceholder'),
      apply: t('form.adoptSuggestion'),
      dismiss: t('form.dismissRevision'),
      loading: t('form.aiPopoverLoading'),
      send: t('form.aiPopoverSend'),
      focusHint: t('form.aiPopoverFocusHint'),
      result: t('form.aiPopoverResult'),
    }),
    [t],
  )

  const quickPrompts = useMemo(
    () => [
      { label: t('form.tuneConcise'), instruction: t('form.tuneConcise') },
      { label: t('form.tuneSpecific'), instruction: t('form.tuneSpecific') },
      { label: t('form.tuneWarm'), instruction: t('form.tuneWarm') },
    ],
    [t],
  )

  async function runPolish(instruction: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPolishError('')
    setPolishing(true)
    setStreaming('')
    setRevision(undefined)
    try {
      const next = await polishQuestionnaireField({
        field,
        value,
        form,
        instruction: instruction.trim() || undefined,
        signal: controller.signal,
        onPartial: (text) => setStreaming(text),
      })
      setRevision(next)
    } catch (e) {
      if (!controller.signal.aborted) {
        setPolishError(e instanceof Error ? e.message : t('form.aiAssistError'))
      }
    } finally {
      if (abortRef.current === controller) {
        setPolishing(false)
        setStreaming('')
      }
    }
  }

  const aiControl = (
    <AIEditPopover
      fieldLabel={label}
      value={value}
      result={revision}
      streamingResult={streaming}
      busy={polishing}
      error={polishError}
      disabled={disabled}
      quickPrompts={quickPrompts}
      labels={polishLabels}
      onGenerate={(instruction) => void runPolish(instruction)}
      onApply={() => {
        if (revision) onChange(revision)
        setRevision(undefined)
      }}
      onDismiss={() => {
        setRevision(undefined)
        setPolishError('')
      }}
    />
  )

  return (
    <div className="persona-q-field-control">
      <div
        className={`persona-q-field-input-control${multiline ? ' persona-q-field-input-control--multiline' : ''}`}
      >
        {multiline ? (
          <Textarea
            id={inputId}
            value={value}
            rows={rows}
            disabled={disabled || polishing}
            onChange={(e) => {
              setRevision(undefined)
              onChange(e.target.value)
            }}
          />
        ) : (
          <Input
            id={inputId}
            value={value}
            disabled={disabled || polishing}
            onChange={(e) => {
              setRevision(undefined)
              onChange(e.target.value)
            }}
          />
        )}
        <div className="persona-q-field-input-control__actions" aria-hidden={false}>
          {presets?.length ? (
            <PersonaPresetPicker label={label} value={value} options={presets} disabled={disabled} onSelect={onChange} />
          ) : null}
          {aiControl}
        </div>
      </div>
      {matchingOptions.length ? (
        <span className="persona-q-field-suggestions" role="group" aria-label={t('form.suggestionsLabel', { field: label })}>
          {matchingOptions.map((option) => (
            <Button key={option} type="button" variant="outline" size="sm" onClick={() => onChange(option)}>
              {option}
            </Button>
          ))}
        </span>
      ) : null}
    </div>
  )
}
