import type { TalkCreationInput, TalkCreationResult } from '../../features/ip-video/agent/types'
import type { EditorDocument } from '@no996/video-editor/core/project.ts'
import type { AgentRunSnapshot } from '../../agent'
import type { ToolId } from '../../prompts/text-tools'
import type { StoredChatAttachment } from '../../lib/chat-attachments/prepare'
import type { PersonaQuestionnaire } from '../persona'
import type { ScriptConfig, ScriptGeneratePayload as ScriptGeneratePayloadBase } from '../../features/script-lab/agent/types'
import type { TitleGeneratePayload as TitleGeneratePayloadBase, UserInputSpec } from '../../features/titles/agent/types'
import type {
  EnqueueMomentsCopyInput as EnqueueMomentsCopyInputBase,
  EnqueueMomentsPlanInput as EnqueueMomentsPlanInputBase,
  MomentsCopyTaskPayload as MomentsCopyTaskPayloadBase,
  MomentsPlanTaskPayload as MomentsPlanTaskPayloadBase,
} from '../../features/moments/agent/types'
import type { VoiceCloneRecord } from '../../api/voice-clone'
import type { VoiceDubAdvancedConfig, VoiceDubSegment } from '../../features/voice/agent/types'

import type { RetalkStatus, RetalkTask } from '../../api/video-retalk'

export type EnqueueDigitalHumanRetalkInput = {
  projectId: string
  segmentId: string
  versionId: string
  title: string
  video: string
  audio: string
  faceReference?: string
  videoExtension?: boolean
  text?: string
  clientRequestId: string
}
export type DigitalHumanRetalkPayload = EnqueueDigitalHumanRetalkInput & {
  taskId?: string
  status?: RetalkStatus
  result?: Omit<RetalkTask, 'source_url'>
  submissionAttempted?: boolean
  submissionUncertain?: boolean
  submissionErrorCode?: string
  retryAfterSeconds?: number
  observationStartedAt?: number
  observationPhase?: 'queued' | 'active'
  observationPaused?: boolean
  lastCheckedAt?: number
  observationError?: string
  retryAfterUntil?: number
}

export type WorkbenchTaskKind =
  | 'digital_human_retalk'
  | 'voice_tts'
  | 'voice_clone'
  | 'ip_video_audio'
  | 'ip_video_create'
  | 'voice_dub_advanced'
  | 'persona_generate'
  | 'text_sections'
  | 'source_create'
  | 'script_generate'
  | 'titles_generate'
  | 'moments_plan'
  | 'moments_copy'
  | 'video_factory_export'

export type VideoExportSource = 'video-factory' | 'ip-composition'

export type VideoExportComposition = 'preview' | 'offline'

export type EnqueueVideoFactoryExportInput = {
  documentId: string
  documentRevision: number
  projectTitle: string
  resolutionPreset: '1080p' | '720p'
  source: VideoExportSource
  ownerScope: string
  /** Snapshot captured when queued, so later edits cannot change an existing export. */
  documentSnapshot?: EditorDocument
  /** preview 默认；offline 为逐帧精确导出 */
  composition?: VideoExportComposition
}

export type VideoFactoryExportPayload = EnqueueVideoFactoryExportInput & {
  fileName?: string
}

export type WorkbenchTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type WorkbenchTaskRecord = {
  id: string
  ownerUserId: number
  kind: WorkbenchTaskKind
  status: WorkbenchTaskStatus
  title: string
  subtitle?: string
  route: string
  createdAt: number
  startedAt?: number
  finishedAt?: number
  errorMessage?: string
  payloadId: string
  blobId?: string
  audioByteLength?: number
  meta?: Record<string, string>
}

export type TaskBlobRecord = {
  id: string
  mime: string
  data: ArrayBuffer
}

export type TaskPayloadRecord = {
  id: string
  kind: WorkbenchTaskKind
  data: unknown
}

export type EnqueueIPVideoCreateInput = TalkCreationInput

/** Input stays attached to the finished plan for owner/project/revision-safe replay. */
export type IPVideoCreatePayload = {
  input: TalkCreationInput
  result?: TalkCreationResult
  run?: AgentRunSnapshot
}

export type IPVideoAudioPayload = {
  text: string
  voiceId: string
  voiceLabel: string
  speed: number
  templateId: string
  mediaPath?: string
  upstreamAudioUrl?: string
}
export type EnqueueIPVideoAudioInput = Omit<IPVideoAudioPayload, 'mediaPath' | 'upstreamAudioUrl'>

export type VoiceTtsPayload = {
  text: string
  textPreview: string
  voiceId: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
  mediaPath?: string
  /** Upstream OSS URL from speech API `source_url` (short-lived). */
  upstreamAudioUrl?: string
}

