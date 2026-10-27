import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Page, WorkbenchPageChromeActions } from '../../components/WorkbenchUI'
import PersonaBinding from '../../components/agent/PersonaBinding'
import { usePersonaInjection } from '../../components/agent/PersonaInjection'
import { createAgentClients, createMemorySink, type AgentRunSnapshot } from '../../agent'
import { toastError, toastSuccess } from '../../lib/toast'
import { copyText } from '../../services/browser'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../services/workbench-tasks'
import type { MomentsCopyTaskPayload, MomentsPlanTaskPayload } from './agent/types'
import { isMomentsFlowError } from './agent/errors'
import { runMomentsCopyFlow } from './agent/copy-flow'
import { runMomentsPlanFlow } from './agent/plan-flow'
import { createMomentsCopyMockResponder, createMomentsPlanMockResponder } from './agent/demo-responder'
import { MOMENTS_COPY_STAGES, MOMENTS_PLAN_STAGES } from './agent/stages'
import type { MomentsContent, MomentsDayMaterial, MomentsErrorCode, MomentsWeekView } from './domain/moments'
import {
  momentsHref,
  parseMomentsSearch,
  type MomentsRouteState,
  type MomentsRunKind,
  type MomentsView,
} from './lib/route-state'
import {
  adoptContentVersion,
  buildWeekView,
  confirmWeek,
  patchScheduleItem,
  saveDayMaterials,
  saveEditedContentText,
  savePlan,
  upsertDayContents,
  replaceContentVersions,
  type WeekConfigDraft,
} from './service/moments-store'
import { shiftWeek, weekRange } from './service/week-range'
import { buildMomentsCalendarIndex, type MomentsCalendarIndex } from './service/moments-calendar-index'
import { markDateCelebrated } from './lib/goal-celebrate'
import { AgentRunningView } from './views/AgentRunningView'
import { ContentDetailDrawer } from './views/ContentDetailDrawer'
import { DayContentView } from './views/DayContentView'
import { DayMaterialView } from './views/DayMaterialView'
import { MomentFeedbackView } from './views/MomentFeedbackView'
import { SchedulePlanView } from './views/SchedulePlanView'
import { WeekConfigView } from './views/WeekConfigView'
import { WeekOverviewView } from './views/WeekOverviewView'
import { MomentsExportDialog } from './views/MomentsExportDialog'
import './moments.css'
import './moments-goal-motion.css'

interface FeedbackState {
  code: MomentsErrorCode | 'ERROR'
  message: string
  details?: string[]
  recoveryAction?: string
  backTo: 'config' | 'material' | 'drawer'
}

