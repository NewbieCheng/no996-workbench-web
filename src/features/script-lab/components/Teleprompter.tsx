import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FastForward, Pause, Play, RotateCcw, Type, X } from 'lucide-react'
import type { ScriptConfig, ScriptSegment } from '../agent/types'
import { formatTimecode } from '../agent/finalize'
import i18n from '@/i18n'

/**
 * 页内全屏提词器（使用 Portal 挂载到根节点，真正全屏并避免被任何祖先容器定位/包含块限制）。
 *
 * 速度 1–8（每 30ms 前进对应像素，默认 2）、字号 24–64（默认 40）、
 * 支持空格播放/暂停、Esc 关闭、Home 回到开头。
 */
export type TeleprompterProps = {
  config: ScriptConfig
  segments: ScriptSegment[]
  spokenOf: (seg: ScriptSegment) => string
  onClose: () => void
}

export function Teleprompter({ config, segments, spokenOf, onClose }: TeleprompterProps) {
  const [speed, setSpeed] = useState(2)
  const [fontSize, setFontSize] = useState(40)
  const [playing, setPlaying] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const reduce = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  )

  // Esc 关闭 + 空格播放/暂停
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault()
        if (reduce.current) return
        setPlaying((v) => !v)
      }
      if (e.key === 'Home') stageRef.current?.scrollTo({ top: 0 })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    if (!playing || reduce.current) return
    const timer = window.setInterval(() => {
      const el = stageRef.current
      if (el) el.scrollTop += speed
    }, 30)
    return () => window.clearInterval(timer)
  }, [playing, speed])

  // 打开时锁定页面滚动，关闭后恢复
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const isVideo = config.mode === 'video'
  const asideLabel = isVideo ? '画面' : '互动'
  const total = segments.at(-1)?.endSec ?? 0

  const content = (
    <div
      className="sl-prompter"
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t("uiCopy:提词器", { defaultValue: "提词器", keySeparator: false })}
    >
      <div className="sl-prompter__bar">
        <div className="sl-prompter__brand">
          <span className="sl-prompter__badge">
            {isVideo ? '视频分镜' : '直播控场'}
          </span>
          <strong className="sl-prompter__title">
            {config.product}
            <span className="sl-prompter__sub">
              {i18n.t("uiCopy:· 提词器", { defaultValue: " · 全屏提词器", keySeparator: false })}
            </span>
          </strong>
        </div>

        <div className="sl-prompter__controls">
          <label className="sl-prompter__control" title="调整自动滚屏速度">
            <FastForward size={13} className="sl-prompter__icon" />
            <span className="sl-prompter__control-label">{i18n.t("uiCopy:速度", { defaultValue: "速度", keySeparator: false })}</span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <span className="sl-prompter__val">{speed}x</span>
          </label>

          <label className="sl-prompter__control" title="调整提词正文字号">
            <Type size={13} className="sl-prompter__icon" />
            <span className="sl-prompter__control-label">{i18n.t("uiCopy:字号", { defaultValue: "字号", keySeparator: false })}</span>
            <input
              type="range"
              min={24}
              max={64}
              step={2}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
            <span className="sl-prompter__val">{fontSize}px</span>
          </label>
        </div>

        <div className="sl-prompter__actions">
          <button
            type="button"
            className={`sl-btn sl-btn--sm sl-prompter__btn-play ${playing ? 'sl-prompter__btn-play--active' : ''}`}
            onClick={() => setPlaying((v) => !v)}
            disabled={reduce.current}
            title="快捷键：空格键"
          >
            {playing ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
            <span>
              {reduce.current
                ? i18n.t("uiCopy:已停用自动滚动", { defaultValue: "已停用滚动", keySeparator: false })
                : playing
                  ? i18n.t("uiCopy:暂停", { defaultValue: "暂停", keySeparator: false })
                  : i18n.t("uiCopy:开始提词", { defaultValue: "开始提词", keySeparator: false })}
            </span>
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--sm sl-prompter__btn-ghost"
            onClick={() => stageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            title="回到开头（Home）"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>{i18n.t("uiCopy:回到开头", { defaultValue: "回到开头", keySeparator: false })}</span>
          </button>

          <button
            type="button"
            className="sl-btn sl-btn--sm sl-prompter__btn-close"
            onClick={onClose}
            aria-label={i18n.t("uiCopy:关闭提词器", { defaultValue: "关闭提词器", keySeparator: false })}
            title="退出提词（Esc）"
          >
            <X size={14} aria-hidden="true" />
            <span>{i18n.t("uiCopy:关闭", { defaultValue: "关闭", keySeparator: false })}</span>
            <kbd className="sl-prompter__kbd">Esc</kbd>
          </button>
        </div>
      </div>

      <div className="sl-prompter__stage" ref={stageRef}>
        <div className="sl-prompter__text" style={{ fontSize }}>
          {segments.map((seg, idx) => (
            <div key={seg.id} className="sl-prompter__segment">
              <div className="sl-prompter__seg-header" style={{ fontSize: Math.max(14, fontSize * 0.38) }}>
                <span className="sl-prompter__seg-no">#{String(idx + 1).padStart(2, '0')}</span>
                <span>{formatTimecode(seg.startSec)}–{formatTimecode(seg.endSec)}</span>
                <span className="sl-prompter__seg-name">{seg.name}</span>
                {seg.purpose ? <span className="sl-prompter__seg-purpose">· {seg.purpose}</span> : null}
              </div>
              <div className="sl-prompter__seg-spoken">{spokenOf(seg)}</div>
              {(isVideo ? seg.visual : seg.action) ? (
                <div className="sl-prompter__seg-aside" style={{ fontSize: Math.max(12, fontSize * 0.32) }}>
                  <span className="sl-prompter__aside-tag">{asideLabel}：</span>
                  <span>{isVideo ? seg.visual : seg.action}</span>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="sl-prompter__foot">
        <div className="sl-prompter__shortcuts">
          <span><kbd className="sl-prompter__kbd">空格键</kbd> 播放/暂停</span>
          <span><kbd className="sl-prompter__kbd">Esc</kbd> 退出提词</span>
          <span><kbd className="sl-prompter__kbd">Home</kbd> 回到开头</span>
          <span>支持鼠标随时自由滑滚微调</span>
        </div>
        <div className="sl-prompter__meta-info">
          <span>共 {segments.length} 个分段 · 总长约 {formatTimecode(total)}</span>
        </div>
      </div>
    </div>
  )

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body)
  }
  return content
}

export default Teleprompter
