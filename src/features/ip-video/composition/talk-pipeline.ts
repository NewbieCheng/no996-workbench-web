export type TalkStageId = 'content' | 'visual' | 'voice' | 'generate' | 'edit' | 'export'

export type TalkPipelineStep = {
  id: TalkStageId
  labelKey: string
  hintKey: string
  requiresResult?: boolean
}

/** One linear creation path. Advanced preferences never become extra steps. */
export const TALK_PIPELINE_STEPS: readonly TalkPipelineStep[] = [
  { id: 'content', labelKey: 'stepContent', hintKey: 'stepContentHint' },
  { id: 'visual', labelKey: 'stepVisual', hintKey: 'stepVisualHint' },
  { id: 'voice', labelKey: 'stepVoice', hintKey: 'stepVoiceHint' },
  { id: 'generate', labelKey: 'stepGenerate', hintKey: 'stepGenerateHint' },
  { id: 'edit', labelKey: 'stepEdit', hintKey: 'stepEditHint', requiresResult: true },
  { id: 'export', labelKey: 'stepExport', hintKey: 'stepExportHint', requiresResult: true },
]

export type TalkStageAvailability = {
  allowed: boolean
  reasonKey?: 'needContent' | 'needVoiceChoice' | 'needResult'
}

export type TalkStageGateInput = {
  hasResult: boolean
  hasDuration: boolean
  canGenerate: boolean
  /** Content step satisfied (brief / script / audio / direction confirmed). */
  contentReady?: boolean
  /** Voice step satisfied (voice / audio / explicit skip). */
  voiceReady?: boolean
  /** User has visited/confirmed the visual step at least once in this session. */
  visualConfirmed?: boolean
}

export function talkStageIndex(stage: TalkStageId): number {
  return TALK_PIPELINE_STEPS.findIndex(item => item.id === stage)
}

export function talkStageNumber(stage: TalkStageId): number {
  return Math.max(1, talkStageIndex(stage) + 1)
}

export function defaultTalkStage(hasResult: boolean): TalkStageId {
  return hasResult ? 'edit' : 'content'
}

/**
 * Rail / jump gates. Later stages require earlier readiness so empty projects
 * cannot skip straight to generate.
 */
export function canEnterTalkStage(stage: TalkStageId, input: TalkStageGateInput): TalkStageAvailability {
  const contentReady = input.contentReady ?? (input.canGenerate || input.hasResult)
  const voiceReady = input.voiceReady ?? true
  if (stage === 'visual' || stage === 'voice') {
    return contentReady ? { allowed: true } : { allowed: false, reasonKey: 'needContent' }
  }
  if (stage === 'generate') {
    if (!contentReady && !input.hasResult) return { allowed: false, reasonKey: 'needContent' }
    if (!input.hasResult && !voiceReady) return { allowed: false, reasonKey: 'needVoiceChoice' }
    return input.canGenerate || input.hasResult ? { allowed: true } : { allowed: false, reasonKey: 'needContent' }
  }
  if (stage === 'edit' || stage === 'export') {
    return input.hasDuration ? { allowed: true } : { allowed: false, reasonKey: 'needResult' }
  }
  return { allowed: true }
}

export function nextTalkStage(stage: TalkStageId): TalkStageId {
  const index = talkStageIndex(stage)
  return TALK_PIPELINE_STEPS[Math.min(TALK_PIPELINE_STEPS.length - 1, index + 1)]?.id ?? 'export'
}

export function previousTalkStage(stage: TalkStageId): TalkStageId {
  const index = talkStageIndex(stage)
  return TALK_PIPELINE_STEPS[Math.max(0, index - 1)]?.id ?? 'content'
}
