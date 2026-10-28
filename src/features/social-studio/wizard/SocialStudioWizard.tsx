import { useState, useCallback, useEffect, useRef, type MutableRefObject } from 'react'
import { createAgentClients, isAbortError } from '../../../agent'
import { runSocialWizardOutlineFlow } from '../agent/run-social-wizard-outline-flow'
import { notifyOperationError } from '../../../lib/toast'
import { normalizeOperationErrorMessage } from '../../../lib/normalize-operation-error'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type {
  WizardStep,
  StudioCoverTemplate,
  WizardCustomConfig,
  WizardOutlinePlan,
  WizardGeneratedResult,
  CreationOrigin,
  IdeationTopicForm,
  TopicAngleOption,
} from './types'
import { STUDIO_COVER_TEMPLATES, WECHAT_COVER_TEMPLATES } from './cover-templates'
import { StepHeaderBar } from './StepHeaderBar'
import { StepSearchCollect } from './steps/StepSearchCollect'
import { StepSelectBenchmark } from './steps/StepSelectBenchmark'
import { StepSelectAngle } from './steps/StepSelectAngle'
import { StepSelectTemplate } from './steps/StepSelectTemplate'
import { StepCustomAdjust } from './steps/StepCustomAdjust'
import { StepOutlinePlan } from './steps/StepOutlinePlan'
import { StepGenerationProgress } from './steps/StepGenerationProgress'
import { runWizardCompose } from './wizard-generator'
import './social-studio-wizard.css'

export type SocialStudioWizardDevHandles = {
  fillBenchmarkFixture: (benchmark: WorkbenchBridgeCollectedItem) => void
  fillOutlineFixture: (outline: WizardOutlinePlan) => void
  fillResultMock: (result: WizardGeneratedResult) => void
  resetWizard: () => void
}

type SocialStudioWizardProps = {
  platform: 'xhs' | 'wechat'
  onComplete: (result: WizardGeneratedResult) => void
  onExitToStudio: () => void
  onOpenHistory?: () => void
  initialBenchmark?: WorkbenchBridgeCollectedItem
  devHandlesRef?: MutableRefObject<SocialStudioWizardDevHandles | null>
}

