import {
  createStageRunner,
  createDisplayDelta,
  resolveBudgets,
  type AgentClients,
  type AgentRunSnapshot,
  type AgentSink,
} from '../../../agent'
import { concatWavBuffers } from '../../../lib/audio/concat-wav'
import { VOICE_ADVANCED_FLOW_ID, VOICE_DUB_STAGES } from './stages'
import {
  SEGMENT_PLANNER_CHUNK_PROMPT,
  SEGMENT_PLANNER_PROMPT,
  SEGMENT_PLANNER_SYSTEM,
} from './prompts'
import {
  VOICE_ADVANCED_DOC_MAX,
  VOICE_ADVANCED_PLANNER_CHUNK_MAX,
  VOICE_ADVANCED_PLANNER_STEP_MAX_MS,
  VOICE_ADVANCED_SEGMENTS_WARN_COUNT,
  VOICE_ADVANCED_TTS_SEGMENT_HARD_MAX,
  VOICE_ADVANCED_TTS_SEGMENT_SOFT_MAX,
  TTS_INSTRUCTION_MAX_LEN,
} from '../voice-constants'
import {
  enforceAdvancedSegmentTextLimits,
  mergePlannerSegments,
  packDocumentIntoPlannerChunks,
  type PlannerBatchResult,
} from './document-chunking'
import { sanitizeManuscriptForVoice } from '../lib/manuscript-sanitize'
import type { VoiceDubAdvancedConfig, VoiceDubAdvancedResult, VoiceDubSegment } from './types'
import type { PlannerBatchState, SegmentPlannerCheckpoint } from '../lib/voice-workflow-nodes'

export type RunVoiceAdvancedFlowInput = {
  config: VoiceDubAdvancedConfig
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  resume?: { fromStageId: string; snapshot: AgentRunSnapshot }
  confirmedSegments?: VoiceDubSegment[]
  synthesizeSegment?: (
    segment: VoiceDubSegment,
    index: number,
    total: number,
  ) => Promise<{ audioBuffer: ArrayBuffer }>
  onDelta?: (delta: string) => void
  onStageChange?: (stageId: string) => void
  /** 长稿分块规划进度，写入任务 meta（如 plan_batch: "2/5"） */
  onPlanBatch?: (current: number, total: number) => void | Promise<void>
  onPlannerBatchesTotal?: (total: number) => void | Promise<void>
  onPlannerCheckpoint?: (checkpoint: SegmentPlannerCheckpoint) => void | Promise<void>
}

type VoiceFlowCheckpoint = {
  title?: string
  segments?: VoiceDubSegment[]
}

function checkpointBeforeVoiceStage(resume?: RunVoiceAdvancedFlowInput['resume']) {
  if (!resume) return { index: 0, checkpoint: {} as VoiceFlowCheckpoint }
  const index = VOICE_DUB_STAGES.findIndex((stage) => stage.id === resume.fromStageId)
  if (index < 0 || resume.snapshot.flowId !== VOICE_ADVANCED_FLOW_ID) {
    throw new Error('无法恢复该高阶配音流程步骤。')
  }
  const priorStage = [...VOICE_DUB_STAGES]
    .slice(0, index)
    .reverse()
    .find((stage) => resume.snapshot.checkpoints?.[stage.id] !== undefined)
  if (!priorStage) return { index, checkpoint: {} as VoiceFlowCheckpoint }
  return {
    index,
    checkpoint: (resume.snapshot.checkpoints?.[priorStage.id] ?? {}) as VoiceFlowCheckpoint,
  }
}

function parsePlannerRaw(raw: Record<string, unknown>): PlannerBatchResult {
  const batch: PlannerBatchResult = { segments: [] }
  if (raw.title && typeof raw.title === 'string') {
    batch.title = raw.title.trim()
  }
  if (Array.isArray(raw.segments)) {
    batch.segments = (raw.segments as Array<Record<string, unknown>>).map((s, idx) => ({
      id: String(s.id || `seg_${idx + 1}`),
      title: String(s.title || `段落 ${idx + 1}`),
      text: String(s.text || ''),
      instruction: String(s.instruction || ''),
      role: s.role ? String(s.role) : 'narrator',
      estimatedSeconds: typeof s.estimatedSeconds === 'number' ? s.estimatedSeconds : undefined,
    }))
  }
  return batch
}

