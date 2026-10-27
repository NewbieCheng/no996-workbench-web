/**
 * 爆款标题 · 阶段声明
 *
 * 与旧实现的区别（这是本次迁移的重点）：
 * - 「取词员」不再假装检索：内置句式库是代码内置的，真正的检索是结构之下的
 *   web_search 工具步骤（kind='tool'），只作为事实来源，不产出标题。
 * - 「评审」是真独立调用：temperature=0，只看草稿 + 硬校验结果（profile='review'）。
 * - 「编辑」只改被点名的标题，其余保留（不再无差别重跑一遍）。
 * - 「硬校验」是纯算法步骤（kind='algo'），UI 不会把它标成 AI。
 */
import type { AgentStageDef } from '../../../agent'
import { defineFlow } from '../../../agent'

export const TITLES_FLOW_ID = 'titles-generate'

export const TITLES_STAGES: AgentStageDef[] = [
  {
    id: 'understander',
    order: 1,
    roleName: '理解员',
    roleTag: 'AI',
    kind: 'model',
    profile: 'extract',
    principle: '把用户的一句话拆成结构化要点，明确痛点与目标，统一后续角色输入边界。',
    headline: '正在拆解客群定位与核心诉求…',
  },
  {
    id: 'formula',
    order: 2,
    roleName: '句式库',
    roleTag: '内置库',
    kind: 'algo',
    principle:
      '句式来自代码内置的可审计词表，不让模型凭空编造句式与历史表现。',
    headline: '正在匹配平台句式…',
  },
  {
    id: 'retriever',
    order: 3,
    roleName: '取词员',
    roleTag: '检索',
    kind: 'tool',
    principle:
      '真实联网检索主题相关的公开资料，作为标题里数字与说法的唯一事实来源；检索不到就不编。',
    headline: '正在检索可引用的事实来源…',
  },
  {
    id: 'writer',
    order: 4,
    roleName: '写手',
    roleTag: 'AI',
    kind: 'model',
    profile: 'draft',
    principle: '只用句式库里的句式与检索到的事实来写，严格执行平台字数上限。',
    headline: '正在起草标题初稿…',
  },
  {
    id: 'hardcheck',
    order: 5,
    roleName: '硬校验',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '字数、违禁词、绝对化用语、无依据数字由代码判定，不通过的直接进必改清单。',
    headline: '正在做字数与合规硬校验…',
  },
  {
    id: 'reviewer',
    order: 6,
    roleName: '评审',
    roleTag: '独立 AI',
    kind: 'model',
    profile: 'review',
    principle: '写评分离：评审是与写手独立的另一位专家，只看草稿与硬校验结果，不给自己打分。',
    headline: '独立评审正在给点击力与可信度打分…',
  },
  {
    id: 'editor',
    order: 7,
    roleName: '编辑',
    roleTag: 'AI 循环',
    kind: 'model',
    profile: 'draft',
    principle: '只改被指出问题的标题，其余原样保留；改完回到评审重新打分，越改越好才继续，没起色就收手。',
    headline: '正在按评审意见定向改写…',
  },
  {
    id: 'optimizer',
    order: 8,
    roleName: '选优',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '由本机代码算 Pareto 前沿：结果确定、可复现，不花积分也不会被随机数影响。',
    headline: '正在计算 Pareto 最优前沿…',
  },
]

/**
 * 与 script-lab / persona 一样在声明文件里完成注册，
 * 保证 listFlows() 能枚举全部流程（任务中心与调试面板据此读取）。
 */
export const TITLES_FLOW = defineFlow(TITLES_FLOW_ID, TITLES_STAGES)

/** 只上报给用户看的阶段（选优为内部算法，进度条里保留但不夸大） */
export const TITLES_PROGRESS_STAGE_IDS = [
  'understander',
  'formula',
  'retriever',
  'writer',
  'hardcheck',
  'reviewer',
  'editor',
  'optimizer',
] as const
