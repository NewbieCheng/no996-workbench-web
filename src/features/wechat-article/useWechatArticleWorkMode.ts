import { useCallback, useEffect, useState } from 'react'
import {
  readWechatArticleWorkMode,
  writeWechatArticleWorkMode,
  type WechatArticleWorkMode,
} from './wechat-article-work-mode-storage'
import { syncWechatArticleContentWidthForWorkMode } from './wechat-article-content-width'

export function useWechatArticleWorkMode() {
  const [workMode, setWorkModeState] = useState<WechatArticleWorkMode>(() => readWechatArticleWorkMode())

  const setWorkMode = useCallback((mode: WechatArticleWorkMode) => {
    setWorkModeState(mode)
    writeWechatArticleWorkMode(mode)
  }, [])

  useEffect(() => {
    const apply = () => syncWechatArticleContentWidthForWorkMode(workMode)
    apply()
    const frame = requestAnimationFrame(apply)
    return () => cancelAnimationFrame(frame)
  }, [workMode])

  return { workMode, setWorkMode }
}
