/** Shared TTS speed contract for the page slider and the local task queue. */
export const VOICE_SPEED_MIN = 0.8
export const VOICE_SPEED_MAX = 1.5

export function isVoiceSpeed(value: number): boolean {
  return Number.isFinite(value) && value >= VOICE_SPEED_MIN && value <= VOICE_SPEED_MAX
}

export function voiceSpeedError(value: number): string | undefined {
  return isVoiceSpeed(value) ? undefined : `语速必须在 ${VOICE_SPEED_MIN}–${VOICE_SPEED_MAX} 之间。`
}
