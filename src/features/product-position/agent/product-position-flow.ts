import {
  createAgentClients,
  createStageRunner,
  defineFlow,
  extractFencedMarkdown,
  type AgentClients,
  type AgentSink,
  type AgentStageDef,
} from '../../../agent'
import {
  buildProductUserPrompt,
  buildRepairPrompt,
  getProductSystemPrompt,
} from '../../../prompts/product-positioning.ts'
import type {
  ParseIssue,
  ProductReportView,
  ReportInputSnapshot,
} from '../../../services/product-position/types.ts'
import { checkAdequacy } from '../lib/adequacy.ts'
import { parseProductReport, structureIssues } from '../lib/report-parser.ts'
import { createProductMockResponder } from './demo-responder.ts'

/**
 * 产品定位与优势分析 flow。
 *
 * 阶段划分对应 PRD 第 8 节的状态：准备资料 → 分析中 → 整理成果 → 已完成/失败。
 * 模型只产出 Markdown（Skill 的正式产物），结构校验与解析都由程序完成，
 * 不合格时给一次定向修复的机会，仍不合格就如实失败。
 */

export const PRODUCT_POSITIONING_FLOW_ID = 'product-position'

export const PRODUCT_POSITIONING_STAGES: AgentStageDef[] = [
  {
    id: 'prepare-context',
    order: 1,
    roleName: '准备资料',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '合并产品、补充回答、附件正文与人设背景，先判断资料是否足以说明产品提供什么。',
    headline: 'headlinePreparing',
  },
  {
    id: 'compose-report',
    order: 2,
    roleName: '撰写定位报告',
    roleTag: 'AI 生成',
    kind: 'model',
    profile: 'draft',
    principle: '按固定方法论与正式模板生成整篇 Markdown 报告，缺资料如实标注，不编造证据。',
    headline: 'headlineAnalyzing',
  },
  {
    id: 'check-structure',
    order: 3,
    roleName: '校验结构',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '按模板标题层级校验六章与固定栏目，定位缺章、缺栏目与被截断的表格。',
    headline: 'headlineValidating',
  },
  {
    id: 'repair-report',
    order: 4,
    roleName: '按模板修复',
    roleTag: 'AI 修复',
    kind: 'model',
    profile: 'review',
    principle: '只在结构不合格时触发，最多一次；只补结构，不改事实与结论。',
    headline: 'headlineValidating',
  },
  {
    id: 'finalize',
    order: 5,
    roleName: '整理成果',
    roleTag: '纯算法',
    kind: 'algo',
    principle: '把最终 Markdown 解析成页面视图模型，失败也保留原文供排查。',
    headline: 'headlineDone',
  },
]

export const PRODUCT_POSITIONING_FLOW = defineFlow(PRODUCT_POSITIONING_FLOW_ID, PRODUCT_POSITIONING_STAGES)

export class ProductInputInsufficientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductInputInsufficientError'
  }
}

export type RunProductPositionInput = {
  snapshot: ReportInputSnapshot
  clients?: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  onDelta?: (chunk: string) => void
}

export type RunProductPositionResult = {
  markdown: string
  view?: ProductReportView
  issues: ParseIssue[]
  ok: boolean
  usedMock: boolean
}

/** 模型偶尔会用围栏包裹整篇报告；统一剥掉围栏，解析器只认正文。 */
export function normalizeReportMarkdown(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('```')) return trimmed
  return extractFencedMarkdown(trimmed, 'markdown').trim()
}

export async function runProductPositionFlow(
  input: RunProductPositionInput,
): Promise<RunProductPositionResult> {
  const clients = input.clients ?? createAgentClients({ mockResponder: createProductMockResponder() })
  const runner = createStageRunner({
    flowId: PRODUCT_POSITIONING_FLOW_ID,
    stages: PRODUCT_POSITIONING_STAGES,
    clients,
    sink: input.sink,
    signal: input.signal,
  })

  const system = getProductSystemPrompt()
  const user = buildProductUserPrompt(input.snapshot)

  try {
    await runner.runAlgo('prepare-context', () => {
      const adequacy = checkAdequacy(input.snapshot)
      if (adequacy.status === 'insufficient') throw new ProductInputInsufficientError(adequacy.reason)
      return { promptChars: user.length }
    })

    let markdown = await runner.runModel<string>('compose-report', {
      system,
      user,
      onDelta: input.onDelta,
      parse: normalizeReportMarkdown,
    })

    let parsed = await runner.runAlgo('check-structure', () => parseProductReport(markdown))

    if (structureIssues(parsed.issues).length > 0) {
      const repaired = await runner.runModel<string>('repair-report', {
        system,
        user: buildRepairPrompt(markdown, structureIssues(parsed.issues)),
        parse: normalizeReportMarkdown,
      })
      markdown = repaired
      parsed = await runner.runAlgo('finalize', () => parseProductReport(markdown))
    } else {
      await runner.skip('repair-report')
      await runner.runAlgo('finalize', () => parsed)
    }

    if (parsed.issues.some((issue) => issue.code === 'truncated')) {
      throw new Error('报告没有生成完整（表格被截断），请重试。')
    }

    await runner.finish('done')
    return {
      markdown,
      view: parsed.view,
      issues: parsed.issues,
      ok: parsed.ok,
      usedMock: clients.isMock,
    }
  } catch (error) {
    await runner.finish(
      error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : 'failed',
    )
    throw error
  }
}
