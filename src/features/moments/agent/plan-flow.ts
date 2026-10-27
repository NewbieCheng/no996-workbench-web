import {
  createDisplayDelta,
  createStageRunner,
  isAbortError,
  resolveBudgets,
  type AgentClients,
  type AgentRunSnapshot,
  type AgentSink,
} from '../../../agent'
import { MomentsFlowError } from './errors'
import { coerceModelText, fenceJsonForMoments } from './model-text'
import { parseMomentsPlanOutput, type MomentsPlanDayDraft } from './parser'
import { weekRange } from '../service/week-range'
import { PLAN_SYSTEM, PLAN_USER } from './prompts'
import { MOMENTS_PLAN_FLOW_ID, MOMENTS_PLAN_STAGES } from './stages'
import type { MomentsPlanInput } from './types'

export type RunMomentsPlanFlowInput = {
  input: MomentsPlanInput
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  onDelta?: (chunk: string) => void
}

function publishSpecText(spec: MomentsPlanInput['publishSpec']): string {
  if (spec.kind === 'weekly') return `整周共 ${spec.perWeek} 条，平均分配到每天`
  return `按天：${spec.perDay.join(',')}`
}

function validatePlanInput(input: MomentsPlanInput): string[] {
  const details: string[] = []
  const range = weekRange(input.planPeriod.startDate)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.planPeriod.startDate) || range.weekStart !== input.planPeriod.startDate || range.weekEnd !== input.planPeriod.endDate) details.push('规划周期必须是完整的周一至周日')
  if (input.planningMode !== 'daily' && input.planningMode !== 'theme') details.push('规划模式不受支持')
  if (input.planningMode === 'theme' && !input.productRef?.name?.trim() && !input.activityRef?.name?.trim()) {
    details.push('主题推广周必须填写产品或活动名称')
  }
  if (!input.businessPurpose.trim()) details.push('请填写本周运营目的')
  if (!input.coreTasks.trim()) details.push('请填写核心任务')
  if (input.publishSpec.kind === 'weekly' && (!Number.isInteger(input.publishSpec.perWeek) || input.publishSpec.perWeek < 1 || input.publishSpec.perWeek > 28)) details.push('按周发布时数量必须为 1–28 的整数')
  if (input.publishSpec.kind === 'daily' && (input.publishSpec.perDay.length !== 7 || input.publishSpec.perDay.some ( (n) => !Number.isInteger(n) || n < 1 || n > 4))) {
    details.push('按天发布时每天必须为 1–4 条')
  }
  return details
}

export async function runMomentsPlanFlow(input: RunMomentsPlanFlowInput): Promise<{
  days: MomentsPlanDayDraft[]
  usedMock: boolean
  run: AgentRunSnapshot
}> {
  const { clients, sink, signal, onDelta } = input
  const spec = input.input
  const budgets = resolveBudgets(clients.isMock)
  const displayDelta = createDisplayDelta(onDelta, ['topic', 'contentDirection'], '\n')

  const flowAc = new AbortController()
  const onOuterAbort = () => flowAc.abort()
  if (signal?.aborted) flowAc.abort()
  signal?.addEventListener('abort', onOuterAbort)
  const flowTimer = setTimeout(() => flowAc.abort(), budgets.flowMs)
  try {
    const runner = createStageRunner({
      flowId: MOMENTS_PLAN_FLOW_ID,
      stages: MOMENTS_PLAN_STAGES,
      clients,
      sink,
      signal: flowAc.signal,
      background: spec.personaBackground,
      resume: input.resume,
    })

    const details = await runner.runAlgo('normalize', () => validatePlanInput(spec))
    if (details.length) {
      throw new MomentsFlowError({
        code: 'INVALID_INPUT',
        message: '需要先补齐规划输入',
        details,
      })
    }

    let seasonal = ''
    try {
      seasonal = await runner.runTool('seasonal', async () => {
        const query = `${spec.planPeriod.startDate} ${spec.planPeriod.endDate} 节气 节日 热点`
        const result = await runner.runSearch(
          'seasonal',
          query,
          `查找 ${spec.planPeriod.startDate} 至 ${spec.planPeriod.endDate} 可用的节气、节日或公开热点，只作排期参考。`,
        )
        if (result.status === 'failed' || result.status === 'rejected') {
          return ''
        }
        return result.snippets
          .map((s) => [s.title, s.snippet].filter(Boolean).join('｜'))
          .filter(Boolean)
          .slice(0, 8)
          .join('\n')
      })
    } catch (e) {
      if (isAbortError(e)) throw e
      await runner.failStage('seasonal', e)
      seasonal = ''
    }

    const raw = await runner.runModel<string>('draft', {
      system: PLAN_SYSTEM,
      userTemplate: PLAN_USER,
      vars: {
        startDate: spec.planPeriod.startDate,
        endDate: spec.planPeriod.endDate,
        planningMode: spec.planningMode,
        businessPurpose: spec.businessPurpose,
        coreTasks: spec.coreTasks,
        productName: spec.productRef?.name,
        activityName: spec.activityRef?.name,
        publishSpec: publishSpecText(spec.publishSpec),
        revision: spec.revisionInstruction,
        currentDays: spec.currentDays ? JSON.stringify(spec.currentDays) : undefined,
        persona: spec.personaContent,
        seasonal,
      },
      profile: 'plan',
      responseFormat: { type: 'text' },
      parse: (text) => {
        const outcome = parseMomentsPlanOutput(fenceJsonForMoments(coerceModelText(text)), spec)
        if (outcome.status !== 'success') throw new Error(outcome.message)
        return text.trim()
      },
      onDelta: displayDelta,
      timeoutMs: budgets.stepMs,
    })

    const parsed = await runner.runAlgo('qc', () =>
      parseMomentsPlanOutput(fenceJsonForMoments(coerceModelText(raw)), spec),
    )
    if (parsed.status !== 'success') {
      throw new MomentsFlowError({
        code: parsed.code,
        message: parsed.message,
        status: parsed.status,
        details: parsed.details,
        recoveryAction: parsed.recoveryAction,
      })
    }

    await runner.runAlgo('finalize', () => parsed.value.days)
    await runner.finish('done')
    return { days: parsed.value.days, usedMock: clients.isMock, run: runner.snapshot() }
  } finally {
    clearTimeout(flowTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}
