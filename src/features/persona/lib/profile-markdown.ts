import type { ProfileKind } from '../../../services/persona/types.ts'
import { assertValidAccountCardMarkdown } from './account-card.ts'
import { COMPANY_PROFILE_SKELETON, USER_PROFILE_SKELETON, type ProfileSkeletonSection } from './profile-fields.ts'

/** 提取最后一个指定围栏块。 */
export function extractFencedMarkdown(text: string, fence: string): string {
  const re = new RegExp('```' + fence + '\\s*\\n([\\s\\S]*?)```', 'gi')
  let last: string | null = null
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) last = match[1] ?? ''
  if (last === null) throw new Error(`AI 输出缺少 \`\`\`${fence} 围栏块`)
  return last.trim()
}

type ParsedBullet = { label: string; value: string }

function stripBold(text: string): string {
  return text.replace(/^\*\*(.+)\*\*$/, '$1').trim()
}

function parseSectionBullets(body: string): ParsedBullet[] {
  const fields: ParsedBullet[] = []
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('```') || line.startsWith('>') || line.startsWith('---')) continue
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    if (!bullet) {
      throw new Error('人设字段必须使用「- 字段名：值」单行格式，不能包含段落或嵌套列表')
    }
    const kv = /^(.+?)[:：]\s*(.*)$/.exec(bullet[1])
    if (!kv) throw new Error('人设字段缺少中文或英文冒号分隔')
    const label = stripBold(kv[1].trim())
    const value = kv[2].trim()
    if (!label || !value) throw new Error('人设字段名和值都不能为空')
    fields.push({ label, value })
  }
  return fields
}

function assertExactSkeleton(
  markdown: string,
  skeleton: ProfileSkeletonSection[],
  h1Pattern: RegExp,
  label: string,
): void {
  if (!h1Pattern.test(markdown)) throw new Error(`AI 输出不符合 ${label} 一级标题结构`)
  const headings = [...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim())
  if (headings.length !== skeleton.length) {
    throw new Error(`${label} 必须且只能包含 ${skeleton.length} 个二级章节`)
  }
  skeleton.forEach((section, index) => {
    if (headings[index] !== section.title) {
      throw new Error(`${label} 第 ${index + 1} 个二级章节应为「${section.title}」`)
    }
  })

  const parts = markdown.split(/^##\s+/m).slice(1)
  const expectedLabels = skeleton.flatMap((section) => section.labels)
  const seenCore = new Set<string>()
  let extraCount = 0

  parts.forEach((part, index) => {
    const section = skeleton[index]
    const body = part.split(/\r?\n/).slice(1).join('\n')
    const fields = parseSectionBullets(body)
    const coreFields = fields.filter((field) => section.labels.includes(field.label))
    const coreOrder = coreFields.map((field) => field.label)
    if (coreOrder.length !== section.labels.length || coreOrder.some((field, i) => field !== section.labels[i])) {
      throw new Error(`${label} 章节「${section.title}」的核心字段缺失、重复或顺序错误`)
    }
    for (const field of coreFields) {
      if (seenCore.has(field.label)) throw new Error(`${label} 字段「${field.label}」重复出现`)
      seenCore.add(field.label)
    }
    extraCount += fields.filter((field) => !section.labels.includes(field.label)).length
  })

  if (seenCore.size !== expectedLabels.length) throw new Error(`${label} 十二个核心字段不完整`)
  if (extraCount > 3) throw new Error(`${label} 最多允许 3 个扩展字段`)
}

export function assertValidProfileMarkdown(markdown: string, kind: ProfileKind): void {
  if (kind === 'user') {
    if (/^#\s+User\s+Profile\s*$/m.test(markdown)) {
      assertExactSkeleton(markdown, USER_PROFILE_SKELETON, /^#\s+User\s+Profile\s*$/m, 'User Profile')
      return
    }
    assertValidAccountCardMarkdown(markdown)
    return
  }
  assertExactSkeleton(markdown, COMPANY_PROFILE_SKELETON, /^#\s+\S+/m, '企业全貌资料')
}