import {
  createStageRunner,
  parseStrictJson,
  type AgentClients,
} from '../../../agent'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'
import { buildTopicAnglesPrompt } from './topic-angles-prompts'
import { SOCIAL_TOPIC_ANGLES_FLOW_ID, SOCIAL_TOPIC_ANGLES_STAGES } from './topic-angles-stages'

export type SocialTopicAngle = {
  id: string
  title: string
  desc: string
  hook: string
}

type RawAnglesPayload = {
  angles?: Array<{ title?: string; desc?: string; description?: string; hook?: string }>
}

function parseTopicAnglesPayload(raw: string): SocialTopicAngle[] {
  const obj = parseStrictJson<RawAnglesPayload>(raw, '切入点策划')
  const list = obj.angles
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('模型未返回有效的切入点列表，请重试。')
  }

  const angles: SocialTopicAngle[] = []
  for (let i = 0; i < Math.min(list.length, 3); i++) {
    const item = list[i]
    const title = String(item?.title ?? '').trim()
    const desc = String(item?.desc ?? item?.description ?? '').trim()
    const hook = String(item?.hook ?? '').trim()
    if (!title || !desc) {
      throw new Error(`第 ${i + 1} 个切入点缺少标题或说明，请重试。`)
    }
    angles.push({
      id: `angle-${i + 1}`,
      title,
      desc,
      hook: hook || desc,
    })
  }

  if (angles.length < 3) {
    throw new Error('需要 3 个互不重复的切入点，请重试。')
  }

  return angles
}

export type RunSocialTopicAnglesFlowInput = {
  platform: SocialStudioPlatform
  brief: SocialStudioBrief
  clients: AgentClients
  signal?: AbortSignal
}

export function createSocialTopicAnglesDemoResponder(input: {
  platform: SocialStudioPlatform
  brief: SocialStudioBrief
}) {
  const topic = input.brief.topic.trim() || '当前主题'
  const label = input.platform === 'xhs' ? '小红书' : '公众号'
  return () => ({
    angles: [
      { title: `【演示】${topic}：新手常见误区`, desc: `演示角度：从${topic}的常见误区切入，适合${label}读者快速建立判断框架。`, hook: `以下为「${topic}」主题的演示开篇方向，实际发布前请补充可靠资料。` },
      { title: `【演示】${topic}：一份实用清单`, desc: `演示角度：把${topic}拆成可逐项检查的行动清单。`, hook: `这份关于${topic}的演示清单先梳理步骤，具体结论需结合真实资料核对。` },
      { title: `【演示】${topic}：过程复盘`, desc: `演示角度：以过程记录和复盘结构展开，不虚构真实案例。`, hook: `从${topic}的一次演示性复盘开始，展示如何整理过程与经验。` },
    ],
  })
}

export async function runSocialTopicAnglesFlow(
  input: RunSocialTopicAnglesFlowInput,
): Promise<SocialTopicAngle[]> {
  const topic = input.brief.topic.trim()
  if (!topic) {
    throw new Error('请先填写主题或素材。')
  }

  const runner = createStageRunner({
    flowId: SOCIAL_TOPIC_ANGLES_FLOW_ID,
    stages: SOCIAL_TOPIC_ANGLES_STAGES,
    clients: input.clients,
    signal: input.signal,
  })

  const { system, user } = buildTopicAnglesPrompt({
    platform: input.platform,
    brief: input.brief,
  })

  return runner.runModel('plan-angles', {
    system,
    user,
    responseFormat: { type: 'json_object' },
    parse: parseTopicAnglesPayload,
  })
}
