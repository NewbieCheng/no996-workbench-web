import type { ReactNode } from 'react'
import { cn } from '@no996/ui/utils'

/** 与顶栏 PersonaBinding 同款的胶囊触发器外壳 */
export function DigitalHumanPersonaChipShell({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('persona-injection persona-binding dh-persona-chip', className)} data-on="true">
      {children}
    </div>
  )
}

export const digitalHumanPersonaChipButtonClass = 'persona-injection__label'
