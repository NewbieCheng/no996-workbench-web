interface MomentsGoalCheckProps {
  className?: string
  animate?: boolean
  size?: number
}

export function MomentsGoalCheck({ className = '', animate = false, size = 14 }: MomentsGoalCheckProps) {
  return (
    <svg
      className={`moments-goal-check${animate ? ' moments-goal-check--animate' : ''} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
    >
      <path
        className="moments-goal-check__path"
        d="M3.5 8.2 6.4 11.1 12.5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
