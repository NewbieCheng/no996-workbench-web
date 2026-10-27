import { defineFlow, type AgentStageDef } from '../../../agent'

export const SOCIAL_WIZARD_OUTLINE_FLOW_ID = 'social-wizard-outline'

export const SOCIAL_WIZARD_OUTLINE_STAGES: AgentStageDef[] = [
  {
    id: 'plan-outline',
    order: 1,
    roleName: '规划大纲',
    roleTag: 'AI',
    kind: 'model',
    profile: 'plan',
    principle: '结合创作主题、参考母本和用户要求，规划标题、开篇、分段草案与视觉画面。',
    headline: 'AI 正在规划内容大纲…',
  },
]

export const SOCIAL_WIZARD_OUTLINE_FLOW = defineFlow(SOCIAL_WIZARD_OUTLINE_FLOW_ID, SOCIAL_WIZARD_OUTLINE_STAGES)
