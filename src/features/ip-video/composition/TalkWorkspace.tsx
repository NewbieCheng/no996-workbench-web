import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LoaderCircle } from 'lucide-react'
import { EditorProvider, TimelinePanel, useEditorDocument, useEditorInstance, usePlayback, mirrorCaptionsOntoTextTrack, type EditorInstance } from '@no996/video-editor'
import { Button } from '@no996/ui/button'
import { Input } from '@no996/ui/input'
import { Textarea } from '@no996/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@no996/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@no996/ui/dialog'
import { ColumnDivider } from '@no996/ui/column-divider'
import { createDisplayDelta } from '../../../agent'
import { useWorkbenchTasks } from '../../../services/workbench-tasks'
import { usePersonaInjection } from '../../../components/agent/PersonaInjection'
import { useVideoExportEnqueue } from '../../video-factory/lib/use-video-export-enqueue'
import { resolveMediaUrl } from '../../../api/media'
import { apiErrorMessage } from '../../../api/client'
import { notifyOperationError, toastSuccess, useNotifyOperationMessage } from '../../../lib/toast'
import { downloadUrl } from '../../../services/browser'
import { generateAiImages } from '../../../api/images'
import { listDigitalHumanProjects, type DigitalHumanProject } from '../../digital-human/lib/project-store'
import { applyDigitalHumanToDocument } from '../adapters/digital-human-adapter'
import type { TalkDirection } from '../agent/types'
import {
  editTalk,
  estimateCues,
  talkSettings,
  updateScript,
  validateTalkCaptions,
  voiceDuration,
  setTalkRatio,
  resolveTalkCoverTitle,
  type TalkDocument,
} from './talk-model'
import { talkExportIssues } from './talk-export-checks'
import { compileTalkDirectorPlan } from './talk-director-compiler'
import { useTalkCreation } from './use-talk-creation'
import { TalkLookPreview } from './TalkLookStrip'
import { talkAspectCss, type TalkFormatRatio } from './talk-format'
import { applyTalkLook, talkLookById, TALK_LOOKS } from './talk-looks'
import { composeTalkCoverSquare, TALK_COVER_RATIO_SIZE, validateImage, type TalkCoverRatio } from '../lib/cover'
import { humanizeTalkCreationError, talkCreationErrorNeedsContent } from './talk-creation-errors'
import { canLeaveTalkContentStep, canLeaveTalkVoiceStep, canSubmitTalkCreation, canSuggestTalkDirection, hasEnoughTalkBrief, talkContentBlockerKey, talkVoiceBlockerKey } from './talk-creation-availability'
import { templateProtectionRequired } from './templates/model'
import { TalkAssetStrip } from './TalkAssetStrip'
import { TalkShotPanel } from './TalkShotPanel'
import { useTalkProject } from './use-talk-project'
import { useTalkInputs } from './use-talk-inputs'
import { TalkCaptionPanel, TalkCaptionReview } from './TalkCaptionPanel'
import { TalkMediaPanel } from './TalkMediaPanel'
import { TalkStage } from './TalkStage'
import { TalkProjectToolbar, type TalkToolbarTargets } from './TalkProjectToolbar'
import { TalkDubSettings } from './TalkDubSettings'
import { TalkTemplateLibrary, TalkTemplateSaveDialog } from './templates'
import { useTemplateCopy } from './templates/copy'
import { matchingTalkPreset } from './talk-caption-presets'
import { useTalkV2Copy } from './v2-copy'
import { DEFAULT_TALK_BRIEF_OPTIONS, effectiveTalkOptions, initialTalkOptions, lockCaptions, type TalkBriefOptions } from './talk-options'
import { canEnterTalkStage, defaultTalkStage, previousTalkStage, type TalkStageId } from './talk-pipeline'
import { TalkPipelineRail } from './pipeline/TalkPipelineRail'
import { TalkContentStep } from './pipeline/TalkContentStep'
import { TalkVisualStep } from './pipeline/TalkVisualStep'
import { TalkVoiceStep } from './pipeline/TalkVoiceStep'
import { TalkGenerateStep, type TalkGenerateSummary } from './pipeline/TalkGenerateStep'
import { TalkEditStep } from './pipeline/TalkEditStep'
import { TalkExportStep } from './pipeline/TalkExportStep'
import { TalkAdvancedSettingsDialog } from './pipeline/TalkAdvancedSettingsDialog'
import { TalkCoverPanel } from './pipeline/TalkCoverPanel'
import { TalkAiImageDialog } from './pipeline/TalkAiImageDialog'
import { TalkInspector, type TalkInspectorTarget } from './pipeline/TalkInspector'
import './talk-workspace.css'
import './talk-workspace-v2.css'

export function TalkWorkspace({ owner, sourceProjectId, creationTaskId, toolbarTargets }: { owner: number; sourceProjectId?: string; creationTaskId?: string; toolbarTargets?: TalkToolbarTargets }) {
  const project = useTalkProject(owner)
  const tasks = useWorkbenchTasks({ kind: 'ip_video_create' })
  const openedTask = useRef('')
  const requested = tasks.find(task => task.id === creationTaskId && task.ownerUserId === owner)
  useNotifyOperationMessage(project.error, 'error', 'ip-talk-project-error')
  useEffect(() => {
    if (!requested || !project.editor || openedTask.current === requested.id) return
    openedTask.current = requested.id
    const id = requested.meta?.projectId
    if (id && project.editor.getDocument().id !== id) void project.open(id).catch(failure => project.setError(apiErrorMessage(failure)))
  }, [requested, project.editor, project.open, project.setError])
  if (!project.editor) return <div className="ipt-loading" role="status"><LoaderCircle className="animate-spin" /> 正在打开本机作品…</div>
  return <EditorProvider editor={project.editor}><TalkEditor key={project.editor.id} project={project} owner={owner} sourceProjectId={sourceProjectId} creationTaskId={creationTaskId} toolbarTargets={toolbarTargets} /></EditorProvider>
}

type ProjectHost = ReturnType<typeof useTalkProject>
function displayTalkText(raw: string): string {
  let text = ''
  createDisplayDelta(chunk => { text += chunk }, ['script', 'title', 'opening', 'reason', 'summary', 'text', 'subline'], '\n')?.(raw)
  return text
}
type ConfirmAction = { title: string; message: string; label: string; detail?: ReactNode; run: () => Promise<unknown> }

