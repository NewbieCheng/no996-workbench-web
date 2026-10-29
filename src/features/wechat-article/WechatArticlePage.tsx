import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@no996/ui/button'
import { SparklesIcon } from 'lucide-react'
import {
  WorkbenchDevToolsMenu,
  type WorkbenchDevToolsMenuItem,
} from '../../components/WorkbenchDevToolsMenu'
import { WorkbenchPageHistoryPanel } from '../../components/WorkbenchPageHistoryPanel'
import { WorkbenchPageHistoryLayoutTabs } from '../../components/WorkbenchPageHistoryLayoutTabs'
import type { WorkbenchTaskRecordLayout } from '../tasks/WorkbenchTaskRecords'
import { WorkbenchPageViewTabs, type WorkbenchPageView } from '../../components/WorkbenchPageViewTabs'
import { WorkbenchTaskHistory } from '../tasks/WorkbenchTaskHistory'
import {
  Page,
  TOOL_CONTENT_DEFAULT_WIDTH,
  TOOL_CONTENT_MIN_WIDTH,
  WorkbenchPageChromeActions,
  WorkbenchPageChromeLeading,
} from '../../components/WorkbenchUI'
import PersonaBinding from '../../components/agent/PersonaBinding'
import { usePersonaInjection } from '../../components/agent/PersonaInjection'
import { usePersonaFormPrefill } from '../../hooks/usePersonaFormPrefill'
import { deriveSocialStudioPrefillPatch } from '../../lib/persona-form-prefill'
import { useChatPromptAttachments } from '../../components/ChatPromptAttachments'
import { useLocalAssets } from '../../services/local-assets'
import { isWorkbenchAiDemoMode } from '../../api/workbench-ai'
import { useWorkbenchTaskActions, useWorkbenchTasks, type SourceCreatePayload, type WorkbenchTaskRecord } from '../../services/workbench-tasks'
import { buildWechatSyncDraft } from '../../services/social-publish/build-sync-draft'
import type { WeixinPublishMode } from '../../services/social-publish/types'
import { useSocialStudioPreviewPrefs } from '../social-studio/preview/useSocialStudioPreviewPrefs'
import type { SocialContentMode } from '../social-studio/studio-types'
import { wechatPreviewShape } from '../social-studio/studio-mode'
import { SocialStudioCreativePanel } from '../social-studio/creative/SocialStudioCreativePanel'
import { createDefaultBrief, type SocialStudioBrief } from '../social-studio/creative/social-studio-brief-types'
import { useSocialStudioGenerate } from '../social-studio/useSocialStudioGenerate'
import { SocialComposeRunPanel } from '../social-studio/run/SocialComposeRunPanel'
import { splitLeadingArticleHeading } from '../social-studio/creative/article-heading'
import { useStudioStageView } from '../social-studio/useStudioStageView'
import { useSocialStudioPublish } from '../social-studio/useSocialStudioPublish'
import { useSocialStudioDraftPersist } from '../social-studio/useSocialStudioDraftPersist'
import {
  createDefaultRewriteSettings,
  type SocialStudioRewriteSession,
} from '../social-studio/rewrite/social-studio-rewrite-types'
import {
  notifyRewriteHardCheckIfNeeded,
  resolveRewriteApplyPayload,
} from '../social-studio/rewrite/apply-rewrite-result'
import type { WizardGeneratedResult } from '../social-studio/wizard/types'
import type { SocialStudioWizardDevHandles } from '../social-studio/wizard/SocialStudioWizard'
import {
  DEV_WECHAT_MOCK_IMAGES,
  DEV_WECHAT_ARTICLE_BRIEF,
  DEV_WECHAT_ARTICLE_RESULT,
  DEV_WECHAT_IMAGE_TEXT_BRIEF,
  DEV_WECHAT_IMAGE_TEXT_RESULT,
  DEV_WECHAT_REWRITE_SESSION,
  DEV_WECHAT_WIZARD_BENCHMARK,
  DEV_WECHAT_WIZARD_RESULT,
} from './dev/dev-fixtures'
import { SocialStudioWorkModeToolbar } from '../social-studio/SocialStudioWorkModeToolbar'
import { WechatArticleBenchmarkPanel } from './WechatArticleBenchmarkPanel'
import { WechatArticleInspirationStudioPanel } from './WechatArticleInspirationStudioPanel'
import { useWechatArticleWorkMode } from './useWechatArticleWorkMode'

