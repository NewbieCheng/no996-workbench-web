/**
 * 完整模板与封面预设面板
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { CoverMetadata, BrandPreset } from '../../core/project.ts'
import { ALL_PRESETS, type ProjectPreset } from '../../presets/index.ts'
import { CoverEditor } from './CoverEditor.tsx'

export type TemplatePanelProps = {
  editor: EditorInstance
  playheadUs?: number
  style?: React.CSSProperties
  className?: string
}

export function TemplatePanel({
  editor,
  playheadUs = 0,
  style,
  className,
}: TemplatePanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
    })
  }, [editor])

  const meta = doc.templateMeta || {}

  const handleApplyPreset = (preset: ProjectPreset) => {
    const newDoc = preset.createDocument({
      name: `${doc.name} (${preset.name})`,
      scope: doc.scope,
    })
    editor.setDocument(newDoc)
  }

  const handleUpdateCover = (patch: Partial<CoverMetadata>) => {
    editor.updateDocument((prev) => ({
      ...prev,
      templateMeta: {
        ...prev.templateMeta,
        cover: {
          ...prev.templateMeta?.cover,
          ...patch,
        },
      },
    }))
  }

  const handleUpdateBrand = (patch: Partial<BrandPreset>) => {
    editor.updateDocument((prev) => ({
      ...prev,
      templateMeta: {
        ...prev.templateMeta,
        brand: {
          brandColor: '#2563eb',
          ...prev.templateMeta?.brand,
          ...patch,
        },
      },
    }))
  }

  return (
    <div
      className={className}
      data-testid="template-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card)',
        color: 'var(--foreground)',
        fontSize: 12,
        padding: 12,
        borderLeft: '1px solid var(--border)',
        gap: 16,
        overflowY: 'auto',
        ...style,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>模板与场景预设</div>

      {/* 预设列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>切换场景工程</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {ALL_PRESETS.map((p) => {
            const isActive = meta.templateId === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleApplyPreset(p)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: 8,
                  background: isActive ? 'var(--secondary)' : 'var(--muted)',
                  border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  color: 'var(--foreground)',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <span style={{ fontWeight: 600, fontSize: 11 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--primary)' }}>{p.ratio}</span>
                </div>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4 }}>{p.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 封面与包装编辑器 */}
      <CoverEditor
        cover={meta.cover}
        brand={meta.brand}
        playheadUs={playheadUs}
        onUpdateCover={handleUpdateCover}
        onUpdateBrand={handleUpdateBrand}
      />
    </div>
  )
}
