/** Minimum ideograph/grapheme count before the content step can continue. */
export const MIN_TALK_BRIEF_CHARS = 10

export function talkBriefCharCount(brief: string): number {
  return Array.from(brief.trim()).length
}

export function hasEnoughTalkBrief(brief: string): boolean {
  return talkBriefCharCount(brief) >= MIN_TALK_BRIEF_CHARS
}

/** Shared availability for the direct form and the optional guide, not task progress. */
export function canSubmitTalkCreation({ hasResult, brief, hasScript, hasAudio }: {
  hasResult: boolean
  brief: string
  hasScript: boolean
  hasAudio: boolean
}): boolean {
  // Existing work needs an explicit adjustment; original sound is sufficient for
  // a first visual plan, without pretending a transcript is available.
  return hasResult ? !!brief.trim() : hasEnoughTalkBrief(brief) || hasScript || hasAudio
}

/** Direction suggestions need user-authored text. A default persona is not enough. */
export function canSuggestTalkDirection({ brief, hasScript }: { brief: string; hasScript: boolean }): boolean {
  return !!brief.trim() || hasScript
}

/** Step 1: content is ready when brief has ≥10 chars, a script, or audio. */
export function canLeaveTalkContentStep({ brief, hasScript, hasAudio }: {
  brief: string
  hasScript: boolean
  hasAudio: boolean
  contentConfirmed?: boolean
}): boolean {
  return canSubmitTalkCreation({ hasResult: false, brief, hasScript, hasAudio })
}

/** Step 3: voice is ready when a voice/audio exists, or the user explicitly skipped. */
export function canLeaveTalkVoiceStep({ hasAudio, voiceId, voiceSkipped }: {
  hasAudio: boolean
  voiceId?: string
  voiceSkipped?: boolean
}): boolean {
  return hasAudio || !!voiceId?.trim() || !!voiceSkipped
}

export type TalkStepBlockerKey =
  | 'needContent'
  | 'needVisualConfirm'
  | 'needVoiceChoice'
  | 'needResult'
  | 'makeUnavailable'
  | 'adjustUnavailable'

export function talkContentBlockerKey(input: {
  brief: string
  hasScript: boolean
  hasAudio: boolean
  contentConfirmed?: boolean
}): TalkStepBlockerKey | undefined {
  return canLeaveTalkContentStep(input) ? undefined : 'needContent'
}

export function talkVoiceBlockerKey(input: {
  hasAudio: boolean
  voiceId?: string
  voiceSkipped?: boolean
}): TalkStepBlockerKey | undefined {
  return canLeaveTalkVoiceStep(input) ? undefined : 'needVoiceChoice'
}
