import type { ArticleTemplate } from '../../../prompts/article'
import type { WechatThemeKey } from '../../../services/social-publish/layout/wechat-markdown-preview'
import type { SocialContentMode } from '../studio-types'

export type ExpressionStyle = 'seeding' | 'dry_goods' | 'story' | 'review'
export type BriefLength = 'short' | 'standard' | 'long'
export type VoiceTone = 'bestie' | 'professional' | 'humorous'

export type SocialStudioBrief = {
  topic: string
  expressionStyle: ExpressionStyle
  length: BriefLength
  audience: string
  imageCount: number
  voiceTone: VoiceTone
  emojiLevel: number
  referenceText: string
  creativeRequirements: string
  summary: string
  themeKey: WechatThemeKey
  articleTemplate: ArticleTemplate
  autoTags: boolean
  hardCheck: boolean
  authorized: boolean
}

export type SocialStudioPlatform = 'xhs' | 'wechat'

/** 图文模式「预期配图张数」上限（与准备区下拉、本地上传槽位一致） */
export const SOCIAL_STUDIO_MAX_IMAGE_COUNT = 20

export function createDefaultBrief(platform: SocialStudioPlatform): SocialStudioBrief {
  return {
    topic: '',
    expressionStyle: 'seeding',
    length: 'standard',
    audience: '',
    imageCount: platform === 'xhs' ? 4 : 3,
    voiceTone: 'bestie',
    emojiLevel: 2,
    referenceText: '',
    creativeRequirements: '',
    summary: '',
    themeKey: 'green',
    articleTemplate: 'clean',
    autoTags: true,
    hardCheck: true,
    authorized: false,
  }
}

export function clampImageCount(mode: SocialContentMode, count: number): number {
  if (mode === 'article') return 0
  const n = Number.isFinite(count) ? Math.round(count) : 1
  return Math.min(SOCIAL_STUDIO_MAX_IMAGE_COUNT, Math.max(1, n))
}
