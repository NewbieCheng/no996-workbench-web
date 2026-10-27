import type { VoiceDubSegment } from '../agent/types'

export type ParsedPlannerSegment = Pick<
  VoiceDubSegment,
  'id' | 'title' | 'text' | 'instruction'
> & {
  partial?: boolean
}

/**
 * 纯解析器：不 import i18n（i18n 初始化依赖 import.meta.glob，纯函数测试无法加载）。
 * 文案由调用方传入；未传时用中文兜底，保持既有界面文案不变。
 */
export type PlannerStreamLabels = {
  /** 段落缺标题时的占位，如「段落 2」 */
  segmentTitle?: (index: number) => string
  /** 只有标题、还没有 segments 时展示的正文占位 */
  structuring?: string
}

const DEFAULT_STRUCTURING = '分段结构生成中…'

function mapSegmentObject(
  raw: Record<string, unknown>,
  idx: number,
  partial: boolean,
  labels?: PlannerStreamLabels,
): ParsedPlannerSegment {
  const seg: ParsedPlannerSegment = {
    id: String(raw.id || `seg_${idx + 1}`),
    title: String(
      raw.title || labels?.segmentTitle?.(idx + 1) || `段落 ${idx + 1}`,
    ),
    text: String(raw.text || ''),
    instruction: String(raw.instruction || ''),
  }
  if (partial) seg.partial = true
  return seg
}

function looseParseSegmentObject(slice: string): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const pick = (key: string) => {
    const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(slice)
    return m ? m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\') : undefined
  }
  const id = pick('id')
  const title = pick('title')
  const text = pick('text')
  const instruction = pick('instruction')
  if (id) out.id = id
  if (title) out.title = title
  if (text !== undefined) out.text = text
  if (instruction) out.instruction = instruction
  return out
}

function findMatchingBrace(json: string, start: number): number {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < json.length; i++) {
    const ch = json[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (ch === '\\') {
        escape = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

function extractSegmentObjects(partialJson: string): Array<{ raw: Record<string, unknown>; partial: boolean }> {
  const keyMatch = partialJson.match(/"segments"\s*:\s*\[/)
  if (!keyMatch || keyMatch.index === undefined) return []

  const arrayStart = partialJson.indexOf('[', keyMatch.index)
  if (arrayStart < 0) return []

  const out: Array<{ raw: Record<string, unknown>; partial: boolean }> = []
  let i = arrayStart + 1

  while (i < partialJson.length) {
    while (i < partialJson.length && /[\s,]/.test(partialJson[i])) i += 1
    if (i >= partialJson.length || partialJson[i] === ']') break
    if (partialJson[i] !== '{') break

    const end = findMatchingBrace(partialJson, i)
    if (end < 0) {
      const slice = partialJson.slice(i)
      const loose = looseParseSegmentObject(slice)
      if (Object.keys(loose).length) {
        out.push({ raw: loose, partial: true })
      }
      break
    }

    try {
      const parsed = JSON.parse(partialJson.slice(i, end + 1)) as Record<string, unknown>
      out.push({ raw: parsed, partial: false })
    } catch {
      // skip malformed object
    }
    i = end + 1
  }

  return out
}

function pickJsonStringField(raw: string, key: string): string | null {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`).exec(raw)
  if (!m) return null
  return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

/** 流式 JSON 中已出现的方案标题（segments 未出时用于预览）。 */
export function parsePlannerStreamTitle(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const title = pickJsonStringField(trimmed, 'title')?.trim()
  return title || null
}

/** 从 segment_planner 的 streamingContent（可能不完整 JSON）解析已出现的 segments。 */
export function parsePlannerStreamContent(
  raw: string,
  labels?: PlannerStreamLabels,
): ParsedPlannerSegment[] {
  const trimmed = raw.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as { segments?: unknown[] }
    if (Array.isArray(parsed.segments)) {
      return parsed.segments.map((item, idx) =>
        mapSegmentObject(
          item && typeof item === 'object' ? (item as Record<string, unknown>) : {},
          idx,
          false,
          labels,
        ),
      )
    }
  } catch {
    // fall through to partial extraction
  }

  const objects = extractSegmentObjects(trimmed)
  if (objects.length) {
    return objects.map((entry, idx) => mapSegmentObject(entry.raw, idx, entry.partial, labels))
  }

  const titleOnly = parsePlannerStreamTitle(trimmed)
  if (titleOnly) {
    return [
      {
        id: 'stream_title',
        title: titleOnly,
        text: labels?.structuring || DEFAULT_STRUCTURING,
        instruction: '',
        partial: true,
      },
    ]
  }

  return []
}
