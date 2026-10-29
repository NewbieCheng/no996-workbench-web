import {
  createStageRunner,
  isAbortError,
  type AgentClients,
  type AgentSink,
} from '../../../agent'
import { extensionClient } from '../../../services/extension/extension-client'
import type { WorkbenchBridgeCollectedItem } from '../../../services/extension/workbench-bridge-contract'
import type { StoredChatAttachment } from '../../../lib/chat-attachments/prepare'
import {
  buildSocialStudioPrompt,
  extractUrlFromText,
  type ResolvedReference,
} from '../creative/build-social-studio-prompt'
import type { SocialStudioBrief, SocialStudioPlatform } from '../creative/social-studio-brief-types'
import type { SocialContentMode } from '../studio-types'
import { isWechatArticleUrl, resolveWechatArticleByUrl } from '../../../services/wechat-article/resolve-wechat-article-url'
import { buildSocialImagePrompts } from '../../../services/social-studio/generate-social-images'
import { SOCIAL_COMPOSE_FLOW_ID, SOCIAL_COMPOSE_STAGES } from './stages'

export type RunSocialComposeFlowInput = {
  platform: SocialStudioPlatform
  brief: SocialStudioBrief
  contentMode: SocialContentMode
  personaContent?: string
  chatAttachments?: StoredChatAttachment[]
  sessionItem?: WorkbenchBridgeCollectedItem | null
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  onDelta?: (chunk: string) => void
  onStageLabel?: (label: string) => void
}

export type SocialComposeFlowResult = {
  body: string
  reference: ResolvedReference | null
  imagePrompts: string[]
}

export async function resolveReference(
  platform: SocialStudioPlatform,
  brief: SocialStudioBrief,
  sessionItem: WorkbenchBridgeCollectedItem | null | undefined,
  clients: AgentClients,
  signal?: AbortSignal,
): Promise<ResolvedReference | null> {
  if (sessionItem) {
    return {
      title: sessionItem.title,
      content: sessionItem.content || sessionItem.title,
      author: sessionItem.author,
      platform: sessionItem.platformId,
      sourceUrl: sessionItem.url,
    }
  }

  const url = extractUrlFromText(brief.topic) || extractUrlFromText(brief.referenceText)
  if (!url || clients.isMock) return null

  try {
    if (platform === 'wechat' && isWechatArticleUrl(url)) {
      const article = await resolveWechatArticleByUrl(url, signal)
      return {
        title: article.title,
        content: article.content || article.title,
        author: article.author,
        platform: article.platformId,
        sourceUrl: article.url || url,
      }
    }
    const collected = await extensionClient.resolveWork(url)
    return {
      title: collected.title,
      content: collected.content || collected.title,
      author: collected.author,
      platform: collected.platformId,
      sourceUrl: url,
    }
  } catch (error) {
    if (platform === 'wechat' && isWechatArticleUrl(url)) throw error
    return { sourceUrl: url, title: '链接素材', content: brief.referenceText || brief.topic }
  }
}

export async function runSocialComposeFlow(input: RunSocialComposeFlowInput): Promise<SocialComposeFlowResult> {
  const runner = createStageRunner({
    flowId: SOCIAL_COMPOSE_FLOW_ID,
    stages: SOCIAL_COMPOSE_STAGES,
    clients: input.clients,
    sink: input.sink,
    signal: input.signal,
    background: input.personaContent?.trim() || undefined,
  })

  let reference: ResolvedReference | null = null

  await runner.runTool('resolve-reference', async () => {
    input.onStageLabel?.('正在解析参考素材…')
    reference = await resolveReference(input.platform, input.brief, input.sessionItem, input.clients, input.signal)
    return reference
  })

  const { system, user } = buildSocialStudioPrompt({
    platform: input.platform,
    brief: input.brief,
    contentMode: input.contentMode,
    personaContent: input.personaContent,
    reference,
  })

  input.onStageLabel?.('正在撰写正文…')

  let body = ''
  await runner.runModel('compose-body', {
    system,
    user,
    chatAttachments: input.chatAttachments,
    parse: (raw) => raw,
    onDelta: (chunk) => {
      body += chunk
      input.onDelta?.(chunk)
    },
  })

  const needImageStep = input.contentMode === 'image_text' && input.brief.imageCount > 0
  let imagePrompts: string[] = []
  if (needImageStep) {
    input.onStageLabel?.('正在准备配图提示…')
    imagePrompts = await runner.runAlgo('plan-images', () => buildSocialImagePrompts({
      title: input.brief.topic,
      style: `${input.brief.expressionStyle}, ${input.brief.voiceTone}`,
      count: 1,
    }))
  }

  return { body, reference, imagePrompts }
}

export { isAbortError }
