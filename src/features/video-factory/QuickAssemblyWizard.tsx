/**
 * 一键出片向导
 *
 * 三步：填文案 → 复核镜头 → 配音并落地。
 *
 * 镜头选择走确定性规则（不调模型）；配音可选用，接的是 IP 口播视频那条
 * 已经上线的 TTS 后台任务链路，不新建接口、不新建计费路径。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { VfOverlayPortal } from './VfOverlayPortal'
import { Button } from '@no996/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@no996/ui/dropdown-menu'
import { Field, FieldLabel } from '@no996/ui/field'
import { WizardSteps } from '@no996/ui/feedback'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { Switch } from '@no996/ui/switch'
import { Textarea } from '@no996/ui/textarea'
import {
  formatTimeCode,
  InsertShotCommand,
  insertAudioElement,
  SHOT_CATALOG,
  type EditorDocument,
  type EditorInstance,
  type ShotDefinition,
} from '@no996/video-editor'
import {
  getShotCategoryDisplayName,
  getShotDisplayName,
} from '../../../packages/video-editor/src/demos/localization.ts'
import { segmentScript, scriptStats, type ScriptSegment } from './lib/segment-script'
import { mapSegmentsToShots, mappingSummary, type MappedBeat } from './lib/map-shots'
import { runAiDirector } from './agent/runner'
import { chatCompletions } from '../../api/chat'
import {
  estimateSpeechSeconds,
  synthesizeVoice,
  type VoiceOption,
  type VoiceSynthesisActions,
} from './lib/synthesize-voice'
import { WizardLibraryDropdown } from './WizardLibraryDropdown'
import { syncCaptionsToBeats, syncCaptionsToVoiceScript } from './lib/sync-captions'

export type QuickAssemblyWizardProps = {
  editor: EditorInstance | null
  doc: EditorDocument | null
  /** 可用音色；为空表示当前环境拿不到音色（不显示配音步骤） */
  voices: VoiceOption[]
  /** TTS 任务动作；为空表示不支持配音 */
  voiceActions: VoiceSynthesisActions | null
  /** 读取任务状态（由宿主从任务仓储注入） */
  getTask: ((taskId: string) => Promise<import('../../services/workbench-tasks').WorkbenchTaskRecord | null>) | null
  /** 把音频 Blob 存进本机仓储 */
  saveAssetBlob: (blobId: string, blob: Blob) => Promise<void>
  onDone: (message: string) => void
  onClose: () => void
}

type Step = 'script' | 'review' | 'voice'

type VoiceState =
  | { phase: 'idle' }
  | { phase: 'running'; taskId: string; status: string }
  | { phase: 'done'; bytes: number }
  | { phase: 'error'; message: string }

type ImportedDubbing = {
  blob: Blob
  text: string
  voiceLabel: string
  voiceId?: string
}

const WIZARD_STEPS = [
  { id: 'script', label: '文稿' },
  { id: 'review', label: '镜头' },
  { id: 'voice', label: '配音' },
] as const

function stepToIndex(step: Step): number {
  if (step === 'script') return 0
  if (step === 'review') return 1
  return 2
}

