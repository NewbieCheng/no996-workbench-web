import type { AgentToolCall } from './types'

const GENERIC_SEARCH_QUERIES = new Set([
  '检索',
  '搜索',
  '查找',
  '查询',
  '资料',
  '信息',
  '调研',
  'research',
  'search',
])

/** 解析模型的 web_search 参数；无效参数保持为空，不伪造「检索」查询。 */
export function parseSearchToolArguments(raw: string): AgentToolCall['arguments'] {
  const text = raw.trim()
  if (!text) return {}

  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {}
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  const args = value as Record<string, unknown>
  const query =
    typeof args.query === 'string'
      ? args.query
      : Array.isArray(args.queries)
        ? args.queries.find((item): item is string => typeof item === 'string')
        : undefined
  return typeof query === 'string' && query.trim() ? { ...args, query: query.trim() } : {}
}

/** 拦截模型偶尔生成的泛化占位词，避免为无效搜索发起真实请求。 */
export function isGenericSearchQuery(query: string): boolean {
  const normalized = query.trim().toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '')
  return GENERIC_SEARCH_QUERIES.has(normalized)
}

export const SEARCH_QUERY_REPAIR_GUIDANCE =
  '检索词无效或过于宽泛。请从用户提供的行业、主要业务、目标客户或具体问题中提取关键词，组成明确的主题检索词；不要使用“检索”“搜索”“资料”等泛词。'
