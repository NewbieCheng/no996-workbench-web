/**
 * 传输入口：把「内核调用」翻译成「项目已有 API 封装」。
 *
 * 原先 persona 有 adapters.ts + clients.ts + mock-adapters.ts 三件套，
 * titles 裸调 chatCompletions 且无 mock 抽象，两者无法复用。
 * 现统一为 createAgentClients，并保留单一 demo/远端判定。
 */
import { chatCompletions, webSearchToolDefinition, type ChatMessage } from '../api/chat'
import { buildUserChatMessage } from '../lib/chat-attachments/build-message'
import { webSearch } from '../api/tools'
import { apiErrorMessage } from '../api/client'
import { isWorkbenchAiDemoMode } from '../api/workbench-ai'
import { resolveProfile } from './models'
import { httpStatusOf } from './runtime'
import { createMockAgentClients, type AgentClientOptions } from './mock-clients'
import { isGenericSearchQuery, parseSearchToolArguments, SEARCH_QUERY_REPAIR_GUIDANCE } from './search-query'
import type {
  AgentChatClient,
  AgentChatRequest,
  AgentChatResult,
  AgentClients,
  AgentSearchClient,
  AgentSearchResult,
  AgentToolCall,
} from './types'

function applyChatAttachments(messages: ChatMessage[], attachments?: AgentChatRequest['chatAttachments']): ChatMessage[] {
  if (!attachments?.length) return messages
  const out = [...messages]
  for (let i = out.length - 1; i >= 0; i -= 1) {
    const row = out[i]
    if (row.role !== 'user') continue
    const text = typeof row.content === 'string' ? row.content : row.content.find((p) => p.type === 'text')?.text ?? ''
    out[i] = buildUserChatMessage(text, attachments)
    return out
  }
  out.push(buildUserChatMessage('', attachments))
  return out
}

function toApiMessages(messages: AgentChatRequest['messages']): ChatMessage[] {
  return messages.map((m) => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
    return { role: m.role, content: m.content }
  })
}

/**
 * 把「背景上下文」（人设 + 定位卡片）挂成独立的 system 消息。
 *
 * 放在最前、任务系统提示词之后：背景只负责说明「我是谁、对谁说话」，
 * 「怎么做事」的指令仍然最贴近用户输入，保持原提示词不变。
 */
/**
 * 在 system 提示词之后插入一条独立的「背景上下文」消息（人设 + 定位卡片）。
 *
 * 之所以单开一条消息而不是拼进 system：背景只说明「我是谁、对谁说」，
 * system 里的「怎么做事」才是任务指令，两者混在一起会让模型把设定当成约束条件。
 */
export function withBackground(messages: ChatMessage[], background?: string): ChatMessage[] {
  const text = background?.trim()
  if (!text) return messages
  const out = [...messages]
  const insertAt = out[0]?.role === 'system' ? 1 : 0
  out.splice(insertAt, 0, { role: 'system', content: `【背景上下文】\n${text}` })
  return out
}

/**
 * 保留原始错误的 HTTP 状态码。
 *
 * 之前这里 `throw new Error(apiErrorMessage(e))` 把 axios 形状整个丢掉，
 * 于是重试层无法区分「500 值得重试」与「400 重试也没用」，
 * 且空响应体的 500 会退化成 axios 的 `Request failed with status code 500`。
 */
/**
 * 让错误「带着状态码」继续往上抛。
 *
 * 传输层抛出的错误本来带 `status` / `response`，但一层 `new Error(msg)` 就会把它变成
 * 普通错误，于是重试层分不清 5xx（该重试）和 4xx（重试也白搭、还多扣一次积分）。
 * 任何在传输层之上再包一层的代码都必须用它，不要直接 `new Error(...)`。
 */
export function preserveAgentError(e: unknown): Error {
  const status = httpStatusOf(e)
  const next = new Error(apiErrorMessage(e))
  const response = (e as { response?: unknown })?.response
  if (status !== undefined) (next as { status?: number }).status = status
  if (response) (next as { response?: unknown }).response = response
  return next
}

