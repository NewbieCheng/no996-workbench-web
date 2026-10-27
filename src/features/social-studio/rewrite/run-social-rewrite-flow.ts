import {
  createStageRunner,
  isAbortError,
  type AgentClients,
  type AgentSink,
} from '../../../agent'
import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'
import { buildRewritePass1, buildRewritePass2 } from './build-social-rewrite-prompt'
import { parseRewritePass2Raw } from './parse-rewrite-pass2'
import type { RewritePass2Payload, SocialStudioRewriteSettings } from './social-studio-rewrite-types'
import { SOCIAL_REWRITE_FLOW_ID, SOCIAL_REWRITE_STAGES } from './stages'

export type RunSocialRewriteFlowInput = {
  platform: SocialStudioPlatform
  settings: SocialStudioRewriteSettings
  sourceTitle: string
  sourceBody: string
  personaContent?: string
  clients: AgentClients
  sink?: AgentSink
  signal?: AbortSignal
  onPass1Delta?: (chunk: string) => void
  onPass2Delta?: (chunk: string) => void
  onStageLabel?: (label: string) => void
  onProgress?: (percent: number) => void
}

export type SocialRewriteFlowResult = {
  pass1Body: string
  pass2: RewritePass2Payload | null
  secondPassSkipped: boolean
}

export async function runSocialRewriteFlow(input: RunSocialRewriteFlowInput): Promise<SocialRewriteFlowResult> {
  const runner = createStageRunner({
    flowId: SOCIAL_REWRITE_FLOW_ID,
    stages: SOCIAL_REWRITE_STAGES,
    clients: input.clients,
    sink: input.sink,
    signal: input.signal,
    background: input.personaContent?.trim() || undefined,
  })

  const pass1Prompt = buildRewritePass1({
    platform: input.platform,
    settings: input.settings,
    sourceTitle: input.sourceTitle,
    sourceBody: input.sourceBody,
    personaContent: input.personaContent,
  })

  input.onStageLabel?.('正在生成第一遍改写…')
  input.onProgress?.(5)

  let pass1Body = ''
  await runner.runModel('rewrite-pass1', {
    system: pass1Prompt.system,
    user: pass1Prompt.user,
    parse: (raw) => raw,
    onDelta: (chunk) => {
      pass1Body += chunk
      input.onPass1Delta?.(chunk)
      input.onProgress?.(Math.min(40, 5 + Math.floor(pass1Body.length / 80)))
    },
  })

  pass1Body = pass1Body.trim()
  if (!pass1Body) {
    throw new Error('第一遍改写结果为空')
  }

  input.onProgress?.(42)

  if (!input.settings.secondPassEnabled) {
    input.onStageLabel?.('已跳过第二遍改写')
    input.onProgress?.(100)
    return { pass1Body, pass2: null, secondPassSkipped: true }
  }

  const pass2Prompt = buildRewritePass2({
    platform: input.platform,
    settings: input.settings,
    pass1Body,
    sourceTitle: input.sourceTitle,
  })

  input.onStageLabel?.('正在生成第二遍改写…')
  let pass2Raw = ''
  await runner.runModel('rewrite-pass2', {
    system: pass2Prompt.system,
    user: pass2Prompt.user,
    parse: (raw) => raw,
    onDelta: (chunk) => {
      pass2Raw += chunk
      input.onPass2Delta?.(chunk)
      input.onProgress?.(Math.min(92, 42 + Math.floor(pass2Raw.length / 120)))
    },
  })

  input.onStageLabel?.('正在整理标题候选…')
  input.onProgress?.(95)

  let pass2: RewritePass2Payload | null = null
  await runner.runAlgo('rewrite-titles', async () => {
    pass2 = parseRewritePass2Raw(pass2Raw, input.sourceTitle || '改写标题')
    return pass2
  })

  input.onProgress?.(100)
  return { pass1Body, pass2, secondPassSkipped: false }
}

export { isAbortError }
