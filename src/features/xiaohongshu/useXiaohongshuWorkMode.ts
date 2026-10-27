import { useCallback, useEffect, useState } from 'react'
import {
  readXhsWorkMode,
  writeXhsWorkMode,
  type XhsWorkMode,
} from './xhs-work-mode-storage'
import { syncXiaohongshuContentWidthForWorkMode } from './xiaohongshu-content-width'

export function useXiaohongshuWorkMode() {
  const [workMode, setWorkModeState] = useState<XhsWorkMode>(() => readXhsWorkMode())

  const setWorkMode = useCallback((mode: XhsWorkMode) => {
    setWorkModeState(mode)
    writeXhsWorkMode(mode)
  }, [])

  useEffect(() => {
    const apply = () => syncXiaohongshuContentWidthForWorkMode(workMode)
    apply()
    const frame = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(frame)
  }, [workMode])

  return { workMode, setWorkMode }
}
