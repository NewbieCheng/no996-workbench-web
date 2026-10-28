/**
 * 爆款脚本引擎 · 类型定义
 */
import type { AgentRunSnapshot } from '../../../agent'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/types'

export type ScriptMode = 'video' | 'live'
/**
 * 创作目的（视频）/ 创作目标（直播）。
 *
 * 视频自 2026-10-28 起用四类目的：获客 / 人设 / 观点干货 / 转化。
 * `流量` 与 `成交` 只保留给历史任务读取，不再出现在新视频任务里；
 * `成交` 继续生成时由 `purposeIdFromGoal` 映射成转化型。
 */
export type ScriptGoal = '获客' | '人设' | '观点干货' | '转化' | '流量' | '成交'
export type ScriptStrengthLabel = '软种草' | '平衡' | '强促单'

/** 新视频任务的四类创作目的 */
export const VIDEO_GOALS: ScriptGoal[] = ['获客', '人设', '观点干货', '转化']
/** 直播沿用原来的三个目标（本轮不改直播的目的语义） */
export const LIVE_GOALS: ScriptGoal[] = ['获客', '流量', '成交']
/** 兼容旧引用：默认给直播 */
export const SCRIPT_GOALS: ScriptGoal[] = LIVE_GOALS

/** 目标说明（摘要行灰字） */
export const GOAL_HINTS: Record<ScriptGoal, string> = {
  获客: '引导加微信、留资、咨询',
  人设: '让观众理解并相信你',
  观点干货: '讲清一个判断和一个方法',
  转化: '讲清交付、证据与下一步',
  流量: '涨粉、破播放、引发评论',
  成交: '建立信任、拉升下单',
}

export const VIDEO_PLATFORMS = ['抖音', '视频号', '小红书', '快手'] as const
export const LIVE_PLATFORMS = ['抖音', '视频号', '淘宝', '快手'] as const

export const VIDEO_DURATIONS: Array<{ label: string; seconds: number }> = [
  { label: '30秒', seconds: 30 },
  { label: '60秒', seconds: 60 },
  { label: '120秒', seconds: 120 },
  { label: '180秒', seconds: 180 },
  { label: '300秒', seconds: 300 },
]

export const LIVE_DURATIONS: Array<{ label: string; seconds: number }> = [
  { label: '5分钟', seconds: 300 },
  { label: '15分钟', seconds: 900 },
  { label: '30分钟', seconds: 1800 },
  { label: '1小时', seconds: 3600 },
  { label: '2小时', seconds: 7200 },
]

/** 视频字数换算：时长（秒）× 25 ÷ 6（约每秒 4.17 字） */
export function videoTargetChars(seconds: number): number {
  return Math.round((seconds * 25) / 6)
}

export function strengthLabel(value: number): ScriptStrengthLabel {
  if (value < 34) return '软种草'
  if (value < 67) return '平衡'
  return '强促单'
}

/* ------------------------------- 配置 ------------------------------- */

export type ScriptConfig = {
  mode: ScriptMode
  /** 唯一必填 */
  product: string
  intro?: string
  durationSec: number
  goal: ScriptGoal
  /**
   * 视频专用：四类创作目的。为空表示用户还没选（新任务不允许直接生成）。
   * `goal` 仍按目的同步更新，供 Markdown 与历史列表显示。
   */
  purpose?: 'acquisition' | 'persona' | 'opinion' | 'conversion'
  /** 按目的收集的关键事实（键见 purposes/*.ts 的 materials） */
  materials?: Record<string, string>
  structure: {
    kind: 'auto' | 'custom' | 'preset'
    text?: string
    /** 内置 preset id（四类目的共 16 个结构之一） */
    presetId?: string
  }
  audience?: string
  sellingPoints?: string
  pain?: string
  /** 转化强度 0-100 */
  strength: number
  platform: string
  /** 表达风格人设（进提示词变量「表达参考人设」，管语气与视角） */
  personaContent?: string
  /**
   * 背景人设（身份 + 定位卡片 + 档案正文），由内核挂在 system 消息上，管身份事实。
   * 与 `personaContent` 分开：一个是「怎么说」，一个是「我是谁」。
   */
  personaBackground?: string
  mustWords?: string[]
  bannedWords?: string[]
  /** 直播专属 */
  offer?: string
  interactionNodes?: number
  /** 参考（选填） */
  refGood?: string
  refCompetitor?: string
}

