/**
 * 单按钮轨道选项菜单（锁定 / 显示 / 静音 / 删除），避免轨头多图标挤占名称区
 */

import { useRef, useState } from 'react'
import { Eye, EyeOff, Lock, MoreHorizontal, Star } from 'lucide-react'
import type { TimelineTrack } from '../../core/project.ts'
import { FloatingMenuPortal } from '../shared/FloatingMenuPortal.tsx'
import './timeline-toolbar.css'

export type TrackHeaderOptionsMenuProps = {
  track: TimelineTrack
  isCompact?: boolean
  canDelete?: boolean
  onToggleMute?: () => void
  onToggleHidden?: () => void
  onToggleLock?: () => void
  onDelete?: () => void
  isDefaultInsertTrack?: boolean
  onSetDefaultInsertTrack?: () => void
}

function MenuToggleRow({
  label,
  shortcut,
  active,
  onClick,
  destructive,
}: {
  label: string
  shortcut?: string
  active: boolean
  onClick: () => void
  destructive?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={active}
      className={`ve-track-action-menu__item${destructive ? ' ve-track-header-menu__item--danger' : ''}`}
      onClick={onClick}
    >
      <span className="ve-track-header-menu__check" aria-hidden>
        {active ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : null}
      </span>
      <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>{label}</span>
      {shortcut ? (
        <span className="ve-track-action-menu__badge ve-track-header-menu__shortcut">{shortcut}</span>
      ) : null}
    </button>
  )
}

export function TrackHeaderOptionsMenu({
  track,
  isCompact = false,
  canDelete = false,
  onToggleMute,
  onToggleHidden,
  onToggleLock,
  onDelete,
  isDefaultInsertTrack = false,
  onSetDefaultInsertTrack,
}: TrackHeaderOptionsMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const iconSize = isCompact ? 13 : 14
  const showMute = (track.type === 'audio' || track.type === 'video') && onToggleMute
  const statusDot = track.muted

  const closeAnd = (fn?: () => void) => {
    fn?.()
    setOpen(false)
  }

  return (
    <div className="ve-track-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <button
        type="button"
        className="ve-track-header-menu__trigger"
        aria-label={isDefaultInsertTrack ? '当前为默认上轴轨道' : '设为默认上轴轨道'}
        aria-pressed={isDefaultInsertTrack}
        title={isDefaultInsertTrack ? '默认上轴轨道（库面板添加会落在此轨）' : '设为默认上轴轨道'}
        data-default={isDefaultInsertTrack ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          if (!isDefaultInsertTrack) {
            onSetDefaultInsertTrack?.()
          }
        }}
      >
        <Star
          size={iconSize}
          strokeWidth={2}
          aria-hidden
          fill={isDefaultInsertTrack ? 'currentColor' : 'none'}
          style={{ color: isDefaultInsertTrack ? 'var(--primary)' : 'var(--muted-foreground)' }}
        />
      </button>
      <button
        type="button"
        className="ve-track-header-menu__trigger"
        aria-label={track.hidden ? '显示轨道' : '隐藏轨道'}
        aria-pressed={track.hidden}
        title={track.hidden ? '显示此轨道 (H)' : '隐藏此轨道 (H)'}
        data-pressed={track.hidden ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          onToggleHidden?.()
        }}
      >
        {track.hidden ? (
          <EyeOff size={iconSize} strokeWidth={2} aria-hidden />
        ) : (
          <Eye size={iconSize} strokeWidth={2} aria-hidden />
        )}
      </button>
      <button
        ref={triggerRef}
        type="button"
        className="ve-track-header-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="轨道选项"
        data-active={track.locked || statusDot ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {track.locked ? (
          <Lock size={iconSize} strokeWidth={2} aria-hidden />
        ) : (
          <MoreHorizontal size={iconSize} strokeWidth={2} aria-hidden />
        )}
        {statusDot && !track.locked ? <span className="ve-track-header-menu__dot" aria-hidden /> : null}
      </button>

      <FloatingMenuPortal
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={triggerRef}
        align="end"
        className="ve-floating-menu-surface ve-track-header-menu__panel"
      >
        <MenuToggleRow
          label={isDefaultInsertTrack ? '已是默认上轴轨道' : '设为默认上轴轨道'}
          active={isDefaultInsertTrack}
          onClick={() => closeAnd(onSetDefaultInsertTrack)}
        />
        <MenuToggleRow
          label={track.locked ? '解锁轨道' : '锁定轨道'}
          shortcut="L"
          active={track.locked}
          onClick={() => closeAnd(onToggleLock)}
        />
        {showMute ? (
          <MenuToggleRow
            label={track.muted ? '取消静音' : '静音'}
            shortcut="M"
            active={Boolean(track.muted)}
            onClick={() => closeAnd(onToggleMute)}
          />
        ) : null}
        {canDelete && onDelete ? (
          <>
            <div className="ve-track-header-menu__divider" />
            <button
              type="button"
              role="menuitem"
              className="ve-track-action-menu__item ve-track-header-menu__item--danger"
              onClick={() => closeAnd(onDelete)}
            >
              <span className="ve-track-header-menu__check" aria-hidden />
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>移除此空轨道</span>
            </button>
          </>
        ) : null}
      </FloatingMenuPortal>
    </div>
  )
}
