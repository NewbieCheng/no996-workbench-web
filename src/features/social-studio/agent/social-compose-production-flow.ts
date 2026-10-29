import {
  createStageRunner,
  type AgentClients,
  type AgentSink,
} from '../../../agent'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/prepare'
import {
  buildSocialStudioPrompt,
  type ResolvedReference,
} from '../creative/build-social-studio-prompt'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'
import type { SocialContentMode } from '../studio-types'
import {
  buildSocialImagePrompts,
  composeSocialImageCards,
  generateSocialImageArtwork,
  prepareSocialImageReference,
  type SocialImageProgress,
} from '../../../services/social-studio/generate-social-images'
import { classifySocialSource, supportsImageTemplate } from '../wizard/source-kind'
import type { StudioCoverTemplate, WizardCustomConfig, WizardImagePlan, WizardOutlinePlan } from '../wizard/types'
import type {
  SocialComposeResult,
  SocialComposeSourceKind,
  SocialComposeTaskPayload,
} from './task-types'
import { SOCIAL_COMPOSE_FLOW_ID, SOCIAL_COMPOSE_STAGES } from './stages'
import { resolveReference } from './social-compose-flow'

export type RunSocialComposeProductionInput = {
  payload: SocialComposeTaskPayload
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  onDelta?: (chunk: string) => void
  onText?: (text: string) => void
  onImageProgress?: (progress: SocialImageProgress) => void
}

type PlannedImage = {
  prompt: string
  size: string
  referenceImage?: string
  overlay?: {
    titleText: string
    supportingText: string
    badgeText?: string
    accentColor?: string
  }
  outputSize: { width: number; height: number }
}

type PlanResult = {
  title: string
  content: string
  summary: string
  reference: ResolvedReference | null
  sourceKind: SocialComposeSourceKind
  plannedImages: PlannedImage[]
  warnings: string[]
  keepOriginalImages: boolean
  originalImages: string[]
}

function platformLabel(platform: SocialStudioPlatform): string {
  return platform === 'xhs' ? '小红书' : '微信公众号'
}

function sourceKindOfBenchmark(
  platform: SocialStudioPlatform,
  benchmark: WorkbenchBridgeCollectedItem | null | undefined,
): SocialComposeSourceKind {
  if (platform === 'wechat') return 'article'
  return classifySocialSource(benchmark)
}