function neighborHintFromSegments(segments: VoiceDubSegment[]): string {
  const last = segments[segments.length - 1]
  if (!last) return '无'
  const hint = `${last.title}：${last.instruction}`.trim()
  return hint.length > 200 ? `${hint.slice(0, 199)}…` : hint
}

export async function runVoiceAdvancedFlow(
  input: RunVoiceAdvancedFlowInput,
): Promise<VoiceDubAdvancedResult> {
  const { config, clients, sink, signal, confirmedSegments, synthesizeSegment, onDelta } = input
  const budgets = resolveBudgets(clients.isMock)
  const { index: resumeIndex, checkpoint: restored } = checkpointBeforeVoiceStage(input.resume)

  const runner = createStageRunner({
    flowId: VOICE_ADVANCED_FLOW_ID,
    stages: VOICE_DUB_STAGES,
    clients,
    sink,
    signal,
    resume: input.resume,
  })

  runner.markRunning()

  const displayDelta = createDisplayDelta(onDelta, ['title', 'text', 'instruction'])

  let title = restored.title ?? '产品口播'
  let segments: VoiceDubSegment[] = confirmedSegments ?? restored.segments ?? []
  const segmentBuffers: ArrayBuffer[] = []
  let segmentsWarning = false

  try {
    const cleanedDocument = sanitizeManuscriptForVoice(
      config.documentText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n'),
    ).trim()

    // 1. 文稿整理 (ingest)
    if (resumeIndex <= 0) {
      input.onStageChange?.('ingest')
      await runner.runAlgo('ingest', () => {
        if (!cleanedDocument) throw new Error('文案内容不能为空，请输入或上传文稿。')
        if (cleanedDocument.length > VOICE_ADVANCED_DOC_MAX) {
          throw new Error(`文案字数超出上限（最多 ${VOICE_ADVANCED_DOC_MAX.toLocaleString('zh-CN')} 字）。`)
        }
        return { length: cleanedDocument.length }
      })
    }

    // 2. AI 拆段 (segment_planner)
    if (resumeIndex <= 1 && (!segments || segments.length === 0)) {
      input.onStageChange?.('segment_planner')
      const plannerVars = {
        globalVoice: config.globalVoiceLabel || config.globalVoiceId,
        tonePreset: config.tonePreset || '自然',
        instruction: config.instruction || '无',
      }

      const chunks =
        cleanedDocument.length <= VOICE_ADVANCED_PLANNER_CHUNK_MAX
          ? [cleanedDocument]
          : packDocumentIntoPlannerChunks(cleanedDocument, VOICE_ADVANCED_PLANNER_CHUNK_MAX)

      const batchResults: PlannerBatchResult[] = []
      let priorSegments: VoiceDubSegment[] = []
      const batchStates: PlannerBatchState[] = chunks.map((_, idx) => ({
        index: idx + 1,
        status: 'pending',
      }))
      const segmentPlannerBatches: SegmentPlannerCheckpoint['segment_planner_batches'] = []

      await input.onPlannerBatchesTotal?.(chunks.length)

      const syncPlannerCheckpoint = async () => {
        const checkpoint: SegmentPlannerCheckpoint = {
          planner_batches_total: chunks.length,
          planner_batch_states: batchStates,
          segment_planner_batches: segmentPlannerBatches,
        }
        await runner.setCheckpoint('segment_planner', checkpoint)
        await input.onPlannerCheckpoint?.(checkpoint)
      }

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]
        batchStates[i].status = 'running'
        await syncPlannerCheckpoint()
        await input.onPlanBatch?.(i + 1, chunks.length)

        const isSingleChunk = chunks.length === 1
        const raw = await runner.runModel<Record<string, unknown>>('segment_planner', {
          userTemplate: isSingleChunk ? SEGMENT_PLANNER_PROMPT : SEGMENT_PLANNER_CHUNK_PROMPT,
          system: SEGMENT_PLANNER_SYSTEM,
          vars: isSingleChunk
            ? { ...plannerVars, document: chunkText }
            : {
                ...plannerVars,
                chunkText,
                chunkIndex: String(i + 1),
                chunkTotal: String(chunks.length),
                neighborHint: neighborHintFromSegments(priorSegments),
              },
          timeoutMs: Math.max(budgets.stepMs, VOICE_ADVANCED_PLANNER_STEP_MAX_MS),
          retry: 1,
          onDelta: (chunk) => displayDelta(chunk),
          responseFormat: { type: 'json_object' },
        })

        if (raw && typeof raw === 'object') {
          const batch = parsePlannerRaw(raw)
          batchResults.push(batch)
          priorSegments = [...priorSegments, ...batch.segments]
          batchStates[i].status = 'done'
          batchStates[i].segmentCount = batch.segments.length
          segmentPlannerBatches.push({ index: i + 1, segments: batch.segments })
          await syncPlannerCheckpoint()
        }
      }

      if (batchResults.length) {
        const merged = mergePlannerSegments(batchResults)
        title = merged.title
        segments = merged.segments
      }
    }

    // 3. 校验方案 (plan_review)
    if (resumeIndex <= 2) {
      input.onStageChange?.('plan_review')
      await runner.runAlgo('plan_review', () => {
        if (!segments || segments.length === 0) {
          segments = [
            {
              id: 'seg_1',
              title: '全文',
              text: cleanedDocument,
              instruction: config.instruction || '自然清晰，重音自然',
              estimatedSeconds: Math.max(3, Math.round(cleanedDocument.length / 3.5)),
            },
          ]
        }

        segments = segments.map((seg, idx) => {
          let inst = seg.instruction.trim()
          if (inst.length > TTS_INSTRUCTION_MAX_LEN) {
            inst = inst.slice(0, TTS_INSTRUCTION_MAX_LEN)
          }
          const text = seg.text.trim()
          const est =
            seg.estimatedSeconds && seg.estimatedSeconds > 0
              ? seg.estimatedSeconds
              : Math.max(2, Math.round(text.length / 3.5))
          return {
            ...seg,
            id: seg.id || `seg_${idx + 1}`,
            title: seg.title || `段落 ${idx + 1}`,
            text,
            instruction: inst,
            estimatedSeconds: est,
            status: 'waiting' as const,
          }
        })

        const limited = enforceAdvancedSegmentTextLimits(
          segments,
          VOICE_ADVANCED_TTS_SEGMENT_SOFT_MAX,
          VOICE_ADVANCED_TTS_SEGMENT_HARD_MAX,
        )
        segments = limited.segments
        if (segments.length > VOICE_ADVANCED_SEGMENTS_WARN_COUNT) {
          segmentsWarning = true
        }

        return { count: segments.length, title }
      })

      await runner.setCheckpoint('plan_review', { title, segments })

      const needConfirm =
        !config.skipSegmentConfirm &&
        !confirmedSegments &&
        (!input.resume || input.resume.fromStageId === 'segment_planner')

      if (needConfirm) {
        return {
          title,
          documentText: config.documentText,
          globalVoiceId: config.globalVoiceId,
          globalVoiceLabel: config.globalVoiceLabel,
          segments,
          awaitingConfirm: true,
          run: runner.snapshot(),
          usedMock: clients.isMock,
          segmentsWarning,
        }
      }
    }

    // 4. 逐段配音 (segment_tts)
    if (resumeIndex <= 3) {
      input.onStageChange?.('segment_tts')
      await runner.runTool('segment_tts', async () => {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]
          seg.status = 'running'
          if (synthesizeSegment) {
            const { audioBuffer } = await synthesizeSegment(seg, i, segments.length)
            segmentBuffers.push(audioBuffer)
          } else {
            segmentBuffers.push(new ArrayBuffer(44))
          }
          seg.status = 'done'
        }
        return { synthesizedCount: segmentBuffers.length }
      })
    }

    // 5. 拼接成片 (merge_audio)
    if (resumeIndex <= 4) {
      input.onStageChange?.('merge_audio')
      await runner.runAlgo('merge_audio', () => {
        const merged = concatWavBuffers(segmentBuffers)
        return { mergedBytes: merged.byteLength }
      })
    }

    // 6. 成片定稿 (finalize)
    input.onStageChange?.('finalize')
    await runner.runAlgo('finalize', () => {
      const totalDuration = segments.reduce((acc, s) => acc + (s.estimatedSeconds ?? 0), 0)
      return { totalDuration }
    })

    await runner.finish('done')

    return {
      title,
      documentText: config.documentText,
      globalVoiceId: config.globalVoiceId,
      globalVoiceLabel: config.globalVoiceLabel,
      segments,
      totalDurationSeconds: segments.reduce((acc, s) => acc + (s.estimatedSeconds ?? 0), 0),
      run: runner.snapshot(),
      usedMock: clients.isMock,
      segmentsWarning,
    }
  } catch (e) {
    await runner.finish('failed')
    throw e
  }
}
