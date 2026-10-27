import type { MomentsPlanInput } from './types'
import { weekRange } from '../service/week-range.ts'
import type {
  MomentsContentDraft,
  MomentsErrorCode,
  MomentsRunOutcome,
  MomentsVersionMeta,
} from '../domain/moments'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((row) => (typeof row === 'string' ? row : '')) : []
}

/** 取最后一个 json 围栏；没有则返回 null。 */
export function extractJsonFence(text: string): string | null {
  const re = /```json\s*\n([\s\S]*?)```/gi
  let last: string | null = null
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) last = match[1] ?? ''
  return last === null ? null : last.trim()
}

function parseErrorBlock(
  payload: Record<string, unknown>,
  fallbackCode: MomentsErrorCode,
): { code: MomentsErrorCode; message: string; details?: string[]; recoveryAction?: string } {
  const error = asRecord(payload.error)
  const rawCode = asTrimmed(error?.code)
  const code: MomentsErrorCode =
    rawCode === 'USER_PROFILE_REQUIRED' || rawCode === 'INVALID_INPUT' || rawCode === 'QC_FAILED'
      ? rawCode
      : fallbackCode
  const details = Array.isArray(error?.details)
    ? error.details.map((row) => (typeof row === 'string' ? row.trim() : '')).filter(Boolean)
    : undefined
  const recoveryAction = asTrimmed(error?.recoveryAction)
  return {
    code,
    message: asTrimmed(error?.message) || '本次处理没有完成',
    ...(details?.length ? { details } : {}),
    ...(recoveryAction ? { recoveryAction } : {}),
  }
}

export function parseMomentsEnvelope(text: string): Record<string, unknown> {
  const fence = extractJsonFence(text)
  if (fence === null) throw new Error('AI 输出缺少 json 围栏块')
  let parsed: unknown
  try {
    parsed = JSON.parse(fence)
  } catch {
    throw new Error('AI 输出的 json 围栏块无法解析')
  }
  const payload = asRecord(parsed)
  if (!payload) throw new Error('AI 输出的 json 围栏块不是对象')
  return payload
}

export interface MomentsPlanItemDraft {
  publishOrder: number
  contentDirection: string
  topic: string
  captureSuggestion?: string
}

