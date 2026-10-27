/**
 * 时间与变速面板 (大厂剪映标准版)
 *
 * 选中片段后调整：起点、时长、变速。
 * 支持 0.5x~4x 常用倍速胶囊、精细微调滑块、帧数指示与一键恢复原速。
 */

import React, { useEffect, useState } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { TrackElement } from '../../core/project.ts'
import {
  MoveElementToTrackCommand,
  MoveElementsCommand,
  TrimElementCommand,
} from '../../core/commands/timeline-commands.ts'
import { findElementTrack, listCompatibleTracks } from '../timeline/compatible-tracks.ts'
import { SetClipSpeedCommand } from '../../core/speed/commands.ts'
import { SetShotRateCommand, TrimShotCommand } from '../../core/commands/shot-commands.ts'
import { formatTimeCode } from '../../core/time.ts'
import { Clock } from 'lucide-react'
import { ResetCcwIcon } from '../inspector/inspector-icons.tsx'
import { PanelEmptyIcon, PanelHint } from '../shared/PanelChrome.tsx'
import '../shared/panel-chrome.css'
import { timelineRangeFillStyle } from '../timeline/range-fill-style.ts'
import '../shared/ve-range.css'

export type TimingPanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
}

function seconds(us: number): number {
  return Math.round((us / 1_000_000) * 100) / 100
}

const SPEED_PRESETS = [0.5, 1.0, 1.25, 1.5, 2.0, 4.0]

