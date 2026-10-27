import type { EnqueueTtsInput, TtsBlobRecord, TtsJobRecord } from './types'

export type TtsJobPatch = Partial<
  Pick<
    TtsJobRecord,
    | 'status'
    | 'startedAt'
    | 'finishedAt'
    | 'errorMessage'
    | 'mediaPath'
    | 'blobId'
    | 'audioByteLength'
  >
>

export type VoiceTtsRepository = {
  putJob(job: TtsJobRecord): Promise<void>
  patchJob(id: string, patch: TtsJobPatch): Promise<TtsJobRecord | null>
  getJob(id: string): Promise<TtsJobRecord | null>
  listJobsForUser(ownerUserId: number): Promise<TtsJobRecord[]>
  listAllJobs(): Promise<TtsJobRecord[]>
  deleteJob(id: string): Promise<void>
  putBlob(blob: TtsBlobRecord): Promise<void>
  getBlob(id: string): Promise<TtsBlobRecord | null>
  deleteBlob(id: string): Promise<void>
  pickNextQueued(): Promise<TtsJobRecord | null>
  resetStaleRunning(maxAgeMs: number): Promise<number>
  pruneForUser(ownerUserId: number): Promise<void>
  createQueuedJob(ownerUserId: number, input: EnqueueTtsInput): Promise<TtsJobRecord>
}
