import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileCode,
  Maximize2,
  Network,
  PanelTopClose,
  PanelTopOpen,
} from 'lucide-react'
import { Button } from '@no996/ui/button'
import { Page, WorkbenchPageChromeActions, WorkbenchPageChromeLeading } from '../../components/WorkbenchUI'
import { WorkbenchDevToolsMenu } from '../../components/WorkbenchDevToolsMenu'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import AgentMetrics from '../../components/agent/AgentMetrics'
import { AgentFlowExplain, agentFlowCounts } from '../../components/agent/AgentFlowExplain'
import RetentionCurve from '../../components/agent/RetentionCurve'
import { InputWizard } from '../../components/agent/InputWizard'
import WorkflowRunCard from '../../components/agent/WorkflowRunCard'
import { AgentWorkflowCanvas } from '../../components/agent/AgentWorkflowCanvas'
import PersonaBinding from '../../components/agent/PersonaBinding'
import { usePersonaInjection } from '../../components/agent/PersonaInjection'
import { WorkbenchTaskHistory } from '../tasks/WorkbenchTaskHistory'
import { useWorkbenchTaskActions, useWorkbenchTasks, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import type { ScriptTaskPayload } from '../../services/workbench-tasks'
import {
  createAgentClients,
  createMemorySink,
  isAbortError,
  type AgentRunSnapshot,
} from '../../agent'
import { downloadText } from '../../services/browser'
import { toastSuccess } from '../../lib/toast'
import { SCRIPT_FLOW_ID, SCRIPT_STAGES } from './agent/stages'
import { SCRIPT_PROGRESS_STAGE_IDS } from './agent/stages'
import { generateAlternate, runScriptFlow, spokenOf } from './agent/script-flow'
import { createScriptMockResponder } from './agent/demo-responder'
import { scriptRouteOf, scriptTaskTitle } from './agent/task-meta'
import {
  LIVE_DURATIONS,
  VIDEO_DURATIONS,
  videoTargetChars,
  type ScriptConfig,
  type ScriptGeneratePayload,
  type ScriptMode,
  type ScriptSegment,
} from './agent/types'
import ScriptForm from './components/ScriptForm'
import ScriptLabWizardLayout from './components/ScriptLabWizardLayout'
import ScriptPreviewRail from './components/ScriptPreviewRail'
import ScriptStepPills from './components/ScriptStepPills'
import ScriptStepHeader from './components/ScriptStepHeader'
import VideoResult from './components/VideoResult'
import LiveResult from './components/LiveResult'
import Teleprompter from './components/Teleprompter'
import { buildScriptMarkdown, scriptMarkdownFilename } from './lib/script-markdown'
import { buildTeleprompterHtml, teleprompterFilename } from './lib/export-teleprompter'
import { deriveScriptPrefillPatch } from '../../lib/persona-form-prefill'
import { usePersonaFormPrefill } from '../../hooks/usePersonaFormPrefill'
import { useWorkbenchSessionTask } from '../../hooks/useWorkbenchSessionTask'
import { ResultActions } from '../../components/WorkbenchUI'
import {
  DEV_VIDEO_SCRIPT_FIXTURE,
  DEV_LIVE_SCRIPT_FIXTURE,
  DEV_VIDEO_RESULT_MOCK,
  DEV_LIVE_RESULT_MOCK,
} from './dev/dev-fixtures'
import './script-lab.css'

function defaultConfig(mode: ScriptMode): ScriptConfig {
  const isVideo = mode === 'video'
  return {
    mode,
    product: '',
    intro: '',
    durationSec: isVideo ? VIDEO_DURATIONS[1].seconds : LIVE_DURATIONS[2].seconds,
    goal: isVideo ? '获客' : '成交',
    structure: { kind: 'auto' },
    audience: '',
    sellingPoints: '',
    pain: '',
    strength: 50,
    platform: '抖音',
    mustWords: [],
    bannedWords: [],
    interactionNodes: 3,
  }
}

const VIDEO_EXAMPLES = ['儿童保温杯', '租房投影仪', '宠物自动喂食器']
const LIVE_EXAMPLES = ['秋冬护手霜', '平价羽绒服', '办公室颈椎枕']

/**
 * 爆款脚本工作台。
 *
 * 一次生成 = 一条真实 agent loop（预填→策划→结构→编剧→硬校验→评审→改写→定稿），
 * 页面只负责三件事：收一个产品名、把过程**可见地**跑出来、把成稿交到用户手里。
 *
 * 布局（2026-10-12 重做）：**纵向单列**，输入在上、结果在下。
 * 原先的左右拖拽分栏已删除 —— 输入区本来就很矮，拖拽只会挤压结果预览。
 *
 * 过程面板只展示「正在进行到哪一步」与流式输出，**不展示提示词**。
 */
export default function ScriptLabPage({ mode }: { mode: ScriptMode }) {
  const { t: tw, i18n } = useTranslation('workbench')
  const { t: ts } = useTranslation('scriptLab')
  const isEn = i18n.language?.startsWith('en')
  const isVideo = mode === 'video'
  const platformLabels: Record<string, string> = {
    抖音: ts('platform.douyin'),
    视频号: ts('platform.wechatChannel'),
    小红书: ts('platform.xiaohongshu'),
    快手: ts('platform.kuaishou'),
    淘宝: ts('platform.taobao'),
  }
  const goalLabels: Record<string, string> = {
    获客: ts('goal.acquisition'),
    流量: ts('goal.traffic'),
    成交: ts('goal.conversion'),
  }
  const demo = createAgentClients().isMock
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [config, setConfig] = useState<ScriptConfig>(() => defaultConfig(mode))
  const [payload, setPayload] = useState<ScriptGeneratePayload | null>(null)
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [edited, setEdited] = useState<Record<string, string>>({})
  const [altText, setAltText] = useState<Record<string, string>>({})
  const [prompterOpen, setPrompterOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  /** 三步向导当前步：0 产品 / 1 规格与结构 / 2 更多设置 */
  const [step, setStep] = useState(0)
  /** 左侧脚本预览轨收起（对标人设页预览卡） */
  const [previewCollapsed, setPreviewCollapsed] = useState(false)
  /** 顶部输入向导整块收起（支持已有成稿时沉浸查看分镜/提词器，避免占屏） */
  const [inputCollapsed, setInputCollapsed] = useState(false)
  /** 本次提交时间：过程卡片卡头回显「提交于 …」 */
  const [submittedAt, setSubmittedAt] = useState<number | undefined>(undefined)
  /** 流式输出缓冲：只用于「让等待可解释」，不落库、不导出 */
  const [streamText, setStreamText] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const submittedConfigRef = useRef<ScriptConfig | null>(null)
  const personaInject = usePersonaInjection()

  const patchConfig = useCallback((next: Partial<ScriptConfig>) => {
    setConfig((prev) => ({ ...prev, ...next }))
  }, [])

  const deriveScriptPrefill = useCallback(
    (record: NonNullable<typeof personaInject.record>) =>
      deriveScriptPrefillPatch(record, config),
    [config],
  )

  usePersonaFormPrefill({
    loading: personaInject.loading,
    enabled: personaInject.enabled,
    record: personaInject.record,
    derive: deriveScriptPrefill,
    applyPatch: patchConfig,
  })

  const memorySink = useMemo(() => createMemorySink(SCRIPT_FLOW_ID), [])
  const { enqueueScriptGenerate, getPayload, removeTask, cancelTask } = useWorkbenchTaskActions()
  const scriptTasks = useWorkbenchTasks({ kind: 'script_generate' })

  const route = scriptRouteOf(mode)
  const pageHistoryItems = useMemo(
    () => scriptTasks.filter((task) => task.meta?.mode === mode),
    [scriptTasks, mode],
  )
  const historyBadge = useMemo(
    () => pageHistoryItems.filter((task) => task.status === 'queued' || task.status === 'running').length,
    [pageHistoryItems],
  )
  /** 当前本页正在跑的那条后台任务：过程卡片据此取消 + 轮询快照 */
  const activeTask = useMemo(
    () =>
      scriptTasks
        .filter((task) => task.meta?.mode === mode && (task.status === 'queued' || task.status === 'running'))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0],
    [scriptTasks, mode],
  )
  const queueBusy = Boolean(activeTask)

  useEffect(() => memorySink.subscribe(setSnapshot), [memorySink])
  useEffect(() => () => abortRef.current?.abort(), [])

  // 后台任务执行中时轮询 payload，把执行器回写的 run 快照拿来驱动过程卡片。
  // 页内演示走 memorySink；入队任务走这里（演示模式不入队，两者互斥）。
  useEffect(() => {
    if (demo || busy || !activeTask) return
    let alive = true
    const poll = () => {
      void getPayload(activeTask.payloadId).then((data) => {
        if (!alive) return
        const result = data as ScriptTaskPayload | null
        if (result?.run?.stages?.length) setSnapshot(result.run)
      })
    }
    poll()
    const id = window.setInterval(poll, 1500)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [demo, busy, activeTask, getPayload])

  const applyScriptPayload = useCallback((result: ScriptTaskPayload | null): boolean => {
    if (!result?.segments?.length) return false
    setPayload(result)
    setSnapshot(result.run ?? null)
    setEdited({})
    setAltText({})
    setStreamText('')
    if (result.config) setConfig(result.config)
    setError('')
    return true
  }, [])

  const restoreScriptDraft = useCallback((result: ScriptTaskPayload | null) => {
    if (result?.config) setConfig(result.config)
    if (result?.run) setSnapshot(result.run)
  }, [])

  const {
    sessionTaskId,
    setSessionTaskId,
    clearSession,
    bindInFlightTask,
    markSessionSuccessHandled,
  } = useWorkbenchSessionTask<ScriptTaskPayload>({
    tasks: pageHistoryItems,
    activeTask,
    enabled: !demo,
    getPayload,
    applySuccessPayload: applyScriptPayload,
    restoreInFlightDraft: restoreScriptDraft,
    onBindInFlight: (task) => {
      setSubmittedAt(task.createdAt)
    },
    onAppliedSuccess: () => setPageView('work'),
  })

  // 切换模式时重置为对应模式的默认配置（视频/直播为独立路由实例，此处兜底）
  useEffect(() => {
    clearSession()
    setConfig(defaultConfig(mode))
    setPayload(null)
    setSnapshot(null)
    setEdited({})
    setAltText({})
    setStreamText('')
    setError('')
    setStep(0)
    setSubmittedAt(undefined)
  }, [mode, clearSession])

  const openHistoryTask = useCallback(
    async (task: WorkbenchTaskRecord) => {
      setSessionTaskId(task.id)
      if (task.status === 'queued' || task.status === 'running') {
        setPageView('work')
        setSubmittedAt(task.createdAt)
        setPayload(null)
        setSnapshot(null)
        setStreamText('')
        setError('')
        bindInFlightTask(task)
        return
      }
      if (task.status === 'failed' || task.status === 'cancelled') {
        const data = await getPayload(task.payloadId)
        const result = data as ScriptTaskPayload | null
        setPageView('work')
        setSubmittedAt(task.finishedAt ?? task.createdAt)
        setPayload(null)
        setSnapshot(result?.run ?? null)
        setStreamText('')
        setError(task.errorMessage ?? ts('runtime.taskIncomplete'))
        return
      }
      const data = await getPayload(task.payloadId)
      const result = data as ScriptTaskPayload | null
      if (!applyScriptPayload(result)) {
        setError(ts('runtime.taskResultMissing'))
        setPageView('work')
        return
      }
      markSessionSuccessHandled(task.finishedAt)
      setSubmittedAt(task.finishedAt ?? task.createdAt)
      setPageView('work')
    },
    [applyScriptPayload, bindInFlightTask, getPayload, markSessionSuccessHandled, setSessionTaskId],
  )

  const segments = payload?.segments ?? []
  const review = payload?.review?.items
  const rounds = payload?.rounds ?? []

  const spoken = useCallback(
    (seg: ScriptSegment) => spokenOf(seg, edited, altText),
    [edited, altText],
  )

  function patch(next: Partial<ScriptConfig>) {
    patchConfig(next)
  }

  async function start() {
    if (!config.product.trim()) {
      setError(ts('runtime.missingProduct'))
      return
    }
    setError('')
    setEdited({})
    setAltText({})
    setPayload(null)
    setSnapshot(null)
    setStreamText('')
    setSubmittedAt(Date.now())

    // 人设注入：开关关闭时**完全不注入**，不读取也不写进提示词。
    // 两路分别对应「怎么说」（提示词变量）与「我是谁」（背景上下文），见 PersonaInjection。
    const withPersona: ScriptConfig = {
      ...config,
      personaContent: personaInject.content,
      personaBackground: personaInject.background,
    }
    submittedConfigRef.current = withPersona

    if (!demo) {
      try {
        const id = await enqueueScriptGenerate({
          config: withPersona,
          route,
          title: scriptTaskTitle(config),
        })
        setSessionTaskId(id)
        setPageView('work')
      } catch (e) {
        setError(e instanceof Error ? e.message : ts('runtime.submitFailed'))
      }
      return
    }

    // 演示模式：在页内真实跑完整编排（不调用正式模型、不扣积分），带流式输出
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setBusy(true)
    try {
      const clients = createAgentClients({
        mockResponder: createScriptMockResponder({ product: config.product, mode }),
      })
      const result = await runScriptFlow({
        config: withPersona,
        clients,
        sink: memorySink.sink,
        signal: ac.signal,
        // 流式回调：内核按 chunk 推字符串，只保留尾部，够用户看到「正在写」
        onDelta: (chunk: string) => setStreamText((prev) => (prev + chunk).slice(-1200)),
      })
      setPayload(result)
      setSnapshot(result.run ?? null)
    } catch (e) {
      if (isAbortError(e)) return
      setError(e instanceof Error ? e.message : ts('runtime.generationFailed'))
    } finally {
      setBusy(false)
      setStreamText('')
    }
  }

  async function retryFromStage(stageId: string) {
    setError('')
    const sourceTask = scriptTasks.find((task) => task.id === sessionTaskId) ?? activeTask
    const stored = sourceTask
      ? (await getPayload(sourceTask.payloadId) as ScriptTaskPayload | null)
      : payload as ScriptTaskPayload | null
    const checkpointSnapshot = stored?.run ?? snapshot
    if (!checkpointSnapshot) {
      setError(ts('runtime.checkpointMissing'))
      return
    }

    if (demo) {
      const resumeConfig = stored?.config ?? submittedConfigRef.current
      if (!resumeConfig) {
        setError(ts('runtime.inputMissing'))
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setBusy(true)
      setPayload(null)
      setSnapshot(checkpointSnapshot)
      setStreamText('')
      setSubmittedAt(Date.now())
      try {
        const clients = createAgentClients({
          mockResponder: createScriptMockResponder({ product: resumeConfig.product, mode: resumeConfig.mode }),
        })
        const result = await runScriptFlow({
          config: resumeConfig,
          clients,
          sink: memorySink.sink,
          signal: ac.signal,
          resume: { fromStageId: stageId, snapshot: checkpointSnapshot },
          onDelta: (chunk: string) => setStreamText((prev) => (prev + chunk).slice(-1200)),
        })
        setPayload(result)
        setSnapshot(result.run ?? null)
      } catch (e) {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : ts('runtime.resumeFailed'))
      } finally {
        setBusy(false)
        setStreamText('')
      }
      return
    }

    if (!sourceTask || !stored?.config) {
      setError(ts('runtime.unsafeResume'))
      return
    }
    try {
      if (sourceTask.status === 'queued' || sourceTask.status === 'running') {
        await cancelTask(sourceTask.id)
      }
      setPayload(null)
      setSnapshot(checkpointSnapshot)
      setStreamText('')
      setSubmittedAt(Date.now())
      const id = await enqueueScriptGenerate({
        config: stored.config,
        resumeFromStageId: stageId,
        resumeSnapshot: checkpointSnapshot,
        route: sourceTask.route,
        title: `${scriptTaskTitle(stored.config)}（续跑）`,
      })
      setSessionTaskId(id)
      setPageView('work')
    } catch (e) {
      setError(e instanceof Error ? e.message : ts('runtime.resumeTaskFailed'))
    }
  }

  async function alternate(seg: ScriptSegment) {
    const clients = createAgentClients({
      mockResponder: createScriptMockResponder({ product: config.product, mode }),
    })
    const result = await generateAlternate({ config, segment: seg, clients })
    setAltText((prev) => ({ ...prev, [seg.id]: result.spoken }))
  }

  function resetAll() {
    abortRef.current?.abort()
    clearSession()
    setConfig(defaultConfig(mode))
    setPayload(null)
    setSnapshot(null)
    setEdited({})
    setAltText({})
    setStreamText('')
    setError('')
    setStep(0)
    setInputCollapsed(false)
    setSubmittedAt(undefined)
  }

  /** 开发环境专享：一键注入高完成度真实业务调试示例 */
  function loadDevFixture() {
    const fixture = isVideo ? DEV_VIDEO_SCRIPT_FIXTURE : DEV_LIVE_SCRIPT_FIXTURE
    setConfig((prev) => ({ ...prev, ...fixture }))
    setStep(0)
    setInputCollapsed(false)
  }

  /** 开发环境专享：一键模拟注入完整生成成稿（用于快速调结果样式与提词） */
  function loadDevResultMock() {
    const resultMock = isVideo ? DEV_VIDEO_RESULT_MOCK : DEV_LIVE_RESULT_MOCK
    setConfig(resultMock.config)
    setPayload(resultMock)
    setSnapshot(null)
    setEdited({})
    setAltText({})
    setError('')
    setInputCollapsed(true)
  }

  const markdown = payload
    ? buildScriptMarkdown({
        config: payload.config,
        segments,
        spokenOf: spoken,
        rounds,
        demo,
      })
    : ''

  const finalRound = rounds.at(-1)
  const running = busy || queueBusy
  const stale = Boolean(payload) && config.product.trim() !== (payload?.config.product ?? '').trim()
  /**
   * 「跑起来之后失败」才交给失败卡片；「产品名为空」这类表单错误留在向导页脚。
   * 区分依据：产品名校验在 start() 最前面 return，不会写 submittedAt；
   * 真正提交失败发生在 setSubmittedAt 之后。否则同一条错误会被两处各显示一次。
   */
  const runFailed = !running && !payload && Boolean(error) && Boolean(submittedAt)
  /** 下方已有过程卡片或成稿区时，才提供收起输入向导 */
  const hasBottomWorkbenchContent = Boolean(payload) || running || runFailed

  useEffect(() => {
    if (!hasBottomWorkbenchContent && inputCollapsed) {
      setInputCollapsed(false)
    }
  }, [hasBottomWorkbenchContent, inputCollapsed])

  /** 过程卡片摘要用的时长文案（与表单同源，避免两处口径漂移） */
  const durationLabelSource =
    (isVideo ? VIDEO_DURATIONS : LIVE_DURATIONS).find((d) => d.seconds === config.durationSec)?.label ?? `${config.durationSec}秒`
  const durationLabelParts = durationLabelSource.match(/^(\d+)(.*)$/u)
  const durationChipLabel = durationLabelParts
    ? `${durationLabelParts[1]} ${durationLabelParts[2] === '秒' ? ts('unit.seconds') : durationLabelParts[2] === '分钟' ? ts('unit.minutes') : ts('unit.hours')}`
    : durationLabelSource
  /** 已改的选填项数量，只用于卡头摘要，不参与生成逻辑 */
  const changedCount = [
    config.intro?.trim(),
    config.audience?.trim(),
    config.sellingPoints?.trim(),
    config.pain?.trim(),
    config.strength !== 50 ? 'x' : '',
    config.mustWords?.length ? 'x' : '',
    config.bannedWords?.length ? 'x' : '',
    config.refGood?.trim(),
    config.refCompetitor?.trim(),
    !isVideo && config.offer?.trim(),
    !isVideo && (config.interactionNodes ?? 3) !== 3 ? 'x' : '',
  ].filter(Boolean).length
  /** 页面文案里的专家数与环节数：由 SCRIPT_STAGES 推导，不在任何地方手写数字。 */
  const flowCounts = agentFlowCounts(SCRIPT_STAGES)
  const flowVars = { experts: flowCounts.expert, stages: flowCounts.total }

  const wizardSteps = isVideo
    ? [
        { id: 'product', label: ts('steps.videoProduct'), description: ts('steps.videoProductDesc') },
        { id: 'spec', label: ts('steps.videoSpec'), description: ts('steps.videoSpecDesc') },
        { id: 'more', label: ts('steps.videoDetails'), description: ts('steps.detailsDesc') },
      ]
    : [
        { id: 'product', label: ts('steps.videoProduct'), description: ts('steps.videoProductDesc') },
        { id: 'spec', label: ts('steps.liveSpec'), description: ts('steps.liveSpecDesc') },
        { id: 'more', label: ts('steps.liveDetails'), description: ts('steps.detailsDesc') },
      ]

  return (
    <Page
      moduleId={mode === 'live' ? 'live-script' : 'video-script'}
      title={isVideo ? tw('navVideoScript') : tw('navLiveScript')}
      description={
        isVideo
          ? tw('scriptVideoPageDesc', flowVars)
          : tw('scriptLivePageDesc', flowVars)
      }
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchPageChromeLeading>
          <AgentFlowExplain defs={SCRIPT_STAGES} lang={isEn ? 'en' : 'zh'} />
          <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyBadge={historyBadge} />
        </WorkbenchPageChromeLeading>
      }
      actions={
        <WorkbenchPageChromeActions>
          {pageView === 'work' && previewCollapsed && !inputCollapsed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="sl-wiz-rail-reopen"
              aria-label={ts('form.previewExpand')}
              onClick={() => setPreviewCollapsed(false)}
            >
              <span>{ts('form.preview')}</span>
            </Button>
          ) : null}
          {/* 输入向导整块折叠 / 展开：仅下方已有过程或成稿时显示 */}
          {pageView === 'work' && hasBottomWorkbenchContent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInputCollapsed((prev) => !prev)}
              aria-label={inputCollapsed ? '展开输入面板' : '收起输入面板'}
              title={inputCollapsed ? '展开上方配置向导' : '折叠上方配置向导，沉浸查看产物'}
            >
              {inputCollapsed ? (
                <>
                  <PanelTopOpen className="h-4 w-4" aria-hidden="true" />
                  <span>展开输入配置</span>
                </>
              ) : (
                <>
                  <PanelTopClose className="h-4 w-4" aria-hidden="true" />
                  <span>收起输入配置</span>
                </>
              )}
            </Button>
          ) : null}
          {/* 开发环境专享调试数据按钮 */}
          {import.meta.env.DEV && pageView === 'work' ? (
            <WorkbenchDevToolsMenu
              items={[
                {
                  id: 'script-dev-fill',
                  label: `填入${isVideo ? '水煮肉片' : '全家桶'}示例`,
                  onSelect: loadDevFixture,
                },
                {
                  id: 'script-dev-result',
                  label: '模拟产出结果',
                  onSelect: loadDevResultMock,
                },
              ]}
            />
          ) : null}
          {pageView === 'work' ? (
            <>
              <PersonaBinding
                options={personaInject.options}
                value={personaInject.persona}
                onChange={(persona) => personaInject.selectPersona(persona?.id ?? null)}
              />
            </>
          ) : null}
          {pageView === 'history' ? (
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
          ) : null}
        </WorkbenchPageChromeActions>
      }
      defaultWidth={1240}
      minWidth={880}
      layoutClassName={`script-lab-layout script-lab-layout--${mode}`}
    >
      <div className="script-lab" data-mode={mode}>
        {pageView === 'history' ? (
          <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
            <WorkbenchTaskHistory
              items={pageHistoryItems}
              onRemove={removeTask}
              onSelect={(task) => void openHistoryTask(task)}
              selectedId={sessionTaskId}
              openLabel={tw('pageHistoryOpen')}
              emptyHint={tw('pageHistoryEmpty')}
            />
          </WorkbenchPageHistoryPanel>
        ) : (
          <div className="sl-stack">
            {/* 一、输入：三步向导（收起后由页头「展开输入配置」恢复，不再重复一条摘要栏） */}
            {!inputCollapsed ? (
              <ScriptLabWizardLayout
                railCollapsed={previewCollapsed}
                rail={
                  <ScriptPreviewRail
                    mode={mode}
                    config={config}
                    personaActive={Boolean(personaInject.content)}
                    wizardStep={step}
                    onCollapse={() => setPreviewCollapsed(true)}
                  />
                }
              >
                <InputWizard
                  layout="scriptLab"
                  goOnLastStepOnly
                  nextDisabled={step === 0 && !config.product.trim()}
                  steps={wizardSteps}
                  stepsSlot={
                    <ScriptStepPills
                      steps={wizardSteps}
                      active={step}
                      onStepChange={setStep}
                      onReset={resetAll}
                    />
                  }
                  headerSlot={<ScriptStepHeader mode={mode} step={step} />}
                  active={step}
                  onStepChange={setStep}
                  goLabel={ts(isVideo ? 'form.generateVideo' : 'form.generateLive')}
                  busyLabel={ts('form.generating')}
                  busy={running}
                  goDisabled={!config.product.trim()}
                  onGo={() => void start()}
                  nextLabel={step === 1 ? ts('form.nextDetails') : ts('form.next')}
                  error={runFailed ? undefined : error}
                  ariaLabel={ts(isVideo ? 'form.wizardVideoAria' : 'form.wizardLiveAria')}
                >
                  <ScriptForm
                    mode={mode}
                    config={config}
                    onChange={patch}
                    onSubmit={() => void start()}
                    busy={running}
                    demo={demo}
                    stale={stale}
                    autofill={payload?.autofill ?? null}
                    examples={isVideo ? VIDEO_EXAMPLES : LIVE_EXAMPLES}
                    onUseExample={(text) => patch({ product: text })}
                      step={step}
                      hideSubmit
                      hideFooter
                    />
                </InputWizard>
              </ScriptLabWizardLayout>
            ) : null}

            {/* 二、过程大卡片：默认折叠，只回显输入摘要 + 步骤 + 流式正文 */}
            {running && !payload ? (
              <WorkflowRunCard
                title={ts(isVideo ? 'title.video' : 'title.live')}
                status={busy || snapshot?.stages?.length ? 'running' : 'queued'}
                chips={[
                  config.product.trim(),
                  ts('runtime.durationSummary', { duration: durationChipLabel }),
                  ts('runtime.goalPlatformSummary', {
                    goal: goalLabels[config.goal] ?? config.goal,
                    platform: platformLabels[config.platform] ?? config.platform,
                  }),
                  changedCount ? ts('runtime.changedSummary', { count: changedCount }) : '',
                ].filter(Boolean) as string[]}
                submittedAt={submittedAt}
                roundText={
                  rounds.length
                    ? ts('runtime.round', { count: rounds.length })
                    : snapshot?.round
                      ? ts('runtime.round', { count: snapshot.round })
                      : undefined
                }
                mock={demo}
                streamingText={streamText || undefined}
                snapshot={snapshot}
                defs={SCRIPT_STAGES}
                progressIds={SCRIPT_PROGRESS_STAGE_IDS}
                detailTitle={ts('runtime.detailsTitle')}
                onCancel={() => {
                  if (busy) abortRef.current?.abort()
                  else if (activeTask) void cancelTask(activeTask.id)
                }}
                onRetry={() => void start()}
                onRetryStage={(stageId) => void retryFromStage(stageId)}
              />
            ) : null}

            {/* 页内失败：如实展示真实错误，不编造结果 */}
            {runFailed ? (
              <WorkflowRunCard
                title={ts(isVideo ? 'title.video' : 'title.live')}
                status="failed"
                chips={[config.product.trim(), `目标 ${config.goal}`].filter(Boolean) as string[]}
                submittedAt={submittedAt}
                mock={demo}
                snapshot={snapshot}
                defs={SCRIPT_STAGES}
                progressIds={SCRIPT_PROGRESS_STAGE_IDS}
                detailTitle={ts('runtime.detailsTitle')}
                error={error}
                onRetry={() => void start()}
                retryLabel={ts('runtime.retry')}
                onRetryStage={(stageId) => void retryFromStage(stageId)}
              />
            ) : null}

            {/* 四、结果：生成中 / 失败时由 WorkflowRunCard 占位，不再叠一层空态卡 */}
            {payload ? (
              <div className="sl-out">
                <div className="sl-badges">
                  <strong>{payload.config.product}</strong>
                  <span>
                    {ts('runtime.goalPlatformSummary', {
                      goal: goalLabels[payload.config.goal] ?? payload.config.goal,
                      platform: platformLabels[payload.config.platform] ?? payload.config.platform,
                    })}{' · '}
                    {isVideo
                      ? ts('runtime.videoDurationEstimate', {
                          seconds: payload.config.durationSec,
                          count: videoTargetChars(payload.config.durationSec),
                        })
                      : ts('runtime.liveDuration', { count: Math.round(payload.config.durationSec / 60) })}
                    {payload.config.audience?.trim()
                      ? ` · ${ts('runtime.audienceSummary', { audience: payload.config.audience.trim() })}`
                      : ''}
                  </span>
                  {demo || payload.usedMock ? <span className="sl-badge sl-badge--demo">{ts('runtime.demoBadge')}</span> : null}
                  {payload.fallback ? <span className="sl-badge sl-badge--warn">{ts('runtime.fallbackBadge')}</span> : null}
                  <span className={`sl-badge ${payload.hardCheck?.pass ? 'sl-badge--ok' : 'sl-badge--warn'}`}>
                    {payload.hardCheck?.pass
                      ? ts('runtime.compliancePassed')
                      : ts('runtime.complianceNeedsRevision', { count: payload.hardCheck?.hits.length ?? 0 })}
                  </span>
                  {payload.config.personaContent ? <span className="sl-badge">{ts('runtime.personaInjected')}</span> : null}
                </div>

                <AgentMetrics
                  label={ts('runtime.metrics')}
                  items={[
                    {
                      label: ts('runtime.retention'),
                      value: finalRound ? `${finalRound.averageRetention}%` : '—',
                      hint: finalRound ? ts('runtime.retentionTarget') : ts('runtime.reviewMissing'),
                      tone: finalRound && finalRound.averageRetention >= 70 ? 'good' : 'warn',
                    },
                    {
                      label: ts('runtime.conversion'),
                      value: finalRound ? `${finalRound.conversion}` : '—',
                      hint: '0–100',
                    },
                    {
                      label: ts('runtime.overallScore'),
                      value: finalRound ? `${finalRound.composite}` : '—',
                      hint: ts('runtime.scoreHint'),
                    },
                    {
                      label: ts('runtime.wordCount'),
                      value: `${payload.hardCheck?.charCount ?? 0}`,
                      hint: isVideo
                        ? ts('runtime.targetWords', { count: videoTargetChars(payload.config.durationSec) })
                        : ts('runtime.spokenWordCount'),
                    },
                    {
                      label: ts('runtime.refinementRounds'),
                      value: `${rounds.length}`,
                      hint: ts('runtime.refinementHint'),
                    },
                  ]}
                />

                {payload.hardCheck && !payload.hardCheck.pass ? (
                  <div className="sl-insp">
                    <div className="sl-insp__head">
                      <b>{ts('runtime.needsRevision')}</b>
                      <span>{ts('runtime.hardCheckHint')}</span>
                    </div>
                    {payload.hardCheck.hits.map((hit, i) => (
                      <p key={`${hit.label}-${i}`} className="sl-insp__text">
                        {hit.label}：{hit.detail}
                      </p>
                    ))}
                  </div>
                ) : null}

                {isVideo ? (
                  <VideoResult
                    segments={segments}
                    review={review}
                    spokenOf={spoken}
                    onEdit={(id, next) => setEdited((prev) => ({ ...prev, [id]: next }))}
                    onAlternate={alternate}
                    editedIds={new Set(Object.keys(edited))}
                    altIds={new Set(Object.keys(altText))}
                  />
                ) : (
                  <LiveResult
                    segments={segments}
                    review={review}
                    spokenOf={spoken}
                    onEdit={(id, next) => setEdited((prev) => ({ ...prev, [id]: next }))}
                    onAlternate={alternate}
                    editedIds={new Set(Object.keys(edited))}
                    altIds={new Set(Object.keys(altText))}
                    onOpenPrompter={() => setPrompterOpen(true)}
                  />
                )}

                <ResultActions
                  text={markdown}
                  filename={scriptMarkdownFilename(payload.config)}
                  leading={
                    <>
                      <Button
                        type="button"
                        onClick={() => setPrompterOpen(true)}
                        title={
                          isEn
                            ? 'Fullscreen teleprompter (space to play/pause, wheel to adjust speed)'
                            : '打开全屏提词器（支持空格播放/暂停、键盘滚轮调速）'
                        }
                      >
                        <Maximize2 aria-hidden="true" />
                        {ts('runtime.openTeleprompter')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          downloadText(
                            buildTeleprompterHtml({
                              config: payload.config,
                              segments,
                              spokenOf: spoken,
                              generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                            }),
                            teleprompterFilename(payload.config),
                            'text/html;charset=utf-8',
                          )
                          toastSuccess(isEn ? 'Teleprompter HTML exported' : '已导出提词器 HTML')
                        }}
                        title={
                          isEn
                            ? 'Export single-file HTML for offline use on tablet or phone'
                            : '导出单文件 HTML 网页，离线/平板/手机免网络打开'
                        }
                      >
                        <FileCode aria-hidden="true" />
                        {ts('runtime.exportTeleprompter')}
                      </Button>
                    </>
                  }
                >
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCanvasOpen(true)}
                    title={ts('runtime.flowCanvasTitle')}
                  >
                    <Network aria-hidden="true" />
                    {ts('runtime.flowCanvas')}
                  </Button>
                </ResultActions>

                {rounds.length ? <RetentionCurve rounds={rounds} segments={segments} /> : null}

                {/* 极简流程提示条：指引用户按需查看沉浸式全屏工作流画布 */}
                {snapshot ? (
                  <div className="sl-flow-bar" role="status">
                    <span className="sl-flow-bar__info">
                      {ts('runtime.flowSummary', { count: snapshot.stages.length || SCRIPT_STAGES.length })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {prompterOpen && payload ? (
        <Teleprompter
          config={payload.config}
          segments={segments}
          spokenOf={spoken}
          onClose={() => setPrompterOpen(false)}
        />
      ) : null}

      <AgentWorkflowCanvas
        open={canvasOpen}
        onOpenChange={setCanvasOpen}
        title={ts(isVideo ? 'runtime.videoFlowTitle' : 'runtime.liveFlowTitle')}
        defs={SCRIPT_STAGES}
        snapshot={snapshot}
        onRetryStage={(stageId) => void retryFromStage(stageId)}
      />
    </Page>
  )
}
