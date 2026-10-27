export type MediaMetadata = { duration: number; width: number; height: number }
export function readDigitalHumanMedia(blob: Blob | string, kind: 'video' | 'audio', signal?: AbortSignal): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    const media = document.createElement(kind)
    const local = typeof blob !== 'string'
    const url = local ? URL.createObjectURL(blob) : blob
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer); signal?.removeEventListener('abort', abort)
      const video = media as HTMLVideoElement
      const metadata = { duration: media.duration, width: video.videoWidth || 0, height: video.videoHeight || 0 }
      media.onloadedmetadata = null; media.onerror = null; media.removeAttribute('src'); media.load(); if (local) URL.revokeObjectURL(url)
      if (error) reject(error)
      else if (!Number.isFinite(metadata.duration) || metadata.duration <= 0) reject(new Error('无法读取实际时长，请更换标准格式素材'))
      else resolve(metadata)
    }
    const abort = () => finish(new DOMException('已取消', 'AbortError'))
    const timer = window.setTimeout(() => finish(new Error('媒体读取超时，请更换素材')), 15000)
    media.onloadedmetadata = () => finish()
    media.onerror = () => finish(new Error('浏览器无法解码素材，请使用 H.264 MP4 视频或 WAV / MP3 音频'))
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) { abort(); return }
    media.preload = 'metadata'; media.src = url
  })
}
export function validateDigitalHumanFile(file: File, kind: 'video' | 'audio' | 'ref_image'): void {
  const limits = { video: 200, audio: 30, ref_image: 10 }
  const extensions = { video: /\.(mp4|avi|mov)$/i, audio: /\.(wav|mp3|aac)$/i, ref_image: /\.(jpe?g|png|bmp|webp)$/i }
  if (!file.size || file.size > limits[kind] * 1024 * 1024) throw new Error(`文件须大于 0 且不超过 ${limits[kind]} MB`)
  if (!extensions[kind].test(file.name)) throw new Error('素材格式不支持，请按上传提示选择文件')
}
export function validateDigitalHumanDuration(duration: number, kind: 'video' | 'audio' = 'audio'): void {
  if (kind === 'video') {
    if (!Number.isFinite(duration) || duration < 10 || duration > 20) {
      throw new Error('人物视频的实际时长须在 10–20 秒左右，请先分段或裁剪')
    }
    return
  }
  if (!Number.isFinite(duration) || duration < 2 || duration > 120) {
    throw new Error('配音音频的实际时长须在 2–120 秒之间，请先分段或裁剪')
  }
}
export function validatePublicMediaUrl(raw: string): string {
  const url = new URL(raw)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hostname === 'localhost' || !url.hostname.includes('.') || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) || url.hostname.endsWith('.local')) throw new Error('请使用无需登录、上游可下载的公网 HTTP(S) 地址')
  return url.href
}
