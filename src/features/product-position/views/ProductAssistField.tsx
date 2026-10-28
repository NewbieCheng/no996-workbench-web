import { useMemo, useRef, useState } from 'react'
import { AIEditPopover, type AIEditPopoverLabels } from '@no996/ui/ai-edit-popover'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { FieldPresetPicker } from '../../../components/agent/FieldPresetPicker'
import {
  polishProductField,
  type ProductAssistFieldId,
} from '../agent/form-assist'
import type { ProductRecord } from '../../../services/product-position/types'

const LABELS: AIEditPopoverLabels = {
  trigger: 'AI 优化',
  context: '结合当前产品资料润色本字段',
  promptPlaceholder: '可选：补充微调要求，例如更短、更具体…',
  apply: '采用建议',
  dismiss: '不用',
  loading: '正在优化…',
  send: '发送',
  focusHint: 'Enter 发送，Shift+Enter 换行',
  result: 'AI 优化建议',
}

type Props = {
  field: ProductAssistFieldId
  fieldLabel: string
  value: string
  product: ProductRecord
  multiline?: boolean
  rows?: number
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  inputId?: string
  presets?: readonly string[]
  onChange: (value: string) => void
}

export function ProductAssistField({
  field,
  fieldLabel,
  value,
  product,
  multiline = false,
  rows = 3,
  placeholder,
  disabled,
  invalid,
  inputId,
  presets,
  onChange,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [streaming, setStreaming] = useState('')
  const [result, setResult] = useState<string>()
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const quickPrompts = useMemo(
    () => [
      { label: '更简洁', instruction: '更简洁' },
      { label: '更具体', instruction: '更具体' },
      { label: '更专业', instruction: '更专业' },
    ],
    [],
  )

  async function polish(instruction: string) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError('')
    setStreaming('')
    setResult(undefined)
    try {
      const next = await polishProductField({
        field,
        fieldLabel,
        value,
        product,
        instruction: instruction.trim() || undefined,
        signal: controller.signal,
        onPartial: setStreaming,
      })
      setResult(next)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'AI 优化失败，请重试')
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setBusy(false)
        setStreaming('')
      }
    }
  }

  const hasPresets = Boolean(presets?.length)

  return (
    <div
      className={`pp-field-input-control${multiline ? ' pp-field-input-control--multiline' : ''}${hasPresets ? ' pp-field-input-control--dual' : ''}${invalid ? ' is-invalid' : ''}`}
    >
      {multiline ? (
        <Textarea
          id={inputId}
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled || busy}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setResult(undefined)
            onChange(event.target.value)
          }}
        />
      ) : (
        <Input
          id={inputId}
          value={value}
          placeholder={placeholder}
          disabled={disabled || busy}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setResult(undefined)
            onChange(event.target.value)
          }}
        />
      )}
      <div className="pp-field-input-control__actions">
        {hasPresets ? (
          <FieldPresetPicker
            label={fieldLabel}
            value={value}
            options={[...(presets ?? [])]}
            disabled={disabled || busy}
            onSelect={(next) => {
              setResult(undefined)
              onChange(next)
            }}
          />
        ) : null}
        <AIEditPopover
          fieldLabel={fieldLabel}
          value={value}
          result={result}
          streamingResult={streaming}
          busy={busy}
          error={error}
          disabled={disabled}
          quickPrompts={quickPrompts}
          labels={LABELS}
          className="ai-edit-popover--profile"
          triggerClassName="ai-edit-popover--profile"
          onGenerate={(instruction) => void polish(instruction)}
          onApply={() => {
            if (result) onChange(result)
            setResult(undefined)
          }}
          onDismiss={() => {
            setResult(undefined)
            setError('')
          }}
        />
      </div>
    </div>
  )
}
