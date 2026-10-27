import type { ReactNode } from 'react'

export type ScriptOptionTileProps = {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  subtitle?: ReactNode
  className?: string
  /** radio 用于互斥组（如结构 preset） */
  role?: 'button' | 'radio'
  ariaLabel?: string
  children?: ReactNode
}

export function ScriptOptionTile({
  selected,
  onSelect,
  title,
  subtitle,
  className = '',
  role = 'button',
  ariaLabel,
  children,
}: ScriptOptionTileProps) {
  const isRadio = role === 'radio'
  return (
    <button
      type="button"
      className={`sl-wiz-tile${selected ? ' sl-wiz-tile--on' : ''} ${className}`.trim()}
      aria-pressed={!isRadio ? selected : undefined}
      aria-checked={isRadio ? selected : undefined}
      role={isRadio ? 'radio' : undefined}
      aria-label={ariaLabel}
      onClick={onSelect}
    >
      <span className="sl-wiz-tile__title">{title}</span>
      {subtitle ? <small className="sl-wiz-tile__sub">{subtitle}</small> : null}
      {children}
    </button>
  )
}

export default ScriptOptionTile
