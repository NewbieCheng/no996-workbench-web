import type { AgentStageDef } from './types'

const CANVAS_PREVIEW_MAX = 12_000
const THINKING_KEYS = ['假设', 'assumptions', 'reasoning', '思考', 'thinking'] as const

function stripPromptFields(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(stripPromptFields)
  if (typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'actualPrompt' || k === 'prompt') continue
    out[k] = stripPromptFields(v)
  }
  return out
}

/**
 * 流程大图 / 步骤详情用：展示本步产出（不含提示词），避免「已完成运算」类黑盒文案。
 */
export function formatStageOutputPreview(
  output: unknown,
  options?: { kind?: AgentStageDef['kind']; maxLen?: number },
): string {
  const maxLen = options?.maxLen ?? CANVAS_PREVIEW_MAX
  const kind = options?.kind

  if (output === null || output === undefined) return ''

  if (typeof output === 'string') {
    const t = output.trim()
    return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t
  }

  if (typeof output === 'number' || typeof output === 'boolean') {
    return String(output)
  }

  if (kind === 'tool') {
    if (typeof output === 'string') return output
    if (Array.isArray(output)) {
      const preview = formatStageOutputPreview(stripPromptFields(output), { maxLen })
      return preview ? `检索结果摘要：\n${preview}` : '已执行检索（无结构化摘要）'
    }
    const json = JSON.stringify(stripPromptFields(output), null, 2)
    return json.length > maxLen ? `${json.slice(0, maxLen)}…` : json || '已执行检索'
  }

  const cleaned = stripPromptFields(output)
  let text: string
  try {
    text = JSON.stringify(cleaned, null, 2)
  } catch {
    text = String(cleaned)
  }
  if (!text || text === '{}' || text === '[]') return ''
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text
}

function extractThinkingFromObject(output: unknown): string {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return ''
  const o = output as Record<string, unknown>
  for (const key of THINKING_KEYS) {
    const v = o[key]
    if (v === null || v === undefined) continue
    const t = String(v).trim()
    if (t) return t
  }
  return ''
}

function formatReasoningHistory(
  history: Array<{ turn: number; text: string }> | undefined,
  current: string | undefined,
): string {
  const parts = (history ?? [])
    .map(({ turn, text }) => {
      const content = text.trim()
      return content ? `第 ${turn} 轮思考：\n${content}` : ''
    })
    .filter(Boolean)
  const currentText = current?.trim()
  if (currentText) {
    parts.push(history?.length ? `当前轮思考：\n${currentText}` : currentText)
  }
  return parts.join('\n\n')
}

function stripThinkingFromOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return output
  const o = { ...(output as Record<string, unknown>) }
  for (const key of THINKING_KEYS) delete o[key]
  return o
}

/** 从不完整 JSON 流里抠出「假设」等思考字段（供侧栏遮挡区预览） */
export function extractThinkingFromPartialJson(raw: string): string {
  const text = raw.trim()
  if (!text) return ''
  for (const key of THINKING_KEYS) {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, 'u')
    const m = text.match(re)
    if (m?.[1]) {
      return m[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim()
    }
    const reBare = new RegExp(`"${key}"\\s*:\\s*([^,}\\]]+)`, 'u')
    const bare = text.match(reBare)
    if (bare?.[1]) return bare[1].replace(/^"|"$/g, '').trim()
  }
  return ''
}

export function prettifyJsonPreview(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  try {
    return JSON.stringify(JSON.parse(t), null, 2)
  } catch {
    return t
  }
}

export type StageOutputLayers = {
  product: string
  thinking: string
}

export function resolveStageOutputLayers(
  stageState?: {
    output?: unknown
    streamingContent?: string
    streamingReasoningContent?: string
    reasoningHistory?: Array<{ turn: number; text: string }>
    error?: string
  },
  options?: {
    isRunning?: boolean
    /** 页内卡片过滤后的流（如标题字段）；画布优先用 streamingContent */
    stream?: string
    kind?: AgentStageDef['kind']
  },
): StageOutputLayers {
  const { isRunning, stream, kind } = options ?? {}
  const streamRaw =
    stageState?.streamingContent?.trim() ||
    (isRunning && stream?.trim() ? stream.trim() : '') ||
    ''

  let thinking =
    formatReasoningHistory(stageState?.reasoningHistory, stageState?.streamingReasoningContent) ||
    extractThinkingFromObject(stageState?.output) ||
    ''
  if (!thinking && streamRaw) thinking = extractThinkingFromPartialJson(streamRaw)

  if (stageState?.error?.trim()) {
    return { product: stageState.error.trim(), thinking }
  }

  if (isRunning && streamRaw) {
    return {
      product: prettifyJsonPreview(streamRaw) || streamRaw,
      thinking,
    }
  }

  if (stageState?.output !== undefined && stageState?.output !== null) {
    const product = formatStageOutputPreview(stripThinkingFromOutput(stageState.output), { kind })
    if (!thinking) thinking = extractThinkingFromObject(stageState.output)
    return { product, thinking }
  }

  if (streamRaw) {
    return { product: prettifyJsonPreview(streamRaw) || streamRaw, thinking }
  }

  if (kind === 'tool') return { product: '已执行检索（无结构化摘要）', thinking: '' }
  return { product: '', thinking }
}

export function resolveStageDisplayText(
  stageState?: {
    output?: unknown
    streamingContent?: string
    streamingReasoningContent?: string
    reasoningHistory?: Array<{ turn: number; text: string }>
    error?: string
  },
  options?: {
    isRunning?: boolean
    stream?: string
    kind?: AgentStageDef['kind']
  },
): string {
  const { product } = resolveStageOutputLayers(stageState, options)
  if (product) return product
  return ''
}
