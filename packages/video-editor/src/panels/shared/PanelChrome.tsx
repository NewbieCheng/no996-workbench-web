import React from 'react'
import { Lightbulb } from 'lucide-react'
import './panel-chrome.css'

type PanelIconComponent = React.ElementType

export function PanelHint({
  children,
  variant = 'footer',
}: {
  children: React.ReactNode
  variant?: 'footer' | 'inline'
}) {
  const className =
    variant === 'inline' ? 've-panel-hint ve-panel-hint--inline' : 've-panel-hint'
  return (
    <div className={className}>
      <Lightbulb className="ve-panel-hint__icon" aria-hidden />
      <span>{children}</span>
    </div>
  )
}

export function PanelEmptyIcon({
  icon: Icon,
  size = 20,
  large,
}: {
  icon: PanelIconComponent
  size?: number
  large?: boolean
}) {
  const className = large
    ? 've-panel-empty__icon ve-panel-empty__icon--lg'
    : 've-panel-empty__icon'
  return (
    <div className={className}>
      <Icon size={size} aria-hidden />
    </div>
  )
}
