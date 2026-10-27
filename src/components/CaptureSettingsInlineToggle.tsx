import { ChevronDown } from 'lucide-react'
import { cn } from '@no996/ui/utils'

type CaptureSettingsInlineToggleProps = {
  open: boolean
  title: string
  summary?: string
  className?: string
  onClick: () => void
}

export function CaptureSettingsInlineToggle({
  open,
  title,
  summary,
  className,
  onClick,
}: CaptureSettingsInlineToggleProps) {
  return (
    <button
      type="button"
      className={cn('wb-capture-settings__inline-toggle', className)}
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="wb-capture-settings__inline-main">
        <span className="wb-capture-settings__inline-title">{title}</span>
        {!open && summary ? (
          <span className="wb-capture-settings__inline-summary">{summary}</span>
        ) : null}
      </span>
      <ChevronDown
        className={cn('wb-capture-settings__inline-chevron size-3.5 shrink-0', open && 'is-open')}
        aria-hidden
      />
    </button>
  )
}
