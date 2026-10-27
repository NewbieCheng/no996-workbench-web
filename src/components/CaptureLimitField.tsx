import { useEffect, useState } from 'react'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { cn } from '@no996/ui/utils'

export const CAPTURE_LIMIT_MIN = 1
export const CAPTURE_LIMIT_MAX = 50
export const DEFAULT_CAPTURE_LIMIT = 5

export function clampCaptureLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CAPTURE_LIMIT
  return Math.max(CAPTURE_LIMIT_MIN, Math.min(CAPTURE_LIMIT_MAX, Math.round(value)))
}

type CaptureLimitFieldProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  className?: string
}

export function CaptureLimitField({ value, onChange, disabled, className }: CaptureLimitFieldProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commitDraft = () => {
    const parsed = Number(draft)
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = clampCaptureLimit(parsed)
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  const step = (delta: number) => {
    const next = clampCaptureLimit(value + delta)
    setDraft(String(next))
    onChange(next)
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-8 shrink-0 p-0"
        disabled={disabled || value <= CAPTURE_LIMIT_MIN}
        onClick={() => step(-1)}
        aria-label="减少条数"
      >
        −
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={CAPTURE_LIMIT_MIN}
        max={CAPTURE_LIMIT_MAX}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitDraft()
          }
        }}
        className="h-9 min-w-0 flex-1 text-center text-sm tabular-nums bg-background"
        aria-label="采集条数"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-8 shrink-0 p-0"
        disabled={disabled || value >= CAPTURE_LIMIT_MAX}
        onClick={() => step(1)}
        aria-label="增加条数"
      >
        +
      </Button>
    </div>
  )
}
