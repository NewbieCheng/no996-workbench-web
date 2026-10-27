import type { AgentRunSnapshot } from '../../../agent'

export type VoiceDubSegment = {
  id: string
  title: string
  text: string
  instruction: string
  role?: string
  estimatedSeconds?: number
  voiceId?: string
  status?: 'waiting' | 'running' | 'done' | 'failed'
  blobId?: string
  audioUrl?: string
  audioDuration?: number
}

export type VoiceDubAdvancedConfig = {
  documentText: string
  globalVoiceId: string
  globalVoiceLabel: string
  tonePreset?: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
  skipSegmentConfirm?: boolean
}

export type VoiceDubAdvancedResult = {
  title: string
  documentText: string
  globalVoiceId: string
  globalVoiceLabel: string
  segments: VoiceDubSegment[]
  mergedBlobId?: string
  totalDurationSeconds?: number
  run?: AgentRunSnapshot
  awaitingConfirm?: boolean
  usedMock?: boolean
  fallback?: boolean
  /** 方案校验后段数过多，合成可能较慢 */
  segmentsWarning?: boolean
}
