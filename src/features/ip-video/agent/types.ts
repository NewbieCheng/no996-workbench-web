import type { EditorDocument } from '@no996/video-editor'
import type { AgentClients, AgentRunSnapshot, AgentSink } from '../../../agent'
import type { CONTENT_SHOT_DEFINITIONS } from '@no996/video-editor/demos/content-variants.tsx'
import type { TalkComposition } from '../composition/talk-model'

export type TalkCreationInput = {
  intent: 'directions' | 'create' | 'adjust'
  brief: string
  document: EditorDocument
  scriptMode: 'auto' | 'verbatim' | 'rewrite'
  ratio: 'auto' | '9:16' | '16:9' | '1:1' | '3:4'
  captionPresetId?: string
  motion: 'auto' | 'calm' | 'normal' | 'lively'
  personaContent?: string
  preserve: { captions: boolean; composition: boolean; shots: boolean }
  adjustment?: string
}
export type TalkDirection = { title: string; opening: string; reason: string }
export type TalkDirectorShot = {
  shotId: (typeof CONTENT_SHOT_DEFINITIONS)[number]['shotId']
  text: string
  subline: string
  /** Zero-based index into the final document's caption cues. */
  cueIndex: number
}
export type TalkDirectorPlan = {
  version: 1
  title: string
  /** Empty only for visual-only planning without an available transcript. */
  script: string
  summary: string
  captionPresetId: string
  ratio: '9:16' | '16:9' | '1:1' | '3:4'
  composition: TalkComposition
  motion: 'calm' | 'normal' | 'lively'
  shots: TalkDirectorShot[]
}
export type TalkCreationResult =
  | { kind: 'directions'; directions: TalkDirection[]; run: AgentRunSnapshot; usedMock: boolean }
  | { kind: 'composition'; plan: TalkDirectorPlan; run: AgentRunSnapshot; usedMock: boolean }
export type RunTalkCreationOptions = {
  input: TalkCreationInput; clients: AgentClients; sink?: AgentSink
  signal?: AbortSignal; onDelta?: (chunk: string) => void
}
/** Stored under ipVideo.director; no executable data, URLs or editor revision authority. */
export type TalkDirectorMetadata = {
  version: 1
  taskId: string
  plan: TalkDirectorPlan
  preserveShots?: boolean
  shots: Array<{ elementId: string; cueIndex: number; timing?: { startUs: number; durationUs: number; sourceDurationFrames: number; rate: number } }>
}
