import type { XhsWorkMode } from './xhs-work-mode-storage'
import { SocialStudioWorkModeToolbar } from '../social-studio/SocialStudioWorkModeToolbar'

type XiaohongshuWorkModeToolbarProps = {
  workMode: XhsWorkMode
  onWorkModeChange: (mode: XhsWorkMode) => void
}

export function XiaohongshuWorkModeToolbar({
  workMode,
  onWorkModeChange,
}: XiaohongshuWorkModeToolbarProps) {
  return <SocialStudioWorkModeToolbar workMode={workMode} onWorkModeChange={onWorkModeChange} />
}
