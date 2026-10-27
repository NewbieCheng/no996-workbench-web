import { useEffect, useRef, useState } from 'react'
import { Download, Info, LoaderCircle, Pause, Play, Trash2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@no996/ui/button'
export type MonitorVideoToolbar = {
  onDownload?: () => void
  downloadLabel?: string
  onDelete?: () => void
  deleteLabel?: string
  retentionHint?: string
  hintOpen?: boolean
  onToggleHint?: () => void
  showHintDot?: boolean
  disabled?: boolean
}

function formatSec(s: number) {
  if (!Number.isFinite(s) || s < 0) return '00:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

type MonitorStudioVideoPlayerProps = {
  /** Legacy single-source callers can continue to use src. */
  src?: string
  sourceVideoUrl?: string
  videoUrl?: string
  localVideoUrl?: string
  label: string
  loop?: boolean
  toolbar?: MonitorVideoToolbar
}

import { resolveFallbackSources } from './lib/video-sources'
export { resolveFallbackSources } from './lib/video-sources'

export function MonitorStudioVideoPlayer({ src, sourceVideoUrl, videoUrl, localVideoUrl, ...props }: MonitorStudioVideoPlayerProps) {
  const sources = resolveFallbackSources({ src, sourceVideoUrl, videoUrl, localVideoUrl })
  return <MonitorStudioVideoPlayerContent key={JSON.stringify(sources)} sources={sources} {...props} />
}

function MonitorStudioVideoPlayerContent({
  sources,
  label,
  loop = false,
  toolbar,
}: {
  sources: string[]
  label: string
  loop?: boolean
  toolbar?: MonitorVideoToolbar
}) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const src = sources[sourceIndex]
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [controlsOpen, setControlsOpen] = useState(false)
  const [loadError, setLoadError] = useState(!src)
  const [loading, setLoading] = useState(Boolean(src))

  const syncDurationFromVideo = () => {
    const el = videoRef.current
    if (!el) return
    const d = el.duration
    if (Number.isFinite(d) && d > 0) setTotalDuration(d)
  }

  useEffect(() => {
    setLoadError(!src)
    setLoading(Boolean(src))
    setPlaying(false)
    setCurrentTime(0)
    setTotalDuration(0)
    setControlsOpen(false)
  }, [src])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted
  }, [muted, src])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (playing) el.pause()
    else void el.play().catch(() => setPlaying(false))
  }

  const handleSeek = (value: number) => {
    const el = videoRef.current
    if (!el) return
    el.currentTime = value
    setCurrentTime(value)
  }

  const toggleMute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = !muted
    setMuted(!muted)
  }

  const progressPct = totalDuration > 0 ? Math.min(100, Math.max(0, (currentTime / totalDuration) * 100)) : 0

  return (
    <div
      className="dh-monitor-video"
      aria-label={label}
      data-controls-open={controlsOpen ? 'true' : 'false'}
      onPointerLeave={() => setControlsOpen(false)}
    >
      <div className="dh-monitor-video__stage">
        <video
          ref={videoRef}
          key={src}
          className="dh-monitor-video__media"
          src={src}
          playsInline
          preload="auto"
          loop={loop}
          onClick={togglePlay}
          onError={() => {
            if (sourceIndex + 1 < sources.length) setSourceIndex(sourceIndex + 1)
            else { setLoading(false); setLoadError(true) }
          }}
          onWaiting={() => setLoading(true)}
          onTimeUpdate={() => {
            const el = videoRef.current
            if (!el) return
            setCurrentTime(el.currentTime)
            syncDurationFromVideo()
          }}
          onLoadedMetadata={() => syncDurationFromVideo()}
          onDurationChange={() => syncDurationFromVideo()}
          onLoadedData={() => syncDurationFromVideo()}
          onCanPlay={() => { setLoading(false); syncDurationFromVideo() }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />

        {loading && !loadError && (
          <div role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', color: '#fff', background: 'rgba(0,0,0,.55)', pointerEvents: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><LoaderCircle className="animate-spin" size={18} aria-hidden />正在加载视频预览…</span>
          </div>
        )}
        {loadError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0, 0, 0, 0.75)',
              color: '#fff',
              fontSize: 12,
              padding: 16,
              textAlign: 'center',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
              资源暂时无法播放
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              所有已知成片来源加载未果（可能网络异常或资源已失效），请检查网络或稍后刷新
            </span>
          </div>
        )}

        <div
          className="dh-monitor-video__chrome"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          onPointerEnter={() => setControlsOpen(true)}
          onFocus={() => setControlsOpen(true)}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="dh-monitor-video__play"
            onClick={togglePlay}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
          </Button>
          <span className="dh-monitor-video__time">
            {formatSec(currentTime)} / {formatSec(totalDuration)}
          </span>
          <div className="dh-monitor-video__seek">
            <div className="dh-monitor-video__seek-fill" style={{ width: `${progressPct}%` }} />
            <input
              type="range"
              min={0}
              max={totalDuration || 1}
              step={0.1}
              value={currentTime}
              onChange={e => handleSeek(Number(e.target.value))}
              onInput={e => handleSeek(Number(e.currentTarget.value))}
              className="dh-monitor-video__seek-input"
              aria-label="播放进度"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="dh-monitor-video__mute"
            onClick={toggleMute}
            aria-label={muted ? '取消静音' : '静音'}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </Button>
          {toolbar?.onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="dh-monitor-video__delete"
              disabled={toolbar.disabled}
              aria-label={toolbar.deleteLabel ?? '删除成片'}
              onClick={e => {
                e.stopPropagation()
                toolbar.onDelete?.()
              }}
            >
              <Trash2 size={15} aria-hidden />
            </Button>
          ) : null}
          {toolbar?.onDownload ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="dh-monitor-video__download"
              disabled={toolbar.disabled}
              aria-label={toolbar.downloadLabel ?? '下载'}
              title={toolbar.downloadLabel ?? '下载'}
              onClick={e => {
                e.stopPropagation()
                toolbar.onDownload?.()
              }}
            >
              <Download size={15} aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      {toolbar?.retentionHint ? (
        <div className="dh-monitor-video__toolbar-top">
          <div className="dh-monitor-video__hint-wrap">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={toolbar.showHintDot ? 'dh-monitor-video__hint-btn dh-monitor-video__hint-btn--alert' : 'dh-monitor-video__hint-btn'}
              aria-expanded={toolbar.hintOpen}
              aria-label="成片保留说明"
              onClick={e => {
                e.stopPropagation()
                toolbar.onToggleHint?.()
              }}
            >
              <Info size={15} aria-hidden />
              {toolbar.showHintDot ? <span className="dh-monitor-video__hint-dot" aria-hidden /> : null}
            </Button>
            {toolbar.hintOpen ? (
              <div className="dh-monitor-video__hint-popover" role="tooltip" onClick={e => e.stopPropagation()}>
                {toolbar.retentionHint}
                {sources.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: 10, wordBreak: 'break-all' }}>
                    <p style={{ opacity: 0.8, marginBottom: 2 }}>历史备份地址（点击复制）：</p>
                    {sources.map((item, idx) => (
                      <div
                        key={item}
                        style={{ cursor: 'pointer', color: '#60a5fa', textDecoration: 'underline', marginBottom: 2 }}
                        onClick={() => {
                          void navigator.clipboard.writeText(item)
                        }}
                        title="点击复制原始媒体链接"
                      >
                        [来源 {idx + 1}] {item.startsWith('blob:') ? '本机缓存视频' : item.split('?')[0]}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
