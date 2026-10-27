/**
 * 关键帧控制面板 (KeyframesPanel)
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { KeyframePoint, KeyframeEasing } from '../../core/project.ts'
import { SetKeyframeCommand, RemoveKeyframeCommand } from '../../core/keyframes/commands.ts'
import { KEYFRAME_PROPERTY_REGISTRY } from '../../core/keyframes/registry.ts'
import { formatTimeCode } from '../../core/time.ts'

export type KeyframesPanelProps = {
  editor: EditorInstance
  playheadUs?: number
  onSeek?: (timeUs: number) => void
  style?: React.CSSProperties
  className?: string
}

export function KeyframesPanel({
  editor,
  playheadUs = 0,
  onSeek,
  style,
  className,
}: KeyframesPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())
  const [selectedProp, setSelectedProp] = useState('transform.opacity')
  const [easing, setEasing] = useState<KeyframeEasing>('linear')

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  const targetId = selectedIds[0]
  let currentElem = null

  if (targetId) {
    for (const track of doc.tracks) {
      const el = track.elements.find((e) => e.id === targetId)
      if (el) {
        currentElem = el
        break
      }
    }
  }

  const channels = currentElem?.animations?.channels || {}
  const activeChannel = channels[selectedProp]
  const keyframes = activeChannel?.keyframes || []

  // 在当前播放头处添加或更新关键帧
  const handleAddKeyframeAtPlayhead = () => {
    if (!currentElem) return
    const localTimeUs = Math.max(0, playheadUs - currentElem.startUs)

    // 默认取属性当前值
    let val: number | string = 1.0
    if (selectedProp === 'transform.opacity' && 'transform' in currentElem && currentElem.transform) {
      val = currentElem.transform.opacity
    } else if (selectedProp === 'transform.rotationDeg' && 'transform' in currentElem && currentElem.transform) {
      val = currentElem.transform.rotationDeg
    } else if (selectedProp === 'volume' && 'volume' in currentElem && currentElem.volume !== undefined) {
      val = currentElem.volume
    }

    const point: KeyframePoint<number | string> = {
      id: `kf-${crypto.randomUUID()}`,
      timeUs: localTimeUs,
      value: val,
      easing,
    }

    editor.executeCommand(new SetKeyframeCommand(currentElem.id, selectedProp, point))
  }

  const handleRemoveKeyframe = (kfId: string) => {
    if (!currentElem) return
    editor.executeCommand(new RemoveKeyframeCommand(currentElem.id, selectedProp, kfId))
  }

  if (!currentElem) {
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
        请在时间轴选中一个素材以配置关键帧动画
      </div>
    )
  }

  return (
    <div
      className={className}
      data-testid="keyframes-panel"
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
        <span style={{ fontWeight: 600, fontSize: 13 }}>关键帧动画</span>
        <button
          type="button"
          onClick={handleAddKeyframeAtPlayhead}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          + 在当前播放头打帧
        </button>
      </div>

      {/* 通道选择与缓动 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          属性通道:
          <select
            value={selectedProp}
            onChange={(e) => setSelectedProp(e.target.value)}
            style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 11,
              marginLeft: 4,
            }}
          >
            {Object.entries(KEYFRAME_PROPERTY_REGISTRY).map(([key, desc]) => (
              <option key={key} value={key}>{desc.name}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: 'var(--muted-foreground)' }}>
          曲线:
          <select
            value={easing}
            onChange={(e) => setEasing(e.target.value as KeyframeEasing)}
            style={{
              background: 'var(--muted)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              borderRadius: 6,
              padding: '3px 6px',
              fontSize: 11,
              marginLeft: 4,
            }}
          >
            <option value="linear">线性 (linear)</option>
            <option value="easeIn">缓入 (easeIn)</option>
            <option value="easeOut">缓出 (easeOut)</option>
            <option value="easeInOut">平滑 (easeInOut)</option>
            <option value="hold">保持 (hold)</option>
          </select>
        </label>
      </div>

      {/* 关键帧点列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
          通道 [{selectedProp}] 已有关键帧 ({keyframes.length})
        </div>

        {keyframes.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted-foreground)', marginTop: 24, fontSize: 11 }}>
            当前属性暂无关键帧，点击上方打帧添加
          </div>
        ) : (
          keyframes.map((kf, idx) => (
            <div
              key={kf.id}
              onClick={() => onSeek?.(currentElem!.startUs + kf.timeUs)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                background: 'var(--muted)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>◆</span>
                <span style={{ fontSize: 11 }}>#{idx + 1} {formatTimeCode(kf.timeUs)}</span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                  值: {String(kf.value)} ({kf.easing})
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveKeyframe(kf.id)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                删除
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
