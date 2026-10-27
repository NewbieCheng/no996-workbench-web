import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { readStudioPanelPrefs, writeStudioPanelPrefs } from './use-studio-layout.ts'

export const VF_TIMELINE_HEIGHT_MIN = 200
export const VF_TIMELINE_HEIGHT_DEFAULT = 280
export const VF_TIMELINE_HEIGHT_MAX_RATIO = 0.5

export function clampTimelineHeight(px: number, bodyHeight: number): number {
  const min = VF_TIMELINE_HEIGHT_MIN
  const max = Math.max(min, Math.floor(bodyHeight * VF_TIMELINE_HEIGHT_MAX_RATIO))
  return Math.min(max, Math.max(min, Math.round(px)))
}

export function readInitialTimelineHeight(): number {
  const prefs = readStudioPanelPrefs()
  const raw = prefs.timelineHeightPx
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= VF_TIMELINE_HEIGHT_MIN) {
    return raw
  }
  return VF_TIMELINE_HEIGHT_DEFAULT
}

export function useTimelineHeight(
  bodyRef: RefObject<HTMLElement | null>,
  collapsed: boolean,
  onPersist: (heightPx: number) => void,
) {
  const [heightPx, setHeightPx] = useState(readInitialTimelineHeight)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef<{ startY: number; startH: number } | null>(null)

  const measureBody = useCallback(() => bodyRef.current?.clientHeight ?? 0, [bodyRef])

  useEffect(() => {
    if (collapsed) return
    const bodyH = measureBody()
    if (bodyH <= 0) return
    setHeightPx((prev) => clampTimelineHeight(prev, bodyH))
  }, [collapsed, measureBody])

  useEffect(() => {
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (collapsed) return
      const bodyH = el.clientHeight
      if (bodyH <= 0) return
      setHeightPx((prev) => clampTimelineHeight(prev, bodyH))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [bodyRef, collapsed])

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (collapsed) return
      event.preventDefault()
      setIsResizing(true)
      dragRef.current = { startY: event.clientY, startH: heightPx }
      event.currentTarget.setPointerCapture(event.pointerId)

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const bodyH = measureBody()
        if (bodyH <= 0) return
        const delta = dragRef.current.startY - ev.clientY
        const next = clampTimelineHeight(dragRef.current.startH + delta, bodyH)
        setHeightPx(next)
      }

      const onUp = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const bodyH = measureBody()
        const delta = dragRef.current.startY - ev.clientY
        const next = clampTimelineHeight(dragRef.current.startH + delta, bodyH)
        dragRef.current = null
        setIsResizing(false)
        setHeightPx(next)
        onPersist(next)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [collapsed, heightPx, measureBody, onPersist],
  )

  const maxHeightPx = Math.max(
    VF_TIMELINE_HEIGHT_MIN,
    Math.floor(measureBody() * VF_TIMELINE_HEIGHT_MAX_RATIO),
  )

  return { heightPx, onResizePointerDown, maxHeightPx, isResizing }
}

export function persistTimelineHeight(heightPx: number) {
  const prefs = readStudioPanelPrefs()
  writeStudioPanelPrefs({ ...prefs, timelineHeightPx: heightPx })
}
