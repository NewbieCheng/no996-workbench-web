import type { MaterialType, WeixinPublishMode, XhsPublishMode } from './types'

export function resolveWeixinPublishMode(
  mode: WeixinPublishMode,
  materialType: MaterialType,
): 'article' | 'image_draft' {
  if (mode === 'article') return 'article'
  if (mode === 'image_draft') return 'image_draft'
  return materialType === 'image_text' ? 'image_draft' : 'article'
}

export function resolveXhsMaterialType(mode: XhsPublishMode, imageCount: number): MaterialType {
  if (mode === 'image_text') return 'image_text'
  if (mode === 'article') return 'article'
  return imageCount > 0 ? 'image_text' : 'article'
}
