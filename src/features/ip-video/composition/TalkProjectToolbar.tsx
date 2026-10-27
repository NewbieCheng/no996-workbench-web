import { createPortal } from 'react-dom'
import { CheckCircle2, Download, Loader2, MoreHorizontal, Plus, Redo2, Undo2 } from 'lucide-react'
import '../../digital-human/digital-human.css'
import { useEditorDocument, useEditorInstance } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@no996/ui/dropdown-menu'
import { HoverTip } from '@no996/ui/tooltip'
import { useTalkV2Copy } from './v2-copy'

export type TalkToolbarTargets = { chrome: HTMLElement | null }
export type TalkProjectToolbarProps = {
  targets?: TalkToolbarTargets
  drafts: Array<{ id: string; name: string }>
  saveState: 'saved' | 'saving' | 'unsaved'
  saveError: boolean
  busy: boolean
  hasResult: boolean
  exporting: boolean
  canExport: boolean
  onOpen: (id: string) => void
  onNew: () => void
  onRename: () => void
  onDelete: () => void
  onSaveTemplate: () => void
  onOpenAdvancedSettings: () => void
  onRetrySave: () => void
  onExport: () => void
}

/** Portals retain the editor's context and command history; only the DOM position changes. */
export function TalkProjectToolbar(props: TalkProjectToolbarProps) {
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { t } = useTalkV2Copy()
  const projectCluster = <div className="ipt-topbar-project dh-header-project-cluster">
    <Select value={doc.id} items={props.drafts.map(draft => ({ value: draft.id, label: draft.name }))} disabled={props.busy} onValueChange={id => { if (id && id !== doc.id) props.onOpen(String(id)) }}>
      <SelectTrigger size="sm" className="dh-header-project-select" aria-label={t('projects')}><SelectValue /></SelectTrigger>
      <SelectContent align="end">{props.drafts.map(draft => <SelectItem key={draft.id} value={draft.id}>{draft.name}</SelectItem>)}</SelectContent>
    </Select>
    <HoverTip label={t('newProject')}>
      <Button
        type="button"
        variant="toolbar"
        size="icon-sm"
        className="dh-header-project-settings"
        aria-label={t('newProject')}
        disabled={props.busy}
        onClick={props.onNew}
      >
        <Plus size={15} aria-hidden />
      </Button>
    </HoverTip>
    <DropdownMenu>
      <HoverTip label={t('more')}>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="toolbar"
              size="icon-sm"
              className="dh-header-project-settings"
              aria-label={t('more')}
              disabled={props.busy}
            />
          }
        >
          <MoreHorizontal size={15} aria-hidden />
        </DropdownMenuTrigger>
      </HoverTip>
      <DropdownMenuContent align="end" className="dh-project-settings-menu wb-tool-chrome-menu">
        <DropdownMenuItem disabled={props.busy} onClick={props.onRename}>{t('rename')}</DropdownMenuItem>
        <DropdownMenuItem disabled={props.busy} onClick={props.onSaveTemplate}>{t('saveTemplate')}</DropdownMenuItem>
        <DropdownMenuItem disabled={props.busy} onClick={props.onOpenAdvancedSettings}>{t('advancedSettings')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!editor.canUndo() || props.busy} onClick={() => editor.undo()}>{t('undo')}</DropdownMenuItem>
        <DropdownMenuItem disabled={!editor.canRedo() || props.busy} onClick={() => editor.redo()}>{t('redo')}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={props.busy} onClick={props.onDelete}>{t('deleteProject')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
  const chrome = <div className="ipt-topbar-chrome vf-page-chrome ipt-page-chrome">
    {props.saveError ? (
      <Button type="button" variant="toolbar" size="sm" className="vf-chrome-control" onClick={props.onRetrySave}>{t('saveFailed')}</Button>
    ) : (
      <span className="dh-save-status ipt-save-status" role="status">
        {props.saveState === 'saved' ? (
          <>
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" aria-hidden />
            {t('saved')}
          </>
        ) : props.saveState === 'saving' ? (
          <>
            <Loader2 size={13} className="animate-spin shrink-0" aria-hidden />
            {t('saving')}
          </>
        ) : (
          t('unsaved')
        )}
      </span>
    )}
    <span className="vf-chrome-divider" aria-hidden="true" />
    {projectCluster}
    <span className="vf-chrome-divider" aria-hidden="true" />
    <div className="ipt-history-actions vf-chrome-undo-group" role="group" aria-label={`${t('undo')} / ${t('redo')}`}>
      <HoverTip label={t('undo')}>
        <Button type="button" variant="toolbar" size="icon-sm" className="vf-chrome-control vf-chrome-icon-btn" aria-label={t('undo')} disabled={!editor.canUndo() || props.busy} onClick={() => editor.undo()}><Undo2 size={15} aria-hidden /></Button>
      </HoverTip>
      <HoverTip label={t('redo')}>
        <Button type="button" variant="toolbar" size="icon-sm" className="vf-chrome-control vf-chrome-icon-btn" aria-label={t('redo')} disabled={!editor.canRedo() || props.busy} onClick={() => editor.redo()}><Redo2 size={15} aria-hidden /></Button>
      </HoverTip>
    </div>
    {props.hasResult && (
      <HoverTip label={t(props.exporting ? 'exporting' : 'export')}>
        <Button
          type="button"
          variant="toolbar"
          size="icon-sm"
          className="dh-header-project-settings vf-chrome-control vf-chrome-icon-btn"
          data-ip-export
          disabled={props.busy || props.exporting || !props.canExport}
          aria-label={t(props.exporting ? 'exporting' : 'export')}
          onClick={props.onExport}
        >
          {props.exporting ? <Loader2 size={15} className="animate-spin shrink-0" aria-hidden /> : <Download size={15} aria-hidden />}
        </Button>
      </HoverTip>
    )}
  </div>
  if (props.targets?.chrome) return createPortal(chrome, props.targets.chrome)
  return <header className="ipt-toolbar">{chrome}</header>
}
