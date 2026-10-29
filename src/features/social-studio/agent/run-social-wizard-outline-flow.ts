import { createStageRunner, type AgentClients, type AgentSink } from '../../../agent'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type { StudioCoverTemplate, WizardCustomConfig, WizardOutlinePlan, CreationOrigin, IdeationTopicForm, TopicAngleOption } from '../wizard/types'
import { parseWizardOutline } from './wizard-outline-parse'
import { SOCIAL_WIZARD_OUTLINE_FLOW_ID, SOCIAL_WIZARD_OUTLINE_STAGES } from './wizard-outline-stages'
import { prepareSocialImageAttachments } from '../../../services/social-studio/generate-social-images'

export type RunSocialWizardOutlineFlowInput = {
  platform: 'xhs' | 'wechat'
  origin: CreationOrigin
  benchmark?: WorkbenchBridgeCollectedItem | null
  referenceImageUrls?: string[]
  topicForm?: IdeationTopicForm
  selectedAngle?: TopicAngleOption
  customConfig: WizardCustomConfig
  template: StudioCoverTemplate
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
}

export async function runSocialWizardOutlineFlow(input: RunSocialWizardOutlineFlowInput): Promise<WizardOutlinePlan> {
  const platformName = input.platform === 'xhs' ? '小红书' : '微信公众号'
  const benchmark = input.origin === 'benchmark_clone' ? input.benchmark : null
  const referenceImageUrls = input.origin === 'benchmark_clone' ? input.referenceImageUrls ?? [] : []
  const topic = input.topicForm?.topic.trim() || benchmark?.title?.trim() || ''
  const source = benchmark?.content?.trim() || input.topicForm?.topic.trim() || ''
  if (!topic && !source) throw new Error('缺少主题或参考素材，无法规划内容大纲。')

  const selectedAngle = input.selectedAngle
  const imageCount = input.platform === 'xhs' ? (input.template.id === 'no_cover' ? 3 : 4) : 4
  const imageRoles = input.platform === 'wechat'
    ? ['1 张公众号头图', '3 张与章节对应的正文配图']
    : input.template.id === 'no_cover'
      ? ['3 张与前三个章节对应的正文配图']
      : ['1 张封面图', '3 张与前三个章节对应的正文配图']
  const system = `你是${platformName}图文内容策划与视觉编辑。请只返回有效 JSON，不要 markdown 或解释。内容必须基于用户给出的主题或母本，不要编造数据、经历、效果承诺或不存在的事实。为整组图片制定同一套视觉风格，并逐张规划画面与确切上屏文字。`
  const user = [
    `请为这次${platformName}创作生成可编辑的内容规划。`,
    `创作方式：${input.origin === 'benchmark_clone' ? '分析参考母本并进行原创重构' : '按主题灵感创作'}`,
    `主题/母本标题：${topic || '未提供标题'}`,
    source ? `参考素材：\n${source.slice(0, 5000)}` : '',
    referenceImageUrls.length ? `随请求附带 ${Math.min(referenceImageUrls.length, 4)} 张母本图片。请根据图片的主体、构图、色彩、信息密度与视觉层级规划逐张重绘；禁止复刻原图水印或未经授权的品牌标识。` : '',
    selectedAngle ? `已选切入点：${selectedAngle.title}\n切入逻辑：${selectedAngle.angleConcept}\n目标痛点：${selectedAngle.targetPainPoint}\n开篇方向：${selectedAngle.recommendedHook}` : '',
    `篇幅：${input.customConfig.wordCount === 'same_as_original' ? '接近母本' : `约 ${input.customConfig.wordCount} 字`}`,
    `Emoji：${input.customConfig.useEmoji ? '可适度使用' : '尽量不用'}`,
    input.customConfig.customRequirement.trim() ? `额外要求：${input.customConfig.customRequirement.trim()}` : '',
    `图片模板：${input.template.name}；整组需要规划 ${imageCount} 张图（${imageRoles.join('，')}）。封面模板要求 imagePlans 恰好 1 张 cover 和 3 张 section；无封面模板要求恰好 3 张 section 且不能有 cover。sectionIndex 必须分别为 1、2、3，不能重复。`,
    '每张图必须规划：role（cover 或 section）、sectionIndex（正文图对应章节序号，封面省略）、titleText（上图主标题，建议 4–16 字）、supportingText（上图辅助短句，建议不超过 28 字）、badgeText（角标，建议不超过 8 字，可为空）、visualDescription（具体画面内容与主体位置）。',
    '输出 imagePlans 数组，长度必须与图片张数一致；所有文字只输出可直接上图的短文案，不要写占位说明。封面主标题围绕所选标题；正文图文字对应章节主题。',
    '另输出 visualStyle（≤120字，描述整组共用的色调、材质、光线、构图语言）。每张图都沿用该风格，只变化主体内容。图像生成模型不负责绘制文字：visualDescription 必须描述文字区留白，不要要求画面中出现字母、汉字、数字或水印。',
    `输出结构：{"suggestedTitles":["标题1","标题2","标题3"],"hook":"开篇钩子","sections":[{"headline":"分段标题","visualDescription":"章节画面方向","bodyDraft":"本段核心内容草案"}],"conclusion":"结尾总结或行动号召","visualStyle":"统一视觉风格","imagePlans":[{"index":1,"role":"cover","titleText":"上图标题","supportingText":"辅助短句","badgeText":"角标","visualDescription":"画面描述"},{"index":2,"role":"section","sectionIndex":1,"titleText":"本页标题","supportingText":"辅助文字","badgeText":"角标","visualDescription":"画面描述"}]}`,
    '正文规划提供 3 个标题、3 个分段；图片规划必须逐张覆盖，编号从 1 开始。所有上图文案必须真实、简短、无未经证实的数据。',
  ].filter(Boolean).join('\n\n')

  const referenceAttachments = !input.clients.isMock && referenceImageUrls.length
    ? await prepareSocialImageAttachments(referenceImageUrls, 4)
    : []
  const runner = createStageRunner({
    flowId: SOCIAL_WIZARD_OUTLINE_FLOW_ID,
    stages: SOCIAL_WIZARD_OUTLINE_STAGES,
    clients: input.clients,
    sink: input.sink,
    signal: input.signal,
  })
  return runner.runModel('plan-outline', {
    system,
    user,
    chatAttachments: referenceAttachments,
    responseFormat: { type: 'json_object' },
    parse: (raw) => parseWizardOutline(raw, imageCount, input.platform === 'wechat' || input.template.id !== 'no_cover'),
  })
}