export function QuickAssemblyWizard({
  editor,
  doc,
  voices,
  voiceActions,
  getTask,
  saveAssetBlob,
  onDone,
  onClose,
}: QuickAssemblyWizardProps) {
  const [step, setStep] = useState<Step>('script')
  const [script, setScript] = useState('')
  const [addTransitions, setAddTransitions] = useState(true)
  const [clearExisting, setClearExisting] = useState(true)
  const [withVoice, setWithVoice] = useState(false)
  const [voiceId, setVoiceId] = useState('')
  const [speed, setSpeed] = useState(1)
  const [voiceState, setVoiceState] = useState<VoiceState>({ phase: 'idle' })
  const [importedDubbing, setImportedDubbing] = useState<ImportedDubbing | null>(null)
  const [aiMode, setAiMode] = useState(true)
  const [aiState, setAiState] = useState<{
    phase: 'idle' | 'running' | 'done' | 'error'
    reasoning?: string
    error?: string
  }>({ phase: 'idle' })
  const [aiBeats, setAiBeats] = useState<MappedBeat[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const segments = useMemo(() => segmentScript(script), [script])
  const stats = useMemo(() => scriptStats(segments), [segments])

  const wizardStepItems = useMemo(
    () =>
      WIZARD_STEPS.map((item, index) => ({
        ...item,
        reachable: index === 0 || segments.length > 0,
      })),
    [segments.length],
  )

  const goWizardStep = useCallback(
    (index: number) => {
      if (index === 0) setStep('script')
      else if (index === 1 && segments.length) setStep('review')
      else if (index === 2 && segments.length) setStep('voice')
    },
    [segments.length],
  )

  const useLibraryDubbing = withVoice && importedDubbing != null
  const fallbackBeats = useMemo(
    () => mapSegmentsToShots(segments, { transitions: addTransitions }),
    [segments, addTransitions],
  )
  const activeBeats = useMemo(() => {
    if (aiMode && aiBeats.length > 0) return aiBeats
    return fallbackBeats
  }, [aiMode, aiBeats, fallbackBeats])

  const beats = activeBeats
  const summary = useMemo(() => mappingSummary(beats), [beats])

  const scriptMeta = segments.length
    ? `${segments.length} 段 · ${stats.chars} 字 · 约 ${formatTimeCode(stats.durationUs)}`
    : '粘贴口播稿后自动按句切镜'

  const [isCompressingScript, setIsCompressingScript] = useState(false)

  // 自愿型 AI 智能浓缩文案至黄金时长
  const handleCompressScriptWithAi = useCallback(async () => {
    if (!script.trim() || isCompressingScript) return
    setIsCompressingScript(true)
    try {
      const response = await chatCompletions({
        messages: [
          {
            role: 'system',
            content:
              '你是一位资深短视频编剧与爆款文案专家。请将用户输入的业务口播长文案浓缩提炼为 6~8 句短视频黄金爆款脚本（总时长控制在 30~60 秒）。剔除口语废话与冗长铺垫，每句都是黄金痛点或核心卖点。严格只输出浓缩后的纯文稿，标点清晰，禁止包含引号或多余解释。',
          },
          {
            role: 'user',
            content: `原长文案：\n${script}\n\n请直接输出精炼后的短视频文稿：`,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
      })
      const content = response.choices?.[0]?.message?.content?.trim()
      if (content) {
        setScript(content)
      }
    } catch (e) {
      console.warn('AI 浓缩文案异常:', e)
    } finally {
      setIsCompressingScript(false)
    }
  }, [script, isCompressingScript])

  const handleRunAiDirector = useCallback(async () => {
    if (!script.trim() || !segments.length) return
    setAiState({ phase: 'running', reasoning: '' })
    try {
      const result = await runAiDirector({
        script,
        onDelta: ({ reasoning }) => {
          if (reasoning) {
            setAiState((prev) => ({
              ...prev,
              reasoning: (prev.reasoning || '') + reasoning,
            }))
          }
        },
      })

      const mapped: MappedBeat[] = result.scenes.map((scene, idx) => {
        const shotDef = SHOT_CATALOG.find((s) => s.shotId === scene.shotId) || SHOT_CATALOG[0]
        const seg: ScriptSegment = segments[scene.segmentIndex] || {
          index: idx,
          text: scene.segmentText,
          suggestedDurationUs: 3_000_000,
        }
        const minDurationUs = Math.round((shotDef.durationInFrames / 30) * 1_000_000)
        const durationUs = Math.max(seg.suggestedDurationUs || 3_000_000, minDurationUs)

        return {
          segment: seg,
          shot: shotDef,
          durationUs,
          reason: scene.reason,
          overrides: scene.overrides,
        }
      })

      setAiBeats(mapped)
      setAiState({ phase: 'done' })
      setStep('review')
    } catch (err: any) {
      console.warn('AI 编排失败，回退规则:', err)
      setAiState({ phase: 'error', error: err?.message || 'AI 编排服务响应异常' })
      setStep('review')
    }
  }, [script, segments])

  const handleProceedFromScript = useCallback(() => {
    if (aiMode) {
      void handleRunAiDirector()
    } else {
      setStep('review')
    }
  }, [aiMode, handleRunAiDirector])

  const canVoice = voices.length > 0 && voiceActions !== null && getTask !== null
  const VOICE_MIN_CHARS = 20
  const VOICE_SPEED_MIN = 0.8
  const VOICE_SPEED_MAX = 1.5
  const voiceCharCount = stats.chars
  const voiceBlockedReason = !canVoice
    ? ''
    : voiceCharCount < VOICE_MIN_CHARS
      ? `配音至少 ${VOICE_MIN_CHARS} 字（当前 ${voiceCharCount}）`
      : speed < VOICE_SPEED_MIN || speed > VOICE_SPEED_MAX
        ? `语速 ${VOICE_SPEED_MIN}–${VOICE_SPEED_MAX}`
        : ''
  const estimatedVoiceSeconds = useMemo(
    () => (script.trim() ? estimateSpeechSeconds(script, speed) : 0),
    [script, speed],
  )

  useEffect(() => {
    if (canVoice && !voiceId) setVoiceId(voices[0].id)
  }, [canVoice, voiceId, voices])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const applyShotsOnly = useCallback(() => {
    if (!editor || !doc || !beats.length) return
    const fps = doc.canvas.fps.num / doc.canvas.fps.den
    const shotTrack = doc.tracks.find((track) => track.type === 'shot')
    if (!shotTrack) {
      onDone('当前工程没有镜头轨，无法生成')
      return
    }

    const cleared: EditorDocument = clearExisting
      ? {
          ...doc,
          tracks: doc.tracks.map((track) =>
            track.id === shotTrack.id ? { ...track, elements: [] } : track,
          ),
          captions: [],
          durationUs: 0,
        }
      : doc

    editor.setDocument(cleared)

    let cursorUs = 0
    for (const beat of beats) {
      editor.executeCommand(
        new InsertShotCommand(
          {
            trackId: shotTrack.id,
            shotId: beat.shot.shotId,
            sourceDurationFrames: Math.max(1, Math.round((beat.durationUs / 1_000_000) * fps)),
            startUs: cursorUs,
            canvasWidth: doc.canvas.width,
            canvasHeight: doc.canvas.height,
            overrides: beat.overrides,
          },
          fps,
        ),
      )
      cursorUs += beat.durationUs
    }

    const finalDoc = editor.getDocument()
    editor.setDocument({ ...finalDoc, durationUs: cursorUs })
    syncCaptionsToBeats(editor, beats)
    return cursorUs
  }, [editor, doc, beats, clearExisting, onDone])

  const handleShotsOnly = useCallback(() => {
    const totalUs = applyShotsOnly()
    if (totalUs === undefined || !editor) return
    const captionCount = editor.getDocument().captions.length
    const captionNote = captionCount ? `，${captionCount} 句字幕已生成` : ''
    onDone(`已生成 ${beats.length} 个镜头，总时长 ${formatTimeCode(totalUs)}${captionNote}`)
    onClose()
  }, [applyShotsOnly, beats.length, editor, onDone, onClose])

  const handleWithVoice = useCallback(async () => {
    if (!editor) return

    const library = useLibraryDubbing ? importedDubbing : null
    if (withVoice && !library) {
      if (!voiceActions || !getTask) return
      if (!voiceId) {
        setVoiceState({ phase: 'error', message: '请先选择音色' })
        return
      }
      if (voiceBlockedReason) {
        setVoiceState({ phase: 'error', message: voiceBlockedReason })
        return
      }
    }

    setVoiceState({ phase: 'running', taskId: '', status: library ? '写入配音' : '提交中' })

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const label = library
        ? library.voiceLabel
        : voices.find((item) => item.id === voiceId)?.label ?? voiceId
      const blob = library
        ? library.blob
        : await synthesizeVoice(
            { text: script, voiceId, voiceLabel: label, speed },
            voiceActions!,
            {
              signal: controller.signal,
              getTask: getTask!,
              onProgress: ({ taskId, status }) => {
                setVoiceState({ phase: 'running', taskId, status: translateStatus(status) })
              },
            },
          )

      const totalUs = applyShotsOnly()
      if (totalUs === undefined) throw new Error('镜头轨写入失败')

      const docNow = editor.getDocument()
      const voiceTrack =
        docNow.tracks.find((track) => track.type === 'audio' && track.name.includes('配音')) ??
        docNow.tracks.find((track) => track.type === 'audio')

      if (!voiceTrack) {
        throw new Error('当前工程没有音频轨，无法放配音')
      }

      const result = await insertAudioElement(
        editor,
        {
          trackId: voiceTrack.id,
          blob,
          name: `配音 · ${label}`,
          startUs: 0,
          trackName: '配音轨',
        },
        saveAssetBlob,
      )

      const captionScript = (library?.text || script).trim()
      const voiceElement = editor
        .getDocument()
        .tracks.flatMap((track) => track.elements)
        .find((element) => element.id === result.elementId)
      const voiceDurationUs = voiceElement?.durationUs ?? totalUs
      if (captionScript) {
        syncCaptionsToVoiceScript(editor, captionScript, voiceDurationUs, result.elementId)
      } else {
        syncCaptionsToBeats(editor, beats)
      }

      setVoiceState({ phase: 'done', bytes: blob.size })
      const captionNote =
        captionScript && editor.getDocument().captions.length
          ? `，${editor.getDocument().captions.length} 句字幕已对齐配音`
          : ''
      onDone(
        `已生成 ${beats.length} 个镜头 + 配音（${label}，${(blob.size / 1024).toFixed(0)}KB）${captionNote}`,
      )
      onClose()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setVoiceState({ phase: 'idle' })
        return
      }
      setVoiceState({
        phase: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      abortRef.current = null
    }
  }, [
    editor,
    voiceActions,
    getTask,
    voiceId,
    voices,
    script,
    speed,
    voiceBlockedReason,
    withVoice,
    useLibraryDubbing,
    importedDubbing,
    applyShotsOnly,
    beats.length,
    saveAssetBlob,
    onDone,
    onClose,
  ])

  const cancelVoice = useCallback(() => {
    abortRef.current?.abort()
    setVoiceState({ phase: 'idle' })
  }, [])

  const busy = voiceState.phase === 'running'

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  return (
    <VfOverlayPortal>
        <div className="vf-wizard" role="dialog" aria-modal="true" aria-label="AI一键出视频">
          <div className="vf-wizard__panel">
            <header className="vf-wizard__head vf-wizard__head--unified">
              <div className="vf-wizard__head-copy">
                <h2>AI一键出视频</h2>
                <p className="sr-only">按句切镜、自动配镜头，可选 TTS 配音</p>
              </div>
              <div className="vf-wizard__head-rail">
                <WizardSteps
                  className="vf-wizard__steps-bar vf-wizard__steps-bar--inline"
                  variant="line"
                  steps={wizardStepItems}
                  activeIndex={stepToIndex(step)}
                  ariaLabel="出片步骤"
                  onStepClick={goWizardStep}
                />
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="vf-wizard__settings"
                        aria-label="生成选项"
                      >
                        <Settings2 className="size-3.5" aria-hidden />
                      </Button>
                    }
                  />
                  <DropdownMenuContent
                    align="end"
                    className="vf-wizard__settings-menu vf-wizard-popover min-w-[12.5rem]"
                  >
                    <DropdownMenuLabel className="text-xs text-muted-foreground">镜头生成</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                      checked={addTransitions}
                      onCheckedChange={(checked) => setAddTransitions(checked === true)}
                    >
                      段落间转场
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={clearExisting}
                      onCheckedChange={(checked) => setClearExisting(checked === true)}
                    >
                      覆盖镜头轨
                    </DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="vf-wizard__close"
                onClick={onClose}
                aria-label="关闭"
              >
                <X aria-hidden />
              </Button>
            </header>

            {step === 'script' && (
              <div className="vf-wizard__body">
                <Field className="vf-wizard__script-field">
                  <div className="vf-wizard__field-row">
                    <FieldLabel htmlFor="vf-script">口播文稿</FieldLabel>
                    <div className="vf-wizard__field-actions">
                      <span className="vf-wizard__meta" aria-live="polite">{scriptMeta}</span>
                      <WizardLibraryDropdown
                        mode="script"
                        onPickScript={(text) => setScript(text)}
                        onPickVoice={() => {}}
                      />
                    </div>
                  </div>
                  <Textarea
                    id="vf-script"
                    className="vf-wizard__textarea"
                    value={script}
                    onChange={(event) => setScript(event.target.value)}
                    placeholder="粘贴口播稿，按句切镜；过长句按逗号再切。"
                    rows={8}
                  />
                </Field>

                {/* 科学分镜负荷与完播率自愿优化建议 */}
                {segments.length > 10 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      marginTop: 8,
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--foreground)' }}>
                        分镜较多（预计切出 {segments.length} 个镜头，约 {formatTimeCode(stats.durationUs)}）
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                        短视频黄金完播率通常在 30~60 秒（约 6~10 镜）。推荐使用 AI 提炼；您也可以保留全文直接出片。
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isCompressingScript}
                      onClick={handleCompressScriptWithAi}
                      style={{
                        flexShrink: 0,
                        fontSize: 11,
                        color: 'var(--primary)',
                        borderColor: 'rgba(59, 130, 246, 0.4)',
                        background: 'rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      {isCompressingScript ? 'AI 提炼中…' : '⚡ AI 浓缩至黄金短视频'}
                    </Button>
                  </div>
                )}

                {/* AI 导演模式开关与说明 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    marginTop: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
                      启用大模型 AI 导演编排
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      由大模型智能理解叙事意图并从文案中自动提炼镜头主副标题与核心数据
                    </span>
                  </div>
                  <Switch
                    checked={aiMode}
                    disabled={aiState.phase === 'running'}
                    onCheckedChange={(checked) => setAiMode(checked === true)}
                  />
                </div>

                {/* AI 运行中状态提示 */}
                {aiState.phase === 'running' && (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      fontSize: 11,
                      color: 'var(--foreground)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      AI 分镜导演正在编排剧本并提炼视觉文字…
                    </div>
                    {aiState.reasoning ? (
                      <div style={{ color: 'var(--muted-foreground)', fontSize: 10, maxHeight: 60, overflowY: 'auto' }}>
                        {aiState.reasoning}
                      </div>
                    ) : null}
                  </div>
                )}
                {aiState.phase === 'error' && (
                  <p className="vf-wizard__error" style={{ marginTop: 8 }}>
                    AI 编排提示：{aiState.error}（已可继续使用基础编排）
                  </p>
                )}
              </div>
            )}

            {step === 'review' && (
              <div className="vf-wizard__body">
                <p className="vf-wizard__meta vf-wizard__meta--block">
                  {summary.shotCount} 镜 · {formatTimeCode(summary.totalUs)} · {aiMode && aiBeats.length ? 'AI 导演智能编排（已提取镜头文字，可在右侧精修）' : '规则快速匹配，可在时间轴改'}
                </p>
                <ul className="vf-wizard__list">
                  {beats.map((beat, index) => (
                    <li key={`${beat.shot.shotId}-${index}`}>
                      <span className="vf-wizard__index">{index + 1}</span>
                      <div className="vf-wizard__beat">
                        <strong>{beat.segment.text || '（过渡）'}</strong>
                        <span className="vf-wizard__shot">
                          {getShotCategoryDisplayName(beat.shot)} · {getShotDisplayName(beat.shot)}
                          <em>{beat.reason}</em>
                        </span>
                        {beat.overrides && Object.keys(beat.overrides).length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                            {Object.entries(beat.overrides).map(([k, v]) => (
                              <span
                                key={k}
                                style={{
                                  fontSize: 10,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: 'var(--card)',
                                  border: '1px solid var(--border)',
                                  color: 'var(--primary)',
                                  fontWeight: 500,
                                }}
                              >
                                {k === 'text' ? '主标' : k === 'subline' ? '副标' : k === 'highlightWord' ? '高亮' : k === 'value' ? '数值' : k === 'metric' ? '指标' : k === 'title' ? '标题' : k}: {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="vf-wizard__dur">{formatTimeCode(beat.durationUs)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 'voice' && (
              <div className="vf-wizard__body">
                {!canVoice && !importedDubbing ? (
                  <p className="vf-wizard__meta vf-wizard__meta--block">
                    当前无法在线合成，请从配音库选用历史音频，或关闭同步配音仅生成镜头。
                  </p>
                ) : null}

                <div className="vf-wizard__voice-toolbar">
                  <Field orientation="horizontal" className="vf-wizard__voice-toggle">
                    <Switch
                      id="vf-with-voice"
                      checked={withVoice}
                      disabled={busy}
                      onCheckedChange={(checked) => {
                        const on = checked === true
                        setWithVoice(on)
                        if (!on) setImportedDubbing(null)
                      }}
                    />
                    <FieldLabel htmlFor="vf-with-voice" className="vf-wizard__option-label">
                      同步配音
                    </FieldLabel>
                  </Field>
                  <WizardLibraryDropdown
                    mode="voice"
                    disabled={busy}
                    onPickScript={() => {}}
                    onPickVoice={({ blob, text, voiceLabel, voiceId: pickedVoiceId }) => {
                      setImportedDubbing({ blob, text: text || script, voiceLabel, voiceId: pickedVoiceId })
                      setWithVoice(true)
                      if (text.trim()) setScript(text)
                      if (pickedVoiceId) setVoiceId(pickedVoiceId)
                    }}
                  />
                </div>

                {importedDubbing && withVoice ? (
                      <p className="vf-wizard__library-pill">
                        已选：{importedDubbing.voiceLabel}
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() => setImportedDubbing(null)}
                        >
                          清除
                        </Button>
                      </p>
                    ) : null}

                    {withVoice && !useLibraryDubbing && canVoice && (
                      <div className="vf-voice-form">
                        <Field>
                          <FieldLabel htmlFor="vf-voice">音色</FieldLabel>
                          <Select
                            value={voiceId}
                            disabled={busy}
                            onValueChange={(value) => setVoiceId(value ?? '')}
                          >
                            <SelectTrigger id="vf-voice" className="vf-wizard__select">
                              <SelectValue placeholder="选择音色" />
                            </SelectTrigger>
                            <SelectContent>
                              {voices.map((voice) => (
                                <SelectItem key={voice.id} value={voice.id}>
                                  {voice.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="vf-speed">
                            语速 {speed.toFixed(2)}×
                          </FieldLabel>
                          <input
                            id="vf-speed"
                            className="vf-wizard__range"
                            type="range"
                            min={VOICE_SPEED_MIN}
                            max={VOICE_SPEED_MAX}
                            step={0.05}
                            value={speed}
                            disabled={busy}
                            onChange={(event) => setSpeed(Number(event.target.value))}
                          />
                        </Field>

                        <p className="vf-wizard__meta vf-wizard__meta--block">
                          约 {voiceCharCount} 字 · 配音 {estimatedVoiceSeconds.toFixed(1)} 秒
                        </p>
                        {voiceBlockedReason ? (
                          <p className="vf-wizard__error">{voiceBlockedReason}</p>
                        ) : null}
                      </div>
                    )}

                    {voiceState.phase === 'running' && (
                      <p className="vf-wizard__meta vf-wizard__meta--block">
                        配音生成中… {voiceState.status}
                        {voiceState.taskId ? ` · ${voiceState.taskId.slice(0, 8)}` : ''}
                      </p>
                    )}
                    {voiceState.phase === 'done' && (
                      <p className="vf-wizard__meta vf-wizard__meta--block">
                        已完成（{(voiceState.bytes / 1024).toFixed(0)} KB）
                      </p>
                    )}
                {voiceState.phase === 'error' && (
                  <p className="vf-wizard__error">配音失败：{voiceState.message}</p>
                )}
              </div>
            )}

            <footer className="vf-wizard__foot">
              {step === 'review' && (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep('script')}>
                  返回
                </Button>
              )}
              {step === 'voice' && (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setStep('review')}>
                  返回
                </Button>
              )}
              {step === 'script' && (
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  取消
                </Button>
              )}

              {step === 'script' && (
                <Button
                  type="button"
                  size="sm"
                  disabled={!segments.length || aiState.phase === 'running'}
                  onClick={handleProceedFromScript}
                >
                  {aiState.phase === 'running'
                    ? 'AI 导演编排中…'
                    : aiMode
                    ? 'AI 智能编排 (下一步)'
                    : '继续'}
                </Button>
              )}
              {step === 'review' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!beats.length || busy}
                    onClick={handleShotsOnly}
                  >
                    仅镜头
                  </Button>
                  <Button type="button" size="sm" disabled={!beats.length} onClick={() => setStep('voice')}>
                    继续
                  </Button>
                </>
              )}
              {step === 'voice' && (
                <>
                  {busy ? (
                    <Button type="button" variant="outline" size="sm" onClick={cancelVoice}>
                      停止
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !beats.length ||
                      busy ||
                      (withVoice &&
                        !useLibraryDubbing &&
                        (!canVoice || Boolean(voiceBlockedReason)))
                    }
                    onClick={() => {
                      if (withVoice) void handleWithVoice()
                      else handleShotsOnly()
                    }}
                  >
                    {withVoice ? '镜头+配音' : '完成'}
                  </Button>
                </>
              )}
            </footer>
          </div>
        </div>
    </VfOverlayPortal>
  )
}

function translateStatus(status: string): string {
  switch (status) {
    case 'queued':
      return '排队中'
    case 'running':
      return '合成中'
    case 'succeeded':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

/** 供外部展示映射结果（非向导场景）。 */
export type { ShotDefinition }
