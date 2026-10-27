import { chatCompletions } from '../../../api/chat'
import { createTextStreamFilter } from '../../../agent/stream-filter'
import { streamChunks } from '../../../agent/runtime'
import { isWorkbenchAiDemoMode } from '../../../api/workbench-ai'
import { EMPTY_USER_FORM, type UserProfileFormData } from '../../../services/persona'
import type { PersonaQuestionnaire } from '../../../services/persona/types'
import {
  QUESTIONNAIRE_LABELS,
  projectLegacyUserForm,
  syncLegacyProjection,
} from '../../../services/persona/questionnaire'
import { formKeyForProfileLabel } from '../lib/profile-fields'

export type FormAssistMode = 'full' | 'optionalOnly'

export type AssistUserProfileFormInput = {
  brief?: string
  partial?: Partial<UserProfileFormData>
  mode?: FormAssistMode
  replaceExisting?: boolean
  signal?: AbortSignal
}

const FORM_KEYS: Array<keyof UserProfileFormData> = [
  'industry',
  'role',
  'primaryBusiness',
  'targetClients',
  'clientPainPoints',
  'desiredImage',
  'additionalInfo',
]

const OPTIONAL_KEYS: Array<keyof UserProfileFormData> = [
  'clientPainPoints',
  'desiredImage',
  'additionalInfo',
]

const DEMO_FORM: UserProfileFormData = {
  industry: '内容营销',
  role: '内容运营顾问',
  primaryBusiness: '为小团队提供选题梳理与内容流程咨询',
  targetClients: '刚开始做短视频的小微企业主',
  clientPainPoints: '选题乱、表达口径不统一',
  desiredImage: '专业、亲切，不夸大结果',
  additionalInfo: '曾协助团队整理选题流程，日常分享内容策划方法。',
}

function normalizeFormPatch(raw: unknown): Partial<UserProfileFormData> {
  if (!raw || typeof raw !== 'object') return {}
  const src = raw as Record<string, unknown>
  const patch: Partial<UserProfileFormData> = {}
  for (const key of FORM_KEYS) {
    const val = src[key]
    if (typeof val === 'string' && val.trim()) patch[key] = val.trim()
  }
  return patch
}

function parseJsonForm(content: string): Partial<UserProfileFormData> {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  const body = fenced ? fenced[1].trim() : trimmed
  try {
    return normalizeFormPatch(JSON.parse(body))
  } catch {
    throw new Error('AI 返回格式无法解析，请重试或手动填写。')
  }
}

export function mergeUserProfileForm(
  base: UserProfileFormData,
  patch: Partial<UserProfileFormData>,
  replaceExisting: boolean,
  keys: Array<keyof UserProfileFormData> = FORM_KEYS,
): UserProfileFormData {
  const next: UserProfileFormData = { ...base }
  for (const key of keys) {
    const val = patch[key]
    if (typeof val !== 'string' || !val.trim()) continue
    const current = next[key] ?? ''
    if (replaceExisting || !current.trim()) {
      next[key] = val.trim()
    }
  }
  return next
}

function buildSystemPrompt(mode: FormAssistMode): string {
  const fields =
    mode === 'optionalOnly'
      ? 'clientPainPoints, desiredImage, additionalInfo'
      : 'industry, role, primaryBusiness, targetClients, clientPainPoints, desiredImage, additionalInfo'

  return `你是人设定位表单的填写助手。根据用户描述推断表单字段，输出单个 JSON 对象，键名仅限：${fields}。
规则：
- 只写用户描述中能合理推断的内容，不编造具体履历、客户名单或业绩数字。
- 行业、职业身份、主要业务和目标客户必须填写且具体简短；其余可选字段可留空。
- 不要输出 markdown 或解释，只输出 JSON。`
}

function buildUserPrompt(input: AssistUserProfileFormInput, mode: FormAssistMode): string {
  const partial = input.partial ?? {}
  const known = FORM_KEYS
    .map((k) => {
      const v = partial[k]
      return typeof v === 'string' && v.trim() ? `${k}: ${v.trim()}` : null
    })
    .filter(Boolean)
    .join('\n')

  if (mode === 'optionalOnly') {
    return `根据以下已确认信息，补全可选字段（客户困扰、形象、补充资料）。已填：\n${known || '（无）'}`
  }

  const brief = input.brief?.trim()
  if (!brief) throw new Error('请先写一句描述，或手动填写下方字段。')
  const prefix = known ? `用户已填（勿随意改掉已有内容）：\n${known}\n\n` : ''
  return `${prefix}用户描述：\n${brief}`
}

