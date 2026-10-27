import { TTS_JOB_LIMITS, type TtsJobRecord, type TtsJobStatus } from './types.ts'

const TERMINAL: TtsJobStatus[] = ['succeeded', 'failed', 'cancelled']

export function canTransition(from: TtsJobStatus, to: TtsJobStatus): boolean {
  if (from === to) return true
  if (from === 'queued' && (to === 'running' || to === 'cancelled')) return true
  if (from === 'running' && (to === 'succeeded' || to === 'failed' || to === 'queued')) return true
  if (TERMINAL.includes(from)) return false
  return false
}

export function pickNextQueuedJob(jobs: TtsJobRecord[]): TtsJobRecord | null {
  const hasRunning = jobs.some((j) => j.status === 'running')
  if (hasRunning) return null
  const queued = jobs
    .filter((j) => j.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt)
  return queued[0] ?? null
}

export function countActiveJobs(jobs: TtsJobRecord[], ownerUserId?: number): number {
  return jobs.filter(
    (j) =>
      (j.status === 'queued' || j.status === 'running') &&
      (ownerUserId === undefined || j.ownerUserId === ownerUserId),
  ).length
}

export type PruneInput = {
  jobs: TtsJobRecord[]
  blobBytes: Map<string, number>
  ownerUserId: number
  now: number
}

export type PruneResult = {
  deleteJobIds: string[]
  deleteBlobIds: string[]
}

/** 决定应删除的 job / blob id（纯函数，便于单测） */
export function planPruneForUser(input: PruneInput): PruneResult {
  const { jobs, blobBytes, ownerUserId, now } = input
  const mine = jobs.filter((j) => j.ownerUserId === ownerUserId)
  const deleteJobIds = new Set<string>()
  const deleteBlobIds = new Set<string>()

  const failed = mine
    .filter((j) => j.status === 'failed')
    .sort((a, b) => b.createdAt - a.createdAt)
  for (const j of failed.slice(TTS_JOB_LIMITS.maxFailedPerUser)) {
    deleteJobIds.add(j.id)
  }
  for (const j of failed) {
    if (now - j.createdAt > TTS_JOB_LIMITS.failedMaxAgeMs) deleteJobIds.add(j.id)
  }

  const succeeded = mine
    .filter((j) => j.status === 'succeeded')
    .sort((a, b) => b.createdAt - a.createdAt)

  let totalBytes = succeeded.reduce((sum, j) => {
    if (!j.blobId) return sum
    return sum + (blobBytes.get(j.blobId) ?? j.audioByteLength ?? 0)
  }, 0)

  const keepSucceeded = [...succeeded]
  while (
    keepSucceeded.length > TTS_JOB_LIMITS.maxSucceededPerUser ||
    totalBytes > TTS_JOB_LIMITS.maxBlobBytesPerUser
  ) {
    const drop = keepSucceeded.pop()
    if (!drop) break
    deleteJobIds.add(drop.id)
    if (drop.blobId) {
      deleteBlobIds.add(drop.blobId)
      totalBytes -= blobBytes.get(drop.blobId) ?? drop.audioByteLength ?? 0
    }
  }

  for (const id of deleteJobIds) {
    const job = mine.find((j) => j.id === id)
    if (job?.blobId) deleteBlobIds.add(job.blobId)
  }

  return {
    deleteJobIds: [...deleteJobIds],
    deleteBlobIds: [...deleteBlobIds],
  }
}

export function newJobId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
