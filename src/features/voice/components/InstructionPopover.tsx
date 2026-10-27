import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  resolveInstructionPillLabel,
  TTS_INSTRUCTION_MAX_LEN,
  TTS_INSTRUCTION_PRESETS,
} from '../voice-constants'

type Props = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstructionPopover({ value, onChange, disabled, open, onOpenChange }: Props) {
  const popId = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const width = 300
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
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(timer)
  }, [open])

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

  const pillLabel = resolveInstructionPillLabel(value)

  const popover = open
    ? createPortal(
        <div
          ref={popRef}
          id={popId}
          className="voice-pop voice-pop--portal voice-pop--open voice-pop--instruction"
          role="dialog"
          aria-label="语气说明"
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            transform: 'translateY(-100%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="voice-pop__head">
            <span>语气（可选）</span>
            {value.trim() ? (
              <button
                type="button"
                className="voice-pop__text-action"
                onClick={() => onChange('')}
              >
                清除
              </button>
            ) : null}
          </div>
          <p className="voice-pop__lead">
            这是合成时的「指令控制」：用自然语言描述情感、语气、用途等（不是换音色，也不是声音设计）。会提交到接口的 instruction 字段；语速/音量/音调仍用下方药丸调节。
          </p>
          <div className="voice-pop__presets voice-pop__presets--wrap">
            {TTS_INSTRUCTION_PRESETS.map((p) => (
              <button
                key={p.value || '__none'}
                type="button"
                className="voice-chip"
                aria-pressed={p.value === value.trim()}
                onClick={() => onChange(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="voice-pop__field-label" htmlFor={`${popId}-input`}>自定义</label>
          <input
            ref={inputRef}
            id={`${popId}-input`}
            type="text"
            className="voice-pop__field"
            value={value}
            placeholder="例如：用开心、轻松的语气"
            aria-label="语气说明"
            maxLength={TTS_INSTRUCTION_MAX_LEN}
            onChange={(e) => onChange(e.target.value)}
          />
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
        disabled={disabled}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (!disabled) onOpenChange(!open)
        }}
      >
        语气 <b>{pillLabel}</b>
      </button>
      {popover}
    </div>
  )
}