async function demoAssist(
  input: AssistUserProfileFormInput,
  base: UserProfileFormData,
  mode: FormAssistMode,
): Promise<UserProfileFormData> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 350)
  })
  const replaceExisting = Boolean(input.replaceExisting)
  if (mode === 'optionalOnly') {
    return mergeUserProfileForm(base, DEMO_FORM, replaceExisting, OPTIONAL_KEYS)
  }
  const fromBrief: Partial<UserProfileFormData> = {
    industry: DEMO_FORM.industry,
    role: DEMO_FORM.role,
    primaryBusiness: input.brief?.trim()
      ? `${input.brief.trim()}（演示推断，非正式模型结论）`
      : DEMO_FORM.primaryBusiness,
    targetClients: DEMO_FORM.targetClients,
    clientPainPoints: DEMO_FORM.clientPainPoints,
    desiredImage: DEMO_FORM.desiredImage,
    additionalInfo: DEMO_FORM.additionalInfo,
  }
  return mergeUserProfileForm(base, fromBrief, replaceExisting)
}

const FIELD_LABEL_ZH: Record<keyof UserProfileFormData, string> = {
  industry: '所属行业',
  role: '职业身份',
  primaryBusiness: '主要业务',
  targetClients: '目标客户',
  clientPainPoints: '客户困扰',
  desiredImage: '希望建立的形象',
  additionalInfo: '补充资料',
}

export type PolishFieldInput = {
  field: keyof UserProfileFormData
  value: string
  form: UserProfileFormData
  instruction?: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}

function buildPolishSystemPrompt(field: keyof UserProfileFormData): string {
  return `你是人设定位文案助手。只润色或补全单个字段「${FIELD_LABEL_ZH[field]}」的文本；如果用户提出微调要求，只针对这个字段执行，不改动其他字段。
输出单个 JSON：{"value":"..."}，不要 markdown，不要解释。
规则：不编造履历与数据；语气专业、具体、简短；若用户未提供事实则根据同表其他已填字段合理推断，推断处保持克制。`
}

function buildPolishUserPrompt(input: PolishFieldInput): string {
  const context = FORM_KEYS
    .filter((k) => k !== input.field)
    .map((k) => {
      const v = input.form[k]
      return typeof v === 'string' && v.trim() ? `${FIELD_LABEL_ZH[k]}：${v.trim()}` : null
    })
    .filter(Boolean)
    .join('\n')

  const current = input.value.trim()
  const instruction = input.instruction?.trim()
  return `${instruction ? `微调要求：${instruction}\n\n` : ''}当前字段「${FIELD_LABEL_ZH[input.field]}」内容：
${current || '（空，请根据上下文补写一句）'}

其他已填信息：
${context || '（无）'}`
}

function parsePolishValue(content: string): string {
  const trimmed = content.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed)
  const body = fenced ? fenced[1].trim() : trimmed
  try {
    const json = JSON.parse(body) as { value?: string }
    if (typeof json.value === 'string' && json.value.trim()) return json.value.trim()
  } catch {
    if (trimmed && !trimmed.startsWith('{')) return trimmed
  }
  throw new Error('AI 润色结果无法解析，请重试。')
}

async function demoPolishField(input: PolishFieldInput): Promise<string> {
  await new Promise((resolve) => {
    window.setTimeout(resolve, 280)
  })
  const demo = DEMO_FORM[input.field]?.trim() ?? ''
  const current = input.value.trim()
  const instruction = input.instruction?.trim()
  if (instruction) return `${current || demo || `${FIELD_LABEL_ZH[input.field]}（演示补全）`}（演示微调：${instruction}）`
  if (!current) return demo || `${FIELD_LABEL_ZH[input.field]}（演示补全）`
  return `${current.replace(/[。．.]+$/u, '')}（表述已收紧，演示润色）`
}

export type PolishDocFieldInput = {
  fieldLabel: string
  value: string
  form: UserProfileFormData
  instruction?: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}

async function emitPolishStream(finalText: string, onPartial?: (displayText: string) => void, signal?: AbortSignal) {
  if (!onPartial) return
  let display = ''
  await streamChunks(
    finalText,
    (chunk) => {
      display += chunk
      onPartial(display)
    },
    signal,
  )
}

async function requestPolishValue(input: {
  system: string
  user: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}): Promise<string> {
  let raw = ''
  let display = ''
  const filter = createTextStreamFilter({ keys: ['value'] })

  const result = await chatCompletions({
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.45,
    max_tokens: 400,
    signal: input.signal,
    stream: Boolean(input.onPartial),
    onDelta: input.onPartial
      ? (chunk) => {
          raw += chunk
          const delta = filter.push(chunk)
          if (delta) {
            display += delta
            input.onPartial?.(display)
          }
        }
      : undefined,
  })

  const content = result.choices[0]?.message?.content ?? raw
  if (!content?.trim()) throw new Error('AI 未返回润色结果，请重试。')
  return parsePolishValue(content)
}

function buildGenericPolishSystemPrompt(fieldLabel: string): string {
  return `你是人设定位文案助手。只润色或补全单个字段「${fieldLabel}」的文本；如果用户提出微调要求，只针对这个字段执行。
输出单个 JSON：{"value":"..."}，不要 markdown，不要解释。
规则：不编造履历与数据；语气专业、具体、简短。`
}

