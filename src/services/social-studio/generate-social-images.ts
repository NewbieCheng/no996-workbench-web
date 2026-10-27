import type { StoredChatAttachment } from '../../lib/chat-attachments/prepare'
import { extensionClient } from '../extension/extension-client'
import { generateAiImages } from '../../api/images'

const MAX_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_REFERENCE_IMAGE_EDGE = 2048

type PlannedImageOverlay = {
  titleText: string
  supportingText: string
  badgeText?: string
  accentColor?: string
}

export type SocialImagePromptInput = {
  title: string
  visualDescriptions?: string[]
  style?: string
  count: number
}

export function buildSocialImagePrompts(input: SocialImagePromptInput): string[] {
  const title = input.title.trim()
  if (!title) return []
  const style = input.style?.trim() || 'high quality editorial photography, clean composition'
  const prompts = [`${title}, ${style}`]
  for (const description of input.visualDescriptions ?? []) {
    const visual = description.trim()
    if (!visual || prompts.length >= Math.max(1, input.count)) continue
    prompts.push(`${title}, ${visual}, ${style}`)
  }
  return prompts
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('读取参考图片失败'))
    reader.onerror = () => reject(reader.error ?? new Error('读取参考图片失败'))
    reader.readAsDataURL(blob)
  })
}

async function compactReferenceBlob(source: Blob): Promise<Blob> {
  if (source.size <= MAX_REFERENCE_IMAGE_BYTES) return source
  if (typeof createImageBitmap !== 'function') throw new Error('参考图片超过 10 MB，当前浏览器无法压缩，请换一张较小图片。')
  const bitmap = await createImageBitmap(source)
  try {
    const scale = Math.min(1, MAX_REFERENCE_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法处理参考图片，请换一张图片重试。')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('参考图片压缩失败')), 'image/jpeg', 0.84)
    })
    if (compressed.size > MAX_REFERENCE_IMAGE_BYTES) throw new Error('参考图片压缩后仍超过 10 MB，请换一张较小图片。')
    return compressed
  } finally {
    bitmap.close()
  }
}

/** Prepare a captured/local image for the vision model and image-to-image endpoint. */
export async function prepareSocialImageReference(source: string): Promise<string> {
  const value = source.trim()
  if (!value) throw new Error('缺少参考图片。')
  if (value.startsWith('data:image/')) {
    const response = await fetch(value)
    if (!response.ok) throw new Error('参考图片无法读取，请重新采集或上传。')
    return blobToDataUri(await compactReferenceBlob(await response.blob()))
  }
  if (/^blob:/i.test(value)) {
    const response = await fetch(value)
    if (!response.ok) throw new Error('本地参考图片已失效，请重新选择。')
    return blobToDataUri(await compactReferenceBlob(await response.blob()))
  }

  let url: URL
  try { url = new URL(value) } catch { throw new Error('参考图片地址无效，请重新采集或上传。') }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('参考图片必须是图片地址或本地图片。')
  // Try the extension first for sites that block direct provider access; if unavailable, pass the URL.
  try {
    const { blob } = await extensionClient.fetchAsset(url.href)
    return blobToDataUri(await compactReferenceBlob(blob))
  } catch {
    return url.href
  }
}

export async function prepareSocialImageAttachments(urls: readonly string[], limit = 4): Promise<StoredChatAttachment[]> {
  const selected = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, limit)
  const attachments: StoredChatAttachment[] = []
  for (let index = 0; index < selected.length; index += 1) {
    const dataUri = await prepareSocialImageReference(selected[index])
    const mimeType = dataUri.startsWith('data:') ? dataUri.slice(5, dataUri.indexOf(';')) : 'image/jpeg'
    attachments.push({ kind: 'image', name: `参考图片 ${index + 1}`, mimeType, dataUri })
  }
  return attachments
}

export async function generateSocialImages(input: {
  prompts: string[]
  size: string
  nPerPrompt?: number
  referenceImages?: readonly string[]
  signal?: AbortSignal
  onFailure?: (error: unknown, index: number) => void
}): Promise<string[]> {
  const results: string[] = []
  for (let index = 0; index < input.prompts.length; index += 1) {
    try {
      const reference = input.referenceImages?.[index] || input.referenceImages?.[0]
      const response = await generateAiImages({
        prompt: input.prompts[index],
        size: input.size,
        n: input.nPerPrompt ?? 1,
        image: reference,
        signal: input.signal,
      })
      results.push(...response.imageUrls)
    } catch (error) {
      if (input.signal?.aborted) throw error
      input.onFailure?.(error, index)
    }
  }
  return results
}

