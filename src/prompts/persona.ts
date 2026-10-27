import { ACCOUNT_CARD_TEMPLATE, IP_PROFILE_FENCE } from '../features/persona/lib/account-card.ts'
import { QUESTIONNAIRE_LABELS, normalizeQuestionnaire } from '../services/persona/questionnaire.ts'
import type {
  CompanyProfileFormData,
  PersonaFormData,
  ProfileKind,
  UserProfileFormData,
} from '../services/persona/types.ts'

/** @deprecated 旧演示页输入形状；新页用 User/Company formData。 */
export type PersonaInput = {
  name: string
  industry: string
  role: string
  business: string
  audience: string
  strengths: string
  tone: string
  boundaries: string
  material: string
}

export const USER_SYSTEM_PROMPT = `你是「人设定位 Profile」分析员。根据网页问卷梳理真实优势、目标用户、产品承接和差异化，生成三套人设定位与三套账号包装建议。问卷是标准输入，不开展额外访谈；资料缺失时不自行补成事实，必要字段简洁填写「暂无」。

【底层原则】
1. 定位先找人，再找价值。先判断谁最需要用户现有能力，再分析这些能力能解决什么问题。
2. 人设放大长板，不堆砌头衔。头衔只有真实且相关时才使用。
3. 差异化要让用户看得见：方法、经历或交付有何具体不同，以及对客户的帮助。
4. 人设必须能证明，也必须能承接产品；不能超出实际交付能力。
5. 定位决定说什么，内容负责让用户记住。

【工作流程】
1. 盘点真实优势：学过、做过、擅长、做成、长期愿意表达什么。区分已发生购买与潜在商业价值。
2. 分析目标用户：细分人群、典型场景、最迫切三个需求、替代方案及不足。可结合前置检索补充市场层面特征，但公开资料不能证明用户本人有客户或成交。
3. 分析产品承接：现有与计划中的产品分开写，不把计划写成当前能力。
4. 寻找差异化。可以整理用户填写的竞品；可根据客户问题检索替代服务类别及其常见不足。不搜索、采集或补全特定平台同行账号。
5. 内部核对证据，不在 Profile 中写来源、推理、支持数据或状态标签。
6. 形成三套候选定位：A 专业权威型、B 垂直细分型、C 实战差异化型。编号必须稳定。并列呈现，不评分、不替用户选定。
7. 生成专业型、亲和型、差异化型账号包装，与定位方案相互独立，不假设一一对应。
8. 输出前检查人设、内容、风格红线；冲突则改写或删除。

【输出红线】
- 严格按照模板字段输出，不增加方法论、推理过程、证据清单、来源注释。
- 不得出现「来源：」「状态：」「策略推测」等标签。
- 信息不足时只填「暂无」。不编造资质、数字、经历或客户反馈。
- 不新增本阶段 web_search 调用；只消费前置调研。
- 人物优势只用「真实优势」「可放大的竞争力」两行，不做成证明材料清单。
最终回复只输出一个 ${IP_PROFILE_FENCE} 围栏代码块，内容为完整 Markdown；不输出块外解释。`
export const COMPANY_SYSTEM_PROMPT = `你是「企业全貌资料生成器」。根据表单资料、已有资料和前置调研，生成完整企业全景资料（Company Profile）。

【事实与合并】
1. 用户明确提供的公司名称、行业赛道、主营业务版图和市场信息逐字保留，不用推断覆盖。只能使用表单、已有资料和前置调研中的事实；不得虚构资质、专利、团队规模、客户数量、营收、价格、销量、案例或合作品牌。
2. 已有资料用于合并更新：本次输入＞旧文件内容＞本次市场推断。只修改本次新输入直接影响的章节，其余内容原样保留；先形成唯一完整版本，不生成第二份文件。
3. 市场材料只补足缺失信息，不把行业典型值写成企业已发生事实。调研为空时不假称已核实，正文不输出来源链接、检索过程、状态标签或内部提示。
4. 默认不新增章节；描述要具体可引用，不使用「视情况而定」「因人而异」等空话。确无依据的字段可自然说明资料未提供。
5. 不新增本阶段web_search调用；只消费前置调研。

最终回复只输出一个companyprofile围栏代码块，内容为完整Markdown正文；不要输出围栏块以外的任何解释。`

const USER_TEMPLATE = ACCOUNT_CARD_TEMPLATE

const COMPANY_TEMPLATE = `# 企业全貌资料

## 企业与赛道定位

- 企业名称：[用户原话]
- 行业赛道：[用户原话]
- 主营业务版图：[用户原话]
- 企业愿景与发展使命：[有则写；无依据时说明资料未提供]

## 目标市场与受众结构

- 核心服务客群/市场：[已知市场与决策身份；不把行业典型值写成已验证事实]

## 企业核心壁垒与竞争优势

- 核心竞争壁垒：[有真实依据则写；无依据时说明资料未提供]`

const USER_FORM_LABELS = QUESTIONNAIRE_LABELS

