import { ResizableSeparator } from '@no996/ui/resizable-separator'

type Props = {
  onResize: (delta: number) => void
  currentSize: number
  min: number
  max: number
}

/** Domain adapter for the voice workspace's right-side settings panel. */
export function VoiceWorkspaceDivider({ onResize, currentSize, min, max }: Props) {
  return (
    <ResizableSeparator
      className="voice-workspace-divider"
      label="调整配音设置栏宽度"
      value={currentSize}
      min={min}
      max={max}
      direction={-1}
      step={10}
      onResize={onResize}
    />
  )
}
