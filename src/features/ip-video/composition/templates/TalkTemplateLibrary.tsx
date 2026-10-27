import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useEditorDocument, useEditorInstance } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import { HoverTip } from '@no996/ui/tooltip'
import { Input } from '@no996/ui/input'
import { Label } from '@no996/ui/label'
import { Checkbox } from '@no996/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@no996/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { StylePreview } from '../TalkStyleLibrary'
import { editTalk, type TalkDocument } from '../talk-model'
import { captionFontByFamily } from '../../editor/caption-fonts'
import { applyTalkTemplate, assertTemplateRevision, BUILTIN_TALK_TEMPLATES, RECOMMENDED_TALK_TEMPLATE_IDS, templateProtectionRequired, TalkTemplateError, type ApplicableTalkTemplate, type TalkStyleTemplate, type TemplateApplyOptions } from './model'
import { deleteTalkTemplate, getTalkTemplate, listTalkTemplates, renameTalkTemplate, subscribeTalkTemplates } from './repository'
import { prepareTemplateFonts } from './fonts'
import { useTemplateCopy } from './copy'
import './templates.css'

export type TalkTemplateLibraryProps = { owner: number; busy: boolean; livePreview?: boolean; onError: (message: string) => void; onApplied?: (name: string) => void; onBlockingChange?: (blocked: boolean) => void }
type ApplyRequest = { template: ApplicableTalkTemplate; options: TemplateApplyOptions; expected: { id: string; revision: number }; owner: number }
type ManageRequest = { kind: 'rename' | 'delete'; template: TalkStyleTemplate; owner: number }
const isSavedTemplate = (template: ApplicableTalkTemplate): template is TalkStyleTemplate => 'schemaVersion' in template

