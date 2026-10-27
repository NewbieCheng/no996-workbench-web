import {
  createDisplayDelta,
  createStageRunner,
  resolveBudgets,
  runHardCheck,
  type AgentClients,
  type AgentRunSnapshot,
  type AgentSink,
} from '../../../agent'
import { MomentsFlowError } from './errors'
import { fenceJsonForMoments } from './model-text'
import { parseMomentsCopyOutput } from './parser'
import { COPY_EDIT_USER, COPY_SYSTEM, COPY_USER } from './prompts'
import { MOMENTS_COPY_FLOW_ID, MOMENTS_COPY_STAGES } from './stages'
import type { MomentsCopyInput } from './types'
import type { MomentsContentDraft } from '../domain/moments'

export type RunMomentsCopyFlowInput = {
  input: MomentsCopyInput
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  onDelta?: (chunk: string) => void
}

const MAX_ROUNDS = 3

export async function runMomentsCopyFlow(input: RunMomentsCopyFlowInput): Promise<{
  drafts: MomentsContentDraft[]
  usedMock: boolean
  run: AgentRunSnapshot
}> {
  const spec = input.input
  const { clients, sink, signal, onDelta } = input
  const budgets = resolveBudgets(clients.isMock)
  const displayDelta = createDisplayDelta(onDelta, ['topic', 'angleTitle', 'spoken'], '\n')

  const runner = createStageRunner({
    flowId: MOMENTS_COPY_FLOW_ID,
    stages: MOMENTS_COPY_STAGES,
    clients,
    sink,
    signal,
    resume: input.resume,
    background: spec.personaBackground,
  })

  const flowAc = new AbortController()
  const onOuterAbort = () => flowAc.abort()
  signal?.addEventListener('abort', onOuterAbort)
  const flowTimer = setTimeout(() => flowAc.abort(), budgets.flowMs)

  try {
    const items = spec.rewrite
      ? spec.items.filter((item) => item.id === spec.rewrite?.scheduleItemId)
      : spec.items
    const knownIds = new Set(items.map((item) => item.id))

    await runner.runAlgo('validate', () => {
      if (spec.week.status !== 'confirmed' || !spec.week.scheduleVersion) {
        throw new MomentsFlowError({
          code: 'INVALID_INPUT',
          message: '请先确认并保存排期，再生成当天文案',
        })
      }
      if (items.length === 0) {
        throw new MomentsFlowError({
          code: 'INVALID_INPUT',
          message: '当天没有可生成的排期条目',
        })
      }
      if (!spec.personaContent?.trim()) {
        throw new MomentsFlowError({
          code: 'USER_PROFILE_REQUIRED',
          message: '尚未配置基础用户信息，无法生成符合当前身份的朋友圈内容。',
          recoveryAction: '请先完成个人数字分身的生成与确认保存。',
        })
      }
      return { ok: true, count: items.length }
    })

    await runner.runAlgo('persona', () => ({
      name: spec.week.weekStart,
      injected: Boolean(spec.personaContent?.trim()),
    }))

    const operation = spec.rewrite ? 'rewrite_item' : 'generate_day'
    let raw = await runner.runModel<string>('versions', {
      system: COPY_SYSTEM,
      userTemplate: COPY_USER,
      vars: {
        operation,
        date: spec.date,
        scheduleVersion: spec.week.scheduleVersion,
        businessPurpose: spec.week.businessPurpose,
        coreTasks: spec.week.coreTasks,
        persona: spec.personaContent,
        itemsJson: JSON.stringify(
          items.map((item) => ({
            scheduleItemId: item.id,
            date: item.date,
            publishOrder: item.publishOrder,
            contentDirection: item.contentDirection,
            topic: item.topic,
            captureSuggestion: item.captureSuggestion,
          })),
        ),
        materialsJson: JSON.stringify(spec.materials),
        instruction: spec.rewrite?.instruction,
        previousVersions: spec.rewrite?.previousVersions.join('\n---\n'),
      },
      profile: 'draft',
      onDelta: displayDelta,
      timeoutMs: budgets.stepMs,
    })

    let parsed = parseMomentsCopyOutput(fenceJsonForMoments(raw), knownIds)
    if (parsed.status !== 'success') {
      throw new MomentsFlowError({
        code: parsed.code,
        message: parsed.message,
        status: parsed.status,
        details: parsed.details,
        recoveryAction: parsed.recoveryAction,
      })
    }

    let drafts = parsed.value
    let round = 0
    await runner.runAlgo('hardcheck', () => {
      const segments = drafts.flatMap((draft, itemIndex) =>
        draft.versions.map((text, versionIndex) => ({
          id: `${itemIndex + 1}-${versionIndex + 1}`,
          text,
        })),
      )
      return runHardCheck({
        text: drafts.flatMap((d) => d.versions).join('\n'),
        segments,
        segmentCharTolerance: 1.3,
      })
    })

    let check = runHardCheck({
      text: drafts.flatMap((d) => d.versions).join('\n'),
      segments: drafts.flatMap((draft, itemIndex) =>
        draft.versions.map((text, versionIndex) => ({
          id: `${itemIndex + 1}-${versionIndex + 1}`,
          text,
        })),
      ),
    })

    while (!check.pass && round < MAX_ROUNDS) {
      round += 1
      raw = await runner.runModel<string>('versions', {
        system: COPY_SYSTEM,
        userTemplate: COPY_EDIT_USER,
        vars: {
          mustFix: check.hits.map((hit) => `${hit.segmentId ?? ''} ${hit.label}`).join('；'),
          draftJson: JSON.stringify({ status: 'success', day: { date: spec.date, contents: drafts } }),
        },
        profile: 'draft',
        round,
        onDelta: displayDelta,
        timeoutMs: budgets.stepMs,
      })
      parsed = parseMomentsCopyOutput(fenceJsonForMoments(raw), knownIds)
      if (parsed.status !== 'success') {
        throw new MomentsFlowError({
          code: parsed.code,
          message: parsed.message,
          status: parsed.status,
          details: parsed.details,
          recoveryAction: parsed.recoveryAction,
        })
      }
      drafts = parsed.value
      check = runHardCheck({
        text: drafts.flatMap((d) => d.versions).join('\n'),
        segments: drafts.flatMap((draft, itemIndex) =>
          draft.versions.map((text, versionIndex) => ({
            id: `${itemIndex + 1}-${versionIndex + 1}`,
            text,
          })),
        ),
      })
    }

    if (!check.pass) {
      throw new MomentsFlowError({
        code: 'QC_FAILED',
        message: '两次以上修正后仍未通过质量检查',
        status: 'failed',
        details: check.hits.map((hit) => hit.label),
      })
    }

    await runner.runAlgo('finalize', () => drafts)
    return { drafts, usedMock: clients.isMock, run: runner.snapshot() }
  } finally {
    clearTimeout(flowTimer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}
