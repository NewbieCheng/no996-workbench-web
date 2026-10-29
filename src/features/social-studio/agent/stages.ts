import { defineFlow, type AgentStageDef } from '../../../agent'

export const SOCIAL_COMPOSE_FLOW_ID = 'social-compose'

/**
 * 图文生产流程。
 *
 * 爆款复刻与灵感创作共用这一套阶段；差异只放在 payload。
 * 顺序是硬约束：正文先出（compose-body），再做配图规划与逐张生图；
 * 这样任务中心与页面都能先展示文案，再补图片。
 */
export const SOCIAL_COMPOSE_STAGES: AgentStageDef[] = [
  {
    id: 'resolve-source',
    order: 1,
    roleName: '解析素材',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '校验来源是否为图文，解析参考素材与可用图片，不调用模型。',
    headline: '正在解析参考素材…',
  },
  {
    id: 'compose-body',
    order: 2,
    roleName: '撰写正文',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '根据主题、大纲或参考素材流式生成完整正文。',
    headline: '正在撰写正文…',
  },
  {
    id: 'plan-images',
    order: 3,
    roleName: '配图规划',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '按正文与模板生成逐张图片的画面与上屏文字规划。',
    headline: '正在规划配图…',
  },
  {
    id: 'generate-images',
    order: 4,
    roleName: '逐张生图',
    roleTag: '生图工具',
    kind: 'tool',
    principle: '调用生图服务逐张生成画面；每完成一张更新一次进度。',
    headline: '正在生成配图…',
  },
  {
    id: 'compose-cards',
    order: 5,
    roleName: '排版合成',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '把规划好的标题、辅助文字与角标叠加到图片上，保证可读。',
    headline: '正在合成图文卡片…',
  },
  {
    id: 'finalize',
    order: 6,
    roleName: '交付成果',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '组装标题、正文、配图与提示信息，供页面与任务历史恢复。',
    headline: '正在交付成果…',
  },
]

export const SOCIAL_COMPOSE_FLOW = defineFlow(SOCIAL_COMPOSE_FLOW_ID, SOCIAL_COMPOSE_STAGES)
