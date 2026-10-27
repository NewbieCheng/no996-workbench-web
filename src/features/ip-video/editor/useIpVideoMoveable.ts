import { useEffect, useRef, useState, type RefObject } from 'react'
import type Moveable from 'react-moveable'
import { snapPixelBox, type MoveableGesture, type PixelBox } from './moveable-layout'

export type UseIpVideoMoveableOptions = {
  stageRef: RefObject<HTMLDivElement | null>
  outputWidth: number
  outputHeight: number
  disabled?: boolean
  snapping?: boolean
  safeInset?: number
  minWidth?: number
  minHeight?: number
}

export function useIpVideoMoveable({
  stageRef,
  outputWidth,
  outputHeight,
  disabled = false,
  snapping = true,
  safeInset = 72,
  minWidth = 80,
  minHeight = 60
}: UseIpVideoMoveableOptions) {
  const moveableRef = useRef<Moveable>(null)
  const gestureRef = useRef<MoveableGesture | null>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const node = stageRef.current
    if (!node) return
    const update = () => setScale(node.getBoundingClientRect().width / outputWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [outputWidth, stageRef])

  const beginGesture = (kind: MoveableGesture['kind'], startBox: PixelBox) => {
    if (disabled || !stageRef.current) return null
    const next: MoveableGesture = {
      startBox: { ...startBox },
      scale: stageRef.current.getBoundingClientRect().width / outputWidth,
      kind
    }
    gestureRef.current = next
    return next
  }

  const clearGesture = () => {
    gestureRef.current = null
  }

  const applyBox = (box: PixelBox, snap: boolean) => {
    const active = gestureRef.current
    if (!active || disabled) return box
    const threshold = 6 / active.scale
    return snap && snapping ? snapPixelBox(box, outputWidth, outputHeight, safeInset, threshold) : box
  }

  const verticalGuidelines = [safeInset * scale, (outputWidth / 2) * scale, (outputWidth - safeInset) * scale]
  const horizontalGuidelines = [safeInset * scale, (outputHeight / 2) * scale, (outputHeight - safeInset) * scale]

  const moveableHandlers = {
    onDragStart: (event: { stopDrag: () => void; set: (value: [number, number]) => void }, startBox: PixelBox) => {
      if (!beginGesture('drag', startBox)) {
        event.stopDrag()
        return
      }
      event.set([0, 0])
    },
    onDrag: (
      // react-moveable 的 OnDrag.beforeTranslate 声明为 number[]，这里按运行时保证取前两项。
      event: { beforeTranslate: number[] },
      onPreview: (box: PixelBox) => void
    ) => {
      const active = gestureRef.current
      if (!active || active.kind !== 'drag') return
      const [dx = 0, dy = 0] = event.beforeTranslate
      const box = {
        ...active.startBox,
        x: active.startBox.x + dx / active.scale,
        y: active.startBox.y + dy / active.scale
      }
      onPreview(applyBox(box, true))
    },
    onResizeStart: (
      event: {
        stopDrag: () => void
        set: (value: [number, number]) => void
        setMin: (value: [number, number]) => void
        setMax: (value: [number, number]) => void
        dragStart?: { set: (value: [number, number]) => void }
      },
      startBox: PixelBox
    ) => {
      const active = beginGesture('resize', startBox)
      if (!active) {
        event.stopDrag()
        return
      }
      event.set([active.startBox.width * active.scale, active.startBox.height * active.scale])
      event.setMin([minWidth * active.scale, minHeight * active.scale])
      event.setMax([outputWidth * active.scale, outputHeight * active.scale])
      if (event.dragStart) event.dragStart.set([0, 0])
    },
    onResize: (
      event: {
        width: number
        height: number
        // 同上：react-moveable 声明为 number[]，取前两项。
        drag: { beforeTranslate: number[] }
      },
      onPreview: (box: PixelBox) => void
    ) => {
      const active = gestureRef.current
      if (!active || active.kind !== 'resize') return
      const [dx = 0, dy = 0] = event.drag.beforeTranslate
      onPreview({
        x: active.startBox.x + dx / active.scale,
        y: active.startBox.y + dy / active.scale,
        width: event.width / active.scale,
        height: event.height / active.scale
      })
    }
  }

  return {
    moveableRef,
    scale,
    gestureRef,
    beginGesture,
    clearGesture,
    applyBox,
    verticalGuidelines,
    horizontalGuidelines,
    moveableHandlers,
    snapping
  }
}
