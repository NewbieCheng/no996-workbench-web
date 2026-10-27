import type { MutableRefObject } from 'react'
import {
  SocialStudioWizard,
  type SocialStudioWizardDevHandles,
} from '../social-studio/wizard/SocialStudioWizard'
import type { WizardGeneratedResult } from '../social-studio/wizard/types'

export type XiaohongshuBenchmarkPanelProps = {
  onComplete: (result: WizardGeneratedResult) => void
  onExitToStudio: () => void
  onOpenHistory?: () => void
  devHandlesRef?: MutableRefObject<SocialStudioWizardDevHandles | null>
}

/** 小红书 · 爆款复刻向导（独立板块） */
export function XiaohongshuBenchmarkPanel({
  onComplete,
  onExitToStudio,
  onOpenHistory,
  devHandlesRef,
}: XiaohongshuBenchmarkPanelProps) {
  return (
    <SocialStudioWizard
      platform="xhs"
      onComplete={onComplete}
      onExitToStudio={onExitToStudio}
      onOpenHistory={onOpenHistory}
      devHandlesRef={devHandlesRef}
    />
  )
}
