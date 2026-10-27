import { ChevronDown } from 'lucide-react'

export type LibrarySectionHeaderProps = {
  label: string
  count: number
  expanded: boolean
  onToggle?: () => void
  accentDot?: string
  /** 非折叠区块（如 BGM）仅展示标题 */
  staticHeader?: boolean
}

export function LibrarySectionHeader({
  label,
  count,
  expanded,
  onToggle,
  accentDot,
  staticHeader = false,
}: LibrarySectionHeaderProps) {
  if (staticHeader) {
    return (
      <div className="vf-lib-section vf-lib-section--static">
        {accentDot ? (
          <span className="vf-lib-section__dot" style={{ background: accentDot }} aria-hidden />
        ) : null}
        <span className="vf-lib-section__label">{label}</span>
        <span className="vf-lib-section__count">{count}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className="vf-lib-section"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <span className="vf-lib-section__leading">
        {accentDot ? (
          <span className="vf-lib-section__dot" style={{ background: accentDot }} aria-hidden />
        ) : null}
        <span className="vf-lib-section__label">{label}</span>
        <span className="vf-lib-section__count">{count}</span>
      </span>
      <ChevronDown
        className="vf-lib-section__chevron size-3.5"
        data-collapsed={!expanded}
        aria-hidden
      />
    </button>
  )
}
