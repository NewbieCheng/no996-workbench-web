/**
 * 将下拉菜单挂到 document.body，按锚点定位并避让视口边缘（避免时间轴 overflow 裁切）
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const VIEWPORT_PAD = 8
const ANCHOR_GAP = 4

export type FloatingMenuAlign = 'start' | 'end'

export type FloatingMenuPortalProps = {
  open: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  align?: FloatingMenuAlign
  className?: string
  role?: string
  children: React.ReactNode
}

function positionMenu(
  anchor: DOMRect,
  menu: DOMRect,
  align: FloatingMenuAlign,
): { top: number; left: number } {
  let top = anchor.bottom + ANCHOR_GAP
  if (top + menu.height > window.innerHeight - VIEWPORT_PAD) {
    const above = anchor.top - ANCHOR_GAP - menu.height
    if (above >= VIEWPORT_PAD) top = above
    else top = Math.max(VIEWPORT_PAD, window.innerHeight - VIEWPORT_PAD - menu.height)
  }
  top = Math.max(VIEWPORT_PAD, top)

  let left = align === 'end' ? anchor.right - menu.width : anchor.left
  left = Math.min(Math.max(VIEWPORT_PAD, left), window.innerWidth - VIEWPORT_PAD - menu.width)

  return { top, left }
}

export function FloatingMenuPortal({
  open,
  onClose,
  anchorRef,
  align = 'end',
  className,
  role = 'menu',
  children,
}: FloatingMenuPortalProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    const anchorEl = anchorRef.current
    const menuEl = menuRef.current
    if (!anchorEl || !menuEl) return

    const update = () => {
      const anchor = anchorEl.getBoundingClientRect()
      const menu = menuEl.getBoundingClientRect()
      setCoords(positionMenu(anchor, menu, align))
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(menuEl)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, align, anchorRef])

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open) return null

  return createPortal(
    <div
      ref={menuRef}
      role={role}
      className={className}
      style={{
        position: 'fixed',
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        zIndex: 120,
        visibility: coords ? 'visible' : 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
