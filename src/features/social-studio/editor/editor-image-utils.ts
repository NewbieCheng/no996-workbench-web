export const ARTICLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ARTICLE_IMAGE_MAX_MB = 10

export type CropAreaPixels = {
  x: number
  y: number
  width: number
  height: number
} | null

export type CropRatioMode =
  | 'free'
  | 'ratio_3_4'
  | 'ratio_1_1'
  | 'ratio_4_3'
  | 'ratio_16_9'
  | 'ratio_9_16'

export function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

export function isAllowedArticleImageFile(file: File): boolean {
  return ARTICLE_IMAGE_TYPES.includes(file.type as (typeof ARTICLE_IMAGE_TYPES)[number]) && file.size > 0
}

export async function filesToDataUrls(files: FileList | File[]): Promise<string[]> {
  const out: string[] = []
  for (const file of Array.from(files)) {
    if (!isAllowedArticleImageFile(file)) continue
    if (file.size > ARTICLE_IMAGE_MAX_MB * 1024 * 1024) continue
    const url = await readFileAsDataUrl(file)
    if (url) out.push(url)
  }
  return out
}