function buildGenericPolishUserPrompt(input: PolishDocFieldInput): string {
  const context = FORM_KEYS
    .map((k) => {
      const v = input.form[k]
      return typeof v === 'string' && v.trim() ? `${FIELD_LABEL_ZH[k]}：${v.trim()}` : null
    })
    .filter(Boolean)
    .join('\n')
  const instruction = input.instruction?.trim()
  const current = input.value.trim()
  return `${instruction ? `微调要求：${instruction}\n\n` : ''}当前字段「${input.fieldLabel}」内容：
${current || '（空，请根据上下文补写一句）'}

其他已填信息：
${context || '（无）'}`
}

export async function polishProfileDocField(input: PolishDocFieldInput): Promise<string> {
  const mapped = formKeyForProfileLabel(input.fieldLabel)
  if (mapped) {
    return polishUserProfileField({
      field: mapped,
      value: input.value,
      form: input.form,
      instruction: input.instruction,
      signal: input.signal,
      onPartial: input.onPartial,
    })
  }

  if (isWorkbenchAiDemoMode()) {
    await new Promise((resolve) => {
      window.setTimeout(resolve, 280)
    })
    const current = input.value.trim()
    const instruction = input.instruction?.trim()
    const result = instruction
      ? `${current || `${input.fieldLabel}（演示补全）`}（演示微调：${instruction}）`
      : current
        ? `${current.replace(/[。．.]+$/u, '')}（表述已收紧，演示润色）`
        : `${input.fieldLabel}（演示补全）`
    await emitPolishStream(result, input.onPartial, input.signal)
    return result
  }

  return requestPolishValue({
    system: buildGenericPolishSystemPrompt(input.fieldLabel),
    user: buildGenericPolishUserPrompt(input),
    signal: input.signal,
    onPartial: input.onPartial,
  })
}

export async function polishUserProfileField(input: PolishFieldInput): Promise<string> {
  if (isWorkbenchAiDemoMode()) {
    const result = await demoPolishField(input)
    await emitPolishStream(result, input.onPartial, input.signal)
    return result
  }

  return requestPolishValue({
    system: buildPolishSystemPrompt(input.field),
    user: buildPolishUserPrompt(input),
    signal: input.signal,
    onPartial: input.onPartial,
  })
}

export async function assistUserProfileForm(input: AssistUserProfileFormInput): Promise<UserProfileFormData> {
  const mode = input.mode ?? 'full'
  const replaceExisting = Boolean(input.replaceExisting)
  const base: UserProfileFormData = {
    ...EMPTY_USER_FORM,
    ...input.partial,
  }

  if (isWorkbenchAiDemoMode()) {
    return demoAssist(input, base, mode)
  }

  const result = await chatCompletions({
    messages: [
      { role: 'system', content: buildSystemPrompt(mode) },
      { role: 'user', content: buildUserPrompt(input, mode) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 1200,
    signal: input.signal,
  })

  const content = result.choices[0]?.message?.content
  if (!content?.trim()) throw new Error('AI 未返回内容，请重试。')

  const patch = parseJsonForm(content)
  const keys = mode === 'optionalOnly' ? OPTIONAL_KEYS : FORM_KEYS
  const merged = mergeUserProfileForm(base, patch, replaceExisting, keys)
  if (mode === 'full') {
    if (!merged.industry.trim() || !merged.role.trim() || !merged.primaryBusiness.trim() || !merged.targetClients?.trim()) {
      throw new Error('AI 草稿缺少必填项，请补充行业、身份、主要业务和目标客户。')
    }
  }
  return merged
}

const LEGACY_POLISH_MAP: Partial<Record<keyof PersonaQuestionnaire, keyof UserProfileFormData>> = {
  occupation: 'role',
  products: 'primaryBusiness',
  audiences: 'targetClients',
  clientSituations: 'clientPainPoints',
  keyword1: 'desiredImage',
  differentiation: 'additionalInfo',
}

export type PolishQuestionnaireInput = {
  field: keyof PersonaQuestionnaire
  value: string
  form: PersonaQuestionnaire
  instruction?: string
  signal?: AbortSignal
  onPartial?: (displayText: string) => void
}

export async function polishQuestionnaireField(input: PolishQuestionnaireInput): Promise<string> {
  const legacyKey = LEGACY_POLISH_MAP[input.field]
  const legacyForm = projectLegacyUserForm(syncLegacyProjection(input.form))
  if (legacyKey) {
    return polishUserProfileField({
      field: legacyKey,
      value: input.value,
      form: legacyForm,
      instruction: input.instruction,
      signal: input.signal,
      onPartial: input.onPartial,
    })
  }

  const label =
    QUESTIONNAIRE_LABELS.find(([, key]) => key === input.field)?.[0] ?? String(input.field)

  return polishProfileDocField({
    fieldLabel: label,
    value: input.value,
    form: legacyForm,
    instruction: input.instruction,
    signal: input.signal,
    onPartial: input.onPartial,
  })
}
