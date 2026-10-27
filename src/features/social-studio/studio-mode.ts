import type { SocialContentMode } from './studio-types'

export function wechatPreviewShape(mode: SocialContentMode): 'article' | 'image_draft' {
  return mode === 'image_text' ? 'image_draft' : 'article'
}
