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
import { useLocalAssets } from '../../services/local-assets'
import { isWorkbenchAiDemoMode } from '../../api/workbench-ai'
import { useWorkbenchTaskActions, useWorkbenchTasks } from '../../services/workbench-tasks'
import { buildXhsSyncDraft } from '../../services/social-publish/build-sync-draft'
import type { XhsPublishMode } from '../../services/social-publish/types'
import { useSocialStudioPreviewPrefs } from '../social-studio/preview/useSocialStudioPreviewPrefs'
import { resolveXhsModeForStudio } from '../social-studio/XhsStudioPreview'
import type { SocialContentMode } from '../social-studio/studio-types'
import { SocialStudioCreativePanel } from '../social-studio/creative/SocialStudioCreativePanel'
import {
  clampImageCount,
  createDefaultBrief,
  type SocialStudioBrief,
} from '../social-studio/creative/social-studio-brief-types'
import { useSocialStudioGenerate } from '../social-studio/useSocialStudioGenerate'
import { useStudioStageView } from '../social-studio/useStudioStageView'
import { useSocialStudioPublish } from '../social-studio/useSocialStudioPublish'
import { useSocialStudioDraftPersist } from '../social-studio/useSocialStudioDraftPersist'
import { resolveXhsPublishSummary } from '../../services/social-publish/resolve-xhs-summary'
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
  DEV_XHS_MOCK_IMAGES,
  DEV_XHS_IMAGE_TEXT_BRIEF,
  DEV_XHS_IMAGE_TEXT_RESULT,
  DEV_XHS_ARTICLE_BRIEF,
  DEV_XHS_ARTICLE_RESULT,
  DEV_XHS_REWRITE_SESSION,
  DEV_XHS_WIZARD_BENCHMARK,
  DEV_XHS_WIZARD_RESULT,
} from './dev/dev-fixtures'
import { XiaohongshuBenchmarkPanel } from './XiaohongshuBenchmarkPanel'
import { XiaohongshuInspirationStudioPanel } from './XiaohongshuInspirationStudioPanel'
import { XiaohongshuWorkModeToolbar } from './XiaohongshuWorkModeToolbar'
import { useXiaohongshuWorkMode } from './useXiaohongshuWorkMode'

