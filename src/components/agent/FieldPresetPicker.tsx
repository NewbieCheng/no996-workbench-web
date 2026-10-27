import { useState } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { CheckIcon, ListFilterIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import { cn } from '@no996/ui/utils'

type Props = {
  label: string
  value: string
  options: readonly string[]
  onSelect: (value: string) => void
  disabled?: boolean
  className?: string
}

/** 字段预设选择器（人设 / 脚本 Lab 等共用） */
export function FieldPresetPicker({ label, value, options, onSelect, disabled, className }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        render={(
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn('field-preset-picker__trigger persona-preset-picker__trigger', className)}
            aria-label={`${label}预设选项`}
            disabled={disabled}
          />
        )}
      >
        <ListFilterIcon className="size-4" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="bottom"
          align="end"
          sideOffset={6}
          className="field-preset-picker__positioner persona-preset-picker__positioner"
        >
          <PopoverPrimitive.Popup
            className="field-preset-picker__popup persona-preset-picker__popup"
            role="dialog"
            aria-label={`${label}预设选项`}
          >
            <div className="field-preset-picker__heading persona-preset-picker__heading">选择{label}预设</div>
            <div
              className="field-preset-picker__list persona-preset-picker__list"
              role="group"
              aria-label={`${label}预设`}
            >
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'field-preset-picker__option persona-preset-picker__option',
                    option === value && 'is-selected',
                  )}
                  aria-pressed={option === value}
                  onClick={() => {
                    onSelect(option)
                    setOpen(false)
                  }}
                >
                  <span>{option}</span>
                  {option === value ? <CheckIcon className="size-4" aria-hidden /> : null}
                </button>
              ))}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
