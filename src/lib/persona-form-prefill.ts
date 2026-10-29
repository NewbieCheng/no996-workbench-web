import { fieldValue, parseMainProfile } from '../features/persona/lib/account-card.ts'
import { normalizeQuestionnaire } from '../services/persona/questionnaire.ts'
import type { ScriptConfig } from '../features/script-lab/agent/types'
import type { SocialStudioBrief, VoiceTone } from '../features/social-studio/creative/social-studio-brief-types'
import type {
  CompanyProfileFormData,
  PersonaRecord,
  UserProfileFormData,
} from '../services/persona/types'

export type PrefillResult<T> = {
  patch: Partial<T>
  /** 本次新写入的字段 key 数量 */
  filledCount: number
  personaName: string
}

function isUserForm(
  record: PersonaRecord,
): record is PersonaRecord & { kind: 'user'; formData: UserProfileFormData } {
  return record.kind === 'user'
}

function isCompanyForm(
  record: PersonaRecord,
): record is PersonaRecord & { kind: 'company'; formData: CompanyProfileFormData } {
  return record.kind === 'company'
}

function audienceFromUser(form: UserProfileFormData): string {
  const q = normalizeQuestionnaire(form)
  const clients = q.audiences.trim() || form.targetClients?.trim()
  if (clients) return clients
  const role = q.role?.trim() || q.occupation.trim()
  const industry = q.industry?.trim() ?? ''
  if (role && industry && role !== industry) return `${role}（${industry}）`
  return role || industry
}

function profileField(record: PersonaRecord, section: 'audience' | 'positioning' | 'packaging', label: string): string {
  const parsed = parseMainProfile(record.content)
  if (!parsed) return ''
  return fieldValue(parsed[section], label).trim()
}

function audienceFromCompany(form: CompanyProfileFormData): string {
  return form.targetMarket?.trim() ?? ''
}

export function deriveScriptPrefillPatch(
  record: PersonaRecord,
  config: ScriptConfig,
): PrefillResult<ScriptConfig> {
  const patch: Partial<ScriptConfig> = {}
  let filledCount = 0

  const fill = <K extends keyof ScriptConfig>(key: K, value: ScriptConfig[K] | undefined) => {
    if (value === undefined) return
    if (typeof value === 'string' && !value.trim()) return
    if (Array.isArray(value) && value.length === 0) return
    const current = config[key]
    if (typeof current === 'string' && current.trim()) return
    if (Array.isArray(current) && current.length > 0) return
    patch[key] = value
    filledCount += 1
  }

  if (isUserForm(record)) {
    const form = record.formData
    // 只预填「受众侧」字段。
    // intro（产品一句话介绍）与 sellingPoints（卖点）是本次产品的专属事实，
    // 不是人设自己的主营业务；从人设自动填进来会让用户换个产品后，
    // 正文仍然在讲人设的生意（2026-10-29 修复）。
    fill('audience', profileField(record, 'audience', '核心客户') || audienceFromUser(form))
    fill('pain', profileField(record, 'audience', '三大痛点') || form.clientPainPoints?.trim() || normalizeQuestionnaire(form).clientSituations)
  } else if (isCompanyForm(record)) {
    const form = record.formData
    fill('audience', audienceFromCompany(form))
  }

  return {
    patch,
    filledCount,
    personaName: record.name.trim() || '人设',
  }
}

export type TitlesPrefillInput = {
  audience: string
  supplement?: string
}

