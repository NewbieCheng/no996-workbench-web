import { defineFlow, type AgentStageDef } from '../../../agent'

export const SOCIAL_REWRITE_FLOW_ID = 'social-rewrite'

export const SOCIAL_REWRITE_STAGES: AgentStageDef[] = [
  {
    id: 'rewrite-pass1',
    order: 1,
    roleName: '第一遍改写',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '保留原文信息与顺序，弱化营销腔，改清爽。',
    headline: '正在生成第一遍改写…',
  },
  {
    id: 'rewrite-pass2',
    order: 2,
    roleName: '第二遍改写',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '去 AI 味，自然人话，并产出标题候选。',
    headline: '正在生成第二遍改写…',
  },
  {
    id: 'rewrite-titles',
    order: 3,
    roleName: '解析标题',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '解析第二遍 JSON，整理标题候选。',
    headline: '正在整理标题候选…',
  },
]

export const SOCIAL_REWRITE_FLOW = defineFlow(SOCIAL_REWRITE_FLOW_ID, SOCIAL_REWRITE_STAGES)
