import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  RotateCcw,
  AlertCircle,
  Play,
  Pause,
  ArrowLeft,
  Sparkles,
  Plus,
  Mic,
  CheckCircle2,
} from 'lucide-react'
import type { MutableRefObject, ReactNode } from 'react'
import { Button } from '@no996/ui/button'
import { Card } from '@no996/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@no996/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@no996/ui/tooltip'
import type { VoiceCloneRecord } from '../../../api/voice-clone'
import { WorkflowRunCard } from '../../../components/agent/WorkflowRunCard'
import { AgentFlowExplain } from '../../../components/agent/AgentFlowExplain'
import { localizeVoiceDubStages, platformVoiceItems } from '../voice-i18n'
import { VoiceManuscriptCard } from './VoiceManuscriptCard'
import { VOICE_ADVANCED_DOC_MAX } from '../voice-constants'
import { VoiceDubWorkspace } from './VoiceDubWorkspace'
import { VoiceRightDock } from './VoiceRightDock'
import type { TonePreset, VoiceControlParams } from './VoiceSideControl'
import { VoiceRibbon, RIBBON_COLORS } from './VoiceRibbon'
import { VoicePlayerBar } from './VoicePlayerBar'
import {
  DEV_VOICE_FIXTURE_INPUT,
  DEV_VOICE_FIXTURE_SEGMENTS,
} from '../dev/dev-fixtures'
import { sanitizeManuscriptForVoice } from '../lib/manuscript-sanitize'
import { parsePlannerStreamContent } from '../lib/parse-planner-stream'
import type { SegmentPlannerCheckpoint } from '../lib/voice-workflow-nodes'
import { createTextStreamFilter } from '../../../agent/stream-filter'
import { VoiceWorkflowCanvas } from './VoiceWorkflowCanvas'
import { formatMmSs, TTS_PITCH, TTS_RATE, TTS_VOLUME } from '../voice-constants'
import type { VoiceDubAdvancedConfig, VoiceDubSegment } from '../agent/types'
import type { AgentRunSnapshot } from '../../../agent'

export type AdvancedDubState = 'input' | 'plan' | 'confirm' | 'tts' | 'done'

export type VoiceAdvancedDubDevHandles = {
  fillFixture: () => void
  fillResult: () => void
}

type Props = {
  clones: VoiceCloneRecord[]
  selectedVoiceId: string
  previewVoiceId?: string | null
  onEnqueueTask: (config: VoiceDubAdvancedConfig, confirmedSegments?: VoiceDubSegment[]) => Promise<string>
  activeTaskId?: string | null
  activeTaskSnapshot?: AgentRunSnapshot | null
  activeTaskMeta?: Record<string, string>
  activeTaskAwaitingConfirm?: boolean
  activeTaskSegments?: VoiceDubSegment[]
  activeTaskMergedBlobUrl?: string | null
  onResumeTask?: (segments: VoiceDubSegment[]) => Promise<void>
  voicePicker: ReactNode
  /** 流程内「更换音色」弹窗用，无重复标题行 */
  voicePickerInDialog?: ReactNode
  dubSubMode: 'direct' | 'advanced'
  onDubSubModeChange: (mode: 'direct' | 'advanced') => void
  devHandlesRef?: MutableRefObject<VoiceAdvancedDubDevHandles | null>
}

