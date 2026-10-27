/**
 * 蒙版属性编辑小节（矩形/圆形、反转、羽化）
 */

import React from 'react'
import type { ElementMask, MaskKind } from '../../core/project.ts'
import { timelineRangeFillStyle } from '../timeline/range-fill-style.ts'
import '../shared/ve-range.css'

export type MaskSectionProps = {
  mask?: ElementMask
  onChange: (mask: ElementMask) => void
  onRemove: () => void
}

export function MaskSection({ mask, onChange, onRemove }: MaskSectionProps) {
  const currentMask: ElementMask = mask || {
    kind: 'none',
    x: 0,
    y: 0,
    width: 200,
    height: 200,
    inverted: false,
    feather: 0,
  }

  const handleKindChange = (kind: MaskKind) => {
    if (kind === 'none') {
      onRemove()
    } else {
      onChange({ ...currentMask, kind })
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>蒙版设置</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>类型:</span>
        <select
          value={currentMask.kind}
          onChange={(e) => handleKindChange(e.target.value as MaskKind)}
          style={{ ...inputStyle, width: 100 }}
        >
          <option value="none">无蒙版</option>
          <option value="rectangle">矩形</option>
          <option value="circle">圆形/椭圆</option>
        </select>

        {currentMask.kind !== 'none' && (
          <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--foreground)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={currentMask.inverted}
              onChange={(e) => onChange({ ...currentMask, inverted: e.target.checked })}
              style={{ marginRight: 4 }}
            />
            反转
          </label>
        )}
      </div>

      {currentMask.kind !== 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
              宽:
              <input
                type="number"
                value={currentMask.width}
                onChange={(e) => onChange({ ...currentMask, width: Number(e.target.value) })}
                style={{ ...inputStyle, width: 64, marginLeft: 4 }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
              高:
              <input
                type="number"
                value={currentMask.height}
                onChange={(e) => onChange({ ...currentMask, height: Number(e.target.value) })}
                style={{ ...inputStyle, width: 64, marginLeft: 4 }}
              />
            </label>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--muted-foreground)',
            }}
          >
            羽化:
            <div className="ve-timeline-zoom" style={{ flex: 1, minWidth: 0 }}>
              <input
                type="range"
                className="ve-timeline-range"
                min={0}
                max={50}
                value={currentMask.feather}
                onChange={(e) => onChange({ ...currentMask, feather: Number(e.target.value) })}
                aria-label="蒙版羽化"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  ...timelineRangeFillStyle(currentMask.feather, 0, 50),
                }}
              />
            </div>
            <span style={{ width: 24, textAlign: 'right', color: 'var(--foreground)', flexShrink: 0 }}>
              {currentMask.feather}
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
