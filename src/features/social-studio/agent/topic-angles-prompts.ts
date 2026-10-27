import { JSON_ONLY_INSTRUCTION, withCommonRules } from '../../../agent'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'

const EXPRESSION_LABELS: Record<SocialStudioBrief['expressionStyle'], string> = {
  seeding: '种草推荐',
  dry_goods: '干货分享',
  story: '故事叙述',
  review: '测评对比',
}

const PLATFORM_LABELS: Record<SocialStudioPlatform, string> = {
  xhs: '小红书',
  wechat: '微信公众号',
}

export function buildTopicAnglesPrompt(input: {
  platform: SocialStudioPlatform
  brief: SocialStudioBrief
}): { system: string; user: string } {
  const { platform, brief } = input
  const topic = brief.topic.trim()
  const audience = brief.audience.trim() || '泛兴趣读者'
  const expression = EXPRESSION_LABELS[brief.expressionStyle]
  const platformLabel = PLATFORM_LABELS[platform]
  const extra = brief.creativeRequirements.trim()

  const system = withCommonRules(
    `你是${platformLabel}内容策划。只输出 JSON，不写正文。` +
      '三个切入点必须角度明显不同（如：避坑、清单干货、故事反差、测评对比、懒人捷径等），' +
      '标题要有点击欲但不得夸大、医疗承诺或无依据数字。',
  )

  const user = `为下列创作任务策划 3 个高赞「切入点」（不是标题，是写作角度）。

平台：${platformLabel}
主题或素材：${topic}
目标读者：${audience}
倾向表达：${expression}
${extra ? `已有创作要求：${extra}\n` : ''}
每个切入点包含：
- title：一句话角度名（可带适量 emoji，≤28 字）
- desc：一句话说明这个角度为什么吸引人（≤60 字）
- hook：采纳后如何展开正文的开篇方向（≤80 字，第二人称或第一人称均可）

输出格式：
{"angles":[{"title":"...","desc":"...","hook":"..."},{"title":"...","desc":"...","hook":"..."},{"title":"...","desc":"...","hook":"..."}]}
${JSON_ONLY_INSTRUCTION}`

  return { system, user }
}
