import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  VF_CENTER_GUTTER,
  VF_RAIL_COLLAPSED,
  VF_RAIL_LEFT_EXPANDED,
  VF_RAIL_RIGHT_EXPANDED,
  VF_STAGE_MIN_WIDTH,
  readStudioPanelPrefs,
  writeStudioPanelPrefs,
} from './use-studio-layout.ts'
import { readAppZoomFactor } from '../../../app/ZoomProvider.tsx'

export const VF_RAIL_LEFT_MIN = 180
export const VF_RAIL_LEFT_MAX = 560
export const VF_RAIL_RIGHT_MIN = 200
export const VF_RAIL_RIGHT_MAX = 640

export function readInitialRailWidths(): { left: number; right: number } {
  const prefs = readStudioPanelPrefs()
  const left = prefs.railLeftExpandedPx ?? VF_RAIL_LEFT_EXPANDED
  const right = prefs.railRightExpandedPx ?? VF_RAIL_RIGHT_EXPANDED
  return {
    left: Math.min(VF_RAIL_LEFT_MAX, Math.max(VF_RAIL_LEFT_MIN, Math.round(left))),
    right: Math.min(VF_RAIL_RIGHT_MAX, Math.max(VF_RAIL_RIGHT_MIN, Math.round(right))),
  }
}

function readZoomFactor(): number {
  return readAppZoomFactor()
}

export function clampRailLeft(
  px: number,
  rightExpanded: number,
  mainWidth: number,
  leftCollapsed: boolean,
  rightCollapsed: boolean,
): number {
  if (leftCollapsed) return VF_RAIL_COLLAPSED
  const right = rightCollapsed ? VF_RAIL_COLLAPSED : rightExpanded
  const maxByStage = mainWidth - right - VF_STAGE_MIN_WIDTH - VF_CENTER_GUTTER * 2
  const max = Math.min(VF_RAIL_LEFT_MAX, Math.max(VF_RAIL_LEFT_MIN, maxByStage))
  return Math.min(max, Math.max(VF_RAIL_LEFT_MIN, Math.round(px)))
}

export function clampRailRight(
  px: number,
  leftExpanded: number,
  mainWidth: number,
  leftCollapsed: boolean,
  rightCollapsed: boolean,
): number {
  if (rightCollapsed) return VF_RAIL_COLLAPSED
  const left = leftCollapsed ? VF_RAIL_COLLAPSED : leftExpanded
  const maxByStage = mainWidth - left - VF_STAGE_MIN_WIDTH - VF_CENTER_GUTTER * 2
  const max = Math.min(VF_RAIL_RIGHT_MAX, Math.max(VF_RAIL_RIGHT_MIN, maxByStage))
  return Math.min(max, Math.max(VF_RAIL_RIGHT_MIN, Math.round(px)))
}

export function persistRailWidths(left: number, right: number) {
  const prefs = readStudioPanelPrefs()
  writeStudioPanelPrefs({
    ...prefs,
    railLeftExpandedPx: left,
    railRightExpandedPx: right,
  })
}

export function useStudioRailWidths(
  mainRef: RefObject<HTMLElement | null>,
  leftCollapsed: boolean,
  rightCollapsed: boolean,
) {
  const [widths, setWidths] = useState(readInitialRailWidths)
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null)
  const dragRef = useRef<{ startX: number; startLeft: number; startRight: number } | null>(null)

  const measureMain = useCallback(() => mainRef.current?.clientWidth ?? 0, [mainRef])

  const onLeftResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (leftCollapsed) return
      event.preventDefault()
      setResizing('left')
      dragRef.current = {
        startX: event.clientX,
        startLeft: widths.left,
        startRight: widths.right,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      const zoom = readZoomFactor()
      const target = event.currentTarget
      const pointerId = event.pointerId

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const mainW = measureMain()
        const delta = (ev.clientX - dragRef.current.startX) / zoom
        const nextLeft = clampRailLeft(
          dragRef.current.startLeft + delta,
          dragRef.current.startRight,
          mainW,
          false,
          rightCollapsed,
        )
        setWidths((prev) => ({ ...prev, left: nextLeft }))
      }

      const finish = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const mainW = measureMain()
        const delta = (ev.clientX - dragRef.current.startX) / zoom
        const nextLeft = clampRailLeft(
          dragRef.current.startLeft + delta,
          dragRef.current.startRight,
          mainW,
          false,
          rightCollapsed,
        )
        dragRef.current = null
        setResizing(null)
        setWidths((prev) => {
          const next = { ...prev, left: nextLeft }
          persistRailWidths(next.left, next.right)
          return next
        })
        try {
          target.releasePointerCapture(pointerId)
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      const onUp = (ev: PointerEvent) => finish(ev)

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [leftCollapsed, measureMain, rightCollapsed, widths.left, widths.right],
  )

  const onRightResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (rightCollapsed) return
      event.preventDefault()
      setResizing('right')
      dragRef.current = {
        startX: event.clientX,
        startLeft: widths.left,
        startRight: widths.right,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      const zoom = readZoomFactor()
      const target = event.currentTarget
      const pointerId = event.pointerId

      const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const mainW = measureMain()
        const delta = (ev.clientX - dragRef.current.startX) / zoom
        const nextRight = clampRailRight(
          dragRef.current.startRight - delta,
          dragRef.current.startLeft,
          mainW,
          leftCollapsed,
          false,
        )
        setWidths((prev) => ({ ...prev, right: nextRight }))
      }

      const finish = (ev: PointerEvent) => {
        if (!dragRef.current) return
        const mainW = measureMain()
        const delta = (ev.clientX - dragRef.current.startX) / zoom
        const nextRight = clampRailRight(
          dragRef.current.startRight - delta,
          dragRef.current.startLeft,
          mainW,
          leftCollapsed,
          false,
        )
        dragRef.current = null
        setResizing(null)
        setWidths((prev) => {
          const next = { ...prev, right: nextRight }
          persistRailWidths(next.left, next.right)
          return next
        })
        try {
          target.releasePointerCapture(pointerId)
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      const onUp = (ev: PointerEvent) => finish(ev)

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [leftCollapsed, measureMain, rightCollapsed, widths.left, widths.right],
  )

  return {
    railWidths: widths,
    railResizing: resizing,
    onLeftResizePointerDown,
    onRightResizePointerDown,
  }
}
