/**
 * 画幅切换：监视器角标或时间轴顶栏共用同一套预设与菜单。
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Ratio } from 'lucide-react'
import type { CanvasRatio } from '../../core/project.ts'

export const CANVAS_RATIO_PRESETS: CanvasRatio[] = ['9:16', '16:9', '1:1', '3:4', '4:3']

type ToolbarMenuAnchor = {
  top: number
  left: number
  minWidth: number
}

export type CanvasRatioControlProps = {
  value: CanvasRatio
  onChange: (ratio: CanvasRatio) => void
  /** stage：叠在监视器上；toolbar：时间轴顶栏 */
  placement?: 'stage' | 'toolbar'
  className?: string
}

export function CanvasRatioControl({
  value,
  onChange,
  placement = 'stage',
  className,
}: CanvasRatioControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [toolbarMenuAnchor, setToolbarMenuAnchor] = useState<ToolbarMenuAnchor | null>(null)
  const ratioLabel = value
  const isToolbar = placement === 'toolbar'

  const updateToolbarMenuAnchor = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setToolbarMenuAnchor({
      top: rect.bottom + 6,
      left: rect.right,
      minWidth: Math.max(rect.width, 88),
    })
  }, [])

  useLayoutEffect(() => {
    if (!open || !isToolbar) {
      setToolbarMenuAnchor(null)
      return
    }
    updateToolbarMenuAnchor()
    window.addEventListener('resize', updateToolbarMenuAnchor)
    window.addEventListener('scroll', updateToolbarMenuAnchor, true)
    return () => {
      window.removeEventListener('resize', updateToolbarMenuAnchor)
      window.removeEventListener('scroll', updateToolbarMenuAnchor, true)
    }
  }, [open, isToolbar, updateToolbarMenuAnchor])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div
      ref={rootRef}
      className={[
        isToolbar ? 've-timeline-ratio' : 've-player-ratio-anchor',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        ref={buttonRef}
        type="button"
        className={
          isToolbar
            ? 've-timeline-ratio__btn'
            : 've-player-ratio-badge ve-player-ratio-badge--btn'
        }
        aria-label={`切换画幅，当前为 ${ratioLabel}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
      >
        {isToolbar ? <Ratio size={12} strokeWidth={2} aria-hidden /> : null}
        {isToolbar ? <span className="ve-timeline-ratio__suffix">画幅</span> : (
          <span className="ve-player-ratio-badge__label">画幅</span>
        )}
        <span className={isToolbar ? 've-timeline-ratio__value' : undefined}>{ratioLabel}</span>
        {isToolbar ? (
          <ChevronDown size={12} strokeWidth={2} className="ve-player-ratio-badge__chevron" aria-hidden />
        ) : (
          <svg aria-hidden="true" viewBox="0 0 12 12" className="ve-player-ratio-badge__chevron">
            <path d="m3 4.5 3 3 3-3" />
          </svg>
        )}
      </button>
      {open && !isToolbar ? (
        <div
          className="ve-player-ratio-menu"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {CANVAS_RATIO_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="menuitem"
              className="ve-player-ratio-menu__item"
              data-active={value === preset}
              onClick={() => {
                setOpen(false)
                if (value !== preset) onChange(preset)
              }}
            >
              {preset}
            </button>
          ))}
        </div>
      ) : null}
      {open && isToolbar && toolbarMenuAnchor
        ? createPortal(
            <div
              ref={menuRef}
              className="ve-timeline-ratio__menu ve-timeline-ratio__menu--portal"
              role="menu"
              style={{
                position: 'fixed',
                top: toolbarMenuAnchor.top,
                left: toolbarMenuAnchor.left,
                transform: 'translateX(-100%)',
                minWidth: toolbarMenuAnchor.minWidth,
                zIndex: 120,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {CANVAS_RATIO_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="menuitem"
                  className="ve-timeline-ratio__item"
                  data-active={value === preset}
                  onClick={() => {
                    setOpen(false)
                    if (value !== preset) onChange(preset)
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
