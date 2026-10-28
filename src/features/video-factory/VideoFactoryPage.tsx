/**
 * 视频工厂页面
 *
 * 纯浏览器剪辑台：左库（素材 / 镜头库 / 音效）→ 中舞台 → 右属性 → 下多轨时间轴。
 * 全程复用 `@no996/video-editor` 的同一工程模型、命令系统与渲染管线，
 * 不另造编辑器、时间轴或状态。
 */

import {
  memo,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Loader2,
  Search,
  X,
  Film,
  Sparkles,
  Music,
  Sliders,
  Type,
  Clock,
  AudioWaveform,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@no996/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  EditorProvider,
  PlayerSurface,
  TimelinePanel,
  InspectorPanel,
  MediaPanel,
  CaptionsPanel,
  TimingPanel,
  ShotLibraryPanel,
  SfxLibraryPanel,
  AudioEnvelopePanel,
  KeyboardShortcutsPopover,
  CanvasRatioControl,
  IconTimelineBeatDetect,
  IconTimelineSaveDirty,
  IconTimelineSaveOk,
  IconTimelineSnap,
  usePlayback,
  type ShotDefinition,
  SetCanvasRatioCommand,
  type CanvasRatio,
  type EditorDocument,
  type EditorInstance,
  type MediaAddToTimelineResult,
  type ProjectAsset,
} from '@no996/video-editor'
import {
  readStudioPanelPrefs,
  useStudioLayout,
  writeStudioPanelPrefs,
} from './lib/use-studio-layout.ts'
import { persistTimelineHeight, useTimelineHeight } from './lib/use-timeline-height.ts'
import { useStudioRailWidths } from './lib/use-rail-widths.ts'
import {
  Page,
  Notice,
  WorkbenchPageChromeActions,
  WorkbenchToolPageHeaderTools,
} from '../../components/WorkbenchUI'
import { useAuth } from '../../auth/AuthContext'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../services/workbench-tasks'
import { listVoices } from '../../api/voice-clone'
import { demoPlatformVoices } from '../../api/workbench-ai'
import type { VoiceOption } from './lib/synthesize-voice'
import {
  VideoFactoryAiQuickButton,
  VideoFactoryPageChrome,
  VideoFactoryPanelChromeToggle,
  exportDocumentJson,
} from './FactoryToolbar'
const QuickAssemblyWizard = lazy(() => import('./QuickAssemblyWizard').then(m => ({ default: m.QuickAssemblyWizard })))
const ExportPanel = lazy(() => import('@no996/video-editor/panels/export/ExportPanel.tsx').then(m => ({ default: m.ExportPanel })))
import { VoiceLibraryImportControl } from './VoiceLibraryImportControl'
import { VfOverlayPortal } from './VfOverlayPortal'
import { useFactoryProject } from './lib/use-factory-project'
import { insertAudioIntoEditor } from './lib/insert-audio'
import { insertAudioElement, audioAssetUrl } from '@no996/video-editor'
import { getShotDisplayName } from '../../../packages/video-editor/src/demos/localization.ts'
import { uploadAsset } from './lib/upload-asset'
import { usePreviewAudio } from './lib/use-preview-audio'
import { useAssetMediaCache } from '../../lib/video-editor/use-asset-media-cache.ts'
import { mapPlaybackToSourceTimeUs } from '@no996/video-editor/core/speed/mapping.ts'
import { deleteLibraryAsset } from './lib/delete-library-asset.ts'
import { detectBeatsFromBlob, type BeatAnalysis } from './lib/beat-detect'
import { buildDemoDocument } from './lib/demo-document'
import { notifyVideoFactory } from './lib/page-notice'
import { useNotifyOperationMessage } from '../../lib/toast'
import { useZoom } from '../../app/ZoomProvider.tsx'
import {
  VF_LAYOUT_MIN_WIDTH_PX,
  useStudioViewportGate,
} from './lib/studio-viewport.ts'
import { createAssetResolver, createAudioBlobResolver } from './lib/export-asset-resolver.ts'
import { useVideoExportEnqueue } from './lib/use-video-export-enqueue.ts'
import { loadCaptionFont } from '../ip-video/editor/caption-fonts.ts'
import '../../styles/video-factory.css'

type LeftTab = 'media' | 'shots' | 'audio'
type RightTab = 'inspector' | 'captions' | 'timing' | 'audio-env'

