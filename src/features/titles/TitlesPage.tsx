import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2, Network, PanelTopClose, PanelTopOpen, RotateCcw } from 'lucide-react'
import { ChatPromptAttachments, useChatPromptAttachments } from '../../components/ChatPromptAttachments'
import { prepareAttachmentsFromItems, type StoredChatAttachment } from '../../lib/chat-attachments/prepare'
import { Button } from '@no996/ui/button'
import { Card } from '@no996/ui/card'
import { Textarea } from '@no996/ui/textarea'
import {
  Page,
  ResultActions,
  WorkbenchPageChromeActions,
  WorkbenchPageChromeLeading,
} from '../../components/WorkbenchUI'
import { WorkbenchDevToolsMenu } from '../../components/WorkbenchDevToolsMenu'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import type { AgentMetric } from '../../components/agent/AgentMetrics'
import { AgentFlowExplain, agentFlowCounts } from '../../components/agent/AgentFlowExplain'
import WorkflowRunCard from '../../components/agent/WorkflowRunCard'
import { AgentWorkflowCanvas } from '../../components/agent/AgentWorkflowCanvas'
import PersonaBinding from '../../components/agent/PersonaBinding'
import { usePersonaInjection } from '../../components/agent/PersonaInjection'
import { deriveTitlesPrefillPatch } from '../../lib/persona-form-prefill'
import { usePersonaFormPrefill } from '../../hooks/usePersonaFormPrefill'
import { useWorkbenchSessionTask } from '../../hooks/useWorkbenchSessionTask'
import { useNotifyOperationMessage } from '../../lib/toast'
import { WorkbenchTaskHistory } from '../tasks/WorkbenchTaskHistory'
import { useWorkbenchTaskActions, useWorkbenchTasks, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import type { TitlesTaskPayload } from '../../services/workbench-tasks'
import { createAgentClients, createMemorySink, isAbortError, type AgentRunSnapshot } from '../../agent'
import { TITLES_FLOW_ID, TITLES_PROGRESS_STAGE_IDS, TITLES_STAGES } from './agent/stages'
import { runTitlesFlow } from './agent/titles-flow'
import { createTitlesMockResponder, mockSearchFor } from './agent/demo-responder'
import { PLATFORM_OPTIONS, TITLE_STOP, type TargetPlatform, type UserInputSpec } from './agent/types'
import { buildTitlesMarkdown, titlesMarkdownFilename } from './agent/export-markdown'
import { TitleResultList } from './components/TitleResultList'
import { TitleEvolutionChart } from './components/TitleEvolutionChart'
import { TitlesResultViewTabs, type TitlesResultView } from './components/TitlesResultViewTabs'
import './titles.css'

const EXAMPLES: Array<{ audience: string; topic: string; platform: TargetPlatform; tone: number }> = [
  { audience: '上班族', topic: '早八通勤穿搭', platform: '小红书', tone: 50 },
  { audience: '新手博主', topic: '短视频选题流程', platform: '抖音', tone: 65 },
  { audience: '职场新人', topic: '三个月减脂记录', platform: 'B站', tone: 40 },
]

/**
 * 爆款标题工作台。
 *
 * 设计（2026-10-12 重做，对齐「接力进化版」参考稿）：
 * - 输入区为**单页表单**：一句式受众/主题 + 平台与强度 + 选填补充，无分步向导。
 * - 平台是胶囊按钮，强度是滑杆并给出「克制 / 抓人 / 炸裂」的中文判断。
 * - 示例是行内文字，不是下拉按钮。
 * - 人设默认注入，开关在页面右上角；关掉则本页完全不注入。
 * - 过程面板只显示步骤与流式输出，**不显示提示词**。
 */
export default function TitlesPage() {
  const { t, i18n } = useTranslation('workbench')
  const isEn = i18n.language?.startsWith('en')
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [resultView, setResultView] = useState<TitlesResultView>('list')

  const [audience, setAudience] = useState(() => (isEn ? 'Office workers' : '上班族'))
  const [topic, setTopic] = useState(() => (isEn ? 'Morning commute outfits' : '早八通勤穿搭'))
  const [platform, setPlatform] = useState<TargetPlatform>('小红书')
  const [platformMenuOpen, setPlatformMenuOpen] = useState(false)
  const [toneIntensity, setToneIntensity] = useState(50)
  const [supplement, setSupplement] = useState('')
  /** 本次提交时间：过程卡片卡头回显「提交于 …」 */
  const [submittedAt, setSubmittedAt] = useState<number | undefined>(undefined)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useNotifyOperationMessage(error, 'error', 'titles-generate')
  const [streamText, setStreamText] = useState('')
  const [payload, setPayload] = useState<TitlesTaskPayload | null>(null)
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [inputCollapsed, setInputCollapsed] = useState(false)

  const platformDropdownRef = useRef<HTMLDivElement>(null)
  const {
    items: materialAttachments,
    setItems: setMaterialAttachments,
    clear: clearMaterialAttachments,
  } = useChatPromptAttachments()
  const abortRef = useRef<AbortController | null>(null)
  const submittedInputRef = useRef<{ input: UserInputSpec; chatAttachments?: StoredChatAttachment[] } | null>(null)
  const memorySink = useMemo(() => createMemorySink(TITLES_FLOW_ID), [])
  const personaInject = usePersonaInjection()

  const deriveTitlesPrefill = useCallback(
    (record: NonNullable<typeof personaInject.record>) =>
      deriveTitlesPrefillPatch(record, { audience, supplement }),
    [audience, supplement],
  )

  const applyTitlesPrefill = useCallback((patch: { audience?: string; supplement?: string }) => {
    if (patch.audience !== undefined) setAudience(patch.audience)
    if (patch.supplement !== undefined) setSupplement(patch.supplement)
  }, [])

  usePersonaFormPrefill({
    loading: personaInject.loading,
    enabled: personaInject.enabled,
    record: personaInject.record,
    derive: deriveTitlesPrefill,
    applyPatch: applyTitlesPrefill,
  })

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (platformDropdownRef.current && !platformDropdownRef.current.contains(e.target as Node)) {
        setPlatformMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { enqueueTitlesGenerate, getPayload, removeTask, cancelTask } = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks({ kind: 'titles_generate' })
  const demo = createAgentClients().isMock

  const historyBadge = useMemo(
    () => tasks.filter((task) => task.status === 'queued' || task.status === 'running').length,
    [tasks],
  )
  /** 当前正在跑的那条后台任务（没有则为 undefined）：过程卡片据此做取消与轮询 */
  const activeTask = useMemo(
    () =>
      tasks
        .filter((task) => task.status === 'queued' || task.status === 'running')
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0],
    [tasks],
  )
  const queueBusy = Boolean(activeTask)

  useEffect(() => memorySink.subscribe(setSnapshot), [memorySink])
  useEffect(() => () => abortRef.current?.abort(), [])

  // 后台任务执行中时轮询它的 payload，把执行器回写的 run 快照拿来驱动过程卡片。
  // 页内演示走 memorySink；入队任务走这里。两者互斥（demo 入队不走队列）。
  // 刷新后从后台任务恢复提交时间与过程快照（与轮询互补，首帧不等 stages.length）
  useEffect(() => {
    if (demo || busy || !activeTask) return
    setSubmittedAt((prev) => prev ?? activeTask.createdAt)
    void getPayload(activeTask.payloadId).then((data) => {
      const result = data as TitlesTaskPayload | null
      if (result?.run) setSnapshot(result.run)
    })
  }, [demo, busy, activeTask?.id, activeTask, getPayload])

  useEffect(() => {
    if (demo || busy || !activeTask) return
    let alive = true
    const poll = () => {
      void getPayload(activeTask.payloadId).then((data) => {
        if (!alive) return
        const result = data as TitlesTaskPayload | null
        if (result?.run) setSnapshot(result.run)
      })
    }
    poll()
    const pollMs = canvasOpen ? 400 : 800
    const id = window.setInterval(poll, pollMs)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [demo, busy, activeTask, getPayload, canvasOpen])

  const applyTitlesPayload = useCallback((result: TitlesTaskPayload | null): boolean => {
    if (!result?.candidates?.length) return false
    setPayload(result)
    setSnapshot(result.run ?? null)
    setStreamText('')
    setSelectedCandidateId(result.candidates.find((c) => c.isRecommended)?.id ?? null)
    const input = result.input
    if (input) {
      setAudience(input.audience)
      setTopic(input.topic)
      setPlatform(input.platform)
      setToneIntensity(input.toneIntensity)
      setSupplement(input.supplement ?? '')
    }
    setError('')
    return true
  }, [])

  const restoreTitlesDraft = useCallback((result: TitlesTaskPayload | null) => {
    const input = result?.input
    if (input) {
      setAudience(input.audience)
      setTopic(input.topic)
      setPlatform(input.platform)
      setToneIntensity(input.toneIntensity)
      setSupplement(input.supplement ?? '')
    }
    if (result?.run) setSnapshot(result.run)
  }, [])

  const {
    sessionTaskId,
    setSessionTaskId,
    clearSession,
    bindInFlightTask,
    markSessionSuccessHandled,
  } = useWorkbenchSessionTask<TitlesTaskPayload>({
    tasks,
    activeTask,
    enabled: !demo,
    getPayload,
    applySuccessPayload: applyTitlesPayload,
    restoreInFlightDraft: restoreTitlesDraft,
    onBindInFlight: (task) => {
      setSubmittedAt(task.createdAt)
    },
    onAppliedSuccess: () => setPageView('work'),
  })

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
        const result = data as TitlesTaskPayload | null
        setPageView('work')
        setSubmittedAt(task.finishedAt ?? task.createdAt)
        setPayload(null)
        setSnapshot(result?.run ?? null)
        setStreamText('')
        setError(task.errorMessage ?? '该次生成未完成，可从已保存步骤继续。')
        return
      }
      const data = await getPayload(task.payloadId)
      const result = data as TitlesTaskPayload | null
      if (!applyTitlesPayload(result)) {
        setError('找不到该次的生成结果，可能已被清理。')
        setPageView('work')
        return
      }
      markSessionSuccessHandled(task.finishedAt)
      setSubmittedAt(task.finishedAt ?? task.createdAt)
      setPageView('work')
    },
    [applyTitlesPayload, bindInFlightTask, getPayload, markSessionSuccessHandled, setSessionTaskId],
  )

  const runInPage = useCallback(
    async (input: UserInputSpec, chatAttachments?: StoredChatAttachment[], resume?: { fromStageId: string; snapshot: AgentRunSnapshot }) => {
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setBusy(true)
      setStreamText('')
      try {
        const clients = createAgentClients({
          mockResponder: createTitlesMockResponder({
            topic: input.topic,
            audience: input.audience,
            platform: input.platform,
          }),
          mockSearch: mockSearchFor,
        })
        const result = await runTitlesFlow({
          input,
          chatAttachments,
          clients,
          sink: memorySink.sink,
          signal: ac.signal,
          resume,
          // 流式回调：内核按 chunk 推字符串，只留尾部
          onDelta: (chunk: string) => setStreamText((prev) => (prev + chunk).slice(-1200)),
        })
        setPayload(result)
        setSnapshot(result.run ?? null)
        setSelectedCandidateId(result.candidates.find((c) => c.isRecommended)?.id ?? null)
      } catch (e) {
        if (isAbortError(e)) return
        setError(e instanceof Error ? e.message : '生成失败，请重试。')
      } finally {
        setBusy(false)
        setStreamText('')
      }
    },
    [memorySink],
  )

  const materialFilledCount = useMemo(
    () => (supplement.trim() ? 1 : 0) + materialAttachments.length,
    [supplement, materialAttachments.length],
  )

  async function generate() {
    if (!topic.trim() || !audience.trim()) {
      setError('请先填写受众与主题。')
      return
    }
    setError('')
    setPayload(null)
    setSnapshot(null)
    setStreamText('')
    setSelectedCandidateId(null)
    setSubmittedAt(Date.now())

    let chatAttachments: StoredChatAttachment[] | undefined
    try {
      chatAttachments = materialAttachments.length
        ? await prepareAttachmentsFromItems(materialAttachments)
        : undefined
    } catch (e) {
      setError(e instanceof Error ? e.message : '附件解析失败，请重试。')
      return
    }

    // 人设注入：开关关闭时完全不注入。
    // 两路分别对应「怎么说」（提示词变量）与「我是谁」（背景上下文），见 PersonaInjection。
    const spec: UserInputSpec = {
      audience: audience.trim(),
      topic: topic.trim(),
      platform,
      toneIntensity,
      supplement: supplement.trim() || undefined,
      personaContent: personaInject.content,
      personaBackground: personaInject.background,
    }
    submittedInputRef.current = { input: spec, chatAttachments }

    if (demo) {
      await runInPage(spec, chatAttachments)
      clearMaterialAttachments()
      return
    }

    try {
      const id = await enqueueTitlesGenerate({
        input: spec,
        chatAttachments,
        route: '/workbench/titles',
        title: `${topic.trim()} · 标题方案`,
      })
      setSessionTaskId(id)
      clearMaterialAttachments()
      setPageView('work')
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败，请重试。')
    }
  }

  async function retryFromStage(stageId: string) {
    setError('')
    const sourceTask = tasks.find((task) => task.id === sessionTaskId) ?? activeTask
    const stored = sourceTask
      ? (await getPayload(sourceTask.payloadId) as TitlesTaskPayload | null)
      : payload
    const checkpointSnapshot = stored?.run ?? snapshot
    if (!checkpointSnapshot) {
      setError('找不到可恢复的流程检查点，请重新生成。')
      return
    }

    if (demo) {
      const submitted = submittedInputRef.current
      const input = stored?.input ?? submitted?.input
      const attachments = stored?.chatAttachments ?? submitted?.chatAttachments
      if (!input) {
        setError('找不到本次提交的输入，无法从该步骤继续。')
        return
      }
      setPayload(null)
      setSnapshot(checkpointSnapshot)
      setSubmittedAt(Date.now())
      await runInPage(input, attachments, { fromStageId: stageId, snapshot: checkpointSnapshot })
      return
    }

    if (!sourceTask || !stored?.input) {
      setError('找不到原任务输入，无法安全续跑。请重新提交生成。')
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
      const id = await enqueueTitlesGenerate({
        input: stored.input,
        chatAttachments: stored.chatAttachments,
        resumeFromStageId: stageId,
        resumeSnapshot: checkpointSnapshot,
        route: sourceTask.route,
        title: `${stored.input.topic} · 标题方案（续跑）`,
      })
      setSessionTaskId(id)
      setPageView('work')
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建续跑任务失败，请重试。')
    }
  }

  function reset() {
    abortRef.current?.abort()
    clearSession()
    setTopic('')
    setAudience('')
    setSupplement('')
    clearMaterialAttachments()
    setToneIntensity(50)
    setPlatform('小红书')
    setPayload(null)
    setSnapshot(null)
    setStreamText('')
    setError('')
    setSelectedCandidateId(null)
    setSubmittedAt(undefined)
  }

  /** 开发环境专享：一键模拟注入完整爆款标题生成结果 */
  function loadDevResultMock() {
    const mockPayload: TitlesTaskPayload = {
      input: {
        topic: '水煮肉片家庭做法',
        audience: '厨房新手、家庭掌勺人',
        platform: '小红书',
        toneIntensity: 65,
        supplement: '省时备料、配料干净、味道正宗',
      },
      requirement: {
        theme: '水煮肉片家庭做法',
        audience: '厨房新手、家庭掌勺人',
        painPoints: '做饭麻烦、调味难掌握',
        goal: '点击',
        platform: '小红书',
        toneIntensity: 65,
      },
      formulas: [],
      evidence: [],
      hardCheck: { pass: true, hits: [], mustFixIds: [], charCount: 33 },
      run: null,
      candidates: [
        {
          id: 1,
          formulaName: '对比反差+场景前置',
          sourceTag: '爆款案例库',
          title: '水煮肉片别出去吃了！教你一包调料搞定，肉嫩汤香比饭馆还下饭',
          charCount: 33,
          maxCharCount: 40,
          score: 88,
          ctr: 9.2,
          credibility: 85,
          isParetoOptimal: true,
          isRecommended: true,
          rank: 1,
          rounds: [
            { round: 1, title: '在家做水煮肉片好简单', ctr: 6.5, credibility: 70, score: 62 },
            { round: 2, title: '水煮肉片别出去吃了！教你一包调料搞定，肉嫩汤香比饭馆还下饭', ctr: 9.2, credibility: 85, score: 88 },
          ],
        },
        {
          id: 2,
          formulaName: '情绪共鸣+痛点切入',
          sourceTag: '高赞模板',
          title: '求求你们别再买一堆香料了！中秋水煮肉片这样做，全家夸你是大厨',
          charCount: 34,
          maxCharCount: 40,
          score: 84,
          ctr: 8.8,
          credibility: 80,
          isParetoOptimal: true,
          isRecommended: false,
          rank: 2,
          rounds: [
            { round: 1, title: '求求你们别再买一堆香料了！中秋水煮肉片这样做，全家夸你是大厨', ctr: 8.8, credibility: 80, score: 84 },
          ],
        },
        {
          id: 3,
          formulaName: '身份代入+可信结果',
          sourceTag: '生活测评',
          title: '厨房小白亲测：10分钟搞定正宗川味水煮肉片，配料干净连汤都喝光',
          charCount: 34,
          maxCharCount: 40,
          score: 82,
          ctr: 8.5,
          credibility: 88,
          isParetoOptimal: false,
          isRecommended: false,
          rank: 3,
          rounds: [
            { round: 1, title: '厨房小白亲测：10分钟搞定正宗川味水煮肉片，配料干净连汤都喝光', ctr: 8.5, credibility: 88, score: 82 },
          ],
        },
      ],
      review: {
        items: [
          { id: 1, ctr: 9.2, credibility: 85, issue: '各维度均衡优秀', improvement: '保持自然', mustFix: false },
        ],
        rounds: [
          {
            round: 1,
            averageScore: 84.7,
            averageCtr: 8.83,
            averageCredibility: 84.3,
            mustFixCount: 0,
            hardCheckPass: true,
          },
        ],
      },
    }
    setTopic('水煮肉片家庭做法')
    setAudience('厨房新手、家庭掌勺人')
    setPlatform('小红书')
    setPayload(mockPayload)
    setSelectedCandidateId(1)
  }

  const candidates = payload?.candidates ?? []
  /** 结果生成后用户又改了输入：提示重生成才生效（与脚本页 stale 对齐） */
  const stale = Boolean(payload) && (
    audience.trim() !== (payload?.input.audience ?? '').trim() ||
    topic.trim() !== (payload?.input.topic ?? '').trim() ||
    platform !== payload?.input.platform ||
    toneIntensity !== (payload?.input.toneIntensity ?? toneIntensity) ||
    supplement.trim() !== (payload?.input.supplement ?? '').trim()
  )
  const recommended = candidates.find((c) => c.isRecommended)
  const titleMetricItems = useMemo<AgentMetric[]>(
    () => [
      {
        label: '首选综合分',
        value: recommended ? String(recommended.score) : '—',
        hint: recommended ? `阈值 ${TITLE_STOP.scoreThreshold}` : '评审未返回分数',
        tone: recommended && recommended.score >= TITLE_STOP.scoreThreshold ? 'good' : 'warn',
      },
      {
        label: '预估点击率',
        value: recommended ? `${recommended.ctr}%` : '—',
        hint: '模型评审预估，非真实数据',
      },
      {
        label: '可信度',
        value: recommended ? String(recommended.credibility) : '—',
        hint: '0–100',
      },
      {
        label: '最优曲线',
        value: `${candidates.filter((c) => c.isParetoOptimal).length} 条`,
        hint: `共 ${candidates.length} 条候选`,
      },
      {
        label: '打磨轮次',
        value: payload ? `${payload.review.rounds.length}` : '—',
        hint: '评审与编辑来回打磨，够好就停',
      },
    ],
    [candidates, payload, recommended],
  )
  // 过程快照：页内演示跑完直接拿到，历史任务则回填在 payload.run 里
  const detailStages = snapshot?.stages?.length ? snapshot.stages : (payload?.run?.stages ?? [])
  const markdown = payload ? buildTitlesMarkdown(payload, demo || Boolean(payload.usedMock)) : ''
  const pending = busy || queueBusy
  /**
   * 是不是「跑起来之后失败」的。
   *
   * 与「参数没填」这类表单错误分开：
   * - 表单错误（受众/主题为空）在提交前就 return，不清 payload、不写 submittedAt，
   *   所以 `payload` 还在或 `submittedAt` 没变 → 归向导页脚显示。
   * - 执行失败发生在 setPayload(null) + setSubmittedAt(now) 之后 → 归失败卡片显示。
   * 两者若不加区分，同一条错误会在向导页脚和失败卡片里各出现一次。
   */
  const runFailed = !pending && !payload && Boolean(error) && Boolean(submittedAt)
  /** 下方已有过程卡片或结果区时，才提供收起输入表单 */
  const hasBottomWorkbenchContent = Boolean(payload) || pending || runFailed

  useEffect(() => {
    if (!hasBottomWorkbenchContent && inputCollapsed) {
      setInputCollapsed(false)
    }
  }, [hasBottomWorkbenchContent, inputCollapsed])

  const toneLabel =
    toneIntensity < 34
      ? (isEn ? 'Restrained' : '克制')
      : toneIntensity < 67
        ? (isEn ? 'Catchy' : '抓人')
        : (isEn ? 'Sharp' : '犀利')
  const flowCounts = agentFlowCounts(TITLES_STAGES)
  /** 页面文案里的专家数与环节数：只从这里插值，不在任何地方手写数字。 */
  const flowVars = { experts: flowCounts.expert, stages: flowCounts.total }

  return (
    <Page
      moduleId="titles"
      title={t('titlesPageTitle')}
      description={t('titlesPageDesc', flowVars)}
      chrome="workbench-tool"
      titleExtra={
        <WorkbenchPageChromeLeading>
          <AgentFlowExplain defs={TITLES_STAGES} lang={isEn ? 'en' : 'zh'} />
          <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyBadge={historyBadge} />
        </WorkbenchPageChromeLeading>
      }
      actions={
        <WorkbenchPageChromeActions>
          {import.meta.env.DEV && pageView === 'work' ? (
            <WorkbenchDevToolsMenu
              items={[
                {
                  id: 'titles-dev-result',
                  label: '模拟标题产出',
                  onSelect: loadDevResultMock,
                },
              ]}
            />
          ) : null}
          {pageView === 'history' ? (
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
          ) : null}
          {pageView === 'work' && hasBottomWorkbenchContent ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setInputCollapsed((prev) => !prev)}
              aria-label={inputCollapsed ? '展开输入配置' : '收起输入配置'}
              title={inputCollapsed ? '展开上方标题创作表单' : '收起上方表单，沉浸查看生成结果'}
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
          {pageView === 'work' ? (
            <PersonaBinding
              options={personaInject.options}
              value={personaInject.persona}
              onChange={(persona) => personaInject.selectPersona(persona?.id ?? null)}
            />
          ) : null}
        </WorkbenchPageChromeActions>
      }
    >
      {pageView === 'history' ? (
        <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
          <WorkbenchTaskHistory
            items={tasks}
            onRemove={removeTask}
            onSelect={(task) => void openHistoryTask(task)}
            selectedId={sessionTaskId}
            openLabel={t('pageHistoryOpen')}
            emptyHint={t('pageHistoryEmpty')}
          />
        </WorkbenchPageHistoryPanel>
      ) : (
        <div className="titles-page">
          {!inputCollapsed ? (
          <Card className="titles-form" aria-label={t('titlesFormAria')}>
            <div className="titles-sentence-block">
              <p className="titles-sentence" role="group" aria-label={t('titlesFormIntentAria')}>
                <span className="titles-sentence__word">我想在</span>

              {/* 平台选择下拉 */}
              <span className="titles-select-container" ref={platformDropdownRef}>
                <button
                  type="button"
                  className="titles-select-trigger"
                  aria-expanded={platformMenuOpen}
                  onClick={() => setPlatformMenuOpen((v) => !v)}
                >
                  <span>{platform}</span>
                  <ChevronDown className="titles-select-chevron" />
                </button>
                {platformMenuOpen && (
                  <div className="titles-dropdown-menu" role="menu">
                    {PLATFORM_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="menuitem"
                        className={`titles-dropdown-item${platform === p ? ' is-active' : ''}`}
                        onClick={() => {
                          setPlatform(p)
                          setPlatformMenuOpen(false)
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </span>

              <span className="titles-sentence__word">给</span>

              {/* 受众自适应宽度输入框 */}
              <span className="titles-inline-input-wrap">
                <span className="titles-inline-input-ghost" aria-hidden="true">
                  {audience || t('titlesAudiencePlaceholder')}
                </span>
                <textarea
                  id="titles-audience"
                  className="titles-inline-input"
                  rows={1}
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder={t('titlesAudiencePlaceholder')}
                  aria-label={t('titlesAudiencePlaceholder')}
                />
              </span>

              <span className="titles-sentence__word">写一组</span>

              {/* 主题自适应宽度输入框 */}
              <span className="titles-inline-input-wrap">
                <span className="titles-inline-input-ghost" aria-hidden="true">
                  {topic || t('titlesTopicPlaceholder')}
                </span>
                <textarea
                  id="titles-topic"
                  className="titles-inline-input"
                  rows={1}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('titlesTopicPlaceholder')}
                  aria-label={t('titlesTopicPlaceholder')}
                />
              </span>

              <span className="titles-sentence__word">的标题。</span>
              </p>
              <button
                type="button"
                className="titles-reset-btn"
                onClick={reset}
                aria-label={t('titlesFormReset')}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="titles-meta-row">
              <span className="titles-examples-label">{t('titlesExamplesLead')}</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.topic}
                  type="button"
                  className="titles-example-chip"
                  onClick={() => {
                    setAudience(ex.audience)
                    setTopic(ex.topic)
                    setPlatform(ex.platform)
                    setToneIntensity(ex.tone)
                  }}
                >
                  {ex.audience} · {ex.topic}
                </button>
              ))}
              <span className="titles-meta-row__sep" aria-hidden="true" />
              <span className="titles-tone-label">{t('titlesToneLabel')}</span>
              <div className="titles-tone-slider-container">
                <input
                  className="titles-tone-range"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={toneIntensity}
                  style={{ '--titles-tone-fill': `${toneIntensity}%` } as CSSProperties}
                  aria-label={t('titlesToneLabel')}
                  onChange={(e) => setToneIntensity(Number(e.target.value))}
                />
              </div>
              <span className="titles-tone-badge">{toneLabel}</span>
            </div>

            <details className="titles-material-details">
              <summary className="titles-material-details__summary">
                <span>{t('titlesSupplementToggle')}</span>
                {materialFilledCount > 0 ? (
                  <span className="titles-material-details__badge">{materialFilledCount}</span>
                ) : null}
                <ChevronDown className="titles-material-details__chevron wb-disclosure-chevron" aria-hidden="true" />
              </summary>
              <div className="titles-material-details__body">
                <ChatPromptAttachments
                  disabled={pending}
                  items={materialAttachments}
                  onChange={setMaterialAttachments}
                  className="titles-material-details__attachments"
                />
                <Textarea
                  id="titles-supplement"
                  rows={4}
                  value={supplement}
                  onChange={(e) => setSupplement(e.target.value)}
                  placeholder={t('titlesSupplementPlaceholder')}
                  disabled={pending}
                  className="titles-material-supplement"
                />
              </div>
            </details>

            {/* 底部生成与说明 */}
            <div className="titles-submit-section">
              <div className="titles-submit-bar">
                <p className="titles-submit-note">
                  提交为后台任务，可在
                  <button
                    type="button"
                    className="titles-submit-note-link"
                    onClick={() => setPageView('history')}
                  >
                    顶栏任务中心
                  </button>
                  查看进度 · {flowVars.experts} 位 AI 专家协同 · {flowVars.stages} 个处理阶段依序执行
                </p>
                <Button
                  type="button"
                  variant="generate"
                  size="action"
                  className="titles-submit-btn"
                  aria-busy={pending || undefined}
                  disabled={pending}
                  onClick={() => void generate()}
                >
                  {pending ? (
                    <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                  ) : null}
                  <span>{pending ? t('titlesGeneratingBtn') : '开始生成'}</span>
                </Button>
              </div>
            </div>
          </Card>
          ) : null}

          {/* 过程大卡片：默认折叠，只回显用户输入摘要 + 步骤 + 流式正文 */}
          {pending ? (
            <WorkflowRunCard
              title="爆款标题"
              status={
                busy
                  ? 'running'
                  : activeTask?.status === 'queued'
                    ? 'queued'
                    : 'running'
              }
              chips={[
                audience.trim() && topic.trim()
                  ? `${audience.trim()} · ${topic.trim()}`
                  : topic.trim() || audience.trim(),
                `发在${platform}`,
                `强度 ${toneLabel} ${toneIntensity}`,
              ].filter(Boolean) as string[]}
              submittedAt={submittedAt}
              roundText={snapshot?.round ? `第 ${snapshot.round} 轮` : undefined}
              mock={demo}
              streamingText={streamText || undefined}
              snapshot={snapshot}
              defs={TITLES_STAGES}
              progressIds={TITLES_PROGRESS_STAGE_IDS}
              branchStageIds={['retriever']}
              detailTitle="看每一步的产出"
              onCancel={() => {
                if (busy) abortRef.current?.abort()
                else if (activeTask) void cancelTask(activeTask.id)
              }}
              onRetry={() => void generate()}
              onRetryStage={(stageId) => void retryFromStage(stageId)}
            />
          ) : null}

          {/* 页内失败：如实展示真实错误，不编造结果 */}
          {runFailed ? (
            <WorkflowRunCard
              title="爆款标题"
              status="failed"
              chips={[
                audience.trim() && topic.trim()
                  ? `${audience.trim()} · ${topic.trim()}`
                  : topic.trim() || audience.trim(),
                `发在${platform}`,
              ].filter(Boolean) as string[]}
              submittedAt={submittedAt}
              mock={demo}
              snapshot={snapshot}
              defs={TITLES_STAGES}
              progressIds={TITLES_PROGRESS_STAGE_IDS}
              branchStageIds={['retriever']}
              detailTitle="看每一步的产出"
              error={error}
              onRetry={() => void generate()}
              retryLabel={t('titlesGenerateBtn')}
              onRetryStage={(stageId) => void retryFromStage(stageId)}
            />
          ) : null}

          {payload ? (
            <div className="tl-out">
              {stale ? (
                <p className="tl-hint" role="status">
                  设置已更改，点下方「{t('titlesGenerateBtn')}」按新设置重新生成，当前结果是旧设置的产物。
                </p>
              ) : null}
              {payload.hardCheck && !payload.hardCheck.pass ? (
                <div className="tl-flags">
                  <h4>硬校验未通过项</h4>
                  <ul>
                    {payload.hardCheck.hits.map((hit, i) => (
                      <li key={`${hit.label}-${i}`}>
                        {hit.segmentId ? `第 ${hit.segmentId} 条 · ` : ''}
                        <strong>{hit.label}</strong>：{hit.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* 结果主展示区：默认候选列表，页签切换进化图 */}
              <div className="tl-ws">
                <div className="tl-ws__head">
                  <TitlesResultViewTabs value={resultView} onChange={setResultView} />
                  <ResultActions embedded text={markdown} filename={titlesMarkdownFilename(payload)}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCanvasOpen(true)}
                      title="查看完整 AI 流程画布"
                    >
                      <Network size={14} aria-hidden="true" />
                      流程画布
                    </Button>
                    <Button type="button" variant="outline" onClick={reset}>
                      重置全部
                    </Button>
                  </ResultActions>
                </div>

                {resultView === 'list' ? (
                  <div
                    id="tl-result-panel-list"
                    role="tabpanel"
                    aria-labelledby="tl-result-tab-list"
                    className="flex flex-col gap-3"
                  >
                    <p className="tl-hint m-0">{t('titlesResultListSubtitle')}</p>
                    <TitleResultList
                      candidates={candidates}
                      selectedId={selectedCandidateId}
                      onSelectCandidate={setSelectedCandidateId}
                    />
                  </div>
                ) : (
                  <div
                    id="tl-result-panel-chart"
                    role="tabpanel"
                    aria-labelledby="tl-result-tab-chart"
                  >
                    <TitleEvolutionChart
                      candidates={candidates}
                      selectedId={selectedCandidateId}
                      onSelectCandidate={setSelectedCandidateId}
                      metricItems={titleMetricItems}
                    />
                  </div>
                )}
              </div>

              {/* 沉浸式全屏 AI 流程画布弹窗 */}
              <AgentWorkflowCanvas
                open={canvasOpen}
                onOpenChange={setCanvasOpen}
                title="爆款标题 · 生产流程画布"
                defs={TITLES_STAGES}
                branchStageIds={['retriever']}
                snapshot={
                  snapshot ?? {
                    flowId: TITLES_FLOW_ID,
                    round: payload.review.rounds.length,
                    stages: detailStages,
                    status: 'done',
                  }
                }
                onRetryStage={(stageId) => void retryFromStage(stageId)}
              />
            </div>
          ) : null}
        </div>
      )}
    </Page>
  )
}
