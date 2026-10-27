import type { SocialStudioBrief, SocialStudioPlatform } from './social-studio-brief-types'
import type { SocialContentMode } from '../studio-types'

export type ResolvedReference = {
  title?: string
  content?: string
  author?: string
  platform?: string
  sourceUrl?: string
}

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i

export function extractUrlFromText(text: string): string | undefined {
  const match = text.trim().match(URL_RE)
  return match?.[0]
}

const EXPRESSION_LABELS: Record<SocialStudioBrief['expressionStyle'], string> = {
  seeding: '种草推荐',
  dry_goods: '干货分享',
  story: '故事叙述',
  review: '测评对比',
}

const LENGTH_LABELS: Record<SocialStudioBrief['length'], string> = {
  short: '简短',
  standard: '标准篇幅',
  long: '详细长文',
}

const VOICE_LABELS: Record<SocialStudioBrief['voiceTone'], string> = {
  bestie: '亲切闺蜜',
  professional: '专业干货',
  humorous: '幽默吐槽',
}

export function buildSocialStudioPrompt(input: {
  platform: SocialStudioPlatform
  brief: SocialStudioBrief
  contentMode: SocialContentMode
  personaContent?: string
  reference?: ResolvedReference | null
}): { system: string; user: string } {
  const { platform, brief, contentMode, personaContent, reference } = input
  const topic = brief.topic.trim() || '（用户未单独填写主题，请从参考素材提炼）'
  const audience = brief.audience.trim() || '泛兴趣读者'

  const referenceBlock = reference?.content || reference?.title
    ? `
【参考来源内容】
平台：${reference.platform || '未知'}
作者：${reference.author || '未知'}
原标题：${reference.title || '未命名'}
链接：${reference.sourceUrl || '无'}
正文摘要：
${(reference.content || reference.title || '').slice(0, 12000)}
`.trim()
    : ''

  const extraMaterial = brief.referenceText.trim()
    ? `\n【用户补充参考资料】\n${brief.referenceText.trim()}`
    : ''

  const requirements = brief.creativeRequirements.trim()
    ? `\n【创作要求】\n${brief.creativeRequirements.trim()}`
    : ''

  const personaBlock = personaContent?.trim()
    ? `\n【表达风格人设参考】\n${personaContent.trim()}`
    : ''

  const styleBlock = `
【写作设定】
主题：${topic}
表达方式：${EXPRESSION_LABELS[brief.expressionStyle]}
篇幅：${LENGTH_LABELS[brief.length]}
语气：${VOICE_LABELS[brief.voiceTone]}
目标读者：${audience}
Emoji 密度：${brief.emojiLevel}/5（0 表示几乎不用）
${contentMode === 'image_text' ? `计划配图张数：${brief.imageCount}（正文需为配图预留插入点说明，勿编造图片 URL）` : ''}
${brief.autoTags ? '请自动生成 3-5 个适合平台的话题标签。' : '不要附加话题标签行。'}
`.trim()

  if (platform === 'xhs') {
    const system =
      contentMode === 'article'
        ? '你是小红书长文专栏作者。输出结构清晰、有深度的长文，含主标题与分段小标题，语言自然，避免堆砌口号。'
        : '你是小红书头部创作者。输出爆款笔记正文：分段清晰、适当 emoji、有互动提问；第一行可作为笔记标题。'
    const user = [referenceBlock, extraMaterial, styleBlock, requirements, personaBlock, '\n请直接输出完整正文，不要解释写作过程。']
      .filter(Boolean)
      .join('\n\n')
    return { system, user }
  }

  const system =
    '你是资深公众号主笔。基于素材与设定写一篇有洞见、可执行的深度图文，含主标题与章节结构，适合手机阅读。'
  const user = [
    referenceBlock,
    extraMaterial,
    styleBlock,
    requirements,
    personaBlock,
    `\n排版模板偏好：${brief.articleTemplate}`,
    '\n请直接输出完整文章正文（Markdown 友好），不要解释写作过程。',
  ]
    .filter(Boolean)
    .join('\n\n')
  return { system, user }
}
