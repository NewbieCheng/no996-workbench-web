import type { PackagingId, PositioningId } from '../../../services/persona/types.ts'
import type { ProfileField, ProfileSkeletonSection } from './profile-fields'

export const IP_PROFILE_FENCE = 'ipprofile'
export const IP_PROFILE_TITLE = '人设定位 Profile'

export const POSITIONING_IDS: PositioningId[] = ['A', 'B', 'C']
export const PACKAGING_IDS: PackagingId[] = ['professional', 'warm', 'differentiated']

export const POSITIONING_LABELS: Record<PositioningId, string> = {
  A: '专业权威型',
  B: '垂直细分型',
  C: '实战差异化型',
}

export const PACKAGING_LABELS: Record<PackagingId, string> = {
  professional: '专业型',
  warm: '亲和型',
  differentiated: '差异化型',
}

export const POSITIONING_FIELDS = [
  '基础身份',
  '核心优势',
  '精准用户',
  '核心需求',
  '细分赛道',
  '差异化价值',
  '可信背书',
  '产品承接',
  '一句话专业定位',
  '三个人格标签',
  '一句记忆点表达',
] as const

export const PACKAGING_FIELDS = ['账号昵称建议', '账号简介', '置顶内容主题'] as const

export const AUDIENCE_FIELDS = [
  '核心客户',
  '典型场景',
  '三大痛点',
  '当前替代方案及其不足',
  '购买动机',
] as const

export const ADVANTAGE_FIELDS = ['真实优势', '可放大的竞争力'] as const

export const REDLINE_FIELDS = ['人设红线', '内容红线', '风格红线'] as const

export type AccountCardModuleId = 'advantages' | 'audience' | 'positioning' | 'packaging' | 'redlines'

export const ACCOUNT_CARD_SKELETON: ProfileSkeletonSection[] = [
  { title: '一、人物优势', labels: [...ADVANTAGE_FIELDS] },
  { title: '二、目标人群与需求', labels: [...AUDIENCE_FIELDS] },
  { title: '定位方案 A：专业权威型', labels: [...POSITIONING_FIELDS] },
  { title: '定位方案 B：垂直细分型', labels: [...POSITIONING_FIELDS] },
  { title: '定位方案 C：实战差异化型', labels: [...POSITIONING_FIELDS] },
  { title: '专业型', labels: [...PACKAGING_FIELDS] },
  { title: '亲和型', labels: [...PACKAGING_FIELDS] },
  { title: '差异化型', labels: [...PACKAGING_FIELDS] },
  { title: '五、禁止事项与表达红线', labels: [...REDLINE_FIELDS] },
]

export type NamedFieldBlock = {
  title: string
  fields: ProfileField[]
}

export type ParsedAccountCard = {
  advantages: NamedFieldBlock
  audience: NamedFieldBlock
  positioning: Record<PositioningId, NamedFieldBlock>
  packaging: Record<PackagingId, NamedFieldBlock>
  redlines: NamedFieldBlock
}

const FORBIDDEN = /来源[:：]|状态[:：]|策略推测|据.{0,12}推测|尚无成交记录支持/

function stripBold(text: string): string {
  return text.replace(/^\*\*(.+)\*\*$/, '$1').trim()
}