/** 自动补全的三项推断结果 */
export type ScriptAutofill = {
  audience: string
  sellingPoints: string
  pain: string
  assumptions?: string
  /**
   * 这三项是否来自**代码兜底**而非模型推断。
   *
   * 预填失败（超时 / JSON 不合法）时会填一组通用常量。它们必须被标记出来，
   * 否则页面会把「代码写死的兜底文案」当成「AI 已补全」展示给用户 —— 那是假成功。
   */
  fromFallback?: boolean
}

/* ------------------------------- 产物 ------------------------------- */

export type ScriptNodeType = '互动' | '福利' | '促单' | '演示'

export type ScriptNode = { type: ScriptNodeType; action: string }

export type ScriptSegmentVersion = { round: number; spoken: string; note?: string }

export type ScriptSegment = {
  id: string
  name: string
  /** 环节目的（如「前3秒下钩子」） */
  purpose: string
  /** 时长占比，全部之和为 1 */
  share: number
  startSec: number
  endSec: number
  spoken: string
  /** 视频：画面提示 */
  visual?: string
  /** 直播：动作提示 */
  action?: string
  /** 直播：该章节点 */
  nodes?: ScriptNode[]
  /** 结构库出处，可追溯 */
  libraryIds: string[]
  /** 评审指出的最大问题 */
  issue?: string
  /** 是否被评审标记必须修改 */
  mustFix?: boolean
  /** 多轮演进轨迹 */
  versions: ScriptSegmentVersion[]
}

/** 评审对单条段的结论 */
export type ScriptReviewItem = {
  segmentId: string
  /** 该段结束时的预估在线留存 0-100 */
  retention: number
  primaryIssue: string
  improvementDirection: string
  mustFix: boolean
}

export type ScriptReview = {
  items: ScriptReviewItem[]
  /** 钩子强度 0-100 */
  hookStrength: number
  /** 转化力 0-100 */
  conversion: number
}

export type ScriptRound = {
  round: number
  /** 每段结束时的留存点（长度 = 段数） */
  retentionPoints: number[]
  averageRetention: number
  conversion: number
  /** 综合分 = round(0.5 × 留存 + 0.5 × 转化力) */
  composite: number
}

export type ScriptPromptLogEntry = {
  stageId: string
  roleName: string
  roleTag: string
  kind: 'model' | 'algo' | 'tool'
  principle: string
  actualPrompt: string
  output: unknown
}

/** 入队 payload：配置快照 + 全部产物 */
export type ScriptGeneratePayload = {
  config: ScriptConfig
  /** 参考资料（正文随 planner / writer 两次调用发送，不进评审） */
  chatAttachments?: StoredChatAttachment[]
  run?: AgentRunSnapshot
  autofill?: ScriptAutofill
  brief?: ScriptBrief
  structures?: LibraryHit[]
  segments?: ScriptSegment[]
  rounds?: ScriptRound[]
  review?: ScriptReview
  /** 最终合规结果 */
  hardCheck?: { pass: boolean; hits: Array<{ label: string; rule: string; detail: string; segmentId?: string }>; charCount: number }
  /** 折叠区数据 */
  promptLog?: ScriptPromptLogEntry[]
  /** 是否使用了降级结果 */
  fallback?: boolean
  usedMock?: boolean
}

/** 策划员的结构化产出 */
export type ScriptBrief = {
  goal: ScriptGoal
  audience: string
  pain: string
  sellingPoints: string
  product: string
  durationSec: number
  targetChars?: number
  strength: number
  assumption?: string | null
}

/** 结构库命中项 */
export type LibraryHit = {
  id: string
  formulaName: string
  segments: Array<{ name: string; purpose: string; share: number }>
  /** 来源标签，便于追溯 */
  source: string
}

/* ----------------------------- 编辑器状态 ----------------------------- */

/** 用户在结果区的就地编辑与换版记录（本机状态） */
export type ScriptEditState = {
  /** segmentId → 用户改写的口播 */
  edited: Record<string, string>
  /** segmentId → 是否使用了「换一版」的版本 */
  alt: Record<string, boolean>
  /** segmentId → 换一版产出的文本 */
  altText: Record<string, string>
}
