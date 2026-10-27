import type { AgentStageDef } from '../../../agent'
import { defineFlow } from '../../../agent'

export const MOMENTS_PLAN_FLOW_ID = 'moments-plan'
export const MOMENTS_COPY_FLOW_ID = 'moments-copy'

export const MOMENTS_PLAN_STAGES: AgentStageDef[] = [
  {
    id: 'normalize',
    order: 1,
    roleName: '校验员',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '核对 7 个正式规划字段是否齐备，缺项直接返回可修复清单。',
    headline: '正在归一化并校验规划输入',
  },
  {
    id: 'seasonal',
    order: 2,
    roleName: '时令检索',
    roleTag: '检索',
    kind: 'tool',
    principle: '联网检索规划周期内的节气、节日与公开热点，检索不到就不编。',
    headline: '正在补充和筛选节气、节日、热点信息',
  },
  {
    id: 'draft',
    order: 3,
    roleName: '规划写手',
    roleTag: 'AI',
    kind: 'model',
    profile: 'plan',
    principle: '按日常经营周或主题推广周组织 7 天排期，不虚构用户没提供的业务事实。',
    headline: '正在按规划模式形成候选排期',
  },
  {
    id: 'qc',
    order: 4,
    roleName: '结构校验',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '校验日期、发布顺序、内容方向与选题是否成立，缺失即失败。',
    headline: '正在执行排期质量检查',
  },
  {
    id: 'finalize',
    order: 5,
    roleName: '整理',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '按正式输出格式整理周排期，不新增规划字段。',
    headline: '正在整理正式周排期',
  },
]

export const MOMENTS_COPY_STAGES: AgentStageDef[] = [
  {
    id: 'validate',
    order: 1,
    roleName: '校验员',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '文案必须指向已确认排期；个人分身正文为空则阻塞，不生成占位文案。',
    headline: '正在校验已确认排期和基础用户信息',
  },
  {
    id: 'persona',
    order: 2,
    roleName: '人设对齐',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '用人设正文做表达参考，不另写人设摘要给界面看。',
    headline: '正在整理人设与当天整体表达节奏',
  },
  {
    id: 'versions',
    order: 3,
    roleName: '文案写手',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '每条固定三个版本，不改日期、顺序、内容方向与选题。',
    headline: '正在按内容方向为每条生成三个版本',
  },
  {
    id: 'hardcheck',
    order: 4,
    roleName: '硬校验',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '违禁词、绝对化用语与无来源数字由代码判定。',
    headline: '正在检查当天完整结果',
  },
  {
    id: 'finalize',
    order: 5,
    roleName: '整理',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '按结构化契约整理三个版本；未通过硬校验则定向改写，最多 3 轮。',
    headline: '正在整理正式文案结果',
  },
]

export const MOMENTS_PLAN_FLOW = defineFlow(MOMENTS_PLAN_FLOW_ID, MOMENTS_PLAN_STAGES)
export const MOMENTS_COPY_FLOW = defineFlow(MOMENTS_COPY_FLOW_ID, MOMENTS_COPY_STAGES)

export const DAILY_DIRECTIONS = ['专业价值', '用户互动', '业务证明', '真人生活'] as const
export const THEME_PRODUCT_DIRECTIONS = [
  '场景 / 问题激活',
  '产品 / 价值认知',
  '证据与场景验证',
  '适配判断与行动准备',
] as const

export function contentDirectionOptions(mode: 'daily' | 'theme'): string[] {
  return mode === 'theme' ? [...THEME_PRODUCT_DIRECTIONS] : [...DAILY_DIRECTIONS]
}

export function withCurrentOption(options: string[], current: string): string[] {
  const trimmed = current.trim()
  if (!trimmed || options.includes(trimmed)) return options
  return [...options, trimmed]
}
