/**
 * 空间变换属性编辑小节（坐标、尺寸、比例锁、旋转、透明度、圆角、裁剪模式）
 * 对标 Figma / 剪映专业版紧凑参数矩阵
 */

import React from 'react'
import type { TransformBox } from '../../core/project.ts'
import { timelineRangeFillStyle } from '../timeline/range-fill-style.ts'
import '../shared/ve-range.css'
import '../shared/panel-chrome.css'
import { computeProportionalSize } from './transform-math.ts'
import { LinkChainIcon, UnlinkChainIcon, RotateCw90Icon } from './inspector-icons.tsx'
import { FramePositionSection } from './FramePositionSection.tsx'

export type TransformSectionProps = {
  transform: TransformBox
  lockAspect?: boolean
  onChange: (patch: Partial<TransformBox>) => void
  onToggleLockAspect?: () => void
  /** 画幅宽，用于「画面占比」滑条（相对画幅宽度） */
  canvasWidth?: number
  canvasHeight?: number
}

export function TransformSection({
  transform,
  lockAspect = true,
  onChange,
  onToggleLockAspect,
  canvasWidth,
}: TransformSectionProps) {
  const handleWidthChange = (newWidth: number) => {
    const { width, height } = computeProportionalSize(
      transform.width,
      transform.height,
      newWidth,
      undefined,
      lockAspect
    )
    onChange({ width, height })
  }

  const handleHeightChange = (newHeight: number) => {
    const { width, height } = computeProportionalSize(
      transform.width,
      transform.height,
      undefined,
      newHeight,
      lockAspect
    )
    onChange({ width, height })
  }

  const handleRotateCw90 = () => {
    const nextAngle = (Math.round(transform.rotationDeg / 90) * 90 + 90) % 360
    onChange({ rotationDeg: nextAngle })
  }

  // 统一微型输入框容器样式
  const fieldContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    height: 26,
    padding: '0 6px',
    flex: 1,
    minWidth: 0,
    transition: 'border-color 0.15s ease',
  }

  const fieldPrefixStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--muted-foreground)',
    marginRight: 4,
    userSelect: 'none',
    flexShrink: 0,
  }

  const fieldInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--foreground)',
    fontSize: 11,
    width: '100%',
    minWidth: 0,
    outline: 'none',
    padding: 0,
    fontVariantNumeric: 'tabular-nums',
  }

  const fieldUnitStyle: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--muted-foreground)',
    marginLeft: 2,
    userSelect: 'none',
    flexShrink: 0,
  }

  const opacityPercent = Math.round((transform.opacity ?? 1) * 100)
  const scalePercent =
    canvasWidth && canvasWidth > 0 ? Math.round((transform.width / canvasWidth) * 100) : 100

  const handleScalePercent = (nextPercent: number) => {
    if (!canvasWidth || canvasWidth <= 0) return
    const clamped = Math.max(5, Math.min(200, Math.round(nextPercent)))
    const newWidth = Math.max(1, Math.round(canvasWidth * (clamped / 100)))
    if (lockAspect && transform.width > 0) {
      const ratio = transform.height / transform.width
      onChange({ width: newWidth, height: Math.max(1, Math.round(newWidth * ratio)) })
    } else {
      onChange({ width: newWidth })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>空间与尺寸</span>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Transform</span>
      </div>

      {canvasWidth && canvasWidth > 0 ? (
        <div className="ve-timeline-zoom" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={fieldPrefixStyle}>占比</span>
          <input
            type="range"
            className="ve-timeline-range"
            min={5}
            max={200}
            value={scalePercent}
            onChange={(e) => handleScalePercent(Number(e.target.value))}
            aria-label="画面占比"
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              ...timelineRangeFillStyle(scalePercent, 5, 200),
            }}
          />
          <span
            style={{
              ...fieldUnitStyle,
              width: 32,
              textAlign: 'right',
              fontWeight: 500,
              color: 'var(--foreground)',
            }}
          >
            {scalePercent}%
          </span>
        </div>
      ) : null}

      {/* Row 1: X 坐标与 Y 坐标 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={fieldContainerStyle}>
          <span style={fieldPrefixStyle}>X</span>
          <input
            type="number"
            value={transform.x}
            onChange={(e) => onChange({ x: Number(e.target.value) })}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>px</span>
        </div>

        <div style={fieldContainerStyle}>
          <span style={fieldPrefixStyle}>Y</span>
          <input
            type="number"
            value={transform.y}
            onChange={(e) => onChange({ y: Number(e.target.value) })}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>px</span>
        </div>
      </div>

      {/* Row 2: 宽 W 与 高 H（中间等比锁链图标） */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={fieldContainerStyle}>
          <span style={fieldPrefixStyle}>W</span>
          <input
            type="number"
            min={1}
            value={transform.width}
            onChange={(e) => handleWidthChange(Number(e.target.value))}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>px</span>
        </div>

        <button
          type="button"
          className="ve-aspect-lock-btn"
          data-locked={lockAspect}
          onClick={onToggleLockAspect}
          title={lockAspect ? '锁定宽高比例 (已开启，点击解锁)' : '自由宽高比例 (已解锁，点击锁定)'}
        >
          {lockAspect ? <LinkChainIcon size={12} /> : <UnlinkChainIcon size={12} />}
        </button>

        <div style={fieldContainerStyle}>
          <span style={fieldPrefixStyle}>H</span>
          <input
            type="number"
            min={1}
            value={transform.height}
            onChange={(e) => handleHeightChange(Number(e.target.value))}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>px</span>
        </div>
      </div>

      {/* Row 3: 旋转角度与不透明度 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ ...fieldContainerStyle, flex: 1 }}>
          <span style={fieldPrefixStyle}>旋转</span>
          <input
            type="number"
            value={transform.rotationDeg}
            onChange={(e) => onChange({ rotationDeg: Number(e.target.value) })}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>°</span>
          <button
            type="button"
            onClick={handleRotateCw90}
            title="顺时针旋转 90°"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              marginLeft: 4,
            }}
          >
            <RotateCw90Icon size={12} />
          </button>
        </div>

        <div className="ve-timeline-zoom" style={{ flex: 1.2, minWidth: 0 }}>
          <span style={fieldPrefixStyle}>不透明</span>
          <input
            type="range"
            className="ve-timeline-range"
            min={0}
            max={100}
            value={opacityPercent}
            onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
            aria-label="不透明度"
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              ...timelineRangeFillStyle(opacityPercent, 0, 100),
            }}
          />
          <span
            style={{
              ...fieldUnitStyle,
              width: 28,
              textAlign: 'right',
              fontWeight: 500,
              color: 'var(--foreground)',
            }}
          >
            {opacityPercent}%
          </span>
        </div>
      </div>

      {/* Row 4: 填充裁剪模式与圆角 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--muted)', padding: 2, borderRadius: 6, border: '1px solid var(--border)', flex: 1.3 }}>
          {(
            [
              { mode: 'cover', label: '覆盖' },
              { mode: 'contain', label: '自适' },
              { mode: 'none', label: '原始' },
            ] as const
          ).map((item) => {
            const active = (transform.cropMode || 'cover') === item.mode
            return (
              <button
                key={item.mode}
                type="button"
                className="ve-segment-btn"
                data-active={active}
                aria-pressed={active}
                onClick={() => onChange({ cropMode: item.mode })}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div style={{ ...fieldContainerStyle, flex: 0.9 }}>
          <span style={fieldPrefixStyle}>圆角</span>
          <input
            type="number"
            min={0}
            value={transform.round || 0}
            onChange={(e) => onChange({ round: Math.max(0, Number(e.target.value)) })}
            style={fieldInputStyle}
          />
          <span style={fieldUnitStyle}>px</span>
        </div>
      </div>

      <FramePositionSection transform={transform} onChange={onChange} />
    </div>
  )
}
