/**
 * 轨道操作菜单（新增轨道与一键清理冗余空轨）
 * 遵循专业非编（NLE）操作规范与 /impeccable 极精工质感
 */

import React from 'react'
import type { TrackType } from '../../core/project.ts'
import { FloatingMenuPortal } from '../shared/FloatingMenuPortal.tsx'
import './timeline-toolbar.css'

export type TrackActionMenuProps = {
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
  onAddTrack: (type: TrackType, defaultName?: string) => void
  onCleanEmptyTracks: () => void
  emptyTrackCount: number
}

export function TrackActionMenu({
  isOpen,
  onClose,
  anchorRef,
  onAddTrack,
  onCleanEmptyTracks,
  emptyTrackCount,
}: TrackActionMenuProps) {
  if (!isOpen) return null

  const handleAdd = (type: TrackType, defaultName?: string) => {
    onAddTrack(type, defaultName)
    onClose()
  }

  const handleClean = () => {
    if (emptyTrackCount <= 0) return
    onCleanEmptyTracks()
    onClose()
  }

  return (
    <FloatingMenuPortal
      open={isOpen}
      onClose={onClose}
      anchorRef={anchorRef}
      align="end"
      className="ve-floating-menu-surface ve-track-action-menu ve-track-action-menu--portal"
    >
      {/* 分组 1：视效画面 */}
      <div
        style={{
          padding: '4px 6px 2px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--muted-foreground)',
          letterSpacing: '0.02em',
        }}
      >
        视效画面
      </div>

      <button
        type="button"
        role="menuitem"
        className="ve-track-action-menu__item"
        onClick={() => handleAdd('video', '视频轨')}
      >
        <span style={{ color: '#2563eb', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m10 9 5 3-5 3V9z" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>新增视频轨</span>
        <span className="ve-track-action-menu__badge">44px</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="ve-track-action-menu__item"
        onClick={() => handleAdd('overlay', '画中画轨')}
      >
        <span style={{ color: '#7c3aed', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>新增画中画轨</span>
        <span className="ve-track-action-menu__badge">36px</span>
      </button>

      {/* 分割线 */}
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />

      {/* 分组 2：图文与音频 */}
      <div
        style={{
          padding: '2px 6px',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--muted-foreground)',
          letterSpacing: '0.02em',
        }}
      >
        图文与音频
      </div>

      <button
        type="button"
        role="menuitem"
        className="ve-track-action-menu__item"
        onClick={() => handleAdd('text', '文字轨')}
      >
        <span style={{ color: '#d97706', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>新增标题文字轨</span>
        <span className="ve-track-action-menu__badge ve-track-action-menu__badge--compact">28px 紧凑</span>
      </button>

      <button
        type="button"
        role="menuitem"
        className="ve-track-action-menu__item"
        onClick={() => handleAdd('audio', '音频轨')}
      >
        <span style={{ color: '#059669', display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20" />
            <path d="M17 5v14" />
            <path d="M7 8v8" />
            <path d="M22 10v4" />
            <path d="M2 10v4" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>新增音频声轨</span>
        <span className="ve-track-action-menu__badge">34px</span>
      </button>

      {/* 分割线 */}
      <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />

      {/* 分组 3：体积压缩与清理 */}
      <button
        type="button"
        role="menuitem"
        className="ve-track-action-menu__item ve-track-action-menu__item--clean"
        disabled={emptyTrackCount <= 0}
        onClick={handleClean}
        title={emptyTrackCount > 0 ? `清理 ${emptyTrackCount} 条未承载素材的空白轨道，压缩时间轴高度` : '当前无冗余空轨道'}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </span>
        <span style={{ flex: 1, textAlign: 'left', fontWeight: 500 }}>
          {emptyTrackCount > 0 ? `清理空轨道 (${emptyTrackCount})` : '无冗余空轨道'}
        </span>
        {emptyTrackCount > 0 ? (
          <span style={{ fontSize: 9.5, opacity: 0.8, color: '#f59e0b' }}>压缩体积</span>
        ) : null}
      </button>
    </FloatingMenuPortal>
  )
}
