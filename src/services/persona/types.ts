export type ProfileKind = 'user' | 'company'
export type PersonaMode = 'simple' | 'advanced'

export type PaidClientStatus = 'yes' | 'none' | 'unsure' | ''
export type CitePermission = 'public' | 'anonymous' | 'private' | ''
export type AccountGoal = 'consult' | 'service' | 'product' | 'influence' | 'other'
export type ShareWillingness = 'public' | 'private' | 'unsure' | ''
export type PositioningId = 'A' | 'B' | 'C'
export type PackagingId = 'professional' | 'warm' | 'differentiated'

/** 旧 7 字段定位卡，供预填 fallback 与历史记录读取。 */
export type UserProfileFormData = {
  industry: string
  role: string
  primaryBusiness: string
  targetClients?: string
  clientPainPoints?: string
  desiredImage?: string
  additionalInfo?: string
}

export type CompanyProfileFormData = {
  companyName: string
  industry: string
  mainBusiness: string
  targetMarket?: string
  competitiveEdge?: string
  companyVision?: string
  additionalInfo?: string
}

/** 人设账号卡四页问卷（Q1–Q25），并保留旧 7 字段投影。 */
export type PersonaQuestionnaire = UserProfileFormData & {
  publicName: string
  occupation: string
  education: string
  workExperience: string
  strengths: string
  cases: string
  results: string
  proofNotes: string
  citePermission: CitePermission
  reputation: string
  audiences: string
  clientSituations: string
  paidStatus: PaidClientStatus
  paidNotes: string
  products: string
  delivery: string
  accountGoals: AccountGoal[]
  revenueNotes: string
  methods: string
  competitors: string
  differentiation: string
  platforms: string
  keyword1: string
  keyword2: string
  keyword3: string
  keywordNotes: string
  contentThemes: string
  signatureStory: string
  shareWillingness: ShareWillingness
  personaRedlines: string
  contentRedlines: string
  styleRedlines: string
}

export type PersonaFormData = PersonaQuestionnaire | CompanyProfileFormData | UserProfileFormData

export type PersonaRecord = {
  id: string
  kind: ProfileKind
  mode?: PersonaMode
  name: string
  summary: string
  content: string
  /** Original document retained when a legacy profile is converted. */
  legacyContent?: string
  formData: PersonaFormData
  isActive: boolean
  updatedAt: string
  candidatesMarkdown?: string
  selectedPositioning?: PositioningId
  selectedPackaging?: PackagingId
  questionnaireStep?: number
  draftSavedAt?: string
}

/**
 * 其他创作页引用用的精简形状。
 *
 * `id` 与 `hint` 是**可选**的：只有「可选多档」的场景（人设注入控件的换档菜单）才需要
 * 用 id 标识选中项、用 hint 补一行说明。单档引用（小红书 / 公众号）不必关心这两项。
 */
export type SavedPersona = {
  name: string
  summary: string
  content: string
  /** 记录 id：用于菜单里标识「当前选中哪一档」 */
  id?: string
  /** 菜单里那一行提示（定位卡片摘要优先） */
  hint?: string
  /** 模式：简易版或高级版 */
  mode?: PersonaMode
}

export const EMPTY_USER_FORM: UserProfileFormData = {
  industry: '',
  role: '',
  primaryBusiness: '',
  targetClients: '',
  clientPainPoints: '',
  desiredImage: '',
  additionalInfo: '',
}

export const EMPTY_QUESTIONNAIRE: PersonaQuestionnaire = {
  ...EMPTY_USER_FORM,
  publicName: '',
  occupation: '',
  education: '',
  workExperience: '',
  strengths: '',
  cases: '',
  results: '',
  proofNotes: '',
  citePermission: '',
  reputation: '',
  audiences: '',
  clientSituations: '',
  paidStatus: '',
  paidNotes: '',
  products: '',
  delivery: '',
  accountGoals: [],
  revenueNotes: '',
  methods: '',
  competitors: '',
  differentiation: '',
  platforms: '',
  keyword1: '',
  keyword2: '',
  keyword3: '',
  keywordNotes: '',
  contentThemes: '',
  signatureStory: '',
  shareWillingness: '',
  personaRedlines: '',
  contentRedlines: '',
  styleRedlines: '',
}

export const EMPTY_COMPANY_FORM: CompanyProfileFormData = {
  companyName: '',
  industry: '',
  mainBusiness: '',
  targetMarket: '',
  competitiveEdge: '',
  companyVision: '',
  additionalInfo: '',
}

export function summarizeFromContent(content: string, fallback: string): string {
  const line = content
    .split(/\r?\n/)
    .map((l) => l.replace(/^#+\s*/, '').trim())
    .find((l) => l && !l.startsWith('-') && !l.startsWith('>'))
  return (line || fallback).slice(0, 120)
}

export function newPersonaId(): string {
  return `persona_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
