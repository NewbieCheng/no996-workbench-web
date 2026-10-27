import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { Button } from '@no996/ui/button'

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

type Props = {
  audioUrl: string
  label?: string
  playbackFailed?: boolean
  onPlaybackError?: () => void
  className?: string
}

/** 任务中心 / 配音历史共用的紧凑试听条（与 wb-task-drawer-player 同套样式） */
export function VoiceCompactPlayer({
  audioUrl,
  label = '',
  playbackFailed = false,
  onPlaybackError,
  className,
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [audioUrl])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el || !audioUrl) return
    if (el.paused) void el.play()
    else el.pause()
  }

  const onSeek = (next: number) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(next)) return
    el.currentTime = next
    setCurrent(next)
  }

  const rootClass = ['wb-task-drawer-player', 'voice-compact-player', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="wb-task-drawer-player__play"
        aria-label={playing ? '暂停' : '播放'}
        disabled={!audioUrl || playbackFailed}
        onClick={togglePlay}
      >
        {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      </Button>
      {label ? (
        <span className="wb-task-drawer-player__label" title={label}>{label}</span>
      ) : null}
      <div className="wb-task-drawer-player__track-wrap">
        <input
          type="range"
          className="wb-task-drawer-player__track"
          min={0}
          max={duration || 1}
          step={0.1}
          value={current}
          disabled={!audioUrl || playbackFailed || duration <= 0}
          aria-label="播放进度"
          onChange={(e) => onSeek(Number(e.target.value))}
        />
      </div>
      <span className="wb-task-drawer-player__time" aria-live="polite">
        {formatClock(current)} / {formatClock(duration)}
      </span>
      {audioUrl ? (
        <audio
          ref={audioRef}
          className="wb-task-drawer-player__audio"
          src={audioUrl}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
          onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)}
          onError={onPlaybackError}
        />
      ) : null}
    </div>
  )
}
