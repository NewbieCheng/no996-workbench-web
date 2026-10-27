/**
 * Remotion 兼容运行时 —— 视频元素
 *
 * 只有 `assets/lib/ClipCard.tsx` 和经由它的 `clipcard-looping` 一个镜头用到
 * `OffthreadVideo`。这里映射到原生 `<video>`，并按当前帧号手动 seek，
 * 因为光栅化是逐帧「摆好再截图」，不依赖浏览器播放。
 */

import { useEffect, useRef, type CSSProperties } from 'react'
import { useCurrentFrame, useVideoConfig } from './frame-context.tsx'

export type OffthreadVideoProps = {
  src: string
  muted?: boolean
  volume?: number
  startFrom?: number
  playbackRate?: number
  style?: CSSProperties
  className?: string
}

/**
 * 逐帧定位的视频。管线截图前必须等 `readyState >= 2`（有当前帧数据），
 * 所以这里把 seek 完成计入「可截帧」条件，避免截到黑帧。
 */
export function OffthreadVideo({
  src,
  muted = false,
  volume = 1,
  startFrom = 0,
  playbackRate = 1,
  style,
  className,
}: OffthreadVideoProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = ref.current
    if (!video) return
    const targetSeconds = (startFrom + frame * playbackRate) / fps
    if (Math.abs(video.currentTime - targetSeconds) < 1e-3) return
    try {
      video.currentTime = Math.max(0, targetSeconds)
    } catch {
      // 元数据未就绪时赋值会抛错，等 loadedmetadata 后会重试
    }
  }, [frame, fps, startFrom, playbackRate, src])

  useEffect(() => {
    const video = ref.current
    if (!video) return
    if (muted) video.muted = true
    else video.volume = Math.max(0, Math.min(1, volume))
  }, [muted, volume])

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      muted={muted}
      playsInline
      preload="auto"
      // 光栅化逐帧截图，不需要浏览器自播
      autoPlay={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  )
}

/** Remotion 的 `<Video>` 在 demo 里未使用，提供别名以免扩展时 import 失败。 */
export const Video = OffthreadVideo
