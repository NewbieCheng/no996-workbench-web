import { IP_VIDEO_TEMPLATES } from '../templates.ts'
import { TALK_CAPTION_PRESETS } from './talk-caption-presets.ts'
import { applyTalkComposition, talkSettings, type TalkComposition, type TalkDocument } from './talk-model.ts'

export type TalkLookId = 'scroll' | 'poster' | 'call' | 'career' | 'life' | 'lesson' | 'audiogram' | 'tiktok'
export type TalkLookMotion = 'calm' | 'normal' | 'lively'

export type TalkLook = {
  id: TalkLookId
  name: string
  heading: string
  caption: string
  captionPresetId: string
  backgroundColor: string
  composition: TalkComposition
  motion: TalkLookMotion
}

const SOURCE = Object.fromEntries(IP_VIDEO_TEMPLATES.map(item => [item.id, item]))

function look(id: TalkLookId, captionPresetId: string, composition: TalkComposition, motion: TalkLookMotion): TalkLook {
  const source = SOURCE[id]
  const preset = TALK_CAPTION_PRESETS.find(item => item.id === captionPresetId)
  if (!source || !preset) throw new Error(`成片样式未登记：${id}`)
  return {
    id, name: source.name, heading: source.heading, caption: source.caption,
    captionPresetId, backgroundColor: source.background, composition, motion,
  }
}

/** Eight finished-video looks. Captions, canvas and framing only — no media, audio, or unregistered shots. */
export const TALK_LOOKS: readonly TalkLook[] = [
  look('scroll', 'relay', 'full', 'calm'),
  look('poster', 'bold', 'full', 'lively'),
  look('call', 'headline', 'pip', 'normal'),
  look('career', 'editorial', 'side', 'calm'),
  look('life', 'paper', 'full', 'calm'),
  look('lesson', 'lecture', 'full', 'normal'),
  look('audiogram', 'headline', 'full', 'calm'),
  look('tiktok', 'playful', 'full', 'lively'),
]

export function talkLookById(id: string | undefined): TalkLook | undefined {
  return TALK_LOOKS.find(item => item.id === id)
}

export function hasTalkVisual(doc: TalkDocument): boolean {
  return doc.tracks.some(track => track.elements.some(element => element.type === 'image' || element.type === 'video'))
}

export function applyTalkLook(doc: TalkDocument, lookId: string): TalkDocument {
  const value = talkLookById(lookId)
  if (!value) throw new Error('未知的成片样式。')
  const preset = TALK_CAPTION_PRESETS.find(item => item.id === value.captionPresetId)
  if (!preset) throw new Error('未知的成片样式。')
  const state = talkSettings(doc)
  const next: TalkDocument = {
    ...doc,
    canvas: { ...doc.canvas, backgroundColor: value.backgroundColor },
    captionStyle: { ...preset.style },
    ipVideo: {
      ...state,
      lookId: value.id,
      captionPresetId: value.captionPresetId,
      styleTemplate: { id: `look:${value.id}`, name: value.name },
      aiProtected: { ...state.aiProtected, captions: true, composition: true },
    },
  }
  return hasTalkVisual(next) ? applyTalkComposition(next, value.composition) : next
}
