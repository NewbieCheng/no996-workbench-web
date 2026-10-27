/**
 * 音频包络面板 (大厂剪辑标准版)
 *
 * 选中音频片段后调整：音量、静音、淡入、淡出。
 * 支持常用音量快捷胶囊 (0%~200%)、淡入淡出预设档位与上下文友好的智能空态。
 */

import React, { useEffect, useState } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import type { AudioClipElement } from '../../core/project.ts'
import { UpdateAudioEnvelopeCommand } from '../../core/audio/commands.ts'
import { timelineRangeFillStyle } from '../timeline/range-fill-style.ts'
import '../shared/ve-range.css'
import { VolumeHighIcon, VolumeMuteIcon, ResetCcwIcon } from '../inspector/inspector-icons.tsx'
import { PanelEmptyIcon } from '../shared/PanelChrome.tsx'
import '../shared/panel-chrome.css'

export type AudioEnvelopePanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
  /** 无音频时的额外操作（如「配音库」导入） */
  emptyActions?: React.ReactNode
}

const VOLUME_PRESETS = [
  { label: '静音', value: 0 },
  { label: '50%', value: 0.5 },
  { label: '100%', value: 1.0 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2.0 },
]

const FADE_PRESETS = [0, 0.5, 1.0, 2.0]

export function AudioEnvelopePanel({ editor, style, className, emptyActions }: AudioEnvelopePanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())
  const [selectedIds, setSelectedIds] = useState(() => editor.getSelectedElementIds())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
      setSelectedIds(editor.getSelectedElementIds())
    })
  }, [editor])

  const selectedElement = doc.tracks
    .flatMap((track) => track.elements)
    .find((item) => item.id === selectedIds[0])

  const audioTrack = doc.tracks.find((t) => t.type === 'audio')
  const audioElements = audioTrack?.elements as AudioClipElement[] | undefined

  const isAudioSelected = selectedElement && selectedElement.type === 'audio'
  const element = isAudioSelected ? (selectedElement as AudioClipElement) : undefined

  // 如果没有选中具体音频片段，提供大厂级上下文引导
  if (!element) {
    const hasAudioTracks = Boolean(audioElements && audioElements.length > 0)

    return (
      <div
        data-testid="audio-envelope-panel-empty"
        className={`ve-panel-empty${className ? ` ${className}` : ''}`}
        style={{ fontSize: 12, color: 'var(--muted-foreground)', ...style }}
      >
        <PanelEmptyIcon icon={VolumeHighIcon} size={22} large />

        <div className="ve-panel-empty__title">
          {selectedElement ? `当前选中为 ${selectedElement.type} 片段` : '未选中音频片段'}
        </div>

        <div className="ve-panel-empty__desc">
          {hasAudioTracks
            ? '请在时间线下方的音频轨道中点击任意音频片段，即可精准调整音量包络与淡入淡出。'
            : '时间线上暂无独立音频片段。可从「配音库」导入历史配音，或通过左侧「素材」「音效」添加。'}
        </div>

        {!hasAudioTracks && emptyActions ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, justifyContent: 'center' }}>
            {emptyActions}
          </div>
        ) : null}

        {hasAudioTracks && audioElements && audioElements[0] && (
          <button
            type="button"
            onClick={() => editor.setSelection([audioElements[0].id])}
            style={{
              padding: '6px 12px',
              fontSize: 11,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              marginTop: 4,
            }}
          >
            快速选中首个音频片段
          </button>
        )}
      </div>
    )
  }

  const volume = element.volume ?? 1
  const fadeInSec = Math.round(((element.fadeInUs ?? 0) / 1_000_000) * 100) / 100
  const fadeOutSec = Math.round(((element.fadeOutUs ?? 0) / 1_000_000) * 100) / 100
  const isMuted = volume === 0
  const maxFadeSec = Math.max(0.5, Math.round((element.durationUs / 2_000_000) * 10) / 10)

  const apply = (patch: { volume?: number; fadeInUs?: number; fadeOutUs?: number }) => {
    editor.executeCommand(
      new UpdateAudioEnvelopeCommand(element.id, {
        volume: patch.volume ?? element.volume,
        fadeInUs: patch.fadeInUs ?? element.fadeInUs ?? 0,
        fadeOutUs: patch.fadeOutUs ?? element.fadeOutUs ?? 0,
      }),
    )
  }

  const toggleMute = () => {
    apply({ volume: isMuted ? 1.0 : 0 })
  }

  const handleReset = () => {
    apply({ volume: 1.0, fadeInUs: 0, fadeOutUs: 0 })
  }

  // 估算 dB 值
  const volumeDb = volume > 0 ? (20 * Math.log10(volume)).toFixed(1) : '-∞'

  return (
    <div
      className={className}
      data-testid="audio-envelope-panel"
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
          <span style={{ fontWeight: 600, fontSize: 13 }}>音量与包络</span>
          <span
            style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontWeight: 600,
            }}
          >
            AUDIO
          </span>
        </div>

        <button
          type="button"
          onClick={handleReset}
          title="恢复标准音量与无淡化"
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
          <span>复位</span>
        </button>
      </div>

      {/* 音量控制小节 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>音量大小</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)' }}>
              {Math.round(volume * 100)}%
            </span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              ({volumeDb} dB)
            </span>
          </div>
        </div>

        {/* 快捷音量档位胶囊 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {VOLUME_PRESETS.map((p) => {
            const isSelected = Math.abs(volume - p.value) < 0.05
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => apply({ volume: p.value })}
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
                {p.label}
              </button>
            )
          })}
        </div>

        {/* 滑动调节与静音按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? '取消静音 (点击恢复 100%)' : '一键静音 (Mute)'}
            style={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isMuted ? 'rgba(239, 68, 68, 0.15)' : 'var(--muted)',
              border: `1px solid ${isMuted ? '#ef4444' : 'var(--border)'}`,
              borderRadius: 5,
              color: isMuted ? '#ef4444' : 'var(--foreground)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            {isMuted ? <VolumeMuteIcon size={14} /> : <VolumeHighIcon size={14} />}
          </button>

          <div className="ve-timeline-zoom" style={{ flex: 1, minWidth: 0 }}>
            <input
              id="env-volume"
              type="range"
              className="ve-timeline-range"
              min={0}
              max={2}
              step={0.02}
              value={volume}
              onChange={(event) => apply({ volume: Number(event.target.value) })}
              aria-label="音量"
              style={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                ...timelineRangeFillStyle(volume, 0, 2),
              }}
            />
          </div>

          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', width: 32, textAlign: 'right', flexShrink: 0 }}>
            200%
          </span>
        </div>
      </div>

      {/* 淡入淡出包络控制 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>淡入淡出包络</div>

        {/* 淡入时长 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>淡入时长 (Fade In)</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--foreground)' }}>
              {fadeInSec}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div className="ve-timeline-zoom" style={{ flex: 1, minWidth: 0 }}>
              <input
                id="env-fadein"
                type="range"
                className="ve-timeline-range"
                min={0}
                max={maxFadeSec}
                step={0.05}
                value={fadeInSec}
                onChange={(event) =>
                  apply({ fadeInUs: Math.round(Number(event.target.value) * 1_000_000) })
                }
                aria-label="淡入时长"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  ...timelineRangeFillStyle(fadeInSec, 0, maxFadeSec),
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {FADE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => apply({ fadeInUs: Math.round(s * 1_000_000) })}
                  style={{
                    padding: '1px 4px',
                    fontSize: 9,
                    background: fadeInSec === s ? 'var(--primary)' : 'var(--muted)',
                    color: fadeInSec === s ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {s === 0 ? '0s' : `${s}s`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 淡出时长 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>淡出时长 (Fade Out)</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--foreground)' }}>
              {fadeOutSec}s
            </span>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div className="ve-timeline-zoom" style={{ flex: 1, minWidth: 0 }}>
              <input
                id="env-fadeout"
                type="range"
                className="ve-timeline-range"
                min={0}
                max={maxFadeSec}
                step={0.05}
                value={fadeOutSec}
                onChange={(event) =>
                  apply({ fadeOutUs: Math.round(Number(event.target.value) * 1_000_000) })
                }
                aria-label="淡出时长"
                style={{
                  flex: 1,
                  minWidth: 0,
                  width: '100%',
                  ...timelineRangeFillStyle(fadeOutSec, 0, maxFadeSec),
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 2 }}>
              {FADE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => apply({ fadeOutUs: Math.round(s * 1_000_000) })}
                  style={{
                    padding: '1px 4px',
                    fontSize: 9,
                    background: fadeOutSec === s ? 'var(--primary)' : 'var(--muted)',
                    color: fadeOutSec === s ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    cursor: 'pointer',
                  }}
                >
                  {s === 0 ? '0s' : `${s}s`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
