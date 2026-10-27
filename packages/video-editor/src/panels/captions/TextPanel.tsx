/**
 * 文本元素独立排版与样式面板
 */

import React from 'react'
import type { TextClipElement, TextStyle } from '../../core/project.ts'
import { layoutChineseText } from './typography.ts'

export type TextPanelProps = {
  element: TextClipElement
  onChange: (patch: { text?: string; style?: Partial<TextStyle> }) => void
}

export function TextPanel({ element, onChange }: TextPanelProps) {
  const { text, style } = element

  // 实时排版与溢出测量
  const layout = layoutChineseText(text, {
    fontSize: style.size,
    maxWidth: 600,
    maxLines: 3,
  })

  const inputStyle: React.CSSProperties = {
    background: 'var(--muted)',
    border: '1px solid var(--border)',
    color: 'var(--foreground)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>文本正文与排版</div>

      {/* 正文输入 */}
      <textarea
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={3}
        style={{
          ...inputStyle,
          width: '100%',
          resize: 'vertical',
          fontFamily: style.font || 'sans-serif',
        }}
      />

      {/* 溢出提示（绝不隐式截断正文） */}
      {layout.isOverflow && (
        <div style={{ fontSize: 11, color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: 6, borderRadius: 6 }}>
          ⚠️ 文本超出建议行数（建议不超过 3 行，当前 {layout.recommendedLines} 行，溢出 {layout.overflowChars} 字）
        </div>
      )}

      {/* 字体与字号 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          字号:
          <input
            type="number"
            min={12}
            max={120}
            value={style.size}
            onChange={(e) => onChange({ style: { size: Number(e.target.value) } })}
            style={{ ...inputStyle, width: 55, marginLeft: 4 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          字重:
          <select
            value={style.weight}
            onChange={(e) => onChange({ style: { weight: Number(e.target.value) } })}
            style={{ ...inputStyle, marginLeft: 4 }}
          >
            <option value={400}>常规 (400)</option>
            <option value={600}>中粗 (600)</option>
            <option value={700}>粗体 (700)</option>
            <option value={900}>特粗 (900)</option>
          </select>
        </label>
      </div>

      {/* 颜色、背景与对齐 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          文字:
          <input
            type="color"
            value={style.color}
            onChange={(e) => onChange({ style: { color: e.target.value } })}
            style={{ width: 28, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          描边:
          <input
            type="color"
            value={style.outlineColor || '#000000'}
            onChange={(e) => onChange({ style: { outlineColor: e.target.value } })}
            style={{ width: 28, height: 24, border: 'none', background: 'transparent', cursor: 'pointer', marginLeft: 4 }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          对齐:
          <select
            value={style.align}
            onChange={(e) => onChange({ style: { align: e.target.value as 'left' | 'center' | 'right' } })}
            style={{ ...inputStyle, marginLeft: 4 }}
          >
            <option value="left">左</option>
            <option value="center">中</option>
            <option value="right">右</option>
          </select>
        </label>
      </div>
    </div>
  )
}
