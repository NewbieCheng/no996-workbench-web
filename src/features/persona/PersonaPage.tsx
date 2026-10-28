import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@no996/ui/button'
import { ColumnDivider } from '@no996/ui/column-divider'
import { Plus, SparklesIcon } from 'lucide-react'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import {
  Notice,
  Page,
  WorkbenchPageChromeActions,
  WorkbenchPageChromeLeading,
} from '../../components/WorkbenchUI'
import { AgentFlowExplain } from '../../components/agent/AgentFlowExplain'
import WorkflowRunCard from '../../components/agent/WorkflowRunCard'
import type { AgentRunSnapshot } from '../../agent'
import { PERSONA_FLOW_ID, PERSONA_STAGES } from './agent/persona-flow'
import {
  applySimpleInheritForAdvanced,
  createPersona,
  EMPTY_QUESTIONNAIRE,
  listPersonas,
  normalizeQuestionnaire,
  projectLegacyUserForm,
  questionnaireProgressForMode,
  renamePersona,
  setActivePersona,
  upsertPersona,
  type PersonaMode,
  type PersonaQuestionnaire,
  type PersonaRecord,
} from '../../services/persona'
import { getPersonaFence } from '../../prompts/persona'
import type { AttachmentUploaderItem } from '@no996/ui/attachment-uploader'
import { prepareAttachmentsFromItems } from '../../lib/chat-attachments/prepare'
import {
  useWorkbenchTaskActions,
  useWorkbenchTasks,
  type PersonaGeneratePayload,
} from '../../services/workbench-tasks'
import { ProfileFormView } from './views/ProfileFormView'
import { PersonaQuestionnaireView } from './views/PersonaQuestionnaireView'
import { PersonaWorkspacePreview } from './views/PersonaWorkspacePreview'
import { PersonaSelectView } from './views/PersonaSelectView'
import { PersonaMainProfileView } from './views/PersonaMainProfileView'
import { PersonaRecordsView } from './views/PersonaRecordsView'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import { PersonaRecordsToolbar, type PersonaRecordsLayout } from './views/PersonaRecordsToolbar'
import { extractStreamingFenced } from './lib/profile-fields'
import {
  composeMainProfile,
  fieldValue,
  parseAccountCard,
} from './lib/account-card'
import type { PackagingId, PositioningId } from '../../services/persona/types'
import { PERSONA_CONTENT_MIN_WIDTH, PERSONA_MAIN_MIN_WIDTH } from '../../lib/content-width-policy'
import { questionnaireFromLegacyContent } from '../../services/persona/questionnaire'
import './persona.css'

type Phase = 'questionnaire' | 'generating' | 'select' | 'profile'

const KIND = 'user' as const

function phaseOf(record: PersonaRecord | null): Phase {
  if (!record) return 'questionnaire'
  if (record.content.trim()) return 'profile'
  if (record.candidatesMarkdown?.trim()) return 'select'
  return 'questionnaire'
}

