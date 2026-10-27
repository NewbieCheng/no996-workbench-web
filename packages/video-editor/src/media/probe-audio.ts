/**
 * 探测音频时长（微秒）。
 *
 * 用 `<audio>` 的 metadata，不解码全部采样 —— 只为拿时长，没必要付解码代价。
 * 失败时回退到固定 3 秒，并在控制台留痕，便于排查是哪个文件有问题。
 */

export function probeAudioDuration(blob: Blob): Promise<number> {
  if (typeof document === 'undefined' || typeof Audio === 'undefined') {
    return Promise.resolve(3_000_000)
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const audio = new Audio()
    let settled = false

    const finish = (us: number) => {
      if (settled) return
      settled = true
      URL.revokeObjectURL(url)
      audio.onloadedmetadata = null
      audio.onerror = null
      resolve(us)
    }

    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      const seconds = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 3
      finish(Math.round(seconds * 1_000_000))
    }
    audio.onerror = () => {
      console.warn('音频元数据读取失败，按时长 3 秒处理')
      finish(3_000_000)
    }
    // 兜底超时：避免某些浏览器既不触发 metadata 也不触发 error
    setTimeout(() => finish(3_000_000), 8000)
    audio.src = url
  })
}

/** 探测视频 / 音频的通用媒体时长，供素材面板使用。 */
export function probeMediaDuration(blob: Blob): Promise<number> {
  if (blob.type.startsWith('video/') && typeof document !== 'undefined') {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const video = document.createElement('video')
      let settled = false
      const finish = (us: number) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(url)
        video.onloadedmetadata = null
        video.onerror = null
        resolve(us)
      }
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        const seconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3
        finish(Math.round(seconds * 1_000_000))
      }
      video.onerror = () => finish(3_000_000)
      setTimeout(() => finish(3_000_000), 8000)
      video.src = url
    })
  }
  return probeAudioDuration(blob)
}
