type Props = {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  labelClassName?: string
  disabled?: boolean
}

/** 侧栏开关：关 / 开 胶囊分段 */
export function VoiceCapsuleToggle({
  label,
  checked,
  onCheckedChange,
  className = '',
  labelClassName = '',
  disabled = false,
}: Props) {
  const rowClass = ['voice-capsule-toggle-row', className].filter(Boolean).join(' ')
  const labelClass = ['voice-capsule-toggle-row__label', labelClassName].filter(Boolean).join(' ')

  return (
    <div className={rowClass}>
      <span className={labelClass}>{label}</span>
      <div className="voice-capsule-toggle" role="group" aria-label={label}>
        <button
          type="button"
          className={`voice-capsule-toggle__btn${!checked ? ' is-active' : ''}`}
          aria-pressed={!checked}
          disabled={disabled}
          onClick={() => onCheckedChange(false)}
        >
          关
        </button>
        <button
          type="button"
          className={`voice-capsule-toggle__btn${checked ? ' is-active' : ''}`}
          aria-pressed={checked}
          disabled={disabled}
          onClick={() => onCheckedChange(true)}
        >
          开
        </button>
      </div>
    </div>
  )
}