export default function PersonaPage() {
  const { t, i18n } = useTranslation('persona')
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [recordsLayout, setRecordsLayout] = useState<PersonaRecordsLayout>('cards')
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  const [formCollapsed, setFormCollapsed] = useState(false)
  const [questionnaireStep, setQuestionnaireStep] = useState(0)
  const [simpleStep, setSimpleStep] = useState(0)
  const [selected, setSelected] = useState<PersonaRecord | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  selectedIdRef.current = selected?.id ?? null
  const [personaRecords, setPersonaRecords] = useState<PersonaRecord[]>([])
  const [personaMode, setPersonaMode] = useState<PersonaMode>('simple')
  const [phase, setPhase] = useState<Phase>('questionnaire')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [userForm, setUserForm] = useState<PersonaQuestionnaire>({ ...EMPTY_QUESTIONNAIRE })
  const [booting, setBooting] = useState(true)
  const [traceTaskId, setTraceTaskId] = useState<string | null>(null)
  const [tracePayload, setTracePayload] = useState<PersonaGeneratePayload | null>(null)
  const [traceError, setTraceError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const { enqueuePersona, cancelTask, getPayload } = useWorkbenchTaskActions()
  const personaTasks = useWorkbenchTasks({ kind: 'persona_generate' })
  const lastPersonaTaskDoneRef = useRef(0)
  const personaBusy = personaTasks.some(
    (task) =>
      selected &&
      task.meta?.personaId === selected.id &&
      (task.status === 'queued' || task.status === 'running'),
  )

  const selectedPersonaTasks = useMemo(
    () => (selected ? personaTasks.filter((task) => task.meta?.personaId === selected.id) : []),
    [personaTasks, selected],
  )
  const traceTask = useMemo(() => {
    if (traceTaskId) return selectedPersonaTasks.find((task) => task.id === traceTaskId) ?? null
    return (
      selectedPersonaTasks
        .filter((task) => task.status === 'queued' || task.status === 'running')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0] ?? null
    )
  }, [selectedPersonaTasks, traceTaskId])

  useEffect(() => {
    if (!traceTask) {
      setTracePayload(null)
      setTraceError('')
      return
    }
    let alive = true
    const loadPayload = async () => {
      try {
        const data = (await getPayload(traceTask.payloadId)) as PersonaGeneratePayload | null
        if (alive) {
          setTracePayload(data)
          setTraceError('')
        }
      } catch (e) {
        if (alive) setTraceError(e instanceof Error ? e.message : t('errorTraceLoadFailed'))
      }
    }
    void loadPayload()
    if (traceTask.status !== 'queued' && traceTask.status !== 'running') {
      return () => {
        alive = false
      }
    }
    const pollMs = traceTask.status === 'running' ? 400 : 600
    const interval = window.setInterval(() => void loadPayload(), pollMs)
    return () => {
      alive = false
      window.clearInterval(interval)
    }
  }, [getPayload, t, traceTask?.id, traceTask?.payloadId, traceTask?.status])

  const applyRecord = useCallback((pick: PersonaRecord) => {
    setSelected(pick)
    const baseForm =
      pick.formData && 'occupation' in pick.formData
        ? normalizeQuestionnaire(pick.formData)
        : questionnaireFromLegacyContent(pick.formData, pick.legacyContent ?? pick.content)
    const nextMode = pick.mode ?? (pick.candidatesMarkdown ? 'advanced' : 'simple')
    // 高级档默认带上简易版已填内容（只填空，不覆盖高级已有值）
    setUserForm(nextMode === 'advanced' ? applySimpleInheritForAdvanced(baseForm) : baseForm)
    setPersonaMode(nextMode)
    setPhase(phaseOf(pick))
    setPreviewCollapsed(false)
    setQuestionnaireStep(pick.questionnaireStep ?? 0)
    setSimpleStep(0)
  }, [])

  const refresh = useCallback(async (preferredId?: string) => {
    const list = await listPersonas(KIND)
    setPersonaRecords(list)
    if (preferredId && selectedIdRef.current !== preferredId) return false
    if (list.length === 0) {
      setSelected(null)
      setPhase('questionnaire')
      return
    }
    const pick = list.find((item) => item.id === preferredId) || list.find((item) => item.isActive) || list[0]
    applyRecord(pick)
    return true
  }, [applyRecord])

  const beginNewPersona = useCallback(() => {
    abortRef.current?.abort()
    setError('')
    setFeedback('')
    setSelected(null)
    setUserForm({ ...EMPTY_QUESTIONNAIRE })
    setPersonaMode('simple')
    setPhase('questionnaire')
    setFormCollapsed(false)
    setPreviewCollapsed(false)
    setQuestionnaireStep(0)
    setSimpleStep(0)
    setPageView('work')
    setTraceTaskId(null)
    setTracePayload(null)
    setTraceError('')
  }, [])

  useEffect(() => {
    void refresh()
      .catch((e) => setError(e instanceof Error ? e.message : t('errorLoadFailed')))
      .finally(() => setBooting(false))
    return () => {
      abortRef.current?.abort()
    }
  }, [refresh, t])

  useEffect(() => {
    if (!traceTaskId && traceTask && (traceTask.status === 'queued' || traceTask.status === 'running')) {
      setTraceTaskId(traceTask.id)
    }
  }, [traceTask, traceTaskId])

  useEffect(() => {
    if (phase === 'generating' && selected && traceTaskId && traceTask && (traceTask.status === 'failed' || traceTask.status === 'cancelled')) {
      setPhase(phaseOf(selected))
    }
  }, [phase, selected, traceTask, traceTaskId])

  useEffect(() => {
    if (!selected || !traceTaskId) return
    const latest = personaTasks.find((task) => task.id === traceTaskId && task.meta?.personaId === selected.id && task.status === 'succeeded')
    if (!latest?.finishedAt || latest.finishedAt <= lastPersonaTaskDoneRef.current) return
    lastPersonaTaskDoneRef.current = latest.finishedAt
    void refresh(selected.id).then((applied) => {
      if (!applied) return
      setFormCollapsed(true)
      setPhase('select')
    }).catch((e) => setError(e instanceof Error ? e.message : t('errorLoadFailed')))
  }, [personaTasks, refresh, selected, traceTaskId, t])

  async function persistDraft(formData: PersonaQuestionnaire, extra: Partial<PersonaRecord> = {}) {
    const target = selected ?? (await createPersona(KIND, formData.publicName.trim() || formData.role.trim() || t('defaultName')))
    const saved = await upsertPersona({
      ...target,
      ...extra,
      name: formData.publicName.trim() || formData.role.trim() || target.name,
      mode: extra.mode ?? target.mode ?? personaMode,
      formData,
      draftSavedAt: new Date().toISOString(),
      questionnaireStep: extra.questionnaireStep ?? target.questionnaireStep,
    })
    setSelected(saved)
    setPersonaRecords(await listPersonas(KIND))
    return saved
  }

  async function enqueueGeneration(
    formData: PersonaQuestionnaire,
    attachmentItems?: AttachmentUploaderItem[],
    mode: PersonaMode = personaMode,
  ) {
    setError('')
    setFeedback('')
    try {
      const persisted = await persistDraft(formData, { questionnaireStep, mode })
      const chatAttachments = attachmentItems?.length
        ? await prepareAttachmentsFromItems(attachmentItems)
        : undefined
      const taskId = await enqueuePersona({
        personaId: persisted.id,
        personaName: persisted.name,
        formData,
        currentProfile: persisted.candidatesMarkdown,
        chatAttachments,
      })
      setTraceTaskId(taskId)
      setFormCollapsed(true)
      setPhase('generating')
      setPageView('work')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorGenerateFailed'))
    }
  }

  const handleSwitchMode = (nextMode: PersonaMode) => {
    if (nextMode === personaMode) return
    if (nextMode === 'advanced') {
      // 切到高级版即自动继承简易字段（只填空）；用户清空后停留高级版不会反复回填
      setUserForm((prev) => applySimpleInheritForAdvanced(prev))
    }
    setPersonaMode(nextMode)
  }

  async function retryTraceGeneration() {
    if (!tracePayload) return
    setTraceError('')
    try {
      const taskId = await enqueuePersona({
        personaId: tracePayload.personaId,
        personaName: tracePayload.personaName,
        formData: normalizeQuestionnaire(tracePayload.formData),
        instruction: tracePayload.instruction,
        currentProfile: tracePayload.currentProfile,
        chatAttachments: tracePayload.chatAttachments,
      })
      setTraceTaskId(taskId)
      setPhase('generating')
    } catch (e) {
      setTraceError(e instanceof Error ? e.message : t('errorGenerateFailed'))
    }
  }

  async function cancelTraceGeneration() {
    if (!traceTask) return
    await cancelTask(traceTask.id)
    setPhase(phaseOf(selected))
  }

  async function renamePersonaRecord(record: PersonaRecord, name: string) {
    const renamed = await renamePersona(record.id, name)
    if (!renamed) throw new Error(t('recordsRenameFailed'))
    setPersonaRecords((current) => current.map((item) => (item.id === renamed.id ? renamed : item)))
    if (selected?.id === renamed.id) setSelected(renamed)
  }

  function openPersonaRecord(record: PersonaRecord) {
    applyRecord(record)
    const nextPhase = phaseOf(record)
    if (nextPhase === 'profile' || nextPhase === 'select') {
      setFormCollapsed(true)
      setPreviewCollapsed(false)
    }
    setTraceTaskId(null)
    setTracePayload(null)
    setTraceError('')
    setError('')
    setFeedback('')
    setPageView('work')
  }

  async function activatePersona(record: PersonaRecord) {
    setBusy(true)
    setError('')
    try {
      const active = await setActivePersona(record.id)
      if (!active) return
      setPersonaRecords(await listPersonas(KIND))
      if (selected?.id === active.id) setSelected(active)
      else applyRecord(active)
      setPageView('work')
      setFeedback(t('feedbackDefaultPersona'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function saveMainCombo(positioning: PositioningId, packaging: PackagingId) {
    if (!selected?.candidatesMarkdown) return
    const parsed = parseAccountCard(selected.candidatesMarkdown)
    if (!parsed) {
      setError(t('select.parseFailed'))
      return
    }
    setBusy(true)
    try {
      const content = composeMainProfile(parsed, positioning, packaging)
      const summary =
        fieldValue(parsed.positioning[positioning], '一句话专业定位') || selected.name
      const saved = await upsertPersona({
        ...selected,
        content,
        selectedPositioning: positioning,
        selectedPackaging: packaging,
        summary,
      })
      setSelected(saved)
      setPersonaRecords(await listPersonas(KIND))
      setPhase('profile')
      setFeedback(t('feedbackProfileSaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorSaveFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function saveProfileMarkdown(content: string) {
    if (!selected) return
    setBusy(true)
    try {
      const saved = await upsertPersona({ ...selected, content })
      setSelected(saved)
      setPersonaRecords(await listPersonas(KIND))
      setFeedback(t('feedbackProfileSaved'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errorSaveFailed'))
      throw e
    } finally {
      setBusy(false)
    }
  }

  const isEn = i18n.language?.startsWith('en')
  const traceStatus = traceTask?.status === 'queued'
    ? 'queued'
    : traceTask?.status === 'running'
      ? 'running'
      : traceTask?.status === 'succeeded'
        ? 'done'
        : traceTask?.status === 'failed'
          ? 'failed'
          : traceTask?.status === 'cancelled'
            ? 'cancelled'
            : null

  const traceRun = useMemo<AgentRunSnapshot | null>(() => {
    if (tracePayload?.run) return tracePayload.run
    const markdown = tracePayload?.resultMarkdown
    if (traceTask?.status !== 'succeeded' || !markdown?.trim()) return null
    return {
      flowId: PERSONA_FLOW_ID,
      status: 'done',
      round: 1,
      stages: [
        { id: 'plan-research', status: 'skipped', round: 1 },
        { id: 'search-industry', status: 'skipped', round: 1 },
        { id: 'search-audience', status: 'skipped', round: 1 },
        { id: 'compose-profile', status: 'done', round: 1, output: markdown },
        { id: 'validate-profile', status: 'done', round: 1, output: { ok: true, length: markdown.length } },
      ],
    }
  }, [tracePayload, traceTask?.status])

  const streamRaw = useMemo(() => {
    if (!personaBusy) return ''
    const stage = traceRun?.stages.find((s) => s.id === 'compose-profile')
    return stage?.streamingContent ?? ''
  }, [personaBusy, traceRun])

  const livePartialMarkdown = useMemo(
    () => extractStreamingFenced(streamRaw, getPersonaFence(KIND)),
    [streamRaw],
  )

  const workPhase = personaBusy ? 'generating' : phase
  const candidatesMarkdown = selected?.candidatesMarkdown || tracePayload?.resultMarkdown || ''

  const questionnaireProgress = useMemo(
    () => questionnaireProgressForMode(userForm, personaMode),
    [userForm, personaMode],
  )
  const previewStep = personaMode === 'simple' ? simpleStep : questionnaireStep

  const workPanelsActive = pageView === 'work' && (!booting || Boolean(selected))
  const showQuestionnaire = !booting && !formCollapsed && workPhase === 'questionnaire'
  const showSelect =
    workPhase === 'generating' || (workPhase === 'select' && formCollapsed)
  const showMainProfile = workPhase === 'profile'
  const showPreview =
    workPanelsActive && (personaBusy || formCollapsed || !previewCollapsed)
  const splitActive =
    showPreview && (showQuestionnaire || showSelect || showMainProfile) && !previewCollapsed

  return (
    <Page
      moduleId="persona"
      title={t('title')}
      description={t('subtitle')}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchPageChromeLeading>
          {pageView === 'work' && showQuestionnaire ? (
            <div className="persona-mode-toggle persona-mode-toggle--chrome" role="tablist" aria-label="人设模式选择">
              <button
                type="button"
                role="tab"
                aria-selected={personaMode === 'simple'}
                className={`persona-mode-toggle__item ${personaMode === 'simple' ? 'persona-mode-toggle__item--active' : ''}`}
                onClick={() => handleSwitchMode('simple')}
              >
                简易版
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={personaMode === 'advanced'}
                className={`persona-mode-toggle__item persona-mode-toggle__item--advanced ${personaMode === 'advanced' ? 'persona-mode-toggle__item--active' : ''}`}
                onClick={() => handleSwitchMode('advanced')}
              >
                <Plus className="size-3 shrink-0" aria-hidden="true" />
                <span>高级版</span>
              </button>
            </div>
          ) : null}
          <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyLabel={t('recordsTab')} />
          <AgentFlowExplain defs={PERSONA_STAGES} lang={isEn ? 'en' : 'zh'} />
        </WorkbenchPageChromeLeading>
      }
      actions={
        pageView === 'history' ? (
          <WorkbenchPageChromeActions>
            {personaRecords.length > 0 ? (
              <WorkbenchPageHistoryLayoutTabs layout={recordsLayout} onLayoutChange={setRecordsLayout} />
            ) : null}
            <PersonaRecordsToolbar onCreate={beginNewPersona} />
          </WorkbenchPageChromeActions>
        ) : pageView === 'work' ? (
          <WorkbenchPageChromeActions>
            <PersonaRecordsToolbar onCreate={beginNewPersona} />
            {workPanelsActive && (formCollapsed || previewCollapsed) && !personaBusy ? (
              <>
                {formCollapsed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="persona-form-reopen"
                    aria-label={t('form.expand')}
                    onClick={() => {
                      setFormCollapsed(false)
                      if (workPhase === 'select') setPhase('questionnaire')
                    }}
                  >
                    <SparklesIcon aria-hidden="true" />
                    <span>{t('form.reopenLabel')}</span>
                  </Button>
                ) : null}
                {previewCollapsed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="persona-preview-reopen"
                    aria-label={t('preview.expand')}
                    onClick={() => setPreviewCollapsed(false)}
                  >
                    <span>{t('preview.foldedTab')}</span>
                    <small>
                      {questionnaireProgress.filled}/{questionnaireProgress.total}
                    </small>
                  </Button>
                ) : null}
              </>
            ) : null}
          </WorkbenchPageChromeActions>
        ) : undefined
      }
      defaultWidth={1040}
      minWidth={PERSONA_CONTENT_MIN_WIDTH}
      layoutClassName="persona-module-layout"
    >
      <div className="persona-page">
        {pageView === 'history' ? (
          <PersonaRecordsView
            records={personaRecords}
            layout={recordsLayout}
            loading={booting}
            onOpen={openPersonaRecord}
            onSetDefault={(record) => void activatePersona(record)}
            onCreate={beginNewPersona}
            onRename={renamePersonaRecord}
          />
        ) : null}

        {pageView === 'work' ? (
          <div
            className={[
              'persona-workspace',
              previewCollapsed ? 'persona-workspace--preview-collapsed' : '',
              formCollapsed || personaBusy ? 'persona-workspace--form-collapsed' : '',
              personaBusy ? 'persona-workspace--card-focus' : '',
              splitActive ? 'persona-workspace--split' : '',
              traceTask && traceStatus ? 'persona-workspace--has-trace' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {showPreview ? (
              <aside className="persona-workspace__preview">
                <PersonaWorkspacePreview
                  phase={workPhase}
                  questionnaire={userForm}
                  mode={personaMode}
                  questionnaireStep={previewStep}
                  isDefault={Boolean(selected?.isActive)}
                  saving={busy}
                  generating={personaBusy}
                  livePartialMarkdown={livePartialMarkdown}
                  candidatesMarkdown={candidatesMarkdown}
                  profileMarkdown={selected?.content || ''}
                  selectedPositioning={selected?.selectedPositioning}
                  selectedPackaging={selected?.selectedPackaging}
                  collapseDisabled={formCollapsed}
                  onToggleCollapse={
                    personaBusy || formCollapsed ? undefined : () => setPreviewCollapsed(true)
                  }
                  onSetDefault={
                    selected && !selected.isActive ? () => void activatePersona(selected) : undefined
                  }
                />
              </aside>
            ) : null}

            {splitActive ? (
              <ColumnDivider
                className="persona-workspace__divider"
                previewSelector=".persona-workspace__preview"
                widthVariable="--persona-preview-width"
                defaultWidth={316}
                minWidth={200}
                minMainWidth={PERSONA_MAIN_MIN_WIDTH}
                maxPreviewRatio={0.38}
                label={t('preview.resizeDivider')}
              />
            ) : null}

            <div className="persona-workspace__main">
              {showQuestionnaire ? (
                <div className="persona-form-container">
                  {personaMode === 'simple' ? (
                    <ProfileFormView
                      key={`simple-${selected?.id ?? 'new-persona'}`}
                      isConfigured={Boolean(selected)}
                      initialData={projectLegacyUserForm(userForm)}
                      submitBusy={personaBusy || busy}
                      onActiveStepChange={setSimpleStep}
                      onFormChange={(simpleData) => {
                        setUserForm((prev) => ({
                          ...prev,
                          ...simpleData,
                        }))
                      }}
                      canCollapse={Boolean(selected)}
                      onToggleCollapse={() => {
                        setFormCollapsed(true)
                        setPhase(phaseOf(selected))
                      }}
                      onSaveDraft={(simpleData) => {
                        const full = normalizeQuestionnaire(simpleData)
                        setUserForm(full)
                        void persistDraft(full, { mode: 'simple' })
                          .then(() => setFeedback(t('questionnaire.draftSaved')))
                          .catch((e) => setError(e instanceof Error ? e.message : t('errorSaveFailed')))
                      }}
                      onSubmit={(simpleData, items) => {
                        const full = normalizeQuestionnaire(simpleData)
                        setUserForm(full)
                        void enqueueGeneration(full, items, 'simple')
                      }}
                    />
                  ) : (
                    <PersonaQuestionnaireView
                      key={`advanced-${selected?.id ?? 'new-persona'}`}
                      initialData={userForm}
                      initialStep={questionnaireStep}
                      submitBusy={personaBusy || busy}
                      onFormChange={setUserForm}
                      onStepChange={setQuestionnaireStep}
                      canCollapse={Boolean(selected)}
                      onCollapse={() => {
                        setFormCollapsed(true)
                        setPhase(phaseOf(selected))
                      }}
                      onSaveDraft={(data) => {
                        setUserForm(data)
                        void persistDraft(data, { questionnaireStep: questionnaireStep, mode: 'advanced' })
                          .then(() => setFeedback(t('questionnaire.draftSaved')))
                          .catch((e) => setError(e instanceof Error ? e.message : t('errorSaveFailed')))
                      }}
                      onSubmit={(data, items) => {
                        setUserForm(data)
                        void enqueueGeneration(data, items, 'advanced')
                      }}
                    />
                  )}
                </div>
              ) : null}

              {showSelect ? (
                <PersonaSelectView
                  markdown={candidatesMarkdown}
                  generating={workPhase === 'generating'}
                  livePartialMarkdown={livePartialMarkdown}
                  initialPositioning={selected?.selectedPositioning}
                  initialPackaging={selected?.selectedPackaging}
                  onSave={(positioning, packaging) => void saveMainCombo(positioning, packaging)}
                  onBackToQuestionnaire={() => {
                    setFormCollapsed(false)
                    setPhase('questionnaire')
                  }}
                />
              ) : null}

              {showMainProfile ? (
                <PersonaMainProfileView
                  markdown={selected?.content || ''}
                  legacyContent={selected?.legacyContent}
                  personaName={userForm.publicName.trim() || selected?.name}
                  selectedPositioning={selected?.selectedPositioning}
                  selectedPackaging={selected?.selectedPackaging}
                  summary={selected?.summary}
                  isDefault={Boolean(selected?.isActive)}
                  lastSavedAt={selected?.updatedAt}
                  usedMock={tracePayload?.usedMock}
                  saving={busy}
                  onSaveModule={saveProfileMarkdown}
                  onChangeCombo={selected?.candidatesMarkdown ? () => {
                    setFormCollapsed(true)
                    setPhase('select')
                  } : undefined}
                  onEditQuestionnaire={() => {
                    setFormCollapsed(false)
                    setPhase('questionnaire')
                  }}
                  onSetDefault={selected && !selected.isActive ? () => void activatePersona(selected) : undefined}
                />
              ) : null}
            </div>

            {traceTask && traceStatus ? (
              <div className="persona-workspace__trace">
                <WorkflowRunCard
                  title={t('title')}
                  status={traceStatus}
                  chips={[
                    tracePayload?.personaName ?? traceTask.title,
                    tracePayload?.formData.occupation || '',
                  ].filter(Boolean)}
                  submittedAt={traceTask.createdAt}
                  roundText={traceRun?.round ? t('traceRound', { count: traceRun.round }) : undefined}
                  mock={tracePayload?.usedMock}
                  snapshot={traceRun}
                  streamingText={streamRaw ? streamRaw.slice(-1200) : undefined}
                  defs={PERSONA_STAGES}
                  detailTitle={t('traceDetails')}
                  error={(traceTask.errorMessage ?? traceError) || undefined}
                  onCancel={
                    traceStatus === 'queued' || traceStatus === 'running'
                      ? () => void cancelTraceGeneration()
                      : undefined
                  }
                  onRetry={tracePayload ? () => void retryTraceGeneration() : undefined}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <Notice tone="error">{error}</Notice> : null}
        {feedback ? <Notice>{feedback}</Notice> : null}
      </div>
    </Page>
  )
}
