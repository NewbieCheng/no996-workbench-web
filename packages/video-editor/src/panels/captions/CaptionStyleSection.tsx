/**
 * Inspector 字幕外观分组：改 captionStyle（烧录真源），可选加载本地字体。
 */

import React, { useMemo } from 'react'
import type { CaptionStyle, EditorDocument } from '../../core/project.ts'
import type { EditorInstance } from '../../core/instance.ts'
import { UpdateCaptionStyleCommand, UpdateCaptionsCommand } from '../../core/commands/timeline-commands.ts'
import { CAPTION_PRESETS, matchingCaptionPreset } from './caption-presets.ts'
import { CAPTION_FONTS, captionFontByFamily } from './caption-fonts.ts'
import { cueIdFromCaptionClipId, commitCaptionCueText } from './sync-text-track.ts'
import './caption-style-section.css'

export type CaptionStyleSectionProps = {
  editor: EditorInstance
  doc: EditorDocument
  /** 当前选中的字幕 marker id 列表；用于改单句正文 */
  selectedCaptionClipIds: string[]
  /** 宿主注入：按字体 id 加载 @font-face（工厂/口播） */
  loadFont?: (fontId: string) => Promise<void>
}

const PRESET_ITEMS = CAPTION_PRESETS.map((p) => ({ value: p.id, label: p.name }))
const FONT_ITEMS = CAPTION_FONTS.map((f) => ({ value: f.id, label: f.label }))

