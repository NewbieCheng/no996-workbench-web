import type { SocialStudioPlatform } from '../creative/social-studio-brief-types'

export type RewriteStyleId =
  | 'pain_leads'
  | 'contrarian_traffic'
  | 'pitfall_persona'
  | 'trust_persona'
  | 'tutorial_growth'
  | 'custom'

export type RewriteLengthPreset = 'refined' | 'balanced' | 'original' | 'expanded' | 'custom'

export type SocialStudioRewriteSettings = {
  styleId: RewriteStyleId
  customStyleUrl: string
  rewriteRequirement: string
  lengthPreset: RewriteLengthPreset
  customWordCount: number
  humanFeelEnhance: boolean
  secondPassEnabled: boolean
  wizardPage: 1 | 2 | 3
}

export function createDefaultRewriteSettings(platform: SocialStudioPlatform): SocialStudioRewriteSettings {
  return {
    styleId: 'pain_leads',
    customStyleUrl: '',
    rewriteRequirement: '',
    lengthPreset: 'balanced',
    customWordCount: 1600,
    humanFeelEnhance: platform === 'xhs',
    secondPassEnabled: true,
    wizardPage: 1,
  }
}

export type RewritePass2Payload = {
  titles: string[]
  body: string
}

export type SocialStudioRewriteSession = {
  pass1Body: string
  pass2Payload: RewritePass2Payload | null
  selectedTitleIndex: number
  secondPassSkipped: boolean
}

export function createEmptyRewriteSession(): SocialStudioRewriteSession {
  return {
    pass1Body: '',
    pass2Payload: null,
    selectedTitleIndex: 0,
    secondPassSkipped: false,
  }
}
