/**
 * 视觉效果与滤镜面板 (EffectsPanel)
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { EffectParam, EffectKind, VideoClipElement } from '../../core/project.ts'
import { UpdateElementEffectsCommand } from '../../core/effects/commands.ts'
import { DEFAULT_EFFECTS_CONFIG } from '../../core/effects/effects-evaluator.ts'
import { timelineRangeFillStyle } from '../timeline/range-fill-style.ts'
import '../shared/ve-range.css'

export type EffectsPanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
}

export function EffectsPanel({
  editor,
  style,
  className,
}: EffectsPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  const targetId = selectedIds[0]
  let currentVideoElem: VideoClipElement | null = null

  if (targetId) {
    for (const track of doc.tracks) {
      const elem = track.elements.find((e) => e.id === targetId)
      if (elem && elem.type === 'video') {
        currentVideoElem = elem as VideoClipElement
        break
      }
    }
  }

  const effects = currentVideoElem?.effects || []

  const updateEffect = (kind: EffectKind, patch: Partial<EffectParam>) => {
    if (!currentVideoElem) return
    const existing = [...effects]
    const idx = existing.findIndex((e) => e.kind === kind)

    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...patch }
    } else {
      const config = DEFAULT_EFFECTS_CONFIG[kind]
      existing.push({
        id: `eff-${kind}`,
        kind,
        enabled: true,
        intensity: config.defaultIntensity,
        ...patch,
      })
    }

    editor.executeCommand(new UpdateElementEffectsCommand(currentVideoElem.id, existing))
  }

  const resetAllEffects = () => {
    if (!currentVideoElem) return
    editor.executeCommand(new UpdateElementEffectsCommand(currentVideoElem.id, []))
  }

  const effectKinds: EffectKind[] = ['brightness', 'contrast', 'saturation', 'grayscale', 'blur']

  if (!currentVideoElem) {
    return (
      <div
        className={className}
        style={{
          padding: 16,
          color: 'var(--muted-foreground)',
          fontSize: 12,
          background: 'var(--card)',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
      >
        请在时间轴选中一个视频片段以调节滤镜与效果
      </div>
    )
  }

  return (
    <div
      className={className}
      data-testid="effects-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: 12,
        padding: 12,
        gap: 12,
        overflowY: 'auto',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>滤镜与视觉效果</span>
        <button
          type="button"
          onClick={resetAllEffects}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
          }}
        >
          重置全部
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {effectKinds.map((kind) => {
          const config = DEFAULT_EFFECTS_CONFIG[kind]
          const eff = effects.find((e) => e.kind === kind)
          const isEnabled = eff ? eff.enabled : false
          const intensity = eff ? eff.intensity : config.defaultIntensity

          const min = kind === 'blur' || kind === 'grayscale' ? 0 : 0.2
          const max = kind === 'blur' ? 20 : kind === 'grayscale' ? 1.0 : 2.5
          const step = kind === 'blur' ? 1 : 0.05

          return (
            <div
              key={kind}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                background: 'var(--muted)',
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isEnabled}
                    onChange={(e) => updateEffect(kind, { enabled: e.target.checked })}
                  />
                  <span style={{ fontWeight: 'bold', fontSize: 11 }}>{config.name}</span>
                </label>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#38bdf8' }}>
                  {intensity}
                  {config.unit}
                </span>
              </div>

              {isEnabled && (
                <div className="ve-timeline-zoom" style={{ width: '100%' }}>
                  <input
                    type="range"
                    className="ve-timeline-range"
                    min={min}
                    max={max}
                    step={step}
                    value={intensity}
                    onChange={(e) => updateEffect(kind, { intensity: Number(e.target.value) })}
                    aria-label={`${config.name}强度`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      width: '100%',
                      ...timelineRangeFillStyle(intensity, min, max),
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
