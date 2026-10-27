import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { downloadText } from '../../../services/browser'
import { exportSrt, parseSrt, validateCaptions, type SubtitleSegment } from '../lib/subtitles.ts'
import type { TemplateProject } from '../lib/template-project.ts'
import { captionDrafts, captionsFromDrafts, type CaptionDraft } from './model.ts'
import { editorErrorKey } from './fields'

export function CaptionsEditor({ project, onChange, disabled }: { project: TemplateProject; onChange: (project: TemplateProject) => void; disabled?: boolean }) {
  const { t } = useTranslation('ipVideo')
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [drafts, setDrafts] = useState(() => captionDrafts(project.captions))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const epoch = useRef(0)
  const ownCaptions = useRef<SubtitleSegment[] | null>(null)
  const current = useRef({ project, disabled })
  current.current = { project, disabled }
  useEffect(() => {
    ++epoch.current
    setDrafts(captionDrafts(project.captions)); setError(''); setLoading(false)
    if (ownCaptions.current !== project.captions) setNotice('')
    ownCaptions.current = null
  }, [project.captions, project.duration])
  useEffect(() => () => { ++epoch.current }, [])
  const dirty = JSON.stringify(drafts) !== JSON.stringify(captionDrafts(project.captions))
  const patch = (index: number, key: keyof CaptionDraft, value: string) => {
    setDrafts(lines => lines.map((line, position) => position === index ? { ...line, [key]: value } : line))
    setNotice('')
  }
  const apply = () => {
    try {
      const captions = captionsFromDrafts(drafts, project.duration)
      ownCaptions.current = captions
      onChange({ ...project, captions, timingSource: 'manual' }); setError(''); setNotice('captionsApplied')
    } catch (failure) { setError(editorErrorKey(failure)) }
  }
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || disabled || dirty || loading) return
    const generation = ++epoch.current
    setLoading(true); setError(''); setNotice('')
    try {
      if (file.size > 1_000_000) throw new Error('assetLimit')
      const captions = parseSrt(await file.text())
      if (!captions.length) throw new Error('invalidSubtitle')
      if (generation !== epoch.current || current.current.disabled) return
      validateCaptions(captions, current.current.project.duration)
      ownCaptions.current = captions
      onChange({ ...current.current.project, captions, timingSource: 'srt' }); setNotice('srtImported')
    } catch (failure) { if (generation === epoch.current) setError(editorErrorKey(failure)) }
    finally { if (generation === epoch.current) setLoading(false) }
  }
  const exportFile = () => {
    try {
      validateCaptions(project.captions, project.duration)
      downloadText(exportSrt(project.captions), 'captions.srt', 'application/x-subrip;charset=utf-8')
      setNotice('srtExported'); setError('')
    } catch (failure) { setError(editorErrorKey(failure)) }
  }
  return <details className="ipv-editor-section ipv-editor-captions">
    <summary>{t('editor.captions')}</summary>
    <div className="ipv-editor-section-body">
      <p className="ipv-editor-hint">{t(`editor.timing.${project.timingSource}`)}</p>
      <p className="ipv-editor-hint">{t('editor.timingHelp', { duration: project.duration.toFixed(2) })}</p>
      <div className="ipv-editor-actions">
        <Button type="button" variant="toolbar" disabled={disabled || dirty || loading} onClick={() => input.current?.click()}>{t(loading ? 'editor.importing' : 'editor.importSrt')}</Button>
        <Button type="button" variant="toolbar" disabled={disabled || dirty || loading || !project.captions.length} onClick={exportFile}>{t('editor.exportSrt')}</Button>
      </div>
      <input ref={input} type="file" hidden accept=".srt,application/x-subrip,text/plain" aria-label={t('editor.importSrt')} onChange={event => { void importFile(event) }} />
      {dirty && <p className="ipv-editor-hint">{t('editor.unsavedCaptions')}</p>}
      <div className="ipv-editor-caption-list">
        {!drafts.length && <p className="ipv-editor-hint">{t('editor.noCaptions')}</p>}
        {drafts.map((line, index) => <fieldset className="ipv-editor-caption" key={index} disabled={disabled || loading}>
          <legend>{t('editor.segment', { n: index + 1 })}</legend>
          <div className="ipv-editor-grid">
            <div className="ipv-editor-field"><label htmlFor={`${id}-${index}-start`}>{t('editor.startTime')}</label><Input id={`${id}-${index}-start`} type="number" step="0.01" min="0" max={project.duration} value={line.start} onChange={event => patch(index, 'start', event.target.value)} /></div>
            <div className="ipv-editor-field"><label htmlFor={`${id}-${index}-end`}>{t('editor.endTime')}</label><Input id={`${id}-${index}-end`} type="number" step="0.01" min="0" max={project.duration} value={line.end} onChange={event => patch(index, 'end', event.target.value)} /></div>
          </div>
          <div className="ipv-editor-field"><label htmlFor={`${id}-${index}-text`}>{t('editor.captionText')}</label><Textarea id={`${id}-${index}-text`} value={line.text} onChange={event => patch(index, 'text', event.target.value)} /></div>
        </fieldset>)}
      </div>
      <Button type="button" variant="default" disabled={disabled || !dirty || loading} onClick={apply}>{t('editor.applyCaptions')}</Button>
      {error && <p className="ipv-editor-error" role="alert">{t(`editor.errors.${error}`)}</p>}
      <p className="ipv-editor-hint" role="status">{notice ? t(`editor.${notice}`) : ''}</p>
    </div>
  </details>
}