export function TalkTemplateLibrary({ owner, busy, livePreview = true, onError, onApplied, onBlockingChange }: TalkTemplateLibraryProps) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { copy, error, builtinName } = useTemplateCopy()
  const ids = useId()
  const [tab, setTab] = useState('recommended')
  const [selected, setSelected] = useState('builtin:studio')
  const [stored, setStored] = useState<{ owner: number; items: TalkStyleTemplate[] }>({ owner, items: [] })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [includeFrame, setIncludeFrame] = useState(false)
  const [includeComposition, setIncludeComposition] = useState(false)
  const [confirm, setConfirm] = useState<ApplyRequest | null>(null)
  const [manage, setManage] = useState<ManageRequest | null>(null)
  const [name, setName] = useState('')
  const gate = useRef(false)
  const alive = useRef(true)
  const epoch = useRef(0)
  const loadSequence = useRef(0)
  const latest = useRef({ owner, busy, editor, onError, onApplied })
  latest.current = { owner, busy, editor, onError, onApplied }
  const items = stored.owner === owner ? stored.items : []
  const active: ApplicableTalkTemplate | undefined = selected.startsWith('saved:') ? items.find(item => `saved:${item.id}` === selected) : BUILTIN_TALK_TEMPLATES.find(item => `builtin:${item.id}` === selected)
  const activeName = active ? (isSavedTemplate(active) ? active.name : builtinName(active.id)) : ''
  const preset = useMemo(() => active ? { name: activeName, style: active.captionStyle } : null, [active, activeName])
  const locked = busy || pending
  // Report only local work/dialogs. External busy must never feed back into this signal.
  const blocked = pending || confirm !== null || manage !== null
  const blockingCallback = useRef(onBlockingChange)
  blockingCallback.current = onBlockingChange
  useEffect(() => { onBlockingChange?.(blocked) }, [blocked, onBlockingChange])
  // Keep cleanup separate: callback identity changes must not briefly release an active block.
  useEffect(() => () => { blockingCallback.current?.(false) }, [])
  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current
    setLoading(true); setLoadError(false)
    try {
      const next = await listTalkTemplates(owner)
      if (alive.current && latest.current.owner === owner && sequence === loadSequence.current) setStored({ owner, items: next })
    } catch (failure) {
      if (alive.current && latest.current.owner === owner && sequence === loadSequence.current) { const msg = error(failure); setLoadError(true); setMessage(msg); latest.current.onError(msg) }
    } finally { if (alive.current && latest.current.owner === owner && sequence === loadSequence.current) setLoading(false) }
  }, [owner, error])
  useEffect(() => {
    alive.current = true; epoch.current++; gate.current = false
    setPending(false); setTab('recommended'); setConfirm(null); setManage(null); setMessage(''); setSelected('builtin:studio'); setIncludeFrame(false); setIncludeComposition(false)
    void reload()
    const unsubscribe = subscribeTalkTemplates(() => { void reload() })
    const refresh = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', refresh)
    return () => { alive.current = false; epoch.current++; loadSequence.current++; unsubscribe(); document.removeEventListener('visibilitychange', refresh) }
  }, [editor, reload])
  const select = (key: string) => { setSelected(key); setIncludeFrame(false); setIncludeComposition(false); setMessage('') }
  const apply = async (request: ApplyRequest) => {
    if (gate.current || latest.current.busy || request.owner !== latest.current.owner) return
    gate.current = true; setPending(true); setMessage('')
    const generation = epoch.current
    const valid = () => alive.current && generation === epoch.current && latest.current.owner === request.owner && latest.current.editor === editor
    try {
      assertTemplateRevision(editor.getDocument(), request.expected, request.owner)
      let template = request.template
      if ('schemaVersion' in template) {
        const fresh = await getTalkTemplate(request.owner, template.id)
        if (fresh.revision !== template.revision) throw new TalkTemplateError('staleTemplate')
        template = fresh
      }
      if (!valid() || latest.current.busy) return
      assertTemplateRevision(editor.getDocument(), request.expected, request.owner)
      const prepared = applyTalkTemplate(editor.getDocument() as TalkDocument, request.owner, template, request.options)
      await prepareTemplateFonts(prepared)
      if ('schemaVersion' in template) {
        const fresh = await getTalkTemplate(request.owner, template.id)
        if (fresh.revision !== template.revision) throw new TalkTemplateError('staleTemplate')
      }
      if (!valid() || latest.current.busy) return
      // Revalidate after every asynchronous boundary and inside the single undoable command.
      assertTemplateRevision(editor.getDocument(), request.expected, request.owner)
      editTalk(editor, 'style-template', current => {
        assertTemplateRevision(current, request.expected, request.owner)
        return applyTalkTemplate(current, request.owner, template, request.options)
      })
      setConfirm(null)
      latest.current.onApplied?.('schemaVersion' in template ? template.name : builtinName(template.id))
    } catch (failure) { if (valid()) { const msg = error(failure); setMessage(msg); latest.current.onError(msg); setConfirm(null) } }
    finally { if (valid()) { gate.current = false; setPending(false) } }
  }
  const requestApply = () => {
    if (!active || locked || gate.current) return
    const current = editor.getDocument()
    const request: ApplyRequest = { template: active, owner, expected: { id: current.id, revision: current.revision }, options: { frame: includeFrame, composition: includeComposition, confirmProtected: false } }
    if (templateProtectionRequired(current)) setConfirm(request)
    else void apply(request)
  }
  const mutate = async () => {
    const request = manage
    if (!request || locked || gate.current || request.owner !== latest.current.owner) return
    gate.current = true; setPending(true); setMessage('')
    const generation = epoch.current
    const valid = () => alive.current && epoch.current === generation && latest.current.owner === request.owner
    try {
      if (request.kind === 'rename') await renameTalkTemplate(request.owner, request.template.id, request.template.revision, name)
      else await deleteTalkTemplate(request.owner, request.template.id, request.template.revision)
      if (valid()) {
        setManage(null)
        if (request.kind === 'delete') { const next = items.find(item => item.id !== request.template.id); select(next ? `saved:${next.id}` : '') }
      }
    } catch (failure) { if (valid()) { const msg = error(failure); setMessage(msg); latest.current.onError(msg) } }
    finally { if (valid()) { gate.current = false; setPending(false) } }
  }
  const displayItems: ApplicableTalkTemplate[] = tab === 'mine' ? items : tab === 'recommended' ? BUILTIN_TALK_TEMPLATES.filter(item => (RECOMMENDED_TALK_TEMPLATE_IDS as readonly string[]).includes(item.id)) : [...BUILTIN_TALK_TEMPLATES]
  return <section className="ipt-style-library ipt-template-library" data-live-preview={livePreview} aria-label={copy('library')} aria-busy={pending}>
    <p className="ipt-help">{copy('intro')}</p>
    <Tabs value={tab} onValueChange={value => { if (typeof value === 'string') { setTab(value); setMessage(''); const first = value === 'mine' ? items[0] : BUILTIN_TALK_TEMPLATES[0]; if (first) select(`${value === 'mine' ? 'saved' : 'builtin'}:${first.id}`); else select('') } }}>
      <TabsList variant="toolbar" aria-label={copy('library')}>
        <TabsTrigger value="recommended" disabled={locked}>{copy('recommended')}</TabsTrigger><TabsTrigger value="all" disabled={locked}>{copy('all')}</TabsTrigger><TabsTrigger value="mine" disabled={locked}>{copy('mine')}</TabsTrigger>
      </TabsList>
      <TabsContent value={tab} className="ipt-template-tab-content">
    {message && <p className="ipt-template-error" role="alert">{message}</p>}
    {tab === 'mine' && <><p className="ipt-help">{copy('localOnly')}</p>{loading && <p role="status" className="ipt-help">{copy('loading')}</p>}{loadError && <Button variant="toolbar" size="sm" disabled={locked || loading} onClick={() => void reload()}>{copy('retry')}</Button>}{!loading && !loadError && items.length === 0 && <p className="ipt-help">{copy('empty')}</p>}</>}
    <div className="ipt-style-library__body">
      <div className="ipt-style-options" role="group" aria-label={copy('library')}>{displayItems.map(item => {
        const saved = 'schemaVersion' in item
        const key = `${saved ? 'saved' : 'builtin'}:${item.id}`
        const font = captionFontByFamily(item.captionStyle.font)
        return <Button key={key} className="ipt-style-option" variant="ghost" disabled={locked} aria-pressed={selected === key} onClick={() => select(key)}>
          <span className="ipt-style-option__specimen" style={{ fontFamily: item.captionStyle.font, fontWeight: item.captionStyle.weight, color: item.captionStyle.color, backgroundColor: item.backgroundColor || item.captionStyle.backgroundColor || '#172128' }}>{copy('sample1')}</span>
          <strong>{saved ? item.name : builtinName(item.id)}</strong>
          <small>{saved ? [item.frame ? copy('hasFrame') : '', item.composition ? copy('hasComposition') : ''].filter(Boolean).join(' · ') || copy('customStyle') : `${font?.label ?? item.captionStyle.font} · ${item.captionStyle.size}px`}</small>
        </Button>
      })}</div>
      {active && preset && <div className="ipt-style-library__preview">
        {livePreview && <StylePreview preset={preset} backgroundColor={active.backgroundColor} />}
        {isSavedTemplate(active) && <>
          {active.frame && <Label className="ipt-template-check" htmlFor={`${ids}-frame`}><Checkbox id={`${ids}-frame`} checked={includeFrame} disabled={locked} onCheckedChange={value => setIncludeFrame(value === true)} />{copy('includeFrame')} · {active.frame.ratio}</Label>}
          {active.composition && <Label className="ipt-template-check" htmlFor={`${ids}-composition`}><Checkbox id={`${ids}-composition`} checked={includeComposition} disabled={locked} onCheckedChange={value => setIncludeComposition(value === true)} />{copy('includeComposition')}</Label>}
          {includeFrame && <p className="ipt-help">{copy('frameNotice')}</p>}
        </>}
        <HoverTip label={copy('previewNotice')} enabled={!livePreview}>
          <Button variant="generate" disabled={locked || doc.scope !== String(owner)} onClick={requestApply}>{copy(pending ? 'applying' : 'apply')}</Button>
        </HoverTip>
        {isSavedTemplate(active) && <div className="ipt-inline-actions"><Button variant="toolbar" size="sm" disabled={locked} onClick={() => { setName(active.name); setMessage(''); setManage({ kind: 'rename', template: active, owner }) }}>{copy('rename')}</Button><Button variant="ghost" size="sm" disabled={locked} onClick={() => { setMessage(''); setManage({ kind: 'delete', template: active, owner }) }}>{copy('delete')}</Button></div>}
      </div>}
    </div>
      </TabsContent>
    </Tabs>
    <Dialog open={confirm !== null} onOpenChange={open => { if (!open && !pending) setConfirm(null) }}>
      <DialogContent className="ipt-template-dialog"><DialogHeader><DialogTitle>{copy('protectTitle')}</DialogTitle><DialogDescription>{copy('protectDescription')}</DialogDescription></DialogHeader><DialogFooter><Button variant="ghost" disabled={pending} onClick={() => setConfirm(null)}>{copy('cancel')}</Button><Button disabled={locked} onClick={() => { if (confirm) void apply({ ...confirm, options: { ...confirm.options, confirmProtected: true } }) }}>{copy(pending ? 'applying' : 'protectConfirm')}</Button></DialogFooter></DialogContent>
    </Dialog>
    <Dialog open={manage !== null} onOpenChange={open => { if (!open && !pending) setManage(null) }}>
      <DialogContent className="ipt-template-dialog"><DialogHeader><DialogTitle>{copy(manage?.kind === 'delete' ? 'deleteTitle' : 'renameTitle')}</DialogTitle><DialogDescription>{copy(manage?.kind === 'delete' ? 'deleteDescription' : 'renameDescription')}</DialogDescription></DialogHeader>
        <p className="ipt-help">{manage?.template.name}</p>
        {manage?.kind === 'rename' && <Label className="ipt-field" htmlFor={`${ids}-name`}>{copy('name')}<Input id={`${ids}-name`} value={name} maxLength={60} disabled={locked} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); void mutate() } }} /></Label>}
        {message && <p className="ipt-template-error" role="alert">{message}</p>}
        <DialogFooter><Button variant="ghost" disabled={pending} onClick={() => setManage(null)}>{copy('cancel')}</Button><Button disabled={locked || (manage?.kind === 'rename' && !name.trim())} onClick={() => void mutate()}>{copy(pending ? 'saving' : manage?.kind === 'delete' ? 'deleteConfirm' : 'renameSave')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
}
