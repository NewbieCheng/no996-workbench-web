import i18n from '@/i18n'
import { ResizableSeparator } from '@no996/ui/resizable-separator'

export function ImageTextSplitDivider({ onResize }: { onResize: (delta: number) => void }) {
  return (
    <ResizableSeparator
      className="editor-image-split-divider"
      label={i18n.t('uiCopy:调整图片与文案区域宽度', { keySeparator: false })}
      step={12}
      onResize={onResize}
    />
  )
}
