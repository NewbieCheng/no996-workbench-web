import i18n from '@/i18n'
import { ResizableSeparator } from '@no996/ui/resizable-separator'

export function ResizableDivider({
  onResize,
  currentSize,
}: {
  onResize: (delta: number) => void
  currentSize: number
}) {
  return (
    <ResizableSeparator
      className="social-studio-divider"
      label={i18n.t('uiCopy:调整创作配置栏宽度', { keySeparator: false })}
      value={currentSize}
      min={280}
      max={420}
      direction={-1}
      step={10}
      onResize={onResize}
    />
  )
}