export async function generateSocialImageCards(input: {
  items: Array<{
    prompt: string
    size: string
    referenceImage?: string
    overlay: PlannedImageOverlay
    outputSize: { width: number; height: number }
  }>
  signal?: AbortSignal
  onFailure?: (error: unknown, index: number) => void
}): Promise<Array<string | undefined>> {
  const results: Array<string | undefined> = []
  for (let index = 0; index < input.items.length; index += 1) {
    const item = input.items[index]
    try {
      const response = await generateAiImages({ prompt: item.prompt, size: item.size, n: 1, image: item.referenceImage, signal: input.signal })
      const imageUrl = response.imageUrls[0]
      results.push(imageUrl ? await composeSocialImageCard({ imageUrl, overlay: item.overlay, size: item.outputSize }) : undefined)
    } catch (error) {
      if (input.signal?.aborted) throw error
      input.onFailure?.(error, index)
      results.push(undefined)
    }
  }
  return results
}

/** Compose exact planned typography over generated artwork so the final image has legible copy. */
export async function composeSocialImageCard(input: {
  imageUrl: string
  overlay: PlannedImageOverlay
  size: { width: number; height: number }
}): Promise<string> {
  const image = await loadImage(input.imageUrl)
  const { width, height } = input.size
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法排版配图文字，请重试。')
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawnWidth = image.naturalWidth * scale
  const drawnHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight)

  const accent = /^#[0-9a-f]{6}$/i.test(input.overlay.accentColor ?? '') ? input.overlay.accentColor! : '#bf5d3b'
  const top = Math.round(height * 0.65)
  const gradient = context.createLinearGradient(0, top, 0, height)
  gradient.addColorStop(0, 'rgba(17, 20, 22, 0)')
  gradient.addColorStop(0.3, 'rgba(17, 20, 22, 0.70)')
  gradient.addColorStop(1, 'rgba(17, 20, 22, 0.92)')
  context.fillStyle = gradient
  context.fillRect(0, top, width, height - top)

  const pad = Math.round(width * 0.075)
  let cursorY = Math.round(height * 0.76)
  const badge = input.overlay.badgeText?.trim()
  if (badge) {
    context.font = `600 ${Math.round(width * 0.027)}px system-ui, sans-serif`
    const badgeWidth = context.measureText(badge).width + pad * 0.7
    const badgeHeight = Math.round(width * 0.065)
    context.fillStyle = accent
    roundedRect(context, pad, cursorY - badgeHeight, badgeWidth, badgeHeight, badgeHeight / 2)
    context.fill()
    context.fillStyle = '#ffffff'
    context.textBaseline = 'middle'
    context.fillText(badge, pad + pad * 0.35, cursorY - badgeHeight / 2)
    cursorY += Math.round(height * 0.02)
  }

  context.textBaseline = 'top'
  context.fillStyle = '#ffffff'
  context.font = `800 ${Math.round(width * 0.066)}px system-ui, sans-serif`
  const titleLines = wrapText(context, input.overlay.titleText.trim(), width - pad * 2, 2)
  const titleLineHeight = Math.round(width * 0.083)
  for (const line of titleLines) {
    context.fillText(line, pad, cursorY, width - pad * 2)
    cursorY += titleLineHeight
  }
  const supporting = input.overlay.supportingText.trim()
  if (supporting) {
    cursorY += Math.round(height * 0.012)
    context.font = `500 ${Math.round(width * 0.034)}px system-ui, sans-serif`
    context.fillStyle = 'rgba(255,255,255,0.92)'
    for (const line of wrapText(context, supporting, width - pad * 2, 2)) {
      context.fillText(line, pad, cursorY, width - pad * 2)
      cursorY += Math.round(width * 0.05)
    }
  }
  try {
    return canvas.toDataURL('image/jpeg', 0.9)
  } catch {
    throw new Error('图片来源不允许本机排版，请重新生成或选择可公开访问的参考图片。')
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (/^https?:\/\//i.test(src) && new URL(src).origin !== window.location.origin) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('生成的图片暂时无法读取，无法合成上图文字。'))
    image.src = src
  })
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const char of text) {
    const next = line + char
    if (line && context.measureText(next).width > maxWidth) {
      lines.push(line)
      line = char
      if (lines.length === maxLines) break
    } else line = next
  }
  if (line && lines.length < maxLines) lines.push(line)
  if (lines.length === maxLines && text.length > lines.join('').length && lines.length) {
    let last = lines[lines.length - 1]
    while (last && context.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1)
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.arcTo(x + width, y, x + width, y + height, radius)
  context.arcTo(x + width, y + height, x, y + height, radius)
  context.arcTo(x, y + height, x, y, radius)
  context.arcTo(x, y, x + width, y, radius)
  context.closePath()
}
