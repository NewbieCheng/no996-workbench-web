import { useRef, useState, type KeyboardEvent } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { ArrowUpIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { Button } from './button'
import { Textarea } from './textarea'
import { HoverTip } from './tooltip'
import { cn } from './utils'
import './ai-edit-popover.css'

export type AIEditQuickPrompt = {
  label: string
  instruction: string
}

export type AIEditPopoverLabels = {
  trigger: string
  context: string
  promptPlaceholder: string
  apply: string
  dismiss: string
  loading: string
  send: string
  focusHint: string
  result: string
}

export type AIEditPopoverProps = {
  fieldLabel: string
  value: string
  result?: string
  streamingResult?: string
  busy?: boolean
  error?: string
  disabled?: boolean
  quickPrompts: readonly AIEditQuickPrompt[]
  labels: AIEditPopoverLabels
  onGenerate: (instruction: string) => void
  onApply: () => void
  onDismiss: () => void
  className?: string
  triggerClassName?: string
  popoverClassName?: string
  popoverSide?: 'top' | 'right' | 'bottom' | 'left'
  popoverAlign?: 'start' | 'center' | 'end'
}

/** Field-scoped AI writing assistant. Generation stays with the feature; this component owns the shared interaction. */
export function AIEditPopover({
  fieldLabel,
  value,
  result,
  streamingResult,
  busy = false,
  error,
  disabled = false,
  quickPrompts,
  labels,
  onGenerate,
  onApply,
  onDismiss,
  className,
  triggerClassName,
  popoverClassName,
  popoverSide = 'bottom',
  popoverAlign = 'end',
}: AIEditPopoverProps) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const promptRef = useRef<HTMLTextAreaElement>(null)
  const canGenerate = Boolean(value.trim() || instruction.trim()) && !busy && !disabled

  function submit() {
    if (!canGenerate) return
    onGenerate(instruction.trim())
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setInstruction('')
      }}
    >
      <HoverTip label={labels.trigger} side="top" open={open ? false : undefined}>
        <PopoverPrimitive.Trigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={cn('ai-edit-popover__trigger', className, triggerClassName)}
              disabled={disabled || busy}
              aria-label={`${labels.trigger}：${fieldLabel}`}
            />
          }
        >
          <SparklesIcon className="size-4" aria-hidden />
        </PopoverPrimitive.Trigger>
      </HoverTip>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side={popoverSide}
          align={popoverAlign}
          sideOffset={10}
          collisionPadding={12}
          className="ai-edit-popover__positioner"
        >
          <PopoverPrimitive.Popup
            className={cn('ai-edit-popover', popoverClassName)}
            role="dialog"
            aria-label={`${labels.trigger}：${fieldLabel}`}
            initialFocus={promptRef}
          >
            <div className="ai-edit-popover__context">
              <span>{labels.context} · {fieldLabel}</span>
              <span className="ai-edit-popover__context-value">{value.trim() || fieldLabel}</span>
            </div>

            <div className="ai-edit-popover__prompt-wrap">
              <Textarea
                ref={promptRef}
                className="ai-edit-popover__prompt"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder={labels.promptPlaceholder}
                rows={3}
                disabled={busy || disabled}
                aria-label={labels.promptPlaceholder}
              />
              <div className="ai-edit-popover__controls">
                <div className="ai-edit-popover__quick-prompts">
                  {quickPrompts.map((prompt) => (
                    <button
                      key={prompt.label}
                      type="button"
                      className={cn('ai-edit-popover__quick-prompt', instruction === prompt.instruction && 'is-active')}
                      disabled={busy || disabled}
                      onClick={() => setInstruction(prompt.instruction)}
                    >
                      {prompt.label}
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  size="icon"
                  className="ai-edit-popover__send"
                  disabled={!canGenerate}
                  aria-label={busy ? labels.loading : labels.send}
                  onClick={submit}
                >
                  {busy ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <ArrowUpIcon className="size-4" aria-hidden />}
                </Button>
              </div>
            </div>

            {error ? <p className="ai-edit-popover__error" role="alert">{error}</p> : null}
            {busy && streamingResult ? (
              <section className="ai-edit-popover__result" aria-live="polite">
                <p className="ai-edit-popover__result-label">{labels.result}</p>
                <p className="ai-edit-popover__result-text">{streamingResult}</p>
              </section>
            ) : null}
            {result && !busy ? (
              <section className="ai-edit-popover__result" aria-live="polite">
                <p className="ai-edit-popover__result-label">{labels.result}</p>
                <p className="ai-edit-popover__result-text">{result}</p>
                <div className="ai-edit-popover__result-actions">
                  <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>{labels.dismiss}</Button>
                  <Button type="button" size="sm" onClick={() => { onApply(); setOpen(false) }}>{labels.apply}</Button>
                </div>
              </section>
            ) : null}

            <div className="ai-edit-popover__footer">
              {busy ? <p className="ai-edit-popover__loading" role="status">{labels.loading}</p> : null}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
