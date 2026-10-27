/**
 * 时间轴控制工具栏（分割、删除、波纹、磁吸、撤销重做、缩放、时间码、可选播放区）
 */

import { type ReactNode, useMemo } from 'react'
import type { TimeUs } from '../../core/time.ts'
import { formatTimeCode } from '../../core/time.ts'
import {
  IconTimelineDelete,
  IconTimelineFlip,
  IconTimelineLoop,
  IconTimelinePanelToggle,
  IconTimelinePause,
  IconTimelinePlay,
  IconTimelineRedo,
  IconTimelineRipple,
  IconTimelineSeekBack,
  IconTimelineSeekForward,
  IconTimelineSnap,
  IconTimelineSplit,
  IconTimelineUndo,
  IconTimelineZoom,
} from './timeline-toolbar-icons.tsx'
import { timelineRangeFillStyle } from './range-fill-style.ts'
import './timeline-toolbar.css'

const TIMELINE_ZOOM_MIN = 0.2
const TIMELINE_ZOOM_MAX = 5

export type TimelinePlaybackControls = {
  isPlaying: boolean
  canPlay: boolean
  loop: boolean
  onTogglePlay: () => void
  onToggleLoop?: () => void
  onSeek: (timeUs: TimeUs) => void
}

export type TimelineToolbarProps = {
  playheadUs: TimeUs
  durationUs: TimeUs
  zoom: number
  rippleEnabled: boolean
  snapEnabled: boolean
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  /** 选中片段是否可镜像（含 transform） */
  canFlip?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onSplit: () => void
  onDelete: () => void
  onFlip?: () => void
  onToggleRipple: () => void
  onToggleSnap: () => void
  onUndo: () => void
  onRedo: () => void
  onZoomChange: (zoom: number) => void
  /** 播放控制并入顶栏中央（视频工厂） */
  playback?: TimelinePlaybackControls
  /** 隐藏撤销/重做/波纹/磁吸，只留剪辑与缩放 */
  simplified?: boolean
  /** 右侧扩展槽（如节拍检测） */
  extras?: ReactNode
  /** @deprecated 使用 toolbarExtras */
  toolbarExtras?: ReactNode
  /** 收起时间轴时左侧状态文案（如轨道数） */
  statusHint?: string
}

