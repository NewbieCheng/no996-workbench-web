/**
 * 画面位置：覆盖/自适应模式下的九宫格锚点
 */

import type { TransformBox } from '../../core/project.ts'
import '../shared/panel-chrome.css'
import {
  FRAME_ANCHOR_LABELS,
  FRAME_POSITION_ANCHORS,
  frameAnchorToFocus,
  focusToFrameAnchor,
  type FramePositionAnchor,
} from './frame-position.ts'

export type FramePositionSectionProps = {
  transform: TransformBox
  onChange: (patch: Partial<TransformBox>) => void
}

export function FramePositionSection({ transform, onChange }: FramePositionSectionProps) {
  const cropMode = transform.cropMode || 'cover'
  const disabled = cropMode === 'none'
  const activeAnchor = focusToFrameAnchor(transform.contentFocusX, transform.contentFocusY)

  const handlePick = (anchor: FramePositionAnchor) => {
    const { x, y } = frameAnchorToFocus(anchor)
    onChange({ contentFocusX: x, contentFocusY: y })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>画面位置</span>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
          {disabled ? '原始尺寸不可用' : 'Object Position'}
        </span>
      </div>

      <div
        className="ve-frame-position__grid"
        data-disabled={disabled ? 'true' : 'false'}
        aria-disabled={disabled}
      >
        {FRAME_POSITION_ANCHORS.map((anchor) => (
          <button
            key={anchor}
            type="button"
            className="ve-frame-position__cell"
            data-active={!disabled && activeAnchor === anchor}
            disabled={disabled}
            onClick={() => handlePick(anchor)}
            title={`${FRAME_ANCHOR_LABELS[anchor]}${disabled ? '（请先选覆盖或自适）' : ''}`}
            aria-label={FRAME_ANCHOR_LABELS[anchor]}
          />
        ))}
      </div>
    </div>
  )
}
