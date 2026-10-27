/**
 * Agent 编排内核 · 公共类型
 *
 * 本文件（以及 src/agent 下全部文件）不含任何业务语义，也不得 import src/features。
 * 业务功能通过声明 AgentStageDef + 调用 StageRunner 复用本内核。
 */

/** 步骤的真实来源：模型 / 纯算法 / 工具调用。UI 必须据此渲染标签，禁止把 algo 标成 AI。 */
export type AgentStageKind = 'model' | 'algo' | 'tool'

/** 模型画像 id，具体温度与 token 上限见 models.ts */
export type ModelProfileId = 'extract' | 'plan' | 'draft' | 'review' | 'autofill'

export type AgentStageStatus = 'idle' | 'running' | 'done' | 'failed' | 'skipped'

export type AgentRunStatus = 'idle' | 'running' | 'done' | 'failed' | 'cancelled'

/** 阶段声明：一个功能需要哪些步骤、叫什么、属于哪种真实来源。 */
export type AgentStageDef = {
  id: string
  /** 展示序号，从 1 开始 */
  order: number
  /** 角色名，如「策划员」「结构师」「定稿」 */
  roleName: string
  /** 类型标签，由 kind 推导，UI 可覆盖 */
  roleTag: string
  kind: AgentStageKind
  /** 折叠区展示的一句话原理 */
  principle: string
  /** 运行中文案（i18n key 或直接文案） */
  headline: string
  /** 该步骤默认使用的模型画像 */
  profile?: ModelProfileId
}

export type AgentSearchAttempt = {
  query: string
  purpose?: string
  status: 'running' | 'succeeded' | 'failed' | 'rejected' | 'cancelled'
  error?: string
  resultCount?: number
  startedAt: number
  finishedAt?: number
}

/** 单步运行态。actualPrompt / output 是折叠区所需的数据，由 StageRunner 自动记录。 */
export type AgentStageState = {
  id: string
  status: AgentStageStatus
  /** 外层收敛环的轮次；单步流程为 1 */
  round?: number
  headline?: string
  /** 变量已代入的实际提示词（含 «» 高亮标记，展示用 stripVarMarks 去掉） */
  actualPrompt?: string
  /** 本步输出快照 */
  output?: unknown
  error?: string
  /** 流式增量文本，用于打字动效 */
  streamingContent?: string
  /** 流式思考增量（上游 reasoning_content） */
  streamingReasoningContent?: string
  /** 多轮联网搜索的查询目的、关键词与结果状态；不包含原始搜索返回。 */
  searchAttempts?: AgentSearchAttempt[]
  /** 多轮工具交互中已结束的模型请求的思考过程；保留供流程画布回看 */
  reasoningHistory?: Array<{ turn: number; text: string }>
  startedAt?: number
  finishedAt?: number
}

/** 统一进度协议：页内 sink 与后台任务 sink 发布同一形状。 */
export type AgentRunSnapshot = {
  flowId: string
  stages: AgentStageState[]
  /** 当前轮次，单步流程恒为 1 */
  round: number
  status: AgentRunStatus
  /** 按阶段保存的业务检查点；仅本机任务载荷持久化，便于从某一步恢复。 */
  checkpoints?: Record<string, unknown>
  error?: string
  /** 是否使用了降级结果（如已用上一版结果） */
  fallback?: boolean
}

export type AgentFlowDefinition = {
  id: string
  stages: AgentStageDef[]
}

/* ------------------------------- 模型调用 ------------------------------- */

import type { ChatContentPart } from '../api/chat'
import type { StoredChatAttachment } from '../lib/chat-attachments/prepare'

export type AgentChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type AgentToolSpec = { name: string; description: string }

export type AgentToolCall = {
  id: string
  name: string
  /** 已尽力解析为对象；无效参数为空对象，不伪造检索词。 */
  arguments: Record<string, unknown>
}

export type AgentChatRequest = {
  messages: AgentChatMessage[]
  tools?: AgentToolSpec[]
  profile?: ModelProfileId
  temperature?: number
  maxTokens?: number
  /**
   * 背景上下文（人设 + 定位卡片）。**由内核统一挂在 system 消息上**，
   * 业务侧不要自己往 messages 里塞 —— 否则每个 flow 都要重写一遍拼装逻辑，
   * 而且很容易把背景误发到流式正文里。
   */
  background?: string
  /** 结构化输出：要求上游返回严格 JSON（可显著降低解析失败） */
  responseFormat?: { type: 'json_object' | 'text' }
  /** 思考强度；不传时传输层用默认档 */
  reasoningEffort?: string
  signal?: AbortSignal
  onDelta?: (chunk: string) => void
  onReasoningDelta?: (chunk: string) => void
  /** 用于演示模式区分调用方（不参与正式请求体） */
  stageHint?: string
  /** 随本轮 user 消息一并发送的附件（图片 data URI + 文档正文）。 */
  chatAttachments?: StoredChatAttachment[]
}

export type AgentChatResult = {
  content: string
  toolCalls?: AgentToolCall[]
  /**
   * 上游结束原因（stop / length / tool_calls …）。
   * `length` 表示被 max_tokens 截断 —— 此时 content 往往是残缺 JSON，
   * 内核据此判定「可重试」而不是把解析失败当终局。
   */
  finishReason?: string
  /** HTTP 状态码（成功时为响应状态）。供重试判定区分 4xx / 5xx。 */
  status?: number
}

export type AgentChatClient = {
  complete(request: AgentChatRequest): Promise<AgentChatResult>
}

export type AgentSearchSnippet = { title: string; snippet: string; url?: string }

export type AgentSearchResult = {
  query: string
  snippets: AgentSearchSnippet[]
  content?: string
  status?: 'succeeded' | 'failed' | 'rejected'
  error?: string
}

export type AgentSearchClient = {
  search(query: string, signal?: AbortSignal): Promise<AgentSearchResult>
}

/** 内核对外暴露的唯一传输入口。 */
export type AgentClients = {
  chat: AgentChatClient
  /** 需要检索的功能才提供（persona / script 的取词或结构检索） */
  search?: AgentSearchClient
  /** 演示模式：返回确定性样例，UI 必须显示「演示」 */
  isMock: boolean
}

/* ------------------------------- sink ------------------------------- */

export type AgentSink = {
  /** 每次进度变化调用一次；可返回 Promise，StageRunner 会等待以保证顺序。 */
  publish(snapshot: AgentRunSnapshot): void | Promise<void>
}
