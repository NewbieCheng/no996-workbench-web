import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@no996/ui/input'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { FieldPresetPicker } from '../../../components/agent/FieldPresetPicker'
import { polishMomentsContentDirection } from '../agent/schedule-field-assist'
import { withCurrentOption } from '../agent/stages'

type Props = {
  inputId: string
  value: string
  topic: string
  mode: 'daily' | 'theme'
  presetOptions: readonly string[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function MomentsContentDirectionField({
  inputId,
  value,
  topic,
  mode,
  presetOptions,
  disabled,
  onChange,
}: Props) {
  const { t } = useTranslation('workbench')
  const label = t('momentsContentDirection')
  const [polishing, setPolishing] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [revision, setRevision] = useState<string | undefined>()
  const [polishError, setPolishError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const pickerOptions = useMemo(
    () => withCurrentOption([...presetOptions], value),
    [presetOptions, value],
  )

  const polishLabels = useMemo<AIEditPopoverLabels>(
    () => ({
      trigger: t('momentsFieldAiOptimize'),
      context: t('momentsFieldAiContextDirection'),
      promptPlaceholder: t('momentsFieldAiPromptPlaceholder'),
      apply: t('momentsFieldAiApply'),
      dismiss: t('momentsFieldAiDismiss'),
      loading: t('momentsFieldAiLoading'),
      send: t('momentsFieldAiSend'),
      focusHint: t('momentsFieldAiFocusHint'),
      result: t('momentsFieldAiResult'),
    }),
    [t],
  )

  const quickPrompts = useMemo(
    () => [
      { label: t('momentsFieldTuneCloserPreset'), instruction: t('momentsFieldTuneCloserPreset') },
      { label: t('momentsFieldTuneShorter'), instruction: t('momentsFieldTuneShorter') },
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
      const next = await polishMomentsContentDirection({
        value,
        topic,
        mode,
        allowedOptions: presetOptions,
        instruction: instruction.trim() || undefined,
        signal: controller.signal,
        onPartial: (text) => setStreaming(text),
      })
      setRevision(next)
    } catch (e) {
      if (!controller.signal.aborted) {
        setPolishError(e instanceof Error ? e.message : t('momentsFieldAiError'))
      }
    } finally {
      if (abortRef.current === controller) {
        setPolishing(false)
        setStreaming('')
      }
    }
  }

  return (
    <div className="moments-field-input-control">
      <Input
        id={inputId}
        value={value}
        disabled={disabled || polishing}
        onChange={(event) => {
          setRevision(undefined)
          onChange(event.target.value)
        }}
      />
      <div className="moments-field-input-control__actions" aria-hidden={false}>
        <FieldPresetPicker
          label={label}
          value={value}
          options={pickerOptions}
          disabled={disabled || polishing}
          onSelect={(next) => {
            setRevision(undefined)
            onChange(next)
          }}
        />
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
          triggerClassName="ai-edit-popover--profile"
          className="ai-edit-popover--profile"
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
      </div>
    </div>
  )
}