const COMPANY_FORM_LABELS: Array<[string, keyof CompanyProfileFormData]> = [
  ['企业名称', 'companyName'],
  ['行业赛道', 'industry'],
  ['主营业务版图', 'mainBusiness'],
  ['目标市场与受众结构', 'targetMarket'],
  ['企业核心壁垒与竞争优势', 'competitiveEdge'],
  ['企业愿景与发展使命', 'companyVision'],
  ['补充资料', 'additionalInfo'],
]
function formatFormFields(kind: ProfileKind, formData: PersonaFormData): string {
  if (kind === 'user') {
    const q = normalizeQuestionnaire(formData)
    const extras = [
      q.paidStatus ? `- 付费客户：${q.paidStatus}` : '',
      q.citePermission ? `- 引用权限：${q.citePermission}` : '',
      q.accountGoals.length ? `- 账号目标：${q.accountGoals.join('、')}` : '',
      q.shareWillingness ? `- 公开意愿：${q.shareWillingness}` : '',
    ].filter(Boolean)
    const fields = USER_FORM_LABELS.map(([label, key]) => {
      const value = q[key]
      return typeof value === 'string' && value.trim() ? `- ${label}：${value.trim()}` : ''
    }).filter(Boolean)
    return [...fields, ...extras].join('\n')
  }
  const record = formData as unknown as Record<string, unknown>
  return COMPANY_FORM_LABELS.map(([label, key]) => {
    const value = record[key]
    return typeof value === 'string' && value.trim() ? `- ${label}：${value.trim()}` : ''
  })
    .filter(Boolean)
    .join('\n')
}

export function getPersonaSystemPrompt(kind: ProfileKind): string {
  return kind === 'user' ? USER_SYSTEM_PROMPT : COMPANY_SYSTEM_PROMPT
}

export function getPersonaFence(kind: ProfileKind): string {
  return kind === 'user' ? IP_PROFILE_FENCE : 'companyprofile'
}

export function buildPersonaResearchPrompt(input: {
  kind: ProfileKind
  formData: UserProfileFormData | CompanyProfileFormData
}): string {
  return `【表单中的真实业务锚点】\n${formatFormFields(input.kind, input.formData) || '（无可用业务锚点）'}\n\n只依据上述锚点规划行业与客群检索，不补造未知人群、地点、价格、资质或经营成绩。`
}

export function buildPersonaUserPrompt(input: {
  kind: ProfileKind
  formData: PersonaFormData
  instruction?: string
  currentProfile?: string
}): { userPrompt: string; fence: string } {
  const isUser = input.kind === 'user'
  const fence = getPersonaFence(input.kind)
  const formFields = formatFormFields(input.kind, input.formData)
  const lines: string[] = [
    '【表单资料】',
    formFields || '（无，首次生成）',
    '',
    isUser
      ? '【装配与填写约束】问卷答案优先于旧稿与市场材料。三套定位与三套包装必须完整且彼此有区别；账号包装与定位方案相互独立。每个字段一行「- 字段名：值」，值内不换行。不写来源、推理或状态标签。不搜索特定平台同行账号。'
      : '【装配与填写约束】空白输入不覆盖已有值；十二个字段每行一个值，具体程度服从依据，不用虚构数字填空。',
    '',
    '【已有画像（用于合并更新，首次生成为空）】',
    input.currentProfile?.trim() || '（无，首次生成）',
  ]
  if (input.instruction?.trim()) {
    lines.push('', '【微调指令（本次额外要求）】', input.instruction.trim())
  }
  lines.push(
    '',
    '【输出模板（严格保留章节结构与全部字段）】',
    isUser ? USER_TEMPLATE : COMPANY_TEMPLATE,
    '',
    `【输出要求】最终回复只输出一个 \`\`\`${fence} 围栏代码块，内容为完整的 Markdown 正文；不要输出围栏块以外的任何解释。`,
  )
  return { userPrompt: lines.join('\n'), fence }
}

/** 页内「查看人设整理要求」预览（系统规则 + 用户提示摘要）。 */
export function buildPersonaPromptPreview(
  kind: ProfileKind,
  formData: UserProfileFormData | CompanyProfileFormData,
  instruction?: string,
  currentProfile?: string,
): string {
  const { userPrompt } = buildPersonaUserPrompt({ kind, formData, instruction, currentProfile })
  return `${getPersonaSystemPrompt(kind)}\n\n---\n\n${userPrompt}`
}

/** 旧演示页兼容。 */
export function buildPersonaPrompt(mode: 'personal' | 'company', input: PersonaInput) {
  const kind: ProfileKind = mode === 'personal' ? 'user' : 'company'
  if (kind === 'user') {
    return buildPersonaPromptPreview('user', {
      industry: input.industry,
      role: input.role,
      primaryBusiness: input.business,
      targetClients: input.audience,
      clientPainPoints: '',
      desiredImage: input.tone,
      additionalInfo: [input.strengths, input.boundaries, input.material].filter(Boolean).join('\n'),
    })
  }
  return buildPersonaPromptPreview('company', {
    companyName: input.name,
    industry: input.industry,
    mainBusiness: input.business,
    targetMarket: input.audience,
    competitiveEdge: input.strengths,
    companyVision: input.role,
    additionalInfo: [input.tone, input.boundaries, input.material].filter(Boolean).join('\n'),
  })
}