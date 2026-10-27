import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type NumericParamConfig = {
  key: string
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  formatDisplay: (v: number) => string
  presets?: Array<{ value: number; label: string }>
  ends?: [string, string]
}

type Props = {
  config: NumericParamConfig
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ParamPopover({ config, open, onOpenChange }: Props) {
  const popId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const width = 280
    const margin = 12
    let left = rect.left
    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin
    }
    left = Math.max(margin, left)
    setCoords({
      left,
      top: rect.top - margin,
    })
  }, [open, config.value])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onOpenChange(false)
    }
    function onScroll() {
      onOpenChange(false)
    }
    function onPointerDown(e: PointerEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (popRef.current?.contains(target) || anchorRef.current?.contains(target)) return
      onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, onOpenChange])

  const fraction = (config.value - config.min) / (config.max - config.min)
  const pct = `${Math.min(100, Math.max(0, fraction * 100))}%`

  function nudge(delta: number) {
    const next = Math.min(config.max, Math.max(config.min, config.value + delta))
    const rounded =
      config.step >= 1 ? Math.round(next) : Math.round(next / config.step) * config.step
    config.onChange(Number(rounded.toFixed(config.step < 1 ? 1 : 0)))
  }

  const popover = open
    ? createPortal(
        <div
          ref={popRef}
          id={popId}
          className="voice-pop voice-pop--portal voice-pop--open"
          role="dialog"
          aria-label={config.label}
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            transform: 'translateY(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="voice-pop__head">
            <span>{config.label}</span>
            <div className="voice-pop__step">
              <button type="button" aria-label="减小" onClick={() => nudge(-config.step)}>
                −
              </button>
              <output>{config.formatDisplay(config.value)}</output>
              <button type="button" aria-label="增大" onClick={() => nudge(config.step)}>
                +
              </button>
            </div>
          </div>
          <div className="voice-range">
            <input
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={config.value}
              aria-label={config.label}
              style={{ ['--voice-range-p' as string]: pct }}
              onChange={(e) => config.onChange(Number(e.target.value))}
            />
          </div>
          {config.ends && (
            <div className="voice-pop__ends">
              <span>{config.ends[0]}</span>
              <span>{config.ends[1]}</span>
            </div>
          )}
          {config.presets && config.presets.length > 0 && (
            <div className="voice-pop__presets">
              {config.presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className="voice-chip"
                  aria-pressed={p.value === config.value}
                  onClick={() => config.onChange(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <div className="voice-pill-wrap">
      <button
        ref={anchorRef}
        type="button"
        className="voice-pill"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          onOpenChange(!open)
        }}
      >
        {config.label} <b>{config.formatDisplay(config.value)}</b>
      </button>
      {popover}
    </div>
  )
}
