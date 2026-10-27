/** Shared availability for the direct form and the optional guide, not task progress. */
export function canSubmitTalkCreation({ hasResult, brief, hasScript, hasAudio }: {
  hasResult: boolean
  brief: string
  hasScript: boolean
  hasAudio: boolean
}): boolean {
  // Existing work needs an explicit adjustment; original sound is sufficient for
  // a first visual plan, without pretending a transcript is available.
  return hasResult ? !!brief.trim() : !!brief.trim() || hasScript || hasAudio
}

/** Direction suggestions need user-authored text. A default persona is not enough. */
export function canSuggestTalkDirection({ brief, hasScript }: { brief: string; hasScript: boolean }): boolean {
  return !!brief.trim() || hasScript
}