export type PersonaGeneratePayload = {
  personaId: string
  personaName: string
  formData: PersonaQuestionnaire
  instruction?: string
  currentProfile?: string
  chatAttachments?: StoredChatAttachment[]
  resultMarkdown?: string
  run?: AgentRunSnapshot
  usedMock?: boolean
}

export type TextSectionsPayload = {
  toolId: ToolId
  values: Record<string, string>
  personaContent?: string
  sections?: Array<{ label: string; content: string }>
}

export type SourceCreatePayload = {
  sourceUrl?: string
  materialId?: string
  /**
   * 旧值 titles / video-script / live-script 保留以便解析历史任务记录；
   * 新入队只允许小红书笔记与公众号文章（脚本与标题已改走各自的 Agent 流程）。
   */
  targetType: 'titles' | 'video-script' | 'live-script' | 'xiaohongshu' | 'wechat-article'
  instructions?: string
  personaContent?: string
  chatAttachments?: StoredChatAttachment[]
  collectedTitle?: string
  collectedContent?: string
  collectedAuthor?: string
  collectedCoverUrl?: string
  collectedPlatform?: string
  sections?: Array<{ label: string; content: string }>
  articleContent?: string
}

/** 脚本任务载荷：配置快照 + 全部产物（含过程快照，供页面恢复） */
export type ScriptTaskPayload = ScriptGeneratePayloadBase & { resumeFromStageId?: string }

/** 标题任务载荷：输入快照 + 全部产物（含过程快照，供页面恢复） */
export type TitlesTaskPayload = TitleGeneratePayloadBase & { resumeFromStageId?: string }

export type MomentsPlanTaskPayload = MomentsPlanTaskPayloadBase
export type MomentsCopyTaskPayload = MomentsCopyTaskPayloadBase
export type EnqueueMomentsPlanInput = EnqueueMomentsPlanInputBase
export type EnqueueMomentsCopyInput = EnqueueMomentsCopyInputBase

export type EnqueueTitlesGenerateInput = {
  input: UserInputSpec
  chatAttachments?: StoredChatAttachment[]
  resumeFromStageId?: string
  resumeSnapshot?: AgentRunSnapshot
  route: string
  title: string
}

export type EnqueueScriptGenerateInput = {
  config: ScriptConfig
  resumeFromStageId?: string
  resumeSnapshot?: AgentRunSnapshot
  route: string
  title: string
}

export type EnqueueSourceCreateInput = {
  sourceUrl?: string
  materialId?: string
  /** 仅剩这两个消费方仍然使用「导入参考来源」入口 */
  targetType: 'xiaohongshu' | 'wechat-article'
  route: string
  title: string
  instructions?: string
  personaContent?: string
  chatAttachments?: StoredChatAttachment[]
}

export type EnqueueVoiceTtsInput = {
  text: string
  voiceId: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
}

export type VoiceClonePayload = {
  displayName: string
  languageHint: string
  sampleBlobId: string
  fileName: string
  mimeType: string
  createdVoice?: VoiceCloneRecord
}

export type EnqueueVoiceCloneInput = {
  displayName: string
  file: File
  languageHint?: string
}

export type VoiceDubAdvancedPayload = {
  config: VoiceDubAdvancedConfig
  title: string
  segments: VoiceDubSegment[]
  mergedBlobId?: string
  mediaPath?: string
  upstreamAudioUrl?: string
  run?: AgentRunSnapshot
  resumeFromStageId?: string
  awaitingConfirm?: boolean
  usedMock?: boolean
  fallback?: boolean
}

export type EnqueueVoiceDubAdvancedInput = {
  config: VoiceDubAdvancedConfig
  confirmedSegments?: VoiceDubSegment[]
  resumeFromStageId?: string
  resumeSnapshot?: AgentRunSnapshot
  route: string
  title: string
}

export type EnqueuePersonaInput = {
  personaId: string
  personaName: string
  formData: PersonaQuestionnaire
  instruction?: string
  currentProfile?: string
  chatAttachments?: StoredChatAttachment[]
}

export type EnqueueTextSectionsInput = {
  toolId: ToolId
  route: string
  title: string
  values: Record<string, string>
  personaContent?: string
}

export const TASK_LIMITS = {
  maxSucceededPerUser: 80,
  maxBlobBytesPerUser: 150 * 1024 * 1024,
  maxFailedPerUser: 20,
  failedMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  staleRunningMs: 3 * 60 * 1000,
  textPreviewLen: 80,
} as const

/** 声音页历史列表兼容视图 */
export type VoiceTtsTaskView = {
  id: string
  text: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
  status: WorkbenchTaskStatus
  errorMessage?: string
  createdAt: number
}
