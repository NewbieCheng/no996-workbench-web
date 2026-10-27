/**
 * 演示模式的确定性客户端。
 *
 * 内核只提供「机制」：把请求交给 flow 注入的 responder，由它按自己的业务 schema 造样例。
 * 这样内核保持零业务语义，同时 persona / titles / script 三个功能共用同一套 demo 判定。
 */
import type {
  AgentChatClient,
  AgentChatRequest,
  AgentChatResult,
  AgentClients,
  AgentSearchClient,
} from './types'
import { sleep, streamChunks } from './runtime'

/** flow 提供的演示应答器：返回 string 作为正文，返回对象则序列化为 JSON 正文 */
export type MockResponder = (
  request: AgentChatRequest,
  ctx: { call: number; stageHint?: string },
) => unknown | null

export type AgentClientOptions = {
  /** 本功能的演示应答器 */
  mockResponder?: MockResponder
  /** 本功能的演示检索结果 */
  mockSearch?: (query: string) => Array<{ title: string; snippet: string; url?: string }>
}

const DEFAULT_RESPONDER_TEXT = '（演示内容）当前为演示模式，未调用正式模型。'

export function createMockAgentClients(options: AgentClientOptions = {}): AgentClients {
  let call = 0

  const chat: AgentChatClient = {
    async complete(request: AgentChatRequest): Promise<AgentChatResult> {
      call += 1
      await sleep(140, request.signal)
      const produced = options.mockResponder?.(request, { call, stageHint: request.stageHint })
      const content =
        produced === null || produced === undefined
          ? DEFAULT_RESPONDER_TEXT
          : typeof produced === 'string'
            ? produced
            : JSON.stringify(produced)
      if (request.onDelta) await streamChunks(content, request.onDelta, request.signal)
      return { content }
    },
  }

  const search: AgentSearchClient = {
    async search(query) {
      const snippets = options.mockSearch?.(query) ?? [
        {
          title: `${query} · 演示检索结果`,
          snippet: '演示模式不进行真实联网检索，以下内容仅用于流程演示，不可作为事实依据。',
        },
      ]
      await sleep(120)
      return { query, snippets }
    },
  }

  return { chat, search, isMock: true }
}