export interface MomentsPlanDayDraft {
  date: string
  items: MomentsPlanItemDraft[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseMomentsPlanOutput(text: string, expected?: MomentsPlanInput): MomentsRunOutcome<{ days: MomentsPlanDayDraft[] }> {
  const payload = parseMomentsEnvelope(text)
  const status = asTrimmed(payload.status)

  if (status !== 'success') {
    const error = parseErrorBlock(payload, status === 'failed' ? 'QC_FAILED' : 'INVALID_INPUT')
    return { status: status === 'failed' ? 'failed' : 'blocked', ...error }
  }

  const rawDays = payload.days
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return { status: 'blocked', code: 'INVALID_INPUT', message: '规划结果缺少 days', details: ['days 为空'] }
  }

  const days: MomentsPlanDayDraft[] = []
  for (const rawDay of rawDays) {
    const day = asRecord(rawDay)
    const date = asTrimmed(day?.date)
    if (!DATE_RE.test(date)) {
      return {
        status: 'blocked',
        code: 'INVALID_INPUT',
        message: '规划结果包含非法日期',
        details: [`date 不是 YYYY-MM-DD：${date || '(空)'}`],
      }
    }
    const rawItems = day?.items
    if (!Array.isArray(rawItems)) {
      return {
        status: 'blocked',
        code: 'INVALID_INPUT',
        message: `规划结果中 ${date} 没有排期条目`,
        details: [`${date}.items 为空`],
      }
    }
    const items: MomentsPlanItemDraft[] = []
    for (const rawItem of rawItems) {
      const item = asRecord(rawItem)
      const publishOrder = Number(item?.publishOrder)
      const contentDirection = asTrimmed(item?.contentDirection)
      const topic = asTrimmed(item?.topic)
      if (!Number.isInteger(publishOrder) || publishOrder < 1) {
        return {
          status: 'blocked',
          code: 'INVALID_INPUT',
          message: `规划结果中 ${date} 的发布顺序非法`,
          details: [`${date}.publishOrder 必须是正整数`],
        }
      }
      if (!contentDirection || !topic) {
        return {
          status: 'blocked',
          code: 'INVALID_INPUT',
          message: `规划结果中 ${date} 第 ${publishOrder} 条缺少内容方向或一句话选题`,
          details: ['contentDirection 与 topic 均不可为空'],
        }
      }
      const captureSuggestion = asTrimmed(item?.captureSuggestion)
      items.push({
        publishOrder,
        contentDirection,
        topic,
        ...(captureSuggestion ? { captureSuggestion } : {}),
      })
    }
    days.push({ date, items: items.sort((a, b) => a.publishOrder - b.publishOrder) })
  }

  const planningMode = asTrimmed(payload.planningMode)
  if (planningMode && planningMode !== 'daily' && planningMode !== 'theme') {
    return {
      status: 'blocked',
      code: 'INVALID_INPUT',
      message: '规划模式不受支持',
      details: [`planningMode=${planningMode}；只接受 daily | theme`],
    }
  }

  if (expected) {
    const dates = weekRange(expected.planPeriod.startDate).dates
    const invalid = planningMode !== expected.planningMode || days.length !== 7 ||
      days.some((day, index) => {
        const count = expected.publishSpec.kind === 'daily'
          ? expected.publishSpec.perDay[index]
          : Math.floor(expected.publishSpec.perWeek / 7) + (index < expected.publishSpec.perWeek % 7 ? 1 : 0)
        return day.date !== dates[index] || day.items.length !== count ||
          day.items.some((item, order) => item.publishOrder !== order + 1)
      })
    if (invalid) return { status: 'blocked', code: 'INVALID_INPUT', message: '规划结果的日期、数量、顺序或模式不符合要求' }
  }
  return { status: 'success', value: { days: days.sort((a, b) => a.date.localeCompare(b.date)) } }
}

const FALLBACK_ANGLES = ['版本一', '版本二', '版本三'] as const

function parseVersionMeta(value: unknown, versions: string[]): MomentsVersionMeta[] {
  const rows = Array.isArray(value) ? value : []
  return versions.map((_, index) => {
    const row = asRecord(rows[index])
    const angleTitle = asTrimmed(row?.angleTitle) || FALLBACK_ANGLES[index] || `版本${index + 1}`
    const imageSuggestion = asTrimmed(row?.imageSuggestion)
    const naturalBridge = asTrimmed(row?.naturalBridge)
    return {
      version: index,
      angleTitle,
      ...(imageSuggestion ? { imageSuggestion } : {}),
      ...(naturalBridge ? { naturalBridge } : {}),
    }
  })
}

export function parseMomentsCopyOutput(
  text: string,
  knownItemIds: Set<string>,
): MomentsRunOutcome<MomentsContentDraft[]> {
  const payload = parseMomentsEnvelope(text)
  const status = asTrimmed(payload.status)

  if (status !== 'success') {
    const error = parseErrorBlock(payload, status === 'failed' ? 'QC_FAILED' : 'INVALID_INPUT')
    return { status: status === 'failed' ? 'failed' : 'blocked', ...error }
  }

  const day = asRecord(payload.day)
  const rawContents = day?.contents
  if (!Array.isArray(rawContents) || rawContents.length === 0) {
    return {
      status: 'blocked',
      code: 'INVALID_INPUT',
      message: '文案结果缺少 day.contents',
      details: ['day.contents 为空'],
    }
  }

  const drafts: MomentsContentDraft[] = []
  for (const rawContent of rawContents) {
    const content = asRecord(rawContent)
    const scheduleItemId = asTrimmed(content?.scheduleItemId)
    if (!scheduleItemId || !knownItemIds.has(scheduleItemId)) {
      return {
        status: 'blocked',
        code: 'INVALID_INPUT',
        message: '文案结果引用了未知的排期条目',
        details: [`scheduleItemId=${scheduleItemId || '(空)'} 不在本次输入中`],
      }
    }
    const versions = asStringArray(content?.versions)
    if (versions.length !== 3 || versions.some((body) => !body.trim())) {
      return {
        status: 'blocked',
        code: 'INVALID_INPUT',
        message: '文案结果必须为每个条目提供三个非空版本',
        details: [`${scheduleItemId} 的 versions 不是三个非空字符串`],
      }
    }
    const contentDirection = asTrimmed(content?.contentDirection)
    const topic = asTrimmed(content?.topic)
    if (!contentDirection || !topic) {
      return {
        status: 'blocked',
        code: 'INVALID_INPUT',
        message: '文案结果缺少内容方向或一句话选题',
        details: [`${scheduleItemId} 的 contentDirection / topic 为空`],
      }
    }
    const rawVersion = Number(content?.currentVersion)
    drafts.push({
      scheduleItemId,
      contentDirection,
      topic,
      versions,
      versionMeta: parseVersionMeta(content?.versionMeta, versions),
      currentVersion: Number.isInteger(rawVersion) && rawVersion >= 0 && rawVersion <= 2 ? rawVersion : 0,
    })
  }

  return { status: 'success', value: drafts }
}
