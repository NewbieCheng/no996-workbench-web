/**
 * 爆款标题 · 领域类型
 *
 * 编排已经迁移到内核（src/agent）；本文件只保留业务数据结构。
 * 旧的 RelayStepId / RelayStepInfo / TitleGenerationResult.steps（手工拼的过程数组）
 * 已删除 —— 过程数据现在由 StageRunner 自动记录为 AgentRunSnapshot。
 */
import type { AgentRunSnapshot, HardCheckResult } from '../../../agent'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/prepare'

export type TargetPlatform = '抖音' | '小红书' | '公众号' | 'B站' | '视频号' | '知乎'

/** 页面平台下拉可选项（历史任务仍可能带「视频号」「知乎」） */
export const PLATFORM_OPTIONS: TargetPlatform[] = ['小红书', '抖音', '公众号', 'B站']

export interface UserInputSpec {
  audience: string
  topic: string
  platform: TargetPlatform
  toneIntensity: number
  supplement?: string
  personaName?: string
  /** 表达风格人设（进提示词变量「表达参考人设」，管语气与视角） */
  personaContent?: string
  /**
   * 背景人设（身份 + 定位卡片 + 档案正文），由内核挂在 system 消息上，管身份事实。
   * 与 `personaContent` 分开：一个是「怎么说」，一个是「我是谁」。
   */
  personaBackground?: string
}

export interface StructuredRequirement {
  theme: string
  audience: string
  painPoints: string
  goal: '点击' | '收藏' | '转化' | string
  platform: TargetPlatform
  toneIntensity: number
  assumptions?: string
}

/** 内置句式库条目（代码内置，不是模型编造） */
export interface VocabularyFormulaItem {
  id: string
  formulaName: string
  sourceTag: string
  templateWords: string
  historicalPerformance: string
  applicablePlatforms: TargetPlatform[]
}

export interface TitleRoundHistory {
  round: number
  title: string
  ctr: number
  credibility: number
  score: number
  issue?: string
  improvement?: string
}

export interface TitleCandidate {
  id: number
  formulaName: string
  sourceTag: string
  title: string
  charCount: number
  maxCharCount: number
  ctr: number
  credibility: number
  score: number
  isParetoOptimal: boolean
  isRecommended: boolean
  rank: number
  rounds: TitleRoundHistory[]
}

/** 独立评审的单条结果（模型只给点击力与可信度，综合分由代码算） */
export type TitleReviewItem = {
  id: number
  ctr: number
  credibility: number
  issue: string
  improvement: string
  mustFix: boolean
}

export type TitleRound = {
  round: number
  averageScore: number
  averageCtr: number
  averageCredibility: number
  mustFixCount: number
  hardCheckPass: boolean
}

export type TitleReview = {
  items: TitleReviewItem[]
  rounds: TitleRound[]
}

/** 流程完整产物：页面恢复历史时直接读这个对象 */
export type TitleGeneratePayload = {
  input: UserInputSpec
  /** 创作素材附件（图 + 文档），随任务快照持久化供恢复 */
  chatAttachments?: StoredChatAttachment[]
  requirement: StructuredRequirement
  /** 内置句式库命中的条目 */
  formulas: VocabularyFormulaItem[]
  /** 联网检索到的来源标题（演示模式为演示数据） */
  evidence: string[]
  candidates: TitleCandidate[]
  hardCheck: HardCheckResult
  review: TitleReview
  run: AgentRunSnapshot | null
  fallback?: boolean
  usedMock?: boolean
}

/** 收敛停止阈值（与提示词里写死的口径保持一致） */
export const TITLE_STOP = {
  maxRounds: 3,
  scoreThreshold: 85,
  minImprovement: 2,
} as const