export function CaptionStyleSection({
  editor,
  doc,
  selectedCaptionClipIds,
  loadFont,
}: CaptionStyleSectionProps) {
  const style = doc.captionStyle
  const matchedPreset = useMemo(() => matchingCaptionPreset(style)?.id ?? null, [style])
  const matchedFontId = useMemo(
    () => captionFontByFamily(style.font || '')?.id ?? null,
    [style.font],
  )

  const primaryCueId = useMemo(() => {
    for (const id of selectedCaptionClipIds) {
      const cueId = cueIdFromCaptionClipId(id)
      if (cueId) return cueId
    }
    return null
  }, [selectedCaptionClipIds])

  const primaryCue = primaryCueId
    ? doc.captions.find((c) => c.id === primaryCueId)
    : undefined

  const patchStyle = (patch: Partial<CaptionStyle>) => {
    editor.executeCommand(new UpdateCaptionStyleCommand(patch))
  }

  const applyPreset = (presetId: string) => {
    const preset = CAPTION_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    editor.executeCommand(new UpdateCaptionStyleCommand({ ...preset.style }))
    const font = captionFontByFamily(preset.style.font)
    if (font && loadFont) void loadFont(font.id).catch(() => undefined)
  }

  const handleFontChange = (fontId: string | null) => {
    if (!fontId) return
    const font = CAPTION_FONTS.find((f) => f.id === fontId)
    if (!font) return
    patchStyle({ font: font.family, weight: font.weight })
    if (loadFont) void loadFont(font.id).catch(() => undefined)
  }

  const handleCueText = (text: string) => {
    if (!primaryCueId) return
    commitCaptionCueText(editor, primaryCueId, text)
  }

  const fieldRow = (label: string, control: React.ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{label}</span>
      {control}
    </div>
  )

  const controlClass = 've-caption-style-section__control'

  return (
    <div
      className="ve-caption-style-section"
      data-testid="caption-style-section"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '8px 0',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12 }}>字幕外观</div>

      {fieldRow(
        '样式预设',
        <select
          aria-label="字幕样式预设"
          className={controlClass}
          value={matchedPreset ?? ''}
          onChange={(e) => {
            if (e.target.value) applyPreset(e.target.value)
          }}
        >
          <option value="">自定义</option>
          {PRESET_ITEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>,
      )}

      {fieldRow(
        '字体',
        <select
          aria-label="字幕字体"
          className={controlClass}
          value={matchedFontId ?? ''}
          onChange={(e) => handleFontChange(e.target.value || null)}
        >
          <option value="">自定义</option>
          {FONT_ITEMS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>,
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fieldRow(
          '字号',
          <input
            type="number"
            className={controlClass}
            min={12}
            max={160}
            value={style.size ?? 58}
            onChange={(e) => patchStyle({ size: Number(e.target.value) || 58 })}
          />,
        )}
        {fieldRow(
          '字重',
          <input
            type="number"
            className={controlClass}
            min={100}
            max={900}
            step={100}
            value={style.weight ?? 700}
            onChange={(e) => patchStyle({ weight: Number(e.target.value) || 700 })}
          />,
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fieldRow(
          '文字色',
          <input
            type="color"
            className={`${controlClass} ve-caption-style-section__control--color`}
            value={normalizeHex(style.color) || '#ffffff'}
            onChange={(e) => patchStyle({ color: e.target.value })}
          />,
        )}
        {fieldRow(
          '强调色',
          <input
            type="color"
            className={`${controlClass} ve-caption-style-section__control--color`}
            value={normalizeHex(style.emphasisColor) || '#ffd60a'}
            onChange={(e) => patchStyle({ emphasisColor: e.target.value })}
          />,
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fieldRow(
          '描边色',
          <input
            type="color"
            className={`${controlClass} ve-caption-style-section__control--color`}
            value={normalizeHex(style.outlineColor) || '#111111'}
            onChange={(e) => patchStyle({ outlineColor: e.target.value })}
          />,
        )}
        {fieldRow(
          '描边宽',
          <input
            type="number"
            className={controlClass}
            min={0}
            max={16}
            value={style.outlineWidth ?? 0}
            onChange={(e) => patchStyle({ outlineWidth: Math.max(0, Number(e.target.value) || 0) })}
          />,
        )}
      </div>

      {fieldRow(
        '背景（空=透明）',
        <input
          type="text"
          className={controlClass}
          value={style.backgroundColor ?? ''}
          placeholder="transparent / #101820cc"
          onChange={(e) => patchStyle({ backgroundColor: e.target.value })}
        />,
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {fieldRow(
          '水平位置',
          <input
            type="number"
            className={controlClass}
            min={0.1}
            max={0.9}
            step={0.01}
            value={Number((style.xRatio ?? 0.5).toFixed(2))}
            onChange={(e) => patchStyle({ xRatio: Number(e.target.value) })}
          />,
        )}
        {fieldRow(
          '垂直位置',
          <input
            type="number"
            className={controlClass}
            min={0.1}
            max={0.95}
            step={0.01}
            value={Number((style.yRatio ?? 0.8).toFixed(2))}
            onChange={(e) => patchStyle({ yRatio: Number(e.target.value) })}
          />,
        )}
      </div>

      {primaryCue ? (
        fieldRow(
          '当前句正文',
          <textarea
            className={`${controlClass} ve-caption-style-section__control--area`}
            value={primaryCue.text}
            rows={3}
            onChange={(e) => handleCueText(e.target.value)}
          />,
        )
      ) : null}

      {selectedCaptionClipIds.length > 1 ? (
        <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
          已选 {selectedCaptionClipIds.length} 句字幕；外观改动作用于全片 captionStyle。
        </p>
      ) : null}
    </div>
  )
}

function normalizeHex(color?: string): string | null {
  if (!color) return null
  const trimmed = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const r = trimmed[1]
    const g = trimmed[2]
    const b = trimmed[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return null
}

/** 批量：对多选字幕仅改 captionStyle（全片） */
export function applyCaptionStyleBatch(editor: EditorInstance, patch: Partial<CaptionStyle>): void {
  editor.executeCommand(new UpdateCaptionStyleCommand(patch))
}

/** 批量删除选中字幕 cue（仅 cue；时间轴删除请走 Timeline 的 Batch 路径） */
export function deleteCaptionCuesByClipIds(editor: EditorInstance, clipIds: string[]): void {
  const doc = editor.getDocument()
  const cueIds = new Set(
    clipIds.map((id) => cueIdFromCaptionClipId(id)).filter((id): id is string => Boolean(id)),
  )
  if (cueIds.size === 0) return
  const next = doc.captions.filter((c) => !cueIds.has(c.id))
  editor.executeCommand(new UpdateCaptionsCommand(next))
}
