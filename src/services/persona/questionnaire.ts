import {
  EMPTY_QUESTIONNAIRE,
  EMPTY_USER_FORM,
  type AccountGoal,
  type CitePermission,
  type PaidClientStatus,
  type PersonaFormData,
  type PersonaQuestionnaire,
  type ShareWillingness,
  type UserProfileFormData,
} from './types.ts'

const STRING_KEYS: Array<keyof PersonaQuestionnaire> = [
  'industry',
  'role',
  'primaryBusiness',
  'targetClients',
  'clientPainPoints',
  'desiredImage',
  'additionalInfo',
  'publicName',
  'occupation',
  'education',
  'workExperience',
  'strengths',
  'cases',
  'results',
  'proofNotes',
  'reputation',
  'audiences',
  'clientSituations',
  'paidNotes',
  'products',
  'delivery',
  'revenueNotes',
  'methods',
  'competitors',
  'differentiation',
  'platforms',
  'keyword1',
  'keyword2',
  'keyword3',
  'keywordNotes',
  'contentThemes',
  'signatureStory',
  'personaRedlines',
  'contentRedlines',
  'styleRedlines',
]

const PAID_STATUSES: PaidClientStatus[] = ['yes', 'none', 'unsure', '']
const CITE_PERMISSIONS: CitePermission[] = ['public', 'anonymous', 'private', '']
const SHARE_WILLINGNESS: ShareWillingness[] = ['public', 'private', 'unsure', '']
const ACCOUNT_GOALS: AccountGoal[] = ['consult', 'service', 'product', 'influence', 'other']

export const REQUIRED_QUESTIONNAIRE_KEYS: Array<keyof PersonaQuestionnaire> = [
  'publicName',
  'occupation',
  'workExperience',
  'strengths',
  'cases',
  'audiences',
  'clientSituations',
  'paidStatus',
  'products',
  'delivery',
  'accountGoals',
  'platforms',
  'keyword1',
  'keyword2',
  'keyword3',
  'contentThemes',
  'personaRedlines',
  'contentRedlines',
  'styleRedlines',
]

function readString(src: Record<string, unknown>, key: string): string {
  const value = src[key]
  return typeof value === 'string' ? value : ''
}

function readEnum<T extends string>(src: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const value = src[key]
  return allowed.includes(value as T) ? (value as T) : ('' as T)
}

function readGoals(src: Record<string, unknown>): AccountGoal[] {
  const value = src.accountGoals
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AccountGoal => ACCOUNT_GOALS.includes(item as AccountGoal))
}

export function isCompanyFormData(form: PersonaFormData): form is import('./types').CompanyProfileFormData {
  return 'companyName' in form && typeof (form as { companyName?: unknown }).companyName === 'string'
}

export function normalizeQuestionnaire(form: PersonaFormData | null | undefined): PersonaQuestionnaire {
  const src = (form ?? {}) as Record<string, unknown>
  const next: PersonaQuestionnaire = { ...EMPTY_QUESTIONNAIRE }
  for (const key of STRING_KEYS) {
    next[key] = readString(src, key) as never
  }
  next.citePermission = readEnum(src, 'citePermission', CITE_PERMISSIONS)
  next.paidStatus = readEnum(src, 'paidStatus', PAID_STATUSES)
  next.shareWillingness = readEnum(src, 'shareWillingness', SHARE_WILLINGNESS)
  next.accountGoals = readGoals(src)

  if (!next.occupation.trim() && next.role.trim() && next.industry.trim() && next.role.trim() !== next.industry.trim()) {
    next.occupation = [next.role, next.industry].filter((part) => part.trim()).join(' · ')
  } else if (!next.occupation.trim() && next.role.trim()) {
    next.occupation = next.role.trim()
  } else if (!next.occupation.trim() && next.industry.trim()) {
    next.occupation = next.industry.trim()
  }
  if (!next.audiences.trim() && next.targetClients?.trim()) next.audiences = next.targetClients
  if (!next.clientSituations.trim() && next.clientPainPoints?.trim()) {
    next.clientSituations = next.clientPainPoints
  }
  if (!next.products.trim() && next.primaryBusiness.trim()) next.products = next.primaryBusiness
  if (next.desiredImage?.trim()) {
    const words = next.desiredImage.split(/[，,、\s]+/).filter(Boolean)
    if (!next.keyword1.trim()) next.keyword1 = words[0] ?? ''
    if (!next.keyword2.trim()) next.keyword2 = words[1] ?? ''
    if (!next.keyword3.trim()) next.keyword3 = words[2] ?? ''
  }
  if (!next.publicName.trim() && !('publicName' in src)) {
    next.publicName = readString(src, 'name')
  }
  return syncLegacyProjection(next)
}

