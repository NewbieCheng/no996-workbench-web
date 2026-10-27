/**
 * 多轨混音台面板 (AudioMixerPanel)
 */

import React, { useState, useEffect } from 'react'
import type { EditorInstance } from '../../core/instance.ts'
import { SetTrackPropertiesCommand } from '../../core/commands/track-commands.ts'

export type AudioMixerPanelProps = {
  editor: EditorInstance
  style?: React.CSSProperties
  className?: string
}

export function AudioMixerPanel({
  editor,
  style,
  className,
}: AudioMixerPanelProps) {
  const [doc, setDoc] = useState(() => editor.getDocument())

  useEffect(() => {
    return editor.subscribe(() => {
      setDoc(editor.getDocument())
    })
  }, [editor])

  const audioTracks = doc.tracks.filter((t) => t.type === 'audio' || t.type === 'video')

  const toggleMute = (trackId: string, currentMuted: boolean) => {
    editor.executeCommand(new SetTrackPropertiesCommand(trackId, { muted: !currentMuted }))
  }

  const toggleSolo = (trackId: string, currentSolo?: boolean) => {
    editor.executeCommand(new SetTrackPropertiesCommand(trackId, { solo: !currentSolo }))
  }

  return (
    <div
      className={className}
      data-testid="audio-mixer-panel"
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
      <div style={{ fontWeight: 600, fontSize: 13 }}>多轨混音台</div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {audioTracks.map((track) => (
          <div
            key={track.id}
            style={{
              width: 90,
              background: 'var(--muted)',
              border: `1px solid ${track.solo ? '#f59e0b' : 'var(--border)'}`,
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                width: '100%',
                textAlign: 'center',
              }}
              title={track.name}
            >
              {track.name}
            </span>

            {/* 静音 M 与独奏 S 按钮 */}
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                type="button"
                onClick={() => toggleMute(track.id, track.muted)}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  borderRadius: 4,
                  border: `1px solid ${track.muted ? '#dc2626' : 'var(--border)'}`,
                  background: track.muted ? '#ef4444' : 'var(--card)',
                  color: track.muted ? '#fff' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title={track.muted ? '取消静音' : '静音'}
              >
                M
              </button>

              <button
                type="button"
                onClick={() => toggleSolo(track.id, track.solo)}
                style={{
                  padding: '2px 6px',
                  fontSize: 10,
                  borderRadius: 4,
                  border: `1px solid ${track.solo ? '#d97706' : 'var(--border)'}`,
                  background: track.solo ? '#f59e0b' : 'var(--card)',
                  color: track.solo ? '#fff' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
                title={track.solo ? '取消独奏' : '独奏'}
              >
                S
              </button>
            </div>

            {/* 虚拟推子柱状视觉 */}
            <div
              style={{
                width: 14,
                height: 100,
                background: 'var(--border)',
                borderRadius: 7,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: 2,
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: track.muted ? '0%' : '75%',
                  background: track.solo ? '#eab308' : '#10b981',
                  borderRadius: 5,
                }}
              />
            </div>

            <span style={{ fontSize: 10, color: '#8b949e' }}>
              {track.muted ? '已静音' : track.solo ? '独奏中' : '0.0 dB'}
            </span>
          </div>
        ))}

        {/* Master 总输出总线 */}
        <div
          style={{
            width: 90,
            background: '#1c1917',
            border: '1px solid #78350f',
            borderRadius: 6,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 'bold', color: '#f59e0b' }}>Master 总线</span>
          <span style={{ fontSize: 10, color: '#a8a29e' }}>软限幅 ON</span>
          <div
            style={{
              width: 14,
              height: 100,
              background: '#0c0a09',
              borderRadius: 7,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              padding: 2,
            }}
          >
            <div style={{ width: '100%', height: '82%', background: '#f59e0b', borderRadius: 5 }} />
          </div>
          <span style={{ fontSize: 10, color: '#f59e0b' }}>峰值保护</span>
        </div>
      </div>
    </div>
  )
}
