import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useEditorDocument, useEditorInstance } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Label } from '@no996/ui/label'
import { Checkbox } from '@no996/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { captureTemplateComposition, createTalkTemplate } from './model'
import { saveTalkTemplate } from './repository'
import { useTemplateCopy } from './copy'
import './templates.css'

export type TalkTemplateSaveDialogProps = { owner: number; open: boolean; onOpenChange: (open: boolean) => void; onError: (message: string) => void; onSaved?: (name: string) => void; busy?: boolean }
export function TalkTemplateSaveDialog({ owner, open, onOpenChange, onError, onSaved, busy = false }: TalkTemplateSaveDialogProps) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { copy, error } = useTemplateCopy()
  const ids = useId()
  const [name, setName] = useState('')
  const [includeFrame, setIncludeFrame] = useState(false)
  const [includeComposition, setIncludeComposition] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const gate = useRef(false)
  const alive = useRef(true)
  const epoch = useRef(0)
  const latest = useRef({ owner, editor, open, busy, onOpenChange, onError, onSaved })
  latest.current = { owner, editor, open, busy, onOpenChange, onError, onSaved }
  useEffect(() => {
    alive.current = true; epoch.current++; gate.current = false
    setName(''); setIncludeFrame(false); setIncludeComposition(false); setPending(false); setMessage('')
    return () => { alive.current = false; epoch.current++ }
  }, [owner, editor, open])
  const compositionError = useMemo(() => {
    if (!open) return ''
    try { captureTemplateComposition(doc); return '' } catch (failure) { return error(failure) }
  }, [doc, open, error])
  const locked = busy || pending
  const save = async () => {
    if (gate.current || latest.current.busy || !latest.current.open) return
    gate.current = true; setPending(true); setMessage('')
    const generation = epoch.current
    const valid = () => alive.current && epoch.current === generation && latest.current.owner === owner && latest.current.editor === editor && latest.current.open
    try {
      // Capture only the explicit style whitelist from the submitted current revision.
      const value = createTalkTemplate(editor.getDocument(), owner, name, { frame: includeFrame, composition: includeComposition })
      await saveTalkTemplate(owner, value)
      if (valid()) { latest.current.onOpenChange(false); latest.current.onSaved?.(value.name) }
    } catch (failure) { if (valid()) { const msg = error(failure); setMessage(msg); latest.current.onError(msg) } }
    finally { if (valid()) { gate.current = false; setPending(false) } }
  }
  return <Dialog open={open} onOpenChange={value => { if (!pending) onOpenChange(value) }}>
    <DialogContent className="ipt-template-dialog">
      <DialogHeader><DialogTitle>{copy('saveTitle')}</DialogTitle><DialogDescription>{copy('saveDescription')}</DialogDescription></DialogHeader>
      <form className="ipt-template-form" onSubmit={event => { event.preventDefault(); void save() }}>
        <Label className="ipt-field" htmlFor={`${ids}-save-name`}>{copy('name')}<Input id={`${ids}-save-name`} value={name} maxLength={60} disabled={locked} placeholder={copy('namePlaceholder')} autoComplete="off" aria-invalid={!!message} onChange={event => setName(event.target.value)} /></Label>
        <Label className="ipt-template-check" htmlFor={`${ids}-save-frame`}><Checkbox id={`${ids}-save-frame`} checked={includeFrame} disabled={locked} onCheckedChange={value => setIncludeFrame(value === true)} />{copy('saveFrame')} · {doc.canvas.ratio}</Label>
        <Label className="ipt-template-check" htmlFor={`${ids}-save-composition`}><Checkbox id={`${ids}-save-composition`} checked={includeComposition} disabled={locked || (!!compositionError && !includeComposition)} onCheckedChange={value => setIncludeComposition(value === true)} />{copy('saveComposition')}</Label>
        <p className="ipt-help">{compositionError || copy('compositionNotice')}</p>
        <p className="ipt-help">{copy('localOnly')}</p>
        {message && <p className="ipt-template-error" role="alert">{message}</p>}
        <DialogFooter><Button type="button" variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>{copy('cancel')}</Button><Button type="submit" disabled={locked || !name.trim() || doc.scope !== String(owner)} aria-busy={pending}>{copy(pending ? 'saving' : 'save')}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