/** Fill empty questionnaire fields from the explicitly labelled legacy document. */
export function questionnaireFromLegacyContent(
  form: PersonaFormData | null | undefined,
  content: string | null | undefined,
): PersonaQuestionnaire {
  const q = normalizeQuestionnaire(form)
  if (form && isCompanyFormData(form)) return q
  // Projection can synthesize an industry from a role (or vice versa). Keep
  // absent legacy values available for explicit information in the document.
  const original = (form ?? {}) as Record<string, unknown>
  const hasText = (key: string) => typeof original[key] === 'string' && (original[key] as string).trim() !== ''
  if (!hasText('occupation')) {
    if (!hasText('role')) q.role = ''
    if (!hasText('industry')) q.industry = ''
    q.occupation = ''
  }
  // A projected image made from existing keywords must not mask legacy text.
  if (!form || !('desiredImage' in form) || !form.desiredImage?.trim()) q.desiredImage = ''

  const mappings: Record<string, Record<string, keyof PersonaQuestionnaire>> = {
    '个人基础信息': {
      '职业身份': 'role',
      '所属行业': 'industry',
      '核心产品/服务': 'primaryBusiness',
      '业务特色': 'differentiation',
    },
    '用户特征': {
      '现状': 'clientSituations',
      '困扰': 'clientPainPoints',
      '希望建立的形象': 'desiredImage',
    },
  }
  let section = ''
  for (const line of (content ?? '').split(/\r?\n/)) {
    const heading = line.match(/^\s*#{1,6}\s*(?:[一二三四五六七八九十\d]+[、.．]\s*)?(.+?)\s*$/)
    if (heading) {
      section = heading[1].trim()
      continue
    }
    const field = line.match(/^\s*[-*]\s*(?:\*\*)?([^：:＊*]+)(?:\*\*)?\s*[：:]\s*(.*?)(?:\*\*)?\s*$/)
    if (!field) continue
    const key = mappings[section]?.[field[1].trim()]
    const value = field[2].trim()
    if (!key || !value || /^(?:暂无|待补充|未提供|无)$/.test(value)) continue
    if (typeof q[key] === 'string' && !(q[key] as string).trim()) {
      ;(q as unknown as Record<string, unknown>)[key] = value
    }
  }
  // Re-normalize so the legacy fields populate their questionnaire counterparts.
  return normalizeQuestionnaire(q)
}

export function syncLegacyProjection(form: PersonaQuestionnaire): PersonaQuestionnaire {
  const keywords = [form.keyword1, form.keyword2, form.keyword3].map((item) => item.trim()).filter(Boolean)
  return {
    ...form,
    role: form.role.trim() || form.occupation.trim(),
    industry: form.industry.trim() || form.occupation.trim(),
    primaryBusiness: form.primaryBusiness.trim() || form.products.trim(),
    targetClients: form.targetClients?.trim() || form.audiences.trim(),
    clientPainPoints: form.clientPainPoints?.trim() || form.clientSituations.trim(),
    desiredImage: form.desiredImage?.trim() || keywords.join('、'),
    additionalInfo: form.additionalInfo?.trim() || form.differentiation.trim() || form.proofNotes.trim(),
  }
}

export function projectLegacyUserForm(form: PersonaFormData | null | undefined): UserProfileFormData {
  if (form && isCompanyFormData(form)) {
    return { ...EMPTY_USER_FORM }
  }
  const q = normalizeQuestionnaire(form)
  return {
    industry: q.industry,
    role: q.role,
    primaryBusiness: q.primaryBusiness,
    targetClients: q.targetClients,
    clientPainPoints: q.clientPainPoints,
    desiredImage: q.desiredImage,
    additionalInfo: q.additionalInfo,
  }
}

/** 简易版 7 字段一键继承到高级版 25 项问卷 */
export function inheritSimpleToAdvanced(
  simpleForm: Partial<UserProfileFormData> | null | undefined,
  existingAdvanced?: Partial<PersonaQuestionnaire> | null,
): PersonaQuestionnaire {
  const normalizedSimple = normalizeQuestionnaire(simpleForm as PersonaFormData)
  if (!existingAdvanced) return normalizedSimple
  const result = { ...existingAdvanced } as PersonaQuestionnaire
  for (const key of STRING_KEYS) {
    const existingValue = result[key]
    const simpleValue = normalizedSimple[key]
    if (typeof existingValue !== 'string' || typeof simpleValue !== 'string') continue
    if (!existingValue.trim() && simpleValue.trim()) {
      result[key] = simpleValue as never
    }
  }
  return normalizeQuestionnaire(result)
}

export function isQuestionnaireEmpty(form: PersonaQuestionnaire): boolean {
  const fingerprint = STRING_KEYS.map((key) => `${key}=${String(form[key] ?? '').trim()}`).join('|')
  const empty = STRING_KEYS.map((key) => `${key}=${String(EMPTY_QUESTIONNAIRE[key] ?? '').trim()}`).join('|')
  return fingerprint === empty && form.accountGoals.length === 0 && !form.paidStatus && !form.citePermission
}

export function missingRequiredQuestionnaireKeys(form: PersonaQuestionnaire): Array<keyof PersonaQuestionnaire> {
  return REQUIRED_QUESTIONNAIRE_KEYS.filter((key) => {
    if (key === 'accountGoals') return form.accountGoals.length === 0
    const value = form[key]
    return typeof value === 'string' ? !value.trim() : !value
  })
}

export const QUESTIONNAIRE_LABELS: Array<[string, keyof PersonaQuestionnaire]> = [
  ['公开姓名或昵称', 'publicName'],
  ['职业身份、行业与年限', 'occupation'],
  ['专业教育培训认证', 'education'],
  ['相关工作经历', 'workExperience'],
  ['最擅长的事', 'strengths'],
  ['代表案例或作品', 'cases'],
  ['可核实成果', 'results'],
  ['证明材料说明', 'proofNotes'],
  ['他人评价', 'reputation'],
  ['服务人群', 'audiences'],
  ['客户场景与原话', 'clientSituations'],
  ['付费补充', 'paidNotes'],
  ['产品或服务', 'products'],
  ['交付方式与承诺边界', 'delivery'],
  ['收入方式', 'revenueNotes'],
  ['工作方法', 'methods'],
  ['竞品或替代服务', 'competitors'],
  ['真实不同', 'differentiation'],
  ['平台与账号', 'platforms'],
  ['记忆关键词一', 'keyword1'],
  ['记忆关键词二', 'keyword2'],
  ['记忆关键词三', 'keyword3'],
  ['关键词说明', 'keywordNotes'],
  ['长期主题与形式', 'contentThemes'],
  ['代表经历或观点', 'signatureStory'],
  ['人设红线', 'personaRedlines'],
  ['内容红线', 'contentRedlines'],
  ['风格红线', 'styleRedlines'],
]
