import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
type EnumOption<T extends string> = { value: T; label: string }

type SingleProps<T extends string> = {
  value: T | ''
  placeholder: string
  options: readonly EnumOption<T>[]
  onChange: (value: T) => void
  'aria-label': string
  disabled?: boolean
}

export function PersonaQuestionnaireSingleSelect<T extends string>({
  value,
  placeholder: _placeholder,
  options,
  onChange,
  'aria-label': ariaLabel,
  disabled,
}: SingleProps<T>) {
  return (
    <div className="persona-q-choice-group" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const selected = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            className="persona-q-choice"
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

type MultiProps<T extends string> = {
  values: T[]
  placeholder: string
  options: readonly EnumOption<T>[]
  onToggle: (value: T, checked: boolean) => void
  'aria-label': string
  disabled?: boolean
}

export function PersonaQuestionnaireMultiSelect<T extends string>({
  values,
  placeholder,
  options,
  onToggle,
  'aria-label': ariaLabel,
  disabled,
}: MultiProps<T>) {
  const summary = values.length
    ? options
        .filter((o) => values.includes(o.value))
        .map((o) => o.label)
        .join('、')
    : placeholder

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="persona-q-multi-select-trigger h-8 w-full max-w-none justify-between gap-2 px-2.5 font-normal"
          >
            <span className="min-w-0 truncate text-left text-sm">{summary}</span>
            <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent className="persona-q-multi-select-menu min-w-[var(--anchor-width)]" align="start">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={values.includes(o.value)}
            onCheckedChange={(checked) => onToggle(o.value, checked === true)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
