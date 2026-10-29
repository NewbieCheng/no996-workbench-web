/**
 * Client-side video concatenator for completed Digital Human segments.
 * Uses MediaRecorder with synchronous frame stepping and Web Audio track routing.
 */

import { VideoExportDiagnosticError } from '../../../../packages/video-editor/src/core/export/export-diagnostics.ts'

export type ConcatSegmentItem = {
  id: string
  blob: Blob
  duration: number
  width: number
  height: number
}

function supportedVideoMime(): string {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E',
  ]
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime
    }
  }
  return ''
}

export async function concatVideoBlobs(
  items: ConcatSegmentItem[],
  options?: {
    signal?: AbortSignal
    onProgress?: (percent: number, currentSegmentIndex: number) => void
  },
): Promise<Blob> {
  if (!items.length) throw new Error('没有可合并的成片段落。')
  if (items.length === 1) {
    if (!items[0].blob.type.toLowerCase().startsWith('video/mp4')) {
      throw new VideoExportDiagnosticError(
        '该段原始视频不是可确认的 MP4，当前不能作为微信兼容成片直接导出。请使用 MP4 源文件或重新生成该段。',
        { module: '数字人', composition: '单段直返格式检查', width: items[0].width, height: items[0].height, hasAudio: undefined, stage: '源文件格式检查', attempts: [{ strategy: `源 MIME ${items[0].blob.type || 'unknown'}`, result: 'unsupported' }] },
      )
    }
    return items[0].blob
  }

  const mime = supportedVideoMime()
  if (!mime || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    throw new VideoExportDiagnosticError(
      '当前浏览器没有可用的 MP4/H.264 MediaRecorder 拼接能力。',
      { module: '数字人', composition: '多段视频合并', width: items[0].width || 1080, height: items[0].height || 1920, fps: 30, videoBitrate: 6_000_000, audioBitrate: 128_000, hasAudio: true, stage: '编码能力预检', attempts: [{ strategy: 'MediaRecorder MP4/H.264/AAC', result: 'unsupported' }] },
    )
  }

  const targetWidth = items[0].width || 1080
  const targetHeight = items[0].height || 1920
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('初始化视频画布失败。')

  const audioCtx = new AudioContext()
  await audioCtx.resume()
  const audioDestination = audioCtx.createMediaStreamDestination()

  const videoStream = canvas.captureStream(30)
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...audioDestination.stream.getAudioTracks(),
  ])

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
    audioBitsPerSecond: 128_000,
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const totalDuration = items.reduce((sum, item) => sum + Math.max(0.1, item.duration), 0)

  return new Promise<Blob>((resolve, reject) => {
    let settled = false
    let currentVideoEl: HTMLVideoElement | null = null
    let currentSourceNode: MediaElementAudioSourceNode | null = null

    const cleanup = () => {
      if (currentVideoEl) {
        currentVideoEl.pause()
        currentVideoEl.removeAttribute('src')
        currentVideoEl.load()
      }
      try {
        currentSourceNode?.disconnect()
      } catch {
        // ignore
      }
      for (const track of combinedStream.getTracks()) track.stop()
      void audioCtx.close().catch(() => undefined)
    }

    const fail = (err: Error) => {
      if (settled) return
      settled = true
      cleanup()
      if (recorder.state !== 'inactive') recorder.stop()
      reject(err instanceof DOMException && err.name === 'AbortError' ? err : new VideoExportDiagnosticError(
        err.message,
        { module: '数字人', composition: '多段视频合并', width: targetWidth, height: targetHeight, fps: 30, videoBitrate: 6_000_000, audioBitrate: 128_000, hasAudio: true, stage: '浏览器解码或 MP4 拼接', attempts: [{ strategy: `MediaRecorder ${mime}`, result: 'failed', error: err.message.slice(0, 300) }] },
        err,
      ))
    }

    const abort = () => fail(new DOMException('拼接已取消', 'AbortError'))
    options?.signal?.addEventListener('abort', abort, { once: true })

    recorder.onerror = () => fail(new Error('录制编码失败'))
    recorder.onstop = () => {
      if (settled) return
      settled = true
      cleanup()
      if (chunks.length) {
        resolve(new Blob(chunks, { type: recorder.mimeType || mime }))
      } else {
        reject(new Error('视频合并产物为空'))
      }
    }

    recorder.start(500)

    let elapsedSoFar = 0

    const playNext = (index: number) => {
      if (options?.signal?.aborted) return abort()
      if (index >= items.length) {
        // finished
        window.setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop()
        }, 200)
        return
      }

      const item = items[index]
      const video = document.createElement('video')
      currentVideoEl = video
      video.muted = false
      video.playsInline = true
      video.crossOrigin = 'anonymous'
      const blobUrl = URL.createObjectURL(item.blob)
      video.src = blobUrl

      let animId: number

      const drawLoop = () => {
        if (options?.signal?.aborted) return abort()
        if (video.paused || video.ended) return
        ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
        const currentItemElapsed = video.currentTime || 0
        const totalProgress = Math.min(99, ((elapsedSoFar + currentItemElapsed) / totalDuration) * 100)
        options?.onProgress?.(totalProgress, index)
        animId = requestAnimationFrame(drawLoop)
      }

      video.onloadedmetadata = () => {
        try {
          currentSourceNode = audioCtx.createMediaElementSource(video)
          currentSourceNode.connect(audioDestination)
        } catch {
          // If already connected or restricted, continue
        }

        void video.play().then(() => {
          animId = requestAnimationFrame(drawLoop)
        }).catch(err => {
          URL.revokeObjectURL(blobUrl)
          fail(new Error(`第 ${index + 1} 段视频播放受限：${err?.message || '未知错误'}`))
        })
      }

      video.onended = () => {
        cancelAnimationFrame(animId)
        URL.revokeObjectURL(blobUrl)
        elapsedSoFar += Math.max(0.1, item.duration)
        try {
          currentSourceNode?.disconnect()
        } catch {
          // ignore
        }
        playNext(index + 1)
      }

      video.onerror = () => {
        cancelAnimationFrame(animId)
        URL.revokeObjectURL(blobUrl)
        fail(new Error(`第 ${index + 1} 段成片无法解码`))
      }
    }

    playNext(0)
  })
}
