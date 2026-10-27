/**
 * 视频工厂 · 页顶 chrome（`Page` actions / workbench-tool）
 *
 * 工程切换、撤销重做、文件菜单、一键出片、导出成片。
 */

import { useRef, useState, type ReactElement, type ReactNode } from 'react'
import {
  FileDown,
  FileUp,
  Film,
  FolderOpen,
  Loader2,
  MoreHorizontal,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Trash2,
  Undo2,
  PanelLeftClose,
  PanelRightClose,
  Wand2,
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@no996/ui/tooltip'
import {
  deserializeDocument,
  serializeDocument,
  type EditorDocument,
  type EditorInstance,
} from '@no996/video-editor'
import { downloadText } from '../../services/browser'
import { notifyVideoFactory } from './lib/page-notice'

export type VideoFactoryPageChromeProps = {
  editor: EditorInstance | null
  draftList: { id: string; name: string }[]
  activeDoc: EditorDocument | null
  onOpenDraft: (id: string) => void
  onCreateDraft: () => void
  onRenameDraft: (name: string) => void
  onDeleteDraft: () => void
  onExport: () => void
  onExportJson: () => void
  onImportJson: (doc: EditorDocument) => void
  onReset: () => void
  exporting: boolean
  /** 紧挨工程名左侧：属性栏收起钮 */
  rightPanelToggle?: ReactNode
}

function ChromeTip({ label, children }: { label: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="bottom" sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  )
}

/** 顶栏左右：收起 / 展开素材栏、属性栏 */
export function VideoFactoryPanelChromeToggle({
  side,
  collapsed,
  onToggle,
  disabled,
}: {
  side: 'left' | 'right'
  collapsed: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  const label =
    side === 'left'
      ? collapsed
        ? '展开素材栏'
        : '收起素材栏'
      : collapsed
        ? '展开属性栏'
        : '收起属性栏'
  const Icon = side === 'left' ? PanelLeftClose : PanelRightClose

  return (
    <TooltipProvider delay={400}>
      <ChromeTip label={label}>
        <Button
          type="button"
          variant="toolbar"
          size="icon-sm"
          className="vf-chrome-control vf-chrome-panel-toggle"
          data-side={side}
          data-collapsed={collapsed}
          onClick={onToggle}
          disabled={disabled}
          aria-label={label}
          aria-pressed={collapsed}
        >
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
        </Button>
      </ChromeTip>
    </TooltipProvider>
  )
}

/** 标题行右侧：AI 一键出视频入口（带 HOT 角标） */
export function VideoFactoryAiQuickButton({
  disabled,
  onClick,
}: {
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <TooltipProvider delay={400}>
      <ChromeTip label="AI一键出视频">
        <Button
          type="button"
          variant="toolbar"
          size="sm"
          className="vf-chrome-control vf-chrome-ai-entry"
          onClick={onClick}
          disabled={disabled}
          aria-label="AI一键出视频"
        >
          <Wand2 size={14} strokeWidth={2} aria-hidden="true" />
          <span className="vf-chrome-ai-entry__label">AI一键出视频</span>
          <span className="vf-chrome-ai-entry__hot">HOT</span>
        </Button>
      </ChromeTip>
    </TooltipProvider>
  )
}

export function VideoFactoryPageChrome({
  editor,
  draftList,
  activeDoc,
  onOpenDraft,
  onCreateDraft,
  onRenameDraft,
  onDeleteDraft,
  onExport,
  onExportJson,
  onImportJson,
  onReset,
  exporting,
  rightPanelToggle,
}: VideoFactoryPageChromeProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameInput, setRenameInput] = useState('')

  const projectLabel = activeDoc?.name?.trim() || '未命名工程'

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      onImportJson(deserializeDocument(text))
    } catch (error) {
      notifyVideoFactory(`导入失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const openRename = () => {
    setRenameInput(activeDoc?.name ?? '')
    setRenameOpen(true)
  }

  const commitRename = () => {
    const next = renameInput.trim()
    if (!next) return
    onRenameDraft(next)
    setRenameOpen(false)
  }

  const canUndo = Boolean(editor?.canUndo())
  const canRedo = Boolean(editor?.canRedo())

  return (
    <TooltipProvider delay={400}>
      <div className="vf-page-chrome" data-testid="video-factory-page-chrome">
        {rightPanelToggle}

        <div className="vf-chrome-project-cluster">
          {draftList.length > 1 && activeDoc ? (
            <Select
              items={draftList.map((draft) => ({ value: draft.id, label: draft.name }))}
              value={activeDoc.id}
              onValueChange={(next) => {
                if (next != null) onOpenDraft(String(next))
              }}
            >
              <SelectTrigger className="vf-chrome-control vf-chrome-project-select" aria-label="切换工程">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {draftList.map((draft) => (
                  <SelectItem key={draft.id} value={draft.id}>
                    {draft.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <ChromeTip label={projectLabel}>
              <span className="vf-chrome-control vf-chrome-project-name" tabIndex={0}>{projectLabel}</span>
            </ChromeTip>
          )}

          <DropdownMenu>
            <ChromeTip label="工程菜单">
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="toolbar"
                    size="icon-sm"
                    className="vf-chrome-control vf-chrome-project-settings"
                    aria-label="工程菜单"
                  />
                }
              >
                <MoreHorizontal size={15} aria-hidden="true" />
              </DropdownMenuTrigger>
            </ChromeTip>
            <DropdownMenuContent align="end" className="wb-tool-chrome-menu">
              <DropdownMenuItem onSelect={() => onCreateDraft()}>
                <Plus size={14} className="mr-2" aria-hidden="true" />
                新建工程
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={openRename} disabled={!activeDoc}>
                <Settings2 size={14} className="mr-2" aria-hidden="true" />
                重命名工程
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDeleteDraft()} disabled={!activeDoc}>
                <Trash2 size={14} className="mr-2" aria-hidden="true" />
                删除当前工程
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <span className="vf-chrome-divider" aria-hidden="true" />

        <div className="vf-chrome-undo-group" role="group" aria-label="撤销与重做">
          <ChromeTip label="撤销">
            <Button
              type="button"
              variant="toolbar"
              size="icon-sm"
              className="vf-chrome-control vf-chrome-icon-btn"
              disabled={!canUndo}
              onClick={() => editor?.undo()}
              aria-label="撤销"
            >
              <Undo2 size={15} aria-hidden="true" />
            </Button>
          </ChromeTip>
          <ChromeTip label="重做">
            <Button
              type="button"
              variant="toolbar"
              size="icon-sm"
              className="vf-chrome-control vf-chrome-icon-btn"
              disabled={!canRedo}
              onClick={() => editor?.redo()}
              aria-label="重做"
            >
              <Redo2 size={15} aria-hidden="true" />
            </Button>
          </ChromeTip>
        </div>

        <DropdownMenu>
          <ChromeTip label="文件">
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="toolbar"
                  size="icon-sm"
                  className="vf-chrome-control vf-chrome-icon-btn"
                  aria-label="文件"
                />
              }
            >
              <FolderOpen size={15} aria-hidden="true" />
            </DropdownMenuTrigger>
          </ChromeTip>
          <DropdownMenuContent align="end" className="wb-tool-chrome-menu">
            <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
              <FileUp size={14} className="mr-2" aria-hidden="true" />
              导入 JSON
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onExportJson()} disabled={!activeDoc}>
              <FileDown size={14} className="mr-2" aria-hidden="true" />
              导出 JSON
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onReset()}>
              <RotateCcw size={14} className="mr-2" aria-hidden="true" />
              重置示例
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ChromeTip label={exporting ? '导出中…' : '导出成片'}>
          <Button
            type="button"
            variant="toolbar"
            size="icon-sm"
            className="vf-chrome-control vf-chrome-icon-btn vf-chrome-cta"
            onClick={onExport}
            disabled={exporting || !activeDoc}
            aria-label={exporting ? '导出中…' : '导出成片'}
          >
            {exporting ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Film size={15} aria-hidden="true" />
            )}
          </Button>
        </ChromeTip>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void handleImport(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名工程</DialogTitle>
            <DialogDescription>修改当前剪辑工程的显示名称，自动保存会同步更新。</DialogDescription>
          </DialogHeader>
          <Input
            value={renameInput}
            maxLength={80}
            placeholder="工程名称"
            aria-label="工程名称"
            onChange={(event) => setRenameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename()
            }}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="toolbar" size="sm" onClick={() => setRenameOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="toolbar" size="sm" className="vf-chrome-cta" onClick={commitRename}>
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}

/** @deprecated 使用 VideoFactoryPageChrome；保留类型别名供文档过渡 */
export type FactoryToolbarProps = VideoFactoryPageChromeProps

/** 把工程导出为 JSON 文件。 */
export function exportDocumentJson(doc: EditorDocument): void {
  const json = serializeDocument(doc)
  const safeName = doc.name.replace(/[^\w\u4e00-\u9fa5·-]+/g, '_').slice(0, 40) || '工程'
  downloadText(json, `${safeName}.json`, 'application/json;charset=utf-8')
}
