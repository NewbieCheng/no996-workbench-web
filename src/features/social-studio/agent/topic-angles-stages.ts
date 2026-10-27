import { defineFlow, type AgentStageDef } from '../../../agent'

export const SOCIAL_TOPIC_ANGLES_FLOW_ID = 'social-topic-angles'

export const SOCIAL_TOPIC_ANGLES_STAGES: AgentStageDef[] = [
  {
    id: 'plan-angles',
    order: 1,
    roleName: '切入点策划',
    roleTag: 'AI',
    kind: 'model',
    profile: 'extract',
    principle: '根据主题与写作偏好，产出 3 个互不重复、可执行的爆款切入角度。',
    headline: '正在推演高赞切入点…',
  },
]

export const SOCIAL_TOPIC_ANGLES_FLOW = defineFlow(SOCIAL_TOPIC_ANGLES_FLOW_ID, SOCIAL_TOPIC_ANGLES_STAGES)
