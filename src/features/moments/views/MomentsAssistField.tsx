import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { Textarea } from '@no996/ui/textarea'
import { FieldPresetPicker } from '../../../components/agent/FieldPresetPicker'
import { polishMomentsConfigField, type MomentsConfigFieldId } from '../agent/schedule-field-assist'
import { withCurrentOption } from '../agent/stages'

type Props = {
  field: MomentsConfigFieldId
  inputId: string
  label: string
  value: string
  mode: 'daily' | 'theme'
  productName: string
  activityName: string
  relatedFieldLabel: string
  relatedValue: string
  presetOptions: readonly string[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function MomentsAssistField({ field, inputId, label, value, mode, productName, activityName, relatedFieldLabel, relatedValue, presetOptions, disabled, onChange }: Props) {
  const { t } = useTranslation('workbench')
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [result, setResult] = useState<string>()
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const pickerOptions = useMemo(() => withCurrentOption([...presetOptions], value), [presetOptions, value])
  const labels = useMemo<AIEditPopoverLabels>(() => ({
    trigger: t('momentsFieldAiOptimize'),
    context: t(field === 'businessPurpose' ? 'momentsConfigPurposeAiContext' : 'momentsConfigTasksAiContext'),
    promptPlaceholder: t('momentsFieldAiPromptPlaceholder'),
    apply: t('momentsFieldAiApply'), dismiss: t('momentsFieldAiDismiss'), loading: t('momentsFieldAiLoading'),
    send: t('momentsFieldAiSend'), focusHint: t('momentsFieldAiFocusHint'), result: t('momentsFieldAiResult'),
  }), [field, t])
  const quickPrompts = useMemo(() => [
    { label: t('momentsFieldTuneCloserPreset'), instruction: t('momentsFieldTuneCloserPreset') },
    { label: t('momentsFieldTuneShorter'), instruction: t('momentsFieldTuneShorter') },
  ], [t])
  async function polish(instruction: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true); setError(''); setStreaming(''); setResult(undefined)
    try {
      setResult(await polishMomentsConfigField({ field, fieldLabel: label, value, mode, productName, activityName, relatedFieldLabel, relatedValue, presetHints: presetOptions, instruction: instruction.trim() || undefined, signal: controller.signal, onPartial: setStreaming }))
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : t('momentsFieldAiError'))
    } finally {
      if (abortRef.current === controller) { abortRef.current = null; setBusy(false); setStreaming('') }
    }
  }
  return <div className="moments-field-input-control">
    <Textarea id={inputId} value={value} rows={4} disabled={disabled || busy} onChange={event => { setResult(undefined); onChange(event.target.value) }} />
    <div className="moments-field-input-control__actions">
      <FieldPresetPicker label={label} value={value} options={pickerOptions} disabled={disabled || busy} onSelect={next => { setResult(undefined); onChange(next) }} />
      <AIEditPopover fieldLabel={label} value={value} result={result} streamingResult={streaming} busy={busy} error={error} disabled={disabled} quickPrompts={quickPrompts} labels={labels} triggerClassName="ai-edit-popover--profile" className="ai-edit-popover--profile" onGenerate={instruction => void polish(instruction)} onApply={() => { if (result) onChange(result); setResult(undefined) }} onDismiss={() => { setResult(undefined); setError('') }} />
    </div>
  </div>
}
