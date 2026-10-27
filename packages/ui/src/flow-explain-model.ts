/**
 * 「了解生产流程」面板的**纯逻辑**（无 JSX、无 React），单独成模块以便单测直接 import。
 * 组件本体 `flow-explain.tsx` 只负责画出来。
 *
 * 这个面板要回答用户一个问题：「这个活儿到底是谁在帮我干、按什么顺序干」。
 * 所以这里只做两件事：
 *   1) 按步骤的**真实来源**（`kind`）如实归类，算出「几位 AI 专家 + 几道本机算法」；
 *   2) 生成一句给用户看的摘要。
 *
 * **数字一律推导，不允许调用点手写。** 手写的数字迟早和 `stages.ts` 对不上，
 * 那时候面板就在撒谎 —— 而「阶段标签要诚实」是硬约束（见 AGENTS.md）：
 * `algo` / `tool` 绝不能算进「AI 专家」，纯算法步骤不得说成 AI。
 */

export type FlowExplainStep = {
  /** 稳定 id */
  id: string
  /** 显示序号 */
  order: number
  /** 这一步是谁在做（角色名 / 环节名） */
  label: string
  /** 真实来源：`model` / `algo` / `tool`。决定它算不算「AI 专家」，也驱动标签样式 */
  kind?: string
  /** 类型标签文案（如「AI」「纯算法」）；不传则不渲染标签 */
  tag?: string
  /**
   * 一句话说明「这一步在干什么」。用大白话，别写实现细节
   * （不说调用次数、不说轮次上限、不说提示词）—— 用户只想知道这一步替他做了什么。
   */
  note?: string
}

export type FlowKindCounts = {
  total: number
  /** AI 专家：真正调用模型、需要理解与写作的步骤 */
  expert: number
  /** 联网检索：真实工具调用，不是模型，也不算本机算法 */
  search: number
  /** 本机算法：字数/合规判定、Pareto 选优等，不调用模型 */
  local: number
}

/**
 * 按 `kind` 归类。**未知的 kind 不归到任何一类**（宁可合计对不上，也不把不知道的东西
 * 说成 AI 专家或本机算法）—— `agent-flow-check` 里有断言保证正式流程不会出现未知 kind。
 */
export function flowKindCounts(steps: FlowExplainStep[]): FlowKindCounts {
  let expert = 0
  let search = 0
  let local = 0
  for (const step of steps) {
    if (step.kind === 'model') expert += 1
    else if (step.kind === 'tool') search += 1
    else if (step.kind === 'algo') local += 1
  }
  return { total: steps.length, expert, search, local }
}

/** 按 `order` 升序排好（不改原数组）。面板按这个顺序列「第一个、第二个…」。 */
export function orderedFlowSteps(steps: FlowExplainStep[]): FlowExplainStep[] {
  return [...steps].sort((a, b) => a.order - b.order)
}

/**
 * 摘要文案，如「8 个环节：4 位 AI 专家 · 1 步联网检索 · 3 道本机算法」。
 * 只说真实存在的环节：没有检索步骤就不提检索。
 */
export function flowKindSummaryText(steps: FlowExplainStep[], lang: 'zh' | 'en' = 'zh'): string {
  const counts = flowKindCounts(steps)
  if (!counts.total) return ''
  const parts: string[] = []
  if (lang === 'en') {
    if (counts.expert) parts.push(`${counts.expert} AI specialists`)
    if (counts.search) parts.push(`${counts.search} web search`)
    if (counts.local) parts.push(`${counts.local} local algorithms`)
    return `${counts.total} stages: ${parts.join(' · ')}`
  }
  if (counts.expert) parts.push(`${counts.expert} 处模型推理`)
  if (counts.search) parts.push(`${counts.search} 次联网检索`)
  if (counts.local) parts.push(`${counts.local} 项本机算法`)
  return `共 ${counts.total} 个处理阶段：${parts.join(' · ')}`
}

/**
 * 顶在面板最上面的那句话，也是用户唯一一定会读的一句：
 * 说清「**几位 AI 专家跟你协同、一共几个环节**」，不说调用次数、不说轮次上限。
 *
 * 为什么用「位」而不是「轮」：「多轮调用」是给技术人员看的实现细节，
 * 用户关心的是「有人在帮我干活、干了几件事」。
 */
export function flowLeadText(steps: FlowExplainStep[], lang: 'zh' | 'en' = 'zh'): string {
  const { expert, total } = flowKindCounts(steps)
  if (!total) return ''
  if (lang === 'en') {
    return expert
      ? `${expert} model roles participate across ${total} sequential stages`
      : `${total} sequential stages`
  }
  return expert
    ? `${expert} 位 AI 专家协同参与，${total} 个处理阶段依序执行`
    : `共 ${total} 个处理阶段依序执行`
}

/**
 * `kind` → 短标签的兜底文案。调用方传了 `tag` 就用调用方的（各流程的措辞更具体，
 * 如「独立 AI」「内置库」）；没传时至少不能空白，也不能把 algo 说成 AI。
 */
export function flowKindTag(kind: string | undefined, lang: 'zh' | 'en' = 'zh'): string {
  if (kind === 'model') return 'AI'
  if (kind === 'algo') return lang === 'en' ? 'Local rule' : '本机算法'
  if (kind === 'tool') return lang === 'en' ? 'Web search' : '联网检索'
  return ''
}

/** 面板自带的文案。放在这里是为了让「组件默认值」和「页面传入值」只有一个来源。 */
export const FLOW_EXPLAIN_COPY: Record<'zh' | 'en', { title: string; hint: string; stagesHeading: string }> = {
  zh: {
    title: '生产流程说明',
    hint: '提交后将按下述顺序自动执行，无需全程值守；各阶段产出可于生成结果中的「过程」面板查阅。',
    stagesHeading: '阶段一览',
  },
  en: {
    title: 'Process overview',
    hint: 'After submission, stages run in the order below. Open the process panel in the results to review each stage’s output.',
    stagesHeading: 'Stages',
  },
}
