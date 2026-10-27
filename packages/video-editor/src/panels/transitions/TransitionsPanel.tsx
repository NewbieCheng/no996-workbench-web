/**
 * 转场配置与预设面板 (TransitionsPanel)
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { TransitionKind, TransitionElement } from '../../core/project.ts'
import { AddTransitionCommand, RemoveTransitionCommand } from '../../core/transitions/commands.ts'
import { formatTimeCode } from '../../core/time.ts'

export type TransitionsPanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
}

export const TRANSITION_PRESETS: Array<{ kind: TransitionKind; name: string; desc: string }> = [
  { kind: 'crossfade', name: '平滑淡入淡出', desc: '两画面透明度线性渐变交融' },
  { kind: 'dissolve', name: '柔和叠化', desc: '经典电影级柔和叠化切镜' },
  { kind: 'wipe', name: '方向擦除', desc: '从左向右水平擦除推进换场' },
  { kind: 'cut', name: '快速硬切', desc: '无缝瞬时画面切换' },
]

export function TransitionsPanel({
  editor,
  style,
  className,
}: TransitionsPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())
  const [durationSec, setDurationSec] = useState(1.0)

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  const transitions = Object.values(doc.transitions || {})

  // 寻找选中的相邻两个元素
  let adjacentPair: { leftId: string; rightId: string } | null = null
  if (selectedIds.length === 2) {
    for (const track of doc.tracks) {
      const idx1 = track.elements.findIndex((e) => e.id === selectedIds[0])
      const idx2 = track.elements.findIndex((e) => e.id === selectedIds[1])
      if (idx1 !== -1 && idx2 !== -1 && Math.abs(idx1 - idx2) === 1) {
        const left = idx1 < idx2 ? selectedIds[0] : selectedIds[1]
        const right = idx1 < idx2 ? selectedIds[1] : selectedIds[0]
        adjacentPair = { leftId: left, rightId: right }
        break
      }
    }
  }

  const handleApplyTransition = (kind: TransitionKind) => {
    if (!adjacentPair) {
      alert('请先在时间轴上按住 Shift 选中同一轨道内相邻的两个片段')
      return
    }

    const durationUs = Math.round(durationSec * 1_000_000)
    const newTrans: TransitionElement = {
      id: `trans-${crypto.randomUUID()}`,
      kind,
      durationUs,
      fromElementId: adjacentPair.leftId,
      toElementId: adjacentPair.rightId,
    }

    try {
      editor.executeCommand(new AddTransitionCommand(newTrans))
    } catch (err: any) {
      alert(err.message || '转场应用失败')
    }
  }

  const handleRemoveTransition = (transId: string) => {
    editor.executeCommand(new RemoveTransitionCommand(transId))
  }

  return (
    <div
      className={className}
      data-testid="transitions-panel"
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
      <div style={{ fontWeight: 600, fontSize: 13 }}>转场与换场效果</div>

      {/* 相邻选中状态提示 */}
      <div
        style={{
          background: adjacentPair ? 'rgba(35, 134, 54, 0.08)' : 'var(--muted)',
          border: `1px solid ${adjacentPair ? '#238636' : 'var(--border)'}`,
          borderRadius: 6,
          padding: 8,
          fontSize: 11,
          color: adjacentPair ? '#238636' : 'var(--muted-foreground)',
        }}
      >
        {adjacentPair
          ? `已选相邻片段: [${adjacentPair.leftId}] ➔ [${adjacentPair.rightId}]`
          : '提示：在时间轴按住 Shift 选中两块相邻片段即可一键套用转场'}
      </div>

      {/* 时长设置 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>转场时长:</span>
        {[0.5, 1.0, 1.5, 2.0].map((sec) => (
          <button
            key={sec}
            type="button"
            onClick={() => setDurationSec(sec)}
            style={{
              padding: '2px 8px',
              fontSize: 11,
              background: durationSec === sec ? 'var(--primary)' : 'var(--muted)',
              border: `1px solid ${durationSec === sec ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 6,
              color: durationSec === sec ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontWeight: durationSec === sec ? 600 : 400,
            }}
          >
            {sec}s
          </button>
        ))}
      </div>

      {/* 转场预设库 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {TRANSITION_PRESETS.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => handleApplyTransition(p.kind)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: 8,
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              color: 'var(--foreground)',
              textAlign: 'left',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 11 }}>{p.name}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2 }}>{p.desc}</span>
          </button>
        ))}
      </div>

      {/* 已挂载转场列表 */}
      {transitions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>工程中已应用的转场 ({transitions.length})</div>
          {transitions.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                fontSize: 11,
              }}
            >
              <span>{t.kind} ({formatTimeCode(t.durationUs)})</span>
              <button
                type="button"
                onClick={() => handleRemoveTransition(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                移除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