export default function XiaohongshuPage() {
  const { t } = useTranslation(['socialPublish', 'common', 'workbench'])
  const demoMode = isWorkbenchAiDemoMode()
  const { workMode, setWorkMode } = useXiaohongshuWorkMode()
  const [brief, setBrief] = useState<SocialStudioBrief>(() => createDefaultBrief('xhs'))
  const personaInject = usePersonaInjection()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [contentMode, setContentMode] = useState<SocialContentMode>('image_text')
  const [xhsPublishMode, setXhsPublishMode] = useState<XhsPublishMode>('auto')

  const imageSlotMax =
    contentMode === 'image_text' ? clampImageCount(contentMode, brief.imageCount) : 1
  const images = useLocalAssets('image', imageSlotMax, 10)
  const imageUrls = useMemo(() => images.assets.map((a) => a.url), [images.assets])
  const displayTitle = title.trim() || brief.topic.trim() || t('socialPublish:defaultNoteTitle')
  const { removeTask } = useWorkbenchTaskActions()
  const tasks = useWorkbenchTasks({ kind: 'source_create' })
  const [pageView, setPageView] = useState<WorkbenchPageView>('work')
  const [wizardImageUrls, setWizardImageUrls] = useState<string[]>([])
  const [historyLayout, setHistoryLayout] = useState<WorkbenchTaskRecordLayout>('cards')
  const [prepCollapsed, setPrepCollapsed] = useState(false)
  const [rewriteSettings, setRewriteSettings] = useState(() => createDefaultRewriteSettings('xhs'))
  const [rewriteSession, setRewriteSession] = useState<SocialStudioRewriteSession | null>(null)
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0)
  const wizardDevRef = useRef<SocialStudioWizardDevHandles | null>(null)

  const effectiveXhsMode = resolveXhsModeForStudio(contentMode, xhsPublishMode)

  const effectiveImageUrls = useMemo(() => {
    if (imageUrls.length > 0) return imageUrls
    return wizardImageUrls
  }, [imageUrls, wizardImageUrls])

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
    platform: 'xhs',
    contentMode,
    brief,
    personaContent: personaInject.content,
    onTitle: setTitle,
    setContent,
    onSummary: (value) => patchBrief({ summary: value }),
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
    cancel,
    generationReady,
    markGenerationReady,
    clearGenerationReady,
  } = generation
  const { stageView, setStageView, editLocked } = useStudioStageView(generating)
  const previewPrefs = useSocialStudioPreviewPrefs('xhs')
  const hasDraft = Boolean(content.trim())
  const buildDraft = useCallback(
    () =>
      buildXhsSyncDraft({
        title: displayTitle,
        content,
        summary: resolveXhsPublishSummary(brief.summary, content, displayTitle),
        imageUrls: contentMode === 'image_text' ? effectiveImageUrls : [],
        xhsPublishMode: effectiveXhsMode,
      }),
    [brief.summary, content, contentMode, displayTitle, effectiveXhsMode, effectiveImageUrls],
  )

  const handleWizardComplete = useCallback(
    (result: WizardGeneratedResult) => {
      setTitle(result.title)
      setContent(result.content)
      patchBrief({
        topic: result.title,
        summary: result.summary,
      })
      if (result.imageUrls && result.imageUrls.length > 0) {
        setWizardImageUrls(result.imageUrls)
      }
      setWorkMode('advanced')
      markGenerationReady()
      toast.success('爆款复刻完成，已自动载入灵感创作工作台')
    },
    [markGenerationReady, patchBrief, setWorkMode],
  )

  const { clearPersistedDraft } = useSocialStudioDraftPersist({
    draftKey: 'xiaohongshu',
    title,
    content,
    contentMode,
    brief,
    xhsPublishMode,
    device: previewPrefs.device,
    rewriteSettings,
    onHydrate: (draft) => {
      setTitle(draft.title)
      setContent(draft.content)
      setContentMode(draft.contentMode)
      setBrief(draft.brief)
      if (draft.xhsPublishMode) setXhsPublishMode(draft.xhsPublishMode)
      if (draft.device) previewPrefs.setDevice(draft.device)
      if (draft.rewriteSettings) setRewriteSettings(draft.rewriteSettings)
    },
    isEmpty: () => !title.trim() && !content.trim() && !brief.topic.trim(),
  })
  const { publish, busy: publishBusy, message: publishNotice } = useSocialStudioPublish(
    'xiaohongshu',
    buildDraft,
  )

  const pageHistoryItems = useMemo(
    () => tasks.filter((task) => task.meta?.targetType === 'xiaohongshu'),
    [tasks],
  )
  const historyBadge = useMemo(
    () => pageHistoryItems.filter((task) => task.status === 'queued' || task.status === 'running').length,
    [pageHistoryItems],
  )

  function reset() {
    cancel()
    clearGenerationReady()
    images.clear()
    setWizardImageUrls([])
    clearPersistedDraft()
    setBrief(createDefaultBrief('xhs'))
    setTitle('')
    setContent('')
    setContentMode('image_text')
    setXhsPublishMode('auto')
    setStageView('edit')
    setRewriteSettings(createDefaultRewriteSettings('xhs'))
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
      topic: t('socialPublish:sampleXhsTopic'),
      audience: t('socialPublish:sampleXhsAudience'),
    })
  }

  const handleContentModeChange = useCallback(
    (mode: SocialContentMode) => {
      if (mode !== contentMode) images.clear()
      setContentMode(mode)
    },
    [contentMode, images],
  )

  /** 开发环境专享调试数据菜单项（细致覆盖小红书所有模式与状态） */
  const devMenuItems: WorkbenchDevToolsMenuItem[] = useMemo(() => {
    if (workMode === 'wizard') {
      return [
        {
          id: 'xhs-wizard-benchmark',
          label: '向导：填入爆款母本（10w+赞）',
          onSelect: () => {
            wizardDevRef.current?.fillBenchmarkFixture(DEV_XHS_WIZARD_BENCHMARK)
            toast.success('已注入 10w+ 小红书爆款母本')
          },
        },
        {
          id: 'xhs-wizard-outline',
          label: '向导：填入大纲规划（黄金钩子+拆解）',
          onSelect: () => {
            wizardDevRef.current?.fillOutlineFixture({
              suggestedTitles: [
                '后悔没早点知道！100元打造治愈系原木风出租屋',
                '房东看了都想涨租！独居女孩的百元软装逆袭',
                '建议收藏！小红书万赞的原木风软装避坑指南',
              ],
              hook: '很多人以为出租屋改造要大动干戈，其实只要抓住核心视觉锚点，100块就能彻底改头换面！',
              sections: [
                {
                  index: 1,
                  headline: '视觉基底：棉麻桌布遮盖老旧瑕疵',
                  visualDescription: '对比强烈的原木桌面与暖光氛围',
                  bodyDraft: '不要换大件，用垂感极佳的米色棉麻桌布遮住掉漆桌面，拍照高级感立刻就有了。',
                },
                {
                  index: 2,
                  headline: '层次收纳：多层原木置物架',
                  visualDescription: '阶梯置物架摆放香薰与绿植特写',
                  bodyDraft: '小空间最怕杂乱，立体收纳让空间看起来更大，绿植带来自然生机。',
                },
                {
                  index: 3,
                  headline: '氛围点睛：落日小台灯的神级光源',
                  visualDescription: '夜间暖光柔和洒在桌面，温馨治愈',
                  bodyDraft: '关掉惨白的大灯，暖光是治愈打工人疲惫的最佳良药。',
                },
              ],
              conclusion: '评论区打出【清单】，把整理好的平价软装链接分享给大家！',
              visualStyle: '暖米白底色、自然窗光、低饱和原木色与柔和绿色点缀；整组使用俯拍与生活场景结合的编辑式构图。',
              imagePlans: [
                { index: 1, role: 'cover', titleText: '出租屋百元软装清单', supportingText: '低成本也能布置出温暖空间', badgeText: '租房改造', visualDescription: '暖色出租屋桌面全景，棉麻桌布与自然窗光，主标题下方留出清晰文字区。' },
                { index: 2, role: 'section', sectionIndex: 1, titleText: '先用桌布遮瑕', supportingText: '选米色棉麻，弱化旧桌面瑕疵', badgeText: '第一步', visualDescription: '旧桌面与铺上棉麻桌布后的同角度对比。' },
                { index: 3, role: 'section', sectionIndex: 2, titleText: '收纳向上发展', supportingText: '置物架搭配香薰和绿植', badgeText: '第二步', visualDescription: '阶梯原木置物架的近景，陈列香薰与绿植。' },
                { index: 4, role: 'section', sectionIndex: 3, titleText: '用暖光收尾', supportingText: '柔和台灯营造放松氛围', badgeText: '第三步', visualDescription: '落日暖光照亮小台灯与整理好的桌面。' },
              ],
            })
            toast.success('已注入大纲规划与分段拆解')
          },
        },
        {
          id: 'xhs-wizard-result',
          label: '向导：模拟复刻完成态（可一键载入工作台）',
          onSelect: () => {
            wizardDevRef.current?.fillResultMock(DEV_XHS_WIZARD_RESULT)
            toast.success('已模拟向导生成完成态')
          },
        },
        {
          id: 'xhs-wizard-direct-studio',
          label: '向导：模拟产出并直接载入灵感工作台',
          onSelect: () => {
            handleWizardComplete(DEV_XHS_WIZARD_RESULT)
          },
        },
        {
          id: 'xhs-switch-advanced',
          label: '切换至灵感创作工作台',
          onSelect: () => setWorkMode('advanced'),
        },
        {
          id: 'xhs-wizard-reset',
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
        id: 'xhs-dev-fill-all-in-one',
        label: '✨ 一键填入全家桶示例（表单+成稿+4张配图+改写）',
        onSelect: () => {
          handleContentModeChange('image_text')
          setBrief((prev) => ({ ...prev, ...DEV_XHS_IMAGE_TEXT_BRIEF }))
          setTitle(DEV_XHS_IMAGE_TEXT_RESULT.title)
          setContent(DEV_XHS_IMAGE_TEXT_RESULT.content)
          images.clear()
          setWizardImageUrls(DEV_XHS_MOCK_IMAGES)
          setRewriteSession(DEV_XHS_REWRITE_SESSION)
          setSelectedTitleIndex(0)
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已注入小红书全家桶完整示例，所有功能已就绪可预览')
        },
      },
      {
        id: 'xhs-dev-fill-image-text',
        label: '填入图文创作表单示例（租房改造）',
        onSelect: () => {
          handleContentModeChange('image_text')
          setBrief((prev) => ({ ...prev, ...DEV_XHS_IMAGE_TEXT_BRIEF }))
          setPrepCollapsed(false)
          toast.success('已填入小红书图文创作全套示例')
        },
      },
      {
        id: 'xhs-dev-mock-image-text-result',
        label: '模拟图文成稿产出（含4张高清配图）',
        onSelect: () => {
          handleContentModeChange('image_text')
          setBrief((prev) => ({ ...prev, ...DEV_XHS_IMAGE_TEXT_BRIEF }))
          setTitle(DEV_XHS_IMAGE_TEXT_RESULT.title)
          setContent(DEV_XHS_IMAGE_TEXT_RESULT.content)
          images.clear()
          setWizardImageUrls(DEV_XHS_MOCK_IMAGES)
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已模拟图文成稿产出（含4张配图与标签）')
        },
      },
      {
        id: 'xhs-dev-fill-article',
        label: '填入深度干货/长文表单示例',
        onSelect: () => {
          handleContentModeChange('article')
          setBrief((prev) => ({ ...prev, ...DEV_XHS_ARTICLE_BRIEF }))
          setPrepCollapsed(false)
          toast.success('已填入小红书深度干货长文示例')
        },
      },
      {
        id: 'xhs-dev-mock-article-result',
        label: '模拟深度长文成稿产出',
        onSelect: () => {
          handleContentModeChange('article')
          setBrief((prev) => ({ ...prev, ...DEV_XHS_ARTICLE_BRIEF }))
          setTitle(DEV_XHS_ARTICLE_RESULT.title)
          setContent(DEV_XHS_ARTICLE_RESULT.content)
          images.clear()
          setWizardImageUrls([DEV_XHS_MOCK_IMAGES[0]])
          setStageView('preview')
          setPrepCollapsed(false)
          toast.success('已模拟深度长文成稿产出')
        },
      },
      {
        id: 'xhs-dev-mock-rewrite',
        label: '模拟智能改写对比（5组不同切入点标题）',
        onSelect: () => {
          setTitle(DEV_XHS_IMAGE_TEXT_RESULT.title)
          setContent(DEV_XHS_IMAGE_TEXT_RESULT.content)
          setRewriteSession(DEV_XHS_REWRITE_SESSION)
          setSelectedTitleIndex(0)
          setStageView('edit')
          toast.success('已模拟智能改写对比会话（可查看差异与切换标题）')
        },
      },
      {
        id: 'xhs-switch-wizard',
        label: '切换至爆款复刻向导',
        onSelect: () => setWorkMode('wizard'),
      },
      {
        id: 'xhs-dev-reset-all',
        label: '一键清空/重置状态',
        onSelect: () => {
          reset()
          toast.info('已重置所有编辑内容')
        },
      },
    ]
  }, [handleContentModeChange, handleWizardComplete, images, reset, setBrief, setContent, setPrepCollapsed, setRewriteSession, setSelectedTitleIndex, setStageView, setTitle, setWizardImageUrls, setWorkMode, workMode])

  const prepPanel = (
    <SocialStudioCreativePanel
      platform="xhs"
      contentMode={contentMode}
      brief={brief}
      onBriefChange={patchBrief}
      generating={generating}
      stageLabel={stageLabel}
      generateLabel={t('socialPublish:studioAiGenerate')}
      onGenerate={() => void generate()}
      onCancel={cancel}
      showPublish={generationReady}
      publishDisabled={!content.trim()}
      publishBusy={publishBusy}
      publishLabel={t('socialPublish:studioSyncDraftXhs')}
      publishNotice={publishNotice}
      onPublish={() => void publish()}
      onReset={reset}
      onFillSample={fillSample}
      onPickCoverImages={(files) => images.select(files, brief.authorized)}
      rewriteSettings={contentMode === 'article' ? rewriteSettings : undefined}
      onRewriteSettingsChange={contentMode === 'article' ? patchRewriteSettings : undefined}
      hasEditorBody={Boolean(content.trim())}
      persona={personaInject.persona}
    />
  )

  return (
    <Page
      moduleId="xiaohongshu"
      defaultWidth={contentDefaultWidth}
      minWidth={TOOL_CONTENT_MIN_WIDTH}
      title={t('socialPublish:xhsPageTitle')}
      description={t('socialPublish:xhsPageDescStudio')}
      chrome="workbench-tool"
      titleExtra={
        !demoMode ? (
          <WorkbenchPageChromeLeading>
            <WorkbenchPageViewTabs value={pageView} onChange={setPageView} historyBadge={historyBadge} />
          </WorkbenchPageChromeLeading>
        ) : undefined
      }
      actions={
        !demoMode && pageView === 'history' ? (
          <WorkbenchPageChromeActions>
            <WorkbenchPageHistoryLayoutTabs layout={historyLayout} onLayoutChange={setHistoryLayout} />
          </WorkbenchPageChromeActions>
        ) : pageView === 'work' ? (
          <WorkbenchPageChromeActions>
            <XiaohongshuWorkModeToolbar workMode={workMode} onWorkModeChange={setWorkMode} />
            {import.meta.env.DEV && devMenuItems.length > 0 ? (
              <WorkbenchDevToolsMenu items={devMenuItems} />
            ) : null}
            {workMode === 'advanced' && prepCollapsed ? (
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
            <PersonaBinding
              options={personaInject.options}
              value={personaInject.persona}
              onChange={(p) => personaInject.selectPersona(p?.id ?? null)}
            />
          </WorkbenchPageChromeActions>
        ) : undefined
      }
    >
      {!demoMode && pageView === 'history' ? (
        <WorkbenchPageHistoryPanel layout={historyLayout} onLayoutChange={setHistoryLayout}>
          <WorkbenchTaskHistory
            items={pageHistoryItems}
            onRemove={removeTask}
            emptyHint={t('workbench:pageHistoryEmpty')}
          />
        </WorkbenchPageHistoryPanel>
      ) : workMode === 'wizard' ? (
        <XiaohongshuBenchmarkPanel
          onComplete={handleWizardComplete}
          onExitToStudio={() => setWorkMode('advanced')}
          onOpenHistory={() => setPageView('history')}
          devHandlesRef={wizardDevRef}
        />
      ) : (
        <XiaohongshuInspirationStudioPanel
          prepCollapsed={prepCollapsed}
          onPrepCollapsedChange={setPrepCollapsed}
          prepCollapseLabel={t('socialPublish:prepCollapse')}
          prep={prepPanel}
          contentMode={contentMode}
          onContentModeChange={handleContentModeChange}
          hasDraft={hasDraft}
          effectiveXhsMode={effectiveXhsMode}
          onXhsPublishModeChange={setXhsPublishMode}
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
          previewPrefs={previewPrefs}
        />
      )}
    </Page>
  )
}
