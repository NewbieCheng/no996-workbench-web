import { cn } from '@no996/ui/utils'

export type ChipOption<T extends string> = { value: T; label: string }

type SocialStudioChipRowProps<T extends string> = {
  options: ChipOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  'aria-label': string
}

export function SocialStudioChipRow<T extends string>({
  options,
  value,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: SocialStudioChipRowProps<T>) {
  return (
    <div className="ssc-chip-row" role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={cn('ssc-chip', value === opt.value && 'ssc-chip--active')}
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
