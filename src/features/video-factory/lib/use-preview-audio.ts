/**
 * 预览音频同步 Hook
 *
 * 把混音结果接到播放头上：播放时从当前播放头出声，暂停时停止，拖动时重启动。
 *
 * 关键约束：混音是异步且较重的（要解码全部音频），因此只在
 * 「工程音频变化」或「首次播放」时重混一次，而不是每次播放都重来。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { EditorDocument } from '@no996/video-editor'
import { AudioMixPlayback, mixDocumentAudio } from '@no996/video-editor'
import { buildPreviewAudioSignature } from './preview-audio-signature.ts'

export type UsePreviewAudioResult = {
  /** 是否已经准备好可播放的音频 */
  ready: boolean
  /** 混音是否在进行 */
  mixing: boolean
  /** 最近一次混音错误 */
  error: string
  /** 混音结果变化计数，用于让调用方决定是否重混 */
  refresh: () => void
}

export function usePreviewAudio(input: {
  doc: EditorDocument | null
  isPlaying: boolean
  playheadUs: number
  resolveBlob: (assetId: string) => Promise<Blob | null> | null
  /** 关闭时不做任何事（IP 页已有自己的音频链路） */
  enabled?: boolean
}): UsePreviewAudioResult {
  const { doc, isPlaying, playheadUs, resolveBlob, enabled = true } = input
  const playbackRef = useRef<AudioMixPlayback | null>(null)
  const [ready, setReady] = useState(false)
  const [mixing, setMixing] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  /** 首次播放前不混音：整轨解码很重，页面刚打开就被它堵住会显得「卡死」 */
  const [armed, setArmed] = useState(false)
  /** 已混音对应的音频签名，避免每帧重混 */
  const mixedSignature = useRef('')
  /** 播放头最新值：启动 / 纠偏时读，不进播放状态 effect 的依赖 */
  const playheadRef = useRef(playheadUs)
  playheadRef.current = playheadUs

  const refresh = useCallback(() => setVersion((prev) => prev + 1), [])

  const signature = buildPreviewAudioSignature(doc)

  useEffect(() => {
    if (isPlaying && !armed) setArmed(true)
  }, [isPlaying, armed])

  useEffect(() => {
    if (!enabled || !doc || !armed) return
    if (!playbackRef.current) playbackRef.current = new AudioMixPlayback()

    // 签名未变且已混过，跳过（含空签名：混过一次后 mixedSignature 也为 ''）
    if (signature === mixedSignature.current) return

    let cancelled = false
    setMixing(true)
    setReady(false)
    setError('')

    void (async () => {
      try {
        if (!signature) {
          // 没有任何音频元素：清空播放器即可
          await playbackRef.current!.load(null)
          if (cancelled) return
          mixedSignature.current = ''
          setReady(false)
          return
        }

        const pcm = await mixDocumentAudio(doc, async (assetId) => resolveBlob(assetId), {
          // 预览不需要导出级采样率，降一档能少三分之一内存与拷贝耗时
          sampleRate: 32000,
        })
        if (cancelled) return
        await playbackRef.current!.load(pcm)
        if (cancelled) return
        mixedSignature.current = signature
        setReady(true)
      } catch (mixError) {
        if (cancelled) return
        setError(mixError instanceof Error ? mixError.message : String(mixError))
        setReady(false)
      } finally {
        if (!cancelled) setMixing(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // version 用于手动触发重混
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, doc, signature, version, armed])

  // 播放 / 暂停
  useEffect(() => {
    if (!enabled || !playbackRef.current) return
    if (isPlaying && ready) {
      // 混音是异步的：先点播放、后面才 ready 时也要从当前播放头出声。
      // 之前依赖里没有 ready，这一路会漏掉，表现为「有画面没声音」。
      playbackRef.current.play(playheadRef.current)
    } else {
      playbackRef.current.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isPlaying, ready])

  // 拖动播放头时若正在播放，需要从新位置重启；播放中则只在大幅漂移时纠偏
  const lastSeekRef = useRef(playheadUs)
  useEffect(() => {
    if (!enabled || !isPlaying) {
      lastSeekRef.current = playheadUs
      return
    }
    // 播放中播放头持续前进属正常，只有用户大幅跳转才重启
    const jump = Math.abs(playheadUs - lastSeekRef.current)
    if (jump > 600_000) {
      playbackRef.current?.seek(playheadUs, true)
    } else if (ready) {
      // 音画各走各的时钟，几十毫秒的漂移可以忽略，超过 0.26s 才重新对齐
      const audioUs = playbackRef.current?.currentUs() ?? 0
      if (audioUs > 0 && Math.abs(playheadUs - audioUs) > 260_000) {
        playbackRef.current?.seek(playheadUs, true)
      }
    }
    lastSeekRef.current = playheadUs
  }, [enabled, isPlaying, ready, playheadUs])

  useEffect(() => {
    return () => {
      playbackRef.current?.dispose()
      playbackRef.current = null
    }
  }, [])

  return { ready, mixing, error, refresh }
}
