import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/** 剪辑台弹层挂到 body，避免 ModuleLayout / 动画层把 fixed 遮罩裁在内容区内。 */
export function VfOverlayPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
