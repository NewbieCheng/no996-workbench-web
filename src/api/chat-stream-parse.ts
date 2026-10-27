/** SSE 单帧解析（纯函数，供 chat.ts 与单测复用） */

export type ChatStreamDeltaHandlers = {
  onContent?: (chunk: string) => void
  onReasoning?: (chunk: string) => void
}

export type ChatStreamParseResult = {
  finishReason?: string
}

export function applyChatCompletionStreamPayload(
  payload: string,
  handlers: ChatStreamDeltaHandlers,
): ChatStreamParseResult {
  if (!payload || payload === '[DONE]') return {}
  try {
    const json = JSON.parse(payload) as {
      choices?: Array<{
        delta?: {
          content?: string
          reasoning_content?: string
          tool_calls?: unknown
        }
        finish_reason?: string | null
      }>
    }
    const choice = json.choices?.[0]
    const delta = choice?.delta
    if (delta?.content) handlers.onContent?.(delta.content)
    if (delta?.reasoning_content) handlers.onReasoning?.(delta.reasoning_content)
    const finishReason = choice?.finish_reason ?? undefined
    return finishReason ? { finishReason } : {}
  } catch {
    return {}
  }
}