export function TimingPanel({ editor, style, className }: TimingPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  const element: TrackElement | undefined = doc.tracks
    .flatMap((track) => track.elements)
    .find((item) => item.id === selectedIds[0])

  if (!element) {
    return (
      <div
        className={`ve-panel-empty${className ? ` ${className}` : ''}`}
        data-testid="timing-panel-empty"
        style={{ fontSize: 12, color: 'var(--muted-foreground)', ...style }}
      >
        <PanelEmptyIcon icon={Clock} size={22} />
        <div className="ve-panel-empty__title">未选中任何片段</div>
        <div className="ve-panel-empty__desc">
          请在时间线上选中镜头、视频或音频片段后调节变速与入出点时间
        </div>
      </div>
    )
  }

  const fps = doc.canvas.fps.num / doc.canvas.fps.den
  const isShot = element.type === 'shot'
  const currentTrack = findElementTrack(doc, element.id)
  const compatibleTracks = listCompatibleTracks(doc, element)
  const canChangeTrack = compatibleTracks.length > 1
  const rate = 'rate' in element && typeof element.rate === 'number' ? element.rate : 1
  const startSec = seconds(element.startUs)
  const durationSec = seconds(element.durationUs)
  const startFrames = Math.round(startSec * fps)
  const durationFrames = Math.round(durationSec * fps)

  const setStart = (nextSeconds: number) => {
    editor.executeCommand(
      new MoveElementsCommand([
        { elementId: element.id, newStartUs: Math.max(0, Math.round(nextSeconds * 1_000_000)) },
      ]),
    )
  }

  const setDuration = (nextSeconds: number) => {
    if (isShot) {
      editor.executeCommand(
        new TrimShotCommand(element.id, { durationUs: Math.round(nextSeconds * 1_000_000) }, fps),
      )
      return
    }
    // 非镜头元素：裁切终点（保持起点不变）
    editor.executeCommand(
      new TrimElementCommand(element.id, { durationUs: Math.round(nextSeconds * 1_000_000) }),
    )
  }

  const setRate = (nextRate: number) => {
    const clampedRate = Math.max(0.25, Math.min(4, Math.round(nextRate * 100) / 100))
    if (isShot) {
      editor.executeCommand(new SetShotRateCommand(element.id, clampedRate, fps))
      return
    }
    editor.executeCommand(new SetClipSpeedCommand(element.id, clampedRate))
  }

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    height: 28,
    padding: '0 8px',
    flex: 1,
  }

  return (
    <div
      className={className}
      data-testid="timing-panel"
      style={{
        padding: '4px 12px 12px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {/* 头部标题与重置 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>时间与变速</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              fontWeight: 500,
            }}
          >
            {element.type}
          </span>
        </div>

        {Math.abs(rate - 1.0) > 0.01 && (
          <button
            type="button"
            onClick={() => setRate(1.0)}
            title="恢复 1.0x 原速"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '2px 6px',
              fontSize: 10,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
          >
            <ResetCcwIcon size={10} />
            <span>原速</span>
          </button>
        )}
      </div>

      {compatibleTracks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>所属轨道</span>
          {canChangeTrack ? (
            <select
              value={currentTrack?.id ?? ''}
              onChange={(event) => {
                const nextTrackId = event.target.value
                if (!nextTrackId || nextTrackId === currentTrack?.id) return
                editor.executeCommand(
                  new MoveElementToTrackCommand(element.id, nextTrackId, element.startUs),
                )
              }}
              style={{
                height: 28,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--muted)',
                color: 'var(--foreground)',
                fontSize: 11,
                padding: '0 8px',
              }}
            >
              {compatibleTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.name}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                fontSize: 11,
                color: 'var(--muted-foreground)',
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--muted)',
              }}
            >
              {currentTrack?.name ?? '—'}
            </div>
          )}
        </div>
      ) : null}

      {/* 快捷倍速胶囊条 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>常用倍速</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
            {rate.toFixed(2)}×
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {SPEED_PRESETS.map((p) => {
            const isSelected = Math.abs(rate - p) < 0.03
            return (
              <button
                key={p}
                type="button"
                onClick={() => setRate(p)}
                style={{
                  padding: '4px 0',
                  fontSize: 10,
                  fontWeight: isSelected ? 600 : 500,
                  borderRadius: 5,
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  background: isSelected ? 'var(--primary)' : 'var(--muted)',
                  color: isSelected ? 'var(--primary-foreground)' : 'var(--foreground)',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  textAlign: 'center',
                }}
              >
                {p}x
              </button>
            )
          })}
        </div>

        {/* 精细倍速滑块 */}
        <div className="ve-timeline-zoom" style={{ marginTop: 4, width: '100%' }}>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>0.25×</span>
          <input
            id="timing-rate"
            type="range"
            className="ve-timeline-range"
            min={0.25}
            max={4}
            step={0.05}
            value={rate}
            onChange={(event) => setRate(Number(event.target.value))}
            aria-label="播放倍速"
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              ...timelineRangeFillStyle(rate, 0.25, 4),
            }}
          />
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>4.0×</span>
        </div>
      </div>

      {/* 起点与时长并排网格 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>时间区间</div>

        <div style={{ display: 'flex', gap: 8 }}>
          {/* 起点 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>起点位置</span>
            <div style={inputContainerStyle}>
              <input
                id="timing-start"
                type="number"
                step={1 / fps}
                min={0}
                value={startSec}
                onChange={(event) => setStart(Number(event.target.value) || 0)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--foreground)',
                  fontSize: 11,
                  width: '100%',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>s</span>
            </div>
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
              第 {startFrames} 帧 · {formatTimeCode(element.startUs)}
            </span>
          </div>

          {/* 时长 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>片段时长</span>
            <div style={inputContainerStyle}>
              <input
                id="timing-duration"
                type="number"
                step={1 / fps}
                min={1 / fps}
                value={durationSec}
                onChange={(event) => setDuration(Number(event.target.value) || 1 / fps)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--foreground)',
                  fontSize: 11,
                  width: '100%',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>s</span>
            </div>
            <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>
              共 {durationFrames} 帧 ({Math.round(fps)} fps)
            </span>
          </div>
        </div>
      </div>

      {/* 片段元数据卡片 */}
      {isShot && element.type === 'shot' && (
        <div
          style={{
            background: 'var(--muted)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>镜头标识</span>
            <span style={{ fontWeight: 600 }}>{element.shotId.split('/').slice(-1)[0]}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--muted-foreground)' }}>原始母本帧数</span>
            <span style={{ fontWeight: 500 }}>{element.sourceDurationFrames} 帧</span>
          </div>
          <PanelHint variant="inline">
            调整倍速将改变画面的播放节拍；若含人声，播放速率变化将联动改变语速。
          </PanelHint>
        </div>
      )}
    </div>
  )
}