function TalkEditor({ project, owner, sourceProjectId, creationTaskId, toolbarTargets }: { project: ProjectHost; owner: number; sourceProjectId?: string; creationTaskId?: string; toolbarTargets?: TalkToolbarTargets }) {
  const { t } = useTalkV2Copy()
  const { t: tDh } = useTranslation('digitalHuman')
  const { builtinName } = useTemplateCopy()
  const editor = useEditorInstance()
  const doc = useEditorDocument()
  const { playheadUs, seek } = usePlayback()
  const state = talkSettings(doc)
  const [resultMode, setResultMode] = useState(doc.durationUs > 0)
  const [stage, setStage] = useState<TalkStageId>(() => defaultTalkStage(doc.durationUs > 0))
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [aiImageOpen, setAiImageOpen] = useState(false)
  const [inspectorTarget, setInspectorTarget] = useState<TalkInspectorTarget>('captions')
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [templateBlocked, setTemplateBlocked] = useState(false)
  const [brief, setBrief] = useState(state.creation?.brief ?? '')
  const [adjustment, setAdjustment] = useState('')
  const [options, setOptions] = useState<TalkBriefOptions>(() => initialTalkOptions(state))
  const [digitalOpen, setDigitalOpen] = useState(!!sourceProjectId)
  const [audioOpen, setAudioOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [voiceReviewOpen, setVoiceReviewOpen] = useState(false)
  const [name, setName] = useState(doc.name)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [digitalProjects, setDigitalProjects] = useState<DigitalHumanProject[]>([])
  const [digitalId, setDigitalId] = useState(sourceProjectId ?? '')
  const [versionIds, setVersionIds] = useState<string[]>([])
  const [coverTitle, setCoverTitle] = useState('')
  const [coverCropMode, setCoverCropMode] = useState<'cover' | 'contain'>(state.coverCropMode ?? 'cover')
  const [coverRatio, setCoverRatio] = useState<TalkCoverRatio>(state.coverRatio ?? '3:4')
  const [coverPhoto, setCoverPhoto] = useState<Blob>()
  const [coverUrl, setCoverUrl] = useState('')
  const [coverGenerating, setCoverGenerating] = useState(false)
  const [coverAiBusy, setCoverAiBusy] = useState(false)
  const [contentConfirmed, setContentConfirmed] = useState(!!(hasEnoughTalkBrief(state.creation?.brief ?? '') || state.script.trim()))
  const [selectedDirectionTitle, setSelectedDirectionTitle] = useState('')
  const [visualConfirmed, setVisualConfirmed] = useState(doc.durationUs > 0)
  const [voiceSkipped, setVoiceSkipped] = useState(false)
  const voiceLoaded = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  const operation = useRef(false)
  const activeDocId = useRef(doc.id)
  const persona = usePersonaInjection()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  // A project switch remounts state only for bookkeeping. Document edits keep the same id.
  useEffect(() => {
    if (activeDocId.current === doc.id) return
    activeDocId.current = doc.id
    const nextState = talkSettings(doc)
    setResultMode(doc.durationUs > 0)
    setStage(defaultTalkStage(doc.durationUs > 0))
    setBrief(nextState.creation?.brief ?? '')
    setAdjustment('')
    setOptions(initialTalkOptions(nextState))
    setInspectorTarget('captions')
    setTimelineOpen(false)
    setAdvancedOpen(false)
    setLibraryOpen(false)
    setAiImageOpen(false)
    setName(doc.name)
    setCoverTitle(resolveTalkCoverTitle(doc, talkLookById(nextState.lookId)?.heading ?? TALK_LOOKS[0].heading))
    setCoverCropMode(nextState.coverCropMode ?? 'cover')
    setCoverRatio(nextState.coverRatio ?? '3:4')
    setContentConfirmed(!!(hasEnoughTalkBrief(nextState.creation?.brief ?? '') || nextState.script.trim()))
    setSelectedDirectionTitle('')
    setVisualConfirmed(doc.durationUs > 0)
    setVoiceSkipped(false)
    voiceLoaded.current = false
  }, [doc.id])

  useEffect(() => {
    let active = true
    let owned = ''
    const asset = state.coverAssetId ? doc.assets[state.coverAssetId] : undefined
    if (!asset?.blobId) { setCoverUrl(''); return }
    void project.assets.getAssetBlob(asset.blobId, project.scope).then(blob => {
      if (!active || !blob) return
      owned = URL.createObjectURL(blob)
      setCoverUrl(owned)
    }).catch(() => { if (active) setCoverUrl('') })
    return () => { active = false; if (owned) URL.revokeObjectURL(owned) }
  }, [state.coverAssetId, doc.assets, project.assets, project.scope])

  useEffect(() => {
    let active = true
    const asset = state.coverPhotoAssetId ? doc.assets[state.coverPhotoAssetId] : undefined
    if (!asset?.blobId) { setCoverPhoto(undefined); return }
    void project.assets.getAssetBlob(asset.blobId, project.scope).then(blob => { if (active) setCoverPhoto(blob ?? undefined) }).catch(() => { if (active) setCoverPhoto(undefined) })
    return () => { active = false }
  }, [state.coverPhotoAssetId, doc.assets, project.assets, project.scope])

  const onError = useCallback((message: string) => notifyOperationError(message, { id: 'ip-talk-operation-error' }), [])
  const inputs = useTalkInputs({ editor, assets: project.assets, scope: project.scope, onError })
  const onApplied = useCallback(() => {
    setResultMode(true)
    setStage('edit')
    setAdjustment('')
    setAdvancedOpen(false)
    setLibraryOpen(false)
  }, [])
  const creation = useTalkCreation({ owner, selectedTaskId: creationTaskId, flush: project.flush, onError, onApplied })
  useNotifyOperationMessage(inputs.voiceError, 'warning', 'ip-talk-voice-catalog')
  const audioWorking = inputs.task?.status === 'queued' || inputs.task?.status === 'running'
  const working = inputs.busy || audioWorking || creation.busy
  const audioMismatch = !!state.audioScript && state.audioScript.replace(/\s/gu, '') !== state.script.replace(/\s/gu, '')
  const hasResult = resultMode && doc.durationUs > 0
  const hasDuration = doc.durationUs > 0
  const hasVisual = doc.tracks.some(track => !track.hidden && track.elements.some(element => element.type === 'video' || element.type === 'image'))
  const { onEnqueue, trackedTask, activeTaskId } = useVideoExportEnqueue({ editor, ownerScope: project.scope, source: 'ip-composition', beforeEnqueue: project.flush })
  const exporting = trackedTask?.status === 'queued' || trackedTask?.status === 'running'
  const exportToastTask = useRef('')
  useEffect(() => {
    if (inputs.task?.status === 'failed') notifyOperationError(`${inputs.task.errorMessage || '配音失败。'}原素材已保留，可重新读取已完成的配音或主动重试。`, { id: `ip-talk-audio-task-${inputs.task.id}` })
  }, [inputs.task?.id, inputs.task?.status, inputs.task?.errorMessage])
  useEffect(() => {
    if (trackedTask?.status === 'failed') notifyOperationError(trackedTask.errorMessage || '视频导出失败。', { id: `ip-talk-export-${activeTaskId}` })
    if (trackedTask?.status === 'succeeded' && exportToastTask.current !== activeTaskId) { exportToastTask.current = activeTaskId; toastSuccess('视频已合成，可下载后播放检查。') }
  }, [activeTaskId, trackedTask?.status, trackedTask?.errorMessage])
  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (operation.current || inputs.busy) return
    operation.current = true
    inputs.setBusy(true); project.setError('')
    try { await action() } catch (failure) { if (mounted.current) onError(apiErrorMessage(failure)) }
    finally { operation.current = false; if (mounted.current) inputs.setBusy(false) }
  }, [inputs.busy, inputs.setBusy, onError, project.setError])

  useEffect(() => {
    if (!digitalOpen) return
    let active = true
    void listDigitalHumanProjects(owner).then(items => { if (active) { setDigitalProjects(items); setDigitalId(id => id || items[0]?.id || '') } }).catch(failure => { if (active) onError(apiErrorMessage(failure)) })
    return () => { active = false }
  }, [digitalOpen, owner, onError])
  useEffect(() => {
    if (voiceLoaded.current || creation.demo || creation.busy) return
    if (stage !== 'voice' && stage !== 'generate' && !state.script.trim()) return
    voiceLoaded.current = true
    void inputs.loadVoices().catch(failure => onError(humanizeTalkCreationError(apiErrorMessage(failure))))
  }, [stage, state.script, creation.demo, creation.busy, inputs.loadVoices, onError])

  const effectiveOptions = effectiveTalkOptions(options, state)
  const changeOptions = (next: TalkBriefOptions) => {
    setOptions(next)
    if (JSON.stringify(next.preserve) !== JSON.stringify(effectiveOptions.preserve)) editTalk(editor, 'director-permissions', current => ({ ...current, ipVideo: { ...talkSettings(current), aiProtected: next.preserve } }))
  }
  const resetAdvanced = () => {
    setOptions(DEFAULT_TALK_BRIEF_OPTIONS)
    editTalk(editor, 'director-reset', current => ({ ...current, ipVideo: { ...talkSettings(current), aiProtected: {} } }))
  }
  const rememberBrief = () => {
    if (brief === (talkSettings(editor.getDocument()).creation?.brief ?? '')) return
    editTalk(editor, 'brief-draft', current => ({ ...current, ipVideo: { ...talkSettings(current), creation: { ...talkSettings(current).creation, brief } } }))
  }
  const contentReady = hasResult || canLeaveTalkContentStep({
    brief: hasResult ? adjustment : brief,
    hasScript: !!state.script.trim(),
    hasAudio: inputs.hasAudio,
    contentConfirmed,
  })
  const voiceReady = hasResult || canLeaveTalkVoiceStep({ hasAudio: inputs.hasAudio, voiceId: state.voiceId, voiceSkipped })
  const canGenerate = hasResult
    ? !!adjustment.trim()
    : canSubmitTalkCreation({ hasResult: false, brief, hasScript: !!state.script.trim(), hasAudio: inputs.hasAudio })
  const make = (intent: 'create' | 'directions' | 'adjust', text = brief) => {
    if (working || exporting || templateBlocked) return
    if (intent === 'directions' && !canSuggestTalkDirection({ brief: text, hasScript: !!state.script.trim() })) return
    if (intent !== 'directions' && !canSubmitTalkCreation({ hasResult: intent === 'adjust', brief: text, hasScript: !!state.script.trim(), hasAudio: inputs.hasAudio })) {
      setStage('content')
      onError(t(hasResult ? 'adjustUnavailable' : 'makeUnavailable'))
      return
    }
    void creation.submit({ ...effectiveOptions, intent, brief: intent === 'adjust' ? state.creation?.brief ?? '' : text, adjustment: intent === 'adjust' ? text : undefined, personaContent: persona.background })
  }
  const useDirection = (direction: TalkDirection) => {
    const text = `${direction.title}\n建议开场：${direction.opening}\n${direction.reason}${brief.trim() ? `\n补充要求：${brief}` : ''}`
    setBrief(text)
    setContentConfirmed(true)
    setSelectedDirectionTitle(direction.title)
    editTalk(editor, 'brief-draft', current => ({ ...current, ipVideo: { ...talkSettings(current), creation: { ...talkSettings(current).creation, brief: text } } }))
  }
  const requestAudio = () => {
    if (!state.script.trim()) { onError('先完成口播文稿，再生成配音。'); return }
    setVoiceReviewOpen(true)
  }
  const submitReviewedAudio = () => {
    const snapshot = { script: state.script, voiceId: state.voiceId, speed: state.speed }
    setVoiceReviewOpen(false)
    void run(async () => {
      const fresh = talkSettings(editor.getDocument())
      if (fresh.script !== snapshot.script || fresh.voiceId !== snapshot.voiceId || fresh.speed !== snapshot.speed) throw new Error('文稿或音色已改变，请重新确认配音。')
      await inputs.generate(); await project.flush()
    })
  }
  const requestExport = () => {
    const issues = talkExportIssues(editor.getDocument())
    if (issues.length) { setStage('export'); onError(issues.join('\n')); return }
    const snapshotRevision = editor.getDocument().revision
    const action = async () => {
      if (editor.getDocument().revision !== snapshotRevision) throw new Error('作品已更新，请重新确认导出。')
      validateTalkCaptions(editor.getDocument().captions, editor.getDocument().durationUs)
      await onEnqueue('1080p')
    }
    if (!inputs.hasAudio || audioMismatch) setConfirmAction({ title: !inputs.hasAudio ? '导出无声视频' : '保留当前配音导出', message: !inputs.hasAudio ? '当前作品没有可播放的声音。你可以返回生成或导入配音，也可以确认导出无声视频。' : '文稿和现有配音不是同一版本。继续会保留现有声音，不会自动重新收费生成配音。', label: '按当前内容导出', run: action })
    else void run(action)
  }
  const requestFiles = (files: File[]) => {
    if (!files.length || working || exporting || templateBlocked) return
    const replacing = files.some(file => file.type.startsWith('video/') || file.type.startsWith('audio/')) || (files.some(file => file.type.startsWith('image/')) && doc.tracks.some(track => track.elements.some(element => element.type === 'video')))
    const hasExisting = doc.tracks.some(track => track.elements.some(element => ['video', 'image', 'audio'].includes(element.type)))
    if ((replacing && hasExisting) || (files.some(file => /\.srt$/i.test(file.name)) && doc.captions.length > 0)) setConfirmAction({ title: '使用新的素材', message: '新视频会替换现有画面与声音；新音频会替换声音；SRT 会替换字幕。照片会替换人物视频。其他文稿和可保留的设置不变，可以撤销。', label: '使用这些素材', run: () => inputs.addFiles(files) })
    else void inputs.addFiles(files)
  }
  const openFiles = (accept = 'audio/*,video/*,image/png,image/jpeg,image/webp,.srt') => { if (fileRef.current) { fileRef.current.accept = accept; fileRef.current.click() } }
  const openAudioImport = () => { setAudioOpen(false); openFiles('audio/*') }
  const openVideoImport = () => { setDigitalOpen(false); openFiles('video/*,image/png,image/jpeg,image/webp') }
  const available = digitalProjects.find(p => p.id === digitalId)?.segments.flatMap((segment, index) => segment.versions.filter(v => v.videoBlob || (v.videoUrl && v.status !== 'expired')).map(v => ({ ...v, text: v.text || segment.text, label: `分段 ${index + 1} · ${v.text || segment.text}` }))) ?? []
  const importDigital = async () => {
    const documentId = doc.id
    const list = versionIds.map(id => available.find(v => v.id === id)).filter((item): item is NonNullable<typeof item> => !!item)
    if (!list.length) throw new Error('请选择要使用的数字人成片。')
    const prepared = []
    for (const item of list) {
      let blob = item.videoBlob
      if (!blob && item.videoUrl) {
        const response = await fetch(resolveMediaUrl(item.videoUrl), { signal: AbortSignal.timeout(30_000) })
        if (!response.ok) throw new Error('数字人成片无法读取。请检查链接有效期，或下载后导入本机文件。')
        blob = await response.blob()
      }
      if (!blob) throw new Error('该分段没有可用视频。')
      const asset = await inputs.persistAsset(blob, item.label)
      prepared.push({ item, blob, asset })
    }
    if (editor.getDocument().id !== documentId || !mounted.current) return
    editTalk(editor, 'digital-human', current => {
      let next: TalkDocument = { ...current, durationUs: 0, captions: [], tracks: current.tracks.map(track => ({ ...track, elements: track.elements.filter(element => !['video', 'image', 'audio', 'shot'].includes(element.type)) })) }
      for (const { item, blob, asset } of prepared) {
        const offset = voiceDuration(next)
        next = applyDigitalHumanToDocument(next, { versionId: item.id, name: asset.name, videoBlob: blob, blobId: asset.blobId!, durationUs: asset.durationUs!, width: asset.width!, height: asset.height! })
        next.captions = [...next.captions, ...estimateCues(item.text, asset.durationUs!, offset)]
      }
      if (next.durationUs > 300_000_000) throw new Error('选中分段合计超过 5 分钟，请减少分段。')
      const script = prepared.map(p => p.item.text).join('\n')
      next.ipVideo = { ...talkSettings(current), script, audioScript: script, captionReviewScript: undefined, taskId: undefined, appliedTaskId: undefined }
      mirrorCaptionsOntoTextTrack(next)
      return next
    })
    setDigitalOpen(false); setVersionIds([])
    setResultMode(true); setStage('edit')
  }
  const audioTasks = inputs.tasks.filter(task => ['ip_video_audio', 'voice_tts', 'voice_dub_advanced'].includes(task.kind) && task.status === 'succeeded')
  const selectFormat = (ratio: TalkFormatRatio) => {
    editTalk(editor, 'canvas-ratio', current => setTalkRatio(current, ratio))
    changeOptions({ ...effectiveOptions, ratio, preserve: { ...effectiveOptions.preserve, composition: true } })
  }
  const selectStage = (next: TalkStageId) => {
    if (working || exporting) return
    const gate = canEnterTalkStage(next, { hasResult, hasDuration, canGenerate, contentReady, voiceReady, visualConfirmed })
    if (!gate.allowed) {
      onError(t(gate.reasonKey ?? 'needContent'))
      return
    }
    if ((next === 'edit' || next === 'export') && !hasResult && hasDuration) setResultMode(true)
    editor.setIsPlaying(false)
    setStage(next)
  }
  const goNext = () => {
    if (stage === 'content') {
      if (!contentReady) return
      setContentConfirmed(true)
      setStage('visual')
      return
    }
    if (stage === 'visual') {
      setVisualConfirmed(true)
      setStage('voice')
      return
    }
    if (stage === 'voice') {
      if (!voiceReady) return
      setStage('generate')
      return
    }
    if (stage === 'edit') setStage('export')
  }
  const goBack = () => setStage(previousTalkStage(stage))
  const openStageInspector = (tab: 'text' | 'media') => {
    setResultMode(true)
    setStage('edit')
    setInspectorTarget(tab === 'text' ? 'captions' : 'media')
  }
  const selectedLook = talkLookById(state.lookId) ?? TALK_LOOKS[0]
  const selectedStyleName = state.styleTemplate
    ? state.styleTemplate.id.startsWith('talk-style-') || state.styleTemplate.id.startsWith('look:') ? state.styleTemplate.name : builtinName(state.styleTemplate.id)
    : selectedLook.name
  const preset = matchingTalkPreset(doc.captionStyle)
  const styleName = selectedStyleName ?? (preset ? builtinName(preset.id) : t('customStyle'))
  const changeFormatLabel = (ratio: string) => ratio === '16:9' ? t('formatLandscape') : ratio === '3:4' ? t('formatCover') : ratio === '1:1' ? t('square') : t('formatPortrait')
  const generateChecklist = hasResult ? undefined : [
    { id: 'content', label: t('checklistContent'), ready: contentReady, detail: contentReady ? t('checklistContentReady') : t('needContent'), onFix: () => setStage('content') },
    { id: 'visual', label: t('checklistVisual'), ready: visualConfirmed, detail: visualConfirmed ? `${changeFormatLabel(doc.canvas.ratio)} · ${styleName}` : t('needVisualConfirm'), onFix: () => setStage('visual') },
    { id: 'voice', label: t('checklistVoice'), ready: voiceReady, detail: inputs.hasAudio ? t('voiceReady') : state.voiceId ? t('voiceSelected') : voiceSkipped ? t('voiceSkipped') : t('needVoiceChoice'), onFix: () => setStage('voice') },
  ]
  const applyLook = (lookId: string) => {
    const look = talkLookById(lookId)
    if (!look || working || exporting || templateBlocked) return
    const commit = () => {
      editTalk(editor, 'talk-look', current => { const next = applyTalkLook(current, lookId); return { ...next, ipVideo: { ...talkSettings(next), coverAssetId: undefined } } })
      changeOptions(lockCaptions({ ...effectiveOptions, captionPresetId: look.captionPresetId, motion: look.motion }))
    }
    if (hasResult && templateProtectionRequired(editor.getDocument()) && state.lookId && state.lookId !== lookId) {
      setConfirmAction({ title: t('replaceLookTitle'), message: t('replaceLookMessage'), label: t('replaceLook'), run: async () => commit() })
      return
    }
    commit()
  }
  const coverTitleValue = coverTitle || resolveTalkCoverTitle(doc, selectedLook.heading)
  const commitCoverTitle = () => {
    const next = coverTitle.trim() || resolveTalkCoverTitle(editor.getDocument(), selectedLook.heading)
    setCoverTitle(next)
    // Blurring the title input must not invalidate a generated cover unless the text really changed.
    if (next === (state.coverTitle?.trim() ?? '')) return
    editTalk(editor, 'cover-title', current => ({ ...current, ipVideo: { ...talkSettings(current), coverTitle: next, coverAssetId: undefined } }))
  }
  const changeCoverCrop = (mode: 'cover' | 'contain') => {
    if (mode === coverCropMode) return
    setCoverCropMode(mode)
    editTalk(editor, 'cover-crop', current => ({ ...current, ipVideo: { ...talkSettings(current), coverCropMode: mode, coverAssetId: undefined } }))
  }
  const changeCoverRatio = (ratio: TalkCoverRatio) => {
    if (ratio === coverRatio) return
    setCoverRatio(ratio)
    editTalk(editor, 'cover-ratio', current => ({ ...current, ipVideo: { ...talkSettings(current), coverRatio: ratio, coverAssetId: undefined } }))
  }
  const changeCoverPhoto = (file: File) => {
    void run(async () => {
      await validateImage(file, 10 * 1024 * 1024)
      const asset = await inputs.persistAsset(file, file.name)
      editTalk(editor, 'cover-photo', current => ({ ...current, assets: { ...current.assets, [asset.id]: asset }, ipVideo: { ...talkSettings(current), coverPhotoAssetId: asset.id, coverAssetId: undefined } }))
      setCoverPhoto(file)
    })
  }
  const uploadFinishedCover = (file: File) => {
    void run(async () => {
      await validateImage(file, 10 * 1024 * 1024)
      const asset = await inputs.persistAsset(file, file.name)
      editTalk(editor, 'cover-image', current => ({ ...current, assets: { ...current.assets, [asset.id]: asset }, ipVideo: { ...talkSettings(current), coverAssetId: asset.id, coverRatio } }))
    })
  }
  const generateCover = () => {
    if (working || coverGenerating) return
    setCoverGenerating(true)
    void run(async () => {
      const title = coverTitleValue.trim()
      if (!title) throw new Error('请先填写封面标题。')
      const blob = await composeTalkCoverSquare({ lookId: selectedLook.id, title, photo: coverPhoto, cropMode: coverCropMode, ratio: coverRatio })
      const asset = await inputs.persistAsset(blob, `封面-${title.replace(/[\/:*?"<>|\s]+/g, '-')}.png`)
      editTalk(editor, 'cover-image', current => ({ ...current, assets: { ...current.assets, [asset.id]: asset }, ipVideo: { ...talkSettings(current), coverTitle: title, coverCropMode, coverRatio, coverAssetId: asset.id } }))
    }).finally(() => { if (mounted.current) setCoverGenerating(false) })
  }
  const generateCoverAi = (prompt: string) => {
    if (working || coverAiBusy) return
    setCoverAiBusy(true)
    void run(async () => {
      const size = TALK_COVER_RATIO_SIZE[coverRatio].aiSize
      const { imageUrls } = await generateAiImages({ prompt, size, n: 1 })
      const url = imageUrls[0]
      if (!url) throw new Error('图像接口没有返回可用图片。')
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000) })
      if (!response.ok) throw new Error('生成图片下载失败，请稍后重试。')
      const blob = await response.blob()
      if (!blob.type.startsWith('image/')) throw new Error('图像接口返回的内容不是图片。')
      const file = new File([blob], `AI-封面-${Date.now()}.png`, { type: blob.type || 'image/png' })
      await validateImage(file, 10 * 1024 * 1024)
      const asset = await inputs.persistAsset(file, file.name)
      editTalk(editor, 'cover-image', current => ({ ...current, assets: { ...current.assets, [asset.id]: asset }, ipVideo: { ...talkSettings(current), coverAssetId: asset.id, coverRatio } }))
    }).finally(() => { if (mounted.current) setCoverAiBusy(false) })
  }
  const generateAiImage = async (prompt: string, size: string) => {
    const { imageUrls } = await generateAiImages({ prompt, size, n: 1 })
    const url = imageUrls[0]
    if (!url) throw new Error('图像接口没有返回可用图片。')
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000) })
    if (!response.ok) throw new Error('生成图片下载失败，请稍后重试。')
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) throw new Error('图像接口返回的内容不是图片。')
    const file = new File([blob], `AI-画面-${Date.now()}.png`, { type: blob.type || 'image/png' })
    await validateImage(file, 10 * 1024 * 1024)
    const ok = await inputs.addFiles([file])
    if (!ok) return false
    setResultMode(true)
    setStage('edit')
    setInspectorTarget('media')
    return true
  }
  const downloadCover = () => {
    void run(async () => {
      const asset = state.coverAssetId ? editor.getDocument().assets[state.coverAssetId] : undefined
      if (!asset?.blobId) throw new Error('请先生成封面。')
      const blob = await project.assets.getAssetBlob(asset.blobId, project.scope)
      if (!blob) throw new Error('封面文件已失效，请重新生成。')
      const url = URL.createObjectURL(blob)
      downloadUrl(url, asset.name || '口播封面.png')
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  }
  const timelineEditor = useMemo<EditorInstance>(() => ({ ...editor, executeCommand(command) {
    const previous = talkSettings(editor.getDocument()).aiProtected
    return editor.executeCommand({ id: command.id, type: command.type, execute(current) { const result = command.execute(current); return { ...result, document: { ...result.document, ipVideo: { ...talkSettings(result.document), aiProtected: { ...talkSettings(result.document).aiProtected, composition: true, shots: true } } } } }, undo(current) { const result = command.undo(current); return { ...result, document: { ...result.document, ipVideo: { ...talkSettings(result.document), aiProtected: previous } } } } })
  } }), [editor])
  const issues = talkExportIssues(doc)
  const savePendingCopy = async () => {
    const pending = creation.pending
    if (!pending || pending.result.kind !== 'composition') return
    const snapshot = structuredClone(pending.input.document)
    snapshot.id = `proj-ip-${crypto.randomUUID()}`
    snapshot.revision = 0
    snapshot.createdAt = Date.now(); snapshot.updatedAt = snapshot.createdAt
    const input = { ...pending.input, document: snapshot }
    const next = compileTalkDirectorPlan(snapshot, pending.result.plan, input, pending.id) as TalkDocument
    next.name = `${next.name}（AI 方案副本）`
    next.ipVideo = { ...talkSettings(next), creation: { brief: input.brief, summary: pending.result.plan.summary, appliedTaskIds: [pending.id], usedMock: pending.result.usedMock } }
    await project.flush()
    await project.repo.saveProject(next)
    creation.dismiss()
    await project.open(next.id)
  }
  const scripts = { script: state.script, onChange: (value: string) => editTalk(editor, 'script', current => updateScript(current, value)), onCommit: () => void project.flush() }
  const summary: TalkGenerateSummary[] = [
    { label: t('generateSummaryVisual'), value: `${changeFormatLabel(doc.canvas.ratio)} · ${styleName}`, onEdit: () => setStage('visual') },
    { label: t('generateSummaryCaption'), value: effectiveOptions.preserve.captions ? styleName : effectiveOptions.captionPresetId ? builtinName(effectiveOptions.captionPresetId) : t('aiChoose'), hint: effectiveOptions.preserve.captions ? t('captionsLocked') : t('aiWillChoose'), onEdit: () => setAdvancedOpen(true) },
    { label: t('motion'), value: effectiveOptions.motion === 'auto' ? t('aiChoose') : t(effectiveOptions.motion), onEdit: () => setAdvancedOpen(true) },
    { label: t('sound'), value: inputs.hasAudio ? t('voiceReady') : state.voiceId ? (inputs.voices.find(v => v.id === state.voiceId)?.label ?? t('voiceSelected')) : t('noVoice'), onEdit: () => setStage('voice') },
    { label: t('persona'), value: persona.enabled && persona.persona ? persona.persona.name : t('noPersona'), onEdit: () => setAdvancedOpen(true) },
  ]
  const processPanel = creation.run ? <div className={`ipt-creation-process${creation.busy ? ' is-open' : ''}`}><h4>{t(creation.demo ? 'processDemo' : 'process')}</h4><ol>{creation.run.stages.filter(stageItem => stageItem.status !== 'idle' && stageItem.status !== 'skipped').map(stageItem => <li key={stageItem.id}><span>{t(`stage_${stageItem.id}`, { defaultValue: t('process') })}</span><small>{t(stageItem.status === 'done' ? 'done' : stageItem.status === 'failed' ? 'failed' : stageItem.status === 'running' ? 'running' : 'stopped')}</small>{stageItem.streamingContent && <p>{displayTalkText(stageItem.streamingContent)}</p>}</li>)}</ol></div> : undefined
  const generateNotices = <>
    {creation.busy && <section className="ipt-creation-progress" role="status" aria-live="polite"><LoaderCircle className="animate-spin" size={18} /><div><strong>{creation.stageLabel}</strong><span>{t('creationProgress')}</span></div><Button variant="ghost" size="sm" onClick={creation.cancel}>{t('cancel')}</Button></section>}
    {state.creation?.summary && <details className="ipt-details"><summary>{t('creationSummary')}</summary><p className="ipt-plan-summary">{state.creation.summary}</p></details>}
    {creation.pending && <section className="ipt-review-notice" role="status"><strong>AI 方案已完成，当前作品也有新的修改</strong><p>你的修改已保留。可将原方案另存为新作品，或按当前作品重新安排。</p><div className="ipt-inline-actions"><Button variant="toolbar" disabled={working} onClick={() => void run(savePendingCopy)}>另存方案副本</Button><Button variant="toolbar" disabled={working} onClick={() => make('create')}>按当前作品重新安排</Button><Button variant="ghost" onClick={creation.dismiss}>保留当前作品，忽略方案</Button></div></section>}
  </>
  const voiceReviewControls = <TalkDubSettings
    t={tDh}
    variant="compact"
    busy={working}
    pending={audioWorking}
    demo={creation.demo}
    dubSourceMode="ai"
    onDubSourceModeChange={() => {}}
    voices={inputs.voices}
    voiceId={state.voiceId ?? ''}
    onVoiceIdChange={id => editTalk(editor, 'voice', current => ({ ...current, ipVideo: { ...talkSettings(current), voiceId: id } }))}
    speed={state.speed ?? 1}
    onSpeedChange={value => editTalk(editor, 'voice-rate', current => ({ ...current, ipVideo: { ...talkSettings(current), speed: value } }))}
    hasAudio={inputs.hasAudio}
    audioMismatch={audioMismatch}
    voiceError={inputs.voiceError}
    onGenerateDub={requestAudio}
    onReloadVoices={() => void inputs.loadVoices()}
    onOpenWorkshop={() => setAudioOpen(true)}
    onUploadAudio={() => openFiles('audio/*')}
  />
  const preview = hasResult
    ? <TalkStage assets={project.assets} scope={project.scope} onSelect={openStageInspector} onError={onError} />
    : <>
      <TalkLookPreview look={selectedLook} aspect={talkAspectCss(doc.canvas.ratio)} heading={(brief.trim().split(/[\n。！？!?]/u)[0] || '').slice(0, 18)} />
      <p className="ipt-cap">{styleName} · {changeFormatLabel(doc.canvas.ratio)}</p>
    </>
  const contentBlockerKey = hasResult ? (adjustment.trim() ? undefined : 'adjustUnavailable') : talkContentBlockerKey({ brief, hasScript: !!state.script.trim(), hasAudio: inputs.hasAudio, contentConfirmed })
  const voiceBlockerKey = talkVoiceBlockerKey({ hasAudio: inputs.hasAudio, voiceId: state.voiceId, voiceSkipped })
  const contentStep = <TalkContentStep
    brief={hasResult ? adjustment : brief}
    onBriefChange={value => {
      if (hasResult) setAdjustment(value)
      else {
        setBrief(value)
        setContentConfirmed(hasEnoughTalkBrief(value) || !!state.script.trim())
      }
    }}
    onRemember={hasResult ? () => {} : rememberBrief}
    hasResult={hasResult}
    hasScript={!!state.script.trim()}
    busy={working || exporting}
    demo={creation.demo}
    directions={hasResult ? null : creation.directions?.directions ?? null}
    canSuggest={canSuggestTalkDirection({ brief, hasScript: !!state.script.trim() })}
    canNext={hasResult ? !!adjustment.trim() : contentReady}
    blocker={contentBlockerKey ? t(contentBlockerKey) : undefined}
    contentConfirmed={contentConfirmed && !hasResult}
    selectedDirectionTitle={selectedDirectionTitle}
    assetStrip={<TalkAssetStrip assets={project.assets} scope={project.scope} onAddFiles={requestFiles} />}
    onAddFiles={requestFiles}
    onDirections={() => make('directions')}
    onUseDirection={useDirection}
    onOpenAdvanced={() => setAdvancedOpen(true)}
    onNext={goNext}
  />
  const visualStep = <TalkVisualStep
    ratio={doc.canvas.ratio}
    lookId={state.lookId}
    busy={working || exporting}
    onFormat={selectFormat}
    onLook={applyLook}
    onBrowse={() => setLibraryOpen(true)}
    onAiImage={() => setAiImageOpen(true)}
    onNext={goNext}
    onBack={goBack}
    onOpenAdvanced={() => setAdvancedOpen(true)}
  />
  const voiceStep = <TalkVoiceStep
    voices={inputs.voices}
    voiceId={state.voiceId ?? ''}
    speed={state.speed ?? 1}
    voiceError={inputs.voiceError}
    hasAudio={inputs.hasAudio}
    audioMismatch={audioMismatch}
    busy={working || exporting}
    pending={audioWorking}
    demo={creation.demo}
    canNext={voiceReady}
    blocker={voiceBlockerKey ? t(voiceBlockerKey) : undefined}
    voiceSkipped={voiceSkipped}
    showRetryBinding={inputs.task?.status === 'succeeded' && state.appliedTaskId !== inputs.task.id}
    onVoiceIdChange={id => {
      setVoiceSkipped(false)
      editTalk(editor, 'voice', current => ({ ...current, ipVideo: { ...talkSettings(current), voiceId: id } }))
    }}
    onSpeedChange={value => editTalk(editor, 'voice-rate', current => ({ ...current, ipVideo: { ...talkSettings(current), speed: value } }))}
    onGenerateDub={requestAudio}
    onReloadVoices={() => { voiceLoaded.current = false; void inputs.loadVoices().catch(failure => onError(humanizeTalkCreationError(apiErrorMessage(failure)))) }}
    onUseExisting={() => { setVoiceSkipped(false); setAudioOpen(true) }}
    onUploadAudio={() => { setVoiceSkipped(false); openFiles('audio/*') }}
    onSkipVoice={() => setVoiceSkipped(true)}
    onRetryBinding={() => void run(inputs.retryBinding)}
    onNext={goNext}
    onBack={goBack}
    onOpenAdvanced={() => setAdvancedOpen(true)}
  />
  const generateStep = <TalkGenerateStep
    summaries={summary}
    checklist={generateChecklist}
    canGenerate={canGenerate && (hasResult || voiceReady)}
    canDirectEdit={hasDuration && !hasResult}
    busy={working || exporting}
    demo={creation.demo}
    hasResult={hasResult}
    blocker={!canGenerate ? t(hasResult ? 'adjustUnavailable' : 'makeUnavailable') : !voiceReady ? t('needVoiceChoice') : undefined}
    lastFailure={creation.lastFailure}
    onDismissFailure={creation.dismissFailure}
    notices={generateNotices}
    processPanel={processPanel}
    onGenerate={() => {
      if (!canGenerate) {
        if (talkCreationErrorNeedsContent(t('makeUnavailable'))) setStage('content')
        return
      }
      make(hasResult ? 'adjust' : 'create', hasResult ? adjustment : brief)
    }}
    onDirectEdit={() => { setResultMode(true); setStage('edit') }}
    onBack={goBack}
    onOpenAdvanced={() => setAdvancedOpen(true)}
  />
  const editStep = <TalkEditStep
    stage={preview}
    inspector={<TalkInspector
      target={inspectorTarget}
      onTarget={setInspectorTarget}
      counts={{ captions: doc.captions.length, media: doc.tracks.flatMap(track => track.elements.filter(element => element.type === 'image' || element.type === 'video')).length, shots: doc.tracks.flatMap(track => track.elements.filter(element => element.type === 'shot')).length }}
    >
      <TalkCaptionReview onError={onError} />
      {inspectorTarget === 'captions' ? <TalkCaptionPanel onError={onError} /> : inspectorTarget === 'media' ? <>
        <TalkMediaPanel onAdd={() => openFiles()} onDigital={() => setDigitalOpen(true)} onAiImage={() => setAiImageOpen(true)} busy={working || exporting} />
        {!hasVisual && <p className="ipt-help">{t('textOnly')}</p>}
      </> : <TalkShotPanel onError={onError} disabled={working || exporting} curated />}
    </TalkInspector>}
    divider={<ColumnDivider className="ipt-inspector-divider" previewSelector=".ipt-inspector" widthVariable="--ipt-inspector-width" defaultRatio={0.5} defaultWidth={480} minWidth={340} minMainWidth={360} maxPreviewRatio={0.5} invert label={t('resizeInspector')} />}
    timeline={<TimelinePanel editor={timelineEditor} variant="compact" playheadUs={playheadUs} onSeek={seek} toolbarSimplified />}
    timelineOpen={timelineOpen}
    onToggleTimeline={() => setTimelineOpen(value => !value)}
    onBack={() => setStage('generate')}
    onNext={() => setStage('export')}
  />
  const exportStatus = trackedTask && (exporting || trackedTask.downloadUrl) ? <div className="ipt-export-state" role="status">{exporting && <><span>{trackedTask.stage || '合成已加入后台任务，请保持本标签页打开。'}</span>{trackedTask.progress != null && trackedTask.status === 'running' && <progress max={100} value={trackedTask.progress} aria-label="视频合成进度" />}{trackedTask.onCancel && <Button variant="ghost" size="sm" onClick={trackedTask.onCancel}>取消合成</Button>}</>}{trackedTask.downloadUrl && <Button variant="toolbar" render={<a href={trackedTask.downloadUrl} download={trackedTask.fileName || `${doc.name}.mp4`} />}>下载成片</Button>}</div> : undefined
  const coverPanel = <TalkCoverPanel
    lookId={selectedLook.id}
    title={coverTitleValue}
    cropMode={coverCropMode}
    ratio={coverRatio}
    photo={coverPhoto}
    coverUrl={coverUrl}
    busy={working || exporting}
    generating={coverGenerating}
    aiBusy={coverAiBusy}
    onTitle={setCoverTitle}
    onTitleCommit={commitCoverTitle}
    onCrop={changeCoverCrop}
    onRatio={changeCoverRatio}
    onPhoto={changeCoverPhoto}
    onUploadCover={uploadFinishedCover}
    onGenerate={generateCover}
    onGenerateAi={generateCoverAi}
    onDownload={downloadCover}
  />
  const exportStep = <TalkExportStep
    coverPanel={coverPanel}
    issues={issues}
    exporting={!!exporting}
    exportedUrl={trackedTask?.downloadUrl}
    exportStatus={exporting ? exportStatus : undefined}
    onExport={requestExport}
    onDownload={() => { if (trackedTask?.downloadUrl) downloadUrl(trackedTask.downloadUrl, trackedTask.fileName || `${doc.name}.mp4`) }}
    onBack={() => setStage('edit')}
    onOpenAdvanced={() => setAdvancedOpen(true)}
  />
  const step = stage === 'content' ? contentStep : stage === 'visual' ? visualStep : stage === 'voice' ? voiceStep : stage === 'generate' ? generateStep : stage === 'export' ? exportStep : editStep
  return <div className="ipt-workspace ipt-workspace--v2" data-stage={stage} data-testid="ip-talk-workspace" onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={event => { if (!event.dataTransfer.files.length) return; event.preventDefault(); requestFiles(Array.from(event.dataTransfer.files)) }}>
    <TalkProjectToolbar targets={toolbarTargets} drafts={project.drafts} saveState={project.saveState} saveError={project.saveState === 'unsaved' && !!project.error} busy={working || exporting || templateBlocked} hasResult={hasResult} exporting={exporting} canExport={!issues.length} onOpen={id => void run(() => project.open(id))} onNew={() => void run(project.create)} onRename={() => { setName(doc.name); setRenameOpen(true) }} onDelete={() => setConfirmAction({ title: '删除本机作品', message: `将删除「${doc.name}」的编辑工程。已下载文件和视频工厂作品不受影响，此操作无法撤销。`, label: '删除作品', run: project.remove })} onSaveTemplate={() => setSaveTemplateOpen(true)} onOpenAdvancedSettings={() => setAdvancedOpen(true)} onRetrySave={() => void run(project.flush)} onExport={requestExport} />
    <TalkPipelineRail stage={stage} hasResult={hasResult} hasDuration={hasDuration} canGenerate={canGenerate} contentReady={contentReady} voiceReady={voiceReady} busy={working || exporting || templateBlocked} onSelect={selectStage} onOpenAdvanced={() => setAdvancedOpen(true)} />
    <input ref={fileRef} type="file" multiple hidden accept="audio/*,video/*,image/png,image/jpeg,image/webp,.srt" onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; requestFiles(files) }} />
    {creation.busy ? <section className="ipt-sticky-progress" role="status" aria-live="polite"><LoaderCircle className="animate-spin" size={16} /><div><strong>{creation.stageLabel}</strong><span>{t('creationProgress')}</span></div><Button variant="ghost" size="sm" onClick={creation.cancel}>{t('cancel')}</Button></section> : null}
    {stage !== 'export' && exportStatus}
    {stage === 'edit' ? <fieldset className="ipt-edit-fieldset" disabled={working || exporting}>{step}</fieldset> : <div className="ipt-flow-layout" data-stage={stage}>
      <section className="ipt-flow-preview" aria-label={t('preview')}>{preview}</section>
      <ColumnDivider className="ipt-flow-divider" previewSelector=".ipt-flow-preview" widthVariable="--ipt-flow-preview-width" defaultWidth={560} minWidth={360} minMainWidth={380} maxPreviewRatio={0.72} label={t('resizeDivider')} />
      <div className="ipt-flow-panel">{step}</div>
    </div>}
    <TalkAiImageDialog open={aiImageOpen} onOpenChange={setAiImageOpen} defaultPrompt={(brief || state.creation?.brief || state.script || '口播视频人物画面，干净背景，半身').slice(0, 300)} disabled={working || exporting} onGenerate={generateAiImage} />
    <TalkAdvancedSettingsDialog
      open={advancedOpen}
      onOpenChange={setAdvancedOpen}
      busy={working || exporting}
      options={effectiveOptions}
      onOptionsChange={next => {
        if (next.ratio !== 'auto' && next.ratio !== effectiveOptions.ratio) {
          const ratio = next.ratio
          editTalk(editor, 'canvas-ratio', current => setTalkRatio(current, ratio))
          next = { ...next, preserve: { ...next.preserve, composition: true } }
        }
        changeOptions(next)
      }}
      persona={persona}
      script={state.script}
      onScriptChange={scripts.onChange}
      onScriptCommit={scripts.onCommit}
      hasResult={hasResult}
      onUseDigital={() => { setAdvancedOpen(false); setDigitalOpen(true) }}
      onUseAudio={() => { setAdvancedOpen(false); setAudioOpen(true) }}
      onUploadAudio={() => { setAdvancedOpen(false); openFiles('audio/*') }}
      onRebuild={() => { setAdvancedOpen(false); make('create', `${state.creation?.brief ?? brief}\n${adjustment}`) }}
      onReset={resetAdvanced}
      changedCount={Number(effectiveOptions.scriptMode !== 'auto') + Number(!!effectiveOptions.captionPresetId) + Number(effectiveOptions.motion !== 'auto') + Object.values(effectiveOptions.preserve).filter(Boolean).length}
    />
    <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
      <DialogContent className="ipt-library-dialog ipt-library-dialog--styles"><DialogHeader><DialogTitle>{t('lookStrip')}</DialogTitle><DialogDescription>{t('lookStripHint')}</DialogDescription></DialogHeader>
        {libraryOpen && <TalkTemplateLibrary owner={owner} busy={working || exporting} livePreview onBlockingChange={setTemplateBlocked} onError={onError} onApplied={name => { toastSuccess(t('templateApplied', { name })); setLibraryOpen(false) }} />}
      </DialogContent>
    </Dialog>
    <TalkTemplateSaveDialog owner={owner} open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen} busy={working || exporting} onError={onError} onSaved={() => toastSuccess(t('styleSaved'))} />
    <Dialog open={voiceReviewOpen} onOpenChange={value => { if (!working) setVoiceReviewOpen(value) }}><DialogContent className="ipt-library-dialog"><DialogHeader><DialogTitle>{inputs.hasAudio ? '检查文稿并重新配音' : '检查文稿并配音'}</DialogTitle><DialogDescription>确认后会提交正式配音任务，费用由服务端结算。更换字体、画面或镜头不会自动重新配音。</DialogDescription></DialogHeader><label className="ipt-field">将要朗读的文稿<Textarea className="ipt-voice-review" value={state.script} maxLength={12000} onChange={event => editTalk(editor, 'script', current => updateScript(current, event.target.value))} /></label>{voiceReviewControls}<p className="ipt-help">{inputs.hasAudio ? '当前声音会保留到新配音完成后，再替换为新版本。' : '如果不想新生成，可以返回使用已有音频。'}</p><div className="ipt-inline-actions"><Button variant="toolbar" disabled={working} onClick={() => setVoiceReviewOpen(false)}>返回预览</Button><Button variant="generate" disabled={working || !state.script.trim() || !state.voiceId || creation.demo} onClick={submitReviewedAudio}>确认提交配音</Button></div></DialogContent></Dialog>
    <Dialog open={audioOpen} onOpenChange={setAudioOpen}><DialogContent className="ipt-library-dialog"><DialogHeader><DialogTitle>使用已有配音</DialogTitle><DialogDescription>复制已完成音频到本作品，不重新生成。导入后本作品独立保留一份素材。</DialogDescription></DialogHeader><div className="ipt-inline-actions"><Button variant="toolbar" size="sm" disabled={working} onClick={openAudioImport}>从本机导入音频</Button></div>{!audioTasks.length && <div className="ipt-empty"><strong>还没有已完成配音</strong><p>可以导入本机音频，或先去第 3 步生成配音。</p></div>}<div className="ipt-task-list">{audioTasks.map(task => <Button key={task.id} variant="ghost" disabled={working} onClick={() => { const action = async () => { await inputs.importTask(task); setAudioOpen(false) }; if (inputs.hasAudio) setConfirmAction({ title: '替换当前配音', message: '将使用选中的已有配音替换当前声音。人工字幕时间会保留；新声音过短时会提示调整。可以撤销。', label: '使用此配音', run: action }); else void run(action) }}>{task.title}<span>{new Date(task.createdAt).toLocaleDateString()}</span></Button>)}</div></DialogContent></Dialog>
    <Dialog open={digitalOpen} onOpenChange={setDigitalOpen}><DialogContent className="ipt-library-dialog"><DialogHeader><DialogTitle>使用已有数字人成片</DialogTitle><DialogDescription>按勾选顺序组成视频，替换当前人物画面与声音，使用分段原文估时字幕。不会提交新的数字人生成任务。</DialogDescription></DialogHeader><div className="ipt-inline-actions"><Button variant="toolbar" size="sm" disabled={working} onClick={openVideoImport}>导入本机视频或照片</Button></div>{digitalProjects.length > 0 && <Select items={digitalProjects.map(p => ({ value: p.id, label: p.name }))} value={digitalId} onValueChange={id => { setDigitalId(String(id ?? '')); setVersionIds([]) }}><SelectTrigger><SelectValue placeholder="选择数字人作品" /></SelectTrigger><SelectContent>{digitalProjects.map(p => <SelectItem value={p.id} key={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>}<div className="ipt-task-list">{available.map(v => <Button key={v.id} variant="ghost" aria-pressed={versionIds.includes(v.id)} onClick={() => setVersionIds(ids => ids.includes(v.id) ? ids.filter(id => id !== v.id) : [...ids, v.id])}>{versionIds.includes(v.id) ? `${versionIds.indexOf(v.id) + 1}. ` : ''}{v.label}</Button>)}{!available.length && <div className="ipt-empty"><strong>没有可用数字人成片</strong><p>可以导入本机视频，或先去数字人页面生成。</p></div>}</div><Button disabled={!versionIds.length || working} onClick={() => void run(importDigital)}>使用选中分段</Button></DialogContent></Dialog>
    <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent><DialogHeader><DialogTitle>作品名称</DialogTitle></DialogHeader><Input value={name} maxLength={80} onChange={event => setName(event.target.value)} aria-label="作品名称" /><Button disabled={!name.trim() || working} onClick={() => { editTalk(editor, 'rename', current => ({ ...current, name: name.trim() })); setRenameOpen(false) }}>保存名称</Button></DialogContent></Dialog>
    <Dialog open={!!confirmAction} onOpenChange={value => { if (!value && !inputs.busy) setConfirmAction(null) }}><DialogContent><DialogHeader><DialogTitle>{confirmAction?.title}</DialogTitle><DialogDescription>{confirmAction?.message}</DialogDescription></DialogHeader>{confirmAction?.detail}<div className="ipt-inline-actions"><Button variant="toolbar" disabled={inputs.busy} onClick={() => setConfirmAction(null)}>返回</Button><Button disabled={inputs.busy} onClick={() => { const action = confirmAction; setConfirmAction(null); if (action) void run(action.run) }}>{confirmAction?.label}</Button></div></DialogContent></Dialog>
  </div>
}
