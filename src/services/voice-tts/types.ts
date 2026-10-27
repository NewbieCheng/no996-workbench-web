export type TtsJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type TtsJobRecord = {
  id: string
  ownerUserId: number
  status: TtsJobStatus
  createdAt: number
  startedAt?: number
  finishedAt?: number
  errorMessage?: string
  text: string
  textPreview: string
  voiceId: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
  mediaPath?: string
  blobId?: string
  audioMime: 'audio/wav'
  audioByteLength?: number
}

export type TtsBlobRecord = {
  id: string
  mime: string
  data: ArrayBuffer
}

export type EnqueueTtsInput = {
  text: string
  voiceId: string
  voiceLabel: string
  rate: number
  volume: number
  pitch: number
  instruction?: string
}

export const TTS_JOB_LIMITS = {
  maxSucceededPerUser: 80,
  maxBlobBytesPerUser: 150 * 1024 * 1024,
  maxFailedPerUser: 20,
  failedMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  staleRunningMs: 3 * 60 * 1000,
  textPreviewLen: 80,
} as const
