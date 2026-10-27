import { useMemo } from 'react'
import type { VoiceDubSegment } from '../agent/types'

export const RIBBON_COLORS = [
  '#ff9a62',
  '#f2677a',
  '#f0b13f',
  '#b67be0',
  '#4fb5a3',
  '#6c8cf0',
  '#3b82f6',
  '#10b981',
]

type Props = {
  mode: 'plan' | 'confirm' | 'tts' | 'done'
  segments: VoiceDubSegment[]
  currentTime?: number
  totalDuration?: number
  hoveredIndex?: number | null
  onHoverIndex?: (index: number | null) => void
  onSeekToSegment?: (segmentIndex: number) => void
}

export function VoiceRibbon({
  mode,
  segments,
  currentTime = 0,
  totalDuration = 0,
  hoveredIndex = null,
  onHoverIndex,
  onSeekToSegment,
}: Props) {
  // Precompute deterministic wave heights for each segment
  const segmentWaves = useMemo(() => {
    return segments.map((seg, i) => {
      const barCount = Math.max(12, Math.min(36, (seg.estimatedSeconds ?? 6) * 4))
      return Array.from({ length: barCount }, (_, k) =>
        Math.round(20 + Math.abs(Math.sin(k * 0.8 + i) * Math.cos(k * 0.31)) * 80),
      )
    })
  }, [segments])

  const effectiveTotal =
    totalDuration > 0
      ? totalDuration
      : segments.reduce((acc, s) => acc + (s.estimatedSeconds ?? 5), 0)

  const playheadPercent = effectiveTotal > 0 ? Math.min(100, (currentTime / effectiveTotal) * 100) : 0

  return (
    <div
      className={`voice-ribbon ${hoveredIndex != null ? 'has-hover' : ''}`}
      data-m={mode}
      onMouseLeave={() => onHoverIndex?.(null)}
    >
      {/* 激光切割扫描线（拆段中） */}
      {mode === 'plan' ? <div className="voice-ribbon-laser" aria-hidden /> : null}

      {/* 播放头指针（完成且播放中） */}
      {mode === 'done' && effectiveTotal > 0 ? (
        <div
          className="voice-ribbon-ph"
          style={{ left: `${playheadPercent}%` }}
          aria-hidden
        />
      ) : null}

      {/* 分段色块 */}
      {segments.map((seg, i) => {
        const color = RIBBON_COLORS[i % RIBBON_COLORS.length]
        const duration = seg.estimatedSeconds ?? 5
        const isHovered = hoveredIndex === i
        const waves = segmentWaves[i] ?? []
        const isSynthesized = seg.status === 'done' || mode === 'done'
        const isRunning = seg.status === 'running' || (mode === 'tts' && seg.status !== 'done')

        return (
          <button
            key={seg.id || i}
            type="button"
            className={`voice-clip ${isHovered ? 'is-highlighted' : ''}`}
            data-s={isSynthesized ? 'd' : isRunning ? 'r' : 'w'}
            style={
              {
                '--d': duration,
                '--c': color,
              } as React.CSSProperties
            }
            onMouseEnter={() => onHoverIndex?.(i)}
            onClick={() => onSeekToSegment?.(i)}
            title={`${seg.title}（约 ${duration} 秒）`}
          >
            <span className="voice-clip-title">{seg.title}</span>
            <div className="voice-clip-waveform" aria-hidden>
              {waves.map((h, k) => (
                <i
                  key={k}
                  style={
                    {
                      '--h': `${h}%`,
                      '--k': k,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </button>
        )
      })}
    </div>
  )
}
