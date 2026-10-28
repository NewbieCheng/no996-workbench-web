/**
 * 脚本引擎 · 阶段声明
 *
 * kind 必须诚实：'定稿' 与 '硬校验' 是纯算法（algo），检索是 tool，
 * 其余为模型调用。UI 直接按 kind 渲染标签，杜绝把算法标成 AI。
 */
import { defineFlow } from '../../../agent'
import type { AgentStageDef } from '../../../agent'

export const SCRIPT_FLOW_ID = 'script-generate'

export const SCRIPT_STAGES: AgentStageDef[] = [
  {
    id: 'autofill',
    order: 1,
    roleName: '预填',
    roleTag: 'AI 轻量',
    kind: 'model',
    profile: 'autofill',
    principle: '产品名一填好，先猜出人群、卖点和痛点，用户不管也能继续。',
    headline: '正在预填人群与卖点…',
  },
  {
    id: 'planner',
    order: 2,
    roleName: '策划员',
    roleTag: 'AI',
    kind: 'model',
    profile: 'extract',
    principle: '只拆目标、场景、事实与购买障碍；目标、时长和转化强度由用户配置锁定，缺失事实不靠假设升级。',
    headline: '正在拆解需求…',
  },
  {
    id: 'structurer',
    order: 3,
    roleName: '结构师',
    roleTag: 'AI + 检索',
    kind: 'model',
    profile: 'plan',
    principle: '只从既有结构库选公式并写 purpose/share；宿主锁定段数、名称、顺序和稳定 id，并归一化 share。',
    headline: '正在挑选结构…',
  },
  {
    id: 'writer',
    order: 4,
    roleName: '编剧',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '按宿主锁定的 id、顺序、预算逐段写口播与画面/动作；只使用给定事实，long 直播按章生成后合并。',
    headline: '正在逐段写作…',
  },
  {
    id: 'hardcheck',
    order: 5,
    roleName: '硬校验',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '字数、违禁词、必含词、医疗与收益承诺、虚假紧迫感交给代码判定，不交给模型。',
    headline: '正在做代码校验…',
  },
  {
    id: 'reviewer',
    order: 6,
    roleName: '评审',
    roleTag: '独立 AI',
    kind: 'model',
    profile: 'review',
    principle: '评审只依据文本与硬校验给模拟内容分，不冒充真实留存；硬错误必须标 mustFix，未知 id 由宿主拦截。',
    headline: '正在模拟观众留存…',
  },
  {
    id: 'editor',
    order: 7,
    roleName: '编辑',
    roleTag: 'AI 循环',
    kind: 'model',
    profile: 'draft',
    principle: 'targets 携带完整原稿与授权 id；模型返回全文但宿主只合并目标段字段，失败保留上一有效版本。',
    headline: '正在修改掉线段落…',
  },
  {
    id: 'finalize',
    order: 8,
    roleName: '定稿',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '补齐时间码并复核硬错误；仍有未解除问题时如实标注待修改项后照常交付，不整份丢弃成稿。',
    headline: '正在拼接成稿…',
  },
]

export const SCRIPT_FLOW = defineFlow(SCRIPT_FLOW_ID, SCRIPT_STAGES)

/** 六步进度条展示用（把硬校验并入评审前的可见步骤） */
export const SCRIPT_PROGRESS_STAGE_IDS = [
  'planner',
  'structurer',
  'writer',
  'hardcheck',
  'reviewer',
  'finalize',
] as const
