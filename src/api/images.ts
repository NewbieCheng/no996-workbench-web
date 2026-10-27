/**
 * @file images.ts
 * 图像生成 API 封装
 *
 * 对接服务端 POST /api/v1/ai/images/generations（遵循标准文生图契约）。
 * 凭证统一由客户端注入，支持错误原因诚实透出。
 */
import { ensureAccessToken } from './client'
import { throwApiError } from './errors'

export type GenerateAiImagesParams = {
  prompt: string
  /** 比例尺寸：小红书建议 1024x1365，微信横版建议 1024x576 或 1024x1024 */
  size?: string
  n?: number
  /** 母本图片，用作 image-to-image 编辑参考。支持 URL 或 data URI。 */
  image?: string
  signal?: AbortSignal
}

export type GenerateAiImagesResult = {
  imageUrls: string[]
}

type RawImageItem = {
  url?: string
  b64_json?: string
}

type RawImageGenerationResponse = {
  data?: RawImageItem[]
  images?: string[]
  error?: { message?: string }
}

export async function generateAiImages(
  params: GenerateAiImagesParams,
): Promise<GenerateAiImagesResult> {
  const token = await ensureAccessToken()
  const payload: Record<string, unknown> = {
    prompt: params.prompt.trim(),
    size: params.size || '1024x1024',
    n: params.n && params.n > 0 ? params.n : 1,
  }
  if (params.image?.trim()) payload.image = params.image.trim()

  const res = await fetch('/api/v1/ai/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: params.signal,
  })

  if (!res.ok) {
    await throwApiError(res)
  }

  const json = (await res.json()) as RawImageGenerationResponse
  const urls: string[] = []

  if (Array.isArray(json.data)) {
    for (const item of json.data) {
      if (item.url) {
        urls.push(item.url)
      } else if (item.b64_json) {
        urls.push(`data:image/png;base64,${item.b64_json}`)
      }
    }
  } else if (Array.isArray(json.images)) {
    urls.push(...json.images)
  }

  if (urls.length === 0) {
    throw new Error('未接收到生成的有效图像链接，请检查图像提供商服务状态')
  }

  return { imageUrls: urls }
}
