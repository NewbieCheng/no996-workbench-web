import { useCallback, useState, type ReactNode } from 'react'
import { VoiceWorkspaceDivider } from './VoiceWorkspaceDivider'

const DOCK_WIDTH_MIN = 280
const DOCK_WIDTH_MAX = 420
const DOCK_WIDTH_DEFAULT = 320

type Props = {
  editor: ReactNode
  dock: ReactNode
}

/** 配音创作区：文稿 + 可拖拽分隔 + 右侧设置坞（音色与参数均在坞内「配音」签） */
export function VoiceDubWorkspace({ editor, dock }: Props) {
  const [dockWidth, setDockWidth] = useState(DOCK_WIDTH_DEFAULT)

  const onDockResize = useCallback((delta: number) => {
    setDockWidth((w) => Math.min(DOCK_WIDTH_MAX, Math.max(DOCK_WIDTH_MIN, w + delta)))
  }, [])

  return (
    <div
      className="voice-workspace voice-workspace--split"
      style={{ ['--voice-dock-width' as string]: `${dockWidth}px` }}
    >
      <div className="voice-workspace__editor">{editor}</div>
      <div className="voice-workspace__dock">{dock}</div>
      <VoiceWorkspaceDivider
        onResize={onDockResize}
        currentSize={dockWidth}
        min={DOCK_WIDTH_MIN}
        max={DOCK_WIDTH_MAX}
      />
    </div>
  )
}