export function createRemoteAgentClients(): AgentClients {
  const chat: AgentChatClient = {
    async complete(request): Promise<AgentChatResult> {
      const profile = resolveProfile(request.profile)
      try {
        const useStream = Boolean(request.onDelta || request.onReasoningDelta)
        const apiMessages = applyChatAttachments(toApiMessages(request.messages), request.chatAttachments)
        const result = await chatCompletions({
          messages: withBackground(apiMessages, request.background),
          temperature: request.temperature ?? profile.temperature,
          max_tokens: request.maxTokens ?? profile.maxTokens,
          tools: request.tools?.map((t) => webSearchToolDefinition(t.description)),
          tool_choice: request.tools?.length ? 'auto' : undefined,
          response_format: request.responseFormat,
          reasoning_effort: request.reasoningEffort,
          stream: useStream,
          onDelta: request.onDelta,
          onReasoningDelta: request.onReasoningDelta,
          signal: request.signal,
        })
        const choice = result.choices[0]
        const message = choice?.message
        const producedToolCalls: AgentToolCall[] | undefined =
          choice?.finish_reason === 'tool_calls' && message?.tool_calls?.length
            ? message.tool_calls
                .filter((tc) => Boolean(tc.function?.name))
                .map((tc) => ({
                  id: tc.id,
                  name: tc.function.name,
                  arguments: parseSearchToolArguments(tc.function.arguments ?? ''),
                }))
            : undefined
        return {
          content: message?.content ?? '',
          toolCalls: producedToolCalls?.length ? producedToolCalls : undefined,
          // 必须把上游结束原因带回内核：`length` 表示正文被 max_tokens 截断，
          // 此时 content 是残缺 JSON，内核应重试（并加码上限）而不是当成终局失败。
          finishReason: choice?.finish_reason,
        }
      } catch (e) {
        throw preserveAgentError(e)
      }
    },
  }

  const search: AgentSearchClient = {
    async search(query, signal): Promise<AgentSearchResult> {
      const q = query.trim()
      if (isGenericSearchQuery(q)) {
        return {
          query: q,
          snippets: [{ title: '检索词过于宽泛', snippet: SEARCH_QUERY_REPAIR_GUIDANCE }],
          status: 'rejected',
          error: SEARCH_QUERY_REPAIR_GUIDANCE,
        }
      }
      if (!q) {
        return {
          query,
          snippets: [],
          status: 'rejected',
          error: '没有有效检索词，请根据用户资料补充具体关键词。',
        }
      }
      try {
        const data = await webSearch({ queries: [q] }, signal)
        return {
          query: q,
          content: data.content?.trim() || undefined,
          snippets: (data.sources ?? []).map((s) => ({
            title: s.title,
            snippet: s.snippet?.trim() || s.title,
            url: s.url,
          })),
        }
      } catch (e) {
        const message = apiErrorMessage(e)
        return {
          query: q,
          snippets: [],
          status: 'succeeded',
          content: `联网搜索暂不可用（${message}）。将主要依据您已填写的资料继续整理人设。`,
        }
      }
    },
  }

  return { chat, search, isMock: false }
}

/**
 * 统一 demo / 远端判定。
 * 旧的 VITE_PERSONA_USE_REMOTE=0 仍被尊重，避免既有环境变量失效。
 */
export function resolveAgentMode(): 'remote' | 'demo' {
  if (import.meta.env.VITE_PERSONA_USE_REMOTE === '0') return 'demo'
  return isWorkbenchAiDemoMode() ? 'demo' : 'remote'
}

/**
 * 所有 AI 功能的唯一入口。
 * @param options 演示模式下的业务应答器（正式模式忽略）
 */
export function createAgentClients(options: AgentClientOptions = {}): AgentClients {
  if (resolveAgentMode() === 'demo') return createMockAgentClients(options)
  return createRemoteAgentClients()
}
