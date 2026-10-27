import { motion, useReducedMotion } from 'framer-motion'

interface MomentsWeekProgressRingProps {
  generated: number
  total: number
  label: string
}

export function MomentsWeekProgressRing({ generated, total, label }: MomentsWeekProgressRingProps) {
  const reduceMotion = useReducedMotion()
  const safeTotal = Math.max(total, 1)
  const ratio = Math.min(1, Math.max(0, generated / safeTotal))
  const size = 52
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - ratio)

  return (
    <div className="moments-goal-ring" role="img" aria-label={label}>
      <svg width={size} height={size} className="moments-goal-ring__svg" aria-hidden>
        <circle
          className="moments-goal-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <motion.circle
          className="moments-goal-ring__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 18 }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <span className="moments-goal-ring__text">
        <strong>{generated}</strong>
        <span className="moments-goal-ring__sep">/</span>
        {total}
      </span>
    </div>
  )
}
