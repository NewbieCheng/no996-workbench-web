import type { TalkCreationInput } from '../agent/types'
import { talkLookById } from './talk-looks'
import type { TalkSettings } from './talk-model'

/** Generation preferences. Visual/look choices are stored in the document, not here. */
export type TalkBriefOptions = Pick<TalkCreationInput, 'scriptMode' | 'ratio' | 'motion' | 'captionPresetId' | 'preserve'>

export const DEFAULT_TALK_BRIEF_OPTIONS: TalkBriefOptions = {
  scriptMode: 'auto',
  ratio: 'auto',
  motion: 'auto',
  preserve: { captions: false, composition: false, shots: false },
}

/**
 * The default look is only a preview. AI may still choose captions/motion until the
 * user explicitly picks a look/template or protects a group.
 */
export function initialTalkOptions(state: TalkSettings): TalkBriefOptions {
  const look = talkLookById(state.lookId)
  const keepCaptions = !!state.aiProtected?.captions
  return {
    ...DEFAULT_TALK_BRIEF_OPTIONS,
    ...(keepCaptions && look ? { captionPresetId: look.captionPresetId, motion: look.motion } : {}),
    preserve: {
      captions: keepCaptions,
      composition: !!state.aiProtected?.composition,
      shots: !!state.aiProtected?.shots,
    },
  }
}

/** Document protection is authoritative; options can only add protection, never remove it. */
export function effectiveTalkOptions(options: TalkBriefOptions, state: TalkSettings): TalkBriefOptions {
  return {
    ...options,
    preserve: {
      captions: !!state.aiProtected?.captions || options.preserve.captions,
      composition: !!state.aiProtected?.composition || options.preserve.composition,
      shots: !!state.aiProtected?.shots || options.preserve.shots,
    },
  }
}

/** Selecting a look/template is an explicit style lock; it should survive the next AI run. */
export function lockCaptions(options: TalkBriefOptions): TalkBriefOptions {
  return { ...options, preserve: { ...options.preserve, captions: true } }
}