export default function MomentsPage() {
  const { t } = useTranslation('workbench')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const routeState = useMemo(() => parseMomentsSearch(searchParams.toString()), [searchParams])
  const { view, date: routeDate, taskId: routeTaskId } = routeState

  const go = useCallback(
    (state: MomentsRouteState) => {
      navigate(momentsHref(state), { replace: false })
    },
    [navigate],
  )

  const [anchorRange, setAnchorRange] = useState(() => weekRange(routeState.week ?? new Date()))
  const weekId = anchorRange.weekStart
  const [week, setWeek] = useState<MomentsWeekView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [activeDate, setActiveDate] = useState<string | null>(routeDate)
  const [drawerContentId, setDrawerContentId] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null)
  const [inPageRunning, setInPageRunning] = useState<MomentsRunKind | null>(null)
  const [runError, setRunError] = useState('')
  const [calendarIndex, setCalendarIndex] = useState<MomentsCalendarIndex | null>(null)

  const planAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => planAbortRef.current?.abort(), [])
  const personaInject = usePersonaInjection()
  const { enqueueMomentsPlan, enqueueMomentsCopy, getPayload, cancelTask } = useWorkbenchTaskActions()
  const planTasks = useWorkbenchTasks({ kind: 'moments_plan' })
  const copyTasks = useWorkbenchTasks({ kind: 'moments_copy' })
  const demo = createAgentClients().isMock

  const refreshCalendarIndex = useCallback(async () => {
    const index = await buildMomentsCalendarIndex()
    setCalendarIndex(index)
    return index
  }, [])

  const refreshWeek = useCallback(async () => {
    const next = await buildWeekView(weekId)
    setWeek(next)
    void refreshCalendarIndex()
    return next
  }, [weekId, refreshCalendarIndex])

  useEffect(() => {
    void refreshCalendarIndex()
  }, [refreshCalendarIndex])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void buildWeekView(weekId)
      .then((next) => {
        if (!cancelled) setWeek(next)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekId])

  useEffect(() => {
    if (routeState.week && routeState.week !== anchorRange.weekStart) {
      setAnchorRange(weekRange(routeState.week))
    }
  }, [routeState.week, anchorRange.weekStart])

  useEffect(() => {
    if (routeDate) setActiveDate(routeDate)
  }, [routeDate])

  useEffect(() => {
    if (!activeDate || !anchorRange.dates.includes(activeDate)) {
      setActiveDate(anchorRange.dates[0] ?? null)
    }
  }, [anchorRange.weekStart, activeDate, anchorRange.dates])

  const pickCalendarDate = useCallback(
    (dateKey: string) => {
      const next = weekRange(dateKey)
      setAnchorRange(next)
      setActiveDate(dateKey)
      go({
        view,
        week: next.weekStart,
        date: dateKey,
        taskId: null,
        kind: null,
      })
    },
    [go, view],
  )

  const shiftAnchorWeek = useCallback(
    (delta: number) => {
      const next = shiftWeek(anchorRange.weekStart, delta)
      setAnchorRange(next)
      setActiveDate(next.dates[0] ?? null)
      go({ view, week: next.weekStart, date: next.dates[0] ?? null, taskId: null, kind: null })
    },
    [anchorRange.weekStart, go, view],
  )

  const backToOverview = useCallback(() => {
    void refreshWeek()
    go({ view: 'overview', week: weekId, date: null, taskId: null, kind: null })
  }, [refreshWeek, go, weekId])

  const presentOutcome = (code: FeedbackState['code'], message: string, backTo: FeedbackState['backTo'], extra?: Partial<FeedbackState>) => {
    setFeedback({ code, message, backTo, ...extra })
    go({ view: 'feedback', week: weekId, date: activeDate, taskId: null, kind: null })
  }

  const currentDraft = (): WeekConfigDraft => ({
    weekId,
    planPeriod: { startDate: anchorRange.weekStart, endDate: anchorRange.weekEnd },
    planningMode: week?.week.planningMode ?? 'daily',
    productRef: week?.week.productRef,
    activityRef: week?.week.activityRef,
    publishSpec: week?.week.publishSpec ?? { kind: 'weekly', perWeek: 7 },
    businessPurpose: week?.week.businessPurpose ?? '',
    coreTasks: week?.week.coreTasks ?? '',
  })

  const runPlan = useCallback(
    async (draft: WeekConfigDraft, revision?: { instruction: string }) => {
      setRunError('')
      setStreamText('')
      try {
        const latest = revision ? await buildWeekView(draft.weekId) : null
        const input = {
          ...draft,
          revisionInstruction: revision?.instruction,
          personaContent: personaInject.content,
          personaBackground: personaInject.background,
          currentDays: latest ? weekRange(draft.planPeriod.startDate).dates.map((date) => ({
            date,
            items: latest.items.filter((item) => item.date === date).map(({ publishOrder, contentDirection, topic, captureSuggestion }) => ({ publishOrder, contentDirection, topic, captureSuggestion })),
          })) : undefined,
        }
        if (demo) {
          setInPageRunning('plan')
          go({ view: 'running', week: draft.weekId, date: null, taskId: 'demo-plan', kind: 'plan' })
          const controller = new AbortController()
          planAbortRef.current = controller
          const memory = createMemorySink('moments-plan')
          const unsub = memory.subscribe(setSnapshot)
          const clients = createAgentClients({ mockResponder: createMomentsPlanMockResponder(input) })
          const result = await runMomentsPlanFlow({
            input,
            clients,
            sink: memory.sink,
            signal: controller.signal,
            onDelta: (chunk) => setStreamText((prev) => prev + chunk),
          }).finally(unsub)
          if (controller.signal.aborted) return
          planAbortRef.current = null
          const saved = await savePlan(draft, result.days)
          setWeek(saved)
          setInPageRunning(null)
          go({ view: 'plan', week: draft.weekId, date: null, taskId: null, kind: null })
          return
        }
        const taskId = await enqueueMomentsPlan({
          input,
          route: momentsHref({ view: 'running', week: draft.weekId, date: null, taskId: 'pending', kind: 'plan' }),
          title: draft.businessPurpose || t('momentsTitle'),
        })
        go({ view: 'running', week: draft.weekId, date: null, taskId, kind: 'plan' })
      } catch (error) {
        setInPageRunning(null)
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (isMomentsFlowError(error)) {
          presentOutcome(error.code, error.message, 'config', { details: error.details, recoveryAction: error.recoveryAction })
          return
        }
        presentOutcome('ERROR', error instanceof Error ? error.message : String(error), 'config')
      }
    },
    [demo, enqueueMomentsPlan, go, t, weekId, activeDate, personaInject.content, personaInject.background],
  )

  const runDayCopy = useCallback(
    async (date: string, materials: MomentsDayMaterial[]) => {
      if (!personaInject.content?.trim()) {
        presentOutcome('USER_PROFILE_REQUIRED', t('momentsProfileRequiredMessage'), 'material', {
          recoveryAction: t('momentsProfileRequiredRecovery'),
        })
        return
      }
      const latest = (await refreshWeek()) ?? week
      if (!latest || latest.week.status !== 'confirmed') {
        presentOutcome('INVALID_INPUT', t('momentsNeedConfirmFirst'), 'material')
        return
      }
      const items = latest.items.filter((item) => item.date === date)
      const copyInput = {
        weekId,
        date,
        week: latest.week,
        items,
        materials,
        personaContent: personaInject.content,
        personaBackground: personaInject.background,
      }
      await saveDayMaterials(materials)
      setRunError('')
      setStreamText('')
      try {
        if (demo) {
          setInPageRunning('copy')
          go({ view: 'running', week: weekId, date, taskId: 'demo-copy', kind: 'copy' })
          const memory = createMemorySink('moments-copy')
          const unsub = memory.subscribe(setSnapshot)
          const clients = createAgentClients({ mockResponder: createMomentsCopyMockResponder(copyInput) })
          const result = await runMomentsCopyFlow({
            input: copyInput,
            clients,
            sink: memory.sink,
            onDelta: (chunk) => setStreamText((prev) => prev + chunk),
          })
          unsub()
          await upsertDayContents(weekId, result.drafts, result.usedMock)
          await refreshWeek()
          markDateCelebrated(date)
          setInPageRunning(null)
          setActiveDate(date)
          go({ view: 'day-content', week: weekId, date, taskId: null, kind: null })
          return
        }
        const taskId = await enqueueMomentsCopy({
          input: copyInput,
          route: momentsHref({ view: 'running', week: weekId, date, taskId: 'pending', kind: 'copy' }),
          title: t('momentsDayContentTitle'),
          runKind: 'copy',
        })
        go({ view: 'running', week: weekId, date, taskId, kind: 'copy' })
      } catch (error) {
        setInPageRunning(null)
        if (isMomentsFlowError(error)) {
          presentOutcome(error.code, error.message, 'material', { details: error.details, recoveryAction: error.recoveryAction })
          return
        }
        presentOutcome('ERROR', error instanceof Error ? error.message : String(error), 'material')
      }
    },
    [demo, enqueueMomentsCopy, go, personaInject.background, personaInject.content, refreshWeek, t, week, weekId],
  )

  const runRewrite = useCallback(
    async (content: MomentsContent, instruction: string) => {
      if (!personaInject.content?.trim()) {
        presentOutcome('USER_PROFILE_REQUIRED', t('momentsProfileRequiredMessage'), 'drawer', {
          recoveryAction: t('momentsProfileRequiredRecovery'),
        })
        return
      }
      const latest = (await refreshWeek()) ?? week
      if (!latest) return
      const item = latest.items.find((row) => row.id === content.scheduleItemId)
      if (!item) return
      const copyInput = {
        weekId,
        date: content.date,
        week: latest.week,
        items: [item],
        materials: [],
        personaContent: personaInject.content,
        personaBackground: personaInject.background,
        rewrite: {
          scheduleItemId: content.scheduleItemId,
          contentId: content.id,
          currentVersion: content.currentVersion,
          instruction,
          previousVersions: content.versions,
        },
      }
      setDrawerContentId(null)
      setRunError('')
      setStreamText('')
      try {
        if (demo) {
          setInPageRunning('rewrite')
          go({ view: 'running', week: weekId, date: content.date, taskId: 'demo-rewrite', kind: 'rewrite' })
          const memory = createMemorySink('moments-copy')
          const unsub = memory.subscribe(setSnapshot)
          const clients = createAgentClients({ mockResponder: createMomentsCopyMockResponder(copyInput) })
          const result = await runMomentsCopyFlow({
            input: copyInput,
            clients,
            sink: memory.sink,
            onDelta: (chunk) => setStreamText((prev) => prev + chunk),
          })
          unsub()
          const draft = result.drafts[0]
          if (draft) await replaceContentVersions(content.id, draft, content.currentVersion, result.usedMock)
          await refreshWeek()
          toastSuccess(t('momentsRewriteSuccess'))
          setInPageRunning(null)
          go({ view: 'day-content', week: weekId, date: content.date, taskId: null, kind: null })
          return
        }
        const taskId = await enqueueMomentsCopy({
          input: copyInput,
          route: momentsHref({ view: 'running', week: weekId, date: content.date, taskId: 'pending', kind: 'rewrite' }),
          title: t('momentsRewriteVersions'),
          runKind: 'rewrite',
        })
        go({ view: 'running', week: weekId, date: content.date, taskId, kind: 'rewrite' })
      } catch (error) {
        setInPageRunning(null)
        if (isMomentsFlowError(error)) {
          presentOutcome(error.code, error.message, 'drawer', { details: error.details, recoveryAction: error.recoveryAction })
          return
        }
        presentOutcome('ERROR', error instanceof Error ? error.message : String(error), 'drawer')
      }
    },
    [demo, enqueueMomentsCopy, go, personaInject.background, personaInject.content, refreshWeek, t, week, weekId],
  )

  const sessionTask = [...planTasks, ...copyTasks].find((task) => task.id === routeTaskId)

  useEffect(() => {
    if (!sessionTask || view !== 'running') return
    if (sessionTask.status === 'succeeded') {
      void (async () => {
        await refreshWeek()
        const kind = (sessionTask.meta?.runKind as MomentsRunKind | undefined) ?? (sessionTask.kind === 'moments_plan' ? 'plan' : 'copy')
        if (kind === 'plan') {
          go({ view: 'plan', week: weekId, date: null, taskId: null, kind: null })
          return
        }
        const date = sessionTask.meta?.date || routeDate
        if (date) {
          if (kind === 'rewrite') toastSuccess(t('momentsRewriteSuccess'))
          else if (kind === 'copy') markDateCelebrated(date)
          go({ view: 'day-content', week: weekId, date, taskId: null, kind: null })
        }
      })()
    }
    if (sessionTask.status === 'failed') {
      const code = (sessionTask.meta?.errorCode as FeedbackState['code'] | undefined) ?? 'ERROR'
      presentOutcome(code, sessionTask.errorMessage || t('momentsFailedTitle'), sessionTask.kind === 'moments_plan' ? 'config' : 'material')
    }
  }, [sessionTask?.status, sessionTask?.finishedAt])

  useEffect(() => {
    if (!sessionTask || view !== 'running') return
    void getPayload(sessionTask.payloadId).then((data) => {
      const payload = data as MomentsPlanTaskPayload | MomentsCopyTaskPayload | null
      if (payload?.run) setSnapshot(payload.run)
    })
  }, [sessionTask, view, getPayload])

  const handleConfirmWeek = useCallback(async () => {
    setSaving(true)
    try {
      const next = await confirmWeek(weekId)
      setWeek(next)
      toastSuccess(t('momentsWeekConfirmed'))
    } catch (error) {
      presentOutcome('ERROR', error instanceof Error ? error.message : String(error), 'config')
    } finally {
      setSaving(false)
    }
  }, [t, weekId])

  const itemsForDate = useCallback(
    (date: string) => (week?.items ?? []).filter((item) => item.date === date).sort((a, b) => a.publishOrder - b.publishOrder),
    [week],
  )
  const contentsForDate = useCallback(
    (date: string) => (week?.contents ?? []).filter((row) => row.date === date),
    [week],
  )

  const openDay = (date: string) => {
    const hasContent = contentsForDate(date).length > 0
    setActiveDate(date)
    go({
      view: hasContent ? 'day-content' : 'material',
      week: weekId,
      date,
      taskId: null,
      kind: null,
    })
  }

  const goView = (next: MomentsView, patch?: Partial<Omit<MomentsRouteState, 'view'>>) =>
    go({
      view: next,
      week: patch?.week ?? weekId,
      date: patch?.date ?? routeDate,
      taskId: patch?.taskId ?? null,
      kind: patch?.kind ?? null,
    })

  const drawerContent = drawerContentId ? (week?.contents ?? []).find((row) => row.id === drawerContentId) ?? null : null
  const runningKind = routeState.kind ?? inPageRunning ?? 'plan'

  return (
    <Page
      title={t('momentsTitle')}
      description={t('momentsSubtitle')}
      moduleId="moments"
      defaultWidth={1000}
      minWidth={720}
      layoutClassName="moments-layout"
      chrome="workbench-tool"
      actions={
        <WorkbenchPageChromeActions>
          <MomentsExportDialog weekStart={anchorRange.weekStart} weekEnd={anchorRange.weekEnd} />
          <PersonaBinding
            options={personaInject.options}
            value={personaInject.persona}
            onChange={(persona) => personaInject.selectPersona(persona?.id ?? null)}
          />
        </WorkbenchPageChromeActions>
      }
    >
      {view === 'overview' && (
        <WeekOverviewView
          range={anchorRange}
          week={week}
          loading={loading}
          calendarIndex={calendarIndex}
          activeDate={activeDate ?? anchorRange.dates[0]!}
          onActiveDateChange={setActiveDate}
          onShiftWeek={shiftAnchorWeek}
          onPickDate={pickCalendarDate}
          onStartConfig={() => goView('config')}
          onOpenDay={openDay}
          onOpenPlan={() => goView('plan')}
          onRegenerateDay={(date) => {
            setActiveDate(date)
            goView('material', { date })
          }}
        />
      )}

      {view === 'config' && (
        <WeekConfigView
          initial={currentDraft()}
          loading={saving || Boolean(inPageRunning)}
          onBack={() => goView('overview')}
          onSubmit={(draft) => void runPlan(draft)}
          exampleWeekContext={
            import.meta.env.DEV
              ? { weekId, weekStart: anchorRange.weekStart, weekEnd: anchorRange.weekEnd }
              : undefined
          }
        />
      )}

      {view === 'running' && (
        <AgentRunningView
          kind={runningKind}
          headline={t('momentsPreparing')}
          snapshot={snapshot}
          defs={runningKind === 'plan' ? MOMENTS_PLAN_STAGES : MOMENTS_COPY_STAGES}
          streamingText={streamText}
          mock={demo}
          error={runError}
          onCancel={() => {
            planAbortRef.current?.abort()
            if (routeTaskId && !routeTaskId.startsWith('demo-')) void cancelTask(routeTaskId)
            setInPageRunning(null)
            backToOverview()
          }}
          onBack={backToOverview}
        />
      )}

      {view === 'feedback' && feedback && (
        <MomentFeedbackView
          code={feedback.code}
          message={feedback.message}
          details={feedback.details}
          recoveryAction={feedback.recoveryAction}
          onBack={() => {
            setFeedback(null)
            if (feedback.backTo === 'material' && activeDate) goView('material', { date: activeDate })
            else if (feedback.backTo === 'config') goView('config')
            else goView(activeDate ? 'day-content' : 'overview', { date: activeDate })
          }}
          onGoProfile={() => navigate('/workbench/persona')}
          onRetry={() => {
            setFeedback(null)
            if (feedback.backTo === 'material' && activeDate) goView('material', { date: activeDate })
            else if (feedback.backTo === 'config') goView('config')
            else goView('overview')
          }}
        />
      )}

      {view === 'plan' && week && (
        <SchedulePlanView
          week={week}
          range={anchorRange}
          saving={saving}
          calendarIndex={calendarIndex}
          activeDate={activeDate ?? anchorRange.dates[0]!}
          onActiveDateChange={setActiveDate}
          onShiftWeek={shiftAnchorWeek}
          onPickDate={pickCalendarDate}
          onBack={backToOverview}
          onEditItem={async (itemId, patch) => {
            await patchScheduleItem(itemId, patch)
            await refreshWeek()
          }}
          onConfirm={() => void handleConfirmWeek()}
          onRevise={(instruction) => void runPlan(currentDraft(), { instruction })}
          onOpenDay={openDay}
        />
      )}

      {view === 'material' && activeDate && (
        <DayMaterialView
          date={activeDate}
          items={itemsForDate(activeDate)}
          onBack={backToOverview}
          onSubmit={(materials) => void runDayCopy(activeDate, materials)}
        />
      )}

      {view === 'day-content' && activeDate && (
        <DayContentView
          date={activeDate}
          contents={contentsForDate(activeDate)}
          onBack={backToOverview}
          onOpenDetail={(contentId) => setDrawerContentId(contentId)}
          onCopy={(text) => {
            void copyText(text)
              .then(() => toastSuccess(t('momentsCopied')))
              .catch(() => toastError(t('momentsCopyFailed')))
          }}
        />
      )}

      {drawerContent && (
        <ContentDetailDrawer
          content={drawerContent}
          open={Boolean(drawerContentId)}
          onOpenChange={(open) => {
            if (!open) setDrawerContentId(null)
          }}
          onAdopt={(version) => {
            void adoptContentVersion(drawerContent.id, version)
              .then(() => refreshWeek())
              .then(() => toastSuccess(t('momentsVersionAdopted')))
              .catch(() => toastError(t('momentsAdoptFailed')))
          }}
          onSaveEdited={(text) => {
            void saveEditedContentText(drawerContent.id, text)
              .then(() => refreshWeek())
              .then(() => toastSuccess(t('momentsEditSaved')))
              .catch(() => toastError(t('momentsSaveFailed')))
          }}
          onCopy={(text) => {
            void copyText(text)
              .then(() => toastSuccess(t('momentsCopied')))
              .catch(() => toastError(t('momentsCopyFailed')))
          }}
          onRewrite={(instruction) => void runRewrite(drawerContent, instruction)}
          rewriting={inPageRunning === 'rewrite' || sessionTask?.meta?.runKind === 'rewrite'}
        />
      )}
    </Page>
  )
}