function headingTitle(line: string): string | null {
  const match = /^(#{1,3})\s+(.+)$/.exec(line.trim())
  if (!match) return null
  return match[2].replace(/^[一二三四五六七八九十]+[、.．]\s*/, '').replace(/^\d+[.、]\s*/, '').trim()
}

function parseFields(body: string): ProfileField[] {
  const fields: ProfileField[] = []
  for (const raw of body.split(/\r?\n/)) {
    if (/^\s{2,}\S/.test(raw) && fields.length) {
      fields[fields.length - 1].value += `\n${raw.trim()}`
      continue
    }
    const line = raw.trim()
    if (!line || line.startsWith('```') || line.startsWith('>') || line.startsWith('---') || line.startsWith('|')) continue
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const text = bullet ? bullet[1] : line
    const kv = /^(.+?)[:：]\s*(.*)$/.exec(text)
    if (!kv) continue
    const label = stripBold(kv[1])
    const value = kv[2].trim()
    if (label && value) fields.push({ label, value })
  }
  return fields
}

function splitSections(markdown: string): Array<{ title: string; body: string }> {
  const lines = markdown.split(/\r?\n/)
  const sections: Array<{ title: string; body: string }> = []
  let current: { title: string; body: string } | null = null
  for (const line of lines) {
    const title = headingTitle(line)
    const depth = /^(#{1,3})\s+/.exec(line.trim())?.[1].length ?? 0
    if (title && depth >= 2) {
      if (current) sections.push(current)
      current = { title, body: '' }
      continue
    }
    if (current) current.body += `${line}\n`
  }
  if (current) sections.push(current)
  return sections
}

function findSection(
  sections: Array<{ title: string; body: string }>,
  matchers: string[],
): { title: string; body: string } | undefined {
  return sections.find((section) =>
    matchers.some((matcher) => section.title === matcher || section.title.includes(matcher)),
  )
}

function requireFields(block: NamedFieldBlock, labels: readonly string[], context: string): void {
  const found = new Map(block.fields.map((field) => [field.label, field.value]))
  for (const label of labels) {
    const value = [...found.entries()].find(([key]) => key === label || key.includes(label) || label.includes(key))?.[1]
    if (!value?.trim()) throw new Error(`${context}缺少「${label}」`)
  }
}

function blockFromSection(
  section: { title: string; body: string } | undefined,
  fallbackTitle: string,
): NamedFieldBlock {
  return {
    title: section?.title || fallbackTitle,
    fields: section ? parseFields(section.body) : [],
  }
}

export function parseAccountCard(markdown: string): ParsedAccountCard | null {
  const trimmed = markdown.trim()
  if (!trimmed) return null
  const sections = splitSections(trimmed)
  if (sections.length < 4) return null

  const advantages = blockFromSection(findSection(sections, ['人物优势']), '一、人物优势')
  const audience = blockFromSection(findSection(sections, ['目标人群与需求']), '二、目标人群与需求')
  const positioning = {
    A: blockFromSection(findSection(sections, ['定位方案 A', '专业权威型']), '定位方案 A：专业权威型'),
    B: blockFromSection(findSection(sections, ['定位方案 B', '垂直细分型']), '定位方案 B：垂直细分型'),
    C: blockFromSection(findSection(sections, ['定位方案 C', '实战差异化型']), '定位方案 C：实战差异化型'),
  }
  const packaging = {
    professional: blockFromSection(
      sections.find((section) => section.title === '专业型' || /^专业型/.test(section.title)),
      '专业型',
    ),
    warm: blockFromSection(
      sections.find((section) => section.title === '亲和型' || section.title.includes('亲和型')),
      '亲和型',
    ),
    differentiated: blockFromSection(
      sections.find(
        (section) =>
          section.title === '差异化型' ||
          (/差异化型/.test(section.title) && !/定位方案|实战差异化/.test(section.title)),
      ),
      '差异化型',
    ),
  }
  const redlines = blockFromSection(
    findSection(sections, ['禁止事项与表达红线', '表达红线']),
    '五、禁止事项与表达红线',
  )

  return { advantages, audience, positioning, packaging, redlines }
}

export function assertNoForbiddenLabels(markdown: string): void {
  if (FORBIDDEN.test(markdown)) {
    throw new Error('人设输出不得包含来源、推理过程或状态标签')
  }
}

export function assertValidAccountCardMarkdown(markdown: string): ParsedAccountCard {
  const parsed = parseAccountCard(markdown)
  if (!parsed) throw new Error('人设定位输出缺少必要章节')
  assertNoForbiddenLabels(markdown)
  requireFields(parsed.advantages, ADVANTAGE_FIELDS, '人物优势')
  requireFields(parsed.audience, AUDIENCE_FIELDS, '目标人群与需求')
  for (const id of POSITIONING_IDS) {
    requireFields(parsed.positioning[id], POSITIONING_FIELDS, `定位方案 ${id}`)
  }
  for (const id of PACKAGING_IDS) {
    requireFields(parsed.packaging[id], PACKAGING_FIELDS, `${PACKAGING_LABELS[id]}账号包装`)
  }
  requireFields(parsed.redlines, REDLINE_FIELDS, '表达红线')
  return parsed
}

function renderFields(fields: ProfileField[]): string {
  return fields.map((field) => `- ${field.label}：${field.value.replace(/\r?\n+/g, ' ').trim()}`).join('\n')
}

function pickFields(block: NamedFieldBlock, labels: readonly string[]): ProfileField[] {
  return labels.map((label) => {
    const hit = block.fields.find(
      (field) => field.label === label || field.label.includes(label) || label.includes(field.label),
    )
    return { label, value: hit?.value?.trim() || '暂无' }
  })
}

export function composeMainProfile(
  parsed: ParsedAccountCard,
  positioningId: PositioningId,
  packagingId: PackagingId,
): string {
  const positioning = parsed.positioning[positioningId]
  const packaging = parsed.packaging[packagingId]
  const positioningTitle = `三、人设定位方案｜方案 ${positioningId}：${POSITIONING_LABELS[positioningId]}`
  const packagingTitle = `四、账号包装建议｜${PACKAGING_LABELS[packagingId]}`
  return [
    `# ${IP_PROFILE_TITLE}`,
    '',
    '## 一、人物优势',
    renderFields(pickFields(parsed.advantages, ADVANTAGE_FIELDS)),
    '',
    '## 二、目标人群与需求',
    renderFields(pickFields(parsed.audience, AUDIENCE_FIELDS)),
    '',
    `## ${positioningTitle}`,
    renderFields(pickFields(positioning, POSITIONING_FIELDS)),
    '',
    `## ${packagingTitle}`,
    renderFields(pickFields(packaging, PACKAGING_FIELDS)),
    '',
    '## 五、禁止事项与表达红线',
    renderFields(pickFields(parsed.redlines, REDLINE_FIELDS)),
  ].join('\n')
}

export function parseMainProfile(markdown: string): {
  advantages: NamedFieldBlock
  audience: NamedFieldBlock
  positioning: NamedFieldBlock
  packaging: NamedFieldBlock
  redlines: NamedFieldBlock
  positioningId?: PositioningId
  packagingId?: PackagingId
} | null {
  const sections = splitSections(markdown)
  // Legacy User Profile documents have different sections; treating them as
  // account cards produces five empty modules and risks overwriting their data.
  if (!sections.some((section) => /人设定位方案|定位方案|账号包装建议|人物优势|目标人群与需求|禁止事项与表达红线/.test(section.title))) return null
  const positioningSection = findSection(sections, ['人设定位方案', '定位方案'])
  const packagingSection = findSection(sections, ['账号包装建议'])
  const positioningId = POSITIONING_IDS.find((id) => positioningSection?.title.includes(`方案 ${id}`))
  const packagingId = PACKAGING_IDS.find((id) => packagingSection?.title.includes(PACKAGING_LABELS[id]))
  return {
    advantages: blockFromSection(findSection(sections, ['人物优势']), '一、人物优势'),
    audience: blockFromSection(findSection(sections, ['目标人群与需求']), '二、目标人群与需求'),
    positioning: blockFromSection(positioningSection, '三、人设定位方案'),
    packaging: blockFromSection(packagingSection, '四、账号包装建议'),
    redlines: blockFromSection(findSection(sections, ['禁止事项与表达红线', '表达红线']), '五、禁止事项与表达红线'),
    positioningId,
    packagingId,
  }
}

// Convert only the recognizable legacy profile format. Unmapped source text is
// retained separately by the repository, rather than guessed or discarded.
export function migrateLegacyProfile(markdown: string): string | null {
  if (parseMainProfile(markdown)) return null
  const sections = splitSections(markdown)
  const basic = findSection(sections, ['个人基础信息'])
  const audience = findSection(sections, ['目标用户画像'])
  const traits = findSection(sections, ['用户特征'])
  if (!basic || !audience || !traits) return null
  const basicFields = blockFromSection(basic, '')
  const audienceFields = blockFromSection(audience, '')
  const traitFields = blockFromSection(traits, '')
  const get = (block: NamedFieldBlock, label: string) => block.fields.find((f) => f.label === label)?.value ?? ''
  const join = (...values: string[]) => values.filter(Boolean).join('；') || '待补充'
  const identity = join(get(basicFields, '职业身份'), get(basicFields, '所属行业'))
  const clients = join(get(audienceFields, '职业特征'), get(audienceFields, '年龄段'), get(audienceFields, '地域'))
  const feature = get(basicFields, '业务特色')
  const needs = get(traitFields, '需求')
  const product = get(basicFields, '核心产品/服务')
  const fields = (labels: readonly string[], values: Record<string, string>) => renderFields(labels.map((label) => ({ label, value: values[label] || '待补充' })))
  return [
    `# ${IP_PROFILE_TITLE}`, '', '## 一、人物优势',
    fields(ADVANTAGE_FIELDS, { '真实优势': feature }), '',
    '## 二、目标人群与需求',
    fields(AUDIENCE_FIELDS, { '核心客户': clients, '典型场景': get(traitFields, '现状'), '三大痛点': get(traitFields, '困扰'), '购买动机': join(needs, get(traitFields, '障碍'), get(audienceFields, '客户单次消费水平')) }), '',
    '## 三、人设定位方案',
    fields(POSITIONING_FIELDS, { '基础身份': identity, '核心优势': feature, '精准用户': clients, '核心需求': needs, '细分赛道': get(basicFields, '所属行业'), '产品承接': product, '三个人格标签': get(traitFields, '希望建立的形象') }), '',
    '## 四、账号包装建议', fields(PACKAGING_FIELDS, {}), '',
    '## 五、禁止事项与表达红线', fields(REDLINE_FIELDS, {}),
  ].join('\n')
}

export function fieldValue(block: NamedFieldBlock | undefined, label: string): string {
  return (
    block?.fields.find(
      (field) => field.label === label || field.label.includes(label) || label.includes(field.label),
    )?.value ?? ''
  )
}

export function patchMainProfileModule(
  markdown: string,
  moduleId: AccountCardModuleId,
  fields: ProfileField[],
): string {
  if (!parseMainProfile(markdown)) return markdown
  const matchers: Record<AccountCardModuleId, RegExp> = {
    advantages: /人物优势/,
    audience: /目标人群与需求/,
    positioning: /人设定位方案|定位方案/,
    packaging: /账号包装建议/,
    redlines: /禁止事项与表达红线|表达红线/,
  }
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => {
    const title = headingTitle(line)
    return title !== null && /^#{2,3}\s/.test(line.trim()) && matchers[moduleId].test(title)
  })
  const format = (field: ProfileField) => `- ${field.label}：${field.value.trim().replace(/\r?\n/g, '\n  ')}`
  if (start < 0) {
    const titles: Record<AccountCardModuleId, string> = {
      advantages: '一、人物优势', audience: '二、目标人群与需求',
      positioning: '三、人设定位方案', packaging: '四、账号包装建议', redlines: '五、禁止事项与表达红线',
    }
    return `${markdown.trimEnd()}\n\n## ${titles[moduleId]}\n${fields.map(format).join('\n')}\n`
  }
  let end = start + 1
  while (end < lines.length && !/^#{1,3}\s/.test(lines[end].trim())) end++
  const section = lines.slice(start + 1, end)
  const pending = new Map(fields.map((field) => [field.label, field]))
  const updated: string[] = []
  for (let i = 0; i < section.length; i++) {
    const match = /^\s*[-*]\s+(.+?)[:：]/.exec(section[i])
    const label = match ? stripBold(match[1]) : ''
    const field = pending.get(label)
    if (!field) { updated.push(section[i]); continue }
    updated.push(format(field))
    pending.delete(label)
    while (i + 1 < section.length && /^\s{2,}\S/.test(section[i + 1])) i++
  }
  if (pending.size) updated.push(...[...pending.values()].map(format))
  return [...lines.slice(0, start + 1), ...updated, ...lines.slice(end)].join('\n')
}

export function moduleFields(moduleId: AccountCardModuleId): readonly string[] {
  if (moduleId === 'advantages') return ADVANTAGE_FIELDS
  if (moduleId === 'audience') return AUDIENCE_FIELDS
  if (moduleId === 'positioning') return POSITIONING_FIELDS
  if (moduleId === 'packaging') return PACKAGING_FIELDS
  return REDLINE_FIELDS
}

export const ACCOUNT_CARD_TEMPLATE = `# ${IP_PROFILE_TITLE}

## 一、人物优势

- 真实优势：
- 可放大的竞争力：

## 二、目标人群与需求

- 核心客户：
- 典型场景：
- 三大痛点：
- 当前替代方案及其不足：
- 购买动机：

## 三、3 套人设定位方案

### 定位方案 A：专业权威型

- 基础身份：
- 核心优势：
- 精准用户：
- 核心需求：
- 细分赛道：
- 差异化价值：
- 可信背书：
- 产品承接：
- 一句话专业定位：
- 三个人格标签：
- 一句记忆点表达：

### 定位方案 B：垂直细分型

- 基础身份：
- 核心优势：
- 精准用户：
- 核心需求：
- 细分赛道：
- 差异化价值：
- 可信背书：
- 产品承接：
- 一句话专业定位：
- 三个人格标签：
- 一句记忆点表达：

### 定位方案 C：实战差异化型

- 基础身份：
- 核心优势：
- 精准用户：
- 核心需求：
- 细分赛道：
- 差异化价值：
- 可信背书：
- 产品承接：
- 一句话专业定位：
- 三个人格标签：
- 一句记忆点表达：

## 四、3 套账号包装建议

### 专业型

- 账号昵称建议：
- 账号简介：
- 置顶内容主题：

### 亲和型

- 账号昵称建议：
- 账号简介：
- 置顶内容主题：

### 差异化型

- 账号昵称建议：
- 账号简介：
- 置顶内容主题：

## 五、禁止事项与表达红线

- 人设红线：
- 内容红线：
- 风格红线：`
