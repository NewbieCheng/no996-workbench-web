import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Page,
  WorkbenchPageChromeActions,
  WorkbenchToolPageHeaderTools,
} from '../../components/WorkbenchUI'
import { createSpeech } from '../../api/tts'
import { resolveMediaUrl } from '../../api/media'
import type { VoiceCloneRecord } from '../../api/voice-clone'
import { ApiError } from '../../api/errors'
import { apiErrorMessage } from '../../api/client'
import {
  useRegisterVoiceListStale,
  useWorkbenchTaskActions,
  useWorkbenchTasks,
  type VoiceDubAdvancedPayload,
} from '../../services/workbench-tasks'
import { sanitizeManuscriptForVoice } from './lib/manuscript-sanitize'
import { platformVoiceItems, ttsDemoText, voicePreviewText } from './voice-constants'
import { localizeVoiceDubStages } from './voice-i18n'
import { useVoiceCatalog } from './hooks/useVoiceCatalog'
import { useTtsSession, type TtsParams } from './hooks/useTtsSession'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import { WorkbenchDevToolsMenu } from '../../components/WorkbenchDevToolsMenu'
import { AgentFlowExplain } from '../../components/agent/AgentFlowExplain'
import { snapshotToMeta } from '../../agent/sink'
import type { AgentRunSnapshot } from '../../agent'
import { findVoiceLabel, isVoiceSelectable } from './components/VoiceRail'
import { VoiceManuscriptCard } from './components/VoiceManuscriptCard'
import { VoicePickerColumn } from './components/VoicePickerColumn'
import { VoiceRightDock } from './components/VoiceRightDock'
import { VoicePageViewTabs, type VoicePageView } from './components/VoicePageViewTabs'
import { VoiceManagePanel } from './components/VoiceManagePanel'
import { VoiceCloneDialog } from './components/VoiceCloneDialog'
import { VoiceDubWorkspace } from './components/VoiceDubWorkspace'
import {
  VoiceAdvancedDubView,
  type VoiceAdvancedDubDevHandles,
} from './components/VoiceAdvancedDubView'
import {
  isCloneJobHandled,
  isVoiceReadyNotified,
  markCloneJobHandled,
  markVoiceReadyNotified,
} from './lib/voice-ready-cache'
import { GenerationList } from './components/GenerationList'
import type { TonePreset } from './components/VoiceSideControl'
import { toastError, toastInfo, toastSuccess, toastTaskEnqueued } from '../../lib/toast'
import {
  evictVoicePreviewCache,
  evictVoicePreviewCacheKey,
  getVoicePreviewCachedUrl,
  isVoicePreviewPlaybackError,
  playVoicePreviewOnAudio,
  setVoicePreviewCachedUrl,
  voicePreviewCacheKey,
} from './lib/voice-preview-cache'
import { TTS_PITCH, TTS_RATE, TTS_VOLUME } from './voice-constants'
import type { VoiceDubAdvancedConfig, VoiceDubSegment } from './agent/types'
import './voice.css'

const DEFAULT_VOICE = 'longanlingxin'