function buildWizardPrompt(input: {
  payload: SocialComposeTaskPayload
  title: string
  benchmark: WorkbenchBridgeCollectedItem | null
  outline: WizardOutlinePlan
  template: StudioCoverTemplate
  customConfig: WizardCustomConfig
}): { system: string; user: string } {
  const { payload, title, benchmark, outline, template, customConfig } = input
  const platform = payload.platform
  const sourceBenchmark = payload.origin === 'benchmark_clone' ? benchmark : null
  const promptContext = [
    `平台：${platformLabel(platform)}`,
    `选定标题：${title}`,
    `开篇钩子（Hook）：${outline.hook}`,
    '核心规划分段：',
    ...outline.sections.map(
      (section, index) =>
        `分段 ${index + 1}：${section.headline}。\n视觉画面描述：${section.visualDescription}。\n草稿要点：${section.bodyDraft}`,
    ),
    `结尾行动号召（CTA）：${outline.conclusion}`,
    customConfig.customRequirement ? `用户补充定制要求：${customConfig.customRequirement}` : '',
    customConfig.wordCount ? `期望篇幅字数：约 ${customConfig.wordCount} 字` : '',
    customConfig.useEmoji ? '请适度融入丰富生动的 Emoji 表情增强阅读排版感' : '尽量少用 Emoji，保持严谨严肃',
    sourceBenchmark?.content ? `参考母本素材内容节选：\n${sourceBenchmark.content.slice(0, 1000)}` : '',
    `视觉模板：${template.name}。${template.promptModifier}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const system =
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

  return { system, user: promptContext }
}

function buildWizardImages(input: {
  payload: SocialComposeTaskPayload
  outline: WizardOutlinePlan
  template: StudioCoverTemplate
  referenceImages: string[]
}): PlannedImage[] {
  const { payload, outline, template, referenceImages } = input
  const accentColor =
    template.category === 'food' || template.category === 'pet'
      ? '#A94B55'
      : template.category === 'travel'
        ? '#247B87'
        : template.category === 'education'
          ? '#2A7B64'
          : '#B65B43'

  return outline.imagePlans.map((plan: WizardImagePlan) => {
    const prompt = [
      `Create one polished ${payload.platform === 'xhs' ? 'portrait social post' : plan.role === 'cover' ? 'wide article cover' : 'square editorial illustration'}.`,
      `Visual subject and composition: ${plan.visualDescription}.`,
      `Consistent series visual direction: ${outline.visualStyle}.`,
      `Template art direction: ${template.promptModifier}.`,
      'Do not render any letters, words, numbers, logos, captions, or watermarks. Leave a calm, uncluttered lower area for accurate typography to be added afterward.',
    ].join(' ')
    const referenceIndex = plan.role === 'cover' ? 0 : Math.max(0, plan.sectionIndex ?? plan.index - 1)
    const size =
      payload.platform === 'xhs'
        ? '1024x1365'
        : plan.role === 'cover' && template.aspectRatio === '16:9'
          ? '1024x576'
          : '1024x1024'
    return {
      prompt,
      size,
      referenceImage: referenceImages.length ? referenceImages[referenceIndex] ?? referenceImages[0] : undefined,
      overlay: {
        titleText: plan.titleText,
        supportingText: plan.supportingText,
        badgeText: plan.badgeText,
        accentColor,
      },
      outputSize:
        size === '1024x576'
          ? { width: 1024, height: 576 }
          : size === '1024x1024'
            ? { width: 1024, height: 1024 }
            : { width: 1024, height: 1365 },
    }
  })
}

function buildStudioImages(brief: SocialStudioBrief, platform: SocialStudioPlatform): PlannedImage[] {
  const count = Math.min(4, Math.max(0, brief.imageCount))
  if (!count) return []
  const prompts = buildSocialImagePrompts({
    title: brief.topic.trim() || brief.summary.trim() || '原创配图',
    style: `${brief.expressionStyle}, ${brief.voiceTone}`,
    count,
  }).slice(0, count)
  return (prompts.length ? prompts : [brief.topic || '原创配图']).map((prompt) => ({
    prompt,
    size: platform === 'xhs' ? '1024x1365' : '1024x1024',
    outputSize:
      platform === 'xhs' ? { width: 1024, height: 1365 } : { width: 1024, height: 1024 },
  }))
}

async function prepareReferences(urls: string[]): Promise<string[]> {
  const selected = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 8)
  const references: string[] = []
  for (const url of selected) {
    try {
      references.push(await prepareSocialImageReference(url))
    } catch {
      // 参考图不可用不应阻断整篇生成；正文与后续图片仍可继续。
    }
  }
  return references
}

export async function runSocialComposeProductionFlow(
  input: RunSocialComposeProductionInput,
): Promise<SocialComposeResult> {
  const { payload, clients, sink, signal } = input
  const platform = payload.platform
  const contentMode: SocialContentMode = payload.contentMode
  const runner = createStageRunner({
    flowId: SOCIAL_COMPOSE_FLOW_ID,
    stages: SOCIAL_COMPOSE_STAGES,
    clients,
    sink,
    signal,
    background: payload.personaContent?.trim() || undefined,
  })

  const state: PlanResult = {
    title:
      payload.existingTitle?.trim() ||
      payload.outlinePlan?.suggestedTitles[0]?.trim() ||
      payload.benchmark?.title?.trim() ||
      payload.brief?.topic.trim() ||
      (platform === 'wechat' ? '微信公众号长文' : '小红书原创图文'),
    content: payload.existingContent?.trim() || '',
    summary: '',
    reference: null,
    sourceKind: platform === 'wechat' ? 'article' : 'image_text',
    plannedImages: [],
    warnings: [],
    keepOriginalImages: Boolean(payload.customConfig?.keepOriginalImages),
    originalImages: payload.benchmark?.imageUrls ?? [],
  }

  await runner.runTool('resolve-source', async () => {
    const benchmark = payload.origin === 'benchmark_clone' ? payload.benchmark ?? null : null
    state.sourceKind = sourceKindOfBenchmark(platform, benchmark)

    if (benchmark) {
      state.reference = {
        title: benchmark.title,
        content: benchmark.content || benchmark.title,
        author: benchmark.author,
        platform: benchmark.platformId,
        sourceUrl: benchmark.url,
      }
    } else if (payload.brief) {
      state.reference = await resolveReference(platform, payload.brief, null, clients, signal)
      // 灵感创作从链接解析时没有原始 item；保持 unknown，让后续图片阶段按用户配置继续。
      state.sourceKind = platform === 'wechat' ? 'article' : 'image_text'
    }

    if (payload.action !== 'images_only' && contentMode === 'image_text' && state.sourceKind === 'video') {
      state.warnings.push('来源是视频笔记，不能套用图文排版模板；本次只交付文案，未生成排版配图。')
    }
    return { sourceKind: state.sourceKind, reference: state.reference }
  })

  if (payload.action !== 'images_only') {
    const wizard = payload.mode === 'wizard' && payload.outlinePlan && payload.template && payload.customConfig
    const built = wizard
      ? buildWizardPrompt({
          payload,
          title: state.title,
          benchmark: payload.benchmark ?? null,
          outline: payload.outlinePlan!,
          template: payload.template!,
          customConfig: payload.customConfig!,
        })
      : buildSocialStudioPrompt({
          platform,
          brief: payload.brief!,
          contentMode,
          personaContent: payload.personaContent,
          reference: state.reference,
        })

    let streamed = ''
    const body = await runner.runModel('compose-body', {
      system: built.system,
      user: built.user,
      chatAttachments: payload.chatAttachments as StoredChatAttachment[] | undefined,
      parse: (raw) => raw.trim(),
      onDelta: (chunk) => {
        streamed += chunk
        input.onDelta?.(chunk)
        input.onText?.(streamed)
      },
    })
    state.content = body.trim()
    if (!state.content) throw new Error('模型未返回正文内容，请重试。')
    state.summary = state.content.replace(/\s+/g, ' ').slice(0, 100)
  } else {
    // 只生图必须已有正文；没有正文时明确失败，不伪造空稿。
    if (!state.content) throw new Error('缺少已有正文，无法只生成配图。')
    state.summary = payload.brief?.summary?.trim() || state.content.replace(/\s+/g, ' ').slice(0, 100)
    await runner.skip('compose-body')
  }

  await runner.runTool('plan-images', async () => {
    const canComposeTemplate = supportsImageTemplate(state.sourceKind)
    if (payload.action === 'images_only' && payload.brief) {
      state.plannedImages = contentMode === 'image_text' ? buildStudioImages(payload.brief, platform) : []
      return state.plannedImages
    }
    if (payload.mode === 'wizard' && payload.outlinePlan && payload.template) {
      if (contentMode === 'article' || !canComposeTemplate) {
        state.plannedImages = []
        return state.plannedImages
      }
      const referenceUrls = state.keepOriginalImages ? [] : payload.benchmark?.imageUrls ?? []
      const referenceImages = clients.isMock ? [] : await prepareReferences(referenceUrls)
      state.plannedImages = buildWizardImages({
        payload,
        outline: payload.outlinePlan,
        template: payload.template,
        referenceImages,
      })
      return state.plannedImages
    }
    state.plannedImages = contentMode === 'image_text' && payload.brief
      ? buildStudioImages(payload.brief, platform)
      : []
    return state.plannedImages
  })

  let imageUrls: string[] = []
  let failedImageCount = 0

  if (state.plannedImages.length === 0) {
    await runner.skip('generate-images')
    await runner.skip('compose-cards')
  } else if (state.keepOriginalImages && state.originalImages.length > 0) {
    await runner.skip('generate-images')
    await runner.skip('compose-cards')
    imageUrls = [...state.originalImages]
  } else if (clients.isMock) {
    await runner.skip('generate-images')
    await runner.skip('compose-cards')
    state.warnings.push('演示模式不请求云端生图服务；配图规划仅作演示。')
  } else {
    const total = state.plannedImages.length
    const artwork = await runner.runTool('generate-images', async () => {
      await runner.setStageProgress('generate-images', {
        done: 0,
        total,
        label: `正在生成第 1/${total} 张配图…`,
      })
      return generateSocialImageArtwork({
        items: state.plannedImages.map((item) => ({
          prompt: item.prompt,
          size: item.size,
          referenceImage: item.referenceImage,
        })),
        signal,
        onFailure: () => {
          failedImageCount += 1
        },
        onProgress: (progress) => {
          input.onImageProgress?.(progress)
          void runner.setStageProgress('generate-images', {
            done: progress.done,
            total: progress.total,
            label:
              progress.done >= progress.total
                ? `已完成 ${progress.done}/${progress.total} 张配图`
                : `正在生成第 ${progress.done + 1}/${progress.total} 张配图…`,
          })
        },
      })
    })

    if (state.plannedImages.some((item) => item.overlay)) {
      const composed = await runner.runTool('compose-cards', async () => {
        await runner.setStageProgress('compose-cards', {
          done: 0,
          total,
          label: '正在把标题与辅助文字合成到配图上…',
        })
        return composeSocialImageCards({
          items: state.plannedImages.map((item, index) => ({
            imageUrl: artwork[index],
            overlay: item.overlay!,
            outputSize: item.outputSize,
          })),
          signal,
          onFailure: () => {
            failedImageCount += 1
          },
          onProgress: (progress) => {
            void runner.setStageProgress('compose-cards', {
              done: progress.done,
              total: progress.total,
              label: `正在合成第 ${progress.done}/${progress.total} 张图文卡片…`,
            })
          },
        })
      })
      imageUrls = composed.filter((url): url is string => Boolean(url))
    } else {
      await runner.skip('compose-cards')
      imageUrls = artwork.filter((url): url is string => Boolean(url))
    }
  }

  const result = await runner.runAlgo('finalize', () => {
    const failed = Math.max(failedImageCount, state.plannedImages.length - imageUrls.length)
    const warnings = [...state.warnings]
    if (failed > 0 && state.plannedImages.length > 0) {
      warnings.push(`已完成 ${imageUrls.length}/${state.plannedImages.length} 张配图；失败图片可在创作工作台补充。`)
    }
    const finalResult: SocialComposeResult = {
      platform,
      contentMode,
      mode: payload.mode,
      title: state.title,
      content: state.content,
      summary: state.summary,
      imageUrls,
      origin: payload.origin,
      selectedBenchmark: payload.benchmark ?? undefined,
      selectedAngle: payload.selectedAngle ?? undefined,
      sourceKind: state.sourceKind,
      warnings,
      failedImageCount: failed,
    }
    return finalResult
  })

  return result
}
