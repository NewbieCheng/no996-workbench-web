import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/prepare'
import type { SocialContentMode } from '../studio-types'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'
import type {
  CreationOrigin,
  IdeationTopicForm,
  StudioCoverTemplate,
  TopicAngleOption,
  WizardCustomConfig,
  WizardGeneratedResult,
  WizardOutlinePlan,
} from '../wizard/types'

export type SocialComposeAction = 'compose' | 'images_only'

export type SocialComposeMode = 'wizard' | 'studio'

export type SocialComposeSourceKind = 'image_text' | 'video' | 'text_only' | 'article' | 'unknown'

export type SocialComposeResult = {
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  mode: SocialComposeMode
  title: string
  content: string
  summary: string
  imageUrls: string[]
  origin?: CreationOrigin
  selectedBenchmark?: WorkbenchBridgeCollectedItem
  selectedAngle?: TopicAngleOption
  sourceKind?: SocialComposeSourceKind
  /** 部分图片失败或素材不支持配图时的可展示提示；不伪造成功。 */
  warnings?: string[]
  /** 图片失败数量，任务仍可成功交付正文。 */
  failedImageCount?: number
}

export type SocialComposeTaskPayload = {
  action: SocialComposeAction
  mode: SocialComposeMode
  platform: SocialStudioPlatform
  contentMode: SocialContentMode
  targetType: 'xiaohongshu' | 'wechat-article'

  /** 爆款复刻 */
  origin?: CreationOrigin
  benchmark?: WorkbenchBridgeCollectedItem | null
  topicForm?: IdeationTopicForm
  selectedAngle?: TopicAngleOption | null
  template?: StudioCoverTemplate
  customConfig?: WizardCustomConfig
  outlinePlan?: WizardOutlinePlan

  /** 灵感创作 */
  brief?: SocialStudioBrief
  personaContent?: string
  existingTitle?: string
  existingContent?: string

  /** 用户已确认的附件；大文件应在入队前转为 StoredChatAttachment 或任务 blob。 */
  chatAttachments?: StoredChatAttachment[]

  result?: SocialComposeResult
  run?: import('../../../agent').AgentRunSnapshot | null
}

export type WizardComposeTaskResult = WizardGeneratedResult