export default function VoicePage() {
  const { t: tw, i18n } = useTranslation('workbench')
  const { t } = useTranslation('voice')
  const isEn = i18n.language?.startsWith('en')
  const voiceFlowStages = useMemo(() => localizeVoiceDubStages(t), [t, i18n.language])
  const [pageView, setPageView] = useState<VoicePageView>('work')
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [dubSubMode, setDubSubMode] = useState<'direct' | 'advanced'>('direct')
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE)
  const [text, setText] = useState('')
  const [directTone, setDirectTone] = useState<TonePreset>('自然')
  const [ttsParams, setTtsParams] = useState<TtsParams>({
    rate: TTS_RATE.default,
    volume: TTS_VOLUME.default,
    pitch: TTS_PITCH.default,
    instruction: '',
  })
  const [cloneBusy, setCloneBusy] = useState(false)
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [cloneWizardSession, setCloneWizardSession] = useState(0)
  const [previewBusy, setPreviewBusy] = useState(false)
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [renameBusy, setRenameBusy] = useState(false)
  const [enqueueBusy, setEnqueueBusy] = useState(false)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const advancedDevRef = useRef<VoiceAdvancedDubDevHandles | null>(null)

  const catalog = useVoiceCatalog()
  const loadVoices = catalog.loadVoices
  const tts = useTtsSession()

  const ttsJobs = useWorkbenchTasks({ kind: 'voice_tts' })
  const advancedJobs = useWorkbenchTasks({ kind: 'voice_dub_advanced' })
  const historyJobs = useMemo(() => {
    return [...ttsJobs, ...advancedJobs]
      .filter((j) => j.status !== 'queued' && j.status !== 'running')
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [ttsJobs, advancedJobs])

  const activeAdvancedJob = useMemo(() => {
    const inFlight = advancedJobs.find((j) => j.status === 'running' || j.status === 'queued')
    if (inFlight) return inFlight
    return advancedJobs.find((j) => j.meta?.awaiting_confirm === '1') ?? null
  }, [advancedJobs])

  const advancedInFlight = useMemo(
    () =>
      activeAdvancedJob &&
      (activeAdvancedJob.status === 'running' || activeAdvancedJob.status === 'queued')
        ? activeAdvancedJob
        : null,
    [activeAdvancedJob],
  )

  const [activeAdvancedPayload, setActiveAdvancedPayload] = useState<VoiceDubAdvancedPayload | null>(null)
  const [activeAdvancedLiveMeta, setActiveAdvancedLiveMeta] = useState<Record<string, string>>({})
  const [activeAdvancedBlobUrl, setActiveAdvancedBlobUrl] = useState<string | null>(null)

  const cloneJobs = useWorkbenchTasks({ kind: 'voice_clone' })
  const handledCloneSuccessRef = useRef(new Set<string>())

  const {
    enqueueVoiceTts,
    enqueueVoiceClone,
    enqueueVoiceDubAdvanced,
    removeTask,
    getVoicePlaybackUrl,
    getVoiceDownloadUrl,
    getVoiceEmbedFallbackUrl,
    getVoicePayload,
    getPayload,
    refreshTasks,
  } = useWorkbenchTaskActions()

  const mergedAdvancedMeta = useMemo(() => {
    return { ...(activeAdvancedJob?.meta ?? {}), ...activeAdvancedLiveMeta }
  }, [activeAdvancedJob?.meta, activeAdvancedLiveMeta])

  useEffect(() => {
    if (!activeAdvancedJob) {
      setActiveAdvancedPayload(null)
      setActiveAdvancedLiveMeta({})
      setActiveAdvancedBlobUrl(null)
      return
    }
    let cancelled = false
    void getPayload(activeAdvancedJob.payloadId).then((data) => {
      if (!cancelled) {
        const payload = data as VoiceDubAdvancedPayload
        setActiveAdvancedPayload(payload)
        if (payload?.run) {
          setActiveAdvancedLiveMeta(snapshotToMeta(payload.run as AgentRunSnapshot))
        }
      }
    })
    if (activeAdvancedJob.blobId) {
      void getVoicePlaybackUrl(activeAdvancedJob).then((url) => {
        if (!cancelled) setActiveAdvancedBlobUrl(url)
      })
    }
    return () => {
      cancelled = true
    }
  }, [activeAdvancedJob, getPayload, getVoicePlaybackUrl])

  useEffect(() => {
    if (!advancedInFlight) return
    let alive = true
    const poll = () => {
      void getPayload(advancedInFlight.payloadId).then((data) => {
        if (!alive) return
        const payload = data as VoiceDubAdvancedPayload
        setActiveAdvancedPayload(payload)
        if (payload?.run) {
          setActiveAdvancedLiveMeta(snapshotToMeta(payload.run as AgentRunSnapshot))
        }
      })
    }
    poll()
    const id = window.setInterval(poll, 400)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [advancedInFlight, getPayload])

  useEffect(() => {
    if (!advancedInFlight) return
    const id = window.setInterval(() => {
      void refreshTasks()
    }, 2000)
    return () => window.clearInterval(id)
  }, [advancedInFlight, refreshTasks])

  useRegisterVoiceListStale(loadVoices)

  useEffect(() => {
    const readyVoiceIds = catalog.voices
      .filter((v) => v.ready_for_synthesis)
      .map((v) => v.voice_id)
    if (readyVoiceIds.length) {
      markVoiceReadyNotified(readyVoiceIds)
    }
  }, [catalog.voices])

  useEffect(() => {
    for (const job of cloneJobs) {
      if (job.status !== 'succeeded' || !job.meta?.voice_id) continue
      if (handledCloneSuccessRef.current.has(job.id) || isCloneJobHandled(job.id)) continue
      handledCloneSuccessRef.current.add(job.id)
      markCloneJobHandled(job.id)
      void getPayload(job.payloadId).then((data) => {
        const payload = data as { createdVoice?: VoiceCloneRecord } | null
        const created = payload?.createdVoice
        if (!created) return
        catalog.upsertVoice(created)
        setSelectedVoice(created.voice_id)
        setPageView('work')

        const currentInCatalog = catalog.voices.find((v) => v.voice_id === created.voice_id)
        const isReady = currentInCatalog?.ready_for_synthesis ?? created.ready_for_synthesis

        if (isReady || isVoiceReadyNotified(created.voice_id)) {
          markVoiceReadyNotified(created.voice_id)
          return
        }

        catalog.startPolling(created.voice_id, (v) => {
          if (!isVoiceReadyNotified(v.voice_id)) {
            markVoiceReadyNotified(v.voice_id)
            toastSuccess(t('toast.voiceReady', { name: v.display_name }))
          }
        })
      })
    }
  }, [cloneJobs, catalog, getPayload, t])

  const readyIds = useMemo(
    () => new Set(catalog.voices.filter((v) => v.ready_for_synthesis).map((v) => v.voice_id)),
    [catalog.voices],
  )

  const allSelectableIds = useMemo(() => {
    const platform = platformVoiceItems().map((p) => p.id)
    return [...catalog.voices.filter((v) => v.ready_for_synthesis).map((v) => v.voice_id), ...platform]
  }, [catalog.voices])

  useEffect(() => {
    if (allSelectableIds.length && !allSelectableIds.includes(selectedVoice)) {
      setSelectedVoice(allSelectableIds[0] ?? DEFAULT_VOICE)
    }
  }, [allSelectableIds, selectedVoice])

  useEffect(() => {
    if (!catalog.error) return
    toastError(catalog.error)
    catalog.setError('')
  }, [catalog.error, catalog.setError])

  useEffect(() => {
    if (!tts.error) return
    toastError(tts.error)
    tts.setError('')
  }, [tts.error, tts.setError])

  const handleRename = useCallback(
    async (voiceId: string, displayName: string) => {
      catalog.setError('')
      setRenameBusy(true)
      try {
        const result = await catalog.renameVoice(voiceId, displayName)
        toastSuccess(t('toast.voiceRenamed'))
        if (!result.persistedRemote) {
          toastInfo(t('toast.voiceRenamedLocalOnly'))
        }
      } catch (e) {
        toastError(apiErrorMessage(e))
        throw e
      } finally {
        setRenameBusy(false)
      }
    },
    [catalog, t],
  )

  const handleDelete = useCallback(
    async (voiceId: string) => {
      catalog.setError('')
      setDeleteBusy(true)
      try {
        await catalog.removeVoice(voiceId)
        if (selectedVoice === voiceId) setSelectedVoice(DEFAULT_VOICE)
        evictVoicePreviewCache(voiceId)
        toastSuccess(t('toast.voiceDeleted'))
      } catch (e) {
        toastError(apiErrorMessage(e))
        throw e
      } finally {
        setDeleteBusy(false)
      }
    },
    [catalog, selectedVoice, t],
  )

  const handlePreview = useCallback(
    async (voiceId?: string) => {
      const targetId = voiceId ?? selectedVoice
      if (!isVoiceSelectable(catalog.voices, targetId)) {
        tts.setError(t('error.voiceUnavailable'))
        return
      }
      setPreviewVoiceId(targetId)
      tts.setError('')
      try {
        const cacheKey = voicePreviewCacheKey(targetId, ttsParams)
        if (!previewAudioRef.current) {
          previewAudioRef.current = new Audio()
        }
        const el = previewAudioRef.current

        const synthesizePreview = async () => {
          setPreviewBusy(true)
          const res = await createSpeech({
            input: voicePreviewText(),
            voice: targetId,
            rate: ttsParams.rate,
            volume: ttsParams.volume,
            pitch: ttsParams.pitch,
            instruction: ttsParams.instruction,
          })
          const nextUrl = resolveMediaUrl(res.url)
          setVoicePreviewCachedUrl(cacheKey, nextUrl)
          return nextUrl
        }

        let fromCache = false
        let url = getVoicePreviewCachedUrl(cacheKey)
        if (!url) {
          url = await synthesizePreview()
        } else {
          fromCache = true
        }

        try {
          await playVoicePreviewOnAudio(el, url)
        } catch (playErr) {
          if (fromCache && isVoicePreviewPlaybackError(playErr)) {
            evictVoicePreviewCacheKey(cacheKey)
            url = await synthesizePreview()
            await playVoicePreviewOnAudio(el, url)
          } else {
            throw playErr
          }
        }

        toastInfo(t('preview.playing'))
      } catch (e) {
        if (e instanceof ApiError && e.status === 500) {
          await loadVoices()
          tts.setError(t('error.previewListRefreshed', { message: apiErrorMessage(e) }))
        } else if (isVoicePreviewPlaybackError(e)) {
          tts.setError(t('error.previewStale'))
        } else {
          tts.setError(apiErrorMessage(e))
        }
      } finally {
        setPreviewBusy(false)
        setPreviewVoiceId(null)
      }
    },
    [catalog.voices, loadVoices, selectedVoice, tts, ttsParams, t],
  )

  const handleGenerate = useCallback(async () => {
    if (!readyIds.has(selectedVoice) && !platformVoiceItems().some((p) => p.id === selectedVoice)) {
      tts.setError(t('error.voiceUnavailable'))
      return
    }
    const speechText = sanitizeManuscriptForVoice(text).trim()
    if (!speechText) {
      tts.setError(t('error.manuscriptEmpty'))
      return
    }
    if (speechText !== text) setText(speechText)
    setEnqueueBusy(true)
    tts.setError('')
    try {
      await enqueueVoiceTts({
        text: speechText,
        voiceId: selectedVoice,
        voiceLabel: findVoiceLabel(catalog.voices, selectedVoice),
        rate: ttsParams.rate,
        volume: ttsParams.volume,
        pitch: ttsParams.pitch,
        instruction: ttsParams.instruction,
      })
      toastTaskEnqueued()
    } catch (e) {
      tts.setError(e instanceof Error ? e.message : apiErrorMessage(e))
    } finally {
      setEnqueueBusy(false)
    }
  }, [catalog.voices, enqueueVoiceTts, readyIds, selectedVoice, text, tts, ttsParams, t])

  const handleEnqueueAdvanced = useCallback(
    async (config: VoiceDubAdvancedConfig, confirmedSegments?: VoiceDubSegment[]) => {
      setEnqueueBusy(true)
      tts.setError('')
      try {
        const id = await enqueueVoiceDubAdvanced({
          config,
          confirmedSegments,
          route: '/workbench/voice',
          title: config.documentText.slice(0, 24) + (config.documentText.length > 24 ? '…' : ''),
        })
        toastTaskEnqueued()
        return id
      } catch (e) {
        const msg = e instanceof Error ? e.message : apiErrorMessage(e)
        tts.setError(msg)
        throw e
      } finally {
        setEnqueueBusy(false)
      }
    },
    [enqueueVoiceDubAdvanced, tts],
  )

  const handleResumeAdvanced = useCallback(
    async (confirmedSegments: VoiceDubSegment[]) => {
      if (!activeAdvancedJob || !activeAdvancedPayload) return
      try {
        await enqueueVoiceDubAdvanced({
          config: {
            ...activeAdvancedPayload.config,
            globalVoiceId: selectedVoice,
            globalVoiceLabel: findVoiceLabel(catalog.voices, selectedVoice),
          },
          confirmedSegments,
          resumeFromStageId: 'segment_tts',
          resumeSnapshot: activeAdvancedPayload.run,
          route: '/workbench/voice',
          title: t('advanced.resumeTitle', { title: activeAdvancedJob.title }),
        })
        toastTaskEnqueued()
      } catch (e) {
        const msg = e instanceof Error ? e.message : apiErrorMessage(e)
        tts.setError(msg)
      }
    },
    [activeAdvancedJob, activeAdvancedPayload, catalog.voices, enqueueVoiceDubAdvanced, selectedVoice, tts, t],
  )

  const openCloneDialog = useCallback(() => {
    setCloneWizardSession((n) => n + 1)
    void loadVoices()
    setCloneDialogOpen(true)
  }, [loadVoices])

  const handleCloneSubmit = useCallback(
    async (payload: { displayName: string; file: File }) => {
      if (catalog.meta && catalog.voices.length >= catalog.meta.max_voices_per_user) {
        toastError(t('error.voiceQuota', { max: catalog.meta.max_voices_per_user }))
        return
      }
      setCloneBusy(true)
      try {
        await enqueueVoiceClone({
          displayName: payload.displayName,
          file: payload.file,
        })
        setCloneDialogOpen(false)
        toastTaskEnqueued({ message: t('toast.cloneEnqueued') })
        setPageView('work')
      } catch (e) {
        if (e instanceof ApiError && e.code === 'VOICE_CLONE_NOT_CONFIGURED') {
          toastError(`${e.message}${e.traceId ? `（trace: ${e.traceId}）` : ''}`)
        } else {
          toastError(apiErrorMessage(e))
        }
      } finally {
        setCloneBusy(false)
      }
    },
    [catalog.meta, catalog.voices.length, enqueueVoiceClone, t],
  )

  const voicePickerProps = {
    embedded: true as const,
    clones: catalog.voices,
    selectedVoiceId: selectedVoice,
    onSelectVoice: setSelectedVoice,
    onPreviewVoice: (id: string) => void handlePreview(id),
    previewBusy,
    previewVoiceId,
  }

  const voicePicker = (
    <VoicePickerColumn
      {...voicePickerProps}
      title={dubSubMode === 'advanced' ? t('picker.titleGlobal') : t('picker.titleSelect')}
      onCloneVoice={openCloneDialog}
    />
  )

  const voicePickerInDialog = <VoicePickerColumn {...voicePickerProps} hideHeader />

  const dockProps = {
    dubMode: dubSubMode,
    onDubModeChange: setDubSubMode,
    voicePicker,
    dub: {
      mode: dubSubMode,
      activeTone: directTone,
      onToneChange: setDirectTone,
      params: ttsParams,
      onParamsChange: (patch: Partial<TtsParams>) => setTtsParams((p) => ({ ...p, ...patch })),
      onCtaClick: () => void handleGenerate(),
      ctaDisabled: !text.trim(),
      ctaBusy: enqueueBusy,
      ctaLabel: t('cta.startDub'),
    },
  }

  const devMenuItems = useMemo(() => {
    if (!import.meta.env.DEV || pageView !== 'work') return []
    if (dubSubMode === 'advanced') {
      return [
        {
          id: 'voice-dev-fill',
          label: t('demo.fillKeynote'),
          onSelect: () => advancedDevRef.current?.fillFixture(),
        },
        {
          id: 'voice-dev-result',
          label: t('demo.simulatePlan'),
          onSelect: () => advancedDevRef.current?.fillResult(),
        },
      ]
    }
    return [
      {
        id: 'voice-dev-direct-sample',
        label: t('demo.fillSample'),
        onSelect: () => setText(ttsDemoText()),
      },
    ]
  }, [pageView, dubSubMode, t])

  return (
    <Page
      moduleId="voice"
      title={tw('navVoice')}
      description={t('page.lead')}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchToolPageHeaderTools>
          <AgentFlowExplain defs={voiceFlowStages} lang={isEn ? 'en' : 'zh'} />
          <VoicePageViewTabs value={pageView} onChange={setPageView} />
        </WorkbenchToolPageHeaderTools>
      }
      actions={
        pageView === 'history' ? (
          <WorkbenchPageChromeActions>
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
          </WorkbenchPageChromeActions>
        ) : pageView === 'work' && devMenuItems.length ? (
          <WorkbenchPageChromeActions>
            <WorkbenchDevToolsMenu items={devMenuItems} />
          </WorkbenchPageChromeActions>
        ) : undefined
      }
      defaultWidth={1360}
      minWidth={840}
      layoutClassName="voice-module-layout"
    >
      <div className="voice-page voice-studio">
        {pageView === 'voices' ? (
          <VoiceManagePanel
            voices={catalog.voices}
            meta={catalog.meta}
            loading={catalog.listLoading}
            deleteBusy={deleteBusy}
            renameBusy={renameBusy}
            previewBusyId={previewVoiceId}
            onRefresh={() => void loadVoices()}
            onPreview={(id) => void handlePreview(id)}
            onRename={handleRename}
            onDelete={handleDelete}
            onStartClone={openCloneDialog}
          />
        ) : null}

        {pageView === 'history' ? (
          <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
            <GenerationList
              embedded
              layout={historyLayout}
              items={historyJobs}
              onRemove={(id) => void removeTask(id)}
              getPlaybackUrl={getVoicePlaybackUrl}
              getDownloadUrl={getVoiceDownloadUrl}
              getEmbedFallbackUrl={getVoiceEmbedFallbackUrl}
              getVoicePayload={getVoicePayload}
            />
          </WorkbenchPageHistoryPanel>
        ) : null}

        {pageView === 'work' && dubSubMode === 'advanced' ? (
          <VoiceAdvancedDubView
            clones={catalog.voices}
            selectedVoiceId={selectedVoice}
            previewVoiceId={previewVoiceId}
            onEnqueueTask={handleEnqueueAdvanced}
            activeTaskId={activeAdvancedJob?.id}
            activeTaskSnapshot={activeAdvancedPayload?.run}
            activeTaskMeta={mergedAdvancedMeta}
            activeTaskAwaitingConfirm={activeAdvancedJob?.meta?.awaiting_confirm === '1'}
            activeTaskSegments={activeAdvancedPayload?.segments}
            activeTaskMergedBlobUrl={activeAdvancedBlobUrl}
            onResumeTask={handleResumeAdvanced}
            voicePicker={voicePicker}
            voicePickerInDialog={voicePickerInDialog}
            dubSubMode={dubSubMode}
            onDubSubModeChange={setDubSubMode}
            devHandlesRef={advancedDevRef}
          />
        ) : null}

        {pageView === 'work' && dubSubMode === 'direct' ? (
          <VoiceDubWorkspace
            editor={
              <VoiceManuscriptCard
                text={text}
                onTextChange={setText}
                sampleText={ttsDemoText()}
                placeholder={t('manuscript.placeholder')}
                rate={ttsParams.rate}
                busy={enqueueBusy}
              />
            }
            dock={<VoiceRightDock {...dockProps} />}
          />
        ) : null}

        <VoiceCloneDialog
          key={cloneWizardSession}
          open={cloneDialogOpen}
          onOpenChange={setCloneDialogOpen}
          meta={catalog.meta}
          busy={cloneBusy}
          onSubmit={(p) => void handleCloneSubmit(p)}
        />
      </div>
    </Page>
  )
}
