import { applyChatCompletionStreamPayload } from './chat-stream-parse';
import { ensureAccessToken } from './client';
import { throwApiError } from './errors';
import { defaultReasoningEffort } from './workbench-ai';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | ChatContentPart[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export type ChatToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatCompletionChoice = {
  index: number;
  message: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
  finish_reason: string;
};

export type ChatCompletionResult = {
  id: string;
  choices: ChatCompletionChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type ChatCompletionParams = {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: ChatToolDefinition[];
  tool_choice?: string | Record<string, unknown>;
  stream?: boolean;
  response_format?: { type: 'json_object' | 'text' };
  /** 思考强度。后端要求取值必须在模型 reasoning_efforts 列表内；off 表示关闭。 */
  reasoning_effort?: string;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
  /** 推理模型思考增量（OpenAI 兼容字段 reasoning_content） */
  onReasoningDelta?: (chunk: string) => void;
};

export async function chatCompletions(params: ChatCompletionParams): Promise<ChatCompletionResult> {
  const useStream = Boolean(params.stream && (params.onDelta || params.onReasoningDelta))
  const body: Record<string, unknown> = {
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 4096,
    stream: useStream,
  }
  if (params.tools?.length) {
    body.tools = params.tools
    body.tool_choice = params.tool_choice ?? 'auto'
  }
  if (params.response_format) body.response_format = params.response_format
  const effort = params.reasoning_effort ?? defaultReasoningEffort()
  if (effort) body.reasoning_effort = effort

  const token = await ensureAccessToken()
  if (!token) throw new Error('请先登录')

  try {
    if (useStream) {
      return await chatCompletionsStream(body, token, {
        onDelta: params.onDelta,
        onReasoningDelta: params.onReasoningDelta,
        signal: params.signal,
      })
    }
    const res = await fetch('/api/v1/ai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: params.signal,
    })
    if (!res.ok) throw await httpError(res)
    return (await res.json()) as ChatCompletionResult
  } catch (err) {
    throwApiError(err)
  }
}


/**
 * 把非 2xx 响应转成携带状态码的错误。
 *
 * 两个必须保留的信息（真实 API 复测：出现过**响应体完全为空**的 500）：
 * 1. `response.status` —— 内核据此判断「5xx 可重试 / 4xx 不重试」；
 * 2. 可读文案 —— 空响应体时不能退化成 axios 的
 *    `Request failed with status code 500`，要说明是服务端问题。
 */
async function httpError(res: Response): Promise<Error & { response: { status: number; data: unknown } }> {
  const raw = await res.text().catch(() => '');
  let data: unknown = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }
  const detail = (data as { error?: { message?: string } })?.error?.message;
  const message =
    detail ??
    (res.status >= 500
      ? `模型服务暂时不可用（HTTP ${res.status}），请稍后重试。`
      : res.statusText || `请求失败（HTTP ${res.status}）`);
  return Object.assign(new Error(message), { response: { status: res.status, data } });
}

async function chatCompletionsStream(
  body: Record<string, unknown>,
  token: string,
  handlers: {
    onDelta?: (chunk: string) => void;
    onReasoningDelta?: (chunk: string) => void;
    signal?: AbortSignal;
  },
): Promise<ChatCompletionResult> {
  const { onDelta, onReasoningDelta, signal } = handlers;
  const res = await fetch('/api/v1/ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw await httpError(res);
  if (!res.body) throw new Error('流式响应不可用');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  const id = 'stream';
  const toolCalls = new Map<number, {
    id?: string
    name: string
    arguments: string
  }>()
  let nextToolCallIndex = 0
  /** 上游真实的结束原因。不能自己编：`length` 意味着正文被截断，上层必须知道。 */
  let upstreamFinish: string | undefined

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      const parsed = applyChatCompletionStreamPayload(payload, {
        onContent: (chunk) => {
          fullContent += chunk;
          onDelta?.(chunk);
        },
        onReasoning: onReasoningDelta,
      });
      if (parsed.finishReason) upstreamFinish = parsed.finishReason;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{
            delta?: {
              tool_calls?: Array<{
                index?: number
                id?: string
                function?: { name?: string; arguments?: string }
              }>
            }
          }>
        }
        const delta = json.choices?.[0]?.delta
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = Number.isInteger(tc.index)
              ? tc.index!
              : tc.id
                ? [...toolCalls].find(([, call]) => call.id === tc.id)?.[0] ?? nextToolCallIndex
                : nextToolCallIndex
            nextToolCallIndex = Math.max(nextToolCallIndex, index + 1)
            const existing = toolCalls.get(index) ?? { name: '', arguments: '' }
            if (tc.id) existing.id = tc.id
            if (tc.function?.name) existing.name += tc.function.name
            if (tc.function?.arguments) existing.arguments += tc.function.arguments
            toolCalls.set(index, existing)
          }
        }
      } catch {
        // tool_calls 解析失败时忽略
      }
    }
  }

  const completedToolCalls = [...toolCalls.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, call]) => call.id
      ? [{
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: call.arguments },
        }]
      : [])
  const finishReason = upstreamFinish ?? (completedToolCalls.length ? 'tool_calls' : 'stop')
  return {
    id,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: fullContent || null,
          tool_calls: completedToolCalls.length ? completedToolCalls : undefined,
        },
        finish_reason: finishReason,
      },
    ],
  }
}

export function webSearchToolDefinition(description: string): ChatToolDefinition {
  return {
    type: 'function',
    function: {
      name: 'web_search',
      description: `${description} 必须依据用户资料进行主题相关的定向检索，不得使用“检索”“搜索”“资料”等泛词。`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '必填。使用用户资料中的具体行业、业务、目标客户或问题组合关键词。',
          },
          purpose: {
            type: 'string',
            description: '必填。用一句话说明这次检索要补充人设/标题/脚本中的哪类事实，以及这些事实如何用于当前任务。',
          },
        },
        required: ['query', 'purpose'],
        additionalProperties: false,
      },
    },
  }
}
