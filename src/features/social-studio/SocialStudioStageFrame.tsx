import type { ReactNode } from 'react'

type SocialStudioStageFrameProps = {
  generating?: boolean
  children: ReactNode
}

export function SocialStudioStageFrame({ generating, children }: SocialStudioStageFrameProps) {
  return (
    <div className="social-studio-stage-frame">
      {generating ? <div className="social-studio-stage-frame__generating-bar" aria-hidden /> : null}
      {children}
    </div>
  )
}