export default function VideoFactoryPage() {
  const { t } = useTranslation('videoFactory')
  const { userId } = useAuth()
  const [params, setParams] = useSearchParams()
  const project = useFactoryProject(userId)
  useNotifyOperationMessage(project.error || undefined, 'error', 'video-factory-project-error')

  const [leftTab, setLeftTab] = useState<LeftTab>('shots')
  const [rightTab, setRightTab] = useState<RightTab>('inspector')
  const [exportOpen, setExportOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [exporting] = useState(false)

  // 配音：复用 IP 口播视频已上线的 TTS 任务链路。
  // 音色优先取真实平台列表；拿不到时（演示模式 / 未接后端）退回演示音色，
  // 但界面上会说明「演示」，不会假装已经接通。
  const voiceActions = useWorkbenchTaskActions()
  const ipAudioTasks = useWorkbenchTasks({ kind: 'ip_video_audio' })
  const [remoteVoices, setRemoteVoices] = useState<VoiceOption[]>([])
  useEffect(() => {
    if (userId == null || !wizardOpen) return
    let active = true
    void listVoices()
      .then((result) => {
        if (!active) return
        const ready = (result.data ?? [])
          .filter((item) => item.ready_for_synthesis)
          .map((item) => ({ id: item.voice_id, label: item.display_name || item.voice_id }))
        setRemoteVoices(ready.length ? ready : demoPlatformVoices())
      })
      .catch(() => {
        if (active) setRemoteVoices(demoPlatformVoices())
      })
    return () => {
      active = false
    }
  }, [userId, wizardOpen])
  const voiceOptions = remoteVoices

  /** 按 id 查任务：任务列表已由 useWorkbenchTasks 订阅，切页/刷新都能看到 */
  const getTaskById = useCallback(
    async (taskId: string) => ipAudioTasks.find((task) => task.id === taskId) ?? null,
    [ipAudioTasks],
  )
  const [loop, setLoop] = useState(false)
  const importHandled = useRef(false)
  const initialPanels = useMemo(() => readStudioPanelPrefs(), [])
  const [leftCollapsed, setLeftCollapsed] = useState(initialPanels.leftCollapsed)
  const [rightCollapsed, setRightCollapsed] = useState(initialPanels.rightCollapsed)

  useEffect(() => {
    const handleFocusInspector = () => {
      setRightCollapsed(false)
      setRightTab('inspector')
    }
    const handleFocusCaptions = () => {
      setRightCollapsed(false)
      // 选中字幕时优先打开属性（外观），字幕页仍可选手动切
      setRightTab('inspector')
    }
    window.addEventListener('video-factory:focus-inspector', handleFocusInspector)
    window.addEventListener('video-factory:focus-captions', handleFocusCaptions)
    return () => {
      window.removeEventListener('video-factory:focus-inspector', handleFocusInspector)
      window.removeEventListener('video-factory:focus-captions', handleFocusCaptions)
    }
  }, [])
  const [timelineCollapsed, setTimelineCollapsed] = useState(initialPanels.timelineCollapsed)

  useEffect(() => {
    writeStudioPanelPrefs({
      ...readStudioPanelPrefs(),
      leftCollapsed,
      rightCollapsed,
      timelineCollapsed,
    })
  }, [leftCollapsed, rightCollapsed, timelineCollapsed])

  // 从 IP 口播视频「继续精修」进来时，带入其镜头与音频
  useEffect(() => {
    const importId = params.get('import')
    if (!importId || importHandled.current || !userId) return
    importHandled.current = true
    void (async () => {
      try {
        const doc = await loadImportedDocument(importId, userId)
        if (!doc) {
          notifyVideoFactory('未找到可导入的口播工程，已保留当前工程')
          return
        }
        project.editor?.setDocument(doc)
        notifyVideoFactory('已从 IP 口播视频导入镜头与音频')
      } catch {
        notifyVideoFactory('导入口播工程失败')
      } finally {
        params.delete('import')
        setParams(params, { replace: true })
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, userId, project.editor])

  const handlePickShot = useCallback(
    (shot: ShotDefinition) => {
      const trackName = project.insertShot(shot)
      if (trackName) {
        notifyVideoFactory(`已添加到「${trackName}」：${getShotDisplayName(shot)}`)
      } else {
        notifyVideoFactory(`添加镜头失败：${getShotDisplayName(shot)}`)
      }
    },
    [project],
  )

  const handlePickAudio = useCallback(
    async (payload: { kind: 'sfx' | 'bgm'; item: { label: string; path: string } }) => {
      if (!project.editor) return
      try {
        const url = audioAssetUrl(payload.item.path)
        const response = await fetch(url)
        if (!response.ok) throw new Error(`素材加载失败（HTTP ${response.status}）`)
        const blob = await response.blob()
        const doc = project.editor.getDocument()
        await insertAudioIntoEditor(
          project.editor,
          {
            blob,
            name: payload.item.label,
            startUs: project.editor.getPlayheadUs(),
            trackName: payload.kind === 'bgm' ? '背景音乐' : '音效',
            saveBlob: project.saveAssetBlob,
          },
        )
        notifyVideoFactory(`已添加${payload.kind === 'bgm' ? '音乐' : '音效'}：${payload.item.label}`)
        void doc
      } catch (error) {
        notifyVideoFactory(`音频插入失败：${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [project],
  )

  /** 音效/音乐拖上时间轴 */
  const handleDropAudio = useCallback(
    async (input: {
      trackId: string
      audioKind: 'sfx' | 'bgm'
      label: string
      path: string
      startUs: number
    }) => {
      if (!project.editor) return
      try {
        await handleMediaDropAudio(project.editor, input, project.saveAssetBlob)
        notifyVideoFactory(`已添加${input.audioKind === 'bgm' ? '音乐' : '音效'}：${input.label}`)
      } catch (error) {
        notifyVideoFactory(`音频插入失败：${error instanceof Error ? error.message : String(error)}`)
      }
    },
    [project],
  )

  const handleReset = useCallback(() => {
    if (!project.editor || !project.activeDoc) return
    const doc = buildDemoDocument(project.activeDoc.scope, project.activeDoc.canvas.ratio)
    // 重置示例只替换内容，不换工程 id：否则每次重置都会在本地多存一个工程，很快撞上限
    project.editor.setDocument({
      ...doc,
      id: project.activeDoc.id,
      name: project.activeDoc.name,
    })
    notifyVideoFactory('已载入演示工程（演示内容，非真实产物）')
  }, [project])

  const handleImportJson = useCallback(
    (doc: EditorDocument) => {
      project.editor?.setDocument(doc)
      notifyVideoFactory('工程已导入')
    },
    [project.editor],
  )

  const handleMediaAddToTimeline = useCallback((result: MediaAddToTimelineResult) => {
    const { asset, trackName, createdTrack } = result
    const kindLabel = asset.mimeType.startsWith('audio')
      ? '音频'
      : asset.mimeType.startsWith('video')
        ? '视频'
        : '图片'
    let message = `已添加${kindLabel}：${asset.name}`
    if (createdTrack) {
      message += `（已新建「${trackName}」）`
    }
    notifyVideoFactory(message)
  }, [])

  const handleMediaTimelineNotice = useCallback((message: string) => {
    notifyVideoFactory(message)
  }, [])

  const pageChromeActions =
    userId != null ? (
      <WorkbenchPageChromeActions>
        <VideoFactoryPageChrome
          editor={project.editor}
          draftList={project.draftList}
          activeDoc={project.activeDoc}
          rightPanelToggle={
            <VideoFactoryPanelChromeToggle
              side="right"
              collapsed={rightCollapsed}
              onToggle={() => setRightCollapsed((prev) => !prev)}
            />
          }
          onOpenDraft={(id) => void project.openDraft(id)}
          onCreateDraft={() => void project.createDraft(`未命名成片 ${project.draftList.length + 1}`)}
          onRenameDraft={(name) => {
            if (project.activeDoc) void project.renameDraft(project.activeDoc.id, name)
          }}
          onDeleteDraft={() => {
            if (project.activeDoc) void project.deleteDraft(project.activeDoc.id)
          }}
          onExport={() => setExportOpen(true)}
          onExportJson={() => {
            if (project.activeDoc) exportDocumentJson(project.activeDoc)
          }}
          onImportJson={handleImportJson}
          onReset={handleReset}
          exporting={exporting}
        />
      </WorkbenchPageChromeActions>
    ) : undefined

  const pageTitleExtra =
    userId != null ? (
      <WorkbenchToolPageHeaderTools>
        <VideoFactoryPanelChromeToggle
          side="left"
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((prev) => !prev)}
        />
        <VideoFactoryAiQuickButton
          disabled={!project.activeDoc}
          onClick={() => setWizardOpen(true)}
        />
      </WorkbenchToolPageHeaderTools>
    ) : undefined

  return (
    <Page
      title={t('title')}
      description={t('subtitle')}
      moduleId="video-factory"
      defaultWidth={1600}
      minWidth={1280}
      edgeBudget={0}
      enableContentWidthHandles={false}
      chrome="workbench-tool"
      titleExtra={pageTitleExtra}
      actions={pageChromeActions}
    >
      {userId == null ? (
        <Notice>{t('loginRequired')}</Notice>
      ) : (
        <div className="vf-studio vf-studio--immersive" data-testid="video-factory-studio">
          {project.editor && project.activeDoc ? (
            <EditorProvider editor={project.editor}>
              <StudioBody
                editor={project.editor}
                leftTab={leftTab}
                onLeftTab={setLeftTab}
                rightTab={rightTab}
                onRightTab={setRightTab}
                resolveAssetBlob={createAudioBlobResolver(project.editor!, project.getAssetBlob)}
                getAssetBlob={project.getAssetBlob}
                deleteAssetBlob={project.deleteAssetBlob}
                saveAssetBlob={project.saveAssetBlob}
                onPickShot={handlePickShot}
                onPickAudio={(payload) => void handlePickAudio(payload)}
                loop={loop}
                onToggleLoop={() => setLoop((prev) => !prev)}
                onUploadAsset={(file) => uploadAsset(project.editor!, file, { saveBlob: project.saveAssetBlob })}
                onDropAudio={(input) => handleDropAudio(input)}
                leftCollapsed={leftCollapsed}
                rightCollapsed={rightCollapsed}
                timelineCollapsed={timelineCollapsed}
                onToggleTimelineCollapsed={() => setTimelineCollapsed((prev) => !prev)}
                onExpandLeftPanel={() => setLeftCollapsed(false)}
                onExpandRightPanel={() => setRightCollapsed(false)}
                saveState={project.saveState}
                onNotice={notifyVideoFactory}
                onMediaAddToTimeline={handleMediaAddToTimeline}
                onMediaTimelineNotice={handleMediaTimelineNotice}
              />
            </EditorProvider>
          ) : (
            <p className="vf-banner">{t('loading')}</p>
          )}

          {wizardOpen && project.editor && project.activeDoc ? (
            <Suspense fallback={<p className="vf-banner" role="status">正在加载创作向导…</p>}><QuickAssemblyWizard
              editor={project.editor}
              doc={project.activeDoc}
              voices={voiceOptions}
              voiceActions={voiceActions}
              getTask={getTaskById}
              saveAssetBlob={project.saveAssetBlob}
              onDone={notifyVideoFactory}
              onClose={() => setWizardOpen(false)}
            /></Suspense>
          ) : null}

          {exportOpen && project.activeDoc && project.editor ? (
            <VfOverlayPortal>
            <div className="vf-modal" role="dialog" aria-modal="true" aria-label="导出成片">
              <div className="vf-modal__panel">
                <div className="vf-modal__head">
                  <div className="vf-modal__head-title">
                    <h2>导出成片</h2>
                    <span className="vf-modal__tier-badge">体验版</span>
                  </div>
                  <button
                    type="button"
                    className="vf-iconbtn"
                    onClick={() => setExportOpen(false)}
                    aria-label="关闭"
                  >
                    ×
                  </button>
                </div>
                <Suspense fallback={<p role="status">正在加载导出功能…</p>}><VideoFactoryExportPanel
                  editor={project.editor}
                  getAssetBlob={project.getAssetBlob}
                  ownerScope={userId != null ? String(userId) : ''}
                  flushSave={project.flushSave}
                /></Suspense>
              </div>
            </div>
            </VfOverlayPortal>
          ) : null}
        </div>
      )}
    </Page>
  )
}

function VideoFactoryExportPanel({
  editor,
  getAssetBlob,
  ownerScope,
  flushSave,
}: {
  editor: EditorInstance
  getAssetBlob: (blobId: string) => Promise<Blob | null>
  ownerScope: string
  flushSave: () => Promise<void>
}) {
  const { onEnqueue, trackedTask } = useVideoExportEnqueue({
    editor,
    ownerScope,
    source: 'video-factory',
    beforeEnqueue: flushSave,
  })
  return (
    <ExportPanel
      editor={editor}
      assetResolver={createAssetResolver(editor, getAssetBlob)}
      assetChecker={async (assetId) => Boolean(editor.getDocument().assets[assetId])}
      audioBlobResolver={createAudioBlobResolver(editor, getAssetBlob)}
      onEnqueue={onEnqueue}
      trackedTask={trackedTask}
    />
  )
}

/* ───────────────────────── 三栏主体 ───────────────────────── */

function StudioBody({
  editor,
  leftTab,
  onLeftTab,
  rightTab,
  onRightTab,
  resolveAssetBlob,
  getAssetBlob,
  deleteAssetBlob,
  saveAssetBlob,
  onPickShot,
  onPickAudio,
  loop,
  onToggleLoop,
  onUploadAsset,
  onDropAudio,
  leftCollapsed,
  rightCollapsed,
  timelineCollapsed,
  onToggleTimelineCollapsed,
  onExpandLeftPanel,
  onExpandRightPanel,
  saveState,
  onNotice,
  onMediaAddToTimeline,
  onMediaTimelineNotice,
}: {
  editor: EditorInstance
  leftTab: LeftTab
  onLeftTab: (tab: LeftTab) => void
  rightTab: RightTab
  onRightTab: (tab: RightTab) => void
  resolveAssetBlob: (assetId: string) => Promise<Blob | null>
  getAssetBlob: (blobId: string) => Promise<Blob | null>
  deleteAssetBlob: (blobId: string) => Promise<void>
  saveAssetBlob: (blobId: string, blob: Blob) => Promise<void>
  onPickShot: (shot: ShotDefinition) => void
  onPickAudio: (payload: { kind: 'sfx' | 'bgm'; item: { label: string; path: string } }) => void
  loop: boolean
  onToggleLoop: () => void
  onUploadAsset: (file: File) => Promise<unknown>
  onDropAudio: (input: {
    trackId: string
    audioKind: 'sfx' | 'bgm'
    label: string
    path: string
    startUs: number
  }) => void | Promise<void>
  leftCollapsed: boolean
  rightCollapsed: boolean
  timelineCollapsed: boolean
  onToggleTimelineCollapsed: () => void
  onExpandLeftPanel: () => void
  onExpandRightPanel: () => void
  saveState: 'saved' | 'saving' | 'unsaved'
  onNotice: (message: string) => void
  onMediaAddToTimeline: (result: MediaAddToTimelineResult) => void
  onMediaTimelineNotice: (message: string) => void
}) {
  const { playheadUs, isPlaying, togglePlay, seek } = usePlayback()
  const { t } = useTranslation('videoFactory')

  // 预览音频：与工程里的音频元素同步混音播放，导出走同一个混音器
  const [docForAudio, setDocForAudio] = useState(() => editor.getDocument())
  useEffect(() => {
    return editor.subscribe(() => setDocForAudio(editor.getDocument()))
  }, [editor])

  // 节拍网格：默认关闭（吸附仍可对片段边界生效），用户主动点了才去解析音乐
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [beatAnalysis, setBeatAnalysis] = useState<BeatAnalysis | null>(null)
  const [beatAnalyzing, setBeatAnalyzing] = useState(false)
  const [beatError, setBeatError] = useState('')
  const beatPoints = beatAnalysis?.beatsUs ?? []

  /** 取第一条 BGM 音轨的元素，解码后算节拍网格 */
  const detectBeatGrid = useCallback(async () => {
    setBeatError('')
    setBeatAnalyzing(true)
    onNotice('正在检测节拍…')
    try {
      const audioElements = docForAudio.tracks
        .flatMap((track) => track.elements)
        .filter((element) => element.type === 'audio')
      const bgm = audioElements.find((element) => element.type === 'audio')
      if (!bgm || bgm.type !== 'audio') {
        const message = '先在时间轴上放一段音乐，再检测节拍'
        setBeatError(message)
        onNotice(message)
        return
      }
      const blob = await resolveAssetBlob(bgm.assetId)
      if (!blob) {
        const message = '取不到这段音频的文件'
        setBeatError(message)
        onNotice(message)
        return
      }
      const analysis = await detectBeatsFromBlob(blob)
      if (!analysis) {
        const message = '这段音频听不出稳定的节拍（可能是纯人声或环境音）'
        setBeatError(message)
        onNotice(message)
        setBeatAnalysis(null)
        return
      }
      // 节拍网格是相对音乐元素起点的，要整体平移到时间轴上
      const offsetUs = bgm.startUs
      setBeatAnalysis({
        ...analysis,
        firstBeatUs: analysis.firstBeatUs + offsetUs,
        beatsUs: analysis.beatsUs.map((t) => t + offsetUs),
      })
      setSnapEnabled(true)
      onNotice(`已检测节拍：≈${analysis.bpm} BPM，共 ${analysis.beatsUs.length} 拍`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setBeatError(message)
      onNotice(message)
    } finally {
      setBeatAnalyzing(false)
    }
  }, [docForAudio, onNotice, resolveAssetBlob])

  const previewAudio = usePreviewAudio({
    doc: docForAudio,
    isPlaying,
    playheadUs,
    resolveBlob: resolveAssetBlob,
  })

  const {
    resolveAssetSource,
    updatePreviewWindow,
    evictAsset,
    videoElementsRef,
    version: mediaVersion,
  } = useAssetMediaCache({ editor, getAssetBlob })

  useEffect(() => {
    updatePreviewWindow(docForAudio, playheadUs)
  }, [docForAudio, playheadUs, updatePreviewWindow])

  // Loading completes asynchronously; a new resolver causes the paused stage to redraw.
  const previewResolver = useMemo(() => (id: string) => resolveAssetSource(id), [resolveAssetSource, mediaVersion])

  useEffect(() => {
    const active = new Set<string>()
    for (const track of docForAudio.tracks) {
      if (track.hidden) continue
      for (const element of track.elements) {
        if (element.type !== 'video' || playheadUs < element.startUs || playheadUs >= element.startUs + element.durationUs) continue
        const video = videoElementsRef.current.get(element.assetId)
        if (!video) continue
        active.add(element.assetId)
        const target = Math.max(0, mapPlaybackToSourceTimeUs(element, playheadUs - element.startUs) / 1_000_000)
        video.playbackRate = element.rate || 1
        if (Math.abs(video.currentTime - target) > (isPlaying ? 0.12 : 0.015)) video.currentTime = Math.min(Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.001) : target, target)
        if (isPlaying && !element.freeze && !element.reverse) { if (video.paused) void video.play().catch(() => {}) } else video.pause()
      }
    }
    for (const [id, video] of videoElementsRef.current) if (!active.has(id)) video.pause()
  }, [docForAudio, playheadUs, isPlaying, mediaVersion, videoElementsRef])

  const handleUploadWithPreview = useCallback(
    async (file: File) => onUploadAsset(file),
    [onUploadAsset],
  )

  const handleDeleteLibraryAsset = useCallback(
    async (asset: ProjectAsset) => {
      const result = await deleteLibraryAsset({
        editor,
        asset,
        deleteBlob: deleteAssetBlob,
        onEvictPreviewCache: evictAsset,
      })
      if (!result.ok) {
        onMediaTimelineNotice('message' in result ? result.message : '删除素材失败，请重试')
        return
      }
      onMediaTimelineNotice(`已删除素材：${asset.name}`)
    },
    [editor, deleteAssetBlob, evictAsset, onMediaTimelineNotice],
  )

  const tabs = useMemo(
    () => [
      { id: 'media' as const, label: t('tabMedia') },
      { id: 'shots' as const, label: t('tabShots') },
      { id: 'audio' as const, label: t('tabAudio') },
    ],
    [t],
  )

  const rightTabs = useMemo(
    () => [
      { id: 'inspector' as const, label: t('rightInspector') },
      { id: 'captions' as const, label: t('rightCaptions') },
      { id: 'timing' as const, label: t('rightTiming') },
      { id: 'audio-env' as const, label: t('rightAudio') },
    ],
    [t],
  )

  const bodyRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const viewportGateActive = useStudioViewportGate(bodyRef)
  const { zoom } = useZoom()

  const onPersistTimelineHeight = useCallback((heightPx: number) => {
    persistTimelineHeight(heightPx)
  }, [])

  const { heightPx: timelineHeightPx, onResizePointerDown, isResizing } = useTimelineHeight(
    bodyRef,
    timelineCollapsed,
    onPersistTimelineHeight,
  )

  const {
    railWidths,
    railResizing,
    onLeftResizePointerDown,
    onRightResizePointerDown,
  } = useStudioRailWidths(mainRef, leftCollapsed, rightCollapsed)

  const layout = useStudioLayout(
    mainRef,
    docForAudio.canvas.width,
    docForAudio.canvas.height,
    leftCollapsed,
    rightCollapsed,
    0,
    railWidths.left,
    railWidths.right,
  )

  const timelinePlayback = useMemo(
    () => ({
      isPlaying,
      canPlay: docForAudio.durationUs > 0,
      loop,
      onTogglePlay: togglePlay,
      onToggleLoop,
      onSeek: seek,
    }),
    [isPlaying, docForAudio.durationUs, loop, togglePlay, onToggleLoop, seek],
  )

  const handleRatioChange = useCallback(
    (ratio: CanvasRatio) => {
      editor.executeCommand(new SetCanvasRatioCommand(ratio))
    },
    [editor],
  )

  const timelineExpandedStyle = timelineCollapsed
    ? undefined
    : ({
        height: timelineHeightPx,
        flex: `0 0 ${timelineHeightPx}px`,
      } as const)

  return (
    <div
      className="vf-body"
      ref={bodyRef}
      data-timeline-resizing={isResizing || undefined}
      data-rail-resizing={railResizing ?? undefined}
      data-viewport-gate={viewportGateActive || undefined}
    >
      {viewportGateActive ? (
        <div className="vf-viewport-gate" role="status" aria-live="polite">
          <div className="vf-viewport-gate__card">
            <p className="vf-viewport-gate__title">窗口宽度不足，暂时无法编辑</p>
            <p className="vf-viewport-gate__desc">
              请将浏览器窗口拉宽到至少 {VF_LAYOUT_MIN_WIDTH_PX}px，或将页面缩放恢复至 100% 后再操作。
              {zoom !== 100 ? `（当前缩放 ${zoom}%）` : ''}
            </p>
          </div>
        </div>
      ) : null}
      <div className="vf-main" ref={mainRef} style={layout.style}>
        <StudioLeft
          editor={editor}
          tabs={tabs}
          leftTab={leftTab}
          onLeftTab={onLeftTab}
          onUploadAsset={handleUploadWithPreview}
          getAssetBlob={getAssetBlob}
          onDeleteLibraryAsset={handleDeleteLibraryAsset}
          onPickShot={onPickShot}
          onPickAudio={onPickAudio}
          onMediaAddToTimeline={onMediaAddToTimeline}
          onMediaTimelineNotice={onMediaTimelineNotice}
          collapsed={leftCollapsed}
          onExpand={onExpandLeftPanel}
          onResizePointerDown={onLeftResizePointerDown}
          resizeHandleLabel={t('railResizeLeft')}
        />

        <section className="vf-center">
          <div className="vf-stage">
            <PlayerSurface
              className="vf-player vf-stage__player ve-player--no-transport"
              editor={editor}
              playheadUs={playheadUs}
              isPlaying={isPlaying}
              onTogglePlay={togglePlay}
              onSeek={seek}
              assetSourceResolver={previewResolver}
              loop={loop}
              onToggleLoop={onToggleLoop}
              compactViewport
              hideTransport
              stageSize={{ width: layout.stageWidthPx, height: layout.stageHeightPx }}
              onRatioChange={handleRatioChange}
              hideRatioControl
            />
            {(previewAudio.mixing || previewAudio.error) && (
              <p className="vf-audio-hint">
                {previewAudio.mixing ? '正在准备音频…' : `音频混音失败：${previewAudio.error}`}
              </p>
            )}
          </div>
        </section>

        <StudioRight
          editor={editor}
          rightTabs={rightTabs}
          rightTab={rightTab}
          onRightTab={onRightTab}
          // 只有字幕页需要逐帧播放头；其他页传 0，避免播放时整块属性面板重渲染
          playheadUs={rightTab === 'captions' ? playheadUs : 0}
          onSeek={seek}
          collapsed={rightCollapsed}
          onExpand={onExpandRightPanel}
          onResizePointerDown={onRightResizePointerDown}
          resizeHandleLabel={t('railResizeRight')}
          saveAssetBlob={saveAssetBlob}
        />
      </div>

      <div
        className="vf-timeline"
        data-collapsed={timelineCollapsed}
        style={timelineExpandedStyle}
      >
        {!timelineCollapsed ? (
          <div
            className="vf-timeline-resize"
            role="separator"
            aria-orientation="horizontal"
            aria-label={t('timelineResizeHandle')}
            onPointerDown={onResizePointerDown}
          />
        ) : null}
        <TimelinePanel
          editor={editor}
          variant="full"
          playheadUs={playheadUs}
          onSeek={seek}
          onDropAudio={onDropAudio}
          snapEnabled={snapEnabled}
          snapBeatPoints={beatPoints}
          collapsed={timelineCollapsed}
          onToggleCollapse={onToggleTimelineCollapsed}
          playback={timelinePlayback}
          toolbarSimplified
          toolbarExtras={
            <>
              <FactoryTimelineToolbarChrome
                canvasRatio={docForAudio.canvas.ratio}
                onRatioChange={handleRatioChange}
                saveState={saveState}
              />
              <BeatToolbarExtras
                analysis={beatAnalysis}
                analyzing={beatAnalyzing}
                snapEnabled={snapEnabled}
                onToggleSnap={() => setSnapEnabled((prev) => !prev)}
                onDetect={() => void detectBeatGrid()}
                error={beatError}
              />
            </>
          }
          style={
            timelineCollapsed
              ? { flex: '0 0 auto', minHeight: 0, height: 'auto' }
              : { flex: 1, minHeight: 0, height: 'auto' }
          }
        />
      </div>
    </div>
  )
}

/* ───────────────────────── 左右栏（播放时避免逐帧重渲染） ───────────────────────── */

type LeftTabDef = { id: LeftTab; label: string }
type RightTabDef = { id: RightTab; label: string }

function getLeftTabIcon(tabId: LeftTab) {
  switch (tabId) {
    case 'media':
      return <Film className="size-4" />
    case 'shots':
      return <Sparkles className="size-4" />
    case 'audio':
      return <Music className="size-4" />
    default:
      return null
  }
}

function getRightTabIcon(tabId: RightTab) {
  switch (tabId) {
    case 'inspector':
      return <Sliders className="size-4" />
    case 'captions':
      return <Type className="size-4" />
    case 'timing':
      return <Clock className="size-4" />
    case 'audio-env':
      return <AudioWaveform className="size-4" />
    default:
      return null
  }
}

/**
 * 左库面板：只依赖 tab 与编辑器。
 * 播放头每 1/30 秒推进时，父级会重渲染；这里用 memo 把 149 条音效 / 镜头库挡在外面。
 */
const StudioLeft = memo(function StudioLeft({
  editor,
  tabs,
  leftTab,
  onLeftTab,
  onUploadAsset,
  getAssetBlob,
  onDeleteLibraryAsset,
  onPickShot,
  onPickAudio,
  onMediaAddToTimeline,
  onMediaTimelineNotice,
  collapsed,
  onExpand,
  onResizePointerDown,
  resizeHandleLabel,
}: {
  editor: EditorInstance
  tabs: LeftTabDef[]
  leftTab: LeftTab
  onLeftTab: (tab: LeftTab) => void
  onUploadAsset: (file: File) => Promise<unknown>
  getAssetBlob: (blobId: string) => Promise<Blob | null>
  onDeleteLibraryAsset: (asset: ProjectAsset) => void | Promise<void>
  onPickShot: (shot: ShotDefinition) => void
  onPickAudio: (payload: { kind: 'sfx' | 'bgm'; item: { label: string; path: string } }) => void
  onMediaAddToTimeline: (result: MediaAddToTimelineResult) => void
  onMediaTimelineNotice: (message: string) => void
  collapsed: boolean
  onExpand: () => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  resizeHandleLabel: string
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <aside className="vf-left" data-collapsed={collapsed}>
      {collapsed ? (
        <div className="vf-panel-rail">
          <TooltipProvider>
            {tabs.map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="vf-iconbtn vf-panel-rail__btn"
                      data-active={leftTab === tab.id}
                      aria-label={tab.label}
                      onClick={() => {
                        onLeftTab(tab.id)
                        onExpand()
                      }}
                    >
                      {getLeftTabIcon(tab.id)}
                    </button>
                  }
                />
                <TooltipContent side="right">{tab.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      ) : (
        <>
          {/* 单行整合顶栏：Tabs + 搜索切换按钮 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 32,
              borderBottom: '1px solid var(--border)',
              background: 'var(--card)',
              padding: '0 4px',
              flexShrink: 0,
            }}
          >
            <div className="vf-tabs" role="tablist" style={{ borderBottom: 'none', flex: 1, minWidth: 0 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="vf-tabs__item"
                  data-active={leftTab === tab.id}
                  aria-selected={leftTab === tab.id}
                  onClick={() => onLeftTab(tab.id)}
                  style={{ padding: '6px 4px', fontSize: 11 }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
                type="button"
                onClick={() => {
                  setIsSearchOpen((prev) => !prev)
                  if (isSearchOpen) setSearchQuery('')
                }}
                className="vf-iconbtn"
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isSearchOpen ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                  color: isSearchOpen ? 'var(--primary)' : 'var(--muted-foreground)',
                  border: isSearchOpen ? '1px solid color-mix(in srgb, var(--primary) 35%, transparent)' : '1px solid transparent',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                  marginLeft: 4,
                  transition: 'all 0.15s ease',
                }}
                title={isSearchOpen ? '收起搜索' : '展开搜索'}
                aria-label={isSearchOpen ? '收起搜索' : '展开搜索'}
              >
                <Search className="size-3.5" />
              </button>
          </div>

          {/* 展开的轻量搜索行（高度仅 26px，不覆盖 Tabs） */}
          {isSearchOpen && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '3px 8px',
                background: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
                gap: 5,
                flexShrink: 0,
              }}
            >
              <Search className="size-3 text-muted-foreground shrink-0" style={{ opacity: 0.6 }} />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  leftTab === 'shots'
                    ? '搜索 151 个镜头动效…'
                    : leftTab === 'media'
                      ? '搜索素材名称…'
                      : '搜索音效与背景音乐…'
                }
                style={{
                  flex: 1,
                  height: 20,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 10.5,
                  color: 'var(--foreground)',
                }}
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--muted-foreground)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="清空搜索"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          )}

          <div className="vf-tabbody">
            {leftTab === 'media' && (
              <MediaPanel
                editor={editor}
                onUploadAsset={onUploadAsset as never}
                onAddToTimeline={onMediaAddToTimeline}
                onTimelineNotice={onMediaTimelineNotice}
                resolveAssetBlob={getAssetBlob}
                onDeleteAsset={onDeleteLibraryAsset}
                query={isSearchOpen ? searchQuery : ''}
              />
            )}
            {leftTab === 'shots' && (
              <ShotLibraryPanel
                onPick={onPickShot}
                hideSearchBar={true}
                query={isSearchOpen ? searchQuery : ''}
              />
            )}
            {leftTab === 'audio' && (
              <SfxLibraryPanel
                onPick={onPickAudio}
                hideSearchBar={true}
                query={isSearchOpen ? searchQuery : ''}
              />
            )}
          </div>
          <div
            className="vf-rail-resize vf-rail-resize--left"
            role="separator"
            aria-orientation="vertical"
            aria-label={resizeHandleLabel}
            onPointerDown={onResizePointerDown}
          />
        </>
      )}
    </aside>
  )
})

/** 右属性面板：同样只跟 tab / 播放头（字幕页）变化。 */
const StudioRight = memo(function StudioRight({
  editor,
  rightTabs,
  rightTab,
  onRightTab,
  playheadUs,
  onSeek,
  collapsed,
  onExpand,
  onResizePointerDown,
  resizeHandleLabel,
  saveAssetBlob,
}: {
  editor: EditorInstance
  rightTabs: RightTabDef[]
  rightTab: RightTab
  onRightTab: (tab: RightTab) => void
  playheadUs: number
  onSeek: (timeUs: number) => void
  collapsed: boolean
  onExpand: () => void
  onResizePointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  resizeHandleLabel: string
  saveAssetBlob: (blobId: string, blob: Blob) => Promise<void>
}) {
  const voiceImportCaptions = (
    <VoiceLibraryImportControl
      editor={editor}
      saveBlob={saveAssetBlob}
      intent="captions"
    />
  )
  const voiceImportAudio = (
    <VoiceLibraryImportControl
      editor={editor}
      saveBlob={saveAssetBlob}
      intent="audio"
    />
  )

  return (
    <aside className="vf-right" data-collapsed={collapsed}>
      {collapsed ? (
        <div className="vf-panel-rail">
          <TooltipProvider>
            {rightTabs.map((tab) => (
              <Tooltip key={tab.id}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="vf-iconbtn vf-panel-rail__btn"
                      data-active={rightTab === tab.id}
                      aria-label={tab.label}
                      onClick={() => {
                        onRightTab(tab.id)
                        onExpand()
                      }}
                    >
                      {getRightTabIcon(tab.id)}
                    </button>
                  }
                />
                <TooltipContent side="left">{tab.label}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      ) : (
        <>
          <div
            className="vf-rail-resize vf-rail-resize--right"
            role="separator"
            aria-orientation="vertical"
            aria-label={resizeHandleLabel}
            onPointerDown={onResizePointerDown}
          />
          <div className="vf-tabs" role="tablist" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
              {rightTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className="vf-tabs__item"
                  data-active={rightTab === tab.id}
                  aria-selected={rightTab === tab.id}
                  onClick={() => onRightTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <KeyboardShortcutsPopover />
          </div>
          <div className="vf-right__scroll">
            {rightTab === 'inspector' && (
              <InspectorPanel editor={editor} loadCaptionFont={loadCaptionFont} />
            )}
            {rightTab === 'captions' && (
              <CaptionsPanel
                editor={editor}
                playheadUs={playheadUs}
                onSeek={onSeek}
                headerExtra={voiceImportCaptions}
                emptyExtra={voiceImportCaptions}
              />
            )}
            {rightTab === 'timing' && <TimingPanel editor={editor} />}
            {rightTab === 'audio-env' && (
              <AudioEnvelopePanel editor={editor} emptyActions={voiceImportAudio} />
            )}
          </div>
        </>
      )}
    </aside>
  )
})

/* ───────────────────────── 辅助 ───────────────────────── */


async function loadImportedDocument(projectId: string, userId: number): Promise<EditorDocument | null> {
  const { IndexedDBProjectRepository } = await import('@no996/video-editor/core/repository/indexeddb.ts')
  const repo = new IndexedDBProjectRepository()
  return repo.getProject(projectId, String(userId))
}

/**
 * 音效/音乐拖到时间轴后的落地：按路径取回 Blob，再插到指定轨道的落点。
 * 与点击插入共用同一条 insertAudioElement 链路，保证撤销、持久化行为一致。
 */
async function handleMediaDropAudio(
  editor: EditorInstance,
  input: {
    trackId: string
    audioKind: 'sfx' | 'bgm'
    label: string
    path: string
    startUs: number
  },
  saveBlob: (blobId: string, blob: Blob) => Promise<void>,
): Promise<void> {
  const response = await fetch(audioAssetUrl(input.path))
  if (!response.ok) throw new Error(`素材加载失败（HTTP ${response.status}）`)
  const blob = await response.blob()
  await insertAudioElement(
    editor,
    {
      trackId: input.trackId,
      blob,
      name: input.label,
      startUs: input.startUs,
      trackName: input.audioKind === 'bgm' ? '背景音乐' : '音效',
    },
    saveBlob,
  )
}



/** 画幅 + 自动保存态：自监视器叠层迁到时间轴顶栏右侧 */
function FactoryTimelineToolbarChrome({
  canvasRatio,
  onRatioChange,
  saveState,
}: {
  canvasRatio: CanvasRatio
  onRatioChange: (ratio: CanvasRatio) => void
  saveState: 'saved' | 'saving' | 'unsaved'
}) {
  const saveLabel =
    saveState === 'saved' ? '已自动保存' : saveState === 'saving' ? '保存中…' : '未保存'

  return (
    <div className="vf-timeline-chrome">
      <CanvasRatioControl value={canvasRatio} onChange={onRatioChange} placement="toolbar" />
      <button
        type="button"
        className="ve-timeline-btn vf-toolbar-save"
        data-state={saveState}
        aria-label={saveLabel}
        title={saveLabel}
      >
        {saveState === 'saving' ? (
          <Loader2 size={12} className="animate-spin" aria-hidden />
        ) : saveState === 'unsaved' ? (
          <IconTimelineSaveDirty size={12} />
        ) : (
          <IconTimelineSaveOk size={12} />
        )}
      </button>
    </div>
  )
}

/**
 * 节拍 / 磁吸：收进时间轴顶栏的小按钮。
 * 节拍网格须用户主动检测后才加入吸附（弱节拍上 BPM 可能偏差）。
 */
function BeatToolbarExtras({
  analysis,
  analyzing,
  snapEnabled,
  onToggleSnap,
  onDetect,
  error,
}: {
  analysis: BeatAnalysis | null
  analyzing: boolean
  snapEnabled: boolean
  onToggleSnap: () => void
  onDetect: () => void
  error: string
}) {
  const snapTitle = snapEnabled
    ? analysis
      ? `磁吸已开 · ≈${analysis.bpm} BPM · ${analysis.beatsUs.length} 拍`
      : '磁吸已开（片段边界与播放头）'
    : '磁吸已关'
  const beatTitle = error
    ? error
    : analyzing
      ? '正在检测节拍…'
      : analysis
        ? `已检测 ≈${analysis.bpm} BPM（点此重测）`
        : '检测音乐节拍（需时间轴上有音乐）'

  return (
    <>
      <button
        type="button"
        className="ve-timeline-btn vf-beat-tool"
        data-active={snapEnabled ? 'true' : undefined}
        onClick={onToggleSnap}
        title={snapTitle}
        aria-label={snapEnabled ? '关闭磁吸' : '开启磁吸'}
        aria-pressed={snapEnabled}
      >
        <IconTimelineSnap />
      </button>
      <button
        type="button"
        className="ve-timeline-btn vf-beat-tool"
        data-active={analysis ? 'true' : undefined}
        onClick={onDetect}
        disabled={analyzing}
        title={beatTitle}
        aria-label="检测音乐节拍"
      >
        {analyzing ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : (
          <IconTimelineBeatDetect />
        )}
      </button>
    </>
  )
}
