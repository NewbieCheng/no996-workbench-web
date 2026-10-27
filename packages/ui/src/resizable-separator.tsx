import { forwardRef, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { cn } from './utils'
import { keyboardResizeDelta, pointerResizeDelta, type SeparatorKey } from './resizable-separator-model'

type ResizableSeparatorProps = {
  label: string
  value?: number
  min?: number
  max?: number
  onResize: (delta: number) => void
  direction?: 1 | -1
  step?: number
  className?: string
  style?: CSSProperties
  onReset?: () => void
}

/** Shared pointer and keyboard behavior for a vertical, horizontally draggable separator. */
export const ResizableSeparator = forwardRef<HTMLDivElement, ResizableSeparatorProps>(function ResizableSeparator({
  label,
  value,
  min,
  max,
  onResize,
  direction = 1,
  step = 16,
  className,
  style,
  onReset,
}, ref) {
  const lastX = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    lastX.current = null
    setDragging(false)
    event.currentTarget.parentElement?.removeAttribute('data-resizing')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={ref}
      className={cn('ui-resizable-separator', dragging && 'is-dragging', className)}
      role="separator"
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
      style={{ touchAction: 'none', ...style }}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        event.currentTarget.parentElement?.setAttribute('data-resizing', '')
        lastX.current = event.clientX
        setDragging(true)
      }}
      onPointerMove={(event) => {
        if (lastX.current === null) return
        const rect = event.currentTarget.getBoundingClientRect()
        const scale = rect.width > 0 ? event.currentTarget.offsetWidth / rect.width : 1
        const delta = pointerResizeDelta(lastX.current, event.clientX, direction, scale)
        lastX.current = event.clientX
        if (delta !== 0) onResize(delta)
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={(event) => {
        lastX.current = null
        setDragging(false)
        event.currentTarget.parentElement?.removeAttribute('data-resizing')
      }}
      onKeyDown={(event) => {
        const key = event.key as SeparatorKey
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
        const delta = keyboardResizeDelta(key, direction, step, value, min, max)
        if (delta === undefined) return
        event.preventDefault()
        onResize(delta)
      }}
      onDoubleClick={onReset}
    />
  )
})
