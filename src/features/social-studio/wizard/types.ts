import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'

export type WizardStep =
  | 'search'
  | 'benchmark'
  | 'template'
  | 'custom'
  | 'outline'
  | 'generating'

/** 创作起点方式：对标爆款复刻 vs AI 主题灵感创作 */
export type CreationOrigin = 'benchmark_clone' | 'topic_ideation'

/** 表达方式偏好 */
export type ExpressionStyle = 'seeding' | 'planting' | 'dry_goods' | 'story' | 'review'

export interface IdeationTopicForm {
  topic: string
  expressionStyle: ExpressionStyle
  audience?: string
}

export interface TopicAngleOption {
  id: string
  title: string
  angleConcept: string
  targetPainPoint: string
  recommendedHook: string
}

export type TemplateCategory =
  | 'all'
  | 'big_text'
  | 'portrait_ip'
  | 'education'
  | 'food'
  | 'diagram'
  | 'travel'
  | 'pet'
  | 'original'

export interface StudioCoverTemplate {
  id: string
  name: string
  category: TemplateCategory
  tagLabel: string
  description: string
  previewColor: string
  previewBadge?: string
  aspectRatio: '3:4' | '16:9'
  promptModifier: string
  headlineStyle: string
}

export type WordCountOption = '100' | '300' | '500' | 'same_as_original'
export type ImageResolutionOption = 'standard' | 'high'

export interface WizardCustomConfig {
  wordCount: WordCountOption
  useEmoji: boolean
  imageResolution: ImageResolutionOption
  keepOriginalImages: boolean
  customRequirement: string
  referenceImages: string[]
}

export interface OutlineSectionItem {
  index: number
  headline: string
  visualDescription: string
  bodyDraft: string
}

export interface WizardImagePlan {
  index: number
  role: 'cover' | 'section'
  sectionIndex?: number
  titleText: string
  supportingText: string
  badgeText: string
  visualDescription: string
}

export interface WizardOutlinePlan {
  suggestedTitles: string[]
  hook: string
  sections: OutlineSectionItem[]
  conclusion: string
  visualStyle: string
  imagePlans: WizardImagePlan[]
}

export interface WizardGeneratedResult {
  title: string
  content: string
  summary: string
  imageUrls: string[]
  origin?: CreationOrigin
  selectedBenchmark?: WorkbenchBridgeCollectedItem
  selectedAngle?: TopicAngleOption
}