function IconBtn({
  active,
  disabled,
  title,
  ariaLabel,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  title: string
  ariaLabel: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="ve-timeline-btn"
      data-active={active ? 'true' : undefined}
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

export function TimelineToolbar({
  playheadUs,
  durationUs,
  zoom,
  rippleEnabled,
  snapEnabled,
  canUndo,
  canRedo,
  hasSelection,
  canFlip = false,
  isCollapsed = false,
  onToggleCollapse,
  onSplit,
  onDelete,
  onFlip,
  onToggleRipple,
  onToggleSnap,
  onUndo,
  onRedo,
  onZoomChange,
  playback,
  simplified = false,
  extras,
  toolbarExtras,
  statusHint,
}: TimelineToolbarProps) {
  const mergedExtras = toolbarExtras ?? extras
  const timecode = (
    <div className="ve-timeline-timecode" aria-label="播放时间">
      <span className="ve-timeline-timecode__now">{formatTimeCode(playheadUs)}</span>
      <span className="ve-timeline-timecode__sep" aria-hidden="true">/</span>
      <span className="ve-timeline-timecode__dur">{formatTimeCode(durationUs)}</span>
    </div>
  )

  const zoomRangeStyle = useMemo(
    () => timelineRangeFillStyle(zoom, TIMELINE_ZOOM_MIN, TIMELINE_ZOOM_MAX),
    [zoom],
  )

  return (
    <div className={playback ? 've-timeline-toolbar ve-timeline-toolbar--merged' : 've-timeline-toolbar'}>
      <div className="ve-timeline-toolbar__left">
        {statusHint ? (
          <span className="ve-timeline-status-hint" title="点击右侧按钮展开多轨时间轴">
            {statusHint}
          </span>
        ) : null}
        {!simplified && (
          <>
            <IconBtn title="撤销 (Ctrl+Z)" ariaLabel="撤销" disabled={!canUndo} onClick={onUndo}>
              <IconTimelineUndo />
            </IconBtn>
            <IconBtn title="重做 (Ctrl+Shift+Z)" ariaLabel="重做" disabled={!canRedo} onClick={onRedo}>
              <IconTimelineRedo />
            </IconBtn>
            <span className="ve-timeline-toolbar__divider" aria-hidden />
          </>
        )}

        {!isCollapsed ? (
          <>
            <IconBtn title="按播放头分割 (S)" ariaLabel="分割" disabled={!hasSelection} onClick={onSplit}>
              <IconTimelineSplit />
            </IconBtn>

            <IconBtn title="删除所选片段" ariaLabel="删除" disabled={!hasSelection} onClick={onDelete}>
              <IconTimelineDelete />
            </IconBtn>

            <IconBtn
              title="水平镜像所选片段"
              ariaLabel="镜像"
              disabled={!canFlip || !onFlip}
              onClick={() => onFlip?.()}
            >
              <IconTimelineFlip />
            </IconBtn>
          </>
        ) : null}

        {simplified && !isCollapsed ? (
          <span
            className="ve-timeline-status-hint"
            title="拖动片段左右边缘可改时长；拖动中间可换位；竖向拖到兼容轨道或下方空白可建轨"
            style={{ marginLeft: 4, maxWidth: 320 }}
          >
            拖边缘改时长 · 拖中间换位 · 竖向换轨
          </span>
        ) : null}

        {!simplified && (
          <>
            <IconBtn
              title={rippleEnabled ? '波纹编辑：开' : '波纹编辑：关'}
              ariaLabel="波纹编辑"
              active={rippleEnabled}
              onClick={onToggleRipple}
            >
              <IconTimelineRipple />
            </IconBtn>
            <IconBtn
              title={snapEnabled ? '磁吸对齐：开' : '磁吸对齐：关'}
              ariaLabel="磁吸对齐"
              active={snapEnabled}
              onClick={onToggleSnap}
            >
              <IconTimelineSnap />
            </IconBtn>
          </>
        )}
      </div>

      {playback ? (
        <div className="ve-timeline-toolbar__center">
          <button
            type="button"
            className="ve-timeline-btn ve-timeline-play"
            disabled={!playback.canPlay}
            onClick={playback.onTogglePlay}
            title={!playback.canPlay ? '暂无内容' : playback.isPlaying ? '暂停 (空格)' : '播放 (空格)'}
            aria-label={playback.isPlaying ? '暂停' : '播放'}
          >
            {playback.isPlaying ? <IconTimelinePause size={12} /> : <IconTimelinePlay size={12} />}
          </button>
          <IconBtn
            title="后退 1 秒"
            ariaLabel="后退 1 秒"
            onClick={() => playback.onSeek(Math.max(0, playheadUs - 1_000_000))}
          >
            <IconTimelineSeekBack size={12} />
          </IconBtn>
          <IconBtn
            title="前进 1 秒"
            ariaLabel="前进 1 秒"
            onClick={() => playback.onSeek(Math.min(durationUs, playheadUs + 1_000_000))}
          >
            <IconTimelineSeekForward size={12} />
          </IconBtn>
          {playback.onToggleLoop ? (
            <button
              type="button"
              className="ve-timeline-loop"
              data-active={playback.loop ? 'true' : undefined}
              title="循环播放"
              aria-label={playback.loop ? '关闭循环播放' : '开启循环播放'}
              aria-pressed={playback.loop}
              onClick={() => playback.onToggleLoop?.()}
            >
              <IconTimelineLoop size={12} />
              <span>循环</span>
            </button>
          ) : null}
          {timecode}
        </div>
      ) : null}

      <div className="ve-timeline-toolbar__right">
        {!playback ? timecode : null}

        {mergedExtras ? <div className="ve-timeline-toolbar__extras">{mergedExtras}</div> : null}

        <div className="ve-timeline-zoom" title={`缩放 ${zoom.toFixed(1)}×`}>
          <IconTimelineZoom size={12} aria-hidden />
          <input
            type="range"
            className="ve-timeline-range"
            min={TIMELINE_ZOOM_MIN}
            max={TIMELINE_ZOOM_MAX}
            step={0.1}
            value={zoom}
            style={zoomRangeStyle}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
            aria-label="时间轴缩放"
            aria-valuemin={TIMELINE_ZOOM_MIN}
            aria-valuemax={TIMELINE_ZOOM_MAX}
            aria-valuenow={zoom}
          />
        </div>

        {onToggleCollapse ? (
          <IconBtn
            title={isCollapsed ? '展开时间轴' : '收起时间轴'}
            ariaLabel={isCollapsed ? '展开时间轴' : '收起时间轴'}
            onClick={onToggleCollapse}
          >
            <IconTimelinePanelToggle size={12} expanded={!isCollapsed} />
          </IconBtn>
        ) : null}
      </div>
    </div>
  )
}
