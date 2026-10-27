import type { MutableRefObject } from 'react'
import {
  SocialStudioWizard,
  type SocialStudioWizardDevHandles,
} from '../social-studio/wizard/SocialStudioWizard'
import type { WizardGeneratedResult } from '../social-studio/wizard/types'

export type WechatArticleBenchmarkPanelProps = {
  onComplete: (result: WizardGeneratedResult) => void
  onExitToStudio: () => void
  onOpenHistory?: () => void
  devHandlesRef?: MutableRefObject<SocialStudioWizardDevHandles | null>
}

/** 公众号 · 爆款复刻向导（独立板块） */
export function WechatArticleBenchmarkPanel({
  onComplete,
  onExitToStudio,
  onOpenHistory,
  devHandlesRef,
}: WechatArticleBenchmarkPanelProps) {
  return (
    <SocialStudioWizard
      platform="wechat"
      onComplete={onComplete}
      onExitToStudio={onExitToStudio}
      onOpenHistory={onOpenHistory}
      devHandlesRef={devHandlesRef}
    />
  )
}
