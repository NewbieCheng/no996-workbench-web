import { useEffect, useId, useState } from 'react'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { useTranslation } from 'react-i18next'

function formatNumberValue(num: number, step: number): string {
  if (!Number.isFinite(num)) return ''
  const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 1) : 0
  return decimals === 0 ? String(Math.round(num)) : Number(num.toFixed(decimals)).toString()
}

export function NumberField({ label, value, onCommit, min, max, step = 1, disabled }: { label: string; value: number; onCommit: (value: number) => void; min: number; max: number; step?: number; disabled?: boolean }) {
  const { t } = useTranslation('ipVideo')
  const id = useId()
  const [draft, setDraft] = useState(() => formatNumberValue(value, step))
  const [invalid, setInvalid] = useState(false)
  useEffect(() => { setDraft(formatNumberValue(value, step)); setInvalid(false) }, [value, step])
  const commit = () => {
    const number = Number(draft)
    if (!draft.trim() || !Number.isFinite(number) || number < min || number > max) { setInvalid(true); return }
    setInvalid(false)
    const rounded = Number(formatNumberValue(number, step))
    if (rounded !== value) onCommit(rounded)
  }
  return <div className="ipv-editor-field">
    <label htmlFor={id}>{label}</label>
    <Input id={id} type="number" value={draft} min={min} max={max} step={step} disabled={disabled} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
      onChange={event => { setDraft(event.target.value); setInvalid(false) }} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(String(value)); setInvalid(false) } }} />
    {invalid && <span id={`${id}-error`} className="ipv-editor-error" role="alert">{t('editor.numberRange', { min, max })}</span>}
  </div>
}
export function TextField({ label, value, onCommit, disabled }: { label: string; value: string; onCommit: (value: string) => void; disabled?: boolean }) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <div className="ipv-editor-field"><label htmlFor={id}>{label}</label><Textarea id={id} value={draft} disabled={disabled} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft) }} /></div>
}
export function ColorField({ label, value, onCommit, disabled }: { label: string; value: string; onCommit: (value: string) => void; disabled?: boolean }) {
  const id = useId()
  const [draft, setDraft] = useState(value || '#000000')
  const [changed, setChanged] = useState(false)
  useEffect(() => { setDraft(value || '#000000'); setChanged(false) }, [value])
  return <div className="ipv-editor-field"><label htmlFor={id}>{label}</label><Input id={id} type="color" value={draft} disabled={disabled} onChange={event => { setDraft(event.target.value); setChanged(true) }} onBlur={() => { if (changed && draft !== value) onCommit(draft); setChanged(false) }} /></div>
}
export function ChoiceField({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId()
  return <div className="ipv-editor-field"><label htmlFor={id}>{label}</label>
    <Select value={value} items={options} onValueChange={next => { if (next !== null) onChange(next) }} disabled={disabled}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>
  </div>
}
export function editorErrorKey(error: unknown): string {
  const key = error instanceof Error ? error.message : ''
  return ['invalidSubtitle', 'assetLimit', 'invalidLayout', 'invalidOwner', 'storageUnavailable', 'invalidPresetName', 'presetLimit'].includes(key) ? key : 'operationFailed'
}
