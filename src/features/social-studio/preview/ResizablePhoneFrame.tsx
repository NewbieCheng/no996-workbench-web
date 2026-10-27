import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import {
  normalizePhoneFrameSize,
  PHONE_HEIGHT_MAX,
  PHONE_HEIGHT_MIN,
  PHONE_WIDTH_MAX,
  PHONE_WIDTH_MIN,
  type PhoneFrameSize,
} from './preview-phone-size'
import i18n from '@/i18n'

type ResizablePhoneFrameProps = {
  size: PhoneFrameSize
  onSizeChange: (size: PhoneFrameSize) => void
  children: ReactNode
  enabled?: boolean
}

export function ResizablePhoneFrame({ size, onSizeChange, children, enabled = true }: ResizablePhoneFrameProps) {
  const [dragging, setDragging] = useState<'width' | 'height' | null>(null)
  const startRef = useRef<{ x: number; y: number; size: PhoneFrameSize } | null>(null)

  const style = {
    ['--social-phone-width' as string]: `${size.width}px`,
    ['--social-phone-height' as string]: `${size.height}px`,
  } as CSSProperties

  function onWidthPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = { x: event.clientX, y: event.clientY, size }
    setDragging('width')
  }

  function onHeightPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!enabled) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    startRef.current = { x: event.clientX, y: event.clientY, size }
    setDragging('height')
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = startRef.current
    if (!start || !dragging) return
    if (dragging === 'width') {
      const delta = event.clientX - start.x
      const next = normalizePhoneFrameSize({ width: start.size.width + delta * 2, height: start.size.height })
      onSizeChange(next)
    } else {
      const delta = event.clientY - start.y
      const next = normalizePhoneFrameSize({ width: start.size.width, height: start.size.height + delta })
      onSizeChange(next)
    }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    startRef.current = null
    setDragging(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className={`studio-resizable-phone${dragging ? ' is-dragging' : ''}`}
      style={style}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="studio-resizable-phone__viewport">{children}</div>
      {enabled ? (
        <>
          <div
            className="studio-resizable-phone__handle studio-resizable-phone__handle--east"
            role="separator"
            aria-orientation="vertical"
            aria-label={i18n.t("uiCopy:调整预览宽度", { keySeparator: false })}
            aria-valuemin={PHONE_WIDTH_MIN}
            aria-valuemax={PHONE_WIDTH_MAX}
            aria-valuenow={size.width}
            onPointerDown={onWidthPointerDown}
          />
          <div
            className="studio-resizable-phone__handle studio-resizable-phone__handle--south"
            role="separator"
            aria-orientation="horizontal"
            aria-label={i18n.t("uiCopy:调整预览高度", { keySeparator: false })}
            aria-valuemin={PHONE_HEIGHT_MIN}
            aria-valuemax={PHONE_HEIGHT_MAX}
            aria-valuenow={size.height}
            onPointerDown={onHeightPointerDown}
          />
        </>
      ) : null}
    </div>
  )
}
