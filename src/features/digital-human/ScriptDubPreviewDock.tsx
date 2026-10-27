import type { ReactNode } from 'react'
import { ChevronDown, Headphones, Trash2 } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@no996/ui/tooltip'

export type ScriptDubPreviewTrailingControls = {
  collapse: ReactNode
  delete?: ReactNode
}

type ScriptDubPreviewDockProps = {
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
  /** 展开态可传入函数，将尾部控件注入播放器右侧（静音钮之后） */
  audioPreview: ReactNode | ((trailing: ScriptDubPreviewTrailingControls) => ReactNode)
  expandLabel: string
  collapseLabel: string
  onDelete?: () => void
  deleteLabel?: string
  deleteDisabled?: boolean
}

export function ScriptDubPreviewDock({
  collapsed,
  onCollapsedChange,
  audioPreview,
  expandLabel,
  collapseLabel,
  onDelete,
  deleteLabel,
  deleteDisabled,
}: ScriptDubPreviewDockProps) {
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="dh-script-meta-listen h-7 shrink-0 gap-1.5 px-2 text-xs font-medium"
              onClick={() => onCollapsedChange(false)}
            >
              <Headphones size={13} aria-hidden />
              <span>{expandLabel}</span>
            </Button>
          }
        />
        <TooltipContent side="top">{expandLabel}</TooltipContent>
      </Tooltip>
    )
  }

  const collapseControl = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="dh-script-dub-dock__collapse dh-studio-player__mute-btn size-7 shrink-0 px-0"
            aria-label={collapseLabel}
            onClick={() => onCollapsedChange(true)}
          >
            <ChevronDown size={14} aria-hidden />
          </Button>
        }
      />
      <TooltipContent side="top">{collapseLabel}</TooltipContent>
    </Tooltip>
  )

  const deleteControl =
    onDelete && deleteLabel ? (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="dh-script-dub-dock__delete dh-studio-player__mute-btn size-7 shrink-0 px-0 text-destructive hover:text-destructive"
              aria-label={deleteLabel}
              disabled={deleteDisabled}
              onClick={onDelete}
            >
              <Trash2 size={14} aria-hidden />
            </Button>
          }
        />
        <TooltipContent side="top">{deleteLabel}</TooltipContent>
      </Tooltip>
    ) : undefined

  const preview =
    typeof audioPreview === 'function'
      ? audioPreview({ collapse: collapseControl, delete: deleteControl })
      : audioPreview

  return (
    <div className="dh-script-dub-dock" onPointerDown={event => event.stopPropagation()}>
      <div className="dh-script-dub-dock__scrim" aria-hidden />
      <div className="dh-script-dub-dock__panel">
        <div className="dh-script-dub-dock__player min-w-0 flex-1">{preview}</div>
      </div>
    </div>
  )
}