export function VoiceAdvancedDubView({
  clones,
  selectedVoiceId,
  onEnqueueTask,
  activeTaskId,
  activeTaskSnapshot,
  activeTaskMeta,
  activeTaskAwaitingConfirm,
  activeTaskSegments,
  activeTaskMergedBlobUrl,
  onResumeTask,
  voicePicker,
  voicePickerInDialog,
  dubSubMode,
  onDubSubModeChange,
  devHandlesRef,
}: Props) {
  const { t, i18n } = useTranslation('voice')
  const isEn = i18n.language?.startsWith('en')
  const voiceFlowStages = useMemo(() => localizeVoiceDubStages(t), [t, i18n.language])
  const stepLabels = useMemo(
    () => t('advanced.stepLabels', { returnObjects: true }) as string[],
    [t, i18n.language],
  )
  const fallbackPlatformLabel = useMemo(() => {
    const match = platformVoiceItems(t).find((v) => v.id === selectedVoiceId)
    return match?.label ?? platformVoiceItems(t)[0]?.label ?? selectedVoiceId
  }, [t, i18n.language, selectedVoiceId])
  const selectedVoiceLabel =
    clones.find((c) => c.voice_id === selectedVoiceId)?.display_name ?? fallbackPlatformLabel
  // 页面输入项：默认保持干净输入状态（非写死 mock），支持用户输入真实稿件
  const [docText, setDocText] = useState('')
  const [activeTone, setActiveTone] = useState<TonePreset>('自然')
  const [ttsParams, setTtsParams] = useState<VoiceControlParams>({
    rate: TTS_RATE.default,
    volume: TTS_VOLUME.default,
    pitch: TTS_PITCH.default,
    instruction: '',
  })
  const [skipConfirm, setSkipConfirm] = useState(false)
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false)

  // 状态机流转
  const [uiState, setUiState] = useState<AdvancedDubState>('input')
  const [title, setTitle] = useState(() => t('advanced.defaultTitle'))
  const [segments, setSegments] = useState<VoiceDubSegment[]>([])
  const [hoveredSegIndex, setHoveredSegIndex] = useState<number | null>(null)

  // 播放状态控制
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playingSegId, setPlayingSegId] = useState<string | null>(null)
  const playTimerRef = useRef<number | null>(null)
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const boundAdvancedTaskIdRef = useRef<string | null>(null)

  function filterPlannerStreamDisplay(raw: string): string {
    if (!raw.trim()) return ''
    const filter = createTextStreamFilter({
      keys: ['title', 'text', 'instruction'],
      separator: '\n',
    })
    let out = ''
    for (const ch of raw) out += filter.push(ch)
    return out + filter.flush()
  }

  // 计算总预估时长（plan 态用流式预览段）
  const totalDuration = useMemo(() => {
    return segments.reduce((acc, s) => acc + (s.estimatedSeconds ?? 5), 0)
  }, [segments])

  // 与后台真实任务元数据同步
  useEffect(() => {
    if (activeTaskMeta?.title) {
      setTitle(activeTaskMeta.title)
    }
  }, [activeTaskMeta])

  useEffect(() => {
    if (!activeTaskId) return

    if (activeTaskId !== boundAdvancedTaskIdRef.current) {
      boundAdvancedTaskIdRef.current = activeTaskId
      if (!activeTaskAwaitingConfirm) {
        setSegments([])
      }
    }

    if (activeTaskAwaitingConfirm) {
      setUiState('confirm')
      if (activeTaskSegments?.length) setSegments(activeTaskSegments)
    } else if (activeTaskMeta?.phase === 'tts') {
      setUiState('tts')
      if (activeTaskSegments?.length) setSegments(activeTaskSegments)
    } else if (activeTaskMeta?.phase === 'done' || activeTaskMeta?.status === 'done') {
      setUiState('done')
      if (activeTaskSegments?.length) setSegments(activeTaskSegments)
    } else if (
      activeTaskMeta?.phase === 'plan' ||
      activeTaskSnapshot?.stages.some(
        (s) => s.id === 'segment_planner' && (s.status === 'running' || s.status === 'done'),
      )
    ) {
      setUiState('plan')
    }
  }, [
    activeTaskId,
    activeTaskAwaitingConfirm,
    activeTaskMeta,
    activeTaskSegments,
    activeTaskSnapshot,
  ])

  // 音频播放与暂停
  const stopPlayback = useCallback(() => {
    if (playTimerRef.current) {
      clearInterval(playTimerRef.current)
      playTimerRef.current = null
    }
    if (audioElRef.current) {
      audioElRef.current.pause()
      audioElRef.current.currentTime = 0
    }
    setIsPlaying(false)
    setPlayingSegId(null)
  }, [])

  const toggleMasterPlay = useCallback(() => {
    if (isPlaying) {
      stopPlayback()
      return
    }

    if (activeTaskMergedBlobUrl) {
      if (!audioElRef.current) audioElRef.current = new Audio()
      audioElRef.current.src = activeTaskMergedBlobUrl
      audioElRef.current.currentTime = currentTime
      void audioElRef.current.play()
      setIsPlaying(true)
      audioElRef.current.ontimeupdate = () => {
        if (audioElRef.current) setCurrentTime(audioElRef.current.currentTime)
      }
      audioElRef.current.onended = () => {
        setIsPlaying(false)
        setCurrentTime(0)
      }
      return
    }

    // 无成片音频时的刻度仿真播放
    setIsPlaying(true)
    const interval = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.25
        if (next >= totalDuration) {
          stopPlayback()
          return 0
        }
        return next
      })
    }, 250)
    playTimerRef.current = interval
  }, [isPlaying, activeTaskMergedBlobUrl, currentTime, totalDuration, stopPlayback])

  useEffect(() => {
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current)
      if (audioElRef.current) audioElRef.current.pause()
    }
  }, [])

  // 进度跳转到指定分段
  const handleSeekToSegment = useCallback(
    (index: number) => {
      let offset = 0
      for (let i = 0; i < index; i++) {
        offset += segments[i]?.estimatedSeconds ?? 5
      }
      setCurrentTime(offset)
      if (!isPlaying) {
        toggleMasterPlay()
      }
    },
    [isPlaying, segments, toggleMasterPlay],
  )

  // 提交真实后台任务拆段流程
  const handleStartPlan = async () => {
    const sanitizedDoc = sanitizeManuscriptForVoice(docText).trim()
    if (!sanitizedDoc) return
    if (sanitizedDoc !== docText) setDocText(sanitizedDoc)
    stopPlayback()
    setSegments([])
    setHoveredSegIndex(null)
    boundAdvancedTaskIdRef.current = null
    setUiState('plan')

    const firstLine = sanitizedDoc.split('\n')[0]?.slice(0, 16) || t('advanced.defaultTitle')
    setTitle(firstLine)

    const config: VoiceDubAdvancedConfig = {
      documentText: sanitizedDoc,
      globalVoiceId: selectedVoiceId,
      globalVoiceLabel:
        clones.find((c) => c.voice_id === selectedVoiceId)?.display_name ?? fallbackPlatformLabel,
      tonePreset: activeTone,
      rate: ttsParams.rate,
      volume: ttsParams.volume,
      pitch: ttsParams.pitch,
      instruction: ttsParams.instruction,
      skipSegmentConfirm: skipConfirm,
    }

    try {
      const taskId = await onEnqueueTask(config)
      boundAdvancedTaskIdRef.current = taskId
    } catch {
      // 容错降级
      setTimeout(() => {
        if (skipConfirm) {
          setUiState('tts')
          simulateTtsFlow()
        } else {
          setUiState('confirm')
        }
      }, 2000)
    }
  }

  // 演示模式时的 TTS 推进仿真
  const simulateTtsFlow = () => {
    let k = 0
    const step = () => {
      setSegments((prev) => {
        const next = [...prev]
        if (next[k]) next[k] = { ...next[k], status: 'running' }
        if (k > 0 && next[k - 1]) next[k - 1] = { ...next[k - 1], status: 'done' }
        return next
      })
      setTimeout(() => {
        setSegments((prev) => {
          const next = [...prev]
          if (next[k]) next[k] = { ...next[k], status: 'done' }
          return next
        })
        k += 1
        if (k < segments.length) {
          step()
        } else {
          setUiState('done')
        }
      }, 900)
    }
    step()
  }

  // 确认分段并启动配音合成
  const handleConfirmAndStartTts = async () => {
    setUiState('tts')
    if (onResumeTask) {
      await onResumeTask(segments)
    } else {
      simulateTtsFlow()
    }
  }

  // 开发环境专享调试数据注入（规范：生产环境通过 import.meta.env.DEV 物理剔除）
  const handleLoadDevFixture = () => {
    setDocText(DEV_VOICE_FIXTURE_INPUT.docText)
    setTitle(DEV_VOICE_FIXTURE_INPUT.title)
    setActiveTone(DEV_VOICE_FIXTURE_INPUT.tonePreset)
    setTtsParams((prev) => ({
      ...prev,
      rate: DEV_VOICE_FIXTURE_INPUT.rate,
    }))
  }

  const handleLoadDevResultMock = () => {
    stopPlayback()
    setTitle(DEV_VOICE_FIXTURE_INPUT.title)
    setDocText(DEV_VOICE_FIXTURE_INPUT.docText)
    setSegments(DEV_VOICE_FIXTURE_SEGMENTS)
    setUiState('confirm')
  }

  useEffect(() => {
    if (!devHandlesRef) return
    devHandlesRef.current = {
      fillFixture: handleLoadDevFixture,
      fillResult: handleLoadDevResultMock,
    }
    return () => {
      devHandlesRef.current = null
    }
  })

  // 计算步骤条高亮索引
  const currentStepIndex =
    uiState === 'input'
      ? 0
      : uiState === 'plan'
        ? 1
        : uiState === 'confirm'
          ? 2
          : uiState === 'tts'
            ? 3
            : 5

  const workflowCardTitle =
    uiState === 'tts' ? t('advanced.ttsTitle') : t('advanced.planTitle')

  const workflowCardStatus =
    uiState === 'plan' || uiState === 'tts'
      ? 'running'
      : uiState === 'confirm' || uiState === 'done'
        ? 'done'
        : 'queued'

  const planBatchHint = activeTaskMeta?.plan_batch
  const segmentsWarning = activeTaskMeta?.segments_warning === '1'

  const plannerCheckpoint = activeTaskSnapshot?.checkpoints?.segment_planner as
    | SegmentPlannerCheckpoint
    | undefined

  const committedPlanSegments = useMemo(() => {
    const batches = plannerCheckpoint?.segment_planner_batches ?? []
    return batches.flatMap((b) => (b.segments ?? []) as VoiceDubSegment[])
  }, [plannerCheckpoint])

  const plannerStreamRaw = useMemo(() => {
    if (uiState !== 'plan') return ''
    const stage = activeTaskSnapshot?.stages.find((s) => s.id === 'segment_planner')
    const content = stage?.streamingContent ?? ''
    if (content.trim()) return content
    if (stage?.status === 'running' && stage.streamingReasoningContent?.trim()) {
      return stage.streamingReasoningContent
    }
    return ''
  }, [activeTaskSnapshot, uiState])

  const plannerDisplayStreamSource = useMemo(() => {
    if (uiState !== 'plan') return ''
    const stage = activeTaskSnapshot?.stages.find((s) => s.id === 'segment_planner')
    return stage?.streamingContent ?? ''
  }, [activeTaskSnapshot, uiState])

  const streamingPlanSegments = useMemo(
    () => parsePlannerStreamContent(plannerStreamRaw, {
      segmentTitle: (index) => t('advanced.segmentTitle', { index }),
      structuring: t('workflow.structuring'),
    }),
    [plannerStreamRaw, t],
  )

  const plannerDisplayStream = useMemo(
    () => (uiState === 'plan' ? filterPlannerStreamDisplay(plannerDisplayStreamSource) : ''),
    [plannerDisplayStreamSource, uiState],
  )

  const ribbonSegments = useMemo(() => {
    if (uiState !== 'plan') return segments
    const streamAsSegments: VoiceDubSegment[] = streamingPlanSegments.map((s, idx) => ({
      id: s.id || `stream_${idx}`,
      title: s.title,
      text: s.text,
      instruction: s.instruction,
      estimatedSeconds: Math.max(2, Math.round((s.text?.length ?? 0) / 3.5)),
      status: 'waiting',
    }))
    return [...committedPlanSegments, ...streamAsSegments]
  }, [uiState, segments, committedPlanSegments, streamingPlanSegments])

  const listSegments = ribbonSegments

  const ribbonDuration = useMemo(() => {
    return ribbonSegments.reduce((acc, s) => acc + (s.estimatedSeconds ?? 5), 0)
  }, [ribbonSegments])

  const canChangeVoice =
    uiState === 'confirm' || uiState === 'plan' || uiState === 'input'

  const segmentPlannerStage = activeTaskSnapshot?.stages.find((s) => s.id === 'segment_planner')
  const ingestStage = activeTaskSnapshot?.stages.find((s) => s.id === 'ingest')
  const ingestStepDone = ingestStage?.status === 'done'
  const plannerStepRunning =
    uiState === 'plan' &&
    (segmentPlannerStage?.status === 'running' || segmentPlannerStage?.status === 'done')

  return (
    <div className="voice-advanced-dub-view">
      {uiState === 'input' ? (
        <VoiceDubWorkspace
          editor={
            <VoiceManuscriptCard
              text={docText}
              onTextChange={setDocText}
              sampleText={DEV_VOICE_FIXTURE_INPUT.docText}
              placeholder={t('manuscript.placeholderAdvanced')}
              rate={ttsParams.rate}
              maxChars={VOICE_ADVANCED_DOC_MAX}
            />
          }
          dock={
            <VoiceRightDock
              dubMode={dubSubMode}
              onDubModeChange={onDubSubModeChange}
              voicePicker={voicePicker}
              dub={{
                mode: 'advanced',
                activeTone,
                onToneChange: setActiveTone,
                params: ttsParams,
                onParamsChange: (patch) => setTtsParams((p) => ({ ...p, ...patch })),
                skipConfirm,
                onSkipConfirmChange: setSkipConfirm,
                onCtaClick: () => void handleStartPlan(),
                ctaDisabled: !docText.trim(),
                ctaLabel: t('settings.ctaAdvanced'),
              }}
            />
          }
        />
      ) : (
        /* -------------------- 2. 执行与确认流程（对齐脚本大图/过程卡） -------------------- */
        <div className="voice-workflow-container">
          {/* 顶栏摘要与操作栏 */}
          <div className="voice-flow-summary">
            <div className="voice-flow-summary-left">
              <b>{title}</b>
              <span>
                {t('advanced.summary', { chars: docText.length })}
                {canChangeVoice ? (
                  <button
                    type="button"
                    className="voice-flow-voice-link"
                    onClick={() => setVoiceDialogOpen(true)}
                  >
                    {selectedVoiceLabel}
                  </button>
                ) : (
                  selectedVoiceLabel
                )}
              </span>
            </div>
            <div className="voice-flow-summary-actions">
              <AgentFlowExplain defs={voiceFlowStages} lang={isEn ? 'en' : 'zh'} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  stopPlayback()
                  setUiState('input')
                }}
              >
                <ArrowLeft className="size-3.5" />
                <span>{t('advanced.editCopy')}</span>
              </Button>
            </div>
          </div>

          {/* 过程卡：折叠面板，只展示步骤 Headline 与流式正文，不泄露 prompt */}
          <WorkflowRunCard
            title={workflowCardTitle}
            status={workflowCardStatus}
            activeRoleLabel={
              uiState === 'plan' && planBatchHint
                ? t('advanced.planActive', { hint: planBatchHint })
                : undefined
            }
            chips={[t('advanced.chipVoice', { name: selectedVoiceLabel })]}
            snapshot={activeTaskSnapshot ?? null}
            defs={voiceFlowStages}
            streamingText={plannerDisplayStream || undefined}
            progressFromSnapshot
            renderWorkflowCanvas={(ctx) => (
              <VoiceWorkflowCanvas {...ctx} meta={activeTaskMeta} />
            )}
          />

          {/* 步骤条 */}
          <Card className="voice-panel-card voice-steps-card">
            <div className="voice-steps-bar">
              {stepLabels.map((step, idx) => {
                const isDone =
                  idx < currentStepIndex || (idx === 0 && ingestStepDone && uiState === 'plan')
                const isRunning =
                  idx === currentStepIndex || (idx === 1 && plannerStepRunning && uiState === 'plan')
                const isWaiting = uiState === 'confirm' && idx === 2
                return (
                  <div
                    key={step}
                    className={`voice-step-item ${isDone ? 'is-done' : ''} ${
                      isRunning ? 'is-running' : ''
                    } ${isWaiting ? 'is-waiting' : ''} ${
                      isRunning && !isDone ? 'is-running-rail' : ''
                    }`}
                  >
                    <span>{isWaiting ? t('advanced.waitingConfirm') : step}</span>
                  </div>
                )
              })}
            </div>

            {/* 音频波形彩带 (Ribbon) */}
            <div className="voice-ribbon-wrapper">
              <VoiceRibbon
                mode={uiState}
                segments={ribbonSegments}
                currentTime={currentTime}
                totalDuration={uiState === 'plan' ? ribbonDuration : totalDuration}
                hoveredIndex={hoveredSegIndex}
                onHoverIndex={setHoveredSegIndex}
                onSeekToSegment={handleSeekToSegment}
              />
            </div>

            {/* 成片总播放条（完成态时显现） */}
            {uiState === 'done' ? (
              <VoicePlayerBar
                title={title}
                segmentCount={segments.length}
                isPlaying={isPlaying}
                onTogglePlay={toggleMasterPlay}
                currentTime={currentTime}
                totalDuration={totalDuration}
              />
            ) : null}
          </Card>

          {/* 方案检查 / 合成进度 / 分段试听列表 */}
          <Card className="voice-panel-card voice-segments-card">
              <div className="voice-segments-header">
                <div>
                  <h3>
                    {uiState === 'plan'
                      ? t('advanced.headers.plan')
                      : uiState === 'confirm'
                        ? t('advanced.headers.confirm')
                        : uiState === 'tts'
                          ? t('advanced.headers.tts')
                          : t('advanced.headers.done')}
                  </h3>
                  <small>
                    {uiState === 'plan'
                      ? planBatchHint
                        ? t('advanced.sub.planWithBatch', { batch: planBatchHint })
                        : t('advanced.sub.plan')
                      : uiState === 'confirm'
                        ? t('advanced.sub.confirm')
                        : t('advanced.sub.segments', {
                            count: listSegments.length,
                            duration: formatMmSs(totalDuration),
                          })}
                  </small>
                </div>
              </div>

              {uiState === 'plan' && !listSegments.length && !plannerDisplayStream ? (
                <div className="voice-plan-skeleton" aria-hidden="true">
                  <div className="voice-plan-skeleton__row" />
                  <div className="voice-plan-skeleton__row" />
                  <div className="voice-plan-skeleton__row voice-plan-skeleton__row--short" />
                </div>
              ) : null}

              {uiState === 'plan' && !listSegments.length && plannerDisplayStream ? (
                <p className="voice-plan-stream-fallback" aria-live="polite">
                  {plannerDisplayStream}
                  <span className="voice-plan-stream-fallback__caret" aria-hidden="true" />
                </p>
              ) : null}

              {uiState === 'confirm' ? (
                <div className="voice-notice-tip">
                  <AlertCircle size={15} />
                  <span>{t('advanced.confirmTip')}</span>
                </div>
              ) : null}

              {segmentsWarning && uiState === 'confirm' ? (
                <div className="voice-notice-tip">
                  <AlertCircle size={15} />
                  <span>{t('advanced.manySegments')}</span>
                </div>
              ) : null}

              <div className="voice-segment-rows">
                {listSegments.map((seg, i) => {
                  const color = RIBBON_COLORS[i % RIBBON_COLORS.length]
                  const isHovered = hoveredSegIndex === i
                  const isInstOver = seg.instruction.length > 100

                  if (uiState === 'plan') {
                    const isPartial =
                      i >= committedPlanSegments.length &&
                      streamingPlanSegments[i - committedPlanSegments.length]?.partial
                    return (
                      <div
                        key={seg.id || i}
                        className={`voice-seg-row is-readonly is-streaming ${isHovered ? 'is-hl' : ''}`}
                        style={{ '--c': color } as React.CSSProperties}
                        data-partial={isPartial ? '1' : undefined}
                        onMouseEnter={() => setHoveredSegIndex(i)}
                        onMouseLeave={() => setHoveredSegIndex(null)}
                      >
                        <i className="voice-seg-color-bar" />
                        <div className="voice-seg-body">
                          <h4>
                            <span>{seg.title || t('advanced.segmentTitle', { index: i + 1 })}</span>
                            <em>{t('advanced.aboutSeconds', { sec: seg.estimatedSeconds ?? 6 })}</em>
                          </h4>
                          <p className="voice-clip">{seg.text || '…'}</p>
                          <small className="flex items-center gap-1.5">
                            <Mic className="size-3 text-muted-foreground" />
                            <span>{seg.instruction || t('advanced.instructionGenerating')}</span>
                          </small>
                        </div>
                      </div>
                    )
                  }

                  if (uiState === 'confirm') {
                    return (
                      <div
                        key={seg.id || i}
                        className={`voice-seg-row is-editing ${isHovered ? 'is-hl' : ''}`}
                        style={{ '--c': color } as React.CSSProperties}
                        onMouseEnter={() => setHoveredSegIndex(i)}
                        onMouseLeave={() => setHoveredSegIndex(null)}
                      >
                        <i className="voice-seg-color-bar" />
                        <div className="voice-seg-body">
                          <div className="flex items-center justify-between mb-2">
                            <h4>
                              <span>{seg.title}</span>
                              <em>{t('advanced.aboutSeconds', { sec: seg.estimatedSeconds ?? 6 })}</em>
                            </h4>
                          </div>
                          <textarea
                            className="voice-seg-textarea"
                            value={seg.text}
                            onChange={(e) => {
                              const val = e.target.value
                              setSegments((prev) =>
                                prev.map((s, idx) => (idx === i ? { ...s, text: val } : s)),
                              )
                            }}
                            placeholder={t('advanced.segmentTextPlaceholder')}
                            rows={2}
                          />
                          <div className="voice-seg-instruction-field">
                            <Mic
                              className="voice-seg-instruction-field__icon size-3.5 text-muted-foreground"
                              aria-hidden
                            />
                            <input
                              type="text"
                              className="voice-seg-input voice-seg-input--with-icon"
                              value={seg.instruction}
                              onChange={(e) => {
                                const val = e.target.value
                                setSegments((prev) =>
                                  prev.map((s, idx) =>
                                    idx === i ? { ...s, instruction: val } : s,
                                  ),
                                )
                              }}
                              placeholder={t('advanced.instructionPlaceholder')}
                            />
                          </div>
                          <div className="voice-seg-meta">
                            <span className={isInstOver ? 'is-warning' : ''}>
                              {isInstOver ? t('advanced.instructionOver') : t('advanced.instructionLabel')}
                            </span>
                            <span className={isInstOver ? 'is-warning' : ''}>
                              {seg.instruction.length}/100
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  // TTS / Done 状态的只读展示
                  return (
                    <div
                      key={seg.id || i}
                      className={`voice-seg-row is-readonly ${isHovered ? 'is-hl' : ''}`}
                      style={{ '--c': color } as React.CSSProperties}
                      onMouseEnter={() => setHoveredSegIndex(i)}
                      onMouseLeave={() => setHoveredSegIndex(null)}
                    >
                      <i className="voice-seg-color-bar" />
                      <div className="voice-seg-body">
                        <h4>
                          <span>{seg.title}</span>
                          <em>{t('advanced.aboutSeconds', { sec: seg.estimatedSeconds ?? 6 })}</em>
                        </h4>
                        <p>{seg.text}</p>
                        <small className="flex items-center gap-1.5">
                          <Mic className="size-3 text-muted-foreground" />
                          <span>{seg.instruction || t('advanced.naturalTone')}</span>
                        </small>
                      </div>
                      <div className="voice-seg-side-status">
                        {uiState === 'done' ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon-sm"
                                  className="rounded-full shadow-xs hover:border-primary/50 hover:text-primary transition-all"
                                  onClick={() => {
                                    if (playingSegId === seg.id) {
                                      stopPlayback()
                                    } else {
                                      handleSeekToSegment(i)
                                      setPlayingSegId(seg.id)
                                    }
                                  }}
                                  aria-label={t('advanced.previewSegmentAria')}
                                >
                                  {playingSegId === seg.id ? (
                                    <Pause className="size-3.5" />
                                  ) : (
                                    <Play className="size-3.5 translate-x-0.5" />
                                  )}
                                </Button>
                              }
                            />
                            <TooltipContent side="top">{t('advanced.previewSegmentAria')}</TooltipContent>
                          </Tooltip>
                        ) : null}
                        <span className="voice-seg-status-badge">
                          {seg.status === 'done' || uiState === 'done' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
                              <CheckCircle2 className="size-3" />
                              {t('advanced.statusDone')}
                            </span>
                          ) : seg.status === 'running' ? (
                            <span className="text-primary font-medium text-xs">{t('advanced.statusRunning')}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">{t('advanced.statusQueued')}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 底部操作条：全面组件化、弹性响应排版，杜绝字数超出或挤压换行 */}
              <div className="voice-segments-action-bar">
                {uiState === 'confirm' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleStartPlan()}
                    >
                      <RotateCcw className="size-3.5" />
                      <span>{t('advanced.replan')}</span>
                    </Button>
                    <span className="voice-ms-spacer" />
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => void handleConfirmAndStartTts()}
                    >
                      <Sparkles className="size-3.5" />
                      <span>{t('advanced.startDub')}</span>
                    </Button>
                  </>
                ) : uiState === 'done' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        stopPlayback()
                        setUiState('input')
                      }}
                    >
                      <Plus className="size-3.5" />
                      <span>{t('advanced.newRun')}</span>
                    </Button>
                    <span className="voice-ms-spacer" />
                    {activeTaskMergedBlobUrl ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = activeTaskMergedBlobUrl
                          a.download = `${title || t('advanced.downloadBasename')}.wav`
                          a.click()
                        }}
                      >
                        <Download className="size-3.5" />
                        <span>{t('advanced.downloadWav')}</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => alert(t('advanced.demoMergedAlert'))}
                      >
                        <Download className="size-3.5" />
                        <span>{t('advanced.downloadDemo')}</span>
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </Card>
        </div>
      )}

      <Dialog open={voiceDialogOpen} onOpenChange={setVoiceDialogOpen}>
        <DialogContent className="voice-flow-voice-dialog">
          <DialogHeader>
            <DialogTitle>{t('advanced.changeVoiceTitle')}</DialogTitle>
            <DialogDescription>{t('advanced.changeVoiceDesc')}</DialogDescription>
          </DialogHeader>
          <div className="voice-flow-voice-dialog__picker">
            {voicePickerInDialog ?? voicePicker}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
