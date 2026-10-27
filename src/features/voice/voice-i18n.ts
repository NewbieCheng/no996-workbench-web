import type { TFunction } from 'i18next'
import type { AgentStageDef } from '../../agent'
import { getPlatformVoiceCatalog } from '../../api/platform-voice-catalog'
import { VOICE_DUB_STAGES } from './agent/stages'
import { PLATFORM_VOICE_TAGS } from './voice-constants'
import type { TonePreset } from './voice-tone-presets'

export type VoiceTFunction = TFunction<'voice'>

export function tonePresetLabel(t: VoiceTFunction, preset: TonePreset): string {
  return t(`tonePreset.${preset}`)
}

export function localizeVoiceDubStages(t: VoiceTFunction): AgentStageDef[] {
  return VOICE_DUB_STAGES.map((stage) => ({
    ...stage,
    roleName: t(`flowStage.${stage.id}.roleName`),
    roleTag: t(`flowStage.${stage.id}.roleTag`),
    principle: t(`flowStage.${stage.id}.principle`),
    headline: t(`flowStage.${stage.id}.headline`),
  }))
}

export function platformVoiceItems(t: VoiceTFunction) {
  return getPlatformVoiceCatalog().map((v) => ({
    id: v.id,
    label: t(`platformVoice.${v.id}.label`, { defaultValue: v.label }),
    tag: t(`platformVoice.${v.id}.tag`, {
      defaultValue: PLATFORM_VOICE_TAGS[v.id] ?? t('tag.platform'),
    }),
    kind: 'platform' as const,
    selectable: true,
  }))
}

export const CLONE_READ_SCENE_IDS = ['random', 'health', 'tips', 'local'] as const
export type CloneReadSceneId = (typeof CLONE_READ_SCENE_IDS)[number]

export function cloneSceneLabel(t: VoiceTFunction, id: CloneReadSceneId): string {
  return t(`clone.scenes.${id}.label`)
}

export function cloneSceneText(t: VoiceTFunction, id: CloneReadSceneId): string {
  return t(`clone.scenes.${id}.text`)
}

export function cloneNameSuggestions(t: VoiceTFunction): string[] {
  return t('clone.nameSuggestions', { returnObjects: true }) as string[]
}

export function voiceTaskStatusLabel(
  t: VoiceTFunction,
  status: 'queued' | 'running' | 'failed' | 'cancelled' | 'succeeded' | string,
): string {
  const key = `taskStatus.${status}` as const
  const translated = t(key)
  return translated === key ? status : translated
}