export function deriveTitlesPrefillPatch(
  record: PersonaRecord,
  input: TitlesPrefillInput,
): PrefillResult<TitlesPrefillInput> {
  const patch: Partial<TitlesPrefillInput> = {}
  let filledCount = 0

  const fillAudience = (value: string) => {
    if (!value.trim()) return
    if (input.audience.trim()) return
    patch.audience = value.trim()
    filledCount += 1
  }

  const appendSupplement = (line: string) => {
    if (!line.trim()) return
    if (input.supplement?.trim()) return
    patch.supplement = line.trim()
    filledCount += 1
  }

  if (isUserForm(record)) {
    const form = record.formData
    fillAudience(profileField(record, 'audience', '核心客户') || audienceFromUser(form))
    const pain =
      profileField(record, 'audience', '三大痛点') ||
      form.clientPainPoints?.trim() ||
      normalizeQuestionnaire(form).clientSituations
    if (pain) appendSupplement(`受众困扰：${pain}`)
    const extra = form.additionalInfo?.trim() || normalizeQuestionnaire(form).differentiation
    if (extra && !patch.supplement) appendSupplement(extra)
  } else if (isCompanyForm(record)) {
    const form = record.formData
    fillAudience(audienceFromCompany(form))
    const extra = form.additionalInfo?.trim()
    if (extra) appendSupplement(extra)
  }

  return {
    patch,
    filledCount,
    personaName: record.name.trim() || '人设',
  }
}

function resolveVoiceToneFromDesiredImage(desiredImage?: string): VoiceTone | undefined {
  if (!desiredImage?.trim()) return undefined
  const text = desiredImage.trim().toLowerCase()
  if (text.includes('闺蜜') || text.includes('贴心') || text.includes('日常') || text.includes('亲切') || text.includes('朋友')) {
    return 'bestie'
  }
  if (text.includes('幽默') || text.includes('段子') || text.includes('风趣') || text.includes('逗趣') || text.includes('搞笑')) {
    return 'humorous'
  }
  if (text.includes('专业') || text.includes('导师') || text.includes('硬核') || text.includes('深度') || text.includes('严谨') || text.includes('客观')) {
    return 'professional'
  }
  return undefined
}

export function deriveSocialStudioPrefillPatch(
  record: PersonaRecord,
  brief: SocialStudioBrief,
): PrefillResult<SocialStudioBrief> {
  const patch: Partial<SocialStudioBrief> = {}
  let filledCount = 0

  const fill = <K extends keyof SocialStudioBrief>(key: K, value: SocialStudioBrief[K] | undefined) => {
    if (value === undefined) return
    if (typeof value === 'string' && !value.trim()) return
    const current = brief[key]
    if (typeof current === 'string' && current.trim()) return
    patch[key] = value
    filledCount += 1
  }

  if (isUserForm(record)) {
    const form = record.formData
    const q = normalizeQuestionnaire(form)
    fill('audience', profileField(record, 'audience', '核心客户') || audienceFromUser(form))
    const inferredTone = resolveVoiceToneFromDesiredImage(
      q.desiredImage || [q.keyword1, q.keyword2, q.keyword3].filter(Boolean).join('、'),
    )
    if (inferredTone && inferredTone !== brief.voiceTone && brief.voiceTone === 'bestie') {
      patch.voiceTone = inferredTone
      filledCount += 1
    }
    const pain =
      profileField(record, 'audience', '三大痛点') || form.clientPainPoints?.trim() || q.clientSituations
    const business = profileField(record, 'positioning', '产品承接') || form.primaryBusiness?.trim() || q.products
    if (pain || business) {
      const summary = [
        business ? `人设核心业务：${business}` : '',
        pain ? `目标受众核心痛点：${pain}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      fill('referenceText', summary)
    }
    const extra = form.additionalInfo?.trim() || q.differentiation
    if (extra) fill('creativeRequirements', extra)
  } else if (isCompanyForm(record)) {
    const form = record.formData
    fill('audience', audienceFromCompany(form))
    const business = form.mainBusiness?.trim()
    const edge = form.competitiveEdge?.trim()
    if (business || edge) {
      const summary = [
        business ? `企业主营业务：${business}` : '',
        edge ? `核心竞争优势：${edge}` : '',
      ]
        .filter(Boolean)
        .join('\n')
      fill('referenceText', summary)
    }
    const extra = form.additionalInfo?.trim()
    if (extra) fill('creativeRequirements', extra)
  }

  return {
    patch,
    filledCount,
    personaName: record.name.trim() || '人设',
  }
}