export default function WechatArticlePage() {
  const { t } = useTranslation(['socialPublish', 'common', 'workbench'])
  const demoMode = isWorkbenchAiDemoMode()
  const { workMode, setWorkMode } = useWechatArticleWorkMode()
  const [brief, setBrief] = useState<SocialStudioBrief>(() => createDefaultBrief('wechat'))
  const personaInject = usePersonaInjection()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentMode, setContentMode] = useState<SocialContentMode>('article')
  const [weixinPublishMode, setWeixinPublishMode] = useState<WeixinPublishMode>('article')
  const [rewriteSettings, setRewriteSettings] = useState(() => createDefaultRewriteSettings('wechat'))
  const [rewriteSession, setRewriteSession] = useState<SocialStudioRewriteSession | null>(null)
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0)
  const previewPrefs = useSocialStudioPreviewPrefs('wechat')
  const { layoutView, setLayoutView, device, setDevice, phoneSize, setPhoneSize } = previewPrefs

  const images = useLocalAssets('image', 6, 10)
  const imageUrls = useMemo(() => images.assets.map((a) => a.url), [images.assets])
  const previewShape = wechatPreviewShape(contentMode)
  const { removeTask, getPayload } = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks()
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [wizardImageUrls, setWizardImageUrls] = useState<string[]>([])
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [prepCollapsed, setPrepCollapsed] = useState(false)
  const wizardDevRef = useRef<SocialStudioWizardDevHandles | null>(null)

  const effectiveImageUrls = useMemo(() => {
    if (imageUrls.length > 0) return imageUrls
    return wizardImageUrls
  }, [imageUrls, wizardImageUrls])
  const {
    items: promptAttachmentItems,
    setItems: setPromptAttachmentItems,
    clear: clearPromptAttachments,
  } = useChatPromptAttachments()

  const patchBrief = useCallback((patch: Partial<SocialStudioBrief>) => {
    setBrief((prev) => ({ ...prev, ...patch }))
  }, [])

  // 人设智能表单预填（只填空已空的项，不覆盖用户手工填写的项）
  const applySocialPrefill = useCallback((patch: Partial<SocialStudioBrief>) => {
    setBrief((prev) => ({ ...prev, ...patch }))
  }, [])

  usePersonaFormPrefill({
    loading: personaInject.loading,
    enabled: personaInject.enabled,
    record: personaInject.record,
    derive: (record) => deriveSocialStudioPrefillPatch(record, brief),
    applyPatch: applySocialPrefill,
  })

  const patchRewriteSettings = useCallback((patch: Partial<typeof rewriteSettings>) => {
    setRewriteSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const contentDefaultWidth =
    workMode === 'wizard' ? TOOL_CONTENT_MIN_WIDTH : TOOL_CONTENT_DEFAULT_WIDTH

  const generation = useSocialStudioGenerate({
    platform: 'wechat',
    contentMode,
    brief,
    personaContent: personaInject.content,
    attachmentItems: promptAttachmentItems,
    onTitle: setTitle,
    setContent,
    onGeneratedImages: (urls) => setWizardImageUrls(urls),
    sourceTitle: title || brief.topic,
    sourceBody: content,
    rewriteSettings,
    onRewriteSession: setRewriteSession,
  })
  const {
    generating,
    stageLabel,
    rewriteProgress,
    isRewriteMode,
    generate,
    generateImagesOnly,
    cancel,
    generationReady,
    markGenerationReady,
    clearGenerationReady,
    composeTask,
  } = generation
  const { stageView, setStageView, editLocked } = useStudioStageView(generating)

  const buildDraft = useCallback(
    () =>
      buildWechatSyncDraft({
        title: title || brief.topic,
        content,
        imageUrls: effectiveImageUrls,
        previewShape,
        weixinPublishMode,
      }),
    [brief.topic, content, effectiveImageUrls, previewShape, title, weixinPublishMode],
  )

  const handleWizardComplete = useCallback(
    (result: WizardGeneratedResult) => {
      setTitle(result.title)
      setContent(result.content)
      patchBrief({
        topic: result.title,
      })
      if (result.imageUrls && result.imageUrls.length > 0) {
        setWizardImageUrls(result.imageUrls)
      }
      setWorkMode('advanced')
      markGenerationReady()
      toast.success('公众号爆款长文复刻完成，已自动载入灵感创作工作台')
    },
    [markGenerationReady, patchBrief, setWorkMode],
  )

  const { clearPersistedDraft } = useSocialStudioDraftPersist({
    draftKey: 'wechat-article',
    title,
    content,
    contentMode,
    brief,
    weixinPublishMode,
    layoutView,
    device,
    themeKey: brief.themeKey,
    rewriteSettings,
    onHydrate: (draft) => {
      setTitle(draft.title)
      setContent(draft.content)
      setContentMode(draft.contentMode)
      setBrief(draft.brief)
      if (draft.weixinPublishMode) setWeixinPublishMode(draft.weixinPublishMode)
      if (draft.layoutView) setLayoutView(draft.layoutView)
      if (draft.device) setDevice(draft.device)
      if (draft.themeKey) patchBrief({ themeKey: draft.themeKey })
      if (draft.rewriteSettings) setRewriteSettings(draft.rewriteSettings)
    },
    isEmpty: () => !title.trim() && !content.trim() && !brief.topic.trim(),
  })

  const { publish, busy: publishBusy, message: publishNotice } = useSocialStudioPublish(
    'weixin',
    buildDraft,
  )

  const pageHistoryItems = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.meta?.targetType === 'wechat-article' &&
          (task.kind === 'source_create' || task.kind === 'social_compose'),
      ),
    [tasks],
  )
  const historyBadge = useMemo(
    () => pageHistoryItems.filter((task) => task.status === 'queued' || task.status === 'running').length,
    [pageHistoryItems],
  )

  async function openHistoryTask(task: WorkbenchTaskRecord) {
    try {
      if (task.kind === 'social_compose') {
        const data = await getPayload(task.payloadId) as { result?: WizardGeneratedResult | null } | null
        if (!data?.result) {
          toast.error(t('workbench:pageHistoryOpenFailed'))
          return
        }
        setTitle(data.result.title)
        setContent(data.result.content)
        patchBrief({ topic: data.result.title, summary: data.result.summary })
        if (data.result.imageUrls.length > 0) setWizardImageUrls(data.result.imageUrls)
        setPageView('work')
        setWorkMode('advanced')
        setStageView('preview')
        markGenerationReady()
        return
      }
      const payload = await getPayload(task.payloadId) as SourceCreatePayload | null
      const contentFromPayload = payload?.articleContent?.trim()
        || payload?.sections?.map((section) => `## ${section.label}\n\n${section.content}`).join('\n\n').trim()
        || ''
      if (!payload || !contentFromPayload) {
        toast.error(t('workbench:pageHistoryOpenFailed'))
        return
      }

      const separated = splitLeadingArticleHeading(contentFromPayload)
      setTitle(separated.title || payload.collectedTitle || task.title)
      setContent(separated.title ? separated.body : contentFromPayload)
      setContentMode('article')
      setPageView('work')
      setStageView('preview')
    } catch {
      toast.error(t('workbench:pageHistoryOpenFailed'))
    }
  }

  function reset() {
    cancel()
    clearGenerationReady()
    images.clear()
    setWizardImageUrls([])
    clearPersistedDraft()
    clearPromptAttachments()
    setBrief(createDefaultBrief('wechat'))
    setTitle('')
    setContent('')
    setContentMode('article')
    setWeixinPublishMode('article')
    setLayoutView('wechat')
    setDevice('pc')
    setStageView('edit')
    setRewriteSettings(createDefaultRewriteSettings('wechat'))
    setRewriteSession(null)
    setSelectedTitleIndex(0)
  }

  function applyRewriteResult() {
    if (!rewriteSession) return
    const { title: nextTitle, body: nextBody } = resolveRewriteApplyPayload(
      rewriteSession,
      selectedTitleIndex,
      title || brief.topic,
    )
    notifyRewriteHardCheckIfNeeded(nextBody, brief.hardCheck)
    setTitle(nextTitle)
    setContent(nextBody)
    setRewriteSession(null)
    toast.success(t('socialPublish:rewriteApplySuccess'))
  }

  function fillSample() {
    patchBrief({
      topic: t('socialPublish:sampleWechatTopic'),
      audience: t('socialPublish:sampleWechatAudience'),
      referenceText: t('socialPublish:sampleWechatMaterial'),
    })
  }

  const handleContentModeChange = useCallback(
    (mode: SocialContentMode) => {
      if (mode !== contentMode) images.clear()
      setContentMode(mode)
      if (mode === 'image_text' && !brief.authorized) {
        patchBrief({ authorized: false })
      }
    },
    [brief.authorized, contentMode, images, patchBrief],
  )

  /** 开发环境专享调试数据菜单项（细致覆盖公众号所有模式、排版与状态） */
  const devMenuItems: WorkbenchDevToolsMenuItem[] = useMemo(() => {
    if (workMode === 'wizard') {
      return [
        {
          id: 'wechat-wizard-benchmark',
          label: '向导：填入爆款母本（10w+深度长文）',
          onSelect: () => {
            wizardDevRef.current?.fillBenchmarkFixture(DEV_WECHAT_WIZARD_BENCHMARK)
            toast.success('已注入 10w+ 公众号爆款母本')
          },
        },
        {
          id: 'wechat-wizard-outline',
          label: '向导：填入长文结构大纲规划',
          onSelect: () => {
            wizardDevRef.current?.fillOutlineFixture({
              suggestedTitles: [
                '时代变了：为什么那些只懂执行的“老实人”，正在被悄悄淘汰？',
                '深度复盘：当 AI 取代了初级技能，我们到底还凭什么拿高薪？',
                '大厂裁员背后的残酷真相：你的核心竞争力可能已一文不值',
              ],
              hook: '“过去五十年，人类的教育体系在拼命把人训练成精密、稳定但昂贵的机器；而今天，世界上最廉价、最高速的恰恰就是机器。”',
              sections: [
                {
                  index: 1,
                  headline: '大变局：技能通胀时代的残酷现实',
                  visualDescription: '工业化旧范式 vs AI 新范式对比图表',
                  bodyDraft: '经验不再是不可动摇的护城河，单点执行技能极速贬值，系统编排者成为核心资产。',
                },
                {
                  index: 2,
                  headline: '能力跃迁：重构个人的核心竞争力金字塔',
                  visualDescription: '职场竞争力金字塔跃迁架构图',
                  bodyDraft: '从“答题者”转变为“提问者与裁判员”，把握高阶商业命题与真实同理心。',
                },
                {
                  index: 3,
                  headline: '破局指南：下周一开始实践的三个微习惯',
                  visualDescription: '清晰要点清单与行动号召卡片',
                  bodyDraft: '强迫退后一步做架构思考，沉淀私域工作流资产，扎根真实业务场域。',
                },
              ],
              conclusion: '愿我们都能成为驾驭浪潮的冲浪者，而非被海啸裹挟的沙砾。欢迎在评论区交流！',
              visualStyle: '深青与米白的编辑式视觉、柔和自然光、克制的陶土橘点缀；标题与正文图保持统一留白和细腻纸感。',
              imagePlans: [
                { index: 1, role: 'cover', titleText: 'AI时代的核心竞争力', supportingText: '当执行被自动化，能力该如何升级', badgeText: '职场观察', visualDescription: '人站在传统纸本文档与抽象数字界面的交界处，深青与米白构图，标题区域留白。' },
                { index: 2, role: 'section', sectionIndex: 1, titleText: '技能变化正在发生', supportingText: '区分重复执行与系统判断', badgeText: '认知变化', visualDescription: '旧式流水线与现代数字工作台的概念对照，不呈现可读文字。' },
                { index: 3, role: 'section', sectionIndex: 2, titleText: '重构能力组合', supportingText: '从执行走向提问、判断与协作', badgeText: '能力升级', visualDescription: '由基础能力向决策协作能力递进的抽象阶梯构图。' },
                { index: 4, role: 'section', sectionIndex: 3, titleText: '从小处开始实践', supportingText: '用复盘沉淀自己的工作方法', badgeText: '行动建议', visualDescription: '桌面上的笔记本、电脑与整理中的工作流程卡片，柔和自然光。' },
              ],
            })
            toast.success('已注入长文结构拆解大纲')
          },
        },
        {
          id: 'wechat-wizard-result',
          label: '向导：模拟复刻完成态（可一键载入工作台）',
          onSelect: () => {
            wizardDevRef.current?.fillResultMock(DEV_WECHAT_WIZARD_RESULT)
            toast.success('已模拟向导生成完成态')
          },
        },
        {
          id: 'wechat-wizard-direct-studio',
          label: '向导：模拟产出并直接载入创作工作台',
          onSelect: () => {
            handleWizardComplete(DEV_WECHAT_WIZARD_RESULT)
          },
        },
        {
          id: 'wechat-switch-advanced',
          label: '切换至深度创作工作台',
          onSelect: () => setWorkMode('advanced'),
        },
        {
          id: 'wechat-wizard-reset',
          label: '重置向导状态',
          onSelect: () => {
            wizardDevRef.current?.resetWizard()
            toast.info('向导已重置')
          },
        },
      ]
    }

    return [
      {
        id: 'wechat-dev-fill-all-in-one',
        label: '✨ 一键填入全家桶示例（表单+长文排版+大图+改写）',
        onSelect: () => {
          handleContentModeChange('article')
          setBrief((prev) => ({ ...prev, ...DEV_WECHAT_ARTICLE_BRIEF }))
          setTitle(DEV_WECHAT_ARTICLE_RESULT.title)
          setContent(DEV_WECHAT_ARTICLE_RESULT.content)
          images.clear()
          setWizardImageUrls(DEV_WECHAT_MOCK_IMAGES)
          setWeixinPublishMode('article')
          setLayoutView('wechat')
          setRewriteSession(DEV_WECHAT_REWRITE_SESSION)
          setSelectedTitleIndex(0)
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已注入微信公众号全家桶完整示例，所有功能已就绪可预览')
        },
      },
      {
        id: 'wechat-dev-fill-article',
        label: '填入深度长文表单示例（含上千字调研资料）',
        onSelect: () => {
          handleContentModeChange('article')
          setBrief((prev) => ({ ...prev, ...DEV_WECHAT_ARTICLE_BRIEF }))
          setWeixinPublishMode('article')
          setPrepCollapsed(false)
          toast.success('已填入公众号深度长文全套示例')
        },
      },
      {
        id: 'wechat-dev-mock-article-result',
        label: '模拟深度长文成稿产出（含头条大图与主题排版）',
        onSelect: () => {
          handleContentModeChange('article')
          setBrief((prev) => ({ ...prev, ...DEV_WECHAT_ARTICLE_BRIEF }))
          setTitle(DEV_WECHAT_ARTICLE_RESULT.title)
          setContent(DEV_WECHAT_ARTICLE_RESULT.content)
          images.clear()
          setWizardImageUrls(DEV_WECHAT_MOCK_IMAGES)
          setWeixinPublishMode('article')
          setLayoutView('wechat')
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已模拟公众号深度长文成稿（含大图封面与排版）')
        },
      },
      {
        id: 'wechat-dev-fill-image-text',
        label: '填入图文小报表单示例',
        onSelect: () => {
          handleContentModeChange('image_text')
          setBrief((prev) => ({ ...prev, ...DEV_WECHAT_IMAGE_TEXT_BRIEF }))
          setWeixinPublishMode('image_draft')
          setPrepCollapsed(false)
          toast.success('已填入公众号图文小报示例')
        },
      },
      {
        id: 'wechat-dev-mock-image-text-result',
        label: '模拟图文小报成稿产出',
        onSelect: () => {
          handleContentModeChange('image_text')
          setBrief((prev) => ({ ...prev, ...DEV_WECHAT_IMAGE_TEXT_BRIEF }))
          setTitle(DEV_WECHAT_IMAGE_TEXT_RESULT.title)
          setContent(DEV_WECHAT_IMAGE_TEXT_RESULT.content)
          images.clear()
          setWizardImageUrls([DEV_WECHAT_MOCK_IMAGES[1]])
          setWeixinPublishMode('image_draft')
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已模拟公众号图文小报成稿产出')
        },
      },
      {
        id: 'wechat-dev-mock-rewrite',
        label: '模拟智能改写对比（5组10w+备选标题）',
        onSelect: () => {
          setTitle(DEV_WECHAT_ARTICLE_RESULT.title)
          setContent(DEV_WECHAT_ARTICLE_RESULT.content)
          setRewriteSession(DEV_WECHAT_REWRITE_SESSION)
          setSelectedTitleIndex(0)
          setStageView('edit')
          toast.success('已模拟智能改写对比会话（可查看差异与切换标题）')
        },
      },
      {
        id: 'wechat-switch-wizard',
        label: '切换至爆款复刻向导',
        onSelect: () => setWorkMode('wizard'),
      },
      {
        id: 'wechat-dev-reset-all',
        label: '一键清空/重置状态',
        onSelect: () => {
          reset()
          toast.info('已重置所有编辑内容')
        },
      },
    ]
  }, [handleContentModeChange, handleWizardComplete, images, reset, setBrief, setContent, setLayoutView, setPrepCollapsed, setRewriteSession, setSelectedTitleIndex, setStageView, setTitle, setWeixinPublishMode, setWizardImageUrls, setWorkMode, workMode])

  const runPanel =
    generating && !isRewriteMode && composeTask.task ? (
      <SocialComposeRunPanel
        title={`公众号图文 · ${contentMode === 'article' ? '长文' : '灵感创作'}`}
        status={
          composeTask.task.status === 'succeeded'
            ? 'done'
            : composeTask.task.status === 'failed'
              ? 'failed'
              : composeTask.task.status === 'cancelled'
                ? 'cancelled'
                : composeTask.task.status === 'queued'
                  ? 'queued'
                  : 'running'
        }
        snapshot={composeTask.snapshot}
        chips={[contentMode === 'article' ? '长文' : '图文', `${brief.imageCount} 张配图`]}
        streamingText={composeTask.streamingText || content}
        submittedAt={composeTask.task.createdAt}
        imagePlans={Array.from({ length: Math.min(4, brief.imageCount) }, (_, index) => ({
          role: index === 0 ? 'cover' : 'section',
        }))}
        imageUrls={composeTask.result?.imageUrls ?? []}
        imageProgress={composeTask.imageProgress}
        textReady={composeTask.textReady}
        running={composeTask.task.status === 'running'}
        textOnly={contentMode === 'article'}
        onCancel={cancel}
        onRetry={() => void generate()}
      />
    ) : undefined

  const prepPanel = (
    <SocialStudioCreativePanel
      platform="wechat"
      contentMode={contentMode}
      brief={brief}
      onBriefChange={patchBrief}
      generating={generating}
      stageLabel={stageLabel}
      generateLabel={t('socialPublish:studioAiGenerate')}
      generateImagesLabel={t('socialPublish:studioGenerateImages')}
      regenerateAllLabel={t('socialPublish:studioRegenerateAll')}
      onGenerate={() => void generate()}
      onGenerateImages={() => void generateImagesOnly()}
      onCancel={cancel}
      showPublish={generationReady}
      publishDisabled={!title.trim() || !content.trim()}
      publishBusy={publishBusy}
      publishLabel={t('socialPublish:studioSyncDraftWechat')}
      publishNotice={publishNotice}
      onPublish={() => void publish()}
      onReset={reset}
      onFillSample={fillSample}
      showAttachments
      attachmentItems={promptAttachmentItems}
      onAttachmentItemsChange={setPromptAttachmentItems}
      attachmentsDisabled={generating}
      onPickCoverImages={(files) => images.select(files, brief.authorized)}
      rewriteSettings={contentMode === 'article' ? rewriteSettings : undefined}
      onRewriteSettingsChange={contentMode === 'article' ? patchRewriteSettings : undefined}
      hasEditorBody={Boolean(content.trim())}
      persona={personaInject.persona}
    />
  )

  return (
    <Page
      moduleId="wechat-article"
      defaultWidth={contentDefaultWidth}
      minWidth={TOOL_CONTENT_MIN_WIDTH}
      title={t('socialPublish:wechatPageTitle')}
      description={t('socialPublish:wechatPageDescStudio')}
      chrome="workbench-tool"
      titleExtra={
        !demoMode ? (
          <WorkbenchPageChromeLeading>
            <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyBadge={historyBadge} />
          </WorkbenchPageChromeLeading>
        ) : undefined
      }
      actions={
        <WorkbenchPageChromeActions>
          {pageView === 'work' ? (
            <SocialStudioWorkModeToolbar workMode={workMode} onWorkModeChange={setWorkMode} />
          ) : null}
          {import.meta.env.DEV && pageView === 'work' && devMenuItems.length > 0 ? (
            <WorkbenchDevToolsMenu items={devMenuItems} />
          ) : null}
          {pageView === 'work' && workMode === 'advanced' && prepCollapsed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="social-studio-prep-reopen"
              aria-label={t('socialPublish:prepExpand')}
              onClick={() => setPrepCollapsed(false)}
            >
              <SparklesIcon aria-hidden />
              <span>{t('socialPublish:prepPanelTitle')}</span>
            </Button>
          ) : null}
          {pageView === 'history' ? (
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
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
      {!demoMode && pageView === 'history' ? (
        <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
          <WorkbenchTaskHistory
            items={pageHistoryItems}
            onRemove={removeTask}
            onSelect={openHistoryTask}
            openLabel={t('workbench:pageHistoryOpen')}
            emptyHint={t('workbench:pageHistoryEmpty')}
          />
        </WorkbenchPageHistoryPanel>
      ) : workMode === 'wizard' ? (
        <WechatArticleBenchmarkPanel
          onComplete={handleWizardComplete}
          onExitToStudio={() => setWorkMode('advanced')}
          onOpenHistory={() => setPageView('history')}
          devHandlesRef={wizardDevRef}
        />
      ) : (
        <WechatArticleInspirationStudioPanel
          prepCollapsed={prepCollapsed}
          onPrepCollapsedChange={setPrepCollapsed}
          prepCollapseLabel={t('socialPublish:prepCollapse')}
          prep={prepPanel}
          contentMode={contentMode}
          onContentModeChange={handleContentModeChange}
          layoutView={layoutView}
          onLayoutViewChange={setLayoutView}
          device={device}
          onDeviceChange={setDevice}
          themeKey={brief.themeKey}
          onThemeKeyChange={(key) => patchBrief({ themeKey: key })}
          phoneSize={phoneSize}
          stageView={stageView}
          editLocked={editLocked}
          onStageViewChange={setStageView}
          generating={generating}
          isRewriteMode={Boolean(isRewriteMode)}
          rewriteSettings={rewriteSettings}
          rewriteProgress={rewriteProgress}
          stageLabel={stageLabel}
          rewriteSession={rewriteSession}
          selectedTitleIndex={selectedTitleIndex}
          onSelectTitleIndex={setSelectedTitleIndex}
          onApplyRewrite={applyRewriteResult}
          onRegenerate={() => void generate()}
          onDismissRewrite={() => setRewriteSession(null)}
          title={title || brief.topic}
          onTitleChange={setTitle}
          content={content}
          onContentChange={setContent}
          effectiveImageUrls={effectiveImageUrls}
          onPickImages={(files) => images.select(files, true)}
          onRemoveImageAt={(index) => images.removeAt(index)}
          onReorderImages={(from, to) => images.reorder(from, to)}
          onPhoneSizeChange={setPhoneSize}
          weixinPublishMode={weixinPublishMode}
          runPanel={runPanel}
        />
      )}
    </Page>
  )
}
