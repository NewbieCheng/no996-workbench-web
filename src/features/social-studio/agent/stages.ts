import { defineFlow, type AgentStageDef } from '../../../agent'

export const SOCIAL_COMPOSE_FLOW_ID = 'social-compose'

export const SOCIAL_COMPOSE_STAGES: AgentStageDef[] = [
  {
    id: 'resolve-reference',
    order: 1,
    roleName: '解析参考',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '从链接或导入会话解析参考素材，供后续创作使用。',
    headline: '正在解析参考素材…',
  },
  {
    id: 'compose-body',
    order: 2,
    roleName: '撰写正文',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '根据写作设定与参考素材流式生成正文。',
    headline: '正在撰写正文…',
  },
  {
    id: 'compose-images',
    order: 3,
    roleName: '配图规划',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '根据主题生成配图提示，交由工作台的图片服务封装执行。',
    headline: '正在准备配图提示…',
  },
]

export const SOCIAL_COMPOSE_FLOW = defineFlow(SOCIAL_COMPOSE_FLOW_ID, SOCIAL_COMPOSE_STAGES)