export function SocialStudioWizard({
  platform,
  onComplete,
  onExitToStudio,
  onOpenHistory,
  initialBenchmark,
  devHandlesRef,
}: SocialStudioWizardProps) {
  // 创作起点：爆款复刻 vs AI 主题灵感创作
  const [origin, setOrigin] = useState<CreationOrigin>('benchmark_clone')
  const [topicForm, setTopicForm] = useState<IdeationTopicForm>({
    topic: '',
    expressionStyle: 'dry_goods',
  })
  const [selectedAngle, setSelectedAngle] = useState<TopicAngleOption | null>(null)

  const [currentStep, setCurrentStep] = useState<WizardStep>(() =>
    initialBenchmark ? 'benchmark' : 'search',
  )
  const [collectedItems, setCollectedItems] = useState<WorkbenchBridgeCollectedItem[]>(() =>
    initialBenchmark ? [initialBenchmark] : [],
  )
  const [selectedBenchmark, setSelectedBenchmark] = useState<WorkbenchBridgeCollectedItem | null>(
    () => initialBenchmark || null,
  )

  const defaultTemplates = platform === 'xhs' ? STUDIO_COVER_TEMPLATES : WECHAT_COVER_TEMPLATES
  const [selectedTemplate, setSelectedTemplate] = useState<StudioCoverTemplate>(
    () => defaultTemplates[1] || defaultTemplates[0],
  )

  const [customConfig, setCustomConfig] = useState<WizardCustomConfig>({
    wordCount: '300',
    useEmoji: true,
    imageResolution: 'standard',
    keepOriginalImages: false,
    customRequirement: '',
    referenceImages: [],
  })

  const [outlinePlan, setOutlinePlan] = useState<WizardOutlinePlan>({
    suggestedTitles: [], hook: '', sections: [], conclusion: '', visualStyle: '', imagePlans: [],
  })
  const [outlinePlanning, setOutlinePlanning] = useState(false)
  const [outlinePlanningError, setOutlinePlanningError] = useState<string | null>(null)
  const outlineAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => outlineAbortRef.current?.abort(), [])

  // 生成状态
  const [generating, setGenerating] = useState(false)
  const [progressPercent, setProgressPercent] = useState(10)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [stageLabel, setStageLabel] = useState('准备开始')
  const [isDone, setIsDone] = useState(false)
  const [finalResult, setFinalResult] = useState<WizardGeneratedResult | null>(null)

  const patchCustomConfig = useCallback((patch: Partial<WizardCustomConfig>) => {
    setCustomConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const patchOutlinePlan = useCallback((patch: Partial<WizardOutlinePlan>) => {
    setOutlinePlan((prev) => ({ ...prev, ...patch }))
  }, [])

  // 开发环境调试句柄暴露
  useEffect(() => {
    if (!devHandlesRef) return
    devHandlesRef.current = {
      fillBenchmarkFixture: (benchmark) => {
        setOrigin('benchmark_clone')
        setCollectedItems([benchmark])
        setSelectedBenchmark(benchmark)
        setCurrentStep('template')
        setIsDone(false)
        setFinalResult(null)
      },
      fillOutlineFixture: (outline) => {
        setOutlinePlan(outline)
        setCurrentStep('outline')
        setIsDone(false)
        setFinalResult(null)
      },
      fillResultMock: (result) => {
        setGeneratedImages(result.imageUrls || [])
        setFinalResult(result)
        setIsDone(true)
        setProgressPercent(100)
        setStageLabel('生成完成（调试模拟）')
        setCurrentStep('generating')
      },
      resetWizard: () => {
        setOrigin('benchmark_clone')
        setCurrentStep('search')
        setSelectedBenchmark(null)
        setCollectedItems([])
        setIsDone(false)
        setFinalResult(null)
        setGenerating(false)
      },
    }
    return () => {
      devHandlesRef.current = null
    }
  }, [devHandlesRef])

  // 导航判定
  const canNavigateTo = useCallback(
    (step: WizardStep) => {
      if (generating) return false
      if (step === 'search') return true
      if (step === 'benchmark') {
        return origin === 'topic_ideation' ? Boolean(topicForm.topic) : collectedItems.length > 0
      }
      if (step === 'template') {
        return origin === 'topic_ideation' ? Boolean(selectedAngle || topicForm.topic) : Boolean(selectedBenchmark)
      }
      if (step === 'custom') {
        return origin === 'topic_ideation' ? Boolean(topicForm.topic) : Boolean(selectedBenchmark)
      }
      if (step === 'outline') {
        return origin === 'topic_ideation' ? Boolean(topicForm.topic) : Boolean(selectedBenchmark)
      }
      if (step === 'generating') return isDone
      return false
    },
    [collectedItems.length, generating, isDone, origin, selectedAngle, selectedBenchmark, topicForm.topic],
  )

  const planOutline = useCallback(async () => {
    outlineAbortRef.current?.abort()
    const controller = new AbortController()
    outlineAbortRef.current = controller
    setCurrentStep('outline')
    setOutlinePlanning(true)
    setOutlinePlanningError(null)
    try {
      const result = await runSocialWizardOutlineFlow({
        platform,
        origin,
        benchmark: selectedBenchmark,
        referenceImageUrls: origin === 'benchmark_clone' ? selectedBenchmark?.imageUrls ?? [] : [],
        topicForm: origin === 'topic_ideation' ? topicForm : undefined,
        selectedAngle: origin === 'topic_ideation' ? selectedAngle || undefined : undefined,
        customConfig,
        template: selectedTemplate,
        clients: createAgentClients({
          mockResponder: () => {
            const subject = topicForm.topic.trim() || selectedBenchmark?.title || '主题创作'
            const angle = selectedAngle?.title || '实用经验梳理'
            const imageCount = platform === 'xhs' ? (selectedTemplate.id === 'no_cover' ? 3 : 4) : 4
            const sectionVisuals = [
              '桌面俯拍：主题关键词、便签与简洁场景图',
              '三步流程卡片，使用清晰编号和留白',
              '检查清单与重点标注的收尾画面',
            ]
            return {
              suggestedTitles: [`【演示】${subject}：一份实用梳理`, `【演示】从${angle}看${subject}`, `【演示】关于${subject}的入门清单`],
              hook: `这是「${subject}」的演示规划开篇，正式发布前请核对资料并补充真实依据。`,
              sections: [
                { headline: '先明确适用场景', visualDescription: '桌面俯拍：主题关键词、便签与简洁场景图', bodyDraft: `说明${subject}面向的人群与适用边界，不添加未经核实的数据。` },
                { headline: '整理关键步骤', visualDescription: '三步流程卡片，使用清晰编号和留白', bodyDraft: `围绕${angle}整理可执行步骤，内容仅作演示结构。` },
                { headline: '总结注意事项', visualDescription: '检查清单与重点标注的收尾画面', bodyDraft: '列出需要进一步确认的条件，并给出审慎的总结。' },
              ],
              conclusion: '以上为本地演示大纲，不代表真实模型生成结果。',
              visualStyle: '演示统一风格：暖米白底色、柔和自然光、低饱和陶土橘点缀、简洁编辑式构图。',
              imagePlans: Array.from({ length: imageCount }, (_, index) => {
                const sectionIndex = selectedTemplate.id === 'no_cover' ? index + 1 : index
                const isCover = selectedTemplate.id !== 'no_cover' && index === 0
                return {
                  index: index + 1,
                  role: isCover ? 'cover' as const : 'section' as const,
                  sectionIndex: isCover ? undefined : sectionIndex,
                  titleText: isCover ? `【演示】${subject}` : `【演示】${['明确场景', '整理步骤', '注意事项'][(sectionIndex - 1) % 3]}`,
                  supportingText: isCover ? '本机演示规划，发布前请核实' : '演示结构，请替换为核实后的信息',
                  badgeText: '演示内容',
                  visualDescription: sectionVisuals[(sectionIndex - 1 + sectionVisuals.length) % sectionVisuals.length],
                }
              }),
            }
          },
        }),
        signal: controller.signal,
      })
      setOutlinePlan(result)
    } catch (error) {
      if (isAbortError(error)) return
      const message = normalizeOperationErrorMessage(error instanceof Error ? error.message : String(error))
      setOutlinePlanningError(message)
      notifyOperationError(message, { id: 'social-wizard-outline' })
    } finally {
      if (outlineAbortRef.current === controller) {
        outlineAbortRef.current = null
        setOutlinePlanning(false)
      }
    }
  }, [customConfig, origin, platform, selectedAngle, selectedBenchmark, selectedTemplate, topicForm])

  // 触发生成
  const startGenerating = useCallback(async () => {
    if (!outlinePlan.suggestedTitles.length || !outlinePlan.sections.length || !outlinePlan.imagePlans.length) return
    setCurrentStep('generating')
    setGenerating(true)
    setProgressPercent(15)
    setStageLabel(origin === 'topic_ideation' ? '正在基于所选切入点策划完整图文...' : '正在拆解母本爆款脉络...')

    try {
      const res = await runWizardCompose({
        platform,
        origin,
        benchmark: selectedBenchmark,
        topicForm: origin === 'topic_ideation' ? topicForm : undefined,
        selectedAngle: origin === 'topic_ideation' ? selectedAngle || undefined : undefined,
        template: selectedTemplate,
        customConfig,
        outlinePlan,
        onProgress: (percent, stage) => {
          setProgressPercent(percent)
          setStageLabel(stage)
        },
      })
      setGeneratedImages(res.imageUrls)
      setFinalResult(res)
      setIsDone(true)
      setProgressPercent(100)
      setStageLabel('图文创作完成')
    } catch (error) {
      if (!isAbortError(error)) {
        const message = normalizeOperationErrorMessage(error instanceof Error ? error.message : String(error))
        notifyOperationError(message, { id: 'social-wizard-compose' })
      }
      setFinalResult(null)
      setIsDone(false)
      setCurrentStep('outline')
    } finally {
      setGenerating(false)
    }
  }, [customConfig, origin, outlinePlan, platform, selectedAngle, selectedBenchmark, selectedTemplate, topicForm])

  const handleEnterStudioWithResult = useCallback(() => {
    if (finalResult) {
      onComplete(finalResult)
    } else {
      onExitToStudio()
    }
  }, [finalResult, onComplete, onExitToStudio])

  return (
    <div
      className={`social-studio-wizard w-full flex flex-col relative bg-transparent${
        currentStep === 'search' ? ' social-studio-wizard--step-search' : ' min-h-[calc(100vh-140px)]'
      }`}
    >
      {/* 底部悬浮式步骤导航 Dock 与悬浮球 */}
      <StepHeaderBar
        currentStep={currentStep}
        origin={origin}
        onStepClick={(step) => {
          if (step === 'outline' && outlinePlan.imagePlans.length === 0) void planOutline()
          else setCurrentStep(step)
        }}
        canNavigateTo={canNavigateTo}
      />

      {/* 步骤内容区域（底部留足 pb-28，避免被底部悬浮胶囊遮挡） */}
      <div className="social-studio-wizard__content flex-1 w-full pb-28 bg-transparent">
        {currentStep === 'search' && (
          <StepSearchCollect
            platform={platform}
            initialKeyword={selectedBenchmark?.title || topicForm.topic || ''}
            initialOrigin={origin}
            onTopicIdeation={(form) => {
              setTopicForm(form)
              setOrigin('topic_ideation')
              setSelectedAngle(null)
              setOutlinePlan({ suggestedTitles: [], hook: '', sections: [], conclusion: '', visualStyle: '', imagePlans: [] })
              setCurrentStep('benchmark')
            }}
            onCollected={(items, directAdvanceToTemplate) => {
              setOrigin('benchmark_clone')
              setCollectedItems(items)
              if (items.length > 0) {
                const target = items[0]
                setSelectedBenchmark(target)

                setOutlinePlan({ suggestedTitles: [], hook: '', sections: [], conclusion: '', visualStyle: '', imagePlans: [] })

                // 仅自备文稿可直达模板；链接/关键词抓取先进「选择爆款」
                if (directAdvanceToTemplate) {
                  setCurrentStep('template')
                } else {
                  setCurrentStep('benchmark')
                }
              }
            }}
            onGoToAdvancedStudio={onExitToStudio}
          />
        )}

        {/* 步骤 2：分支 A 为挑选爆款母本，分支 B 为 AI 策划切入点 */}
        {currentStep === 'benchmark' && (
          origin === 'topic_ideation' ? (
            <StepSelectAngle
              platform={platform}
              topicForm={topicForm}
              selectedAngle={selectedAngle}
              onSelect={(angle) => setSelectedAngle(angle)}
              onNext={() => setCurrentStep('template')}
              onBack={() => setCurrentStep('search')}
            />
          ) : (
            <StepSelectBenchmark
              items={collectedItems}
              selectedItem={selectedBenchmark}
              onSelect={(item) => setSelectedBenchmark(item)}
              onNext={() => setCurrentStep('template')}
              onBack={() => setCurrentStep('search')}
              queryText={selectedBenchmark?.title || '热门'}
            />
          )
        )}

        {currentStep === 'template' && (
          <StepSelectTemplate
            platform={platform}
            selectedBenchmark={selectedBenchmark}
            selectedTemplate={selectedTemplate}
            onSelect={(t) => setSelectedTemplate(t)}
            onNext={() => setCurrentStep('custom')}
            onBack={() => {
              if (origin === 'topic_ideation') {
                setCurrentStep('benchmark')
              } else if (collectedItems.length <= 1) {
                setCurrentStep('search')
              } else {
                setCurrentStep('benchmark')
              }
            }}
          />
        )}

        {currentStep === 'custom' && (
          <StepCustomAdjust
            platform={platform}
            config={customConfig}
            onChange={patchCustomConfig}
            onNext={() => void planOutline()}
            onBack={() => setCurrentStep('template')}
          />
        )}

        {currentStep === 'outline' && (
          <StepOutlinePlan
            platform={platform}
            outline={outlinePlan}
            onChange={patchOutlinePlan}
            onNext={startGenerating}
            onBack={() => setCurrentStep('custom')}
            planning={outlinePlanning}
            planningError={outlinePlanningError}
            onRetry={() => void planOutline()}
          />
        )}

        {currentStep === 'generating' && (
          <StepGenerationProgress
            platform={platform}
            progressPercent={progressPercent}
            generatedImageCount={generatedImages.length}
            targetImageCount={outlinePlan.imagePlans.length}
            currentStageLabel={stageLabel}
            isDone={isDone}
            onEnterStudio={handleEnterStudioWithResult}
            onGoHistory={onOpenHistory}
          />
        )}
      </div>
    </div>
  )
}
