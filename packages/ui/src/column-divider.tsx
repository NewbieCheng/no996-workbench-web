import { useEffect, useRef, useState } from 'react'
import { cn } from './utils'
import { ResizableSeparator } from './resizable-separator'

const DIVIDER_TRACK_PX = 12

function computePreviewMax(
  parentWidth: number,
  minMainWidth: number,
  maxPreviewRatio?: number,
): number {
  const available = parentWidth - DIVIDER_TRACK_PX
  let max = Math.max(0, available - minMainWidth)
  if (maxPreviewRatio != null && maxPreviewRatio > 0 && maxPreviewRatio < 1) {
    max = Math.min(max, Math.floor(available * maxPreviewRatio))
  }
  return max
}

export function ColumnDivider({
  previewSelector,
  widthVariable,
  label,
  className,
  defaultWidth = 320,
  defaultRatio,
  minWidth = 220,
  minMainWidth = 320,
  maxPreviewRatio,
  invert = false,
}: {
  previewSelector: string
  widthVariable: `--${string}`
  label: string
  className?: string
  defaultWidth?: number
  /** 首次按父宽比例落默认宽度（如 0.5 = 左右约各半） */
  defaultRatio?: number
  minWidth?: number
  minMainWidth?: number
  /** 预览列最大占比（如 0.5 表示左右最多 5:5） */
  maxPreviewRatio?: number
  /** When the resized column is on the right, dragging right should shrink it. */
  invert?: boolean
}) {
  const handleRef = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: defaultWidth, max: defaultWidth })
  const root = () => handleRef.current?.parentElement
  const preview = () => root()?.querySelector<HTMLElement>(previewSelector)
  const resolveDefault = (parentWidth: number) => {
    if (defaultRatio != null && defaultRatio > 0 && defaultRatio < 1) {
      return Math.round((parentWidth - DIVIDER_TRACK_PX) * defaultRatio)
    }
    return defaultWidth
  }

  const measure = () => {
    const parent = root()
    if (!parent) return
    const fallback = resolveDefault(parent.clientWidth)
    const max = computePreviewMax(parent.clientWidth, minMainWidth, maxPreviewRatio)
    const current =
      Math.round(preview()?.offsetWidth ?? fallback) ||
      Math.round(parseFloat(parent.style.getPropertyValue(widthVariable)) || fallback)
    const width =
      max >= minWidth
        ? Math.round(Math.min(max, Math.max(minWidth, current)))
        : Math.round(Math.max(0, Math.min(max, current)))
    if (width !== current) {
      parent.style.setProperty(widthVariable, `${width}px`)
    }
    setBounds({ width, max })
  }

  useEffect(() => {
    const parent = handleRef.current?.parentElement
    if (!parent) return
    if (!parent.style.getPropertyValue(widthVariable)) {
      parent.style.setProperty(widthVariable, `${resolveDefault(parent.clientWidth)}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(parent)
    return () => observer.disconnect()
  }, [defaultWidth, defaultRatio, minWidth, minMainWidth, maxPreviewRatio, previewSelector, widthVariable])

  const resize = (requested: number) => {
    const parent = root()
    const handle = handleRef.current
    if (!parent || !handle) return
    const fallback = resolveDefault(parent.clientWidth)
    const max = computePreviewMax(parent.clientWidth, minMainWidth, maxPreviewRatio)
    const width =
      max >= minWidth
        ? Math.round(Math.min(max, Math.max(minWidth, requested)))
        : Math.round(Math.max(0, Math.min(max, requested)))
    parent.style.setProperty(widthVariable, `${width}px`)
    setBounds({ width, max })
  }

  const handleMin = bounds.max >= minWidth ? minWidth : 0
  const handleMax = Math.max(handleMin, bounds.max)

  return (
    <ResizableSeparator
      ref={handleRef}
      className={cn('ui-column-divider', className)}
      label={label}
      value={bounds.width}
      min={handleMin}
      max={handleMax}
      onResize={(delta) => {
        const parent = root()
        const fallback = parent ? resolveDefault(parent.clientWidth) : defaultWidth
        resize((preview()?.offsetWidth ?? fallback) + (invert ? -delta : delta))
      }}
      onReset={() => {
        const parent = root()
        resize(parent ? resolveDefault(parent.clientWidth) : defaultWidth)
        measure()
      }}
    />
  )
}
