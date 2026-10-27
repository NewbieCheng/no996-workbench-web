import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import type { TemplateProject } from '../lib/template-project.ts'
import { ChoiceField, editorErrorKey } from './fields'
import { applyPreset, deletePreset, listPresets, PRESET_LIMIT, savePreset, type TemplatePreset } from './presets.ts'

/** Mount with key={owner}; an old account's pending operation never updates the new account's UI. */
export function PresetsPanel({ owner, project, onChange, disabled }: { owner: number; project: TemplateProject; onChange: (project: TemplateProject) => void; disabled?: boolean }) {
  const { t } = useTranslation('ipVideo')
  const id = useId()
  const [presets, setPresets] = useState<TemplatePreset[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    let active = true
    void listPresets(owner).then(records => { if (active) setPresets(records) }).catch(failure => { if (active) setError(editorErrorKey(failure)) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false; alive.current = false }
  }, [owner])
  const save = async () => {
    if (busy || disabled) return
    setBusy(true); setError(''); setNotice('')
    try {
      const preset = await savePreset(owner, name, project)
      if (!alive.current) return
      const records = await listPresets(owner)
      if (!alive.current) return
      setPresets(records)
      setSelected(preset.id); setName(''); setNotice('presetSaved')
    } catch (failure) { if (alive.current) setError(editorErrorKey(failure)) }
    finally { if (alive.current) setBusy(false) }
  }
  const remove = async () => {
    if (!selected || busy || disabled) return
    setBusy(true); setError(''); setNotice('')
    try {
      await deletePreset(owner, selected)
      if (!alive.current) return
      setPresets(records => records.filter(record => record.id !== selected)); setSelected(''); setNotice('presetDeleted')
    } catch (failure) { if (alive.current) setError(editorErrorKey(failure)) }
    finally { if (alive.current) setBusy(false) }
  }
  return <details className="ipv-editor-section">
    <summary>{t('editor.presets')}</summary>
    <div className="ipv-editor-section-body">
      <p className="ipv-editor-hint">{t('editor.presetsHelp', { max: PRESET_LIMIT })}</p>
      <ChoiceField label={t('editor.choosePreset')} value={selected} disabled={disabled || busy} options={[{ value: '', label: t('editor.noPreset') }, ...presets.map(preset => ({ value: preset.id, label: preset.name }))]} onChange={value => {
        setSelected(value); setNotice(''); setError('')
        const preset = presets.find(record => record.id === value)
        if (!preset) return
        try { onChange(applyPreset(project, preset, owner)); setNotice('presetApplied') }
        catch (failure) { setError(editorErrorKey(failure)) }
      }} />
      <Button type="button" variant="toolbar" disabled={disabled || busy || !selected} onClick={() => { void remove() }}>{t('editor.deletePreset')}</Button>
      <div className="ipv-editor-field"><label htmlFor={id}>{t('editor.presetName')}</label><Input id={id} value={name} maxLength={80} disabled={disabled || busy} onChange={event => setName(event.target.value)} /></div>
      <Button type="button" variant="toolbar" disabled={disabled || busy || !name.trim() || presets.length >= PRESET_LIMIT} onClick={() => { void save() }}>{t('editor.savePreset')}</Button>
      {presets.length >= PRESET_LIMIT && <p className="ipv-editor-hint">{t('editor.errors.presetLimit')}</p>}
      {error && <p className="ipv-editor-error" role="alert">{t(`editor.errors.${error}`)}</p>}
      <p className="ipv-editor-hint" role="status">{notice ? t(`editor.${notice}`) : ''}</p>
    </div>
  </details>
}
