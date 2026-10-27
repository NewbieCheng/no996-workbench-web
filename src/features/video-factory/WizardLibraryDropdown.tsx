import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, LoaderCircle } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import {
  useWorkbenchTaskActions,
  useWorkbenchTasks,
  type WorkbenchTaskRecord,
} from '../../services/workbench-tasks'
import {
  listScriptImportTasks,
  listVoiceImportTasks,
  scriptListRowFromPayload,
  scriptTextFromPayload,
  voiceListRowFromPayload,
  voiceMetaFromPayload,
  type LibraryListRowCopy,
} from './lib/wizard-import-library'

type RowState = {
  task: WorkbenchTaskRecord
  copy: LibraryListRowCopy
}

export type WizardLibraryDropdownProps = {
  mode: 'script' | 'voice'
  disabled?: boolean
  onPickScript: (text: string) => void
  onPickVoice: (input: { blob: Blob; text: string; voiceLabel: string; voiceId?: string }) => void
}

export function WizardLibraryDropdown({
  mode,
  disabled,
  onPickScript,
  onPickVoice,
}: WizardLibraryDropdownProps) {
  const actions = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<RowState[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [busyId, setBusyId] = useState('')

  const candidates = useMemo(
    () => (mode === 'script' ? listScriptImportTasks(tasks) : listVoiceImportTasks(tasks)),
    [mode, tasks],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingList(true)
    setRows([])
    void (async () => {
      const next: RowState[] = []
      for (const task of candidates.slice(0, 30)) {
        const raw = await actions.getPayload(task.payloadId)
        if (cancelled) return
        const copy =
          mode === 'script'
            ? scriptListRowFromPayload(raw, task)
            : voiceListRowFromPayload(raw, task)
        next.push({ task, copy })
      }
      if (!cancelled) {
        setRows(next)
        setLoadingList(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, candidates, actions, mode])

  async function pickScript(task: WorkbenchTaskRecord) {
    setBusyId(task.id)
    try {
      const raw = await actions.getPayload(task.payloadId)
      const text = scriptTextFromPayload(raw)
      if (!text.trim()) return
      onPickScript(text)
      setOpen(false)
    } finally {
      setBusyId('')
    }
  }

  async function pickVoice(task: WorkbenchTaskRecord, withScript: boolean) {
    setBusyId(task.id)
    try {
      const raw = await actions.getPayload(task.payloadId)
      const meta = voiceMetaFromPayload(raw, task)
      const url = await actions.getVoicePlaybackUrl(task)
      if (!url) return
      const res = await fetch(url)
      const blob = await res.blob()
      if (!blob.size) return
      onPickVoice({
        blob,
        text: withScript ? meta.text : '',
        voiceLabel: meta.voiceLabel,
        voiceId: meta.voiceId,
      })
      setOpen(false)
    } finally {
      setBusyId('')
    }
  }

  const triggerLabel = mode === 'script' ? '历史文稿' : '配音库'

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled || busyId !== ''}
        render={
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="vf-wizard__library-trigger"
            disabled={disabled || busyId !== ''}
          >
            {busyId ? (
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
            ) : (
              triggerLabel
            )}
            <ChevronDown className="size-3 opacity-60" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="vf-wizard-popover vf-wizard-library-menu min-w-[16rem] max-w-[22rem]"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {mode === 'script' ? '选择脚本任务导入口播' : '选择历史配音'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {loadingList ? (
          <div className="vf-wizard-library-menu__empty">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            加载中…
          </div>
        ) : rows.length === 0 ? (
          <div className="vf-wizard-library-menu__empty">暂无记录</div>
        ) : mode === 'script' ? (
          rows.map(({ task, copy }) => (
            <DropdownMenuItem
              key={task.id}
              disabled={busyId === task.id}
              className="vf-wizard-library-menu__item"
              onSelect={() => void pickScript(task)}
            >
              <span className="vf-wizard-library-menu__title">{copy.title}</span>
              {copy.preview ? (
                <span className="vf-wizard-library-menu__preview">{copy.preview}</span>
              ) : null}
            </DropdownMenuItem>
          ))
        ) : (
          rows.map(({ task, copy }) => (
            <DropdownMenuSub key={task.id}>
              <DropdownMenuSubTrigger
                disabled={busyId === task.id}
                className="vf-wizard-library-menu__sub-trigger"
              >
                <span className="vf-wizard-library-menu__title">{copy.title}</span>
                {copy.preview ? (
                  <span className="vf-wizard-library-menu__preview">{copy.preview}</span>
                ) : null}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="vf-wizard-popover min-w-[10rem]">
                <DropdownMenuItem onSelect={() => void pickVoice(task, false)}>仅音频</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void pickVoice(task, true)}>
                  音频+文稿（估时字幕）
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
