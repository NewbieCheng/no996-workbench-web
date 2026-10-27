/**
 * 轨道头部控制器（锁定/显示/静音切换）与分组标题条
 */

import { type CSSProperties } from 'react'
import type { TimelineTrack } from '../../core/project.ts'
import type { TrackGroupDef } from './track-grouping.ts'
import { TrackHeaderOptionsMenu } from './TrackHeaderOptionsMenu.tsx'

export type TimelineTrackHeaderProps = {
  track: TimelineTrack
  height?: number
  trackIndex?: number
  canReorder?: boolean
  canDelete?: boolean
  onDelete?: () => void
  onToggleMute?: () => void
  onToggleHidden?: () => void
  onToggleLock?: () => void
  isDefaultInsertTrack?: boolean
  onSetDefaultInsertTrack?: () => void
  /** 点击轨头名称区：选中该轨全部片段（整轨操作） */
  onSelectTrack?: (trackId: string) => void
  trackSelected?: boolean
  reorderMotionStyle?: CSSProperties
  onReorderDragStart?: (clientY: number, pointerId: number) => void
}

export function TimelineTrackHeader({
  track,
  height = 48,
  trackIndex,
  canReorder = false,
  canDelete = false,
  onDelete,
  onToggleMute,
  onToggleHidden,
  onToggleLock,
  isDefaultInsertTrack = false,
  onSetDefaultInsertTrack,
  onSelectTrack,
  trackSelected = false,
  reorderMotionStyle,
  onReorderDragStart,
}: TimelineTrackHeaderProps) {
  const isCompact = height <= 32
  const iconSize = isCompact ? 12 : 14
  const canDragReorder = canReorder && trackIndex !== undefined && Boolean(onReorderDragStart)

  const trackIcon = (type: TimelineTrack['type']) => {
    switch (type) {
      case 'shot':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        )
      case 'video':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m10 9 5 3-5 3V9z" />
          </svg>
        )
      case 'audio':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v20" />
            <path d="M17 5v14" />
            <path d="M7 8v8" />
            <path d="M22 10v4" />
            <path d="M2 10v4" />
          </svg>
        )
      case 'text':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        )
      case 'overlay':
        return (
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div
      data-track-header-index={trackIndex}
      style={{
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isCompact ? '0 4px 0 8px' : '0 6px 0 8px',
        background: trackSelected
          ? 'color-mix(in oklab, var(--primary) 12%, var(--card))'
          : 'var(--card)',
        borderBottom: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        color: 'var(--foreground)',
        fontSize: isCompact ? 11 : 12,
        userSelect: 'none',
        flexShrink: 0,
        boxSizing: 'border-box',
        transition: 'height 0.15s ease, background 0.12s ease',
        ...reorderMotionStyle,
      }}
      data-track-selected={trackSelected ? 'true' : undefined}
    >
      <div
        role={onSelectTrack ? 'button' : undefined}
        tabIndex={onSelectTrack ? 0 : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: isCompact ? 4 : 6,
          color: 'var(--muted-foreground)',
          cursor: canDragReorder ? 'grab' : onSelectTrack ? 'pointer' : 'default',
          minWidth: 0,
          flex: 1,
          touchAction: canDragReorder ? 'none' : undefined,
        }}
        title={
          canDragReorder
            ? `${track.name} · 点击选中整轨，拖动调整顺序`
            : onSelectTrack
              ? `${track.name} · 点击选中整轨片段`
              : track.name
        }
        aria-label={
          canDragReorder
            ? `${track.name}，点击选中整轨，拖动调整顺序`
            : onSelectTrack
              ? `${track.name}，点击选中整轨片段`
              : track.name
        }
        onClick={(e) => {
          if (!onSelectTrack) return
          e.stopPropagation()
          onSelectTrack(track.id)
        }}
        onKeyDown={(e) => {
          if (!onSelectTrack) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelectTrack(track.id)
          }
        }}
        onPointerDown={
          canDragReorder
            ? (e) => {
                if (e.button !== 0) return
                e.stopPropagation()
                e.currentTarget.setPointerCapture(e.pointerId)
                onReorderDragStart?.(e.clientY, e.pointerId)
              }
            : undefined
        }
      >
        <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {trackIcon(track.type)}
        </span>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: isCompact ? 10.5 : 11,
            fontWeight: 500,
            color: 'var(--foreground)',
            lineHeight: 1,
          }}
        >
          {track.name}
        </span>
      </div>

      <TrackHeaderOptionsMenu
        track={track}
        isCompact={isCompact}
        canDelete={canDelete}
        onDelete={onDelete}
        onToggleMute={onToggleMute}
        onToggleHidden={onToggleHidden}
        onToggleLock={onToggleLock}
        isDefaultInsertTrack={isDefaultInsertTrack}
        onSetDefaultInsertTrack={onSetDefaultInsertTrack}
      />
    </div>
  )
}

/** 分组标题分隔条组件（支持折叠/展开与数量展示） */
export type TimelineGroupHeaderProps = {
  group: TrackGroupDef
  trackCount: number
  isCollapsed: boolean
  height?: number
  onToggleCollapse: () => void
}

export function TimelineGroupHeader({
  group,
  trackCount,
  isCollapsed,
  height = 24,
  onToggleCollapse,
}: TimelineGroupHeaderProps) {
  const groupIcon = () => {
    switch (group.icon) {
      case 'visuals':
        return (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="2" y1="7" x2="7" y2="7" />
            <line x1="2" y1="17" x2="7" y2="17" />
            <line x1="17" y1="17" x2="22" y2="17" />
            <line x1="17" y1="7" x2="22" y2="7" />
          </svg>
        )
      case 'graphics':
        return (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20h16" />
            <path d="m6 16 6-12 6 12" />
            <path d="M8 12h8" />
          </svg>
        )
      case 'audio':
        return (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div
      onClick={onToggleCollapse}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggleCollapse()
        }
      }}
      title={`${group.title} (${trackCount} 轨) - 点击${isCollapsed ? '展开' : '折叠'}`}
      style={{
        width: '100%',
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px 0 6px',
        background: 'var(--muted)',
        opacity: 0.95,
        borderBottom: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        color: 'var(--foreground)',
        fontSize: 10.5,
        fontWeight: 600,
        userSelect: 'none',
        flexShrink: 0,
        cursor: 'pointer',
        boxSizing: 'border-box',
        transition: 'background-color 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {/* 折叠箭头指示 */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 12,
            height: 12,
            color: 'var(--muted-foreground)',
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>

        {/* 分组图标 */}
        <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center' }}>
          {groupIcon()}
        </span>

        {/* 分组名称 */}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {group.title}
        </span>
      </div>

      {/* 轨道数徽标 */}
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 4px',
          minWidth: 14,
          height: 14,
          borderRadius: 8,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          color: 'var(--muted-foreground)',
          fontSize: 9.5,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {trackCount}
      </span>
    </div>
  )
}
