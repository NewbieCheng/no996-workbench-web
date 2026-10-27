import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'
import { findRewriteStyle } from './rewrite-style-catalog.ts'
import type { RewriteLengthPreset, SocialStudioRewriteSettings } from './social-studio-rewrite-types.ts'

const LENGTH_HINT: Record<RewriteLengthPreset, string> = {
  refined: '目标约为原文长度的 60%，适合短读，信息密度高。',
  balanced: '目标约为原文长度的 85%，信息尽量不丢。',
  original: '尽量贴近原文篇幅与信息完整度。',
  expanded: '目标约为原文长度的 130%，可适当补充论据与例子。',
  custom: '按用户指定的目标字数控制篇幅。',
}

export function lengthInstruction(settings: SocialStudioRewriteSettings, sourceCharCount: number): string {
  if (settings.lengthPreset === 'custom') {
    return `目标字数约 ${settings.customWordCount} 字（原文约 ${sourceCharCount} 字）。`
  }
  return LENGTH_HINT[settings.lengthPreset]
}

function humanFeelBlock(platform: SocialStudioPlatform, enabled: boolean): string {
  if (!enabled) return '保持专业克制，避免过度口语与表演式情绪。'
  if (platform === 'xhs') {
    return '强化活人感：像真实博主聊天，适度口语与共鸣，但长文仍保持分段小标题与可读结构。'
  }
  return '适度活人感：像具体的人在认真聊一件事，避免 AI 腔与堆砌口号；官号语气仍要克制。'
}

export type BuildRewritePassInput = {
  platform: SocialStudioPlatform
  settings: SocialStudioRewriteSettings
  sourceTitle: string
  sourceBody: string
  personaContent?: string
}

export function buildRewritePass1(input: BuildRewritePassInput): { system: string; user: string } {
  const style = findRewriteStyle(input.platform, input.settings.styleId)
  const platformLabel = input.platform === 'xhs' ? '小红书长文专栏' : '微信公众号长文'
  const system = `你是${platformLabel}改稿编辑。第一遍改写：保留原文信息与论述顺序，弱化营销腔与堆砌，把写法改得更清爽、好读。不要添加原文没有的事实、数据或承诺。`

  const customUrl = input.settings.customStyleUrl.trim()
  const styleBlock = style
    ? `【改写风格】${style.promptHint}${input.settings.styleId === 'custom' && customUrl ? `\n参考链接（仅学写法）：${customUrl}` : ''}`
    : ''

  const requirement = input.settings.rewriteRequirement.trim()
    ? `【本次改写要求】\n${input.settings.rewriteRequirement.trim()}`
    : ''

  const persona = input.personaContent?.trim()
    ? `【人设参考】\n${input.personaContent.trim()}`
    : ''

  const user = [
    `【原标题】\n${input.sourceTitle || '（无）'}`,
    `【原文】\n${input.sourceBody}`,
    styleBlock,
    `【篇幅】\n${lengthInstruction(input.settings, input.sourceBody.length)}`,
    `【活人感】\n${humanFeelBlock(input.platform, input.settings.humanFeelEnhance)}`,
    requirement,
    persona,
    '\n请直接输出改写后的正文（Markdown 友好），不要解释过程，不要 JSON。',
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

export function buildRewritePass2(input: {
  platform: SocialStudioPlatform
  settings: SocialStudioRewriteSettings
  pass1Body: string
  sourceTitle: string
}): { system: string; user: string } {
  const platformLabel = input.platform === 'xhs' ? '小红书' : '公众号'
  const system = `你是${platformLabel}终稿编辑。第二遍改写：在第一遍基础上弱化 AI 味与傲娇腔，加入更自然的共鸣和「人话」表达。你必须只输出一个 JSON 对象，格式为 {"titles":["标题1","标题2","标题3"],"body":"正文Markdown"}，不要 markdown 代码围栏，不要其它说明。`

  const user = [
    `【参考标题】${input.sourceTitle || '（无）'}`,
    `【第一遍稿】\n${input.pass1Body}`,
    `【活人感】\n${humanFeelBlock(input.platform, input.settings.humanFeelEnhance)}`,
    input.settings.rewriteRequirement.trim()
      ? `【额外要求】\n${input.settings.rewriteRequirement.trim()}`
      : '',
    'titles 提供 3 个不同钩子但事实一致的标题候选；body 为完整正文。',
  ]
    .filter(Boolean)
    .join('\n\n')

  return { system, user }
}

export function buildRewriteSettingsSummaryLines(
  platform: SocialStudioPlatform,
  settings: SocialStudioRewriteSettings,
  t: (key: string) => string,
): string[] {
  const style = findRewriteStyle(platform, settings.styleId)
  const styleLabel = style ? t(style.i18nKey) : settings.styleId
  const lengthKey =
    settings.lengthPreset === 'refined'
      ? 'rewriteLengthRefined'
      : settings.lengthPreset === 'balanced'
        ? 'rewriteLengthBalanced'
        : settings.lengthPreset === 'original'
          ? 'rewriteLengthOriginal'
          : settings.lengthPreset === 'expanded'
            ? 'rewriteLengthExpanded'
            : 'rewriteLengthCustom'
  const lines = [
    `${t('rewriteSummaryStyle')}：${styleLabel}`,
    `${t('rewriteSummaryLength')}：${t(lengthKey)}${settings.lengthPreset === 'custom' ? `（${settings.customWordCount}）` : ''}`,
    `${t('rewriteSummaryHumanFeel')}：${settings.humanFeelEnhance ? t('common:yes') : t('common:no')}`,
    `${t('rewriteSummarySecondPass')}：${settings.secondPassEnabled ? t('common:yes') : t('common:no')}`,
  ]
  const req = settings.rewriteRequirement.trim()
  if (req) lines.push(`${t('rewriteSummaryRequirement')}：${req.slice(0, 80)}${req.length > 80 ? '…' : ''}`)
  return lines
}
