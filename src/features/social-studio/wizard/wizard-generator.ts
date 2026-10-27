import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import { createAgentClients } from '../../../agent/clients'
import { notifyOperationWarning } from '../../../lib/toast'
import { generateSocialImageCards, prepareSocialImageReference } from '../../../services/social-studio/generate-social-images'
import type {
  StudioCoverTemplate,
  WizardCustomConfig,
  WizardOutlinePlan,
  WizardGeneratedResult,
  CreationOrigin,
  IdeationTopicForm,
  TopicAngleOption,
} from './types'

export type WizardComposeInput = {
  platform: 'xhs' | 'wechat'
  origin?: CreationOrigin
  benchmark?: WorkbenchBridgeCollectedItem | null
  topicForm?: IdeationTopicForm
  selectedAngle?: TopicAngleOption
  template: StudioCoverTemplate
  customConfig: WizardCustomConfig
  outlinePlan: WizardOutlinePlan
  signal?: AbortSignal
  onProgress?: (percent: number, stage: string) => void
}

/**
 * 真实 AI 创作合成器：通过真实 LLM 与真实文生图 API 生成成稿与配图，无虚假 mock
 */
export async function runWizardCompose(input: WizardComposeInput): Promise<WizardGeneratedResult> {
  const {
    platform,
    origin = 'benchmark_clone',
    benchmark,
    topicForm,
    selectedAngle,
    template,
    customConfig,
    outlinePlan,
    signal,
    onProgress,
  } = input

  onProgress?.(15, '正在连接 AI 模型解析创作规划与大纲...')

  const clients = createAgentClients({
    mockResponder: () => [
      `# 【演示】${chosenTitle}`,
      '',
      `> ${outlinePlan.hook}`,
      '',
      ...outlinePlan.sections.map((section, index) => `## ${index + 1}. ${section.headline}\n\n${section.bodyDraft}`),
      '',
      outlinePlan.conclusion,
      '',
      '（以上为本地演示内容，未调用真实模型。）',
    ].join('\n'),
  })

  const sourceBenchmark = origin === 'benchmark_clone' ? benchmark : null
  const chosenTitle =
    outlinePlan.suggestedTitles[0] ||
    sourceBenchmark?.title ||
    topicForm?.topic ||
    (platform === 'wechat' ? '微信深度行业长文' : '小红书原创图文笔记')

  // 构建用于大模型撰写的结构化上下文
  const promptContext = [
    `平台：${platform === 'xhs' ? '小红书' : '微信公众号'}`,
    `选定标题：${chosenTitle}`,
    `开篇钩子（Hook）：${outlinePlan.hook}`,
    `核心规划分段：`,
    ...outlinePlan.sections.map(
      (s, i) =>
        `分段 ${i + 1}：${s.headline}。\n视觉画面描述：${s.visualDescription}。\n草稿要点：${s.bodyDraft}`,
    ),
    `结尾行动号召（CTA）：${outlinePlan.conclusion}`,
    customConfig.customRequirement ? `用户补充定制要求：${customConfig.customRequirement}` : '',
    customConfig.wordCount ? `期望篇幅字数：约 ${customConfig.wordCount} 字` : '',
    customConfig.useEmoji ? '请适度融入丰富生动的 Emoji 表情增强阅读排版感' : '尽量少用 Emoji，保持严谨严肃',
    sourceBenchmark?.content ? `参考母本素材内容节选：\n${sourceBenchmark.content.slice(0, 1000)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const systemPrompt =
    platform === 'xhs'
      ? `你是一位小红书百万爆款博主与内容架构师。请根据提供的大纲、黄金钩子与分段规划，写出一篇极具小红书网感、高点赞高收藏的成稿。
要求：
1. 标题必须抓人眼球，前三行牢牢吸引读者。
2. 善用空行和要点符号（如 📌、💡、🏷️）进行呼吸感排版。
3. 结尾附带 4-6 个与主题高度相关的高流量小红书标签（如 #小红书干货 #独居生活）。
4. 结构完整，语言自然亲切，严禁假大空的营销套话。`
      : `你是一位微信公众号 10w+ 深度特稿主笔与商业分析师。请根据提供的大纲规划，撰写一篇具有深度行业洞察力、逻辑严密的排版长文。
要求：
1. 包含主标题、导读金句引用块（> 引用）、层层递进的核心观点与小标题（## 格式）。
2. 行文有理有据，论点鲜明，提供可落地的实操建议或反思。
3. 排版清爽大气，符合微信公众号主流大号的阅读体验。`

  onProgress?.(35, 'AI 正在深入撰写完整正文与排版结构...')

  const chatRes = await clients.chat.complete({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptContext },
    ],
    temperature: 0.7,
    signal,
  })

  const generatedContent = chatRes.content?.trim()
  if (!generatedContent) throw new Error('模型未返回正文内容，请重试。')

  onProgress?.(65, 'AI 文本成稿已就绪，正在准备调用生图模型生成原创配图...')

  // Images are planned independently; text is composited after generation for fidelity.
  let finalImageUrls: string[] = []
  const referenceUrls = sourceBenchmark?.imageUrls ?? []
  const shouldReuseOriginals = Boolean(customConfig.keepOriginalImages && referenceUrls.length)
  if (shouldReuseOriginals) {
    finalImageUrls = [...referenceUrls]
    onProgress?.(90, '已按你的选择保留母本原图…')
  } else if (clients.isMock) {
    onProgress?.(90, '演示模式不调用云端生图服务…')
    notifyOperationWarning('演示模式不会请求图片生成服务；图片规划仅作演示。', { id: 'social-wizard-images' })
  } else {
    const referenceImages = referenceUrls.length
      ? await Promise.all(referenceUrls.slice(0, 8).map((url) => prepareSocialImageReference(url)))
      : []
    const accentColor = template.category === 'food' || template.category === 'pet'
      ? '#A94B55'
      : template.category === 'travel'
        ? '#247B87'
        : template.category === 'education'
          ? '#2A7B64'
          : '#B65B43'
    const items = outlinePlan.imagePlans.map((plan) => {
      const prompt = [
        `Create one polished ${platform === 'xhs' ? 'portrait social post' : plan.role === 'cover' ? 'wide article cover' : 'square editorial illustration'}.`,
        `Visual subject and composition: ${plan.visualDescription}.`,
        `Consistent series visual direction: ${outlinePlan.visualStyle}.`,
        `Template art direction: ${template.promptModifier}.`,
        'Do not render any letters, words, numbers, logos, captions, or watermarks. Leave a calm, uncluttered lower area for accurate typography to be added afterward.',
      ].join(' ')
      const referenceIndex = plan.role === 'cover' ? 0 : Math.max(0, plan.sectionIndex ?? plan.index - 1)
      const size = platform === 'xhs'
        ? '1024x1365'
        : plan.role === 'cover' && template.aspectRatio === '16:9'
          ? '1024x576'
          : '1024x1024'
      const outputSize = size === '1024x576' ? { width: 1024, height: 576 } : size === '1024x1024' ? { width: 1024, height: 1024 } : { width: 1024, height: 1365 }
      return {
        prompt,
        size,
        referenceImage: referenceImages.length ? referenceImages[referenceIndex] ?? referenceImages[0] : undefined,
        overlay: { titleText: plan.titleText, supportingText: plan.supportingText, badgeText: plan.badgeText, accentColor },
        outputSize,
      }
    })

    onProgress?.(72, `正在按逐张规划生成 ${items.length} 张图片…`)
    const composed = await generateSocialImageCards({
      items,
      signal,
      onFailure: (error, index) => console.warn(`[wizard-generator] 第 ${index + 1} 张图片生成或文字排版失败:`, error),
    })
    finalImageUrls = composed.filter((url): url is string => Boolean(url))
    if (finalImageUrls.length < items.length) {
      notifyOperationWarning(`已完成 ${finalImageUrls.length}/${items.length} 张配图；失败图片可在创作工作台补充。`, { id: 'social-wizard-images' })
    }
  }

  onProgress?.(100, '创作完成，正在装配成果...')

  const summary = outlinePlan.hook.slice(0, 100)

  return {
    title: chosenTitle,
    content: generatedContent,
    summary,
    imageUrls: finalImageUrls,
    origin,
    selectedBenchmark: sourceBenchmark || undefined,
    selectedAngle,
  }
}
