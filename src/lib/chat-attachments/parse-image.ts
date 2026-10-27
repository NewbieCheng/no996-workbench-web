import { IMAGE_LIMITS, PROMPT_IMAGE_MEDIA_TYPES } from './constants'

export function isPromptImageMime(mime: string): boolean {
  return (PROMPT_IMAGE_MEDIA_TYPES as readonly string[]).includes(mime)
}

export async function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('读取图片失败'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

export function validateImageBatch(files: File[]): void {
  const allowed = PROMPT_IMAGE_MEDIA_TYPES as readonly string[]
  const images = files.filter((f) => allowed.includes(f.type))
  if (images.length === 0) return
  if (images.length > IMAGE_LIMITS.maxImagesPerMessage) {
    throw new Error(`单条消息最多 ${IMAGE_LIMITS.maxImagesPerMessage} 张图片`)
  }
  if (images.some((f) => f.size > IMAGE_LIMITS.maxImageBytes)) {
    throw new Error('单张图片不能超过 32 MiB')
  }
  const total = images.reduce((s, f) => s + f.size, 0)
  if (total > IMAGE_LIMITS.maxMessageImageBytes) {
    throw new Error('本条消息图片总大小不能超过 100 MiB')
  }
}
