import type { MockResponder } from '../../../agent/mock-clients'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'

export type SocialTopicAnglesDemoContext = {
  platform: SocialStudioPlatform
  topic: string
  audience: string
  expressionStyle: SocialStudioBrief['expressionStyle']
}

const EXPRESSION_HINT: Record<SocialStudioBrief['expressionStyle'], string> = {
  seeding: '真诚种草',
  dry_goods: '步骤清单',
  story: '故事反差',
  review: '测评避坑',
}

/** 演示模式：结构与正式解析一致，文案围绕调用方传入的主题生成。 */
export function createSocialTopicAnglesMockResponder(context: SocialTopicAnglesDemoContext): MockResponder {
  const topic = context.topic.trim() || '创作主题'
  const audience = context.audience.trim() || '目标读者'
  const hint = EXPRESSION_HINT[context.expressionStyle]
  const platformLabel = context.platform === 'xhs' ? '小红书' : '公众号'

  return (request) => {
    if (request.stageHint !== 'plan-angles') return null
    return JSON.stringify({
      angles: [
        {
          title: `📋 ${topic}：${hint}清单（演示）`,
          desc: `把「${topic}」拆成今天就能照做的几步，适合${audience}收藏回看。`,
          hook: `先点出${audience}在${topic}上最常卡住的地方，再给出可执行清单（${platformLabel}演示数据）。`,
        },
        {
          title: `⚠️ 关于${topic}，多数人想反了`,
          desc: '用反差提醒常见误区，激发「我是不是也这样」的代入感。',
          hook: `列举 2～3 个与${topic}相关的典型误区，并给出纠偏做法（演示，非远程模型）。`,
        },
        {
          title: `💡 我靠这一招理顺了${topic}`,
          desc: '第一人称小故事，强调前后变化与可复用的方法。',
          hook: `用简短经历引出唯一关键动作，再展开对${audience}的建议（演示）。`,
        },
      ],
    })
  }
}

export function createSocialComposeMockResponder(platform: SocialStudioPlatform): MockResponder {
  return (request) => {
    if (request.stageHint && request.stageHint !== 'compose-body') return null
    const rawUser = request.messages?.find((m) => m.role === 'user')?.content
    const userText = typeof rawUser === 'string' ? rawUser : ''
    const topicMatch = userText.match(/主题：(.+)/)
    const topic = topicMatch?.[1]?.trim() || '创作主题'
    const platformLabel = platform === 'xhs' ? '小红书' : '公众号'
    return `## 从一个具体问题开始\n\n围绕「${topic}」，先写下读者最关心的痛点与可执行建议。\n\n## 把建议变成行动\n\n选择一件今天就能尝试的小事，记录过程与反馈。这是一份${platformLabel}演示稿，用于预览流式排版，不是远程模型结果。\n\n## 互动收尾\n\n你会从哪一步开始？欢迎在评论区交流。`
  }
}
