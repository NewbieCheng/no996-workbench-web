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
  reasonKey?: 'needContent' | 'needResult'
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

export function canEnterTalkStage(stage: TalkStageId, input: { hasResult: boolean; hasDuration: boolean; canGenerate: boolean }): TalkStageAvailability {
  if (stage === 'generate') return input.canGenerate || input.hasResult ? { allowed: true } : { allowed: false, reasonKey: 'needContent' }
  if (stage === 'edit' || stage === 'export') return input.hasDuration ? { allowed: true } : { allowed: false, reasonKey: 'needResult' }
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
